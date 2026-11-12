'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import * as api from '@/lib/supabaseService';

const DEVICE_KEY = 'gamelan_device_id';
const NAME_KEY = 'anjung_chat_name';
const seenKey = (sessionId: string, table: string) => `anjung_${table === 'chat_messages' ? 'chat' : table}_seen_${sessionId}`;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: fine, just not remembered
  }
}

/**
 * Live chat for one Sidang. Loads the latest 200 messages, then follows inserts/deletes in realtime
 * on its own channel (so a missing table never breaks the live stage sync).
 * `available` is null while loading and false when the chat_messages table doesn't exist yet.
 */
export function useChat(sessionId: string | undefined, table: api.MessageTable = 'chat_messages') {
  const maxLength = table === 'chat_messages' ? 500 : 1000;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [name, setNameState] = useState('');
  const [seenAt, setSeenAt] = useState<string>('');
  const deviceId = useRef('');

  useEffect(() => {
    deviceId.current = read(DEVICE_KEY) || '';
    setNameState(read(NAME_KEY) || '');
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setSeenAt(read(seenKey(sessionId, table)) || '');
  }, [sessionId, table]);

  const load = useCallback(async () => {
    if (!sessionId || !isSupabaseConfigured) return;
    const list = await api.fetchChat(sessionId, table).catch(() => null);
    setAvailable(list !== null);
    if (list) setMessages(list);
  }, [sessionId, table]);

  useEffect(() => {
    setMessages([]);
    setAvailable(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!sessionId || !available || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`${table}_${sessionId}_${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].slice(-300)));
        }
      )
      // DELETE events can't be filtered by column; drop by id
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load(); // catch up on anything missed
      });
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      client.removeChannel(channel);
    };
  }, [sessionId, table, available, load]);

  const setName = (n: string) => {
    const v = n.trim().slice(0, 40);
    setNameState(v);
    write(NAME_KEY, v);
  };

  const send = async (body: string, meta: { instrument: string | null; role: string; author?: string }) => {
    const text = body.trim().slice(0, maxLength);
    const author = (meta.author ?? name).trim().slice(0, 40); // `author` lets a first-time poster send in the same tap as naming themselves
    if (!sessionId || !text || !author) return;
    const msg: Omit<ChatMessage, 'created_at'> = {
      id: api.newId('msg'),
      session_id: sessionId,
      device_id: deviceId.current,
      author,
      instrument: meta.instrument,
      role: meta.role,
      body: text,
    };
    // Show it straight away; the realtime echo is de-duplicated by id
    const optimistic: ChatMessage = { ...msg, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const saved = await api.sendChat(msg, table);
      setMessages((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      setMessages((prev) => prev.filter((x) => x.id !== msg.id));
      throw err;
    }
  };

  const remove = async (id: string) => {
    setMessages((prev) => prev.filter((x) => x.id !== id));
    try {
      await api.deleteChat(id, table);
    } catch (err) {
      load();
      throw err;
    }
  };

  const markRead = useCallback(() => {
    if (!sessionId) return;
    const now = new Date().toISOString();
    setSeenAt(now);
    write(seenKey(sessionId, table), now);
  }, [sessionId, table]);

  const unread = useMemo(
    () => messages.filter((m) => m.device_id !== deviceId.current && (!seenAt || m.created_at > seenAt)).length,
    [messages, seenAt]
  );

  return { messages, available, name, setName, send, remove, unread, markRead, myDeviceId: deviceId.current };
}
