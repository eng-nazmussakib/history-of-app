# Project Structure

History Of is two git repositories, checked out side by side in one folder:

| Repository | Language | Role |
|---|---|---|
| `history-of-app` (this one) | JavaScript (Next.js 16, React 19, `pg`) | Server-rendered search and timeline pages **and** the read-only `/v1` JSON API, in one process |
| `history-of-db` | SQL + Node scripts | Schema migrations, seed data and the scripts that generate it |

Each has its own `.env.local.example` and `.gitignore`.

---

## Directory Layout

```
history-of/                         # Not a repository: just holds the two checkouts
├── history-of-app/                 # ── App (git repo) ──
│   ├── README.md                   # Project overview + app details
│   ├── .env.local.example          # DATABASE_URL, SITE_URL, CORS_ORIGIN, WEB_PORT
│   ├── docs/
│   │   ├── FEATURES.md             # Feature breakdown
│   │   └── PROJECT_STRUCTURE.md    # This file
│   ├── next.config.mjs             # Timeline rewrites/redirects (ISR), security headers
│   ├── public/                     # favicon.svg, og-image.png
│   ├── test/                       # Vitest: unit, component, API, DB integration, end-to-end
│   └── src/
│       ├── app/                    # Routes: /, /t/[slug]/[view] (ISR), /countries, /search, @header slot, robots.txt, sitemap.xml, health, v1/**
│       ├── components/             # SiteHeader, SearchBar, Timeline, TimelineEvent, TimelineFilters, JsonLd, …
│       ├── navigation/             # NavigationProvider: transitions, skeleton timing, link interception
│       ├── hooks/                  # useDebounced, useIsTruncated
│       ├── lib/                    # filters.js, dates.js, pagination.js, seo-files.js, site.js
│       └── server/                 # Server-only: config, data.js (cached), service.js, db/, api/
│
└── history-of-db/                  # ── Database (git repo) ──
    ├── .env.local.example          # DATABASE_URL
    ├── migrations/                 # 001_initial_schema.sql, 002_terms_metadata.sql
    ├── seeds/                      # Loaded in name order
    │   ├── 001_countries.sql       # 196 country terms
    │   └── 002_country_events/     # <slug>.sql per country + README.md with counts
    └── scripts/
        ├── migrate.sh              # Create DB, apply migrations, run seeds
        ├── fetch-countries.mjs     # Wikidata → 001_countries.sql
        └── fetch-country-events.mjs  # Wikidata + Wikipedia → 002_country_events/
```

### Not built yet

- **Crawler:** a scheduled job that refreshes events and adds new terms. The `history-of-db/scripts/fetch-*.mjs` generators fill this role for now.
- **Tag pages:** `/tag/<tag>` timelines across terms.
- **More term types:** empires, wars, people and ideas (only countries today).

---

## Data Model (PostgreSQL)

The schema lives in `migrations/` in the `history-of-db` repository and is described in its README. Overview:

```
┌────────────┐      ┌───────────────┐      ┌────────────┐
│   terms    │──┐   │  event_terms  │   ┌──│   events   │
├────────────┤  └──▶│ event_id  FK  │◀──┘  ├────────────┤
│ id         │      │ term_id   FK  │      │ id         │
│ slug  UQ   │      │ relevance     │      │ title      │
│ name       │      │ is_primary    │      │ summary    │
│ type       │      └───────────────┘      │ start_year │──┐ integer, negative = BCE
│ description│                             │ start_month│  │
│ aliases[]  │      ┌───────────────┐      │ start_day  │  │
│ wikidata_id│      │  event_tags   │      │ end_year…  │  │
│ start_year │      │ event_id  FK  │◀─────│ precision  │  │ day|month|year|decade|century
│ end_year   │      │ tag_id    FK  │      │ display_date│ │ "c. 1200 BCE"
│ image_url  │      └───────┬───────┘      │ importance │  │ 0–100
│ search_tsv │              │              │ location   │  │ JSONB {name, lat, lon}
│ last_crawled_at│          │              │ content_hash UQ
│ crawl_priority │  ┌───────▼───────┐      │ metadata   │  JSONB
└────────────┘      │     tags      │      └─────┬──────┘
                    ├───────────────┤            │
                    │ id, slug UQ   │      ┌─────▼──────────┐      ┌────────────┐
                    │ name          │      │ event_sources  │─────▶│  sources   │
                    │ description   │      │ event_id, source_id │ ├────────────┤
                    └───────────────┘      │ url, retrieved_at  │ │ id, name   │
                                           └────────────────┘      │ license    │
┌──────────────┐    ┌───────────────┐                              │ base_url   │
│  crawl_jobs  │    │ term_requests │                              └────────────┘
├──────────────┤    ├───────────────┤
│ id, term_id  │    │ query  UQ     │
│ source       │    │ count         │
│ status       │    │ last_seen_at  │
│ started/finished_at │ resolved_term_id │
│ stats JSONB, error  └───────────────┘
└──────────────┘
```

### Key modeling choices

