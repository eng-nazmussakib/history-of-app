import { notFound, redirect } from 'next/navigation';
import JsonLd from '@/components/JsonLd.jsx';
import Timeline from '@/components/Timeline.jsx';
import { formatYear } from '@/lib/dates.js';
import { EMPTY_FILTERS, hasActiveFilters, timelineHref, viewFromSegment } from '@/lib/filters.js';
import { openGraph } from '@/lib/site.js';
import { getStaticOrigin, getTimeline } from '@/server/data.js';

// ISR: each timeline page renders on its first request, is cached, and is
// regenerated in the background at most every 6 hours (the data only changes
// when the database is re-seeded). Nothing is prerendered at build time, so
// `next build` doesn't need the database.
export const revalidate = 21600;
export const generateStaticParams = () => [];

// Public URL /t/:slug[/:page][?from=&to=&tags=] arrives here rewritten by
// next.config.mjs as /t/:slug/:view, view = "<page>" or "<page>~<filters>".
async function readRoute({ params }) {
  const { slug, view } = await params;
  const parsed = viewFromSegment(safeDecode(view));
  return { slug: safeDecode(slug), ...(parsed ?? { page: null, filters: EMPTY_FILTERS }) };
}

export async function generateMetadata(props) {
  const { slug, filters, page } = await readRoute(props);
  const timeline = page && (await getTimeline(slug, { filters, page }));
  if (!timeline) return { title: `No history for “${slug}” · History Of`, robots: { index: false } };

  const { term, events, pagination } = timeline;
  const origin = getStaticOrigin();
  const filtered = hasActiveFilters(filters);
  const title = `History of ${term.name}${page > 1 ? ` (page ${page})` : ''} · History Of`;
  const description = pageDescription(term, events, pagination);
  // Unfiltered pages are canonical to themselves (page 2 is real content);
  // filtered views point at the unfiltered timeline. Only the canonical, no
  // noindex: the two together are a mixed signal, and the canonical alone
  // passes the filtered view's links on to the main timeline.
  const canonical = `${origin}${timelineHref(`/t/${term.slug}`, EMPTY_FILTERS, filtered ? 1 : page)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: openGraph({ title, description, url: canonical, type: 'article' }),
  };
}

// "History of Japan from 1603 to 1868: events 21–40 of 60 on a timeline, with
// dates and sources. Country in East Asia." The years are this page's own first
// and last events, so every page has its own description.
function pageDescription(term, events, pagination) {
  const about = term.description ? ` ${term.description.charAt(0).toUpperCase()}${term.description.slice(1)}.` : '';
  if (!events.length) return `History of ${term.name} on a timeline, with dates and sources.${about}`;
  const first = formatYear(events[0].year);
  const last = formatYear(events.at(-1).year);
  const span = first === last ? `in ${first}` : `from ${first} to ${last}`;
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const range = events.length === 1 ? `event ${start}` : `events ${start}–${start + events.length - 1}`;
  return `History of ${term.name} ${span}: ${range} of ${pagination.total} on a timeline, with dates and sources.${about}`;
}

// Server component for one page of a term's timeline, already filtered.
export default async function TermPage(props) {
  const { slug, filters, page } = await readRoute(props);
  if (!page) notFound();

  // Uppercase/odd slugs: send to the canonical form.
  const canonicalSlug = slug.toLowerCase();
  if (canonicalSlug !== slug) redirect(timelineHref(`/t/${encodeURIComponent(canonicalSlug)}`, filters, page));

  const timeline = await getTimeline(slug, { filters, page });
  if (!timeline) notFound();
  const { term, events, pagination, facets } = timeline;
  // Past the last page (e.g. after the data shrank): go to the last one.
  if (page > pagination.totalPages) redirect(timelineHref(`/t/${slug}`, filters, pagination.totalPages));

  const origin = getStaticOrigin();
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'History Of', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: term.name, item: `${origin}/t/${term.slug}` },
        ],
      },
      {
        // The events on this page, in timeline order. Historical events aren't
        // schema.org "Event"s (those are for upcoming happenings), so a plain list.
        '@type': 'ItemList',
        name: `History of ${term.name}`,
        numberOfItems: pagination.total,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: events.map((e, i) => ({
          '@type': 'ListItem',
          position: (pagination.page - 1) * pagination.pageSize + i + 1,
          name: `${e.displayDate}: ${e.title}`,
          ...(e.sources[0] ? { url: e.sources[0].url } : {}),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={structuredData} />
      {/* Keyed by slug only: filter and page changes update it in place, so it can animate. */}
      <Timeline
        key={term.slug}
        term={term}
        events={events}
        pagination={pagination}
        tagFacets={facets.tags}
        filters={filters}
        path={`/t/${term.slug}`}
      />
    </>
  );
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
