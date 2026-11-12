# Feature Breakdown

Each feature has an ID, a phase and a status. Phases:

- **MVP**: the smallest version worth shipping.
- **v1**: makes the product feel complete.
- **Later**: nice to have, after real usage data exists.

Status: ✅ **Done** · 🟡 **Partly done** · ⬜ **Planned**

| ID | Feature | Area | Phase | Status |
|---|---|---|---|---|
| F-01 | Search | Web / API | MVP | 🟡 |
| F-02 | Term timeline page | Web / API | MVP | ✅ |
| F-03 | Timeline UI | Web | MVP | ✅ |
| F-04 | SEO foundation | Web | MVP | ✅ |
| F-05 | Seed terms (countries) | Data | MVP | ✅ |
| F-06 | Event data from Wikidata + Wikipedia | Data | MVP | 🟡 |
| F-07 | Unknown-term handling | Web / API | MVP | 🟡 |
| F-08 | Source attribution | All | MVP | ✅ |
| F-09 | Filters and pagination | Web / API | v1 | ✅ |
| F-10 | Loading states and navigation | Web | v1 | ✅ |
| F-11 | Tags and tag timelines | All | v1 | 🟡 |
| F-12 | More term types (empires, wars, people, ideas) | Data | v1 | ⬜ |
| F-13 | Scheduled crawler | Data | v1 | ⬜ |
| F-14 | Related terms | API / Web | v1 | ⬜ |
| F-15 | Event detail view | Web | v1 | ⬜ |
| F-16 | Admin & data-quality tools | Admin | Later | ⬜ |
| F-17 | Compare two timelines | Web | Later | ⬜ |
| F-18 | Map view | Web | Later | ⬜ |
| F-19 | Internationalization (i18n) | All | Later | ⬜ |
| F-20 | Public read API | API | Later | ⬜ |

How the pieces fit together is in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md); details of the app are in the [README](../README.md), and the database in the `history-of-db` repository's README.

---

## Web and API

### F-01: Search
**Phase:** MVP · **Status:** 🟡 Partly done

The search bar sits in the header on every page.

**Done**
- Submitting a query goes to `/search?q=…`. One exact match on name, slug or alias (`USA` → *United States*, `Nippon` → *Japan*) redirects straight to its timeline; otherwise a results list is shown.
- Matching order: exact → prefix → fuzzy (typos, via `pg_trgm`), e.g. `germny` → *Germany*.
- Works without JavaScript: it's a plain `<form method="get" action="/search">`.
- `/search` pages are `noindex` and blocked in `robots.txt`.
- The placeholder and home page say "country", matching what the data covers today.

**Planned**
- Autocomplete suggestions while typing (after 2 characters, debounced, keyboard navigation with ↑ ↓ Enter Esc).
- Tags in results once tag pages exist (F-11).
- Paging for results beyond the top 10.

### F-02: Term timeline page
**Phase:** MVP · **Status:** ✅ Done

URL: `/t/{slug}`, e.g. `/t/japan`.

