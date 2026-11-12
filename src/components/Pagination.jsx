// Page links for a timeline. Plain links: they work without JavaScript, and
// the browser entry turns them into in-place client navigations.
import { pageList } from '../lib/pagination.js';

export default function Pagination({ page, totalPages, hrefFor, disabled = false }) {
  if (totalPages <= 1) return null;
  const items = pageList(page, totalPages);

  return (
    <nav className={`pagination${disabled ? ' is-disabled' : ''}`} aria-label="Timeline pages">
      {page > 1 ? (
        <a className="pagination__step" href={hrefFor(page - 1)} rel="prev">
          <span aria-hidden="true">‹</span> Earlier
        </a>
      ) : (
        <span className="pagination__step is-inactive" aria-hidden="true">
          <span>‹</span> Earlier
        </span>
      )}

      <ol className="pagination__pages">
        {items.map((p, i) =>
          p == null ? (
            <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <a
                className={`pagination__page${p === page ? ' is-current' : ''}`}
                href={hrefFor(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </a>
            </li>
          ),
        )}
      </ol>

      {page < totalPages ? (
        <a className="pagination__step" href={hrefFor(page + 1)} rel="next">
          Later <span aria-hidden="true">›</span>
        </a>
      ) : (
        <span className="pagination__step is-inactive" aria-hidden="true">
          Later <span>›</span>
        </span>
      )}
    </nav>
  );
}
