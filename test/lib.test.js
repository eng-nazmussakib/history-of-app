import { describe, expect, test } from 'vitest';
import { badgeNameClass } from '../src/lib/badge.js';
import { badgeYear, formatYear } from '../src/lib/dates.js';
import { pageList } from '../src/lib/pagination.js';
import { robotsTxt, sitemapXml } from '../src/lib/seo-files.js';

describe('badgeNameClass', () => {
  test.each([
    ['Japan', 'story-badge__name'],
    ['Malaysia', 'story-badge__name is-long'],
    ['Afghanistan', 'story-badge__name is-xlong'],
    ['Liechtenstein', 'story-badge__name is-xxlong'],
    ['Saint Vincent and the Grenadines', 'story-badge__name is-xlong'],
  ])('%s → %s', (name, cls) => expect(badgeNameClass(name)).toBe(cls));
});

describe('dates', () => {
  test('formatYear', () => {
    expect(formatYear(1868)).toBe('1868');
    expect(formatYear(-660)).toBe('660 BCE');
    expect(formatYear(null)).toBe('Today');
  });
  test('badgeYear', () => {
    expect(badgeYear(-660)).toEqual({ value: 660, era: 'BCE' });
    expect(badgeYear(1945)).toEqual({ value: 1945, era: null });
  });
});

describe('pageList', () => {
  test.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [6, 12, [1, null, 5, 6, 7, null, 12]],
    [1, 12, [1, 2, null, 12]],
    [3, 5, [1, 2, 3, 4, 5]], // a gap of one page shows the page instead of "…"
  ])('page %i of %i', (page, total, expected) => expect(pageList(page, total)).toEqual(expected));
});

describe('SEO files', () => {
  test('robots.txt blocks search and RSC payloads and points at the sitemap', () => {
    const txt = robotsTxt('https://example.org');
    expect(txt).toContain('Disallow: /search');
    expect(txt).toContain('Disallow: /*?_rsc=');
    expect(txt).toContain('Disallow: /v1/');
    expect(txt).toContain('Sitemap: https://example.org/sitemap.xml');
  });

  test('sitemap lists home, the countries index, terms with events and their later pages', () => {
    const xml = sitemapXml('https://example.org', [
      { slug: 'japan', eventCount: 45, lastModified: new Date('2026-11-10T08:00:00Z') },
      { slug: 'tuvalu', eventCount: 0, lastModified: new Date('2026-11-12T08:00:00Z') },
      { slug: 'chad', eventCount: 5, lastModified: new Date('2026-11-01T08:00:00Z') },
    ]);
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc><lastmod>(.*?)<\/lastmod>/g)].map((m) => [m[1], m[2]]);
    expect(urls).toEqual([
      ['https://example.org/', '2026-11-10T08:00:00.000Z'],
      ['https://example.org/countries', '2026-11-10T08:00:00.000Z'],
      ['https://example.org/t/chad', '2026-11-01T08:00:00.000Z'],
      ['https://example.org/t/japan', '2026-11-10T08:00:00.000Z'],
      ['https://example.org/t/japan/2', '2026-11-10T08:00:00.000Z'],
      ['https://example.org/t/japan/3', '2026-11-10T08:00:00.000Z'],
    ]);
  });

  test('sitemap escapes XML', () => {
    expect(sitemapXml('https://example.org/?a=1&b=2', [])).toContain('&amp;');
  });
});
