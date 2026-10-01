// Strict Gamelan Konvokesyen Queue MS Types

export type RoleType = 'admin' | 'maestro' | 'controller' | 'player';

export const DEFAULT_GAMELAN_INSTRUMENTS = [
  'Bonang Barung',
  'Bonang Panerus',
  'Saron Demung',
  'Saron Barung',
  'Saron Pekeking',
  'Gambang',
  'Kenong',
  'Kempul',
  'Gong Ageng',
  'Gendang',
  'Rebab',
  'Celempung',
] as const;

export const GAMELAN_INSTRUMENTS = DEFAULT_GAMELAN_INSTRUMENTS;

export type GamelanInstrument = string;

/**
 * STRICT REQUIREMENT:
 * Each song entry in the library must support ONLY the following metadata fields:
 * 1. Title
 * 2. Intro Bar Count (Number of bars in the intro)
 * 3. Intro Instruments (Array/Selection of Gamelan instruments responsible for the intro cue)
 * 4. Loop Count (Number of times the song/section is looped)
 */
export interface Song {
  id: string;
  title: string;
  intro_bar_count: number;
  intro_instruments: string[];
  loop_count: number;
  created_at?: string;
}

export interface QueueItem {
  id: string;
  part_id: string;
  song_id: string;
  sort_order: number;
  // One-time special overrides per instance
  override_intro_bar_count: number | null;
  override_intro_instruments: string[] | null;
  override_loop_count: number | null;
  song?: Song;
  created_at?: string;
}

export interface Part {
  id: string;
  session_id: string;
  part_number: number; // 1, 2, 3, 4
  name: string;
  controller_passkey: string;
  controller_enabled: boolean;
  created_at?: string;
  queue_items?: QueueItem[];
}

export interface Session {
  id: string;
  sidang_number: number; // e.g. 1, 2, 3, ...
  name: string; // e.g., 'Sidang 1', 'Sidang 2'
  code: string; // 'S1', 'S2', 'SIDANG 1'
  date: string;
  maestro_passkey: string;
  created_at?: string;
  parts?: Part[];
}

export interface RoomState {
  id: string;
  session_id: string | null;
  part_id: string | null;
  current_queue_item_id: string | null;
  current_loop_iteration: number;
  is_paused: boolean;
  updated_at: string;
  updated_by_role: string;
}

export interface ActiveSongDisplay {
  queueItemId: string;
  songId: string;
  title: string;
  introBarCount: number;
  introInstruments: string[];
  loopCount: number;
  currentLoop: number;
  isOverride: boolean;
  sortOrder: number;
}
