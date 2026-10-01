'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  RoleType,
  GamelanInstrument,
  Song,
  QueueItem,
  Part,
  Session,
  RoomState,
  ActiveSongDisplay,
} from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  INITIAL_SONGS,
  INITIAL_SESSIONS,
  INITIAL_PARTS,
  INITIAL_QUEUE_ITEMS,
  INITIAL_ROOM_STATE,
  MASTER_ADMIN_PIN,
} from '@/lib/seedData';

interface StageContextType {
  // Data
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState;
  
  // Computed State
  currentSession: Session | undefined;
  currentPart: Part | undefined;
  currentQueue: QueueItem[];
  activeSongDisplay: ActiveSongDisplay | null;
  upNextSongs: Array<{
    queueItem: QueueItem;
    song: Song;
    effectiveLoop: number;
    effectiveBars: number;
    effectiveInstruments: string[];
  }>;

  // Roles & Instrument
  activeRole: RoleType;
  selectedInstrument: GamelanInstrument | null;
  isInstrumentCued: boolean;
  connectionStatus: 'connected' | 'demo_local' | 'reconnecting' | 'error';
  errorMessage: string | null;

  // Actions
  loginRole: (role: RoleType, passkey?: string) => { success: boolean; message?: string };
  logoutRole: () => void;
  selectInstrument: (instrument: GamelanInstrument | null) => void;
  
  // Live Stage Navigation (Controller / Maestro / Admin)
  navigateNext: () => Promise<void>;
  navigatePrev: () => Promise<void>;
  jumpToQueueItem: (queueItemId: string) => Promise<void>;
  incrementLoop: () => Promise<void>;
  decrementLoop: () => Promise<void>;
  resetLoop: () => Promise<void>;
  togglePause: () => Promise<void>;
  switchActiveSession: (sessionId: string) => Promise<void>;
  switchActivePart: (partId: string) => Promise<void>;

  // Maestro / Admin Queue & Library Management
  addSongToLibrary: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  updateSongInLibrary: (song: Song) => Promise<void>;
  deleteSongFromLibrary: (songId: string) => Promise<void>;
  addSongToPartQueue: (partId: string, songId: string) => Promise<void>;
  removeQueueItem: (queueItemId: string) => Promise<void>;
  reorderQueueItems: (partId: string, orderedIds: string[]) => Promise<void>;
  saveInstanceOverride: (
    queueItemId: string,
    overrides: {
      override_intro_bar_count: number | null;
      override_intro_instruments: string[] | null;
      override_loop_count: number | null;
    }
  ) => Promise<void>;
  updatePartController: (partId: string, enabled: boolean, passkey?: string) => Promise<void>;
  
  // Sidang (Session) Management (Maestro & Admin)
  addSession: (sidangNumber: number, name?: string, passkey?: string, date?: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<Session>) => Promise<void>;

  resetAllToSeed: () => void;
}

