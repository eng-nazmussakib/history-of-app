import SiteHeader from '@/components/SiteHeader.jsx';

export const dynamic = 'force-dynamic';

// /search?q=…: keep the query in the box.
export default async function Header({ searchParams }) {
  const q = (await searchParams).q;
  return <SiteHeader query={typeof q === 'string' ? q.trim() : ''} />;
}
