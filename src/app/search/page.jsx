import { notFound, redirect } from 'next/navigation';
import NewSearchLink from '@/components/NewSearchLink.jsx';
import { searchTerms } from '@/server/data.js';

export const dynamic = 'force-dynamic';

const queryOf = async ({ searchParams }) => {
  const q = (await searchParams).q;
  return (Array.isArray(q) ? q[0] : (q ?? '')).trim().slice(0, 100);
};

export async function generateMetadata(props) {
  const q = await queryOf(props);
  if (!q) return {};
  const results = await searchTerms(q);
  return {
    title: results.length ? `Results for “${q}” · History Of` : `No results for “${q}” · History Of`,
    robots: { index: false },
  };
}

// /search?q=…: one exact match (name, slug or alias, e.g. "USA") goes straight
// to its timeline; otherwise a results list, or a 404 when nothing matches.
export default async function SearchPage(props) {
  const q = await queryOf(props);
  if (!q) redirect('/');
  const results = await searchTerms(q);
  const exact = results.filter((r) => r.match === 'exact');
  if (exact.length === 1) redirect(`/t/${exact[0].slug}`);
  if (!results.length) notFound(); // search/not-found.jsx

  return (
    <section className="results">
      <NewSearchLink />
      <h1 className="results__title">Results for “{q}”</h1>
      <ul className="results__list">
        {results.map((r) => (
          <li key={r.slug}>
            <a className="results__item" href={`/t/${r.slug}`}>
              <span className="results__name" title={r.name}>
                {r.name}
              </span>
              <span className="results__type">{r.type}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
