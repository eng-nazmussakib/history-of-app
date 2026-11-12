import EmptyState from '@/components/EmptyState.jsx';

export const metadata = { title: 'Page not found · History Of' };

// Unknown URLs. (Unknown terms and empty searches have their own not-found.jsx.)
export default function NotFound() {
  return <EmptyState missedQuery="this page" suggestions={[]} />;
}
