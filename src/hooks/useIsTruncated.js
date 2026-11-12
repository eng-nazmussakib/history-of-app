import { useLayoutEffect, useState } from 'react';

// True when the element's text is clipped by its line clamp. Re-checked when
// the text changes, the element resizes, or web fonts finish loading.
export default function useIsTruncated(ref, text) {
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Glyphs can overhang a tight line-height by a few pixels; only count it
    // as truncated when at least half a line is hidden.
    const check = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      setTruncated(el.scrollHeight - el.clientHeight > lineHeight / 2);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [ref, text]);

  return truncated;
}
