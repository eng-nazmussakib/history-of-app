// The /health and /v1 handlers with a fake database: routing-level behaviour,
// validation, SQL parameters and response shapes, without PostgreSQL.
import { beforeAll, describe, expect, test } from 'vitest';
import * as api from '../src/server/api/handlers.js';
import { parseTags, parseYear } from '../src/server/api/params.js';
import { call, fakeDb } from './helpers.js';

const JAPAN = {
  slug: 'japan', name: 'Japan', type: 'country', description: 'Island country in East Asia',
  aliases: ['Nippon'], start_year: null, end_year: null, metadata: { iso_alpha2: 'JP' },
  event_count: 2, first_year: 1603, last_year: 1945,
};

const EVENT_ROWS = [
  {
    id: 1, title: 'Edo period', summary: 'Tokugawa rule.', start_year: 1603, start_month: 3,
    start_day: 24, end_year: 1868, end_month: null, end_day: null, precision: 'day',
    display_date: '24 March 1603 – 1868', importance: 80, tags: ['era'],
    sources: [{ name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Edo_period' }],
  },
];

describe('basics', () => {
  test('GET /health returns ok', async () => {
    const res = api.health();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  test('GET /health/ready checks the database', async () => {
    const ok = await api.ready(fakeDb([[/SELECT 1/, [{ '?column?': 1 }]]]));
    expect(await ok.json()).toEqual({ status: 'ok', database: 'ok' });
    const down = await api.ready(fakeDb([[/SELECT 1/, Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })]]));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ status: 'unavailable', database: 'ECONNREFUSED' });
  });

  test('GET /v1 lists the endpoints', async () => {
    const body = await api.index().json();
    expect(body.version).toBe(1);
    expect(body.endpoints).toContain('GET /v1/terms/:slug/events?from=&to=&tags=&page=&limit=');
  });

  test('unknown /v1 routes return a JSON 404', async () => {
    const { status, body } = await call(api.notFound, fakeDb([]), '/v1/nope');
    expect(status).toBe(404);
    expect(body.error).toEqual({ status: 404, message: 'No route for GET /v1/nope' });
  });

  test('database outages are a 503, bugs a generic 500', async () => {
    const down = fakeDb([[/./, Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })]]);
    expect((await call(api.term, down, '/v1/terms/japan', { slug: 'japan' })).body.error).toEqual({
      status: 503,
      message: 'Database unavailable',
    });
    const broken = fakeDb([[/./, new Error('column "x" does not exist')]]);
    const original = console.error;
    console.error = () => {};
    try {
      const { status, body } = await call(api.term, broken, '/v1/terms/japan', { slug: 'japan' });
      expect(status).toBe(500);
      expect(body.error.message).toBe('Internal server error');
    } finally {
      console.error = original;
    }
  });
});

