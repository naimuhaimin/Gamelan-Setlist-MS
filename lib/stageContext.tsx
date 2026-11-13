'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ConvoEvent,
  DatabaseSnapshot,
  Interlude,
  QueueVote,
  VoteTally,
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
import { tr, useT } from '@/lib/i18n';

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
  instrumentSlogans: Record<string, string>; // Admin-written catchphrases (built-in ones fill the gaps)
  slogansEditable: boolean; // false until the instruments.slogan column exists
  notesEnabled: boolean; // false until the songs.notes column exists
  playLogEnabled: boolean; // false until the play_log table exists
  roomState: RoomState;
  connection: ConnectionState;

  // Live stage (derived)
  liveSession: Session | undefined;
  liveEvent: ConvoEvent | undefined;
  events: ConvoEvent[];
  eventsEnabled: boolean; // false until the events table exists
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
  isFinished: boolean; // live Bahagian has ended: no song is playing
  finishPart: () => void;

  // Intermission between Bahagian (guest performers, e.g. Kumpulan Kombo Fakulti Muzik)
  interludeFor: (part: Part) => Interlude | null; // null after the last Bahagian or when set to 0 songs
  liveInterlude: Interlude | null; // the live Bahagian has ended and its intermission is on
  stageLive: boolean; // something is on stage: a Bahagian playing or its intermission
  interludeDone: number; // intermission songs performed so far
  interludeTracking: boolean; // false until the interlude_done column exists
  interludeEditable: boolean; // false until the parts.interlude_* columns exist
  setInterludeDone: (n: number) => void;
  editInterlude: (partId: string, label: string, songs: number) => Promise<void>;

  // Setlists
  addToQueue: (partId: string, songId: string) => Promise<void>;
  /** Emergency add during a live Bahagian (controller too): right after the current item, or at the end. */
  addLiveSong: (songId: string, where: 'next' | 'end') => Promise<void>;
  /** Replace whole Bahagian setlists at once (Paste setlist). Maestro/Admin. */
  replaceSetlists: (
    entries: Array<{ partId: string; items: Array<{ kind: 'song'; songId: string } | { kind: 'break'; label: string }> }>
  ) => Promise<void>;
  /** Move an upcoming item of the live Bahagian up (-1) or down (+1); never before the current item. Controller too. */
  moveLiveItem: (queueItemId: string, delta: -1 | 1) => Promise<void>;
  removeFromQueue: (queueItemId: string) => Promise<void>;
  moveQueueItem: (partId: string, fromIndex: number, toIndex: number) => Promise<void>;
  saveOverride: (queueItemId: string, overrides: Overrides) => Promise<void>;

  // Sidang & Bahagian
  createSession: (input: { eventId: string | null; sidangNumber: number; name: string; date: string }) => Promise<Session>;

  // Konvo
  createEvent: (input: { name: string; venue: string; startDate: string; endDate: string; thumbnail: File | null }) => Promise<ConvoEvent>;
  editEvent: (
    id: string,
    input: { name: string; venue: string; startDate: string; endDate: string; thumbnail: File | null; removeThumbnail?: boolean }
  ) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;

  // Breaks
  addBreak: (partId: string, label: string, minutes: number | null) => Promise<void>;
  editBreak: (queueItemId: string, label: string, minutes: number | null) => Promise<void>;
  editSession: (sessionId: string, updates: Partial<Pick<Session, 'name' | 'date'>>) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  editPart: (
    partId: string,
    updates: Partial<Pick<Part, 'controller_enabled' | 'controller_passkey' | 'interlude_label' | 'interlude_songs'>>
  ) => Promise<void>;

  // Library
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  editSong: (song: Song) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;

  // Instruments (admin)
  addInstrument: (name: string) => Promise<void>;
  renameInstrument: (oldName: string, newName: string) => Promise<void>;
  setInstrumentSlogan: (name: string, slogan: string) => Promise<void>;
  removeInstrument: (name: string) => Promise<void>;
  moveInstrument: (fromIndex: number, toIndex: number) => Promise<void>;

  // Access (admin)
  setRolePasskey: (role: RoleType, passkey: string) => Promise<void>;

  // Ratings (anonymous, one per device per setlist position)
  votesEnabled: boolean;
  tally: (queueItemId: string) => VoteTally;
  songTally: (songId: string) => { up: number; down: number };
  vote: (queueItemId: string, value: 1 | -1) => void;

  // Feedback
  toasts: Toast[];
  notify: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  reload: () => Promise<void>;
}

