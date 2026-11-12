'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StoryBadge from './StoryBadge.jsx';
import TimelineEvent from './TimelineEvent.jsx';
import TimelineFilters from './TimelineFilters.jsx';
import Pagination from './Pagination.jsx';
import { TimelineEventsSkeleton } from './PageSkeleton.jsx';
import useDebounced from '../hooks/useDebounced.js';
import { FADE_OUT_MS, useNavigation } from '../navigation/NavigationProvider.jsx';
import { EMPTY_FILTERS, filtersToSearch, hasActiveFilters, timelineHref } from '../lib/filters.js';

// Client component for one page of a term's timeline. The server sends the
// events already filtered and paginated; this component owns the filter inputs.
// Changing a filter updates the URL (page resets to 1), which fetches the new
// page from the server: current events fade out, a skeleton list shows while
// loading, and the new events fade in.
export default function Timeline(props) {
  const { term, filters: serverFilters, path } = props;
  const { pending, navigate } = useNavigation();
  const [filters, setFilters] = useState(serverFilters);
  const serverSearch = filtersToSearch(serverFilters);

  // The query we last asked the server for. When the server sends filters we
  // didn't ask for (Back/Forward), adopt them; our own echo is ignored, so
  // typing during a load isn't overwritten.
  const requested = useRef(serverSearch);
  useEffect(() => {
    if (serverSearch !== requested.current) {
      requested.current = serverSearch;
      setFilters(serverFilters);
    }
  }, [serverSearch, serverFilters]);

  // Year fields wait until typing pauses (clearing applies at once); tag toggles apply immediately.
  const yearKey = `${filters.from}|${filters.fromEra}|${filters.to}|${filters.toEra}`;
  const debouncedYearKey = useDebounced(yearKey, 400);
  const appliedYearKey = filters.from === '' && filters.to === '' ? yearKey : debouncedYearKey;
  const applied = useMemo(() => {
    const [from, fromEra, to, toEra] = appliedYearKey.split('|');
    return { from, fromEra, to, toEra, tags: filters.tags };
  }, [appliedYearKey, filters.tags]);
  const appliedSearch = filtersToSearch(applied);

  // Applied filters changed → ask the server for page 1 of the new result.
  // replace: filter tweaks don't pile up in the Back button history.
  useEffect(() => {
    if (appliedSearch === requested.current) return;
    requested.current = appliedSearch;
    navigate(`${path}${appliedSearch}`, { replace: true });
  }, [appliedSearch, path, navigate]);

  // In-place loading: fade the current events out, then show a skeleton list.
  const loadingHere = Boolean(pending?.inPlace && pending.path === path);

  // The router commits the new page as soon as the server sends it, which can
  // be mid fade-out. Keep showing the page we had until the loading state ends,
  // so new events only ever appear by fading in.
  const live = { events: props.events, pagination: props.pagination, tagFacets: props.tagFacets, serverFilters };
  const [settled, setSettled] = useState(live);
  if (!loadingHere && settled.events !== live.events) setSettled(live);
  const { events, pagination, tagFacets, serverFilters: shownFilters } = loadingHere ? settled : live;
  // Which load the fade-out finished for; a new load starts un-faded again.
  const [fadedOutFor, setFadedOutFor] = useState(null);
  const pendingHref = loadingHere ? pending.href : null;
  useEffect(() => {
    if (!pendingHref) return undefined;
    const timer = setTimeout(() => setFadedOutFor(pendingHref), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [pendingHref]);
  const showSkeleton = loadingHere && fadedOutFor === pendingHref;

  const toggleTag = (tag) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag].sort(),
    }));

  // Chips come from the server's counts; keep selected tags visible even when
  // the year range leaves them with no events, so they can be turned off.
  const tagChips = useMemo(() => {
    const chips = [...tagFacets];
    for (const t of filters.tags) if (!chips.some((c) => c.tag === t)) chips.push({ tag: t, count: 0 });
    return chips;
  }, [tagFacets, filters.tags]);

  const hrefFor = (page) => timelineHref(path, shownFilters, page);
  const offset = (pagination.page - 1) * pagination.pageSize;

  return (
    <>
      <TimelineFilters
        filters={filters}
        onChange={setFilters}
        tags={tagChips}
        loading={loadingHere}
        shown={pagination.total}
        total={term.eventCount}
        range={pagination.total ? [offset + 1, offset + events.length] : null}
        yearSpan={term.span ? [term.span.from, term.span.to] : null}
      />

      <section className="timeline" aria-label={`History of ${term.name}`} aria-busy={loadingHere || undefined}>
        <div className="timeline__intro">
          <StoryBadge term={term} />
          {term.description && <p className="timeline__summary">{term.description}</p>}
        </div>

        {showSkeleton ? (
          <TimelineEventsSkeleton count={Math.min(Math.max(events.length, 2), 4)} />
        ) : (
          <ol className="timeline__events">
            {events.map((event, i) => {
              const side = i % 2 === 0 ? 'right' : 'left';
              return (
                // New events (and ones that switch sides) remount, so their fade-in plays.
                <TimelineEvent
                  key={`${event.id}-${side}`}
                  event={event}
                  side={side}
                  leaving={loadingHere}
                  activeTags={filters.tags}
                  onTagClick={toggleTag}
                />
              );
            })}
          </ol>
        )}

        {!loadingHere && pagination.total === 0 && hasActiveFilters(shownFilters) && (
          <div className="timeline__none">
            <p>No events match these filters.</p>
            <button type="button" className="filters__clear" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          </div>
        )}

        <div className="timeline__end" aria-hidden="true" />
      </section>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        hrefFor={hrefFor}
        disabled={loadingHere}
      />
    </>
  );
}