- **Dates are integers, not `DATE`.** PostgreSQL's `DATE` type can't go before 4713 BCE and can't express "12th century". The model stores `start_year` (negative for BCE), optional month and day, a `precision` enum and a pre-formatted `display_date`. A generated `sort_key` column (`start_year * 10000 + coalesce(month,0) * 100 + coalesce(day,0)`) gives a single sortable index.
- **Events ↔ terms is many-to-many.** A shared event is stored once and appears on every related timeline. `is_primary` marks which term an event is "mainly about" (used for labels on tag pages).
- **`content_hash` unique constraint** guards against duplicate inserts when the same crawl runs twice.
- **`aliases` + `search_tsv`** power autocomplete through a GIN index on `search_tsv` and a `pg_trgm` index on `name`.

`terms` also has a `metadata` JSONB column (ISO codes and capital for countries), and the database keeps a `schema_migrations` table for `migrate.sh`.

### Important indexes

```sql
CREATE INDEX ON event_terms (term_id, event_id);
CREATE INDEX ON events (sort_key);
CREATE INDEX ON event_tags (tag_id, event_id);
CREATE INDEX terms_name_trgm ON terms USING gin (name gin_trgm_ops);
CREATE INDEX terms_search ON terms USING gin (search_tsv);
```

---

## API Surface

Implemented by the route handlers under `src/app/v1/` (see [Routes](../README.md#routes)):

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/health/ready` | Liveness; readiness (database reachable) |
| GET | `/v1/search?q=&limit=` | Terms by name, slug or alias: exact, then prefix, then fuzzy |
| GET | `/v1/terms?type=&limit=` | List terms |
| GET | `/v1/terms/{slug}` | Term details + event count + date span |
| GET | `/v1/terms/{slug}/events?from=&to=&tags=&page=&limit=` | One page of timeline events, oldest first, with totals and tag counts |

Planned:

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/terms/{slug}/related` | Related terms |
| GET | `/v1/tags`, `/v1/tags/{slug}/events` | Tags and cross-term tag timelines |
| GET | `/v1/events/{id}` | Single event with all terms, tags, sources |
| — | Cursor pagination on `/events` | Page numbers (offset) are fine at today's sizes; switch if a term reaches thousands of events |

Example response, `GET /v1/terms/japan/events?tags=battle` (shortened):

```json
{
  "term": { "slug": "japan", "name": "Japan", "type": "country", "eventCount": 60, "span": { "from": 250, "to": 2026 } },
  "filters": { "from": null, "to": null, "tags": ["battle"] },
  "events": [
    {
      "id": 18233,
      "title": "Battle of Sekigahara",
      "summary": "The Battle of Sekigahara was an important battle in Japan…",
      "year": 1600,
      "start": { "year": 1600, "month": 10, "day": 21, "precision": "day" },
      "end": null,
      "displayDate": "21 October 1600",
      "importance": 74,
      "tags": ["battle"],
      "sources": [{ "name": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Battle_of_Sekigahara" }]
    }
  ]
}
```

---

## Data Flow

### Seed path (today)

```
history-of-db/scripts/fetch-*.mjs ──▶ Wikidata SPARQL + API, Wikipedia API (cached in history-of-db/.cache/)
   │
   ▼
history-of-db/seeds/*.sql  (generated, committed)
   │
   ▼
history-of-db/scripts/migrate.sh --seed ──▶ PostgreSQL
```

### Request path

```
Browser ── GET /t/japan?tags=war ──▶ next.config.mjs rewrite → app/t/[slug]/[view] (view "1~tags=war")
                                        │ ISR cache hit? → stored HTML. Otherwise render:
                                        │ server/data.js → server/service.js → server/db/queries.js
                                        ▼
                                   PostgreSQL
                                        │
Browser ◀── HTML (already filtered) ────┘ hydrates; filter and page changes update the
                                          URL and fetch the new page in place

Client ── GET /v1/terms/japan/events ──▶ app/v1/**/route.js → server/api/ → server/service.js (same data layer)
```

Later link clicks and searches fetch Next's RSC payload (`?_rsc=…`) and re-render without a full page load. See [Loading and navigation](../README.md#loading-and-navigation) for how filters, pagination and loading states work.

---

## Environment Configuration

Each repository has its own `.env.local.example` (copy it to `.env.local`; every real `.env*` file is git-ignored). Who reads what:

| Variable | Used by | Default |
|---|---|---|
| `DATABASE_URL` | `history-of-app`, `history-of-db/scripts/migrate.sh` | `postgresql:///history_of?host=/var/run/postgresql` |
| `SITE_URL` | `history-of-app` (canonical links, sitemap, JSON-LD, share image) | the request's origin; `http://localhost:<WEB_PORT>` on cached pages |
| `CORS_ORIGIN` | `history-of-app` (other origins calling `/v1`) | none |
| `WEB_PORT` | `history-of-app` (`npm start`) | `3000` |

---

## Conventions

| Area | Convention |
|---|---|
| JavaScript | ES modules, Oxlint (`npm run lint`) |
| Tests | `history-of-app`: Vitest unit/component tests, API handler tests with a fake database, integration tests against the seeded database and an end-to-end test of `next build` + `next start`. |
| Migrations | Every schema change is a new numbered file in `history-of-db/migrations/`; never edit one that has been applied (`migrate.sh` checks checksums) |
| Seeds | Numbered like migrations; a numbered folder runs every `.sql` file inside it. Generated seeds are never edited by hand |
| Slugs | lowercase, ASCII, hyphenated (`ottoman-empire`); never change a published slug, add a redirect instead |
| Commits | Conventional Commits (`feat(api): add terms endpoint`) |
