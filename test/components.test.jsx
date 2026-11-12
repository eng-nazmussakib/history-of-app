import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Pagination from '../src/components/Pagination.jsx';
import EmptyState from '../src/components/EmptyState.jsx';
import TimelineFilters from '../src/components/TimelineFilters.jsx';
import Timeline from '../src/components/Timeline.jsx';
import StoryBadge from '../src/components/StoryBadge.jsx';
import PageSkeleton from '../src/components/PageSkeleton.jsx';
import { EMPTY_FILTERS } from '../src/lib/filters.js';

const html = (el) => renderToStaticMarkup(el);
const count = (markup, needle) => markup.split(needle).length - 1;

const event = (id, year, tags = ['war']) => ({
  id,
  title: `Event ${id}`,
  summary: `Summary ${id}`,
  year,
  start: { year, month: null, day: null, precision: 'year' },
  end: null,
  displayDate: String(year),
  importance: 50,
  tags,
  sources: [{ name: 'Wikipedia', url: `https://en.wikipedia.org/wiki/E${id}` }],
});

const TERM = { slug: 'japan', name: 'Japan', type: 'country', description: 'Island country', eventCount: 45, span: { from: -660, to: 2011 } };

describe('Pagination', () => {
  const hrefFor = (p) => `/t/japan?page=${p}`;

  test('renders nothing for a single page', () => {
    expect(html(<Pagination page={1} totalPages={1} hrefFor={hrefFor} />)).toBe('');
  });

  test('marks the current page and links neighbours', () => {
    const out = html(<Pagination page={2} totalPages={3} hrefFor={hrefFor} />);
    expect(out).toContain('aria-current="page"');
    expect(out).toMatch(/href="\/t\/japan\?page=2"[^>]*aria-current="page"/);
    expect(out).toContain('rel="prev"');
    expect(out).toContain('rel="next"');
  });

  test('no Earlier link on the first page, no Later link on the last', () => {
    expect(html(<Pagination page={1} totalPages={3} hrefFor={hrefFor} />)).not.toContain('rel="prev"');
    expect(html(<Pagination page={3} totalPages={3} hrefFor={hrefFor} />)).not.toContain('rel="next"');
  });
});

describe('EmptyState', () => {
  test('home: prompt and suggestion links', () => {
    const out = html(<EmptyState suggestions={[{ slug: 'japan', name: 'Japan' }]} />);
    expect(out).toContain('Search a country to see its history');
    expect(out).toContain('href="/t/japan"');
    expect(out).not.toContain('New search');
  });

  test('missed query: message and a way back', () => {
    const out = html(<EmptyState missedQuery="atlantis" />);
    expect(out).toContain('No history for “atlantis” yet');
    expect(out).toContain('class="new-search" href="/"');
  });
});

describe('TimelineFilters', () => {
  const base = { filters: EMPTY_FILTERS, onChange: () => {}, tags: [{ tag: 'war', count: 7 }], yearSpan: [-660, 2011] };

  test('shows the count, page range and era placeholders', () => {
    const out = html(<TimelineFilters {...base} shown={45} total={45} range={[21, 40]} />);
    expect(out).toContain('<strong>45</strong> of 45 events');
    expect(out).toContain('showing 21–40');
    expect(out).toContain('placeholder="660 BCE"');
    expect(out).toContain('#war <span class="filter-chip__count">7</span>');
  });

  test('shows a loading message while a new page loads', () => {
    const out = html(<TimelineFilters {...base} loading shown={45} total={45} range={[1, 20]} />);
    expect(out).toContain('Loading…');
    expect(out).not.toContain('of 45 events');
  });

  test('Clear filters is disabled until a filter is set', () => {
    expect(html(<TimelineFilters {...base} shown={1} total={1} />)).toMatch(/<button[^>]*disabled=""[^>]*>Clear filters/);
    const active = html(<TimelineFilters {...base} filters={{ ...EMPTY_FILTERS, tags: ['war'] }} shown={1} total={1} />);
    expect(active).not.toMatch(/<button[^>]*disabled=""[^>]*>Clear filters/);
  });
});

describe('Timeline', () => {
  const props = {
    term: TERM,
    events: [event(1, 1600), event(2, 1868, ['revolution'])],
    pagination: { page: 1, pageSize: 20, total: 45, totalPages: 3 },
    tagFacets: [{ tag: 'war', count: 7 }],
    filters: EMPTY_FILTERS,
    path: '/t/japan',
  };

  test('renders the events alternating sides, with pagination', () => {
    const out = html(<Timeline {...props} />);
    expect(count(out, 'class="event event--right"')).toBe(1);
    expect(count(out, 'class="event event--left"')).toBe(1);
    expect(out).toContain('Event 2');
    expect(out).toContain('aria-label="Timeline pages"');
    expect(out).toContain('href="/t/japan/2"');
  });

  test('page links keep the active filters', () => {
    const out = html(<Timeline {...props} filters={{ ...EMPTY_FILTERS, tags: ['war'] }} />);
    expect(out).toContain('href="/t/japan/2?tags=war"');
  });

  test('keeps a selected tag chip even when it has no events in range', () => {
    const out = html(<Timeline {...props} filters={{ ...EMPTY_FILTERS, tags: ['famine'] }} />);
    expect(out).toContain('#famine <span class="filter-chip__count">0</span>');
  });

  test('says when no events match', () => {
    const out = html(
      <Timeline
        {...props}
        events={[]}
        pagination={{ page: 1, pageSize: 20, total: 0, totalPages: 1 }}
        filters={{ ...EMPTY_FILTERS, from: '3000', fromEra: 'CE' }}
      />,
    );
    expect(out).toContain('No events match these filters.');
    expect(out).not.toContain('aria-label="Timeline pages"');
  });
});

describe('StoryBadge and skeletons', () => {
  test('badge shows the name, span and size class', () => {
    const out = html(<StoryBadge term={{ name: 'Liechtenstein', span: { from: 1719, to: 2020 } }} />);
    expect(out).toContain('class="story-badge__name is-xxlong"');
    expect(out).toContain('1719 – 2020');
  });

  test('skeleton matches the target page', () => {
    const term = html(<PageSkeleton href="/t/united-states?page=2" />);
    expect(term).toContain('United States');
    expect(term).toContain('skeleton__event');
    expect(term).toContain('aria-busy="true"');
    expect(html(<PageSkeleton href="/search?q=x" />)).toContain('results__item');
    const countries = html(<PageSkeleton href="/countries" />);
    expect(countries).toContain('index__list');
    expect(countries).not.toContain('empty__badge');
  });
});
