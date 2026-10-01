import fs from 'fs';
import path from 'path';
import os from 'os';
import { Session, Part, Song, QueueItem, RoomState } from '@/types';
import {
  INITIAL_SONGS,
  INITIAL_SESSIONS,
  INITIAL_PARTS,
  INITIAL_QUEUE_ITEMS,
  INITIAL_ROOM_STATE,
  INITIAL_INSTRUMENTS,
} from '@/lib/seedData';

export interface DatabaseState {
  version: number;
  updated_at: string;
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState;
  instruments: string[];
}

export type DatabaseAction =
  | { type: 'UPDATE_ROOM_STATE'; payload: Partial<RoomState> }
  | { type: 'ADD_SONG'; payload: Omit<Song, 'id' | 'created_at'> }
  | { type: 'UPDATE_SONG'; payload: Song }
  | { type: 'DELETE_SONG'; payload: { songId: string } }
  | { type: 'ADD_QUEUE_ITEM'; payload: { partId: string; songId: string } }
  | { type: 'REMOVE_QUEUE_ITEM'; payload: { queueItemId: string } }
  | { type: 'REORDER_QUEUE'; payload: { partId: string; orderedIds: string[] } }
  | {
      type: 'SAVE_OVERRIDE';
      payload: {
        queueItemId: string;
        overrides: {
          override_intro_bar_count: number | null;
          override_intro_instruments: string[] | null;
          override_loop_count: number | null;
        };
      };
    }
  | { type: 'UPDATE_PART_CONTROLLER'; payload: { partId: string; enabled: boolean; passkey?: string } }
  | { type: 'ADD_SESSION'; payload: { session: Session; parts: Part[] } }
  | { type: 'UPDATE_SESSION'; payload: { sessionId: string; updates: Partial<Session> } }
  | { type: 'DELETE_SESSION'; payload: { sessionId: string } }
  | { type: 'ADD_INSTRUMENT'; payload: { name: string } }
  | { type: 'UPDATE_INSTRUMENT'; payload: { oldName: string; newName: string } }
  | { type: 'DELETE_INSTRUMENT'; payload: { name: string } }
  | { type: 'RESTORE_DEFAULT_INSTRUMENTS'; payload?: Record<string, never> }
  | { type: 'RESET_ALL'; payload?: Record<string, never> }
  | { type: 'SYNC_FULL_STATE'; payload: Partial<DatabaseState> };

export type StateListener = (state: DatabaseState) => void;

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'gamelan_db.json');
const DB_TEMP = path.join(DB_DIR, 'gamelan_db.tmp');

function getInitialState(): DatabaseState {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    sessions: INITIAL_SESSIONS,
    parts: INITIAL_PARTS,
    songs: INITIAL_SONGS,
    queueItems: INITIAL_QUEUE_ITEMS,
    roomState: INITIAL_ROOM_STATE,
    instruments: INITIAL_INSTRUMENTS,
  };
}

class GamelanDatabaseManager {
  private state: DatabaseState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseState {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && parsed.sessions && parsed.songs && parsed.roomState) {
          // Normalize parts to include standard naming if needed
          if (Array.isArray(parsed.parts)) {
            parsed.parts = parsed.parts.map((p) => ({
              ...p,
              name: p.name || `Bahagian ${p.part_number}`,
            }));
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('[GamelanDatabase] Failed to read database from disk, re-initializing seed:', err);
    }

    const initial = getInitialState();
    this.persistToDisk(initial);
    return initial;
  }

