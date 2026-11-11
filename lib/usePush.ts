'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/supabaseService';
import { useT } from '@/lib/i18n';

/**
 * Real notifications ("Bahagian 2 is live") that arrive even when the app is closed.
 * Opt-in per phone, from Settings. The phone registers with its browser's push service and
 * we store that address in `push_subscriptions`; /api/notify sends to it when a Bahagian goes live.
 *
 * iPhone: only works once the app is added to the Home Screen (iOS 16.4+).
 */

const PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const ENDPOINT_KEY = 'anjung_push_endpoint';
const DEVICE_KEY = 'gamelan_device_id';

export type PushState =
  | 'unavailable' // not set up on the server: hide the switch
  | 'unsupported' // this browser can't do it
  | 'needs-install' // iPhone: add to Home Screen first
  | 'blocked' // the person said no in the phone's own prompt/settings
  | 'off'
  | 'on';

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // private mode
    }
  },
};

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function usePush() {
  const { lang } = useT();
  const [state, setState] = useState<PushState>(PUBLIC_KEY ? 'off' : 'unavailable');
  const [busy, setBusy] = useState(false);

  const save = useCallback(async (sub: PushSubscription, language: string) => {
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Subscription is incomplete');
    await api.savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      device_id: store.get(DEVICE_KEY) || '',
      lang: language,
    });
    store.set(ENDPOINT_KEY, json.endpoint);
  }, []);

  // Work out where this phone stands
  useEffect(() => {
    if (!PUBLIC_KEY) return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      setState(ios && !standalone ? 'needs-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      return;
    }
    currentSubscription()
      .then((sub) => setState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  // Keep the notification language in step with the app language
  useEffect(() => {
    if (state !== 'on') return;
    currentSubscription()
      .then((sub) => sub && save(sub, lang))
      .catch(() => undefined);
  }, [lang, state, save]);

  /** Must be called from a tap (the phone shows its permission prompt). */
  const enable = async (): Promise<boolean> => {
    if (!PUBLIC_KEY || busy) return false;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        return false;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      await save(sub, lang);
      setState('on');
      return true;
    } catch {
      setState(Notification.permission === 'denied' ? 'blocked' : 'off');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      const endpoint = sub?.endpoint ?? store.get(ENDPOINT_KEY);
      await sub?.unsubscribe().catch(() => undefined);
      if (endpoint) await api.deletePushSubscription(endpoint).catch(() => undefined);
      store.set(ENDPOINT_KEY, null);
      setState('off');
    } finally {
      setBusy(false);
    }
  };

  return { state, busy, enable, disable };
}
