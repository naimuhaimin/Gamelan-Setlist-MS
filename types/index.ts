// Gamelan Konvokesyen Queue MS — domain types.
// Instruments and songs live ONLY in the database; there are no hardcoded presets.

export type RoleType = 'admin' | 'maestro' | 'controller' | 'player';

/**
 * Song library fields (keep to these; add new ones only on request):
 * 1. Title
 * 2. Intro Bar Count (bars in the intro before the ensemble enters)
 * 3. Intro Instruments (instruments responsible for the intro cue)
 * 4. Loop Count (times the song/section is looped)
 * 5. Rhythms (one or more rhythm names, in playing order)
 */
export interface Song {
  id: string;
  title: string;
  intro_bar_count: number;
  intro_instruments: string[];
  loop_count: number;
  rhythms: string[];
  created_at?: string;
}

export interface QueueItem {
  id: string;
  part_id: string;
  song_id: string;
  sort_order: number;
  // One-time overrides for this queue position only (null = use the song's value)
  override_intro_bar_count: number | null;
  override_intro_instruments: string[] | null;
  override_loop_count: number | null;
  created_at?: string;
}

export interface Part {
  id: string;
  session_id: string;
  part_number: number; // 1–4
  name: string;
  controller_passkey: string;
  controller_enabled: boolean;
  created_at?: string;
}

export interface Session {
  id: string;
  sidang_number: number;
  name: string;
  code: string;
  date: string;
  maestro_passkey: string;
  created_at?: string;
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

export interface RoleRow {
  role_name: RoleType;
  passkey: string;
}

/** A queue item resolved against its song, with overrides applied. */
export interface ResolvedQueueItem {
  queueItem: QueueItem;
  song: Song;
  introBarCount: number;
  introInstruments: string[];
  loopCount: number;
  hasOverride: boolean;
}

export interface DatabaseSnapshot {
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState | null;
  instruments: string[];
  roles: RoleRow[];
}
