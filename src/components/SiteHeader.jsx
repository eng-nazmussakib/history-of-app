import Logo from './Logo.jsx';
import SearchBar from './SearchBar.jsx';

// Server component, rendered by the @header slot so each page can fill the
// search box with its own query. The search box is the only interactive part.
export default function SiteHeader({ query = '' }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo />
        {/* Keyed by the query so it resets to the new page's term after navigation. */}
        <SearchBar key={query} initialQuery={query} />
      </div>
    </header>
  );
}
