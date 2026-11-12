import { describe, expect, test } from 'vitest';
import {
  EMPTY_FILTERS,
  filtersFromSearch,
  filtersToApiQuery,
  filtersToSearch,
  hasActiveFilters,
  parsePage,
  timelineHref,
  viewFromSegment,
  toSignedYear,
} from '../src/lib/filters.js';

describe('filtersFromSearch', () => {
  test('empty query gives empty filters', () => {
    expect(filtersFromSearch('')).toEqual(EMPTY_FILTERS);
  });

  test.each([
    ['?from=1868', { from: '1868', fromEra: 'CE' }],
    ['?from=660BCE', { from: '660', fromEra: 'BCE' }],
    ['?from=660%20bc', { from: '660', fromEra: 'BCE' }],
    ['?from=-660', { from: '660', fromEra: 'BCE' }],
    ['?from=1066AD', { from: '1066', fromEra: 'CE' }],
    ['?from=0', { from: '', fromEra: 'CE' }],
    ['?from=soon', { from: '', fromEra: 'CE' }],
  ])('parses year %s', (search, expected) => {
    expect(filtersFromSearch(search)).toMatchObject(expected);
  });

  test('tags: comma lists and repeats, lower-cased, de-duplicated, sorted, junk dropped', () => {
    expect(filtersFromSearch('?tags=War,treaty&tags=war&tags=bad%20tag').tags).toEqual(['treaty', 'war']);
  });
});

describe('filtersToSearch', () => {
  test('round-trips through the URL', () => {
    const f = { from: '660', fromEra: 'BCE', to: '1868', toEra: 'CE', tags: ['war', 'treaty'] };
    const search = filtersToSearch(f);
    expect(search).toBe('?from=660BCE&to=1868&tags=treaty,war');
    expect(filtersFromSearch(search)).toEqual({ ...f, tags: ['treaty', 'war'] });
  });

  test('empty filters give an empty string', () => {
    expect(filtersToSearch(EMPTY_FILTERS)).toBe('');
  });
});

describe('timeline URLs', () => {
  const f = { from: '1900', fromEra: 'CE', to: '', toEra: 'CE', tags: ['war'] };

  test('the page is a path segment; page 1 has none', () => {
    expect(timelineHref('/t/japan', EMPTY_FILTERS)).toBe('/t/japan');
    expect(timelineHref('/t/japan', EMPTY_FILTERS, 1)).toBe('/t/japan');
    expect(timelineHref('/t/japan', EMPTY_FILTERS, 3)).toBe('/t/japan/3');
    expect(timelineHref('/t/japan', f, 2)).toBe('/t/japan/2?from=1900&tags=war');
  });

  test('viewFromSegment reads what next.config.mjs rewrites to', () => {
    expect(viewFromSegment('1')).toEqual({ page: 1, filters: EMPTY_FILTERS });
    expect(viewFromSegment('2~from=1900&tags=war')).toEqual({ page: 2, filters: f });
    expect(viewFromSegment('1~tags=war,treaty&utm=x').filters.tags).toEqual(['treaty', 'war']);
  });

  test('viewFromSegment rejects anything else', () => {
    for (const v of ['', '0', '01', 'abc', '2.5', '-1', '~tags=war', '9999999']) expect(viewFromSegment(v), v).toBeNull();
  });
});

describe('filtersToApiQuery', () => {
  test('uses signed years and always sends page/limit', () => {
    const q = new URLSearchParams(
      filtersToApiQuery({ from: '660', fromEra: 'BCE', to: '', toEra: 'CE', tags: ['war', 'coup'] }, 3),
    );
    expect(Object.fromEntries(q)).toEqual({ from: '-660', tags: 'coup,war', page: '3', limit: '20' });
  });
});

describe('helpers', () => {
  test('parsePage ignores junk', () => {
    expect(parsePage('0')).toBeNull();
    expect(parsePage('abc')).toBeNull();
    expect(parsePage('2.5')).toBeNull();
    expect(parsePage('4')).toBe(4);
  });

  test('toSignedYear and hasActiveFilters', () => {
    expect(toSignedYear('660', 'BCE')).toBe(-660);
    expect(toSignedYear('', 'CE')).toBeNull();
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tags: ['war'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, to: '1900' })).toBe(true);
  });
});
