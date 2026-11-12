import NewSearchLink from './NewSearchLink.jsx';

export default function UnavailableState({ onRetry }) {
  return (
    <section className="empty" aria-live="polite">
      <div className="empty__badge" aria-hidden="true">!</div>
      <h1 className="empty__title">History is unavailable right now</h1>
      <p className="empty__text">The timeline service couldn’t be reached. Please try again in a moment.</p>
      <p className="empty__back">
        {onRetry && (
          <>
            <button type="button" className="filters__clear" onClick={onRetry}>
              Try again
            </button>{' '}
          </>
        )}
        <NewSearchLink />
      </p>
    </section>
  );
}
