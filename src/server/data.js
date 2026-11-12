// Data for server components. Pages read the database directly through the
// same service functions the /v1 API uses (no HTTP hop). React's cache()
// dedupes calls within one request, e.g. generateMetadata, the page and the
// header slot all asking for the same timeline.
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers.js';
import { config } from './config.js';
import { getDb } from './db/pool.js';
import { listTermsData, searchData, sitemapTermsData, termData, timelineData } from './service.js';
import { PAGE_SIZE, filtersFromSearch, filtersToSearch, toSignedYear } from '../lib/filters.js';

const MAX_TAGS = 30; // same cap as the API

// UI filters (see lib/filters.js) → service arguments.
function timelineArgs(filters, page) {
  let from = toSignedYear(filters.from, filters.fromEra);
  let to = toSignedYear(filters.to, filters.toEra);
  if (from != null && to != null && from > to) [from, to] = [to, from];
  const tags = filters.tags.length ? [...filters.tags].sort().slice(0, MAX_TAGS) : null;
  return { from, to, tags, page, limit: PAGE_SIZE };
}

// cache() keys on argument identity, so the filters travel as their URL string.
const cachedTimeline = cache(async (slug, search, page) => {
  return timelineData(getDb(), slug, timelineArgs(filtersFromSearch(search), page));
});

// One page of a term's timeline, filtered: { term, filters, events, pagination,
// facets }, or null if the term doesn't exist.
export function getTimeline(slug, { filters, page = 1 }) {
  return cachedTimeline(slug, filtersToSearch(filters), page);
}

export const getTerm = cache(async (slug) => {
  return termData(getDb(), slug);
});

export const searchTerms = cache(async (q, limit = 10) => {
  return searchData(getDb(), q, limit);
});

// All country terms: [{ slug, name, type, eventCount }].
export const getCountries = cache(async () => {
  return listTermsData(getDb(), { type: 'country', limit: 500 });
});

// Terms with events and when they last changed, for the sitemap.
export const getSitemapTerms = cache(async () => sitemapTermsData(getDb()));

// Countries with the most events, for the home page suggestions.
export function featuredOf(countries, count = 6) {
  return countries
    .filter((t) => t.eventCount > 0)
    .sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name))
    .slice(0, count);
}

// The public origin for cached (ISR) pages, which can't read request headers:
// SITE_URL, else this machine (fine in dev; set SITE_URL in production).
let warned = false;
export function getStaticOrigin() {
  if (config.siteUrl) return config.siteUrl;
  if (config.env === 'production' && process.env.NEXT_PHASE !== 'phase-production-build' && !warned) {
    warned = true;
    console.warn('SITE_URL is not set: cached pages use http://localhost for canonical links and JSON-LD.');
  }
  return `http://localhost:${config.port}`;
}

// The public origin for request-time pages: SITE_URL in production, else the
// request's own host (fine in dev, wrong behind a proxy that rewrites Host).
export async function getOrigin() {
  if (config.siteUrl) return config.siteUrl;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'http';
  return `${proto}://${host}`;
}
