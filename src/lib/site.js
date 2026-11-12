// Head tags shared by every page. Next replaces (not merges) a parent's
// openGraph object when a page sets its own, so pages build theirs from here.
export const SITE_NAME = 'History Of';

// Static share image (public/og-image.png, 1200×630). A plain file rather than
// an opengraph-image.jsx route, so it's served as a static asset everywhere.
// Relative URL: the root layout's metadataBase makes it absolute.
export const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'History Of: the history of any country, on a timeline.',
};

export const openGraph = (extra = {}) => ({ siteName: SITE_NAME, locale: 'en_US', images: [OG_IMAGE], ...extra });

export const twitter = { card: 'summary_large_image', images: [OG_IMAGE] };
