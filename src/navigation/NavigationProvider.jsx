'use client';

// Client-side navigation with visible loading states, on top of Next's router.
//
// - navigate(href) pushes (or replaces) the URL inside a transition, so React
//   keeps the current page until the server has rendered the new one.
// - While it's pending, `pending` = { href, path, inPlace } tells PageShell to
//   show a skeleton of the target page, or (inPlace: same view, e.g. another
//   page or filter of the same timeline) tells the timeline to fade its events
//   out and show a skeleton list. `path` is the view: /t/japan for /t/japan/2.
// - The loading state stays up for a minimum time (FADE_OUT_MS + SKELETON_MIN_MS)
//   so it reads as a deliberate step, not a flicker.
// - Same-origin <a> clicks anywhere in the page become navigate() calls, so
//   server components can use plain links that also work without JavaScript.
// - Rapid clicks always end on the last one: older navigations are dropped.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export const FADE_OUT_MS = 300;
export const SKELETON_MIN_MS = 350;

const NavigationContext = createContext({ pending: null, navigate: () => Promise.resolve() });

export const useNavigation = () => use(NavigationContext);

// The view a pathname belongs to: a timeline's pages share one (/t/japan/2 → /t/japan).
export const viewPath = (pathname) => pathname.match(/^\/t\/[^/]+(?=\/\d+\/?$|\/?$)/)?.[0] ?? pathname;
export const usePendingNavigation = () => use(NavigationContext).pending;

export default function NavigationProvider({ children }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState(null);
  // The navigation in flight: { id, href, path, inPlace, scroll, startedAt, resolvers }.
  const current = useRef(null);

  const navigate = useCallback(
    (href, { replace = false, scroll = !replace } = {}) => {
      const url = new URL(href, window.location.href);
      const target = url.pathname + url.search;
      const path = viewPath(url.pathname);
      const inPlace = path === viewPath(window.location.pathname);
      // A newer navigation supersedes an older one; both callers resolve when it ends.
      const resolvers = current.current?.resolvers ?? [];
      const promise = new Promise((resolve) => resolvers.push(resolve));
      const nav = { href: target, path, inPlace, scroll, startedAt: performance.now(), resolvers };
      current.current = nav;

      setPending({ href: target, path, inPlace });
      if (inPlace && scroll) document.querySelector('[data-scroll-anchor]')?.scrollIntoView({ block: 'start' });
      startTransition(() => {
        router[replace ? 'replace' : 'push'](target + url.hash, { scroll: false });
      });
      return promise;
    },
    [router],
  );

  // The transition ended (the new page is committed): hold the loading state
  // for what's left of the minimum, then reveal the page.
  useEffect(() => {
    const nav = current.current;
    if (isPending || !nav) return undefined;
    const minimum = (nav.inPlace ? FADE_OUT_MS : 0) + SKELETON_MIN_MS;
    const remaining = Math.max(0, minimum - (performance.now() - nav.startedAt));
    const timer = setTimeout(() => {
      if (current.current !== nav) return;
      current.current = null;
      setPending(null);
      if (nav.scroll && !nav.inPlace) window.scrollTo({ top: 0 });
      nav.resolvers.forEach((resolve) => resolve());
    }, remaining);
    return () => clearTimeout(timer);
  }, [isPending, pending]);

  useEffect(() => {
    const onClick = (e) => {
      const to = linkTarget(e);
      if (!to) return;
      e.preventDefault();
      navigate(to);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);
  return <NavigationContext value={value}>{children}</NavigationContext>;
}

// The in-app href a click should navigate to, or null to leave it to the browser.
function linkTarget(e) {
  const link = e.target instanceof Element ? e.target.closest('a') : null;
  if (
    !link ||
    !link.href ||
    (link.target && link.target !== '_self') ||
    link.origin !== window.location.origin ||
    link.hasAttribute('download') ||
    e.button !== 0 ||
    e.metaKey || e.ctrlKey || e.altKey || e.shiftKey ||
    e.defaultPrevented
  ) {
    return null;
  }
  const to = new URL(link.href);
  // Pure #hash links stay with the browser; so do API and SEO file links.
  if (to.pathname === window.location.pathname && to.search === window.location.search && to.hash) return null;
  if (/^\/(v1|health)(\/|$)|\.(txt|xml)$/.test(to.pathname)) return null;
  return to.pathname + to.search + to.hash;
}
