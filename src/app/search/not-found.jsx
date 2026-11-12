import { MissedSearch } from '@/components/MissedQuery.jsx';

// /search?q=… with no matches: HTTP 404.
export default function SearchNotFound() {
  return <MissedSearch />;
}
