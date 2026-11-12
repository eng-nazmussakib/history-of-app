import NewSearchLink from './NewSearchLink.jsx';

// Server component. Shown on the home page, and when a search or URL finds nothing.
export default function EmptyState({ missedQuery, suggestions = [] }) {
  return (
    <section className="empty" aria-live="polite">
      <div className="empty__badge" aria-hidden="true">
        {missedQuery ? '?' : '…'}
      </div>

      <h1 className="empty__title">
        {missedQuery ? `No history for “${missedQuery}” yet` : 'Search a country to see its history'}
      </h1>
      <p className="empty__text">
        {missedQuery
          ? 'Check the spelling or try another term.'
          : 'Type a country in the search bar above. Its history will appear here as a timeline.'}
      </p>

      {missedQuery && (
        <p className="empty__back">
          <NewSearchLink />
        </p>
      )}

      {suggestions.length > 0 && (
        <p className="empty__try">
          Try:{' '}
          {suggestions.map((t) => (
            <a key={t.slug} className="empty__chip" href={`/t/${t.slug}`}>
              {t.name}
            </a>
          ))}
        </p>
      )}
    </section>
  );
}
