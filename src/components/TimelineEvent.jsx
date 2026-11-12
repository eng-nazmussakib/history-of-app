import { badgeYear, formatYear } from '../lib/dates.js';

export default function TimelineEvent({ event, side, leaving, activeTags = [], onTagClick }) {
  const { value, era } = badgeYear(event.year);

  return (
    <li className={`event event--${side}${leaving ? ' is-leaving' : ''}`} aria-hidden={leaving || undefined}>
      <article>
        <header className="event__header">
          <time className="event__year" dateTime={String(event.year)} title={formatYear(event.year)}>
            <span className="event__year-value">{value}</span>
            {era && <span className="event__year-era">{era}</span>}
          </time>
          <h2 className="event__title">{event.title}</h2>
        </header>

        <div className="event__body">
          <p className="event__date">{event.displayDate}</p>
          {event.summary && <p>{event.summary}</p>}

          <footer className="event__meta">
            <ul className="event__tags" aria-label="Tags">
              {event.tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className={activeTags.includes(tag) ? 'is-on' : undefined}
                    aria-pressed={activeTags.includes(tag)}
                    title={activeTags.includes(tag) ? `Remove #${tag} filter` : `Show only #${tag}`}
                    onClick={() => onTagClick?.(tag)}
                  >
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
            {event.sources.length > 0 && (
              <p className="event__source">
                Source:{' '}
                {event.sources.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 && ' · '}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </footer>
        </div>
      </article>
    </li>
  );
}
