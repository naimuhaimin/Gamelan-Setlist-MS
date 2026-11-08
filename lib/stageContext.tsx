'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DatabaseSnapshot,
  Part,
  QueueItem,
  ResolvedQueueItem,
  RoleRow,
  RoleType,
  RoomState,
  Session,
  Song,
} from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import * as api from '@/lib/supabaseService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = 'connecting' | 'live' | 'offline';
export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

type Overrides = Pick<
  QueueItem,
  'override_intro_bar_count' | 'override_intro_unit' | 'override_intro_instruments' | 'override_loop_count'
>;

interface StageContextType {
  // Data
  loaded: boolean;
  loadError: string | null;
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  instruments: string[];
  roomState: RoomState;
  connection: ConnectionState;

  // Live stage (derived)
  liveSession: Session | undefined;
  livePart: Part | undefined;
  liveQueue: ResolvedQueueItem[];
  activeIndex: number; // -1 when the Bahagian is empty
  activeItem: ResolvedQueueItem | null;
  nextPart: Part | undefined; // following Bahagian in the live Sidang, if any
  resolveQueue: (partId: string) => ResolvedQueueItem[];

  // Identity
  role: RoleType;
  isManager: boolean; // maestro or admin
  canControl: boolean;
  canSwitchLive: boolean; // choose which Sidang/Bahagian is live (controller, maestro, admin)
  controlBlockedReason: string | null;
  selectedInstrument: string | null;
  instrumentChosen: boolean;
  isCued: (instruments: string[]) => boolean;
  login: (role: Exclude<RoleType, 'player'>, passkey: string) => { ok: boolean; message?: string };
  logout: () => void;
  selectInstrument: (instrument: string | null) => void;
  rolePasskey: (role: RoleType) => string;

  // Live controls
  goNext: () => void;
  goPrev: () => void;
  jumpTo: (queueItemId: string) => void;
  changeLoop: (delta: number) => void;
  resetLoop: () => void;
  togglePause: () => void;
  goLive: (partId: string) => Promise<void>;

  // Setlists
  addToQueue: (partId: string, songId: string) => Promise<void>;
  removeFromQueue: (queueItemId: string) => Promise<void>;
  moveQueueItem: (partId: string, fromIndex: number, toIndex: number) => Promise<void>;
  saveOverride: (queueItemId: string, overrides: Overrides) => Promise<void>;

  // Sidang & Bahagian
  createSession: (input: { sidangNumber: number; name: string; date: string }) => Promise<Session>;
  editSession: (sessionId: string, updates: Partial<Pick<Session, 'name' | 'date'>>) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  editPart: (partId: string, updates: Partial<Pick<Part, 'controller_enabled' | 'controller_passkey'>>) => Promise<void>;

  // Library
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  editSong: (song: Song) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;

  // Instruments (admin)
  addInstrument: (name: string) => Promise<void>;
  renameInstrument: (oldName: string, newName: string) => Promise<void>;
  removeInstrument: (name: string) => Promise<void>;
  moveInstrument: (fromIndex: number, toIndex: number) => Promise<void>;

  // Access (admin)
  setRolePasskey: (role: RoleType, passkey: string) => Promise<void>;

  // Feedback
  toasts: Toast[];
  notify: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  reload: () => Promise<void>;
}

const StageContext = createContext<StageContextType | undefined>(undefined);

const AUTH_KEY = 'gamelan_auth_v2';
const INSTRUMENT_KEY = 'gamelan_instrument_v2';

