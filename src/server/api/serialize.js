// Database rows → public JSON shapes (camelCase, nested dates).

const date = (year, month, day) => (year == null ? null : { year, month: month ?? null, day: day ?? null });

export function serializeTerm(row) {
  return {
    slug: row.slug,
    name: row.name,
    type: row.type,
    description: row.description ?? null,
    aliases: row.aliases ?? [],
    startYear: row.start_year ?? null,
    endYear: row.end_year ?? null,
    metadata: row.metadata ?? {},
    eventCount: row.event_count ?? 0,
    // Span of the events on the timeline (may differ from the term's own years).
    span: row.first_year == null ? null : { from: row.first_year, to: row.last_year },
  };
}

export function serializeEvent(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? null,
    year: row.start_year,
    start: { ...date(row.start_year, row.start_month, row.start_day), precision: row.precision },
    end: date(row.end_year, row.end_month, row.end_day),
    displayDate: row.display_date ?? String(row.start_year),
    importance: row.importance,
    tags: row.tags ?? [],
    sources: row.sources ?? [],
  };
}
