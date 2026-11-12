import StoryBadge from './StoryBadge.jsx';

// Loading placeholders shaped like the page being loaded. Purely visual:
// screen readers get a single "Loading…" status instead.

// Placeholder event cards, alternating sides like the real timeline.
export function TimelineEventsSkeleton({ count = 4 }) {
  return (
    <ol className="timeline__events" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={`event event--${i % 2 === 0 ? 'right' : 'left'} skeleton__event`}>
          <div className="event__header">
            <div className="event__year skeleton__year" />
            <div className="skel skel--title" />
          </div>
          <div className="event__body">
            <div className="skel skel--line" style={{ width: '35%' }} />
            <div className="skel skel--line" />
            <div className="skel skel--line" />
            <div className="skel skel--line" style={{ width: '80%' }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function TimelineSkeleton({ name }) {
  return (
    <div className="skeleton">
      <div className="filters skeleton__filters">
        <div className="filters__row">
          <div className="skel skel--ribbon" />
          <div className="skel skel--field" />
          <div className="skel skel--field" />
          <div className="skel skel--pill skeleton__push" />
        </div>
        <div className="filters__tags">
          {[64, 88, 72, 96, 60, 80, 70].map((w, i) => (
            <div key={i} className="skel skel--chip" style={{ width: w }} />
          ))}
        </div>
      </div>

      <section className="timeline">
        <div className="timeline__intro">
          {name ? (
            <div className="skeleton__badge">
              <StoryBadge term={{ name, span: null }} as="span" />
            </div>
          ) : (
            <div className="story-badge">
              <div className="story-badge__circle">
                <span className="story-badge__the">The Story of</span>
                <div className="skel skel--name" />
              </div>
            </div>
          )}
          <div className="skel skel--line skeleton__center" style={{ width: '70%' }} />
        </div>

        <TimelineEventsSkeleton />
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="skeleton results">
      <div className="skel skel--link" />
      <div className="skel skel--heading skeleton__center" />
      <div className="results__list">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="results__item">
            <div className="skel skel--line" style={{ width: `${55 - i * 6}%`, margin: 0 }} />
            <div className="skel skel--line" style={{ width: 60, margin: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Same markup and classes as app/countries/page.jsx, so the width, A–Z groups
// and auto-fill grid match the real page at every breakpoint. Unknown text
// (counts, names) is an inline shimmer inside the real text element, which
// keeps each row at its real line height.
const COUNTRY_GROUPS = [
  ['A', 11],
  ['B', 17],
  ['C', 13],
  ['D', 4],
];

function CountriesSkeleton() {
  return (
    <section className="skeleton index">
      <h1 className="index__title">All countries</h1>
      <p className="index__lead">
        <span className="skel skel--inline" style={{ width: 230 }} />
      </p>
      {COUNTRY_GROUPS.map(([letter, count]) => (
        <section key={letter} className="index__group">
          <h2 className="index__letter">{letter}</h2>
          <ul className="index__list">
            {Array.from({ length: count }, (_, i) => (
              <li key={i}>
                <div className="index__item">
                  <span className="index__name">
                    <span className="skel skel--inline" style={{ width: [96, 120, 78, 108, 88][i % 5] }} />
                  </span>
                  <span className="index__count">
                    <span className="skel skel--inline" style={{ width: 54 }} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="skeleton empty">
      <div className="empty__badge" />
      <div className="skel skel--heading skeleton__center" />
      <div className="skel skel--line skeleton__center" style={{ width: '80%' }} />
      <div className="skel skel--line skeleton__center" style={{ width: '60%' }} />
    </div>
  );
}

// "/t/united-states" → "United States": shows the target's name in the badge right away.
function nameFromSlug(slug) {
  try {
    return decodeURIComponent(slug)
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

export default function PageSkeleton({ href }) {
  const path = href.split(/[?#]/)[0];
  const term = path.match(/^\/t\/([^/]+)(?:\/\d+)?\/?$/);
  let body;
  if (term) body = <TimelineSkeleton name={nameFromSlug(term[1])} />;
  else if (path === '/search') body = <ResultsSkeleton />;
  else if (path.replace(/\/$/, '') === '/countries') body = <CountriesSkeleton />;
  else body = <HomeSkeleton />;

  return (
    <div aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading…
      </p>
      <div aria-hidden="true">{body}</div>
    </div>
  );
}
