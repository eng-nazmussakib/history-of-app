import { afterEach, describe, expect, test, vi } from 'vitest';
import { pinSslMode } from '../src/server/db/pool.js';

describe('pinSslMode', () => {
  test('pins Neon-style sslmode=require to verify-full, keeping other params', () => {
    const out = new URL(pinSslMode('postgresql://u:p@ep-x-pooler.example.neon.tech/neondb?sslmode=require&channel_binding=require'));
    expect(out.searchParams.get('sslmode')).toBe('verify-full');
    expect(out.searchParams.get('channel_binding')).toBe('require');
    expect(out.hostname).toBe('ep-x-pooler.example.neon.tech');
    expect(out.password).toBe('p');
  });

  test.each([
    'postgresql:///history_of?host=/var/run/postgresql',
    'postgresql://u@db/x?sslmode=verify-full',
    'postgresql://u@db/x?sslmode=disable',
    'postgresql://u@db/x?uselibpqcompat=true&sslmode=require',
    'not a url',
  ])('leaves %s unchanged', (url) => expect(pinSslMode(url)).toBe(url));
});

// getDb() on Cloudflare Workers (OpenNext context with a HYPERDRIVE binding)
// versus everywhere else. pg.Client is faked so no database is needed.
describe('getDb', () => {
  afterEach(() => {
    vi.doUnmock('@opennextjs/cloudflare');
    vi.doUnmock('pg');
    vi.resetModules();
  });

  async function loadPool({ env }) {
    const clients = [];
    class FakeClient {
      constructor(options) {
        this.options = options;
        this.ended = false;
        clients.push(this);
      }
      on() {}
      async connect() {}
      async query(text, params) {
        if (text === 'FAIL') throw new Error('boom');
        return { rows: [{ text, params }] };
      }
      async end() {
        this.ended = true;
      }
    }
    vi.doMock('pg', async (importOriginal) => {
      const pg = (await importOriginal()).default;
      return { default: { ...pg, Client: FakeClient } };
    });
    vi.doMock('@opennextjs/cloudflare', () => ({
      getCloudflareContext: () => {
        if (!env) throw new Error('no Cloudflare context');
        return { env };
      },
    }));
    const pool = await import('../src/server/db/pool.js');
    return { ...pool, clients };
  }

  test('outside Workers, returns one shared pg.Pool', async () => {
    const { getDb } = await loadPool({ env: null });
    const db = getDb();
    expect(db.constructor.name).toBe('BoundPool');
    expect(getDb()).toBe(db);
  });

  test('on Workers, opens a Hyperdrive client per query and closes it', async () => {
    const hyperdrive = { connectionString: 'postgresql://u:p@hyperdrive.local:5432/db' };
    const { getDb, clients } = await loadPool({ env: { HYPERDRIVE: hyperdrive } });
    const db = getDb();

    const res = await db.query('SELECT $1', [1]);
    await db.query('SELECT 2');

    expect(res.rows).toEqual([{ text: 'SELECT $1', params: [1] }]);
    expect(clients).toHaveLength(2);
    expect(clients[0].options.connectionString).toBe(hyperdrive.connectionString);
    expect(clients.every((c) => c.ended)).toBe(true);
  });

  test('on Workers, closes the client when a query fails', async () => {
    const { getDb, clients } = await loadPool({ env: { HYPERDRIVE: { connectionString: 'postgresql://h/db' } } });
    await expect(getDb().query('FAIL')).rejects.toThrow('boom');
    expect(clients[0].ended).toBe(true);
  });
});
