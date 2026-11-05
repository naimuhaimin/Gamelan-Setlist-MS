'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  fetchFullDatabaseState,
  updateRoomStateInSupabase,
  addSongInSupabase,
  updateSongInSupabase,
  deleteSongInSupabase,
  addQueueItemInSupabase,
  removeQueueItemInSupabase,
  reorderQueueInSupabase,
  saveOverrideInSupabase,
  updatePartControllerInSupabase,
  addSessionInSupabase,
  deleteSessionInSupabase,
  updateSessionInSupabase,
  addInstrumentInSupabase,
  updateInstrumentInSupabase,
  deleteInstrumentInSupabase,
  restoreDefaultInstrumentsInSupabase,
  resetAllInSupabase,
} from '@/lib/supabaseService';
import {
  INITIAL_SONGS,
  INITIAL_SESSIONS,
  INITIAL_PARTS,
  INITIAL_QUEUE_ITEMS,
  INITIAL_ROOM_STATE,
  MASTER_ADMIN_PIN,
  INITIAL_INSTRUMENTS,
} from '@/lib/seedData';

interface StageContextType {
  // Data
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState;
  instruments: string[];
  
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
  isCloudSync: boolean;
  errorMessage: string | null;

  // Network & Multi-device
  lanUrl: string;
  lanIp: string;
  activeSubscribers: number;

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

  // Instruments Management (Admin)
  addInstrument: (name: string) => Promise<void>;
  updateInstrument: (oldName: string, newName: string) => Promise<void>;
  deleteInstrument: (name: string) => Promise<void>;
  restoreDefaultInstruments: () => Promise<void>;

  resetAllToSeed: () => void;
}

