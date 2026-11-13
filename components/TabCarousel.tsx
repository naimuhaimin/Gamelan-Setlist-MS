'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from './ui';

/**
 * Phone carousel for a set of tabs: the neighbouring tabs sit either side of the current one,
 * the strip follows the finger 1:1, and on release it snaps to the nearest tab.
 * Past the first/last tab it stretches with resistance; let go far enough and `onBeyond` fires
 * (used to move on to the next main tab).
 * On wider screens it just renders the current tab.
 */

const TOP_BAR = 64; // sticky app bar height: neighbours line up just under it
const COMMIT = 0.22; // share of the width to drag before it moves on…
const FLICK_PX = 40; // …or a quick flick of at least this far
const FLICK_MS = 260;
const BEYOND_PX = 160; // drag this far past the first/last tab to leave (finger distance)

function noSwipeZone(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe], [role="dialog"], [role="slider"]')) return true;
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true; // it scrolls sideways itself
    }
  }
  return false;
}

export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export function TabCarousel({
  index,
  count,
  render,
  onChange,
  onBeyond,
  beyondPrevLabel,
  beyondNextLabel,
  enabled,
}: {
  index: number;
  count: number;
  /** Draws tab `i`; `active` is false for the neighbours kept ready either side. */
  render: (i: number, active: boolean) => React.ReactNode;
  onChange: (i: number) => void;
  onBeyond: (dir: -1 | 1) => void;
  beyondPrevLabel: string;
  beyondNextLabel: string;
  enabled: boolean;
}) {
  const outer = useRef<HTMLDivElement | null>(null);
  const current = useRef<HTMLDivElement | null>(null);
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState<-1 | 0 | 1 | null>(null); // animating towards prev / back / next
  const [dragging, setDragging] = useState(false);
  const [shift, setShift] = useState(0); // lines neighbours up with the top of the screen
  const [height, setHeight] = useState<number | null>(null);
  const [warm, setWarm] = useState(false); // neighbours load a moment after the current tab
  const state = useRef({ index, count, onChange, onBeyond });
  state.current = { index, count, onChange, onBeyond };

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => setWarm(true), 500);
    return () => clearTimeout(id);
  }, [enabled]);

  // The carousel is as tall as the tab you're on (neighbours are clipped), so the page doesn't scroll into blank space
  useLayoutEffect(() => {
    const el = current.current;
    if (!enabled || !el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [enabled, index]);

  useEffect(() => {
    const el = outer.current;
    if (!enabled || !el) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let d = 0;
    let axis: 'x' | 'y' | null = null;
    let active = false;
    const width = () => el.clientWidth || window.innerWidth;
    const resist = (raw: number) => {
      const { index: i, count: n } = state.current;
      const atStart = i === 0 && raw > 0;
      const atEnd = i === n - 1 && raw < 0;
      return atStart || atEnd ? raw * 0.35 : raw;
    };

    const start = (e: TouchEvent) => {
      active = false;
      if (e.touches.length !== 1 || noSwipeZone(e.target, el)) return;
      active = true;
      axis = null;
      d = 0;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const rawX = e.touches[0].clientX - x0;
      const rawY = e.touches[0].clientY - y0;
      if (!axis && (Math.abs(rawX) > 8 || Math.abs(rawY) > 8)) {
        axis = Math.abs(rawX) > Math.abs(rawY) * 1.2 ? 'x' : 'y';
        if (axis === 'x') {
          setShift(Math.max(0, TOP_BAR - el.getBoundingClientRect().top));
          setDragging(true);
        }
      }
      if (axis !== 'x') return;
      d = rawX;
      setDx(resist(rawX));
    };
    const end = () => {
      if (!active) return;
      active = false;
      if (axis !== 'x') return;
      setDragging(false);
      const { index: i, count: n, onBeyond } = state.current;
      const w = width();
      const fast = Date.now() - t0 < FLICK_MS && Math.abs(d) > FLICK_PX;
      const dir: -1 | 1 = d < 0 ? 1 : -1;
      const far = Math.abs(d) > w * COMMIT || fast;
      const hasNeighbour = dir === 1 ? i < n - 1 : i > 0;
      if (!hasNeighbour) {
        if (Math.abs(d) > BEYOND_PX) {
          setDx(0);
          onBeyond(dir);
        } else setSettling(0);
        return;
      }
      setSettling(far ? dir : 0);
      setDx(far ? -dir * w : 0);
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

  // Snap finished: hand over to the new tab without a jump
  const finish = () => {
    if (settling === null) return;
    const dir = settling;
    if (dir !== 0) {
      const top = outer.current?.getBoundingClientRect().top ?? TOP_BAR;
      if (shift > 0) window.scrollBy(0, top - TOP_BAR);
      state.current.onChange(index + dir);
    }
    setSettling(null);
    setDx(0);
    setShift(0);
  };
  // Safety net if the transition end never arrives (e.g. reduced motion)
  useEffect(() => {
    if (settling === null) return;
    const id = setTimeout(finish, 380);
    return () => clearTimeout(id);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return <>{render(index, true)}</>;

  const moving = dragging || settling !== null;
  const slots = [index - 1, index, index + 1];
  const beyond = dragging && ((index === 0 && dx > BEYOND_PX * 0.35) || (index === count - 1 && dx < -BEYOND_PX * 0.35));

  return (
    <div
      ref={outer}
      className="relative overflow-hidden"
      style={{ height: moving ? Math.max(height ?? 0, shift + window.innerHeight) : height ?? undefined }}
    >
      {beyond && (
        <div
          aria-hidden
          className={cx(
            'fixed top-1/2 -translate-y-1/2 z-30 h-9 px-3 rounded-full bg-brass text-bg text-sm font-semibold shadow-lg inline-flex items-center pointer-events-none',
            dx > 0 ? 'left-3' : 'right-3'
          )}
        >
          {dx > 0 ? `‹ ${beyondPrevLabel}` : `${beyondNextLabel} ›`}
        </div>
      )}
      <div
        className="flex items-start will-change-transform"
        style={{
          transform: `translateX(calc(-100% + ${dx}px))`,
          transition: settling !== null ? 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
        }}
        onTransitionEnd={(e) => e.target === e.currentTarget && finish()}
      >
        {slots.map((i, slot) => {
          const isCurrent = slot === 1;
          const exists = i >= 0 && i < count;
          return (
            <div
              key={exists ? `tab-${i}` : `edge-${slot}`}
              ref={isCurrent ? current : undefined}
              className="w-full shrink-0 min-w-0"
              style={!isCurrent && shift ? { transform: `translateY(${shift}px)` } : undefined}
              aria-hidden={!isCurrent || undefined}
              {...(!isCurrent ? ({ inert: '' } as Record<string, string>) : {})}
            >
              {exists && (isCurrent || warm) ? render(i, isCurrent) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
