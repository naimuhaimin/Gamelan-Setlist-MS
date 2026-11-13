'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Horizontal swipe on phones: swipe left = next, swipe right = previous.
 * The content follows the finger a little while dragging, and `preview` names where you'd land.
 * Ignores touches that start in text fields, sliders, dialogs, or anything that scrolls sideways itself.
 */

const PHONE_MAX = 767;
const COMMIT_PX = 70; // drag this far…
const FLICK_PX = 35; // …or flick at least this far quickly
const FLICK_MS = 250;

function startsInNoSwipeZone(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe], [role="dialog"], [role="slider"]')) return true;
  // Anything between the finger and the page that scrolls sideways keeps its own swipe
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

export function useSwipeNav<T extends HTMLElement>({
  onNext,
  onPrev,
  nextLabel,
  prevLabel,
  enabled = true,
}: {
  onNext: () => void;
  onPrev: () => void;
  nextLabel: string;
  prevLabel: string;
  enabled?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [offset, setOffset] = useState(0);
  const handlers = useRef({ onNext, onPrev });
  handlers.current = { onNext, onPrev };

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;
    let axis: 'x' | 'y' | null = null;
    let active = false;

    const start = (e: TouchEvent) => {
      active = false;
      if (window.innerWidth > PHONE_MAX || e.touches.length !== 1 || startsInNoSwipeZone(e.target, el)) return;
      active = true;
      axis = null;
      dx = 0;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;
      if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (axis === 'x') setOffset(Math.max(-90, Math.min(90, dx * 0.4)));
    };
    const end = () => {
      if (!active) return;
      active = false;
      const fast = Date.now() - t0 < FLICK_MS && Math.abs(dx) > FLICK_PX;
      if (axis === 'x' && (Math.abs(dx) > COMMIT_PX || fast)) {
        if (dx < 0) handlers.current.onNext();
        else handlers.current.onPrev();
      }
      setOffset(0);
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [enabled]);

  /** Where a release right now would go, once the drag is far enough to mean it. */
  const preview = offset <= -COMMIT_PX * 0.4 ? { side: 'right' as const, label: nextLabel } : offset >= COMMIT_PX * 0.4 ? { side: 'left' as const, label: prevLabel } : null;

  return { ref, offset, preview };
}
