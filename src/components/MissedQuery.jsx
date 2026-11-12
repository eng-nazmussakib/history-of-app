'use client';

import { useParams, useSearchParams } from 'next/navigation.js';
import EmptyState from './EmptyState.jsx';

// not-found.js files get no props, so the "No history for …" text reads what
// was asked for from the URL: the slug on /t/:slug, the query on /search.
export function MissedTerm() {
  const { slug } = useParams();
  let query = slug;
  try {
    query = decodeURIComponent(slug);
  } catch {
    // keep it as is
  }
  return <EmptyState missedQuery={query} suggestions={[]} />;
}

export function MissedSearch() {
  const q = useSearchParams().get('q')?.trim();
  return <EmptyState missedQuery={q || 'this search'} suggestions={[]} />;
}
