import JsonLd from '@/components/JsonLd.jsx';
import { openGraph } from '@/lib/site.js';
import { getCountries, getOrigin } from '@/server/data.js';

export const dynamic = 'force-dynamic';

const TITLE = 'All countries · History Of';
const DESCRIPTION = 'Every country with a history timeline on History Of, from Afghanistan to Zimbabwe.';

export async function generateMetadata() {
  const origin = await getOrigin();
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${origin}/countries` },
    openGraph: openGraph({ title: TITLE, description: DESCRIPTION, url: `${origin}/countries` }),
  };
}

// /countries: every country with events, A–Z. A plain list of links, so every
// timeline is reachable by crawling, not only through the sitemap or search.
export default async function CountriesPage() {
  const origin = await getOrigin();
  const countries = (await getCountries()).filter((c) => c.eventCount > 0);
  const groups = Map.groupBy(countries, (c) => c.name.charAt(0).toUpperCase());

  return (
    <section className="index">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'History Of', item: `${origin}/` },
            { '@type': 'ListItem', position: 2, name: 'All countries', item: `${origin}/countries` },
          ],
        }}
      />
      <h1 className="index__title">All countries</h1>
      <p className="index__lead">{countries.length} countries with a timeline so far.</p>

      {[...groups].map(([letter, list]) => (
        <section key={letter} className="index__group" aria-labelledby={`letter-${letter}`}>
          <h2 id={`letter-${letter}`} className="index__letter">
            {letter}
          </h2>
          <ul className="index__list">
            {list.map((c) => (
              <li key={c.slug}>
                <a className="index__item" href={`/t/${c.slug}`}>
                  <span className="index__name">{c.name}</span>
                  <span className="index__count">{c.eventCount} events</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
