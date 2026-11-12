import { sitemapXml } from '@/lib/seo-files.js';
import { getOrigin, getSitemapTerms } from '@/server/data.js';

export const dynamic = 'force-dynamic';

// Home, /countries, every term with events and its later pages, with <lastmod>. A route handler (not
// app/sitemap.js) so a database outage can answer 503 + Retry-After.
export async function GET() {
  const origin = await getOrigin();
  try {
    const terms = await getSitemapTerms();
    return new Response(sitemapXml(origin, terms), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    console.error(`Sitemap unavailable: ${err.message}`);
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  }
}
