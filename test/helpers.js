import { runHandler } from '../src/server/api/route.js';

// A stand-in for pg.Pool: answers by matching SQL text, records every call.
export function fakeDb(handlers) {
  const calls = [];
  return {
    calls,
    async query(text, params = []) {
      calls.push({ text, params });
      for (const [pattern, rows] of handlers) {
        if (pattern instanceof Error) throw pattern;
        if (pattern.test(text)) {
          if (rows instanceof Error) throw rows;
          return { rows: typeof rows === 'function' ? rows(params) : rows };
        }
      }
      return { rows: [] };
    },
  };
}

// Calls an API handler like its route would: GET url → { status, headers, body }.
export async function call(handler, db, path, params = {}) {
  const res = await runHandler(handler, db, new Request(`http://test${path}`), params);
  return { status: res.status, headers: res.headers, body: await res.json() };
}
