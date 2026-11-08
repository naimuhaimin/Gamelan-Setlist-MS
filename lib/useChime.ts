'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Song-change alert sounds, synthesised with the Web Audio API (no files).
 * Web Audio mixes with the lock-screen's silent <audio> loop instead of
 * replacing it, so the lock-screen display keeps working.
 * `enable()` must be called from a tap: browsers block sound until then.
 * Note: on iPhone the ring/silent switch mutes Web Audio.
 */

export type ChimeKind = 'change' | 'cue';

type Ctx = AudioContext;

const getAudioContextClass = (): (new () => Ctx) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
};

export const chimeSupported = () => !!getAudioContextClass();

function tone(ctx: Ctx, freq: number, start: number, length: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

function playChime(ctx: Ctx, kind: ChimeKind) {
  const t = ctx.currentTime + 0.02;
  if (kind === 'cue') {
    // Urgent: four quick rising notes
    [1046.5, 1568, 1046.5, 1568].forEach((f, i) => tone(ctx, f, t + i * 0.16, 0.22, 0.6));
  } else {
    // Gentle two-note "ding-dong"
    tone(ctx, 880, t, 0.45, 0.45);
    tone(ctx, 1318.5, t + 0.18, 0.6, 0.4);
  }
}

export function useChime() {
  const ctxRef = useRef<Ctx | null>(null);
  const [enabled, setEnabled] = useState(false);

  /** Call from a tap. Plays a short sample so the user knows it works. */
  const enable = useCallback(async () => {
    const AC = getAudioContextClass();
    if (!AC) return false;
    try {
      if (!ctxRef.current) ctxRef.current = new AC();
      await ctxRef.current.resume();
      playChime(ctxRef.current, 'change');
      setEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disable = useCallback(() => setEnabled(false), []);

  const play = useCallback(
    (kind: ChimeKind) => {
      const ctx = ctxRef.current;
      if (!enabled || !ctx) return;
      const go = () => playChime(ctx, kind);
      if (ctx.state === 'suspended') ctx.resume().then(go).catch(() => undefined);
      else go();
      try {
        navigator.vibrate?.(kind === 'cue' ? [180, 80, 180, 80, 180] : [120]);
      } catch {
        // vibration not allowed here
      }
    },
    [enabled]
  );

  useEffect(() => () => void ctxRef.current?.close().catch(() => undefined), []);

  return { enabled, enable, disable, play, supported: chimeSupported() };
}
