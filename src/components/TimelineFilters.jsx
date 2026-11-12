import { EMPTY_FILTERS, hasActiveFilters } from '../lib/filters.js';

function YearField({ label, value, era, onValue, onEra, placeholder }) {
  const id = `year-${label.toLowerCase()}`;
  return (
    <div className="year-field">
      <label htmlFor={id}>{label}</label>
      <div className="year-field__inputs">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min="1"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
        <button
          type="button"
          className="year-field__era"
          aria-label={`${label} era: ${era}. Switch to ${era === 'CE' ? 'BCE' : 'CE'}`}
          onClick={() => onEra(era === 'CE' ? 'BCE' : 'CE')}
        >
          {era}
        </button>
      </div>
    </div>
  );
}

export default function TimelineFilters({ filters, onChange, tags, loading, shown, total, range, yearSpan }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const toggleTag = (tag) =>
    set({ tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag] });
  const active = hasActiveFilters(filters);
  const fmt = (y) => (y < 0 ? `${-y} BCE` : String(y));

  return (
    <section className="filters" aria-label="Filter events" data-scroll-anchor="">
      <div className="filters__row">
        <h2 className="filters__title">Filter</h2>

        <fieldset className="filters__years">
          <legend className="visually-hidden">Year range</legend>
          <YearField
            label="From"
            value={filters.from}
            era={filters.fromEra}
            placeholder={yearSpan ? fmt(yearSpan[0]) : ''}
            onValue={(from) => set({ from })}
            onEra={(fromEra) => set({ fromEra })}
          />
          <span className="filters__dash" aria-hidden="true">–</span>
          <YearField
            label="To"
            value={filters.to}
            era={filters.toEra}
            placeholder={yearSpan ? fmt(yearSpan[1]) : ''}
            onValue={(to) => set({ to })}
            onEra={(toEra) => set({ toEra })}
          />
        </fieldset>

        <p className="filters__count" aria-live="polite">
          {loading ? (
            <span className="filters__loading">Loading…</span>
          ) : (
            <>
              <strong>{shown}</strong> of {total} events
              {range && shown > range[1] - range[0] + 1 && (
                <span className="filters__span">
                  {' '}
                  · showing {range[0]}–{range[1]}
                </span>
              )}
              {yearSpan && !active && !(range && shown > range[1] - range[0] + 1) && (
                <span className="filters__span">
                  {' '}
                  · {fmt(yearSpan[0])} – {fmt(yearSpan[1])}
                </span>
              )}
            </>
          )}
        </p>

        <button
          type="button"
          className="filters__clear"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={!active}
        >
          Clear filters
        </button>
      </div>

      {tags.length > 0 && (
        <div className="filters__tags" role="group" aria-label="Tags">
          {tags.map(({ tag, count }) => {
            const on = filters.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`filter-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
              >
                #{tag} <span className="filter-chip__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
