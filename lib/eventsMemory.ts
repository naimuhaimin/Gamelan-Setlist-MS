'use client';

import { useEffect, useState } from 'react';

/**
 * The Events tab remembers where you were (an event, a Sidang and its tab, how far down) when you
 * jump to another tab from the navbar, so tapping Events brings you back there instead of to the list.
 * Tapping Events while already inside it goes back to the list, like a phone app's tab bar.
 * Kept per browser tab (sessionStorage), so it doesn't follow you into a new visit.
 */

const KEY = 'anjung_events_spot';
const RESTORE_KEY = 'anjung_events_restore_y';

export const inEventsSection = (path: string) => path.startsWith('/events') || path.startsWith('/konvo') || path.startsWith('/sidang');

type Spot = { url: string; y: number };

function read(): Spot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Spot) : null;
  } catch {
    return null;
  }
}

/** Call when leaving through the navbar: remembers the current Events page and scroll, if we're in one. */
export function rememberEventsSpot() {
  if (typeof window === 'undefined' || !inEventsSection(window.location.pathname)) return;
  const params = new URLSearchParams(window.location.search);
  params.delete('register'); // don't reopen the registration form on return
  const qs = params.toString();
  const spot: Spot = { url: window.location.pathname + (qs ? `?${qs}` : ''), y: Math.round(window.scrollY) };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(spot));
  } catch {
    // private mode: Events just opens the list
  }
}

/** Where the Events tab should go from the current page. */
export function useEventsHref(pathname: string) {
  const [spot, setSpot] = useState<Spot | null>(null);
  useEffect(() => {
    setSpot(read());
  }, [pathname]);
  if (inEventsSection(pathname) || !spot) return { href: '/events', onClick: forgetSpot };
  return {
    href: spot.url,
    onClick: () => {
      try {
        sessionStorage.setItem(RESTORE_KEY, String(spot.y));
      } catch {
        // fine
      }
    },
  };
}

function forgetSpot() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    // fine
  }
}

/** After returning to the remembered page, scroll back down once the content is tall enough. */
export function useRestoreEventsScroll(pathname: string) {
  useEffect(() => {
    let y: number | null = null;
    try {
      const v = sessionStorage.getItem(RESTORE_KEY);
      if (v !== null) {
        sessionStorage.removeItem(RESTORE_KEY);
        y = Number(v);
      }
    } catch {
      return;
    }
    if (!y || !inEventsSection(pathname)) return;
    const target = y;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      const fits = document.documentElement.scrollHeight - window.innerHeight >= target;
      if (fits || tries > 40) {
        window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, [pathname]);
}