- A server component loads the page from the database and the browser receives finished HTML, so search engines and shared links get the content without JavaScript.
- The header badge shows the name and the span of its events (e.g. *250 – 2026*), with a short description underneath.
- Events are listed oldest first, 20 per page (F-09).
- Unknown slugs return a real HTTP 404 with a "No history for … yet" page. Uppercase slugs redirect to lowercase.
- Later pages live at `/t/{slug}/{page}` (`/t/japan/2`).
- Cached with ISR: rendered on first request, refreshed in the background every 6 hours (see the README's *Caching (ISR)*).
- If the database is down, the page says so (HTTP 500 with a Try again button; the API and `/health/ready` answer 503).

### F-03: Timeline UI
**Phase:** MVP · **Status:** ✅ Done

- A vertical timeline with a dashed centre line. Events alternate left and right on desktop and stack on the left on phones.
- Each event card shows a round year badge (with *BCE* when needed), a title ribbon, the display date (`14 July 1789`, `1950s`, `12th century`), a two-sentence summary, tag chips and source links.
- Long names in the "The Story of" badge shrink to fit. A name that still needs more than three lines is cut with "…", and the full name shows in a tooltip on hover or keyboard focus.
- Semantic markup: an `<ol>` of `<li><article>` with `<time datetime>`.
- Accessible: visible focus states, readable contrast, animations off under `prefers-reduced-motion`.

**Planned:** era markers (*Ancient*, *Medieval*, …), a dark theme.

### F-04: SEO foundation
**Phase:** MVP · **Status:** ✅ Done

- **Rendering:** every page is server-rendered by Next.js (App Router, React Server Components).
- **Metadata:** a unique `<title>` and `<meta name="description">` per page, e.g. *History of Japan · History Of*. Timeline descriptions name the first and last year on that page (*History of Japan from 1864 to 1970: events 21–40 of 60 …*).
- **Canonical URLs:** unfiltered timeline pages, including later pages (`/t/japan/2`), are canonical to themselves. Filtered views point their canonical at the unfiltered timeline (no `noindex`, so their links still count for the main page). Set `SITE_URL` in production so canonical links use the public origin.
- **Structured data (JSON-LD):** `WebSite` with a `SearchAction` on the home page; `BreadcrumbList` and an `ItemList` of the page's events on timeline pages. Historical events aren't marked up as schema.org `Event`, which is meant for upcoming happenings.
- **Open Graph / Twitter:** `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:locale`, `og:image` (static `public/og-image.png`, 1200×630) and a `summary_large_image` Twitter card.
- **Internal links:** `/countries` lists every timeline A–Z, linked from the home page and the footer.
- **`/sitemap.xml`:** the home page, `/countries` and every term with events and its later pages, each with `<lastmod>` (latest `updated_at` of the term and its events), built from the database.
- **`/robots.txt`:** allows content pages, blocks `/search`, Next's `?_rsc=` payload requests, `/v1/` and `/health`, and links the sitemap.

**Planned:** a sitemap index once there are more than ~50,000 URLs. See the [SEO backlog](#seo-backlog) below for open items.

#### SEO backlog

| Item | Why it matters | Status |
|---|---|---|
| Require `SITE_URL` in production | Without it, request-time pages build canonical links, the sitemap and JSON-LD from the `X-Forwarded-Host` header, which a client can spoof; cached timeline pages fall back to `http://localhost`. Fail at startup (or in CI) when it's missing | ⬜ Deferred |
| Filtered views: pick canonical *or* `noindex` | Sending both is a mixed signal. Kept the canonical to the unfiltered timeline, dropped `noindex` | ✅ Done |
| `/search` in `robots.txt` | `Disallow: /search` stops crawlers from reading the `noindex` on search pages, so an externally linked search URL can be indexed by URL alone. Option: drop the `Disallow` and rely on `noindex` | ⬜ Decision pending |
| `ItemList` URLs | Timeline `ItemList` entries point at Wikipedia, not this site, so they can't earn rich results. Point them at event anchors or event pages once F-15 exists | ⬜ Planned |
| `apple-touch-icon` and web manifest | Only an SVG favicon today; iOS home screens and some crawlers want a PNG icon | ⬜ Planned |
| Per-term share images | One static image for every page today; per-term images would show the country's name and span. Must stay static files (Cloudflare deploy), e.g. generated by a build script | ⬜ Planned |
| ISR for the home page and `/countries` | Still rendered per request: a plain static page would be prerendered by `next build`, which then needs the database | ⬜ Planned |

### F-07: Unknown-term handling
**Phase:** MVP · **Status:** 🟡 Partly done

**Done**
- A search with no matches answers 404 with *"No history for 'X' yet"* and a "← New search" link.
- `/t/{unknown}` answers 404 the same way.

**Planned**
- Offer close matches on the "no results" page.
- Log misses to the `term_requests` table (already in the schema) and queue the most requested ones for crawling (F-13).

### F-08: Source attribution
**Phase:** MVP · **Status:** ✅ Done

- Every event has Wikipedia and Wikidata source links in the database (`event_sources`), shown on each card.
- The site footer credits Wikidata (CC0) and Wikipedia (CC BY-SA 4.0).

### F-09: Filters and pagination
**Phase:** v1 · **Status:** ✅ Done

- **Year range:** *From* and *To* fields, each with a BCE/CE switch. Typing applies after a 400 ms pause.
- **Tags:** toggle chips with counts. An event matches if it has any selected tag. Counts come from the API for the current year range and ignore the tag filter, so choosing one tag doesn't hide the others.
- **Pagination:** 20 events per page, with *‹ Earlier*, page numbers and *Later ›*.
- **All in the URL:** `/t/japan/2?from=660BCE&to=1868&tags=war,treaty` (the page in the path, filters in the query). Shareable and safe to reload. The first HTML is already the filtered page.
- **Filtering happens on the server**, in the same query that backs `GET /v1/terms/:slug/events?from=&to=&tags=&page=&limit=`. Changing a filter resets to page 1 without adding Back-button entries. Changing page adds one, so Back returns to the previous page.
- A page past the end redirects to the last page.

**Planned:** era presets (*Ancient*, *1800s*, *20th century*), a "key events only" toggle using the `importance` score.

### F-10: Loading states and navigation
**Phase:** v1 · **Status:** ✅ Done

- Moving between pages (links, search, Back/Forward) happens without a full reload.
- **Going to another page** shows a skeleton shaped like that page (timeline, results or home) for at least 350 ms.
- **Updating the current page** (filters, pagination): events fade out, a skeleton list shows for at least 350 ms, and the new events fade in. The filter panel stays usable throughout.
- Rapid clicks always end on the last one clicked.
- Getting back to the start: the logo, or "← New search" on results, not-found and unavailable pages.
- A full page reload never shows a skeleton: the server sends finished HTML (see F-02).

### F-11: Tags and tag timelines
**Phase:** v1 · **Status:** 🟡 Partly done

**Done**
- 26 tags assigned from Wikidata event types: war, battle, treaty, revolution, coup, independence, disaster, epidemic, era and more.
- Tag chips on event cards and in the filter panel filter the current timeline.

**Planned**
- `/tag/{slug}` pages, e.g. `/tag/revolution`: events with that tag across **all** terms, each labelled with its country.
- Tag pages in the sitemap, with their own titles (*Revolutions in History · History Of*).
- Curated tag descriptions.

### F-14: Related terms
**Phase:** v1 · **Status:** ⬜ Planned

- A "Related" section on timeline pages, built from shared events (e.g. *France* ↔ *United Kingdom* through *Hundred Years' War*) and Wikidata relations (`P155/P156` follows / followed by, `P1365/P1366` replaces / replaced by).
- Doubles as internal linking for SEO and gives readers somewhere to go next without searching.

### F-15: Event detail view
**Phase:** v1 · **Status:** ⬜ Planned

- Clicking an event opens a side panel (desktop) or sheet (phone) with the full summary, every linked country, tags and sources.
- Optional permalink `/e/{id}-{slug}` for events important enough to rank on their own.

---

## Data

### F-05: Seed terms (countries)
**Phase:** MVP · **Status:** ✅ Done

- `history-of-db/seeds/001_countries.sql`: 196 current sovereign states from Wikidata (UN members plus Palestine, Vatican City, Kosovo and Taiwan, minus the `EXCLUDE` list). Each has a slug, name, description, aliases, Wikidata ID, ISO codes and capital.
- Generated by `history-of-db/scripts/fetch-countries.mjs`. Name fixes and extra aliases live in its `OVERRIDES` table.
- Loading is idempotent: `history-of-db/scripts/migrate.sh --seed` can run again safely.

### F-06: Event data from Wikidata + Wikipedia
**Phase:** MVP · **Status:** 🟡 Partly done

**Done**
- `history-of-db/seeds/002_country_events/<slug>.sql`: about 5,100 events across 191 countries, one self-contained file per country, generated by `history-of-db/scripts/fetch-country-events.mjs`:
  1. Wikidata SPARQL finds items of 41 event types (wars, battles, treaties, revolutions, disasters, epidemics, historical periods, …) linked to each country via `P17` (country) or `P710` (participant). Large types fall back to batches of 40 countries if Wikidata times out.
  2. Each country's `P793` "significant events" are always included.
  3. Dates come with their precision (day / month / year / decade / century / millennium) and BCE support.
  4. Summaries are the first two sentences of the English Wikipedia article.
  5. Up to 60 events per country, ranked by how many Wikipedia language editions cover them.
- Events shared by several countries are stored once and linked to each. Re-running a seed never duplicates events: there's a unique content hash, plus title + year matching.
- `EXCLUDE_TITLE` drops events by title.
- Responses are cached in `history-of-db/.cache/`, so a failed run resumes where it stopped.

**Known gaps**
- Bahamas, Barbados, Samoa, Tuvalu and Zambia have no events yet.
- Shipwrecks are skipped because that Wikidata query keeps timing out.
- Wikidata dates are occasionally wrong (e.g. the Convention of Kanagawa is given as 1864, not 1854).

### F-12: More term types
**Phase:** v1 · **Status:** ⬜ Planned

Empires and dynasties (Roman, Mughal, Ming, Ottoman…), major wars and revolutions as terms of their own, people, inventions and ideas. The schema already supports them (`term_type`); they need seed lists and event linking. The home page notes that only countries are covered so far.

### F-13: Scheduled crawler
**Phase:** v1 · **Status:** ⬜ Planned

- Replace the one-off seed scripts with a scheduled job that refreshes events by staleness and priority, records each run in `crawl_jobs` and updates `terms.last_crawled_at`.
- More sources: Wikipedia "Timeline of X" pages, "History of X" articles, year pages.
- Fill in missing countries and skipped event types.
- Language (Node or Python) is still open.

---

## Later

### F-16: Admin & data-quality tools
- A protected admin UI: browse terms, re-run crawls, merge duplicate events, fix or hide bad events (like wrong Wikidata dates).
- A data-quality dashboard: terms with few events, events without summaries, crawler error rates.

### F-17: Compare two timelines
- `/compare/japan/vs/china`: two parallel timelines on a shared time axis.

### F-18: Map view
- Plot events that have coordinates (`events.location`) on a map, with time scrubbing.

### F-19: Internationalization
- Localized UI and event titles (Wikidata labels are multilingual), with `hreflang` alternates per language.

### F-20: Public read API
- The `/v1` API, documented and rate-limited for third parties, with API keys.

---

## Cross-Cutting Requirements

| Concern | Today | Next |
|---|---|---|
| Performance | Server-rendered HTML; indexed SQL (`sort_key`, `pg_trgm`, GIN); paginated timelines | Response caching (CDN / `Cache-Control`), Core Web Vitals budgets |
| Reliability | API returns 503 when the database is down; pages show a friendly "unavailable" page and the home page still works; seeds are idempotent | Health checks wired into hosting |
| Security | Baseline security headers on every response (`next.config.mjs`), no `X-Powered-By`; parameterized SQL; input validation on every API parameter; self-hosted fonts | Content-Security-Policy (needs nonces for Next's inline scripts); rate limiting |
| Testing | Vitest: unit and component tests, API handler tests with a fake database, integration tests against the real database, and an end-to-end test of `next build` + `next start` | Browser tests (Playwright) for filters and navigation; Lighthouse CI |
| Legal | Sources and licenses shown; Wikipedia text credited under CC BY-SA 4.0 | Honor takedown requests |
