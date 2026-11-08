'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shows the live song on the phone's lock screen via the Media Session API
 * ("Now playing" on iOS, the media notification on Android).
 *
 * Browsers only show it while media is playing, so we loop a silent audio clip.
 * That also keeps the page (and its realtime connection) alive while the phone
 * is locked, so the lock screen keeps updating.
 * `start()` must be called from a tap (browsers block audio otherwise).
 */

export interface LockScreenInfo {
  // Text shown by the phone
  title: string; // big line, e.g. "Next: 9 Baba Layar"
  line1: string; // e.g. "★ YOUR CUE NEXT · Intro 4 bars · Bonang · Now: 45 Bayonan · Loop 1/4"
  line2: string; // e.g. "Sidang 27 · Bahagian 2 · Then: 22 Jerai"
  // Artwork
  top: string; // small line at the top, e.g. "NOW · 45 Bayonan · loop 1/4"
  kicker: string; // e.g. "NEXT", "YOUR CUE NEXT", "LAST SONG"
  heading: string; // big title in the artwork
  detail: string; // e.g. "Bonang · Inang → Joget"
  stats: Array<{ label: string; value: string }>; // up to two
  highlight: boolean; // gold background (your cue)
  onHold: boolean;
}

export const lockScreenSupported = () =>
  typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof Audio !== 'undefined';

let silentUrl: string | null = null;
/** 2 s of 8-bit mono silence as a WAV blob URL. */
function getSilentUrl() {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const samples = rate * 2;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 8-bit silence
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

/** Square artwork with the essentials, readable on a lock screen. */
function drawArtwork(info: LockScreenInfo): string | null {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const font = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

  ctx.fillStyle = info.highlight ? '#f5b335' : '#13151c';
  ctx.fillRect(0, 0, size, size);
  const ink = info.highlight ? '#1a1203' : '#f3f4f6';
  const muted = info.highlight ? 'rgba(26,18,3,0.72)' : '#9aa1b2';

  // Now playing, small, at the top
  ctx.fillStyle = muted;
  ctx.font = font(600, 26);
  wrap(ctx, info.top, size - 64, 1).forEach((l) => ctx.fillText(l, 32, 54));

  ctx.fillStyle = info.highlight ? '#1a1203' : info.onHold ? '#f5b335' : '#5eead4';
  ctx.font = font(800, 34);
  ctx.fillText(info.onHold ? 'ON HOLD' : info.kicker, 32, 112, size - 64);

  ctx.fillStyle = ink;
  ctx.font = font(800, 58);
  const titleLines = wrap(ctx, info.heading, size - 64, 3);
  titleLines.forEach((l, i) => ctx.fillText(l, 32, 184 + i * 64));

  if (info.detail) {
    ctx.fillStyle = muted;
    ctx.font = font(600, 30);
    wrap(ctx, info.detail, size - 64, 1).forEach((l) => ctx.fillText(l, 32, Math.min(362, 184 + titleLines.length * 64 + 16)));
  }

  info.stats.slice(0, 2).forEach((st, k) => {
    const x = 32 + k * 258;
    ctx.fillStyle = muted;
    ctx.font = font(600, 26);
    ctx.fillText(st.label.toUpperCase(), x, 412);
    ctx.fillStyle = ink;
    ctx.font = font(800, 52);
    ctx.fillText(st.value, x, 470, 230);
  });

  try {
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function useLockScreen(info: LockScreenInfo | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(false);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setActive(false);
    if (lockScreenSupported()) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, []);

  /** Call from a tap/click handler. */
  const start = useCallback(async () => {
    if (!lockScreenSupported()) return false;
    if (!audioRef.current) {
      const a = new Audio(getSilentUrl());
      a.loop = true;
      a.setAttribute('playsinline', '');
      // Another app taking over audio (a call, music) stops us: reflect that in the UI
      a.addEventListener('pause', () => setActive(false));
      audioRef.current = a;
    }
    try {
      await audioRef.current.play();
      setActive(true);
      return true;
    } catch {
      setActive(false);
      return false;
    }
  }, []);

  // Lock-screen play/pause buttons turn the feature on/off instead of breaking it
  useEffect(() => {
    if (!lockScreenSupported()) return;
    const ms = navigator.mediaSession;
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // action not supported on this platform
      }
    };
    safe('play', () => {
      start();
    });
    safe('pause', () => stop());
    safe('stop', () => stop());
    return () => {
      safe('play', null);
      safe('pause', null);
      safe('stop', null);
    };
  }, [start, stop]);

  // Push the latest stage info to the lock screen
  const key = info ? JSON.stringify(info) : '';
  useEffect(() => {
    if (!active || !lockScreenSupported()) return;
    const data: LockScreenInfo = info ?? {
      title: 'Waiting for the stage',
      line1: 'Nothing is live yet',
      line2: 'Gamelan Sync',
      top: 'GAMELAN SYNC',
      kicker: 'WAITING',
      heading: 'Nothing is live yet',
      detail: '',
      stats: [],
      highlight: false,
      onHold: false,
    };
    const art = drawArtwork(data);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: data.title,
        artist: data.line1,
        album: data.line2,
        artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : [],
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  // Clean up on unmount
  useEffect(() => () => audioRef.current?.pause(), []);

  return { active, start, stop, supported: lockScreenSupported() };
}
