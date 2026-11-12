'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttendanceEntry } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import * as api from '@/lib/supabaseService';

const DEVICE_KEY = 'gamelan_device_id';

/**
 * Who registered for one Sidang, and how many players each instrument needs.
 * Live-updated on its own channel. `available` is false until the attendance tables exist.
 */
export function useAttendance(sessionId: string) {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [needs, setNeeds] = useState<Record<string, number>>({});
  const [available, setAvailable] = useState<boolean | null>(null);
  const deviceId = useRef('');

  useEffect(() => {
    try {
      deviceId.current = localStorage.getItem(DEVICE_KEY) || '';
    } catch {
      deviceId.current = '';
    }
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const res = await api.fetchAttendance(sessionId).catch(() => null);
    setAvailable(res !== null);
    if (res) {
      setEntries(res.entries);
      setNeeds(res.needs);
    }
  }, [sessionId]);

  useEffect(() => {
    setAvailable(null);
    setEntries([]);
    setNeeds({});
    load();
  }, [load]);

  useEffect(() => {
    if (!available || !supabase) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load(), 200);
    };
    const channel = client
      .channel(`attendance_${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sidang_attendance', filter: `session_id=eq.${sessionId}` }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sidang_attendance' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sidang_needs', filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      client.removeChannel(channel);
    };
  }, [sessionId, available, load]);

  const mine = entries.find((e) => e.device_id === deviceId.current) ?? null;

  /** Register (or update) this phone's entry. */
  const register = async (name: string, instrument: string) => {
    const entry: Omit<AttendanceEntry, 'created_at'> = {
      id: mine?.id ?? api.newId('att'),
      session_id: sessionId,
      device_id: deviceId.current,
      name: name.trim().slice(0, 40),
      instrument,
    };
    setEntries((prev) =>
      mine ? prev.map((e) => (e.id === mine.id ? { ...e, ...entry } : e)) : [...prev, { ...entry, created_at: new Date().toISOString() }]
    );
    try {
      await api.upsertAttendance(entry);
    } catch (err) {
      load();
      throw err;
    }
  };

  const remove = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteAttendance(id);
    } catch (err) {
      load();
      throw err;
    }
  };

  const setNeeded = async (instrument: string, needed: number) => {
    const n = Math.max(0, Math.min(50, Math.round(needed)));
    setNeeds((prev) => ({ ...prev, [instrument]: n }));
    try {
      await api.setNeeded(sessionId, instrument, n);
    } catch (err) {
      load();
      throw err;
    }
  };

  return { available, entries, needs, mine, register, remove, setNeeded };
}