const EMPTY_ROOM: RoomState = {
  id: api.ROOM_ID,
  session_id: null,
  part_id: null,
  current_queue_item_id: null,
  current_loop_iteration: 1,
  is_paused: false,
  updated_at: new Date(0).toISOString(),
  updated_by_role: 'SYSTEM',
};

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function safeStorage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function resolveItem(q: QueueItem, song: Song): ResolvedQueueItem {
  return {
    queueItem: q,
    song,
    introBarCount: q.override_intro_bar_count ?? song.intro_bar_count,
    introUnit: q.override_intro_bar_count !== null ? q.override_intro_unit ?? song.intro_unit : song.intro_unit,
    introInstruments: q.override_intro_instruments ?? song.intro_instruments,
    loopCount: q.override_loop_count ?? song.loop_count,
    hasOverride:
      q.override_intro_bar_count !== null ||
      q.override_intro_instruments !== null ||
      q.override_loop_count !== null,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roomState, setRoomState] = useState<RoomState>(EMPTY_ROOM);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  const [role, setRole] = useState<RoleType>('player');
  const [authPasskey, setAuthPasskey] = useState<string>('');
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [instrumentChosen, setInstrumentChosen] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // ---- Feedback -----------------------------------------------------------
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (message: string, kind: Toast['kind'] = 'success') => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, kind, message }]);
      setTimeout(() => dismissToast(id), kind === 'error' ? 6000 : 2800);
    },
    [dismissToast]
  );

  // ---- Loading ------------------------------------------------------------
  const applySnapshot = useCallback((s: DatabaseSnapshot) => {
    setSessions(s.sessions);
    setParts(s.parts);
    setSongs(s.songs);
    setQueueItems(s.queueItems);
    setInstruments(s.instruments);
    setRoles(s.roles);
    setRoomState(s.roomState ?? EMPTY_ROOM);
  }, []);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('The database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      setLoaded(true);
      setConnection('offline');
      return;
    }
    try {
      applySnapshot(await api.fetchSnapshot());
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [applySnapshot]);

  // Restore identity from this device
  useEffect(() => {
    const auth = safeStorage(() => JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'), null) as
      | { role: RoleType; passkey: string }
      | null;
    if (auth?.role) {
      setRole(auth.role);
      setAuthPasskey(auth.passkey || '');
    }
    const inst = safeStorage(() => localStorage.getItem(INSTRUMENT_KEY), null);
    if (inst === null) setInstrumentChosen(false);
    else setSelectedInstrument(inst === '' ? null : inst);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ---- Realtime -----------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const debounced = (key: string, fn: () => Promise<void>) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => fn().catch(() => undefined), 120);
    };

    const channel = client
      .channel('stage_sync_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_state' }, (payload) => {
        if (payload.new && (payload.new as RoomState).id) setRoomState(payload.new as RoomState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_items' }, () =>
        debounced('queue', async () => setQueueItems(await api.fetchQueueItems()))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () =>
        debounced('songs', async () => setSongs(await api.fetchSongs()))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () =>
        debounced('parts', async () => setParts(await api.fetchParts()))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () =>
        debounced('sessions', async () => setSessions(await api.fetchSessions()))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instruments' }, () =>
        debounced('instruments', async () => setInstruments(await api.fetchInstruments()))
      )
      // (roles is not in the realtime publication; passkeys are re-read on every resync instead)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          // Catch up on anything missed while disconnected
          reload();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline');
        }
      });

    // Phones drop websockets while asleep: resync when the screen comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const onOnline = () => reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', () => setConnection('offline'));

    return () => {
      Object.values(timers).forEach(clearTimeout);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      client.removeChannel(channel);
    };
  }, [reload]);

  // ---- Derived stage ------------------------------------------------------
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const resolveQueue = useCallback(
    (partId: string) =>
      queueItems
        .filter((q) => q.part_id === partId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((q) => {
          const song = songById.get(q.song_id);
          return song ? [resolveItem(q, song)] : [];
        }),
    [queueItems, songById]
  );

  const liveSession = useMemo(() => sessions.find((s) => s.id === roomState.session_id), [sessions, roomState.session_id]);
  const livePart = useMemo(() => parts.find((p) => p.id === roomState.part_id), [parts, roomState.part_id]);
  const liveQueue = useMemo(() => (livePart ? resolveQueue(livePart.id) : []), [livePart, resolveQueue]);
  const activeIndex = useMemo(() => {
    if (!liveQueue.length) return -1;
    const i = liveQueue.findIndex((r) => r.queueItem.id === roomState.current_queue_item_id);
    return i >= 0 ? i : 0;
  }, [liveQueue, roomState.current_queue_item_id]);
  const activeItem = activeIndex >= 0 ? liveQueue[activeIndex] : null;
  const nextPart = useMemo(() => {
    if (!livePart) return undefined;
    return parts
      .filter((p) => p.session_id === livePart.session_id && p.part_number > livePart.part_number)
      .sort((a, b) => a.part_number - b.part_number)[0];
  }, [parts, livePart]);

  // ---- Identity & permissions ---------------------------------------------
  const rolePasskey = useCallback((r: RoleType) => roles.find((x) => x.role_name === r)?.passkey?.trim() || '', [roles]);

  const isManager = role === 'maestro' || role === 'admin';
  const canSwitchLive = isManager || role === 'controller';

  // Controller works only while the live Bahagian's controller access is switched on by the Maestro.
  const { canControl, controlBlockedReason } = useMemo(() => {
    if (isManager) return { canControl: true, controlBlockedReason: null };
    if (role !== 'controller') return { canControl: false, controlBlockedReason: null };
    if (!livePart) return { canControl: false, controlBlockedReason: 'Nothing is live yet. Choose a Sidang and Bahagian.' };
    if (!livePart.controller_enabled)
      return { canControl: false, controlBlockedReason: `The Maestro has locked controls for ${livePart.name}.` };
    return { canControl: true, controlBlockedReason: null };
  }, [isManager, role, livePart]);

  const persistAuth = (r: RoleType, key: string) =>
    safeStorage(() => localStorage.setItem(AUTH_KEY, JSON.stringify({ role: r, passkey: key })), undefined);

  /** Only Admin needs a passkey; Controller and Maestro are open by design. */
  const needsPasskey = (r: RoleType) => r === 'admin';

  const checkPasskey = useCallback(
    (r: RoleType, key: string): boolean => {
      if (r === 'controller' || r === 'maestro') return true;
      if (r === 'admin') return !!key.trim() && !!rolePasskey('admin') && eq(rolePasskey('admin'), key);
      return false;
    },
    [rolePasskey]
  );

  // Re-validate a remembered sign-in once data is loaded (passkeys may have changed)
  useEffect(() => {
    if (!loaded || loadError || role === 'player') return;
    if (!checkPasskey(role, authPasskey)) {
      setRole('player');
      setAuthPasskey('');
      persistAuth('player', '');
    }
  }, [loaded, loadError, role, authPasskey, checkPasskey]);

  const login = (r: Exclude<RoleType, 'player'>, key: string) => {
    if (r === 'admin' && !rolePasskey('admin'))
      return { ok: false, message: 'No Admin passkey is set in the database yet.' };
    if (!checkPasskey(r, key)) return { ok: false, message: 'That passkey is not correct.' };
    const stored = needsPasskey(r) ? key.trim() : '';
    setRole(r);
    setAuthPasskey(stored);
    persistAuth(r, stored);
    return { ok: true };
  };

  const logout = () => {
    setRole('player');
    setAuthPasskey('');
    persistAuth('player', '');
  };

  const selectInstrument = (inst: string | null) => {
    setSelectedInstrument(inst);
    setInstrumentChosen(true);
    safeStorage(() => localStorage.setItem(INSTRUMENT_KEY, inst ?? ''), undefined);
  };

  // Forget an instrument that no longer exists
  useEffect(() => {
    if (loaded && selectedInstrument && instruments.length && !instruments.includes(selectedInstrument)) {
      setSelectedInstrument(null);
      setInstrumentChosen(false);
    }
  }, [loaded, instruments, selectedInstrument]);

  const isCued = useCallback(
    (list: string[]) => !!selectedInstrument && list.includes(selectedInstrument),
    [selectedInstrument]
  );

  // ---- Write helper: optimistic local change, then DB; resync on failure ----
  const commit = useCallback(
    async (remote: () => Promise<void>, opts: { success?: string; rethrow?: boolean } = {}) => {
      try {
        await remote();
        if (opts.success) notify(opts.success);
      } catch (err) {
        notify(`Not saved: ${(err as Error).message}`, 'error');
        reload();
        if (opts.rethrow) throw err;
      }
    },
    [notify, reload]
  );

  // ---- Live controls --------------------------------------------------------
  const roomRef = useRef(roomState);
  roomRef.current = roomState;

  const setRoom = (updates: Partial<RoomState>) => {
    const by = role.toUpperCase();
    setRoomState((prev) => ({ ...prev, ...updates, updated_by_role: by, updated_at: new Date().toISOString() }));
    return commit(() => api.updateRoomState({ ...updates, updated_by_role: by }));
  };

  const goToIndex = (i: number) => {
    if (!canControl || i < 0 || i >= liveQueue.length) return;
    setRoom({ current_queue_item_id: liveQueue[i].queueItem.id, current_loop_iteration: 1 });
  };
  const goNext = () => goToIndex(activeIndex + 1);
  const goPrev = () => goToIndex(activeIndex - 1);
  const jumpTo = (id: string) => goToIndex(liveQueue.findIndex((r) => r.queueItem.id === id));
  const changeLoop = (delta: number) => {
    if (!canControl || !activeItem) return;
    const next = Math.max(1, (roomRef.current.current_loop_iteration || 1) + delta);
    roomRef.current = { ...roomRef.current, current_loop_iteration: next };
    setRoom({ current_loop_iteration: next });
  };
  const resetLoop = () => canControl && setRoom({ current_loop_iteration: 1 });
  const togglePause = () => canControl && setRoom({ is_paused: !roomState.is_paused });

  const goLive = async (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part || !canSwitchLive) return;
    const first = resolveQueue(partId)[0];
    await setRoom({
      session_id: part.session_id,
      part_id: part.id,
      current_queue_item_id: first ? first.queueItem.id : null,
      current_loop_iteration: 1,
      is_paused: false,
    });
  };

  // ---- Setlists --------------------------------------------------------------
  const addToQueue = async (partId: string, songId: string) => {
    const existing = queueItems.filter((q) => q.part_id === partId);
    const item: QueueItem = {
      id: api.newId('q'),
      part_id: partId,
      song_id: songId,
      sort_order: existing.reduce((m, q) => Math.max(m, q.sort_order), 0) + 1,
      override_intro_bar_count: null,
      override_intro_unit: null,
      override_intro_instruments: null,
      override_loop_count: null,
    };
    setQueueItems((prev) => [...prev, item]);
    await commit(() => api.insertQueueItem(item));
  };

  const removeFromQueue = async (id: string) => {
    setQueueItems((prev) => prev.filter((q) => q.id !== id));
    await commit(() => api.deleteQueueItem(id));
  };

  const moveQueueItem = async (partId: string, from: number, to: number) => {
    const ordered = queueItems.filter((q) => q.part_id === partId).sort((a, b) => a.sort_order - b.sort_order);
    if (to < 0 || to >= ordered.length || from === to) return;
    const ids = moveItem(ordered, from, to).map((q) => q.id);
    setQueueItems((prev) =>
      prev.map((q) => (q.part_id === partId && ids.includes(q.id) ? { ...q, sort_order: ids.indexOf(q.id) + 1 } : q))
    );
    await commit(() => api.reorderQueue(ids));
  };

  const saveOverride = async (id: string, overrides: Overrides) => {
    setQueueItems((prev) => prev.map((q) => (q.id === id ? { ...q, ...overrides } : q)));
    await commit(() => api.saveOverride(id, overrides), { success: 'Override saved', rethrow: true });
  };

  // ---- Sidang & Bahagian -------------------------------------------------------
  const createSession: StageContextType['createSession'] = async ({ sidangNumber, name, date }) => {
    const id = api.newId(`session-${sidangNumber}`);
    const session: Session = {
      id,
      sidang_number: sidangNumber,
      name: name.trim() || `Sidang ${sidangNumber}`,
      code: `S${sidangNumber}`,
      date,
      maestro_passkey: '', // legacy column; Maestro sign-in uses the global passkey
    };
    // No guessable default: controllers use the master controller passkey until the Maestro sets one per Bahagian.
    const newParts: Part[] = [1, 2, 3, 4].map((n) => ({
      id: `part-${id}-${n}`,
      session_id: id,
      part_number: n,
      name: `Bahagian ${n}`,
      controller_passkey: '',
      controller_enabled: true,
    }));
    await commit(() => api.insertSession(session, newParts), { success: `${session.name} created`, rethrow: true });
    setSessions((prev) => [...prev, session].sort((a, b) => a.sidang_number - b.sidang_number));
    setParts((prev) => [...prev, ...newParts]);
    return session;
  };

  const editSession: StageContextType['editSession'] = async (id, updates) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    await commit(() => api.updateSession(id, updates), { success: 'Sidang updated', rethrow: true });
  };

  const removeSession = async (id: string) => {
    const goneParts = new Set(parts.filter((p) => p.session_id === id).map((p) => p.id));
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setParts((prev) => prev.filter((p) => p.session_id !== id));
    setQueueItems((prev) => prev.filter((q) => !goneParts.has(q.part_id)));
    await commit(async () => {
      if (roomState.session_id === id) {
        await api.updateRoomState({ session_id: null, part_id: null, current_queue_item_id: null, current_loop_iteration: 1 });
      }
      await api.deleteSession(id);
    }, { success: 'Sidang deleted' });
  };

  const editPart: StageContextType['editPart'] = async (id, updates) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    await commit(() => api.updatePart(id, updates), { success: 'Controller settings saved' });
  };

  // ---- Library -----------------------------------------------------------------
  const addSong: StageContextType['addSong'] = async (input) => {
    const song: Song = { ...input, id: api.newId('song'), created_at: new Date().toISOString() };
    await commit(() => api.insertSong(song), { success: `“${song.title}” added`, rethrow: true });
    setSongs((prev) => api.sortSongs([...prev, song]));
  };

  const editSong = async (song: Song) => {
    setSongs((prev) => api.sortSongs(prev.map((s) => (s.id === song.id ? song : s))));
    await commit(() => api.updateSong(song), { success: 'Song updated', rethrow: true });
  };

  const removeSong = async (id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    setQueueItems((prev) => prev.filter((q) => q.song_id !== id));
    await commit(() => api.deleteSong(id), { success: 'Song deleted' });
  };

  // ---- Instruments ---------------------------------------------------------------
  const addInstrument = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Enter an instrument name.');
    if (instruments.some((i) => eq(i, trimmed))) throw new Error(`“${trimmed}” already exists.`);
    await commit(() => api.insertInstrument(trimmed, instruments.length + 1), { success: `${trimmed} added`, rethrow: true });
    setInstruments((prev) => [...prev, trimmed]);
  };

  const renameInstrument = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Enter an instrument name.');
    if (trimmed === oldName) return;
    if (instruments.some((i) => i !== oldName && eq(i, trimmed))) throw new Error(`“${trimmed}” already exists.`);
    const swap = (list: string[]) => list.map((i) => (i === oldName ? trimmed : i));
    setInstruments(swap);
    setSongs((prev) => prev.map((s) => ({ ...s, intro_instruments: swap(s.intro_instruments) })));
    setQueueItems((prev) =>
      prev.map((q) => (q.override_intro_instruments ? { ...q, override_intro_instruments: swap(q.override_intro_instruments) } : q))
    );
    if (selectedInstrument === oldName) selectInstrument(trimmed);
    await commit(() => api.renameInstrument(oldName, trimmed), { success: 'Instrument renamed', rethrow: true });
  };

  const removeInstrument = async (name: string) => {
    const drop = (list: string[]) => list.filter((i) => i !== name);
    setInstruments(drop);
    setSongs((prev) => prev.map((s) => ({ ...s, intro_instruments: drop(s.intro_instruments) })));
    setQueueItems((prev) =>
      prev.map((q) => (q.override_intro_instruments ? { ...q, override_intro_instruments: drop(q.override_intro_instruments) } : q))
    );
    await commit(() => api.deleteInstrument(name), { success: `${name} removed` });
  };

  const moveInstrument = async (from: number, to: number) => {
    if (to < 0 || to >= instruments.length) return;
    const next = moveItem(instruments, from, to);
    setInstruments(next);
    await commit(() => api.reorderInstruments(next));
  };

  // ---- Access --------------------------------------------------------------------
  const setRolePasskey = async (r: RoleType, passkey: string) => {
    const key = passkey.trim();
    setRoles((prev) => [...prev.filter((x) => x.role_name !== r), { role_name: r, passkey: key }]);
    await commit(() => api.updateRolePasskey(r, key), { success: 'Passkey updated', rethrow: true });
    if (r === role) {
      setAuthPasskey(key);
      persistAuth(r, key);
    }
  };

  const value: StageContextType = {
    loaded,
    loadError,
    sessions,
    parts,
    songs,
    queueItems,
    instruments,
    roomState,
    connection,
    liveSession,
    livePart,
    liveQueue,
    activeIndex,
    activeItem,
    nextPart,
    resolveQueue,
    role,
    isManager,
    canControl,
    canSwitchLive,
    controlBlockedReason,
    selectedInstrument,
    instrumentChosen,
    isCued,
    login,
    logout,
    selectInstrument,
    rolePasskey,
    goNext,
    goPrev,
    jumpTo,
    changeLoop,
    resetLoop,
    togglePause,
    goLive,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    saveOverride,
    createSession,
    editSession,
    removeSession,
    editPart,
    addSong,
    editSong,
    removeSong,
    addInstrument,
    renameInstrument,
    removeInstrument,
    moveInstrument,
    setRolePasskey,
    toasts,
    notify,
    dismissToast,
    reload,
  };

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error('useStage must be used within a StageProvider');
  return ctx;
}
