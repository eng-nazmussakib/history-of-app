import './globals.css';
import { Arvo, Bree_Serif, Squada_One } from 'next/font/google';
import PageShell from '@/components/PageShell.jsx';
import SiteHeader from '@/components/SiteHeader.jsx';
import NavigationProvider from '@/navigation/NavigationProvider.jsx';
import { SITE_NAME, openGraph, twitter } from '@/lib/site.js';
import { getStaticOrigin } from '@/server/data.js';

// Self-hosted at build time by next/font; globals.css maps these variables to
// --font-body / --font-display / --font-year.
const arvo = Arvo({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-arvo' });
const bree = Bree_Serif({ weight: '400', subsets: ['latin'], variable: '--font-bree' });
const squada = Squada_One({ weight: '400', subsets: ['latin'], variable: '--font-squada' });

export const metadata = {
  // Resolves relative URLs in metadata (the share image) to absolute ones.
  metadataBase: new URL(getStaticOrigin()),
  title: SITE_NAME,
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
  openGraph: openGraph(),
  twitter,
};

export const viewport = { themeColor: '#ebe7dc' };

// The HTML document. `header` is the @header slot: each route renders the site
// header with its own search query (e.g. the term's name on a timeline). URLs
// that match no route at all render without the slot, hence the fallback.
export default function RootLayout({ children, header }) {
  return (
    <html lang="en" className={`${arvo.variable} ${bree.variable} ${squada.variable}`}>
      <body>
        <NavigationProvider>
          {header ?? <SiteHeader />}
          <main className="page">
            <PageShell>{children}</PageShell>
          </main>
          <footer className="site-footer">
            <p>
              <strong>History Of</strong> · Events from Wikidata (CC0), summaries from Wikipedia (CC BY-SA 4.0).
            </p>
            <nav className="site-footer__nav" aria-label="Browse">
              <a href="/countries">All countries</a>
            </nav>
          </footer>
        </NavigationProvider>
      </body>
    </html>
  );
}
