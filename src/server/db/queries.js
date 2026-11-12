// Read queries used by the /v1 routes. Each takes a `db` with a pg-style
// `query(text, params)` method, so tests can pass a fake.

const TERM_COLUMNS = `
  t.slug, t.name, t.type, t.description, t.aliases,
  t.start_year, t.end_year, t.metadata`;

export async function listTerms(db, { type, limit }) {
  const { rows } = await db.query(
    `SELECT t.slug, t.name, t.type,
            (SELECT count(*) FROM event_terms et WHERE et.term_id = t.id)::int AS event_count
     FROM terms t
     WHERE ($1::term_type IS NULL OR t.type = $1::term_type)
     ORDER BY t.name
     LIMIT $2`,
    [type ?? null, limit],
  );
  return rows;
}

// Terms that have events, with when the term or any of its events last
// changed (sitemap <lastmod>).
export async function listSitemapTerms(db) {
  const { rows } = await db.query(
    `SELECT t.slug, count(*)::int AS event_count,
            greatest(t.updated_at, max(e.updated_at)) AS last_modified
     FROM terms t
     JOIN event_terms et ON et.term_id = t.id
     JOIN events e ON e.id = et.event_id
     GROUP BY t.id
     ORDER BY t.slug`,
  );
  return rows;
}

export async function getTerm(db, slug) {
  const { rows } = await db.query(
    `SELECT ${TERM_COLUMNS},
            count(e.id)::int    AS event_count,
            min(e.start_year)   AS first_year,
            max(coalesce(e.end_year, e.start_year)) AS last_year
     FROM terms t
     LEFT JOIN event_terms et ON et.term_id = t.id
     LEFT JOIN events e       ON e.id = et.event_id
     WHERE t.slug = $1
     GROUP BY t.id`,
    [slug],
  );
  return rows[0] ?? null;
}

// Shared WHERE clause for a term's timeline. Params: $1 slug, $2 from, $3 to,
// $4 tags. `from`/`to` bound the start year (negative = BCE); `tags` keeps
// events having at least one of them.
const TIMELINE_FROM = `
     FROM terms t
     JOIN event_terms et ON et.term_id = t.id
     JOIN events e       ON e.id = et.event_id
     WHERE t.slug = $1
       AND ($2::int IS NULL OR e.start_year >= $2)
       AND ($3::int IS NULL OR e.start_year <= $3)`;
const TAG_MATCH = `
       AND ($4::text[] IS NULL OR EXISTS (
             SELECT 1 FROM event_tags x JOIN tags tg ON tg.id = x.tag_id
             WHERE x.event_id = e.id AND tg.slug = ANY($4)))`;

// One page of a term's timeline, oldest first, plus the total match count.
export async function getTermEvents(
  db,
  slug,
  { from = null, to = null, tags = null, limit = 20, offset = 0 } = {},
) {
  const filterParams = [slug, from, to, tags];
  const [page, count] = await Promise.all([
    db.query(
      `SELECT e.id, e.title, e.summary,
              e.start_year, e.start_month, e.start_day,
              e.end_year, e.end_month, e.end_day,
              e.precision, e.display_date, e.importance,
              coalesce(
                (SELECT array_agg(tg.slug ORDER BY tg.slug)
                 FROM event_tags x JOIN tags tg ON tg.id = x.tag_id
                 WHERE x.event_id = e.id),
                '{}') AS tags,
              coalesce(
                (SELECT json_agg(json_build_object('name', s.name, 'url', es.url) ORDER BY s.id)
                 FROM event_sources es JOIN sources s ON s.id = es.source_id
                 WHERE es.event_id = e.id),
                '[]') AS sources
       ${TIMELINE_FROM}${TAG_MATCH}
       ORDER BY e.sort_key, e.id
       LIMIT $5 OFFSET $6`,
      [...filterParams, limit, offset],
    ),
    db.query(`SELECT count(*)::int AS total ${TIMELINE_FROM}${TAG_MATCH}`, filterParams),
  ]);
  return { rows: page.rows, total: count.rows[0]?.total ?? 0 };
}

// Tag counts for the filter chips: events in the year range, ignoring the tag
// filter (so picking one tag doesn't hide the others).
export async function getTermTagFacets(db, slug, { from = null, to = null } = {}) {
  const { rows } = await db.query(
    `SELECT tg.slug AS tag, count(*)::int AS count
     FROM (SELECT e.id ${TIMELINE_FROM}) m
     JOIN event_tags x ON x.event_id = m.id
     JOIN tags tg      ON tg.id = x.tag_id
     GROUP BY tg.slug
     ORDER BY count DESC, tg.slug`,
    [slug, from, to],
  );
  return rows;
}

// Terms matching a free-text query: exact name/slug/alias first, then prefix,
// then fuzzy (pg_trgm) matches on the name.
export async function searchTerms(db, q, limit) {
  const { rows } = await db.query(
    `SELECT t.slug, t.name, t.type,
            CASE
              WHEN lower(t.name) = lower($1) OR t.slug = $2
                   OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE lower(a) = lower($1)) THEN 'exact'
              WHEN t.name ILIKE $3
                   OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE a ILIKE $3) THEN 'prefix'
              ELSE 'fuzzy'
            END AS match,
            similarity(t.name, $1) AS score
     FROM terms t
     WHERE lower(t.name) = lower($1) OR t.slug = $2
        OR t.name ILIKE $3
        OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE a ILIKE $3)
        OR t.name % $1
     ORDER BY CASE
                WHEN lower(t.name) = lower($1) OR t.slug = $2
                     OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE lower(a) = lower($1)) THEN 0
                WHEN t.name ILIKE $3
                     OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE a ILIKE $3) THEN 1
                ELSE 2
              END,
              score DESC, t.name
     LIMIT $4`,
    [q, slugify(q), `${escapeLike(q)}%`, limit],
  );
  return rows.map(({ score: _score, ...r }) => r);
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
