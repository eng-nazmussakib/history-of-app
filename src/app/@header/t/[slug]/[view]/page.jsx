import SiteHeader from '@/components/SiteHeader.jsx';
import { getTerm } from '@/server/data.js';

// Cached like the timeline page it belongs to (see app/t/[slug]/[view]/page.jsx).
export const revalidate = 21600;
export const generateStaticParams = () => [];

// /t/:slug: the term's name, or the slug itself for unknown terms (and when
// the database is down; the page itself reports that).
export default async function Header({ params }) {
  const slug = safeDecode((await params).slug);
  const term = await getTerm(slug).catch(() => null);
  return <SiteHeader query={term?.name ?? slug} />;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
