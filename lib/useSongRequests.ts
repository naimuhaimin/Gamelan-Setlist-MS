'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SongRequest } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import * as api from '@/lib/supabaseService';

const DEVICE_KEY = 'gamelan_device_id';
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export interface RequestRow extends SongRequest {
  votes: number; // +1s, not counting the requester
  mine: boolean; // this phone made the request
  backed: boolean; // this phone gave it +1
}

/**
 * Song requests for one Sidang, kept live on their own realtime channel.
 * `available` is null while loading and false until the song_requests table exists.
 */
export function useSongRequests(sessionId: string) {
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [votes, setVotes] = useState<Array<{ request_id: string; device_id: string }>>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const deviceId = useRef('');

  useEffect(() => {
    deviceId.current = read(DEVICE_KEY) || '';
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const res = await api.fetchSongRequests(sessionId).catch(() => null);
    setAvailable(res !== null);
    if (res) {
      setRequests(res.requests);
      setVotes(res.votes);
    }
  }, [sessionId]);

  useEffect(() => {
    setAvailable(null);
    setRequests([]);
    setVotes([]);
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
      .channel(`song_requests_${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `session_id=eq.${sessionId}` }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'song_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_request_votes' }, refresh)
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      client.removeChannel(channel);
    };
  }, [sessionId, available, load]);

  const rows = useMemo<RequestRow[]>(() => {
    const me = deviceId.current;
    return requests
      .map((r) => {
        const v = votes.filter((x) => x.request_id === r.id && x.device_id !== r.device_id);
        return { ...r, votes: v.length, mine: r.device_id === me, backed: v.some((x) => x.device_id === me) };
      })
      .sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  }, [requests, votes]);

  /** Request a song. If it's already requested and open, back that one instead. */
  const request = async (input: { songId: string | null; title: string; note: string; author: string; instrument: string | null }) => {
    const title = input.title.trim().slice(0, 120);
    if (!title) return 'empty' as const;
    const existing = rows.find(
      (r) => r.status === 'open' && (input.songId ? r.song_id === input.songId : r.title.toLowerCase() === title.toLowerCase())
    );
    if (existing) {
      if (!existing.mine && !existing.backed) await toggleVote(existing.id);
      return 'backed' as const;
    }
    const row: Omit<SongRequest, 'created_at' | 'handled_note'> = {
      id: api.newId('req'),
      session_id: sessionId,
      song_id: input.songId,
      title,
      note: input.note.trim().slice(0, 200) || null,
      device_id: deviceId.current,
      author: input.author.trim().slice(0, 40),
      instrument: input.instrument,
      status: 'open',
    };
    setRequests((prev) => [...prev, { ...row, handled_note: null, created_at: new Date().toISOString() }]);
    try {
      await api.insertSongRequest(row);
    } catch (err) {
      setRequests((prev) => prev.filter((r) => r.id !== row.id));
      throw err;
    }
    return 'added' as const;
  };

  const toggleVote = async (id: string) => {
    const me = deviceId.current;
    const on = !votes.some((v) => v.request_id === id && v.device_id === me);
    setVotes((prev) => (on ? [...prev, { request_id: id, device_id: me }] : prev.filter((v) => !(v.request_id === id && v.device_id === me))));
    try {
      await api.setRequestVote(id, me, on);
    } catch (err) {
      load();
      throw err;
    }
  };

  const setStatus = async (id: string, status: SongRequest['status'], handledNote: string | null = null) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, handled_note: handledNote } : r)));
    try {
      await api.updateSongRequest(id, { status, handled_note: handledNote });
    } catch (err) {
      load();
      throw err;
    }
  };

  const remove = async (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.deleteSongRequest(id);
    } catch (err) {
      load();
      throw err;
    }
  };

  return { available, rows, request, toggleVote, setStatus, remove };
}
