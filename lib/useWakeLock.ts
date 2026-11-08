'use client';

import { useEffect } from 'react';

type WakeLockSentinel = { release: () => Promise<void> };

/** Keeps the screen awake while `enabled` (stage screens must not dim mid-performance). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinel> } })
          .wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => undefined);
        else sentinel = lock;
      } catch {
        // Not allowed right now (e.g. tab hidden or battery saver); try again on next visibility change.
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && request();

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