const StageContext = createContext<StageContextType | undefined>(undefined);

const AUTH_KEY = 'gamelan_auth_v2';
const DEVICE_KEY = 'gamelan_device_id';
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

/** Default intermission after Bahagian N (songs by the guest group); overridable per Bahagian. */
export const DEFAULT_INTERLUDE_LABEL = 'Kumpulan Kombo Fakulti Muzik';
const DEFAULT_INTERLUDE_SONGS: Record<number, number> = { 1: 1, 2: 2, 3: 1 };

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

export function resolveBreak(q: QueueItem): ResolvedQueueItem {
  const label = q.break_label?.trim() || 'Break';
  return {
    queueItem: q,
    song: { id: `break:${q.id}`, title: label, intro_bar_count: 0, intro_unit: 'bars', intro_instruments: [], loop_count: 0, rhythms: [] },
    isBreak: true,
    breakMinutes: q.break_minutes,
    introBarCount: 0,
    introUnit: 'bars',
    introInstruments: [],
    loopCount: 0,
    hasOverride: false,
  };
}

export function resolveItem(q: QueueItem, song: Song): ResolvedQueueItem {
  return {
    queueItem: q,
    song,
    isBreak: false,
    breakMinutes: null,
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
  const { lang } = useT(); // re-derive translated messages when the language changes
  const [loadError, setLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<ConvoEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [instrumentSlogans, setInstrumentSlogans] = useState<Record<string, string>>({});
  const [slogansEditable, setSlogansEditable] = useState(false);
  const [playLogEnabled, setPlayLogEnabled] = useState(false);
  const loadSlogans = useCallback(() => {
    api
      .fetchInstrumentSlogans()
      .then((m) => {
        setSlogansEditable(m !== null);
        setInstrumentSlogans(m ?? {});
      })
      .catch(() => undefined);
  }, []);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roomState, setRoomState] = useState<RoomState>(EMPTY_ROOM);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  const [role, setRole] = useState<RoleType>('player');
  const [authPasskey, setAuthPasskey] = useState<string>('');
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [instrumentChosen, setInstrumentChosen] = useState(true);

  const [votes, setVotes] = useState<QueueVote[]>([]);
  const [votesEnabled, setVotesEnabled] = useState(false);
  const deviceId = useRef<string>('');

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
    setEvents(s.events);
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
      loadSlogans();
      api.playLogAvailable().then(setPlayLogEnabled).catch(() => undefined);
      api
        .fetchVotes()
        .then((v) => {
          setVotesEnabled(v !== null);
          setVotes(v ?? []);
        })
        .catch(() => undefined);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [applySnapshot, loadSlogans]);

  // Restore identity from this device
  useEffect(() => {
    const auth = safeStorage(() => JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'), null) as
      | { role: RoleType; passkey: string }
      | null;
    if (auth?.role) {
      setRole(auth.role);
      setAuthPasskey(auth.passkey || '');
    }
    let id = safeStorage(() => localStorage.getItem(DEVICE_KEY), null);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      safeStorage(() => localStorage.setItem(DEVICE_KEY, id as string), undefined);
    }
    deviceId.current = id;

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
        debounced('instruments', async () => {
          setInstruments(await api.fetchInstruments());
          loadSlogans();
        })
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

  // ---- Ratings: separate realtime channel so a missing table can't break live sync ----
  useEffect(() => {
    if (!votesEnabled || !supabase) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = client
      .channel('queue_votes_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_votes' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          api.fetchVotes().then((v) => v && setVotes(v)).catch(() => undefined);
        }, 150);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [votesEnabled]);

  const tallies = useMemo(() => {
    const map = new Map<string, VoteTally>();
    for (const v of votes) {
      const t = map.get(v.queue_item_id) ?? { up: 0, down: 0, mine: 0 };
      if (v.vote === 1) t.up++;
      else t.down++;
      if (v.device_id === deviceId.current) t.mine = v.vote;
      map.set(v.queue_item_id, t);
    }
    return map;
  }, [votes]);

  const tally = useCallback((id: string): VoteTally => tallies.get(id) ?? { up: 0, down: 0, mine: 0 }, [tallies]);

  const songTally = useCallback(
    (songId: string) => {
      let up = 0;
      let down = 0;
      for (const q of queueItems) {
        if (q.song_id !== songId) continue;
        const t = tallies.get(q.id);
        if (t) {
          up += t.up;
          down += t.down;
        }
      }
      return { up, down };
    },
    [queueItems, tallies]
  );

  const vote = (queueItemId: string, value: 1 | -1) => {
    const me = deviceId.current;
    if (!me) return;
    const current = tally(queueItemId).mine;
    const next: 1 | -1 | 0 = current === value ? 0 : value; // same thumb again = remove
    setVotes((prev) => {
      const rest = prev.filter((v) => !(v.queue_item_id === queueItemId && v.device_id === me));
      return next === 0 ? rest : [...rest, { queue_item_id: queueItemId, device_id: me, vote: next }];
    });
    api.setVote(queueItemId, me, next).catch((err) => {
      notify(tr('Vote not saved: {error}', { error: (err as Error).message }), 'error');
      api.fetchVotes().then((v) => v && setVotes(v)).catch(() => undefined);
    });
  };

  // ---- Derived stage ------------------------------------------------------
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const resolveQueue = useCallback(
    (partId: string) =>
      queueItems
        .filter((q) => q.part_id === partId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((q) => {
          if (q.kind === 'break') return [resolveBreak(q)];
          const song = q.song_id ? songById.get(q.song_id) : undefined;
          return song ? [resolveItem(q, song)] : [];
        }),
    [queueItems, songById]
  );

  const liveSession = useMemo(() => sessions.find((s) => s.id === roomState.session_id), [sessions, roomState.session_id]);
  const liveEvent = useMemo(() => events.find((e) => e.id === liveSession?.event_id), [events, liveSession?.event_id]);
  const eventsEnabled = events.length > 0 || sessions.some((s) => s.event_id);
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
    if (!livePart) return { canControl: false, controlBlockedReason: tr('Nothing is live yet. Choose a Sidang and Bahagian.') };
    if (!livePart.controller_enabled)
      return { canControl: false, controlBlockedReason: tr('The Maestro has locked controls for {part}.', { part: livePart.name }) };
    return { canControl: true, controlBlockedReason: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, role, livePart, lang]);

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
        notify(tr('Not saved: {error}', { error: (err as Error).message }), 'error');
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

  // `is_finished` only exists once the migration has run; never write it before that
  const finishSupported = 'is_finished' in roomState;
  const unfinish = finishSupported ? { is_finished: false } : {};
  const isFinished = !!roomState.is_finished && !!livePart;

  // ---- Intermissions ----------------------------------------------------------
  const interludeTracking = 'interlude_done' in roomState;
  const resetInterlude = interludeTracking ? { interlude_done: 0 } : {};
  const interludeEditable = parts.some((p) => 'interlude_songs' in p);
  const interludeFor = useCallback(
    (part: Part): Interlude | null => {
      const hasNext = parts.some((p) => p.session_id === part.session_id && p.part_number > part.part_number);
      if (!hasNext) return null;
      const songs = part.interlude_songs ?? DEFAULT_INTERLUDE_SONGS[part.part_number] ?? 1;
      if (songs <= 0) return null;
      return { label: part.interlude_label?.trim() || DEFAULT_INTERLUDE_LABEL, songs };
    },
    [parts]
  );
  const liveInterlude = isFinished && livePart && nextPart ? interludeFor(livePart) : null;
  const stageLive = !!liveSession && !!livePart && (!isFinished || !!liveInterlude);
  const interludeDone = Math.min(roomState.interlude_done ?? 0, liveInterlude?.songs ?? 0);
  const setInterludeDone = (n: number) => {
    if (!canControl || !interludeTracking || !liveInterlude) return;
    setRoom({ interlude_done: Math.max(0, Math.min(liveInterlude.songs, n)) });
  };
  const editInterlude = async (partId: string, label: string, songs: number) => {
    const updates = { interlude_label: label.trim() || null, interlude_songs: Math.max(0, Math.round(songs)) };
    setParts((prev) => prev.map((p) => (p.id === partId ? { ...p, ...updates } : p)));
    await commit(() => api.updatePart(partId, updates), { success: tr('Intermission saved'), rethrow: true });
  };

  // ---- Performance log: what was actually played and when (feeds the Sidang summary) ----
  const logPlay = (part: Part | undefined, item: ResolvedQueueItem | null, opts: { startedPart?: boolean; finish?: boolean } = {}) => {
    if (!playLogEnabled || !part) return;
    api
      .insertPlayLog({
        session_id: part.session_id,
        part_id: part.id,
        part_number: part.part_number,
        part_name: part.name,
        queue_item_id: opts.finish ? null : item?.queueItem.id ?? null,
        kind: opts.finish ? 'finish' : item?.isBreak ? 'break' : 'song',
        title: opts.finish ? '' : item?.song.title ?? '',
        started_part: !!opts.startedPart,
      })
      .catch(() => undefined); // never let logging get in the way of the stage
  };

  const goToIndex = (i: number) => {
    if (!canControl || i < 0 || i >= liveQueue.length) return;
    setRoom({ current_queue_item_id: liveQueue[i].queueItem.id, current_loop_iteration: 1, ...unfinish });
    if (isFinished || i !== activeIndex) logPlay(livePart, liveQueue[i]);
  };
  const finishPart = () => {
    if (!canControl) return;
    if (!finishSupported) {
      notify(tr('Finishing a Bahagian needs the is_finished column in the database.'), 'error');
      return;
    }
    setRoom({ is_finished: true, is_paused: false, ...resetInterlude });
    logPlay(livePart, null, { finish: true });
    if (playLogEnabled && livePart) {
      api
        .snapshotPlayVotes(
          livePart.id,
          liveQueue.filter((r) => !r.isBreak).map((r) => ({ queueItemId: r.queueItem.id, up: tally(r.queueItem.id).up, down: tally(r.queueItem.id).down }))
        )
        .catch(() => undefined);
    }
  };
  // Next on the last song finishes the Bahagian; Prev while finished goes back to the last song
  const goNext = () => (activeIndex >= liveQueue.length - 1 ? finishPart() : goToIndex(activeIndex + 1));
  const goPrev = () => {
    if (isFinished) {
      if (canControl) {
        setRoom({ is_finished: false });
        logPlay(livePart, activeItem);
      }
      return;
    }
    goToIndex(activeIndex - 1);
  };
  const jumpTo = (id: string) => goToIndex(liveQueue.findIndex((r) => r.queueItem.id === id));
  const changeLoop = (delta: number) => {
    if (!canControl || !activeItem || isFinished) return;
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
      ...unfinish,
      ...resetInterlude,
      // A new key each time tells the notification sender this is a fresh "go live"
      ...('live_key' in roomState ? { live_key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } : {}),
    });
    if (first) logPlay(part, first, { startedPart: true });
    if ('live_key' in roomState) {
      const exclude = safeStorage(() => localStorage.getItem('anjung_push_endpoint'), null);
      fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exclude }) }).catch(
        () => undefined
      );
    }
  };

  // ---- Setlists --------------------------------------------------------------
  const addToQueue = async (partId: string, songId: string) => {
    const existing = queueItems.filter((q) => q.part_id === partId);
    const item: QueueItem = {
      id: api.newId('q'),
      part_id: partId,
      song_id: songId,
      kind: 'song',
      break_label: null,
      break_minutes: null,
      sort_order: existing.reduce((m, q) => Math.max(m, q.sort_order), 0) + 1,
      override_intro_bar_count: null,
      override_intro_unit: null,
      override_intro_instruments: null,
      override_loop_count: null,
    };
    setQueueItems((prev) => [...prev, item]);
    await commit(() => api.insertQueueItem(item));
  };

  const addLiveSong = async (songId: string, where: 'next' | 'end') => {
    if (!canControl || !livePart) return;
    const partId = livePart.id;
    const ordered = queueItems.filter((q) => q.part_id === partId).sort((a, b) => a.sort_order - b.sort_order);
    const item: QueueItem = {
      id: api.newId('q'),
      part_id: partId,
      song_id: songId,
      kind: 'song',
      break_label: null,
      break_minutes: null,
      sort_order: ordered.reduce((m, q) => Math.max(m, q.sort_order), 0) + 1,
      override_intro_bar_count: null,
      override_intro_unit: null,
      override_intro_instruments: null,
      override_loop_count: null,
    };
    const currentId = activeItem?.queueItem.id;
    const at = where === 'next' && currentId ? ordered.findIndex((q) => q.id === currentId) + 1 : ordered.length;
    const ids = [...ordered.map((q) => q.id)];
    ids.splice(at, 0, item.id);
    const title = songById.get(songId)?.title ?? 'Song';
    setQueueItems((prev) => [
      ...prev.map((q) => (q.part_id === partId ? { ...q, sort_order: ids.indexOf(q.id) + 1 } : q)),
      { ...item, sort_order: at + 1 },
    ]);
    await commit(
      async () => {
        await api.insertQueueItem(item);
        if (at < ordered.length) await api.reorderQueue(ids);
      },
      { success: where === 'next' && currentId ? tr('“{title}” plays next', { title }) : tr('“{title}” added to the end', { title }), rethrow: true }
    );
  };

  const replaceSetlists: StageContextType['replaceSetlists'] = async (entries) => {
    if (!isManager) return;
    const built = entries.map(({ partId, items }) => ({
      partId,
      rows: items.map(
        (it, i): QueueItem => ({
          id: api.newId('q'),
          part_id: partId,
          song_id: it.kind === 'song' ? it.songId : null,
          kind: it.kind,
          break_label: it.kind === 'break' ? it.label : null,
          break_minutes: null,
          sort_order: i + 1,
          override_intro_bar_count: null,
          override_intro_unit: null,
          override_intro_instruments: null,
          override_loop_count: null,
        })
      ),
    }));
    const touched = new Set(built.map((b) => b.partId));
    setQueueItems((prev) => [...prev.filter((q) => !touched.has(q.part_id)), ...built.flatMap((b) => b.rows)]);
    const live = built.find((b) => b.partId === roomState.part_id);
    await commit(
      async () => {
        for (const b of built) await api.replacePartQueue(b.partId, b.rows);
        // The live Bahagian was rewritten: start it again from its first item
        if (live && !roomState.is_finished) {
          await api.updateRoomState({ current_queue_item_id: live.rows[0]?.id ?? null, current_loop_iteration: 1, updated_by_role: role.toUpperCase() });
        }
      },
      { success: tr('Setlist saved'), rethrow: true }
    );
  };

  const moveLiveItem = async (queueItemId: string, delta: -1 | 1) => {
    if (!canControl || !livePart) return;
    const ordered = queueItems.filter((q) => q.part_id === livePart.id).sort((a, b) => a.sort_order - b.sort_order);
    const from = ordered.findIndex((q) => q.id === queueItemId);
    const current = activeItem ? ordered.findIndex((q) => q.id === activeItem.queueItem.id) : -1;
    const to = from + delta;
    if (from < 0 || from <= current || to <= current || to >= ordered.length) return;
    await moveQueueItem(livePart.id, from, to);
  };

  const addBreak = async (partId: string, label: string, minutes: number | null) => {
    const existing = queueItems.filter((q) => q.part_id === partId);
    const item: QueueItem = {
      id: api.newId('q'),
      part_id: partId,
      song_id: null,
      kind: 'break',
      break_label: label.trim() || 'Break',
      break_minutes: minutes,
      sort_order: existing.reduce((m, q) => Math.max(m, q.sort_order), 0) + 1,
      override_intro_bar_count: null,
      override_intro_unit: null,
      override_intro_instruments: null,
      override_loop_count: null,
    };
    setQueueItems((prev) => [...prev, item]);
    await commit(() => api.insertQueueItem(item), { success: tr('Break added') });
  };

  const editBreak = async (id: string, label: string, minutes: number | null) => {
    const l = label.trim() || 'Break';
    setQueueItems((prev) => prev.map((q) => (q.id === id ? { ...q, break_label: l, break_minutes: minutes } : q)));
    await commit(() => api.updateBreak(id, l, minutes), { success: tr('Break updated'), rethrow: true });
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
    await commit(() => api.saveOverride(id, overrides), { success: tr('Adjustment saved'), rethrow: true });
  };

  // ---- Sidang & Bahagian -------------------------------------------------------
  const createSession: StageContextType['createSession'] = async ({ eventId, sidangNumber, name, date }) => {
    const id = api.newId(`session-${sidangNumber}`);
    const session: Session = {
      id,
      event_id: eventId,
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
    await commit(() => api.insertSession(session, newParts), { success: tr('{name} created', { name: session.name }), rethrow: true });
    setSessions((prev) => [...prev, session].sort((a, b) => a.sidang_number - b.sidang_number));
    setParts((prev) => [...prev, ...newParts]);
    return session;
  };

  const editSession: StageContextType['editSession'] = async (id, updates) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    await commit(() => api.updateSession(id, updates), { success: tr('Sidang updated'), rethrow: true });
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
    }, { success: tr('Sidang deleted') });
  };

  const editPart: StageContextType['editPart'] = async (id, updates) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    await commit(() => api.updatePart(id, updates), { success: tr('Bahagian settings saved') });
  };

  // ---- Library -----------------------------------------------------------------
  const addSong: StageContextType['addSong'] = async (input) => {
    const song: Song = { ...input, id: api.newId('song'), created_at: new Date().toISOString() };
    await commit(() => api.insertSong(song), { success: tr('“{title}” added', { title: song.title }), rethrow: true });
    setSongs((prev) => api.sortSongs([...prev, song]));
  };

  const editSong = async (song: Song) => {
    setSongs((prev) => api.sortSongs(prev.map((s) => (s.id === song.id ? song : s))));
    await commit(() => api.updateSong(song), { success: tr('Song updated'), rethrow: true });
  };

  const removeSong = async (id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    setQueueItems((prev) => prev.filter((q) => q.song_id !== id));
    await commit(() => api.deleteSong(id), { success: tr('Song deleted') });
  };

  // ---- Instruments ---------------------------------------------------------------
  const addInstrument = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error(tr('Enter an instrument name.'));
    if (instruments.some((i) => eq(i, trimmed))) throw new Error(tr('“{name}” already exists.', { name: trimmed }));
    await commit(() => api.insertInstrument(trimmed, instruments.length + 1), { success: tr('{name} added', { name: trimmed }), rethrow: true });
    setInstruments((prev) => [...prev, trimmed]);
  };

  const renameInstrument = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error(tr('Enter an instrument name.'));
    if (trimmed === oldName) return;
    if (instruments.some((i) => i !== oldName && eq(i, trimmed))) throw new Error(tr('“{name}” already exists.', { name: trimmed }));
    const swap = (list: string[]) => list.map((i) => (i === oldName ? trimmed : i));
    setInstruments(swap);
    setSongs((prev) => prev.map((s) => ({ ...s, intro_instruments: swap(s.intro_instruments) })));
    setQueueItems((prev) =>
      prev.map((q) => (q.override_intro_instruments ? { ...q, override_intro_instruments: swap(q.override_intro_instruments) } : q))
    );
    if (selectedInstrument === oldName) selectInstrument(trimmed);
    setInstrumentSlogans((prev) => {
      if (!(oldName in prev)) return prev;
      const { [oldName]: s, ...rest } = prev;
      return { ...rest, [trimmed]: s };
    });
    await commit(() => api.renameInstrument(oldName, trimmed), { success: tr('Instrument renamed'), rethrow: true });
  };

  const removeInstrument = async (name: string) => {
    const drop = (list: string[]) => list.filter((i) => i !== name);
    setInstruments(drop);
    setSongs((prev) => prev.map((s) => ({ ...s, intro_instruments: drop(s.intro_instruments) })));
    setQueueItems((prev) =>
      prev.map((q) => (q.override_intro_instruments ? { ...q, override_intro_instruments: drop(q.override_intro_instruments) } : q))
    );
    await commit(() => api.deleteInstrument(name), { success: tr('{name} removed', { name }) });
  };

  const setInstrumentSlogan = async (name: string, slogan: string) => {
    const v = slogan.trim().slice(0, 60);
    setInstrumentSlogans((prev) => {
      const { [name]: _, ...rest } = prev;
      return v ? { ...rest, [name]: v } : rest;
    });
    await commit(() => api.updateInstrumentSlogan(name, v || null), { success: tr('Catchphrase saved'), rethrow: true });
  };

  const moveInstrument = async (from: number, to: number) => {
    if (to < 0 || to >= instruments.length) return;
    const next = moveItem(instruments, from, to);
    setInstruments(next);
    await commit(() => api.reorderInstruments(next));
  };

  // ---- Konvo -----------------------------------------------------------------------
  const createEvent: StageContextType['createEvent'] = async ({ name, venue, startDate, endDate, thumbnail }) => {
    const ev: ConvoEvent = {
      id: api.newId('event'),
      name: name.trim() || 'Event',
      venue: venue.trim() || null,
      start_date: startDate || null,
      end_date: startDate && endDate && endDate > startDate ? endDate : null,
      thumbnail_url: null,
      sort_order: events.reduce((m, e) => Math.max(m, e.sort_order), 0) + 1,
    };
    await commit(
      async () => {
        if (thumbnail) ev.thumbnail_url = await api.uploadThumbnail(thumbnail, thumbnail.name);
        await api.insertEvent(ev);
      },
      { success: tr('{name} created', { name: ev.name }), rethrow: true }
    );
    setEvents((prev) => [...prev, ev]);
    return ev;
  };

  const editEvent: StageContextType['editEvent'] = async (id, { name, venue, startDate, endDate, thumbnail, removeThumbnail }) => {
    const updates: Partial<ConvoEvent> = {
      name: name.trim() || 'Event',
      venue: venue.trim() || null,
      start_date: startDate || null,
      end_date: startDate && endDate && endDate > startDate ? endDate : null,
    };
    if (removeThumbnail) updates.thumbnail_url = null;
    await commit(
      async () => {
        if (thumbnail) updates.thumbnail_url = await api.uploadThumbnail(thumbnail, thumbnail.name);
        await api.updateEvent(id, updates);
      },
      { success: tr('Event updated'), rethrow: true }
    );
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEvent = async (id: string) => {
    const goneSessions = new Set(sessions.filter((s) => s.event_id === id).map((s) => s.id));
    await commit(
      async () => {
        if (roomState.session_id && goneSessions.has(roomState.session_id)) {
          await api.updateRoomState({ session_id: null, part_id: null, current_queue_item_id: null, current_loop_iteration: 1 });
        }
        await api.deleteEvent(id);
      },
      { success: tr('Event deleted') }
    );
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSessions((prev) => prev.filter((s) => s.event_id !== id));
  };

  // Konvo changes sync on their own channel (table may not exist on older databases)
  useEffect(() => {
    if (!eventsEnabled || !supabase) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = client
      .channel('events_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => api.fetchEvents().then(setEvents).catch(() => undefined), 150);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [eventsEnabled]);

  // ---- Access --------------------------------------------------------------------
  const setRolePasskey = async (r: RoleType, passkey: string) => {
    const key = passkey.trim();
    setRoles((prev) => [...prev.filter((x) => x.role_name !== r), { role_name: r, passkey: key }]);
    await commit(() => api.updateRolePasskey(r, key), { success: tr('Passkey updated'), rethrow: true });
    if (r === role) {
      setAuthPasskey(key);
      persistAuth(r, key);
    }
  };

  const value: StageContextType = {
    loaded,
    loadError,
    events,
    eventsEnabled,
    sessions,
    parts,
    songs,
    queueItems,
    instruments,
    roomState,
    connection,
    liveSession,
    liveEvent,
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
    isFinished,
    finishPart,
    interludeFor,
    liveInterlude,
    stageLive,
    interludeDone,
    interludeTracking,
    interludeEditable,
    setInterludeDone,
    editInterlude,
    addToQueue,
    addLiveSong,
    replaceSetlists,
    moveLiveItem,
    removeFromQueue,
    moveQueueItem,
    saveOverride,
    addBreak,
    editBreak,
    createEvent,
    editEvent,
    removeEvent,
    createSession,
    editSession,
    removeSession,
    editPart,
    addSong,
    editSong,
    removeSong,
    addInstrument,
    renameInstrument,
    setInstrumentSlogan,
    instrumentSlogans,
    slogansEditable,
    notesEnabled: songs.some((s) => 'notes' in s),
    playLogEnabled,
    removeInstrument,
    moveInstrument,
    setRolePasskey,
    votesEnabled,
    tally,
    songTally,
    vote,
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
