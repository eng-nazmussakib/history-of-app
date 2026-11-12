'use client';

import { usePendingNavigation } from '../navigation/NavigationProvider.jsx';
import PageSkeleton from './PageSkeleton.jsx';

// Wraps the page content. While a client-side navigation to another page is
// loading, shows a skeleton shaped like that page. In-page updates (filters,
// pagination) keep the page and let it show its own loading state.
export default function PageShell({ children }) {
  const pending = usePendingNavigation();
  if (pending && !pending.inPlace) return <PageSkeleton href={pending.href} />;
  return children;
}
