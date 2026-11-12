// End to end: builds the app, starts `next start` against the local seeded
// database, and checks real responses (status codes, redirects, head tags,
// SEO files, API, security headers). A second server points at a database
// that isn't there. Skipped when PostgreSQL isn't reachable or seeded.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const SITE = 'https://historyof.test';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql:///history_of?host=/var/run/postgresql';

const probe = new pg.Client({ connectionString: DATABASE_URL });
const available = await probe
  .connect()
  .then(() => probe.query("SELECT count(*)::int AS n FROM event_terms et JOIN terms t ON t.id = et.term_id WHERE t.slug = 'japan'"))
  .then((r) => r.rows[0].n > 40, () => false)
  .finally(() => probe.end().catch(() => {}));

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function startNext(databaseUrl) {
  const port = await freePort();
  const child = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl, SITE_URL: SITE },
    stdio: 'pipe',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${base}/health`).then((r) => r.ok, () => false)) return { base, child };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('next start did not come up');
}

const get = async (base, path, init) => {
  const res = await fetch(base + path, { redirect: 'manual', ...init });
  return { status: res.status, location: location(res.headers), headers: res.headers, body: await res.text() };
};
// A redirect() from an ISR page sends its Location header twice on the first
// (uncached) render, with the same value. Collapse identical copies; distinct
// values would still show up and fail the test.
const location = (headers) => {
  const values = [...new Set(headers.get('location')?.split(', ') ?? [])];
  return values.length ? values.join(', ') : null;
};
const eventCount = (html) => (html.match(/class="event event--/g) ?? []).length;

describe.skipIf(!available)('production server', () => {
  let web;
  let down;

  beforeAll(async () => {
    // Vitest sets NODE_ENV=test; the build must be a production one.
    execFileSync(process.execPath, [nextBin, 'build'], { cwd: appDir, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' } });
    [web, down] = await Promise.all([startNext(DATABASE_URL), startNext('postgresql://127.0.0.1:1/nowhere')]);
  });
  afterAll(() => {
    web?.child.kill();
    down?.child.kill();
  });

  describe('pages', () => {
    test('home: search prompt, suggestions, coverage note and JSON-LD', async () => {
      const { status, body } = await get(web.base, '/');
      expect(status).toBe(200);
      expect(body).toContain('Search a country to see its history');
      expect(body).toContain('class="empty__chip"');
      expect(body).toMatch(/Countries only, for now\.[\s\S]*covers \d+ countries so far/);
      expect(body).toContain('"@type":"WebSite"');
      // Next normalizes the root URL against metadataBase (no trailing slash; same URL).
      expect(body).toContain(`<link rel="canonical" href="${SITE}"/>`);
    });

    test('timeline: first page server-rendered with SEO tags', async () => {
      const { status, body } = await get(web.base, '/t/japan');
      expect(status).toBe(200);
      expect(eventCount(body)).toBe(20);
      expect(body).toContain('<title>History of Japan · History Of</title>');
      expect(body).toContain(`<link rel="canonical" href="${SITE}/t/japan"/>`);
      expect(body).toContain('<meta property="og:site_name" content="History Of"/>');
      expect(body).toContain(`<meta property="og:image" content="${SITE}/og-image.png"/>`);
      expect(body).toContain('<meta name="twitter:card" content="summary_large_image"/>');
      expect(body).toMatch(/<meta name="description" content="History of Japan from \d+ to \d+: events 1–20 of \d+ on a timeline/);
      expect(body).not.toContain('name="robots"');
      expect(body).toContain('"@type":"BreadcrumbList"');
      expect(body).toContain('aria-label="Timeline pages"');
      // The header search box shows the term's name.
      expect(body).toMatch(/id="search-input"[^>]*value="Japan"/);
    });

    test('filtered views are filtered on the server and canonical to the unfiltered timeline', async () => {
      const { status, body } = await get(web.base, '/t/japan?from=1900&tags=war');
      expect(status).toBe(200);
      expect(body).not.toContain('name="robots"');
      expect(body).toContain(`<link rel="canonical" href="${SITE}/t/japan"/>`);
      const api = await (await fetch(`${web.base}/v1/terms/japan/events?from=1900&tags=war`)).json();
      expect(eventCount(body)).toBe(api.events.length);
    });

    test('later pages live at /t/:slug/:page, are canonical to themselves and describe their own years', async () => {
      const { status, body } = await get(web.base, '/t/japan/2');
      expect(status).toBe(200);
      expect(body).toContain(`<link rel="canonical" href="${SITE}/t/japan/2"/>`);
      expect(body).toContain('<title>History of Japan (page 2) · History Of</title>');
      expect(body).toMatch(/<meta name="description" content="History of Japan from \d+ to \d+: events 21–40 of/);
      expect(body).toContain('href="/t/japan/3"');
    });

    test('timelines are ISR: cached, shared by junk query params, CDN-cacheable', async () => {
      await get(web.base, '/t/japan');
      const { headers } = await get(web.base, '/t/japan?utm_source=test');
      expect(headers.get('x-nextjs-cache')).toBe('HIT');
      expect(headers.get('cache-control')).toContain('s-maxage=21600');
      // ?page= is no longer a page parameter: page 1, canonical to /t/japan.
      const old = await get(web.base, '/t/japan?page=2');
      expect(old.status).toBe(200);
      expect(old.body).toContain(`<link rel="canonical" href="${SITE}/t/japan"/>`);
    });

    test('redirects: past the last page, uppercase slugs, exact search hits', async () => {
      expect(await get(web.base, '/t/japan/99')).toMatchObject({ status: 307, location: '/t/japan/3' });
      expect(await get(web.base, '/t/Japan?tags=war')).toMatchObject({ status: 307, location: '/t/japan?tags=war' });
      expect(await get(web.base, '/t/japan/1')).toMatchObject({ status: 308, location: '/t/japan' });
      expect(await get(web.base, '/search?q=usa')).toMatchObject({ status: 307, location: '/t/united-states' });
      expect(await get(web.base, '/search?q=')).toMatchObject({ status: 307, location: '/' });
    });

    test('404s: unknown term, empty search, unknown page', async () => {
      for (const path of ['/t/atlantis', '/t/japan/abc', '/search?q=zzzzqq', '/nope']) {
        const { status, body } = await get(web.base, path);
        expect(status, path).toBe(404);
        expect(body, path).toContain('<meta name="robots" content="noindex"/>');
      }
      // The term's not-found title travels in the RSC payload Next renders from.
      expect((await get(web.base, '/t/atlantis')).body).toContain('No history for “atlantis” · History Of');
    });

    test('countries index links every timeline', async () => {
      const { status, body } = await get(web.base, '/countries');
      expect(status).toBe(200);
      expect(body).toContain('<title>All countries · History Of</title>');
      expect(body).toContain('href="/t/japan"');
      expect(body).not.toContain('href="/t/bahamas"'); // no events yet
      expect((await get(web.base, '/')).body).toContain('href="/countries"');
    });

    test('search results list matches', async () => {
      const { status, body } = await get(web.base, '/search?q=uni');
      expect(status).toBe(200);
      expect(body).toContain('class="results__item" href="/t/united-states"');
      expect(body).toMatch(/id="search-input"[^>]*value="uni"/);
    });

    test('client navigation gets an RSC payload, not HTML', async () => {
      // Next redirects to add its _rsc cache-busting parameter; the router follows it.
      const { status, headers } = await get(web.base, '/t/japan', { headers: { RSC: '1' }, redirect: 'follow' });
      expect(status).toBe(200);
      expect(headers.get('content-type')).toContain('text/x-component');
    });

    test('security headers', async () => {
      for (const path of ['/t/japan', '/v1/terms/japan']) {
        const { headers } = await get(web.base, path);
        expect(headers.get('x-content-type-options')).toBe('nosniff');
        expect(headers.get('x-frame-options')).toBe('DENY');
        expect(headers.get('x-powered-by')).toBeNull();
      }
    });
  });

  describe('API', () => {
    test('is served by the same app', async () => {
      const { status, body } = await get(web.base, '/v1/terms/japan/events?tags=war&limit=2');
      expect(status).toBe(200);
      const json = JSON.parse(body);
      expect(json.term.slug).toBe('japan');
      expect(json.events.length).toBe(2);
      expect(json.events.every((e) => e.tags.includes('war'))).toBe(true);
    });

    test('unknown API paths are a JSON 404, not the HTML page', async () => {
      const { status, headers, body } = await get(web.base, '/v1/nope');
      expect(status).toBe(404);
      expect(headers.get('content-type')).toContain('application/json');
      expect(JSON.parse(body).error.status).toBe(404);
    });

    test('CORS is off unless CORS_ORIGIN lists the origin', async () => {
      const { headers } = await get(web.base, '/v1', { headers: { Origin: 'https://elsewhere.test' } });
      expect(headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('search engine files', () => {
    test('robots.txt', async () => {
      const { status, body, headers } = await get(web.base, '/robots.txt');
      expect(status).toBe(200);
      expect(headers.get('content-type')).toContain('text/plain');
      expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
      expect(body).toContain('Disallow: /search');
      expect(body).toContain('Disallow: /v1/');
    });

    test('the share image is a static file', async () => {
      const { status, headers } = await get(web.base, '/og-image.png');
      expect(status).toBe(200);
      expect(headers.get('content-type')).toBe('image/png');
    });

    test('sitemap.xml lists terms with events and their pages', async () => {
      const { status, body, headers } = await get(web.base, '/sitemap.xml');
      expect(status).toBe(200);
      expect(headers.get('content-type')).toContain('application/xml');
      const locs = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
      expect(locs[0]).toBe(`${SITE}/`);
      expect(locs).toContain(`${SITE}/countries`);
      expect(locs).toContain(`${SITE}/t/japan`);
      expect(locs).toContain(`${SITE}/t/japan/3`);
      expect(body).toMatch(/<loc>[^<]+\/t\/japan<\/loc><lastmod>\d{4}-\d\d-\d\dT[\d:.]+Z<\/lastmod>/);
      expect(locs).not.toContain(`${SITE}/t/bahamas`); // no events yet
    });
  });

  describe('when the database is down', () => {
    test('uncached pages fail with the unavailable page (500: Next pages cannot choose 503), not cached', async () => {
      const { status, body, headers } = await get(down.base, '/t/chile');
      expect(status).toBe(500);
      expect(body).toContain('noindex');
      expect(headers.get('cache-control')).toContain('no-store');
    });

    test('timelines already in the ISR cache keep being served', async () => {
      // Both servers share the build's cache; the tests above rendered /t/japan.
      const { status, body, headers } = await get(down.base, '/t/japan');
      expect(status).toBe(200);
      expect(headers.get('x-nextjs-cache')).toBe('HIT');
      expect(eventCount(body)).toBe(20);
    });

    test('home still works, without suggestions', async () => {
      const { status, body } = await get(down.base, '/');
      expect(status).toBe(200);
      expect(body).toContain('Search a country to see its history');
      expect(body).not.toContain('class="empty__chip"');
    });

    test('API and readiness answer 503; liveness stays up', async () => {
      expect((await get(down.base, '/v1/terms/japan')).status).toBe(503);
      expect((await get(down.base, '/health/ready')).status).toBe(503);
      expect((await get(down.base, '/health')).status).toBe(200);
    });

    test('sitemap answers 503 with Retry-After', async () => {
      const { status, headers } = await get(down.base, '/sitemap.xml');
      expect(status).toBe(503);
      expect(headers.get('retry-after')).toBe('60');
    });
  });
});
