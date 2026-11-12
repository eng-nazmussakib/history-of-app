// Runs the real SQL against the local database (seeded with migrate.sh --seed).
// Skipped automatically when the database can't be reached, so `npm test`
// still passes on machines without PostgreSQL.
import { afterAll, describe, expect, test } from 'vitest';
import * as api from '../src/server/api/handlers.js';
import { createPool } from '../src/server/db/pool.js';
import { call } from './helpers.js';

const pool = createPool(process.env.DATABASE_URL ?? 'postgresql:///history_of?host=/var/run/postgresql');
const available = await pool.query("SELECT count(*)::int AS n FROM terms WHERE type = 'country'").then(
  (r) => r.rows[0].n > 0,
  () => false,
);
if (!available) await pool.end();

describe.skipIf(!available)('API against the real database', () => {
  afterAll(() => pool.end());
  const events = (query = '') => call(api.termEvents, pool, `/v1/terms/japan/events${query}`, { slug: 'japan' });

  test('readiness is ok', async () => {
    expect((await api.ready(pool)).status).toBe(200);
  });

  test('lists countries (term_type filter)', async () => {
    const { status, body } = await call(api.terms, pool, '/v1/terms?type=country&limit=5');
    expect(status).toBe(200);
    expect(body.terms).toHaveLength(5);
    expect(body.terms.every((t) => t.type === 'country')).toBe(true);
  });

  test('returns a term with its span', async () => {
    const { status, body } = await call(api.term, pool, '/v1/terms/japan', { slug: 'japan' });
    expect(status).toBe(200);
    expect(body.term.name).toBe('Japan');
    expect(body.term.eventCount).toBeGreaterThan(0);
    expect(body.term.span.from).toBeLessThanOrEqual(body.term.span.to);
  });

  test('timeline pages are sorted, complete and non-overlapping', async () => {
    const first = (await events('?limit=25')).body;
    expect(first.pagination.page).toBe(1);
    expect(first.pagination.total).toBe(first.term.eventCount);
    const pages = [first];
    for (let p = 2; p <= first.pagination.totalPages; p++) pages.push((await events(`?limit=25&page=${p}`)).body);
    const all = pages.flatMap((pg) => pg.events);
    expect(all).toHaveLength(first.pagination.total);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    const years = all.map((e) => e.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect((await events(`?limit=25&page=${first.pagination.totalPages + 1}`)).body.events).toEqual([]);
  });

  test('tag facets ignore the tag filter but respect years', async () => {
    const all = (await events()).body.facets.tags;
    expect((await events('?tags=war')).body.facets.tags).toEqual(all);
    const sum = (f) => f.reduce((n, t) => n + t.count, 0);
    expect(sum((await events('?from=1900')).body.facets.tags)).toBeLessThanOrEqual(sum(all));
  });

  test('timeline filters by year and tag', async () => {
    const { body } = await events('?from=1900&to=2000&tags=war');
    expect(body.events.length).toBeGreaterThan(0);
    for (const e of body.events) {
      expect(e.year).toBeGreaterThanOrEqual(1900);
      expect(e.year).toBeLessThanOrEqual(2000);
      expect(e.tags).toContain('war');
    }
  });

  test('search: exact alias, prefix and fuzzy matches', async () => {
    const search = async (q) => (await call(api.search, pool, `/v1/search?q=${encodeURIComponent(q)}`)).body.results;
    expect((await search('USA'))[0]).toMatchObject({ slug: 'united-states', match: 'exact' });
    expect((await search('germ'))[0]).toMatchObject({ slug: 'germany', match: 'prefix' });
    expect((await search('germny'))[0]).toMatchObject({ slug: 'germany', match: 'fuzzy' });
  });
});