const StageContext = createContext<StageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'gamelan_queue_state_v2';
const ROLE_STORAGE_KEY = 'gamelan_active_role_v1';
const INSTRUMENT_STORAGE_KEY = 'gamelan_active_instrument_v1';

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [parts, setParts] = useState<Part[]>(INITIAL_PARTS);
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);
  const [queueItems, setQueueItems] = useState<QueueItem[]>(INITIAL_QUEUE_ITEMS);
  const [roomState, setRoomState] = useState<RoomState>(INITIAL_ROOM_STATE);
  
  const [activeRole, setActiveRole] = useState<RoleType>('player');
  const [selectedInstrument, setSelectedInstrument] = useState<GamelanInstrument | null>('Bonang Barung');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'demo_local' | 'reconnecting' | 'error'>(
    isSupabaseConfigured ? 'reconnecting' : 'demo_local'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // BroadcastChannel for instant local cross-tab sync when in demo/local mode
  const broadcastRef = React.useRef<BroadcastChannel | null>(null);

  // 1. Initial State Hydration (LocalStorage / Seed)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load saved role and instrument
    const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) as RoleType | null;
    if (savedRole) setActiveRole(savedRole);

    const savedInst = localStorage.getItem(INSTRUMENT_STORAGE_KEY) as GamelanInstrument | null;
    if (savedInst) setSelectedInstrument(savedInst);

    // Setup local broadcast channel
    try {
      broadcastRef.current = new BroadcastChannel('gamelan-stage-broadcast');
      broadcastRef.current.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'SYNC_ALL' && payload) {
          if (payload.sessions) setSessions(payload.sessions);
          if (payload.parts) setParts(payload.parts);
          if (payload.songs) setSongs(payload.songs);
          if (payload.queueItems) setQueueItems(payload.queueItems);
          if (payload.roomState) setRoomState(payload.roomState);
        }
      };
    } catch {
      // Fallback for older browsers
    }

    if (!isSupabaseConfigured) {
      // Hydrate from localStorage if available
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.sessions) setSessions(parsed.sessions);
          if (parsed.parts) setParts(parsed.parts);
          if (parsed.songs) setSongs(parsed.songs);
          if (parsed.queueItems) setQueueItems(parsed.queueItems);
          if (parsed.roomState) setRoomState(parsed.roomState);
        }
      } catch (err) {
        console.error('Failed to parse cached local data', err);
      }
      setConnectionStatus('demo_local');
    }

    return () => {
      broadcastRef.current?.close();
    };
  }, []);

  // Sync to localStorage & broadcast whenever local state changes in demo mode
  const persistAndBroadcastLocal = useCallback(
    (
      newSessions: Session[],
      newParts: Part[],
      newSongs: Song[],
      newQueue: QueueItem[],
      newRoom: RoomState
    ) => {
      if (typeof window === 'undefined') return;
      const stateObj = {
        sessions: newSessions,
        parts: newParts,
        songs: newSongs,
        queueItems: newQueue,
        roomState: newRoom,
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateObj));
        broadcastRef.current?.postMessage({
          type: 'SYNC_ALL',
          payload: stateObj,
        });
      } catch {
        // quota exceeded or storage error
      }
    },
    []
  );

  // 2. Supabase Integration & Realtime Subscriptions
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setConnectionStatus('demo_local');
      return;
    }

    let isMounted = true;

    async function fetchSupabaseData(activeClient: NonNullable<typeof supabase>) {
      try {
        setConnectionStatus('reconnecting');
        const [sessionsRes, partsRes, songsRes, queueRes, roomRes] = await Promise.all([
          activeClient.from('sessions').select('*'),
          activeClient.from('parts').select('*').order('part_number'),
          activeClient.from('songs').select('*').order('title'),
          activeClient.from('queue_items').select('*').order('sort_order'),
          activeClient.from('room_state').select('*').eq('id', 'main_stage').single(),
        ]);

        if (!isMounted) return;

        if (sessionsRes.data && sessionsRes.data.length > 0) setSessions(sessionsRes.data);
        if (partsRes.data && partsRes.data.length > 0) setParts(partsRes.data);
        if (songsRes.data && songsRes.data.length > 0) setSongs(songsRes.data);
        if (queueRes.data) setQueueItems(queueRes.data);
        if (roomRes.data) setRoomState(roomRes.data);

        setConnectionStatus('connected');
        setErrorMessage(null);
      } catch (err: unknown) {
        console.error('Supabase fetch failed:', err);
        if (isMounted) {
          setConnectionStatus('error');
          setErrorMessage((err as Error)?.message || 'Failed to connect to Supabase');
        }
      }
    }

    fetchSupabaseData(client);

    // Setup Supabase Realtime channel
    const channel = client
      .channel('stage_sync_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_state' }, (payload) => {
        if (payload.new) setRoomState(payload.new as RoomState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_items' }, () => {
        client.from('queue_items').select('*').order('sort_order').then((res) => {
          if (res.data) setQueueItems(res.data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        client.from('songs').select('*').order('title').then((res) => {
          if (res.data) setSongs(res.data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => {
        client.from('parts').select('*').order('part_number').then((res) => {
          if (res.data) setParts(res.data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        client.from('sessions').select('*').then((res) => {
          if (res.data) setSessions(res.data);
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
        }
      });

    return () => {
      isMounted = false;
      client.removeChannel(channel);
    };
  }, []);

  // 3. Computed Helpers
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === roomState.session_id) || sessions[0];
  }, [sessions, roomState.session_id]);

  const currentPart = useMemo(() => {
    return parts.find((p) => p.id === roomState.part_id) || parts.find((p) => p.session_id === currentSession?.id) || parts[0];
  }, [parts, roomState.part_id, currentSession?.id]);

  const currentQueue = useMemo(() => {
    if (!currentPart) return [];
    return queueItems
      .filter((q) => q.part_id === currentPart.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [queueItems, currentPart]);

  const activeQueueItem = useMemo(() => {
    if (!roomState.current_queue_item_id) {
      return currentQueue[0] || null;
    }
    return currentQueue.find((q) => q.id === roomState.current_queue_item_id) || currentQueue[0] || null;
  }, [currentQueue, roomState.current_queue_item_id]);

  const activeSongTemplate = useMemo(() => {
    if (!activeQueueItem) return null;
    return songs.find((s) => s.id === activeQueueItem.song_id) || null;
  }, [activeQueueItem, songs]);

  const activeSongDisplay = useMemo<ActiveSongDisplay | null>(() => {
    if (!activeQueueItem || !activeSongTemplate) return null;

    const introBarCount = activeQueueItem.override_intro_bar_count !== null && activeQueueItem.override_intro_bar_count !== undefined
      ? activeQueueItem.override_intro_bar_count
      : activeSongTemplate.intro_bar_count;

    const introInstruments = activeQueueItem.override_intro_instruments !== null && activeQueueItem.override_intro_instruments !== undefined
      ? activeQueueItem.override_intro_instruments
      : activeSongTemplate.intro_instruments;

    const loopCount = activeQueueItem.override_loop_count !== null && activeQueueItem.override_loop_count !== undefined
      ? activeQueueItem.override_loop_count
      : activeSongTemplate.loop_count;

    const isOverride = 
      activeQueueItem.override_intro_bar_count !== null ||
      activeQueueItem.override_intro_instruments !== null ||
      activeQueueItem.override_loop_count !== null;

    return {
      queueItemId: activeQueueItem.id,
      songId: activeSongTemplate.id,
      title: activeSongTemplate.title,
      introBarCount,
      introInstruments,
      loopCount,
      currentLoop: roomState.current_loop_iteration || 1,
      isOverride,
      sortOrder: activeQueueItem.sort_order,
    };
  }, [activeQueueItem, activeSongTemplate, roomState.current_loop_iteration]);

  const isInstrumentCued = useMemo(() => {
    if (!selectedInstrument || !activeSongDisplay) return false;
    return activeSongDisplay.introInstruments.includes(selectedInstrument);
  }, [selectedInstrument, activeSongDisplay]);

  const upNextSongs = useMemo(() => {
    if (!activeQueueItem) return [];
    const currentIndex = currentQueue.findIndex((q) => q.id === activeQueueItem.id);
    const subsequent = currentIndex >= 0 ? currentQueue.slice(currentIndex + 1) : currentQueue;

    return subsequent
      .map((q) => {
        const song = songs.find((s) => s.id === q.song_id);
        if (!song) return null;
        return {
          queueItem: q,
          song,
          effectiveLoop: q.override_loop_count ?? song.loop_count,
          effectiveBars: q.override_intro_bar_count ?? song.intro_bar_count,
          effectiveInstruments: q.override_intro_instruments ?? song.intro_instruments,
        };
      })
      .filter(Boolean) as Array<{
        queueItem: QueueItem;
        song: Song;
        effectiveLoop: number;
        effectiveBars: number;
        effectiveInstruments: string[];
      }>;
  }, [activeQueueItem, currentQueue, songs]);

  // 4. Role Authentication Actions
  const loginRole = (role: RoleType, passkey: string = '') => {
    if (role === 'player') {
      setActiveRole('player');
      localStorage.setItem(ROLE_STORAGE_KEY, 'player');
      return { success: true };
    }

    if (role === 'admin') {
      if (passkey === MASTER_ADMIN_PIN) {
        setActiveRole('admin');
        localStorage.setItem(ROLE_STORAGE_KEY, 'admin');
        return { success: true };
      }
      return { success: false, message: 'Invalid Admin Master PIN. Default is admin999.' };
    }

    if (role === 'maestro') {
      // Check against current session passkey, any session passkey, or standard conventions
      const sessionPass = currentSession?.maestro_passkey || 'sidang1';
      const entered = passkey.trim().toLowerCase();
      const isSessionMatch = sessions.some(
        (s) => s.maestro_passkey.toLowerCase() === entered || s.code.toLowerCase() === entered
      );

      if (
        passkey === sessionPass ||
        entered === 'maestro123' ||
        entered.startsWith('sidang') ||
        isSessionMatch ||
        entered === 'pagi123' ||
        entered === 'petang123'
      ) {
        setActiveRole('maestro');
        localStorage.setItem(ROLE_STORAGE_KEY, 'maestro');
        return { success: true };
      }
      return {
        success: false,
        message: `Invalid Maestro Passkey for ${currentSession?.name || 'Sidang'}. Default is ${currentSession?.maestro_passkey || 'sidang1'}.`,
      };
    }

    if (role === 'controller') {
      // Check if controller is enabled for this part
      if (currentPart && !currentPart.controller_enabled) {
        return { success: false, message: 'Controller access is currently disabled by the Maestro for this Bahagian.' };
      }
      const partPass = currentPart?.controller_passkey || 'ctrl123';
      if (passkey === partPass || passkey === 'ctrl123' || passkey.startsWith('ctrl')) {
        setActiveRole('controller');
        localStorage.setItem(ROLE_STORAGE_KEY, 'controller');
        return { success: true };
      }
      return { success: false, message: `Invalid Controller Passkey for ${currentPart?.name || 'Part'}. Default is ctrl1 / ctrl123.` };
    }

    return { success: false, message: 'Unknown role' };
  };

  const logoutRole = () => {
    setActiveRole('player');
    localStorage.setItem(ROLE_STORAGE_KEY, 'player');
  };

  const selectInstrument = (instrument: GamelanInstrument | null) => {
    setSelectedInstrument(instrument);
    if (instrument) {
      localStorage.setItem(INSTRUMENT_STORAGE_KEY, instrument);
    } else {
      localStorage.removeItem(INSTRUMENT_STORAGE_KEY);
    }
  };

  // 5. Live Navigation Handlers
  const updateRoomState = async (updates: Partial<RoomState>) => {
    const nextRoom: RoomState = {
      ...roomState,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by_role: activeRole.toUpperCase(),
    };
    setRoomState(nextRoom);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        await client.from('room_state').update(nextRoom).eq('id', 'main_stage');
      } catch (e) {
        console.error('Failed to sync room state to Supabase', e);
      }
    } else {
      persistAndBroadcastLocal(sessions, parts, songs, queueItems, nextRoom);
    }
  };

  const navigateNext = async () => {
    if (!currentQueue.length) return;
    const currentIndex = currentQueue.findIndex((q) => q.id === (roomState.current_queue_item_id || currentQueue[0].id));
    if (currentIndex < currentQueue.length - 1) {
      const nextItem = currentQueue[currentIndex + 1];
      await updateRoomState({
        current_queue_item_id: nextItem.id,
        current_loop_iteration: 1,
      });
    }
  };

  const navigatePrev = async () => {
    if (!currentQueue.length) return;
    const currentIndex = currentQueue.findIndex((q) => q.id === (roomState.current_queue_item_id || currentQueue[0].id));
    if (currentIndex > 0) {
      const prevItem = currentQueue[currentIndex - 1];
      await updateRoomState({
        current_queue_item_id: prevItem.id,
        current_loop_iteration: 1,
      });
    }
  };

  const jumpToQueueItem = async (queueItemId: string) => {
    await updateRoomState({
      current_queue_item_id: queueItemId,
      current_loop_iteration: 1,
    });
  };

  const incrementLoop = async () => {
    const current = roomState.current_loop_iteration || 1;
    await updateRoomState({
      current_loop_iteration: current + 1,
    });
  };

  const decrementLoop = async () => {
    const current = roomState.current_loop_iteration || 1;
    if (current > 1) {
      await updateRoomState({
        current_loop_iteration: current - 1,
      });
    }
  };

  const resetLoop = async () => {
    await updateRoomState({
      current_loop_iteration: 1,
    });
  };

  const togglePause = async () => {
    await updateRoomState({
      is_paused: !roomState.is_paused,
    });
  };

  const switchActiveSession = async (sessionId: string) => {
    const firstPart = parts.find((p) => p.session_id === sessionId && p.part_number === 1) || parts.find((p) => p.session_id === sessionId);
    const firstQueueItem = firstPart ? queueItems.find((q) => q.part_id === firstPart.id) : null;

    await updateRoomState({
      session_id: sessionId,
      part_id: firstPart ? firstPart.id : roomState.part_id,
      current_queue_item_id: firstQueueItem ? firstQueueItem.id : null,
      current_loop_iteration: 1,
    });
  };

  const switchActivePart = async (partId: string) => {
    const targetPart = parts.find((p) => p.id === partId);
    const firstQueueItem = queueItems.find((q) => q.part_id === partId);

    await updateRoomState({
      part_id: partId,
      session_id: targetPart ? targetPart.session_id : roomState.session_id,
      current_queue_item_id: firstQueueItem ? firstQueueItem.id : null,
      current_loop_iteration: 1,
    });
  };

  // 6. Setlist & Instance Overrides Management (Maestro & Admin)
  const addSongToLibrary = async (newSong: Omit<Song, 'id' | 'created_at'>) => {
    const songEntry: Song = {
      ...newSong,
      id: `song-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const nextSongs = [...songs, songEntry];
    setSongs(nextSongs);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('songs').insert(songEntry);
    } else {
      persistAndBroadcastLocal(sessions, parts, nextSongs, queueItems, roomState);
    }
  };

  const updateSongInLibrary = async (updatedSong: Song) => {
    const nextSongs = songs.map((s) => (s.id === updatedSong.id ? updatedSong : s));
    setSongs(nextSongs);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('songs').update(updatedSong).eq('id', updatedSong.id);
    } else {
      persistAndBroadcastLocal(sessions, parts, nextSongs, queueItems, roomState);
    }
  };

  const deleteSongFromLibrary = async (songId: string) => {
    const nextSongs = songs.filter((s) => s.id !== songId);
    const nextQueue = queueItems.filter((q) => q.song_id !== songId);
    setSongs(nextSongs);
    setQueueItems(nextQueue);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('songs').delete().eq('id', songId);
    } else {
      persistAndBroadcastLocal(sessions, parts, nextSongs, nextQueue, roomState);
    }
  };

  const addSongToPartQueue = async (partId: string, songId: string) => {
    const existingInPart = queueItems.filter((q) => q.part_id === partId);
    const newItem: QueueItem = {
      id: `q-${Date.now()}`,
      part_id: partId,
      song_id: songId,
      sort_order: existingInPart.length + 1,
      override_intro_bar_count: null,
      override_intro_instruments: null,
      override_loop_count: null,
    };
    const nextQueue = [...queueItems, newItem];
    setQueueItems(nextQueue);

    // If room has no active song and this is the active part, set it
    let nextRoom = roomState;
    if (roomState.part_id === partId && !roomState.current_queue_item_id) {
      nextRoom = { ...roomState, current_queue_item_id: newItem.id, current_loop_iteration: 1 };
      setRoomState(nextRoom);
    }

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('queue_items').insert(newItem);
    } else {
      persistAndBroadcastLocal(sessions, parts, songs, nextQueue, nextRoom);
    }
  };

  const removeQueueItem = async (queueItemId: string) => {
    const targetItem = queueItems.find((q) => q.id === queueItemId);
    const nextQueue = queueItems.filter((q) => q.id !== queueItemId);
    setQueueItems(nextQueue);

    let nextRoom = roomState;
    if (roomState.current_queue_item_id === queueItemId) {
      const remainingInPart = nextQueue.filter((q) => q.part_id === targetItem?.part_id);
      nextRoom = {
        ...roomState,
        current_queue_item_id: remainingInPart.length ? remainingInPart[0].id : null,
        current_loop_iteration: 1,
      };
      setRoomState(nextRoom);
    }

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('queue_items').delete().eq('id', queueItemId);
    } else {
      persistAndBroadcastLocal(sessions, parts, songs, nextQueue, nextRoom);
    }
  };

  const reorderQueueItems = async (partId: string, orderedIds: string[]) => {
    const nextQueue = queueItems.map((item) => {
      if (item.part_id !== partId) return item;
      const newIndex = orderedIds.indexOf(item.id);
      if (newIndex >= 0) {
        return { ...item, sort_order: newIndex + 1 };
      }
      return item;
    });
    setQueueItems(nextQueue);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      for (let i = 0; i < orderedIds.length; i++) {
        await client.from('queue_items').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
      }
    } else {
      persistAndBroadcastLocal(sessions, parts, songs, nextQueue, roomState);
    }
  };

  /**
   * One-Time Special Overrides:
   * Sets instance-level intro bars, intro instruments, or loop count specifically for this queue item
   * without modifying the main library song template!
   */
  const saveInstanceOverride = async (
    queueItemId: string,
    overrides: {
      override_intro_bar_count: number | null;
      override_intro_instruments: string[] | null;
      override_loop_count: number | null;
    }
  ) => {
    const nextQueue = queueItems.map((q) => (q.id === queueItemId ? { ...q, ...overrides } : q));
    setQueueItems(nextQueue);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('queue_items').update(overrides).eq('id', queueItemId);
    } else {
      persistAndBroadcastLocal(sessions, parts, songs, nextQueue, roomState);
    }
  };

  const updatePartController = async (partId: string, enabled: boolean, passkey?: string) => {
    const nextParts = parts.map((p) => {
      if (p.id !== partId) return p;
      return {
        ...p,
        controller_enabled: enabled,
        ...(passkey ? { controller_passkey: passkey } : {}),
      };
    });
    setParts(nextParts);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      const payload: Partial<Part> = { controller_enabled: enabled };
      if (passkey) payload.controller_passkey = passkey;
      await client.from('parts').update(payload).eq('id', partId);
    } else {
      persistAndBroadcastLocal(sessions, nextParts, songs, queueItems, roomState);
    }
  };

  /**
   * Flexible Sidang Management:
   * Maestro / Admin can create a new Sidang with a custom number (e.g. Sidang 4),
   * which automatically initializes standard Bahagian 1 - 4 with controller access.
   */
  const addSession = async (
    sidangNumber: number,
    customName?: string,
    customPasskey?: string,
    customDate?: string
  ): Promise<Session> => {
    const sessionId = `session-${sidangNumber}-${Date.now()}`;
    const sessionName = customName?.trim() || `Sidang ${sidangNumber}`;
    const sessionCode = `S${sidangNumber}`;
    const sessionPasskey = customPasskey?.trim() || `sidang${sidangNumber}`;
    const sessionDate = customDate?.trim() || new Date().toISOString().split('T')[0];

    const newSession: Session = {
      id: sessionId,
      sidang_number: sidangNumber,
      name: sessionName,
      code: sessionCode,
      date: sessionDate,
      maestro_passkey: sessionPasskey,
      created_at: new Date().toISOString(),
    };

    // Standard 4 Bahagian generated for every new Sidang
    const newParts: Part[] = [
      {
        id: `part-${sessionId}-1`,
        session_id: sessionId,
        part_number: 1,
        name: `Bahagian 1: Perarakan Masuk VIP & Canselor`,
        controller_passkey: 'ctrl1',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-2`,
        session_id: sessionId,
        part_number: 2,
        name: `Bahagian 2: Penganugerahan Ijazah Siswazah`,
        controller_passkey: 'ctrl2',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-3`,
        session_id: sessionId,
        part_number: 3,
        name: `Bahagian 3: Persembahan Selingan Seni Gamelan`,
        controller_passkey: 'ctrl3',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-4`,
        session_id: sessionId,
        part_number: 4,
        name: `Bahagian 4: Perarakan Keluar & Penutup Rasmi`,
        controller_passkey: 'ctrl4',
        controller_enabled: true,
      },
    ];

    const nextSessions = [...sessions, newSession].sort(
      (a, b) => (a.sidang_number || 0) - (b.sidang_number || 0)
    );
    const nextParts = [...parts, ...newParts];

    setSessions(nextSessions);
    setParts(nextParts);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('sessions').insert(newSession);
      await client.from('parts').insert(newParts);
    } else {
      persistAndBroadcastLocal(nextSessions, nextParts, songs, queueItems, roomState);
    }

    return newSession;
  };

  const deleteSession = async (sessionId: string) => {
    if (sessions.length <= 1) {
      throw new Error('At least one Sidang must remain in the system.');
    }
    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    const nextParts = parts.filter((p) => p.session_id !== sessionId);
    const deletedPartIds = new Set(parts.filter((p) => p.session_id === sessionId).map((p) => p.id));
    const nextQueue = queueItems.filter((q) => !deletedPartIds.has(q.part_id));

    setSessions(nextSessions);
    setParts(nextParts);
    setQueueItems(nextQueue);

    let nextRoom = roomState;
    if (roomState.session_id === sessionId) {
      const fallbackSession = nextSessions[0];
      const fallbackPart = nextParts.find((p) => p.session_id === fallbackSession.id);
      const fallbackQueue = fallbackPart ? nextQueue.find((q) => q.part_id === fallbackPart.id) : null;
      nextRoom = {
        ...roomState,
        session_id: fallbackSession.id,
        part_id: fallbackPart ? fallbackPart.id : null,
        current_queue_item_id: fallbackQueue ? fallbackQueue.id : null,
        current_loop_iteration: 1,
      };
      setRoomState(nextRoom);
    }

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('sessions').delete().eq('id', sessionId);
    } else {
      persistAndBroadcastLocal(nextSessions, nextParts, songs, nextQueue, nextRoom);
    }
  };

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    const nextSessions = sessions
      .map((s) => (s.id === sessionId ? { ...s, ...updates } : s))
      .sort((a, b) => (a.sidang_number || 0) - (b.sidang_number || 0));
    setSessions(nextSessions);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      await client.from('sessions').update(updates).eq('id', sessionId);
    } else {
      persistAndBroadcastLocal(nextSessions, parts, songs, queueItems, roomState);
    }
  };

  const resetAllToSeed = () => {
    setSessions(INITIAL_SESSIONS);
    setParts(INITIAL_PARTS);
    setSongs(INITIAL_SONGS);
    setQueueItems(INITIAL_QUEUE_ITEMS);
    setRoomState(INITIAL_ROOM_STATE);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    persistAndBroadcastLocal(INITIAL_SESSIONS, INITIAL_PARTS, INITIAL_SONGS, INITIAL_QUEUE_ITEMS, INITIAL_ROOM_STATE);
  };

  return (
    <StageContext.Provider
      value={{
        sessions,
        parts,
        songs,
        queueItems,
        roomState,
        currentSession,
        currentPart,
        currentQueue,
        activeSongDisplay,
        upNextSongs,
        activeRole,
        selectedInstrument,
        isInstrumentCued,
        connectionStatus,
        errorMessage,
        loginRole,
        logoutRole,
        selectInstrument,
        navigateNext,
        navigatePrev,
        jumpToQueueItem,
        incrementLoop,
        decrementLoop,
        resetLoop,
        togglePause,
        switchActiveSession,
        switchActivePart,
        addSession,
        deleteSession,
        updateSession,
        addSongToLibrary,
        updateSongInLibrary,
        deleteSongFromLibrary,
        addSongToPartQueue,
        removeQueueItem,
        reorderQueueItems,
        saveInstanceOverride,
        updatePartController,
        resetAllToSeed,
      }}
    >
      {children}
    </StageContext.Provider>
  );
}

export function useStage() {
  const context = useContext(StageContext);
  if (!context) {
    throw new Error('useStage must be used within a StageProvider');
  }
  return context;
}
