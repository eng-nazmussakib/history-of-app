import { HttpError } from './errors.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseSlug(value) {
  if (typeof value !== 'string' || !SLUG.test(value) || value.length > 120) {
    throw new HttpError(400, 'Invalid slug: use lowercase letters, digits and hyphens');
  }
  return value;
}

// Years are signed integers (negative = BCE). Also accepts "660BCE",
// "660 bce", "1066CE" and "1066AD", so URLs can stay human-readable.
export function parseYear(value, name) {
  if (value === undefined || value === '') return null;
  const m = String(value).trim().match(/^(-?\d{1,5})\s*(bce|bc|ce|ad)?$/i);
  if (!m) throw new HttpError(400, `Invalid ${name}: expected a year like 1868, -660 or 660BCE`);
  let year = Number(m[1]);
  const era = m[2]?.toLowerCase();
  if (era === 'bce' || era === 'bc') {
    if (year <= 0) throw new HttpError(400, `Invalid ${name}: use a positive year with BCE`);
    year = -year;
  }
  if (year === 0) throw new HttpError(400, `Invalid ${name}: there is no year 0`);
  return year;
}

// "war,treaty" or repeated ?tags=war&tags=treaty → ['treaty', 'war'] (null if none).
export function parseTags(value) {
  if (value === undefined || value === '') return null;
  const raw = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const tags = [...new Set(raw.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort();
  for (const t of tags) {
    if (!SLUG.test(t)) throw new HttpError(400, `Invalid tag: ${t}`);
  }
  if (tags.length > 30) throw new HttpError(400, 'Too many tags (max 30)');
  return tags.length ? tags : null;
}

export function parsePage(value) {
  if (value === undefined || value === '') return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100_000) throw new HttpError(400, 'Invalid page: expected a positive integer');
  return n;
}

export function parseLimit(value, { fallback, max }) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid limit: expected a positive integer');
  return Math.min(n, max);
}

const TERM_TYPES = new Set([
  'country', 'empire', 'state', 'city', 'region', 'war', 'battle',
  'person', 'organization', 'idea', 'invention', 'other',
]);

export function parseTermType(value) {
  if (value === undefined || value === '') return null;
  if (!TERM_TYPES.has(value)) throw new HttpError(400, `Invalid type: ${value}`);
  return value;
}
