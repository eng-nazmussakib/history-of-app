// Text for /robots.txt and /sitemap.xml. Pure functions (no server-only
// imports), so they can be unit-tested; app/robots.txt and app/sitemap.xml serve them.
import { PAGE_SIZE } from './filters.js';

const xmlEscape = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export function robotsTxt(origin) {
  return [
    'User-agent: *',
    'Allow: /',
    // Search results are thin, noindexed pages; RSC payloads (Next fetches
    // them with ?_rsc=…) and the JSON API aren't pages at all.
    'Disallow: /search',
    'Disallow: /*?_rsc=',
    'Disallow: /*&_rsc=',
    'Disallow: /v1/',
    'Disallow: /health',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

// Home, the countries index and every term with events, including its later
// pages (they're canonical to themselves). Filtered views are left out on
// purpose. <lastmod> is when the term or one of its events last changed; the
// home and index pages take the newest of those.
export function sitemapXml(origin, terms) {
  const withEvents = [...terms].filter((t) => t.eventCount > 0).sort((a, b) => a.slug.localeCompare(b.slug));
  const newest = withEvents.reduce((max, t) => (t.lastModified && (!max || t.lastModified > max) ? t.lastModified : max), null);
  const entries = [
    { loc: `${origin}/`, lastModified: newest },
    { loc: `${origin}/countries`, lastModified: newest },
  ];
  for (const t of withEvents) {
    const pages = Math.ceil(t.eventCount / PAGE_SIZE);
    for (let p = 1; p <= pages; p++) {
      entries.push({ loc: `${origin}/t/${t.slug}${p > 1 ? `/${p}` : ''}`, lastModified: t.lastModified });
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ({ loc, lastModified }) =>
        `  <url><loc>${xmlEscape(loc)}</loc>${lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : ''}</url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');
}
