// Which page numbers to show. null marks a gap ("…").
// 1 … 4 5 [6] 7 8 … 12 — the first, last and a window around the current page.
export function pageList(page, totalPages, around = 1) {
  const pages = new Set([1, totalPages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}
