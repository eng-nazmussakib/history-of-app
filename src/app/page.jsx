import EmptyState from '@/components/EmptyState.jsx';
import JsonLd from '@/components/JsonLd.jsx';
import { openGraph } from '@/lib/site.js';
import { featuredOf, getCountries, getOrigin } from '@/server/data.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const origin = await getOrigin();
  return {
    title: 'History Of · Explore the history of any country',
    description:
      'Search a country and see its history on a timeline: wars, treaties, revolutions, disasters and eras, from Wikidata and Wikipedia.',
    alternates: { canonical: `${origin}/` },
    openGraph: openGraph({ url: `${origin}/` }),
  };
}

export default async function HomePage() {
  const origin = await getOrigin();
  // Suggestions and the coverage count are nice-to-haves: if the database is
  // down, still show the search prompt rather than an error page.
  const countries = await getCountries().catch((err) => {
    console.error(`Home page data unavailable: ${err.message}`);
    return null;
  });
  const covered = countries?.filter((c) => c.eventCount > 0).length ?? null;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'History Of',
          url: `${origin}/`,
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <EmptyState suggestions={countries ? featuredOf(countries) : []} />

      <aside className="coverage-note" aria-label="About the data">
        <p>
          <strong>Countries only, for now.</strong>{' '}
          {covered
            ? `History Of covers ${covered} ${covered === 1 ? 'country' : 'countries'} so far.`
            : 'History Of covers countries so far.'} Empires,
          wars, people and ideas are coming later. <a href="/countries">Browse all countries</a>.
        </p>
      </aside>
    </>
  );
}
