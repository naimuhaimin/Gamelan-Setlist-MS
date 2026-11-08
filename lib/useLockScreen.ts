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
  title: string; // big line
  line1: string; // e.g. "★ YOUR CUE · Intro 4 bars · Loop 2/4"
  line2: string; // e.g. "Sidang 23 · Bahagian 1 · Next: 22 Jerai"
  // for the artwork
  location: string;
  detail: string; // intro instruments · rhythm
  intro: string;
  loop: string;
  cued: boolean;
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

  ctx.fillStyle = info.cued ? '#f5b335' : '#13151c';
  ctx.fillRect(0, 0, size, size);
  const ink = info.cued ? '#1a1203' : '#f3f4f6';
  const muted = info.cued ? 'rgba(26,18,3,0.7)' : '#9aa1b2';

  ctx.fillStyle = muted;
  ctx.font = font(600, 26);
  ctx.fillText(info.location.toUpperCase(), 32, 56, size - 64);

  if (info.cued || info.onHold) {
    ctx.fillStyle = info.cued ? '#1a1203' : '#f5b335';
    ctx.font = font(800, 34);
    ctx.fillText(info.onHold ? 'ON HOLD' : 'YOUR CUE', 32, 104);
  }

  ctx.fillStyle = ink;
  ctx.font = font(800, 60);
  const titleLines = wrap(ctx, info.title, size - 64, 3);
  titleLines.forEach((l, i) => ctx.fillText(l, 32, 180 + i * 66));

  if (info.detail) {
    ctx.fillStyle = muted;
    ctx.font = font(600, 30);
    wrap(ctx, info.detail, size - 64, 1).forEach((l) => ctx.fillText(l, 32, Math.min(360, 180 + titleLines.length * 66 + 20)));
  }

  ctx.fillStyle = muted;
  ctx.font = font(600, 26);
  ctx.fillText('INTRO', 32, 410);
  ctx.fillText('LOOP', 290, 410);
  ctx.fillStyle = ink;
  ctx.font = font(800, 54);
  ctx.fillText(info.intro, 32, 470, 240);
  ctx.fillText(info.loop, 290, 470, 200);

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
    const data = info ?? {
      title: 'Waiting for the stage',
      line1: 'Nothing is live yet',
      line2: 'Gamelan Sync',
      location: 'Gamelan Sync',
      detail: '',
      intro: '–',
      loop: '–',
      cued: false,
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
