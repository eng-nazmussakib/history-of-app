// /health and /v1 request handlers: (db, request, params) → Response.
// Route files in src/app wire them to the shared pool (see ./route.js); tests
// call them directly with a fake db.
import { listTermsData, searchData, termData, timelineData } from '../service.js';
import { HttpError } from './errors.js';
import { parseLimit, parsePage, parseSlug, parseTags, parseTermType, parseYear } from './params.js';

// Query parameter: undefined when absent, an array when repeated (like Express).
function query(request, name) {
  const values = new URL(request.url).searchParams.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}
// Only `tags` may repeat; for everything else the first value counts.
const single = (request, name) => {
  const v = query(request, name);
  return Array.isArray(v) ? v[0] : v;
};

// GET /health: the process is up.
export function health() {
  return Response.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
}

// GET /health/ready: the database answers too.
export async function ready(db) {
  try {
    await db.query('SELECT 1');
    return Response.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    return Response.json({ status: 'unavailable', database: err.code ?? err.message }, { status: 503 });
  }
}

// GET /v1
export function index() {
  return Response.json({
    name: 'History Of API',
    version: 1,
    endpoints: [
      'GET /v1/search?q=&limit=',
      'GET /v1/terms?type=&limit=',
      'GET /v1/terms/:slug',
      'GET /v1/terms/:slug/events?from=&to=&tags=&page=&limit=',
    ],
  });
}

// GET /v1/terms?type=country&limit=50
export async function terms(db, request) {
  const type = parseTermType(single(request, 'type'));
  const limit = parseLimit(single(request, 'limit'), { fallback: 50, max: 500 });
  return Response.json({ terms: await listTermsData(db, { type, limit }) });
}

// GET /v1/terms/:slug
export async function term(db, _request, params) {
  const slug = parseSlug(params.slug);
  const data = await termData(db, slug);
  if (!data) throw new HttpError(404, `No term '${slug}'`);
  return Response.json({ term: data });
}

// GET /v1/terms/:slug/events?from=1600&to=1900&tags=war,treaty&page=2&limit=20
export async function termEvents(db, request, params) {
  const slug = parseSlug(params.slug);
  let from = parseYear(single(request, 'from'), 'from');
  let to = parseYear(single(request, 'to'), 'to');
  if (from != null && to != null && from > to) [from, to] = [to, from];
  const tags = parseTags(query(request, 'tags'));
  const page = parsePage(single(request, 'page'));
  const limit = parseLimit(single(request, 'limit'), { fallback: 20, max: 100 });

  const data = await timelineData(db, slug, { from, to, tags, page, limit });
  if (!data) throw new HttpError(404, `No term '${slug}'`);
  return Response.json(data);
}

// GET /v1/search?q=usa&limit=10 → { query, results: [{ slug, name, type, match }] }
export async function search(db, request) {
  const raw = single(request, 'q');
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (!q) throw new HttpError(400, 'Missing query parameter q');
  if (q.length > 100) throw new HttpError(400, 'Query too long (max 100 characters)');
  const limit = parseLimit(single(request, 'limit'), { fallback: 10, max: 50 });
  return Response.json({ query: q, results: await searchData(db, q, limit) });
}

// Anything else under /v1.
export function notFound(_db, request) {
  const { pathname } = new URL(request.url);
  throw new HttpError(404, `No route for ${request.method} ${pathname}`);
}
