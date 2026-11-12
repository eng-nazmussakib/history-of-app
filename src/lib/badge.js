// Font-size class for the round "Story of" badge, so long names fit without
// breaking mid-word ("Afghanistan", "Liechtenstein", "Central African Republic").
// Tiers are by the longest word (it must fit on one line) and total length.
export function badgeNameClass(name = '') {
  const longestWord = Math.max(0, ...name.split(/\s+/).map((w) => w.length));
  if (longestWord >= 12) return 'story-badge__name is-xxlong';
  if (longestWord >= 10 || name.length > 22) return 'story-badge__name is-xlong';
  if (longestWord >= 8 || name.length > 14) return 'story-badge__name is-long';
  return 'story-badge__name';
}
