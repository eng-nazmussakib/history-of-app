// Timeline filters and pagination <-> URL. Shared by the server (reading the
// request URL) and the browser (writing the URL when filters change).
//
//   /t/japan/2?from=660BCE&to=1868&tags=war,treaty
//
// The page is a path segment (page 1 has none); filters are the query string.
// next.config.mjs rewrites both into one internal segment, the "view"
// (`2~from=660BCE&tags=war`), so the cached page never reads searchParams.
//
// Years accept "660BCE", "660 bc", "-660", "1868", "1868CE". Filtering itself
// happens in the API; this module only translates between URL, UI and API.

export const PAGE_SIZE = 20;

export const EMPTY_FILTERS = { from: '', fromEra: 'CE', to: '', toEra: 'CE', tags: [] };

export function toSignedYear(value, era) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return era === 'BCE' ? -n : n;
}

export function hasActiveFilters(f) {
  return f.tags.length > 0 || toSignedYear(f.from, f.fromEra) != null || toSignedYear(f.to, f.toEra) != null;
}

function parseYearParam(value) {
  const m = String(value ?? '').trim().match(/^(-?)(\d{1,5})\s*(bce|bc|ce|ad)?$/i);
  if (!m || Number(m[2]) === 0) return { value: '', era: 'CE' };
  const bce = m[1] === '-' || /^bc/i.test(m[3] ?? '');
  return { value: String(Number(m[2])), era: bce ? 'BCE' : 'CE' };
}

export function filtersFromSearch(search) {
  const params = new URLSearchParams(search);
  const from = parseYearParam(params.get('from'));
  const to = parseYearParam(params.get('to'));
  const tags = [
    ...new Set(
      params
        .getAll('tags')
        .flatMap((v) => v.split(','))
        .map((t) => t.trim().toLowerCase())
        .filter((t) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)),
    ),
  ].sort();
  return { from: from.value, fromEra: from.era, to: to.value, toEra: to.era, tags };
}

// Page number from a path segment ("2"), or null if it isn't one.
export function parsePage(value) {
  return /^[1-9]\d{0,5}$/.test(String(value ?? '')) ? Number(value) : null;
}

// The internal [view] segment: "<page>" or "<page>~<filters query>".
// Returns { page, filters }, or null for anything that isn't a valid view.
export function viewFromSegment(segment) {
  const raw = String(segment ?? '');
  const cut = raw.indexOf('~');
  const page = parsePage(cut < 0 ? raw : raw.slice(0, cut));
  if (page == null) return null;
  return { page, filters: filtersFromSearch(cut < 0 ? '' : raw.slice(cut + 1)) };
}

// The public URL of one page of a timeline: `/t/japan`, `/t/japan/2?tags=war`.
export function timelineHref(path, filters, page = 1) {
  return `${path}${page > 1 ? `/${page}` : ''}${filtersToSearch(filters)}`;
}

const yearParam = (value, era) => {
  const y = toSignedYear(value, era);
  return y == null ? null : y < 0 ? `${-y}BCE` : String(y);
};

// Filter query string for the page URL (with "?", or "" without filters).
// Commas in tags stay readable. The page number lives in the path (timelineHref).
export function filtersToSearch(f) {
  const parts = [];
  const from = yearParam(f.from, f.fromEra);
  const to = yearParam(f.to, f.toEra);
  if (from) parts.push(`from=${from}`);
  if (to) parts.push(`to=${to}`);
  if (f.tags.length) parts.push(`tags=${[...f.tags].sort().map(encodeURIComponent).join(',')}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// Query string for GET /v1/terms/:slug/events.
export function filtersToApiQuery(f, page = 1, limit = PAGE_SIZE) {
  const params = new URLSearchParams();
  const from = toSignedYear(f.from, f.fromEra);
  const to = toSignedYear(f.to, f.toEra);
  if (from != null) params.set('from', String(from));
  if (to != null) params.set('to', String(to));
  if (f.tags.length) params.set('tags', [...f.tags].sort().join(','));
  params.set('page', String(page));
  params.set('limit', String(limit));
  return params.toString();
}
