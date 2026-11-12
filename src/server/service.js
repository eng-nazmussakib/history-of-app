// The app's read operations, returning the public JSON shapes. Used by both
// the /v1 route handlers and the server components, so pages and API always
// agree. Each takes a `db` with a pg-style query(text, params), so tests can
// pass a fake; inputs are already validated.
import { getTerm, getTermEvents, getTermTagFacets, listSitemapTerms, listTerms, searchTerms } from './db/queries.js';
import { serializeEvent, serializeTerm } from './api/serialize.js';

// [{ slug, name, type, eventCount }]
export async function listTermsData(db, { type = null, limit = 50 } = {}) {
  const rows = await listTerms(db, { type, limit });
  return rows.map((r) => ({ slug: r.slug, name: r.name, type: r.type, eventCount: r.event_count }));
}

// Terms with events for the sitemap: [{ slug, eventCount, lastModified (Date) }].
export async function sitemapTermsData(db) {
  const rows = await listSitemapTerms(db);
  return rows.map((r) => ({ slug: r.slug, eventCount: r.event_count, lastModified: new Date(r.last_modified) }));
}

// The term with event count and span, or null.
export async function termData(db, slug) {
  const row = await getTerm(db, slug);
  return row ? serializeTerm(row) : null;
}

// One page of a term's timeline: { term, filters, events, pagination, facets },
// or null if the term doesn't exist. `from`/`to` are signed years (negative =
// BCE), already in order; `tags` is a sorted array or null.
export async function timelineData(db, slug, { from = null, to = null, tags = null, page = 1, limit = 20 } = {}) {
  const term = await getTerm(db, slug);
  if (!term) return null;
  const [{ rows, total }, tagFacets] = await Promise.all([
    getTermEvents(db, slug, { from, to, tags, limit, offset: (page - 1) * limit }),
    getTermTagFacets(db, slug, { from, to }),
  ]);
  return {
    term: serializeTerm(term),
    filters: { from, to, tags: tags ?? [] },
    events: rows.map(serializeEvent),
    // A page past the end returns no events; totalPages says where the end is.
    pagination: { page, pageSize: limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    // Tag counts within the year range, ignoring the tag filter.
    facets: { tags: tagFacets },
  };
}

// [{ slug, name, type, match }], match = exact | prefix | fuzzy
export function searchData(db, q, limit = 10) {
  return searchTerms(db, q, limit);
}
