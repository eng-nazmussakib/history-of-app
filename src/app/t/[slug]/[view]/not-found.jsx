import { MissedTerm } from '@/components/MissedQuery.jsx';

// /t/:slug for a term that doesn't exist: HTTP 404 with "No history for … yet".
export default function TermNotFound() {
  return <MissedTerm />;
}