describe('/v1/terms', () => {
  let db;
  beforeAll(() => {
    db = fakeDb([
      [/FROM terms t\s+WHERE \(\$1::term_type/, [{ slug: 'japan', name: 'Japan', type: 'country', event_count: 2 }]],
      [/count\(e\.id\)/, (params) => (params[0] === 'japan' ? [JAPAN] : [])],
      [/count\(\*\)::int AS total/, [{ total: 41 }]],
      [/AS tag, count\(\*\)/, [{ tag: 'war', count: 7 }, { tag: 'era', count: 3 }]],
      [/LIMIT \$5 OFFSET \$6/, EVENT_ROWS],
      [/similarity/, [{ slug: 'united-states', name: 'United States', type: 'country', match: 'exact' }]],
    ]);
  });
  const events = (path) => call(api.termEvents, db, path, { slug: path.split('/')[3] });
  const lastPageQuery = () => db.calls.findLast((c) => /LIMIT \$5 OFFSET \$6/.test(c.text));

  test('lists terms by type', async () => {
    const { status, body } = await call(api.terms, db, '/v1/terms?type=country');
    expect(status).toBe(200);
    expect(body.terms).toEqual([{ slug: 'japan', name: 'Japan', type: 'country', eventCount: 2 }]);
  });

  test('rejects an unknown term type', async () => {
    expect((await call(api.terms, db, '/v1/terms?type=planet')).status).toBe(400);
  });

  test('returns one term with its event span', async () => {
    const { status, body } = await call(api.term, db, '/v1/terms/japan', { slug: 'japan' });
    expect(status).toBe(200);
    expect(body.term.name).toBe('Japan');
    expect(body.term.span).toEqual({ from: 1603, to: 1945 });
  });

  test('404s for a missing term', async () => {
    const { status, body } = await call(api.term, db, '/v1/terms/atlantis', { slug: 'atlantis' });
    expect(status).toBe(404);
    expect(body.error.message).toMatch(/atlantis/);
    expect((await events('/v1/terms/atlantis/events')).status).toBe(404);
  });

  test('400s for an invalid slug', async () => {
    expect((await call(api.term, db, '/v1/terms/Not_A_Slug', { slug: 'Not_A_Slug' })).status).toBe(400);
  });

  test('returns serialized events and passes filters to SQL', async () => {
    const { status, body } = await events('/v1/terms/japan/events?from=1900&to=660BCE&tags=war,Treaty');
    expect(status).toBe(200);
    // from/to are swapped when reversed; tags are normalized and sorted.
    expect(body.filters).toEqual({ from: -660, to: 1900, tags: ['treaty', 'war'] });
    expect(lastPageQuery().params).toEqual(['japan', -660, 1900, ['treaty', 'war'], 20, 0]);
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 41, totalPages: 3 });
    expect(body.facets.tags).toEqual([{ tag: 'war', count: 7 }, { tag: 'era', count: 3 }]);
    expect(body.events[0]).toEqual({
      id: 1,
      title: 'Edo period',
      summary: 'Tokugawa rule.',
      year: 1603,
      start: { year: 1603, month: 3, day: 24, precision: 'day' },
      end: { year: 1868, month: null, day: null },
      displayDate: '24 March 1603 – 1868',
      importance: 80,
      tags: ['era'],
      sources: [{ name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Edo_period' }],
    });
  });

  test('accepts repeated tags parameters', async () => {
    const { body } = await events('/v1/terms/japan/events?tags=war&tags=battle');
    expect(body.filters.tags).toEqual(['battle', 'war']);
  });

  test('pages through the timeline', async () => {
    const { status, body } = await events('/v1/terms/japan/events?page=3&limit=5');
    expect(status).toBe(200);
    expect(lastPageQuery().params.slice(4)).toEqual([5, 10]);
    expect(body.pagination).toEqual({ page: 3, pageSize: 5, total: 41, totalPages: 9 });
  });

  test('caps the page size and rejects bad pages', async () => {
    expect((await events('/v1/terms/japan/events?limit=1000')).body.pagination.pageSize).toBe(100);
    expect((await events('/v1/terms/japan/events?page=0')).status).toBe(400);
    expect((await events('/v1/terms/japan/events?page=two')).status).toBe(400);
  });

  test('400s for a malformed year', async () => {
    const { status, body } = await events('/v1/terms/japan/events?from=soon');
    expect(status).toBe(400);
    expect(body.error.message).toMatch(/from/);
  });

  test('search returns ranked matches', async () => {
    const { status, body } = await call(api.search, db, '/v1/search?q=USA');
    expect(status).toBe(200);
    expect(body).toEqual({
      query: 'USA',
      results: [{ slug: 'united-states', name: 'United States', type: 'country', match: 'exact' }],
    });
  });

  test('search requires q and caps its length', async () => {
    expect((await call(api.search, db, '/v1/search')).status).toBe(400);
    expect((await call(api.search, db, `/v1/search?q=${'a'.repeat(101)}`)).status).toBe(400);
  });
});

describe('parameter parsing', () => {
  test('years accept BCE/CE suffixes and reject year 0', () => {
    expect(parseYear('660BCE', 'from')).toBe(-660);
    expect(parseYear('660 bc', 'from')).toBe(-660);
    expect(parseYear('-660', 'from')).toBe(-660);
    expect(parseYear('1066AD', 'from')).toBe(1066);
    expect(parseYear(undefined, 'from')).toBeNull();
    expect(() => parseYear('0', 'from')).toThrow(/no year 0/);
  });

  test('tags are deduplicated, lowercased and sorted', () => {
    expect(parseTags('War, treaty,war')).toEqual(['treaty', 'war']);
    expect(parseTags(['a', 'b,c'])).toEqual(['a', 'b', 'c']);
    expect(parseTags('')).toBeNull();
    expect(() => parseTags('bad tag!')).toThrow();
  });
});
