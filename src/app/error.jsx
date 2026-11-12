'use client';

import { useEffect } from 'react';
import UnavailableState from '@/components/UnavailableState.jsx';

// A page failed to render on the server. In practice that's the database being
// unreachable (data errors are handled in the pages), so say so and offer a retry.
export default function PageError({ error, reset }) {
  useEffect(() => console.error(error), [error]);
  return (
    <>
      <title>Temporarily unavailable · History Of</title>
      <meta name="robots" content="noindex" />
      <UnavailableState onRetry={reset} />
    </>
  );
}
