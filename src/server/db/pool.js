import 'server-only';
import pg from 'pg';
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

// The process-wide pool, shared by route handlers and server components.
// Kept on globalThis so dev hot reloads don't open a new pool each time.
export function getDb() {
  globalThis.__historyOfPool ??= createPool();
  return globalThis.__historyOfPool;
}
