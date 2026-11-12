// Display helpers for historical years. Negative numbers are BCE.

export function formatYear(year) {
  if (year == null) return 'Today';
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

// Short label for the round year badge on the timeline.
export function badgeYear(year) {
  return year < 0 ? { value: Math.abs(year), era: 'BCE' } : { value: year, era: null };
}
