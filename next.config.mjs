// Timeline URLs. Public:   /t/japan, /t/japan/2, /t/japan/2?from=1900&tags=war
//                Internal: /t/japan/1, /t/japan/2, /t/japan/2~from=1900&tags=war
//
// The timeline page (app/t/[slug]/[view]) is ISR: rendered once, cached, and
// revalidated in the background. A cached page can't read searchParams, so
// these rewrites fold the filters into the [view] path segment instead. Each
// filter combination becomes one cache entry; other query parameters (utm_*,
// fbclid, …) are ignored and share the unfiltered entry. Plain next.config
// rewrites rather than proxy.js, so the routing also works on OpenNext for
// Cloudflare, which doesn't support Node-runtime proxy yet.
const FILTER_KEYS = ['from', 'to', 'tags'];

// Every non-empty subset of the filter keys, largest first (first match wins).
const filterCombos = Array.from({ length: 2 ** FILTER_KEYS.length - 1 }, (_, i) =>
  FILTER_KEYS.filter((_, bit) => (i + 1) & (1 << bit)),
).sort((a, b) => b.length - a.length);

function timelineRewrites() {
  const rules = [];
  for (const [source, page] of [
    ['/t/:slug', '1'],
    ['/t/:slug/:page(\\d+)', ':page'],
  ]) {
    for (const keys of filterCombos) {
      rules.push({
        source,
        has: keys.map((key) => ({ type: 'query', key, value: `(?<${key}>.+)` })),
        destination: `/t/:slug/${page}~${keys.map((key) => `${key}=:${key}`).join('&')}`,
      });
    }
  }
  rules.push({ source: '/t/:slug', destination: '/t/:slug/1' });
  return rules;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      // Page 1 has no number in its URL.
      { source: '/t/:slug/1', destination: '/t/:slug', permanent: true },
    ];
  },
  async rewrites() {
    return { beforeFiles: timelineRewrites() };
  },
  // Baseline security headers on every response, pages and API alike. (A
  // Content-Security-Policy would need nonces for Next's inline scripts.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
