# History Of

> Type any term (a country, an empire, a war, a person, an idea) and see its history laid out on a timeline.

**History Of** is a web app for exploring history by search. A visitor types a **term** (e.g. `Japan`, `Ottoman Empire`, `Printing press`) or a **tag** (e.g. `revolution`, `treaty`, `pandemic`). The app pulls the matching events from its database and shows them on an interactive timeline.

This repository is the main app: one **Next.js 16** (App Router) process that serves both the pages and the `/v1` JSON API. Pages don't call the API over HTTP: server components and route handlers share one data layer and read PostgreSQL directly. Seed scripts fill the database ahead of time. They collect, clean and de-duplicate historical events from open knowledge sources.

---

## Documentation

| Document | What it covers |
|---|---|
| **README.md** (this file) | Vision, how the app works, setup, routes, caching, SEO, [features](#features), [open issues](#unresolved-issues) and [deploying to Cloudflare](#deploying-to-cloudflare) |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature-by-feature breakdown (MVP / v1 / later) with what's done and what's planned |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Repositories, data model, API surface, data flow |

### Related repository

| Repository | Role |
|---|---|
| `history-of-db` | PostgreSQL schema (plain SQL migrations), seed data and the scripts that generate it. Its own git repository, checked out next to this one (`../history-of-db`). **Required:** this app reads the database it creates |

---

## The Problem

History about a topic is scattered across encyclopedia articles, "Timeline of X" pages and structured databases. You can't easily:

- see a topic's whole history at a glance, in chronological order;
- jump between related topics (e.g. from *France* to *Napoleonic Wars* to *Battle of Waterloo*);
- view a theme across topics (e.g. every *revolution* between 1700 and 1900).

## The Solution

1. **Search first.** Every page has a search bar over terms (tags are planned).
2. **Timeline second.** Every term has a timeline page, sorted by date, that you can filter by year range and tag.
3. **Data is pre-built, not fetched live.** Seed scripts (later, a crawler) do the slow work offline. Page views only read from the database, so pages load fast and cost little to serve.
4. **Every timeline has its own URL.** Each term gets a shareable, server-rendered page with a canonical URL, structured data and a sitemap entry (see [SEO](#seo)).

---

## Core Concepts

| Concept | Definition | Example |
|---|---|---|
| **Term** | A named entity that has a history | `France`, `Roman Empire`, `Internet` |
| **Tag** | A theme that spans many terms | `war`, `treaty`, `invention`, `independence` |
| **Event** | A dated thing that happened, linked to one or more terms and tagged with zero or more tags | *1789 – Storming of the Bastille* → terms: `France`; tags: `revolution` |
| **Source** | Where an event came from, kept for attribution and trust | Wikidata item, Wikipedia article |
| **Seed list** | The curated list of terms the seed scripts start from | All ISO 3166 countries, later major empires and wars |

One event can belong to many terms. *Treaty of Versailles (1919)* appears on the timelines of `Germany`, `France`, `United Kingdom` and `World War I`.

---

## How It Works

```
┌──────────────┐   fetch / parse    ┌──────────────┐   normalize / dedupe   ┌──────────────┐
│ Open sources │ ─────────────────▶ │ history-of-db│ ─────────────────────▶ │ PostgreSQL   │
│ (Wikidata,   │                    │ scripts/     │   seeds/*.sql          │ terms, tags, │
│  Wikipedia…) │                    │ (crawler     │   + migrate.sh         │ events, srcs │
└──────────────┘                    │  later)      │                        └──────┬───────┘
                                    └──────────────┘                               │ SQL
                                                                     ┌─────────────▼──────────────┐
┌──────────────┐ ──────── GET /t/japan, /v1/… ─────────────────────▶ │ history-of-app (Next.js)   │
│   Browser    │                                                     │ pages + /v1 JSON API       │
│              │ ◀─────────────── HTML / RSC / JSON ──────────────── │                            │
└──────────────┘                                                     └────────────────────────────┘
```

1. **Seed.** A curated list of terms is loaded into the database.
2. **Fetch.** Scripts collect events for each term from Wikidata and Wikipedia (a scheduled crawler is planned).
3. **Normalize.** Dates are parsed (including BCE and fuzzy dates such as "c. 1200"), events are de-duplicated across sources and linked to terms and tags.
4. **Store.** Clean events are written to the database with their source attribution.
5. **Serve.** This app renders `/t/<term>` pages on the server and answers the `/v1` JSON API, both from the same data layer.

---

## Quick Start

Requires Node.js 22.9 or newer and a local PostgreSQL. The database comes from the `history-of-db` repository next to this one:

```bash
# 1. Database. One-time: sudo -u postgres createuser --createdb "$USER"
(cd ../history-of-db && scripts/migrate.sh --seed)   # creates history_of, applies migrations, loads seeds

# 2. App
cp .env.local.example .env.local          # optional; defaults work for local dev
npm install
npm run dev                               # http://localhost:3000/t/japan and /v1/terms/japan
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR on http://localhost:3000 |
| `npm run build` | Production build (Turbopack) into `.next/` |
| `npm start` | Production server on `WEB_PORT` (default 3000) |
| `npm test` | Vitest: unit, component, API, database and end-to-end tests (see [Tests](#tests)) |
| `npm run lint` | Oxlint |
| `npm run preview` | OpenNext build, then run the Worker locally with `wrangler dev` (see [Deploying to Cloudflare](#deploying-to-cloudflare)) |
| `npm run deploy` | OpenNext build, then deploy the Worker to Cloudflare |
| `npm run cf-typegen` | Generate `CloudflareEnv` types for the Worker's bindings |

## Configuration

Copy `.env.local.example` to `.env.local`; Next loads it from this folder. Every real `.env*` file is git-ignored; only the example is committed. Variables already set in the environment win.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql:///history_of?host=/var/run/postgresql` | PostgreSQL connection (local Unix socket as your OS user) |
| `SITE_URL` | the request's host (cached timeline pages: `http://localhost:<WEB_PORT>`) | Public origin for canonical links, `sitemap.xml`, JSON-LD and the share image URL. **Set it in production:** cached pages can't read the request's host, so without it their canonical links point at localhost (a warning is logged) |
| `CORS_ORIGIN` | none | Comma-separated *other* origins allowed to call `/v1` from a browser. The app's own pages are same-origin and don't need it |
| `WEB_PORT` | `3000` | Port for `npm start`. Read by the shell from the environment, not from `.env.local` |

On Cloudflare Workers these come from `wrangler.jsonc` instead: `SITE_URL` is a `vars` entry, and the database is the `HYPERDRIVE` binding (`DATABASE_URL` isn't read there). Variables are read when used, not once at startup, because the Worker's variables reach `process.env` per request.

---

## Tech Stack

### Decided

| Layer | Choice | Notes |
|---|---|---|
| Web + API | **Next.js 16** (App Router), React 19 | Server components render pages; route handlers under `app/v1` serve the JSON API. The search bar, timeline filters and navigation are client components |
| Data access | `pg` with hand-written SQL | `src/server/db/queries.js`, shared by pages and API through `src/server/service.js` |
| Database | **PostgreSQL** with `pg_trgm` and full-text search | Schema and seeds (196 countries, ~5,000 events) in the `history-of-db` repository as plain SQL |
| Styling | Plain CSS (`src/app/globals.css`) | Fonts self-hosted through `next/font` |
| Tests | Vitest | See [Tests](#tests) |

### Not decided yet

| Layer | Current suggestion | Open question |
|---|---|---|
| Language | JavaScript for now | Move to TypeScript? |
| Query layer | Raw SQL | Add a query builder or ORM (Drizzle, Kysely, Knex)? |
| Crawlers | Interim Node seed scripts in `history-of-db/scripts/` (Wikidata + Wikipedia) | A proper scheduled crawler: Python or Node? |
| Scheduling | Cron / GitHub Actions | Something heavier only if needed |
| Caching | CDN in front of the app; Redis optional | — |
| Local dev | Docker Compose | — |

### Why PostgreSQL over a NoSQL store

The core query is *"all events linked to term X (or tag Y), between year A and year B, ordered by date"*. That is a join across a many-to-many relationship plus a range scan, which a relational database with the right indexes does very well. PostgreSQL also covers the extras without another service:

- **Search and autocomplete:** `tsvector` full-text search plus `pg_trgm` for typo-tolerant prefix matching.
- **Flexible metadata:** `JSONB` columns for source-specific fields that don't deserve their own column.
- **Integrity:** foreign keys and unique constraints stop duplicate events and orphaned links.

A document database (e.g. MongoDB) would store "one document per term" easily. But shared events would be duplicated in every term that contains them, and tag queries across terms would be costly. A dedicated search engine (Meilisearch or Typesense) can be added later if search needs grow past what Postgres offers.

---

## Routes

### Pages

| URL | Page | Status |
|---|---|---|
| `/` | Search prompt and the countries with the most events | 200 (still 200 without suggestions if the database is down) |
| `/countries` | Every country with a timeline, A–Z (linked from the home page and the footer) | 200 |
| `/t/:slug`, `/t/:slug/:page` + `?from=&to=&tags=` | A term's timeline, filtered and paged on the server. ISR-cached (see [Caching (ISR)](#caching-isr)) | 200 · 404 unknown term or bad page · 307 to lowercase slug · 307 to the last page when past the end · 308 `/t/:slug/1` → `/t/:slug`. `?page=` is not a parameter (ignored; canonical stays `/t/:slug`) |
| `/search?q=` | One exact match redirects to its timeline; otherwise a results list | 307 · 200 · 404 no matches |
| `/robots.txt`, `/sitemap.xml` | Search engine files | 200 · sitemap 503 + `Retry-After` if the database is down |
| anything else | Not found | 404 |

### API

Endpoints (JSON, read-only):

| Method | Path |
|---|---|
| GET | `/health`, `/health/ready` |
| GET | `/v1` |
| GET | `/v1/terms?type=&limit=` |
| GET | `/v1/terms/:slug` |
| GET | `/v1/terms/:slug/events?from=&to=&tags=&page=&limit=` |
| GET | `/v1/search?q=&limit=` |

Unknown `/v1/*` paths return the API's JSON 404, not the HTML page. Errors look like `{ "error": { "status": 404, "message": "No term 'atlantis'" } }`, and a database that can't be reached is a 503.

## How it fits together

```
                       ┌────────────── Next.js (one process) ───────────────┐
GET /t/japan?tags=war  │ app/t/[slug]/[view]/       app/v1/**/route.js      │
GET /v1/terms/japan/…  │   server components          route handlers        │
                       │        │ server/data.js        │ server/api/        │
                       │        │ (React cache())       │ (validation, JSON  │
                       │        ▼                       ▼  errors, CORS)      │
                       │            server/service.js                       │
                       │            server/db/queries.js ── pg pool ────────┼──▶ PostgreSQL
                       └────────────────────────────────────────────────────┘
```

- **`server/service.js`** holds the read operations and returns the public JSON shapes. The `/v1` handlers and the pages both use it, so the pages and the API can't drift apart.
- **`server/data.js`** wraps the service for server components with React `cache()`, so `generateMetadata`, the page and the header slot share one query per request.
- **`app/@header`** is a parallel route slot. Each route renders the site header with its own search query (the term's *name* on a timeline, `q` on search results), so the server HTML already has the right value in the box. If no route matches at all, the layout falls back to an empty header.
- **No `loading.js` anywhere, on purpose.** A `loading.js` fallback makes Next start streaming before the page has run, which fixes the status at 200, so unknown terms couldn't answer 404 and redirects couldn't be real redirects. Without it, the first HTML waits for the data.

## Caching (ISR)

Timeline pages are **ISR** (Incremental Static Regeneration): the first request for a URL renders it on the server and stores the HTML and RSC payload; later requests get the stored copy (`x-nextjs-cache: HIT`, `Cache-Control: s-maxage=21600, stale-while-revalidate`). After 6 hours (`revalidate = 21600`) the next request still gets the stored copy while a fresh one renders in the background. Nothing is prerendered by `next build` (`generateStaticParams` returns `[]`), so builds don't need the database.

A cached page can't read `searchParams` or request headers, so:

- **URLs are rewritten in `next.config.mjs`.** `/t/japan/2?from=1900&tags=war` is served by `app/t/[slug]/[view]` with `view = "2~from=1900&tags=war"` (`lib/filters.js` → `viewFromSegment`). Each filter combination is one cache entry; other query parameters (`utm_*`, `fbclid`, …) are ignored and share the unfiltered entry. One route for every page and filter also means the timeline stays mounted while you page or filter, so its fade animations keep working. These are plain config rewrites, not `proxy.js`, because OpenNext for Cloudflare doesn't support Next 16's Node-runtime proxy yet.
- **Absolute URLs come from `SITE_URL`** (`getStaticOrigin()`), not the request's host.
- **Database outages:** pages already in the cache keep being served (stale). An uncached page answers 500 with `no-store`, so the error isn't cached.
- **Redirects are cached too.** `redirect()` from an ISR page (uppercase slug, past the last page) is stored as a 307. Next sends the `Location` header twice, with the same value, on the first uncached render; browsers accept identical copies.

The home page, `/countries`, `/search`, `robots.txt`, `sitemap.xml` and the API render per request.

**On Cloudflare (OpenNext),** ISR needs an incremental cache binding (R2 or KV) and the revalidation queue configured in `open-next.config.ts`; without it, pages can't be stored.

## Loading and navigation

`src/navigation/NavigationProvider.jsx` adds visible loading states on top of Next's router:

- Another page or filter of the same timeline (`/t/japan` → `/t/japan/2?tags=war`) counts as the same view (`viewPath()`), so it updates in place.
- Same-origin `<a>` clicks anywhere are intercepted and become `router.push` calls inside a React transition. Server components keep using plain links, which also work without JavaScript.
- **Going to another page** shows a skeleton shaped like the target page (`PageShell` + `PageSkeleton`) for at least 350 ms.
- **Updating the current page** (filters, pagination): events fade out (300 ms), a skeleton list shows for at least 350 ms, then the new events fade in. Next commits the new page as soon as the server sends it, so `Timeline` keeps showing the previous page until the loading state ends.
- Filter changes replace the URL (no Back-button entries). Page changes push one. Back/Forward re-sync the filter inputs.
- Rapid clicks end on the last one.

Timings are `FADE_OUT_MS` and `SKELETON_MIN_MS` in `NavigationProvider.jsx`.

## SEO

- Per-page `generateMetadata`: title, description, canonical, Open Graph and Twitter tags. Filtered timelines have a canonical link to the unfiltered timeline (no `noindex`: the two together are a mixed signal).
- Timeline descriptions name the years of that page's first and last events, so each page has its own: *History of Japan from 1864 to 1970: events 21–40 of 60 on a timeline, with dates and sources. Island country in East Asia.*
- Pagination is in the path (`/t/japan/2`); page 1 is `/t/japan`.
- Share image: a static `public/og-image.png` (1200×630) on every page, as `og:image` and a `summary_large_image` Twitter card. `metadataBase` (from `SITE_URL`) makes its URL absolute.
- JSON-LD: `WebSite` + `SearchAction` on home; `BreadcrumbList` + `ItemList` on timelines; `BreadcrumbList` on `/countries`.
- Internal links: `/countries` lists every timeline and is linked from the home page and the footer, so crawlers reach every term without the sitemap.
- `sitemap.xml`: home, `/countries` and every page of every term with events, each with `<lastmod>` (when the term or one of its events last changed).
- `robots.txt` blocks `/search`, Next's `?_rsc=` payload requests, `/v1/` and `/health`, and links the sitemap.
- Open items are tracked in [docs/FEATURES.md](docs/FEATURES.md#seo-backlog).
- Fonts (Arvo, Bree Serif, Squada One) are self-hosted through `next/font`, so there are no Google Fonts requests at runtime.
- Baseline security headers on every response (`next.config.mjs`); no `X-Powered-By`.

## Features

What the app does today. Items marked **(new)** came with the move to Next.js caching and the SEO pass.

**Pages and navigation**
- Search bar in the header on every page: one exact match (name, slug or alias such as `USA`) goes straight to the timeline; otherwise a results list, or a 404 "No history for …" page. Works without JavaScript.
- Term timelines: server-rendered, 20 events per page, oldest first, alternating cards with year badges, tags and source links.
- Year-range and tag filters in the query string (`?from=1900&tags=war`); the first HTML is already filtered.
- **(new)** Pagination in the path: `/t/japan`, `/t/japan/2`, `/t/japan/2?tags=war`. `/t/japan/1` redirects to `/t/japan`.
- **(new)** `/countries`: every country with a timeline, A–Z, linked from the home page and the footer.
- In-place loading for page and filter changes (fade out, skeleton, fade in); skeletons shaped like the target page for other navigations.

**Caching**
- **(new)** Timeline pages are ISR: rendered on first request, cached, refreshed in the background every 6 hours; CDN-cacheable `Cache-Control`. Builds don't need the database.
- **(new)** Filters are folded into the cached route's path by `next.config.mjs` rewrites (no `proxy.js`, for Cloudflare). Tracking parameters (`utm_*`, `fbclid`) share the unfiltered cache entry.
- **(new)** Database outages: cached timelines keep being served; uncached ones answer 500 without being cached.

**SEO**
- Unique titles; canonical links; JSON-LD (`WebSite` + `SearchAction`, `BreadcrumbList`, `ItemList`); `robots.txt`; sitemap; self-hosted fonts; security headers.
- **(new)** Static share image (`public/og-image.png`, 1200×630) on every page: `og:image`, `summary_large_image` Twitter card, `og:locale`.
- **(new)** Per-page meta descriptions with that page's first and last year (*History of Japan from 1864 to 1970: events 21–40 of 60 …*).
- **(new)** Sitemap includes `/countries` and path-based pages, each with `<lastmod>` from the database.
- **(new)** Filtered views: canonical to the unfiltered timeline only (no `noindex`).

**API**
- Read-only `/v1` JSON API from the same process and data layer as the pages; JSON errors; 503 when the database is down; CORS only for listed origins.

## Unresolved Issues

Known gaps and quirks. SEO items are also tracked in the [SEO backlog](docs/FEATURES.md#seo-backlog).

| Issue | Impact | What to do |
|---|---|---|
| `SITE_URL` isn't enforced | Without it, cached pages put `http://localhost` in canonical links, JSON-LD and the share image URL (a warning is logged); request-time pages trust the `X-Forwarded-Host` header | Set it in every deployment; make startup or CI fail when it's missing |
| Duplicate `Location` header | The first (uncached) render of an ISR redirect (uppercase slug, page past the end) sends `Location` twice with the same value. Browsers accept it | Re-check behind Cloudflare; report upstream if it causes trouble |
| Redirects and 404s are cached for 6 hours | If a term is added or grows, a cached 404 or "past the last page" redirect can linger until revalidation | On-demand revalidation after re-seeding (see below) |
| Filter combinations each get a cache entry | Arbitrary year ranges can grow the cache without bound | Watch cache size; consider bucketing years or not caching rare combinations |
| Home page and `/countries` render per request | Slower and costlier than the cached timelines | ISR them once builds can reach the database, or cache them at the CDN |
| Page answers 500 (not 503) when the database is down | Crawlers treat both as temporary, but 503 + `Retry-After` is the clearer signal | Next limitation for pages; the API and `/health/ready` already answer 503 |
| 404 page body renders in the browser | Status and `noindex` are correct; the "No history for …" text isn't in the HTML | Next limitation (`notFound()` in dynamic pages) |
| `/search` is blocked in `robots.txt` and also `noindex` | Crawlers can't see the `noindex`; a linked search URL could be indexed by URL alone | Decide: drop the `Disallow`, or keep it |
| `ItemList` entries link to Wikipedia | No rich results for timeline lists | Point them at event pages once they exist (F-15) |
| No `apple-touch-icon` or web manifest; one share image for all pages | iOS home screen and per-term link previews | Add PNG icons; generate per-term images as static files at build time |

## Deploying to Cloudflare

Production runs on Cloudflare Workers through OpenNext (`@opennextjs/cloudflare`). Cloudflare builds from this repository with **build command** `npx opennextjs-cloudflare build` and **deploy command** `npx opennextjs-cloudflare deploy` (Worker settings → Build). Locally, `npm run deploy` does the same.

**1. Adapter (done)**
- `wrangler.jsonc` (Worker `history-of-app`, `nodejs_compat`, `SITE_URL`, bindings) and `open-next.config.ts`.
- Routing stays in `next.config.mjs`. Don't add `proxy.js`: OpenNext doesn't support Next 16's Node-runtime proxy yet.

**2. Database: Hyperdrive (done)**
- PostgreSQL is on Neon. The Worker reaches it through the Hyperdrive config `history-of-db` (binding `HYPERDRIVE` in `wrangler.jsonc`), created from Neon's *direct* (unpooled) URL, since Hyperdrive does its own pooling:
  `npx wrangler hyperdrive create history-of-db --connection-string="<DATABASE_URL_UNPOOLED>"`
- `src/server/db/pool.js`: on Workers (an OpenNext context with `HYPERDRIVE`), each query opens a `pg.Client` from `env.HYPERDRIVE.connectionString` and closes it. A Worker can't reuse a socket across requests, so the process-wide pool is only used on Node (`next dev`, `next start`, tests).
- If the Neon password changes: `npx wrangler hyperdrive update <id> --connection-string="<new URL>"`.
- Schema and seeds: `../history-of-db/neon/setup.sh --seed` against Neon.
- `npm run preview` runs the Worker in workerd, which can't use the local Unix socket: set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` to a TCP connection string (or edit `localConnectionString`; don't commit credentials).

**3. ISR cache (done)**
- `open-next.config.ts` stores cached pages in the R2 bucket `history-of-app-opennext-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`) and regenerates stale ones in the background through a Durable Object queue (`NEXT_CACHE_DO_QUEUE`, class `DOQueueHandler`, plus `WORKER_SELF_REFERENCE`).
- Create the bucket once before the first deploy: `npx wrangler r2 bucket create history-of-app-opennext-cache`.
- No tag cache: it's only needed if you add `revalidatePath` / `revalidateTag`.

**4. Environment**
- `SITE_URL` is set in `wrangler.jsonc` (`vars`). `keep_vars` keeps anything added in the dashboard across deploys.
- `CORS_ORIGIN` only if other sites call `/v1`. `WEB_PORT` and `DATABASE_URL` aren't used on Workers.

**5. Check after the first deploy**

| URL | Expect |
|---|---|
| `/t/japan` (twice) | 200; second response served from the cache (`x-nextjs-cache: HIT` or equivalent) |
| `/t/japan/2`, `/t/japan?tags=war`, `/t/japan/2?from=1900&tags=war` | 200, correct page and filters |
| `/t/japan/1` | 308 → `/t/japan` |
| `/t/Japan`, `/t/japan/99` | 307 → `/t/japan`, `/t/japan/3`, with a single `Location` header |
| `/t/atlantis`, `/t/japan/abc` | 404 |
| `/countries`, `/search?q=uni` | 200 |
| `/og-image.png`, `/robots.txt`, `/sitemap.xml` | 200; URLs use `SITE_URL` |
| `/v1/terms/japan`, `/health/ready` | 200 JSON |
| Any page | Security headers present, no `X-Powered-By` |

Also share a timeline link in a social-card validator to see the image, and view source on a timeline to confirm the canonical uses your domain.

**6. After re-seeding the database**
- Cached timelines refresh within 6 hours. For an immediate refresh, add an on-demand revalidation endpoint (a route handler that checks a secret and calls `revalidatePath('/t/[slug]/[view]', 'page')`), which also needs the tag cache from step 3. Purge the Cloudflare CDN cache too if you added cache rules.

**7. Search engines**
- Submit `https://<your domain>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Tests

`npm test` (Vitest, `vitest.config.mjs`):

| File | What it covers |
|---|---|
| `test/filters.test.js`, `test/lib.test.js`, `test/components.test.jsx` | URL ↔ filter helpers, dates, pagination, robots.txt and sitemap text, and the server-rendered components |
| `test/api.test.js` | `/health` and `/v1` handlers with a fake database: validation, SQL parameters, response shapes, 404/503/500 errors |
| `test/pool.test.js` | `sslmode` pinning, and `getDb()`: shared pool on Node, one Hyperdrive client per query on Workers (closed after success or failure) |
| `test/db.integration.test.js` | The same handlers against the real seeded database; skipped if it can't connect |
| `test/server.test.js` | Runs `next build`, starts `next start` against the real database and against a dead one, and checks pages, status codes, redirects, head tags, ISR caching, header search value, RSC requests, API, CORS, robots/sitemap, the share image and security headers; skipped without the database |

## Layout

```
history-of-app/
├── README.md
├── .env.local.example         # DATABASE_URL, SITE_URL, CORS_ORIGIN, WEB_PORT (copy to .env.local)
├── docs/                      # FEATURES.md, PROJECT_STRUCTURE.md
├── next.config.mjs            # Timeline rewrites/redirects (ISR), security headers
├── wrangler.jsonc             # Cloudflare Worker: name, SITE_URL, Hyperdrive binding
├── open-next.config.ts        # OpenNext adapter (cache overrides go here)
├── vitest.config.mjs
├── public/                    # favicon.svg, og-image.png (share image)
├── test/
└── src/
    ├── app/
    │   ├── layout.jsx         # <html>, fonts, NavigationProvider, header slot, footer
    │   ├── @header/           # Header per route: page.jsx, t/[slug]/[view], search, countries, default.jsx
    │   ├── page.jsx           # Home
    │   ├── t/[slug]/[view]/   # page.jsx (timeline, ISR), not-found.jsx
    │   ├── countries/         # page.jsx (A–Z index of every timeline)
    │   ├── search/            # page.jsx (results / redirect), not-found.jsx
    │   ├── not-found.jsx, error.jsx, global-error.jsx
    │   ├── robots.txt/route.js, sitemap.xml/route.js
    │   ├── health/route.js, health/ready/route.js
    │   └── v1/                # route.js, terms/…, search/, [...path]/ (JSON 404)
    ├── components/            # SiteHeader, SearchBar, Timeline, Pagination, JsonLd, MissedQuery, …
    ├── navigation/            # NavigationProvider: transitions, skeleton timing, link interception
    ├── hooks/, lib/           # Pure helpers shared by server and client (filters, dates, SEO files)
    └── server/                # Server-only
        ├── config.js
        ├── data.js            # Cached page data, origin
        ├── service.js         # Read operations → JSON shapes (pages + API)
        ├── db/                # pool.js, queries.js (SQL)
        └── api/               # handlers.js, route.js (wrapper), params.js, serialize.js, errors.js
```

`AGENTS.md` is generated by `next dev` (it points coding agents at the bundled Next docs).

---

## Goals

- **Fast:** term pages and API responses are cached so timelines load quickly.
- **Discoverable:** every term and tag page can be indexed, with a canonical URL, structured data and a sitemap entry.
- **Trustworthy:** every event links to its source(s); content licenses (e.g. CC BY-SA) are attributed.
- **Extensible:** a new data source is a new crawler module, with no changes to the API or pages.
- **Cheap to run:** read-heavy design that runs on a small VPS or free tiers.

## Non-Goals (for now)

- User accounts, user-submitted content or editing.
- Live crawling when a user searches. Unknown terms are queued for crawling instead (see [FEATURES.md](docs/FEATURES.md#f-07-unknown-term-handling)).
- Original historical scholarship. The app aggregates and organizes existing open data.

## Roadmap Summary

| Phase | Outcome |
|---|---|
| **MVP** | Search bar, term timeline pages, ~250 country terms, Wikidata crawler, SEO basics |
| **v1** | Tags and tag timelines, era zoom and filters, Wikipedia "Timeline of" crawler, related terms, scheduled re-crawls |
| **Later** | Compare two timelines, map view, multiple languages, admin review queue, public API |

See [docs/FEATURES.md](docs/FEATURES.md) for the full breakdown.

## License & Attribution

Code license: *to be decided* (MIT suggested).
Content comes from third-party sources and keeps their licenses. Wikipedia text is CC BY-SA 4.0 and Wikidata is CC0. Attribution appears on every timeline page.
