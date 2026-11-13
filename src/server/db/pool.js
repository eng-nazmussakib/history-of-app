import 'server-only';
import pg from 'pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { config } from '../config.js';

// pg returns BIGINT (int8) as strings by default; our IDs fit in a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

// Neon's connection strings (written by `neon env pull` / `neon deploy`) say
// sslmode=require. pg 8 already treats prefer/require/verify-ca as verify-full
// but warns on every start that v9 will weaken them to libpq semantics. Pin
// today's behaviour (verify the certificate and host) so the warning goes away
// and a pg upgrade can't silently relax TLS. URLs without sslmode (the local
// socket default) and ones opting into uselibpqcompat are left alone.
export function pinSslMode(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const mode = url.searchParams.get('sslmode');
  if (!['prefer', 'require', 'verify-ca'].includes(mode) || url.searchParams.has('uselibpqcompat')) {
    return connectionString;
  }
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

// One shared pool. It connects lazily, so the app starts even when the
// database is down; requests then fail with 503 (see server/api/errors.js).
// DATABASE_URL is Neon's pooled (PgBouncer) URL, which suits request traffic;
// migrations use the direct URL from ../history-of-db/neon/setup.sh instead.
// The connect timeout covers a Neon compute waking from scale-to-zero (usually
// well under a second) without letting a dead database hang requests.
export function createPool(connectionString = config.databaseUrl) {
  const pool = new pg.Pool({
    connectionString: pinSslMode(connectionString),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client losing its connection must not crash the process.
  pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  return pool;
}

// On Cloudflare Workers (OpenNext), the Worker's bindings, or null anywhere
// else (next dev, next start, next build, tests): OpenNext throws when there's
// no Cloudflare context, hence the try.
function cloudflareEnv() {
  try {
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}

// Workers: a client per query, through Hyperdrive. A Worker can't reuse a
// socket opened during another request ("Cannot perform I/O on behalf of a
// different request"), so a process-wide pool breaks there. Hyperdrive keeps
// the real connections to Neon warm on Cloudflare's side, which makes opening
// a fresh one per query cheap. Callers only use db.query(text, params), so
// that's all this object offers.
function hyperdriveDb(hyperdrive) {
  return {
    async query(text, params) {
      const client = new pg.Client({
        connectionString: hyperdrive.connectionString,
        connectionTimeoutMillis: 10_000,
      });
      // Closing the socket after the query raises a harmless "socket has been
      // closed" error on workerd; only report errors from before that.
      let ending = false;
      client.on('error', (err) => {
        if (!ending) console.error('Postgres client error:', err.message);
      });
      await client.connect();
      try {
        return await client.query(text, params);
      } finally {
        ending = true;
        client.end().catch(() => {});
      }
    },
  };
}

// The database for route handlers and server components. Workers with a
// HYPERDRIVE binding: per-query clients (above). Everywhere else: one
// process-wide pool, kept on globalThis so dev hot reloads don't open a new
// pool each time.
export function getDb() {
  const hyperdrive = cloudflareEnv()?.HYPERDRIVE;
  if (hyperdrive) return hyperdriveDb(hyperdrive);
  globalThis.__historyOfPool ??= createPool();
  return globalThis.__historyOfPool;
}