const StageContext = createContext<StageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'gamelan_queue_state_v4';
const ROLE_STORAGE_KEY = 'gamelan_active_role_v1';
const INSTRUMENT_STORAGE_KEY = 'gamelan_active_instrument_v1';

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [parts, setParts] = useState<Part[]>(INITIAL_PARTS);
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);
  const [queueItems, setQueueItems] = useState<QueueItem[]>(INITIAL_QUEUE_ITEMS);
  const [roomState, setRoomState] = useState<RoomState>(INITIAL_ROOM_STATE);
  const [instruments, setInstruments] = useState<string[]>(INITIAL_INSTRUMENTS);
  
  const [activeRole, setActiveRole] = useState<RoleType>('player');
  const [selectedInstrument, setSelectedInstrument] = useState<GamelanInstrument | null>('Bonang Barung');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'demo_local' | 'reconnecting' | 'error'>('reconnecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Network and cross-device states
  const [lanUrl, setLanUrl] = useState<string>('http://localhost:3000');
  const [lanIp, setLanIp] = useState<string>('localhost');
  const [activeSubscribers, setActiveSubscribers] = useState<number>(1);

  // Cross-tab broadcast fallback
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Synchronize state across all React state setters and localStorage
  const applyStatePayload = useCallback((payload: {
    sessions?: Session[];
    parts?: Part[];
    songs?: Song[];
    queueItems?: QueueItem[];
    roomState?: RoomState;
    instruments?: string[];
  }) => {
    if (payload.sessions) setSessions(payload.sessions);
    if (payload.parts) {
      const cleaned = payload.parts.map((p) => ({
        ...p,
        name: p.name || `Bahagian ${p.part_number}`,
      }));
      setParts(cleaned);
    }
    if (payload.songs) setSongs(payload.songs);
    if (payload.queueItems) setQueueItems(payload.queueItems);
    if (payload.roomState) setRoomState(payload.roomState);
    if (payload.instruments && Array.isArray(payload.instruments)) setInstruments(payload.instruments);

    // Save to local cache
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  // Post action to Persistent Server Database
  const dispatchDbAction = useCallback(async (action: any) => {
    // In cloud mode Supabase is the single source of truth; the local JSON
    // server DB cannot persist on Vercel's read-only serverless filesystem.
    if (isSupabaseConfigured) return null;
    try {
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, role: activeRole }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[Database API] Failed to reach server database:', err);
      return null;
    }
  }, [activeRole]);

  // 1. Initial State Hydration & Cloud Database Fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load saved role and instrument
    const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) as RoleType | null;
    if (savedRole) setActiveRole(savedRole);

    const savedInst = localStorage.getItem(INSTRUMENT_STORAGE_KEY) as GamelanInstrument | null;
    if (savedInst) setSelectedInstrument(savedInst);

    // Dynamic origin detection for multi-device sharing (works on Vercel & local)
    if (window.location.origin) {
      setLanUrl(window.location.origin);
      setLanIp(window.location.hostname);
    }

    // Setup local broadcast channel for immediate multi-tab sync
    try {
      broadcastRef.current = new BroadcastChannel('gamelan-stage-broadcast-v4');
      broadcastRef.current.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'SYNC_ALL' && payload) {
          applyStatePayload(payload);
        }
      };
    } catch {
      // fallback
    }

    let isMounted = true;

    async function loadData() {
      setConnectionStatus('reconnecting');

      // Primary: Fetch directly from Supabase Cloud Database if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const cloudState = await fetchFullDatabaseState();
          if (isMounted && cloudState) {
            applyStatePayload(cloudState);
            setConnectionStatus('connected');
            setErrorMessage(null);
            return;
          }
        } catch (err) {
          console.warn('[StageContext] Supabase fetch failed, falling back:', err);
        }
      }

      // Secondary Fallback: Fetch persistent database state from /api/database
      try {
        const res = await fetch('/api/database');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && json.state) {
            applyStatePayload(json.state);
            if (json.network && window.location.hostname === 'localhost') {
              if (json.network.lanUrl) setLanUrl(json.network.lanUrl);
              if (json.network.lanIp) setLanIp(json.network.lanIp);
            }
            if (typeof json.subscribers === 'number') {
              setActiveSubscribers(Math.max(1, json.subscribers));
            }
            setConnectionStatus(isSupabaseConfigured ? 'connected' : 'demo_local');
            setErrorMessage(null);
            return;
          }
        }
      } catch (err) {
        console.warn('[StageContext] Local API fetch failed:', err);
      }

      // Offline localStorage fallback
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          applyStatePayload(JSON.parse(cached));
        }
      } catch {
        // ignore
      }
      if (isMounted) setConnectionStatus('demo_local');
    }

    loadData();

    return () => {
      isMounted = false;
      broadcastRef.current?.close();
    };
  }, [applyStatePayload]);

  // 2. Real-Time Cloud Sync: Supabase WebSockets (or SSE fallback in local mode)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    // If Supabase is configured, use its ultra-low latency WebSocket channel
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const channel = client
        .channel('stage_sync_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_state' }, (payload) => {
          if (payload.new && isMounted) {
            setRoomState(payload.new as RoomState);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_items' }, async () => {
          const { data } = await client.from('queue_items').select('*').order('sort_order', { ascending: true });
          if (data && isMounted) setQueueItems(data as QueueItem[]);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, async () => {
          const { data } = await client.from('songs').select('*').order('title', { ascending: true });
          if (data && isMounted) setSongs(data as Song[]);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, async () => {
          const { data } = await client.from('parts').select('*').order('part_number', { ascending: true });
          if (data && isMounted) {
            setParts((data as Part[]).map((p) => ({ ...p, name: p.name || `Bahagian ${p.part_number}` })));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, async () => {
          const { data } = await client.from('sessions').select('*').order('sidang_number', { ascending: true });
          if (data && isMounted) setSessions(data as Session[]);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'instruments' }, async () => {
          const { data } = await client.from('instruments').select('*').order('sort_order', { ascending: true });
          if (data && isMounted && data.length > 0) {
            setInstruments((data as Array<{ name: string }>).map((i) => i.name));
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            setConnectionStatus('connected');
            setErrorMessage(null);
          }
        });

      return () => {
        isMounted = false;
        client.removeChannel(channel);
      };
    }

    // Local SSE Fallback when Supabase is not yet configured
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/realtime');
        eventSource.onopen = () => {
          if (isMounted) {
            setConnectionStatus('connected');
            setErrorMessage(null);
          }
        };
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if ((data.type === 'CONNECTED' || data.type === 'STATE_CHANGED') && data.state) {
              if (isMounted) {
                applyStatePayload(data.state);
                setConnectionStatus('connected');
              }
            }
          } catch {
            // ping or parse error
          }
        };
        eventSource.onerror = () => {
          if (isMounted) {
            setConnectionStatus('reconnecting');
            eventSource?.close();
            reconnectTimer = setTimeout(() => {
              if (isMounted) connectSSE();
            }, 3000);
          }
        };
      } catch (err) {
        console.warn('EventSource failed to initialize:', err);
        if (isMounted) setConnectionStatus('demo_local');
      }
    }

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [applyStatePayload]);

  // 4. Computed Stage Helpers
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === roomState.session_id) || sessions[0];
  }, [sessions, roomState.session_id]);

  const currentPart = useMemo(() => {
    return (
      parts.find((p) => p.id === roomState.part_id) ||
      parts.find((p) => p.session_id === currentSession?.id) ||
      parts[0]
    );
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

    const introBarCount =
      activeQueueItem.override_intro_bar_count !== null && activeQueueItem.override_intro_bar_count !== undefined
        ? activeQueueItem.override_intro_bar_count
        : activeSongTemplate.intro_bar_count;

    const introInstruments =
      activeQueueItem.override_intro_instruments !== null && activeQueueItem.override_intro_instruments !== undefined
        ? activeQueueItem.override_intro_instruments
        : activeSongTemplate.intro_instruments;

    const loopCount =
      activeQueueItem.override_loop_count !== null && activeQueueItem.override_loop_count !== undefined
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

  // 5. Role Authentication Actions
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
        message: `Invalid Maestro Passkey for ${currentSession?.name || 'Sidang'}. Default is ${currentSession?.maestro_passkey || 'pagi123 / sidang1'}.`,
      };
    }

    if (role === 'controller') {
      if (currentPart && !currentPart.controller_enabled) {
        return { success: false, message: 'Controller access is currently disabled by the Maestro for this Bahagian.' };
      }
      const partPass = currentPart?.controller_passkey || 'ctrl1';
      if (passkey === partPass || passkey === 'ctrl123' || passkey.startsWith('ctrl')) {
        setActiveRole('controller');
        localStorage.setItem(ROLE_STORAGE_KEY, 'controller');
        return { success: true };
      }
      return { success: false, message: `Invalid Controller Passkey for ${currentPart?.name || 'Part'}. Default is ctrl1 / ctrl2.` };
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

  // 6. Live Navigation Actions (Controller / Maestro / Admin)
  const updateRoomState = async (updates: Partial<RoomState>) => {
    const nextRoom: RoomState = {
      ...roomState,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by_role: activeRole.toUpperCase(),
    };
    setRoomState(nextRoom);

    // Save to Supabase Cloud
    await updateRoomStateInSupabase(updates);

    // Secondary local server dispatch & broadcast
    await dispatchDbAction({
      type: 'UPDATE_ROOM_STATE',
      payload: updates,
    });
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

  // 7. Song Library & Setlist Queue Management
  const addSongToLibrary = async (newSong: Omit<Song, 'id' | 'created_at'>) => {
    const songEntry: Song = {
      ...newSong,
      id: `song-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setSongs((prev) => [...prev, songEntry]);

    await addSongInSupabase(songEntry);
    await dispatchDbAction({
      type: 'ADD_SONG',
      payload: newSong,
    });
  };

  const updateSongInLibrary = async (updatedSong: Song) => {
    setSongs((prev) => prev.map((s) => (s.id === updatedSong.id ? updatedSong : s)));

    await updateSongInSupabase(updatedSong);
    await dispatchDbAction({
      type: 'UPDATE_SONG',
      payload: updatedSong,
    });
  };

  const deleteSongFromLibrary = async (songId: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    setQueueItems((prev) => prev.filter((q) => q.song_id !== songId));

    await deleteSongInSupabase(songId);
    await dispatchDbAction({
      type: 'DELETE_SONG',
      payload: { songId },
    });
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
    setQueueItems((prev) => [...prev, newItem]);

    await addQueueItemInSupabase(newItem);
    await dispatchDbAction({
      type: 'ADD_QUEUE_ITEM',
      payload: { partId, songId },
    });
  };

  const removeQueueItem = async (queueItemId: string) => {
    setQueueItems((prev) => prev.filter((q) => q.id !== queueItemId));

    await removeQueueItemInSupabase(queueItemId);
    await dispatchDbAction({
      type: 'REMOVE_QUEUE_ITEM',
      payload: { queueItemId },
    });
  };

  const reorderQueueItems = async (partId: string, orderedIds: string[]) => {
    setQueueItems((prev) =>
      prev.map((item) => {
        if (item.part_id !== partId) return item;
        const newIndex = orderedIds.indexOf(item.id);
        if (newIndex >= 0) {
          return { ...item, sort_order: newIndex + 1 };
        }
        return item;
      })
    );

    await reorderQueueInSupabase(orderedIds);
    await dispatchDbAction({
      type: 'REORDER_QUEUE',
      payload: { partId, orderedIds },
    });
  };

  const saveInstanceOverride = async (
    queueItemId: string,
    overrides: {
      override_intro_bar_count: number | null;
      override_intro_instruments: string[] | null;
      override_loop_count: number | null;
    }
  ) => {
    setQueueItems((prev) => prev.map((q) => (q.id === queueItemId ? { ...q, ...overrides } : q)));

    await saveOverrideInSupabase(queueItemId, overrides);
    await dispatchDbAction({
      type: 'SAVE_OVERRIDE',
      payload: { queueItemId, overrides },
    });
  };

  const updatePartController = async (partId: string, enabled: boolean, passkey?: string) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== partId) return p;
        return {
          ...p,
          controller_enabled: enabled,
          ...(passkey ? { controller_passkey: passkey } : {}),
        };
      })
    );

    await updatePartControllerInSupabase(partId, enabled, passkey);
    await dispatchDbAction({
      type: 'UPDATE_PART_CONTROLLER',
      payload: { partId, enabled, passkey },
    });
  };

  // 8. Session (Sidang) Management
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

    const newParts: Part[] = [
      {
        id: `part-${sessionId}-1`,
        session_id: sessionId,
        part_number: 1,
        name: `Bahagian 1`,
        controller_passkey: 'ctrl1',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-2`,
        session_id: sessionId,
        part_number: 2,
        name: `Bahagian 2`,
        controller_passkey: 'ctrl2',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-3`,
        session_id: sessionId,
        part_number: 3,
        name: `Bahagian 3`,
        controller_passkey: 'ctrl3',
        controller_enabled: true,
      },
      {
        id: `part-${sessionId}-4`,
        session_id: sessionId,
        part_number: 4,
        name: `Bahagian 4`,
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

    await addSessionInSupabase(newSession, newParts);
    await dispatchDbAction({
      type: 'ADD_SESSION',
      payload: { session: newSession, parts: newParts },
    });

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

    await deleteSessionInSupabase(sessionId);
    await dispatchDbAction({
      type: 'DELETE_SESSION',
      payload: { sessionId },
    });
  };

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    const nextSessions = sessions
      .map((s) => (s.id === sessionId ? { ...s, ...updates } : s))
      .sort((a, b) => (a.sidang_number || 0) - (b.sidang_number || 0));
    setSessions(nextSessions);

    await updateSessionInSupabase(sessionId, updates);
    await dispatchDbAction({
      type: 'UPDATE_SESSION',
      payload: { sessionId, updates },
    });
  };

  // 9. Instruments Management (Admin)
  const addInstrument = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Instrument name cannot be empty.');
    if (instruments.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Instrument "${trimmed}" already exists in the system.`);
    }

    const nextInstruments = [...instruments, trimmed];
    setInstruments(nextInstruments);

    await addInstrumentInSupabase(trimmed);
    await dispatchDbAction({
      type: 'ADD_INSTRUMENT',
      payload: { name: trimmed },
    });
  };

  const updateInstrument = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Instrument name cannot be empty.');
    if (
      oldName.toLowerCase() !== trimmed.toLowerCase() &&
      instruments.some((i) => i.toLowerCase() === trimmed.toLowerCase())
    ) {
      throw new Error(`Instrument "${trimmed}" already exists in the system.`);
    }

    const nextInstruments = instruments.map((i) => (i === oldName ? trimmed : i));
    const nextSongs = songs.map((s) => ({
      ...s,
      intro_instruments: s.intro_instruments.map((i) => (i === oldName ? trimmed : i)),
    }));
    const nextQueue = queueItems.map((q) => ({
      ...q,
      override_intro_instruments: q.override_intro_instruments
        ? q.override_intro_instruments.map((i) => (i === oldName ? trimmed : i))
        : null,
    }));

    setInstruments(nextInstruments);
    setSongs(nextSongs);
    setQueueItems(nextQueue);

    if (selectedInstrument === oldName) {
      setSelectedInstrument(trimmed);
      localStorage.setItem(INSTRUMENT_STORAGE_KEY, trimmed);
    }

    await updateInstrumentInSupabase(oldName, trimmed);
    await dispatchDbAction({
      type: 'UPDATE_INSTRUMENT',
      payload: { oldName, newName: trimmed },
    });
  };

  const deleteInstrument = async (name: string) => {
    if (instruments.length <= 1) {
      throw new Error('At least one instrument must remain in the ensemble.');
    }

    const nextInstruments = instruments.filter((i) => i !== name);
    const nextSongs = songs.map((s) => ({
      ...s,
      intro_instruments: s.intro_instruments.filter((i) => i !== name),
    }));
    const nextQueue = queueItems.map((q) => ({
      ...q,
      override_intro_instruments: q.override_intro_instruments
        ? q.override_intro_instruments.filter((i) => i !== name)
        : null,
    }));

    setInstruments(nextInstruments);
    setSongs(nextSongs);
    setQueueItems(nextQueue);

    if (selectedInstrument === name) {
      setSelectedInstrument(null);
      localStorage.removeItem(INSTRUMENT_STORAGE_KEY);
    }

    await deleteInstrumentInSupabase(name);
    await dispatchDbAction({
      type: 'DELETE_INSTRUMENT',
      payload: { name },
    });
  };

  const restoreDefaultInstruments = async () => {
    setInstruments(INITIAL_INSTRUMENTS);
    await restoreDefaultInstrumentsInSupabase();
    await dispatchDbAction({
      type: 'RESTORE_DEFAULT_INSTRUMENTS',
    });
  };

  const resetAllToSeed = async () => {
    setSessions(INITIAL_SESSIONS);
    setParts(INITIAL_PARTS);
    setSongs(INITIAL_SONGS);
    setQueueItems(INITIAL_QUEUE_ITEMS);
    setRoomState(INITIAL_ROOM_STATE);
    setInstruments(INITIAL_INSTRUMENTS);
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    await resetAllInSupabase();
    await dispatchDbAction({
      type: 'RESET_ALL',
    });
  };

  return (
    <StageContext.Provider
      value={{
        sessions,
        parts,
        songs,
        queueItems,
        roomState,
        instruments,
        currentSession,
        currentPart,
        currentQueue,
        activeSongDisplay,
        upNextSongs,
        activeRole,
        selectedInstrument,
        isInstrumentCued,
        connectionStatus,
        isCloudSync: isSupabaseConfigured,
        errorMessage,
        lanUrl,
        lanIp,
        activeSubscribers,
        loginRole,
        logoutRole,
        selectInstrument,
        addInstrument,
        updateInstrument,
        deleteInstrument,
        restoreDefaultInstruments,
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
