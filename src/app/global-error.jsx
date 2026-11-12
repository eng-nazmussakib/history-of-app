'use client';

// Last resort: the root layout itself failed. Replaces the whole document.
export default function GlobalError({ error }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong · History Of</title>
      </head>
      <body style={{ fontFamily: 'Georgia, serif', padding: 32, background: '#ebe7dc', color: '#3b3631' }}>
        <h1>Something went wrong</h1>
        <p>{process.env.NODE_ENV === 'development' ? String(error?.stack ?? error) : 'Please try again.'}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </body>
    </html>
  );
}