  private persistToDisk(newState: DatabaseState) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const data = JSON.stringify(newState, null, 2);
      fs.writeFileSync(DB_TEMP, data, 'utf-8');
      fs.copyFileSync(DB_TEMP, DB_FILE);
      try {
        fs.unlinkSync(DB_TEMP);
      } catch {
        // ignore unlink error
      }
    } catch (err) {
      console.error('[GamelanDatabase] Failed to write database to disk:', err);
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSubscriberCount(): number {
    return this.listeners.size;
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[GamelanDatabase] Error notifying listener:', err);
      }
    });
  }

  public applyAction(action: DatabaseAction, sourceRole: string = 'SYSTEM'): DatabaseState {
    const nextState = { ...this.state };
    nextState.version = (this.state.version || 0) + 1;
    nextState.updated_at = new Date().toISOString();

    switch (action.type) {
      case 'UPDATE_ROOM_STATE': {
        nextState.roomState = {
          ...nextState.roomState,
          ...action.payload,
          updated_at: nextState.updated_at,
          updated_by_role: sourceRole,
        };
        break;
      }

      case 'ADD_SONG': {
        const newSong: Song = {
          ...action.payload,
          id: `song-${Date.now()}`,
          created_at: nextState.updated_at,
        };
        nextState.songs = [...nextState.songs, newSong];
        break;
      }

      case 'UPDATE_SONG': {
        nextState.songs = nextState.songs.map((s) =>
          s.id === action.payload.id ? action.payload : s
        );
        break;
      }

      case 'DELETE_SONG': {
        const { songId } = action.payload;
        nextState.songs = nextState.songs.filter((s) => s.id !== songId);
        nextState.queueItems = nextState.queueItems.filter((q) => q.song_id !== songId);

        if (nextState.roomState.current_queue_item_id &&
            !nextState.queueItems.some((q) => q.id === nextState.roomState.current_queue_item_id)) {
          const remainingInPart = nextState.queueItems.filter(
            (q) => q.part_id === nextState.roomState.part_id
          );
          nextState.roomState = {
            ...nextState.roomState,
            current_queue_item_id: remainingInPart.length ? remainingInPart[0].id : null,
            current_loop_iteration: 1,
            updated_at: nextState.updated_at,
            updated_by_role: sourceRole,
          };
        }
        break;
      }

      case 'ADD_QUEUE_ITEM': {
        const { partId, songId } = action.payload;
        const existingInPart = nextState.queueItems.filter((q) => q.part_id === partId);
        const newItem: QueueItem = {
          id: `q-${Date.now()}`,
          part_id: partId,
          song_id: songId,
          sort_order: existingInPart.length + 1,
          override_intro_bar_count: null,
          override_intro_instruments: null,
          override_loop_count: null,
          created_at: nextState.updated_at,
        };
        nextState.queueItems = [...nextState.queueItems, newItem];

        if (nextState.roomState.part_id === partId && !nextState.roomState.current_queue_item_id) {
          nextState.roomState = {
            ...nextState.roomState,
            current_queue_item_id: newItem.id,
            current_loop_iteration: 1,
            updated_at: nextState.updated_at,
            updated_by_role: sourceRole,
          };
        }
        break;
      }

      case 'REMOVE_QUEUE_ITEM': {
        const { queueItemId } = action.payload;
        const target = nextState.queueItems.find((q) => q.id === queueItemId);
        nextState.queueItems = nextState.queueItems.filter((q) => q.id !== queueItemId);

        if (nextState.roomState.current_queue_item_id === queueItemId) {
          const remaining = nextState.queueItems.filter((q) => q.part_id === target?.part_id);
          nextState.roomState = {
            ...nextState.roomState,
            current_queue_item_id: remaining.length ? remaining[0].id : null,
            current_loop_iteration: 1,
            updated_at: nextState.updated_at,
            updated_by_role: sourceRole,
          };
        }
        break;
      }

      case 'REORDER_QUEUE': {
        const { partId, orderedIds } = action.payload;
        nextState.queueItems = nextState.queueItems.map((item) => {
          if (item.part_id !== partId) return item;
          const newIdx = orderedIds.indexOf(item.id);
          if (newIdx >= 0) {
            return { ...item, sort_order: newIdx + 1 };
          }
          return item;
        });
        break;
      }

      case 'SAVE_OVERRIDE': {
        const { queueItemId, overrides } = action.payload;
        nextState.queueItems = nextState.queueItems.map((q) =>
          q.id === queueItemId ? { ...q, ...overrides } : q
        );
        break;
      }

      case 'UPDATE_PART_CONTROLLER': {
        const { partId, enabled, passkey } = action.payload;
        nextState.parts = nextState.parts.map((p) => {
          if (p.id !== partId) return p;
          return {
            ...p,
            controller_enabled: enabled,
            ...(passkey ? { controller_passkey: passkey } : {}),
          };
        });
        break;
      }

      case 'ADD_SESSION': {
        const { session, parts } = action.payload;
        nextState.sessions = [...nextState.sessions, session];
        nextState.parts = [...nextState.parts, ...parts];
        break;
      }

      case 'UPDATE_SESSION': {
        const { sessionId, updates } = action.payload;
        nextState.sessions = nextState.sessions.map((s) =>
          s.id === sessionId ? { ...s, ...updates } : s
        );
        break;
      }

      case 'DELETE_SESSION': {
        const { sessionId } = action.payload;
        const partIdsToDelete = nextState.parts
          .filter((p) => p.session_id === sessionId)
          .map((p) => p.id);

        nextState.sessions = nextState.sessions.filter((s) => s.id !== sessionId);
        nextState.parts = nextState.parts.filter((p) => p.session_id !== sessionId);
        nextState.queueItems = nextState.queueItems.filter(
          (q) => !partIdsToDelete.includes(q.part_id)
        );

        if (nextState.roomState.session_id === sessionId) {
          const fallbackSession = nextState.sessions[0];
          const fallbackPart = fallbackSession
            ? nextState.parts.find((p) => p.session_id === fallbackSession.id)
            : null;
          const fallbackQueue = fallbackPart
            ? nextState.queueItems.find((q) => q.part_id === fallbackPart.id)
            : null;

          nextState.roomState = {
            ...nextState.roomState,
            session_id: fallbackSession ? fallbackSession.id : null,
            part_id: fallbackPart ? fallbackPart.id : null,
            current_queue_item_id: fallbackQueue ? fallbackQueue.id : null,
            current_loop_iteration: 1,
            updated_at: nextState.updated_at,
            updated_by_role: sourceRole,
          };
        }
        break;
      }

      case 'ADD_INSTRUMENT': {
        const cleanName = action.payload.name.trim();
        if (cleanName && !nextState.instruments.includes(cleanName)) {
          nextState.instruments = [...nextState.instruments, cleanName];
        }
        break;
      }

      case 'UPDATE_INSTRUMENT': {
        const { oldName, newName } = action.payload;
        const trimmed = newName.trim();
        if (trimmed) {
          nextState.instruments = nextState.instruments.map((i) =>
            i === oldName ? trimmed : i
          );
          nextState.songs = nextState.songs.map((s) => ({
            ...s,
            intro_instruments: s.intro_instruments.map((i) =>
              i === oldName ? trimmed : i
            ),
          }));
          nextState.queueItems = nextState.queueItems.map((q) => ({
            ...q,
            override_intro_instruments: q.override_intro_instruments
              ? q.override_intro_instruments.map((i) => (i === oldName ? trimmed : i))
              : null,
          }));
        }
        break;
      }

      case 'DELETE_INSTRUMENT': {
        const target = action.payload.name;
        nextState.instruments = nextState.instruments.filter((i) => i !== target);
        nextState.songs = nextState.songs.map((s) => ({
          ...s,
          intro_instruments: s.intro_instruments.filter((i) => i !== target),
        }));
        nextState.queueItems = nextState.queueItems.map((q) => ({
          ...q,
          override_intro_instruments: q.override_intro_instruments
            ? q.override_intro_instruments.filter((i) => i !== target)
            : null,
        }));
        break;
      }

      case 'RESTORE_DEFAULT_INSTRUMENTS': {
        nextState.instruments = [...INITIAL_INSTRUMENTS];
        break;
      }

      case 'RESET_ALL': {
        const seed = getInitialState();
        seed.version = nextState.version;
        this.state = seed;
        this.persistToDisk(seed);
        this.notify();
        return seed;
      }

      case 'SYNC_FULL_STATE': {
        if (action.payload.sessions) nextState.sessions = action.payload.sessions;
        if (action.payload.parts) nextState.parts = action.payload.parts;
        if (action.payload.songs) nextState.songs = action.payload.songs;
        if (action.payload.queueItems) nextState.queueItems = action.payload.queueItems;
        if (action.payload.roomState) nextState.roomState = action.payload.roomState;
        if (action.payload.instruments) nextState.instruments = action.payload.instruments;
        break;
      }
    }

    this.state = nextState;
    this.persistToDisk(nextState);
    this.notify();
    return nextState;
  }
}

// Global singleton to persist across Next.js route requests
declare global {
  // eslint-disable-next-line no-var
  var __gamelan_db_instance: GamelanDatabaseManager | undefined;
}

if (!globalThis.__gamelan_db_instance) {
  globalThis.__gamelan_db_instance = new GamelanDatabaseManager();
}

export const dbManager = globalThis.__gamelan_db_instance;

export function getNetworkAddresses(): { lanIp: string; lanUrl: string; allIps: string[] } {
  const interfaces = os.networkInterfaces();
  const allIps: string[] = [];
  let primaryLanIp = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        allIps.push(iface.address);
        // Prioritize Wi-Fi or standard 192.168.x / 10.x networks
        if (
          name.toLowerCase().includes('wi-fi') ||
          name.toLowerCase().includes('wlan') ||
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.')
        ) {
          primaryLanIp = iface.address;
        }
      }
    }
  }

  if (primaryLanIp === '127.0.0.1' && allIps.length > 0) {
    primaryLanIp = allIps[0];
  }

  return {
    lanIp: primaryLanIp,
    lanUrl: `http://${primaryLanIp}:3000`,
    allIps,
  };
}
