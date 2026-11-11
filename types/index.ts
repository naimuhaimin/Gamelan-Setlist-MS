// Gamelan Konvokesyen Queue MS — domain types.
// Instruments and songs live ONLY in the database; there are no hardcoded presets.

export type RoleType = 'admin' | 'maestro' | 'controller' | 'player';

/** Whether the intro length is counted in whole bars or in beats. */
export type IntroUnit = 'bars' | 'beats';

/**
 * Song library fields (keep to these; add new ones only on request):
 * 1. Title
 * 2. Intro length: `intro_bar_count` + `intro_unit` (bars or beats before the ensemble enters)
 * 3. Intro Instruments (instruments responsible for the intro cue)
 * 4. Loop Count (times the song/section is looped)
 * 5. Rhythms (one or more rhythm names, in playing order)
 */
export interface Song {
  id: string;
  title: string;
  intro_bar_count: number; // intro length, counted in `intro_unit`
  intro_unit: IntroUnit;
  intro_instruments: string[];
  loop_count: number;
  rhythms: string[];
  notes?: string | null; // short performance note (column added by migration)
  created_at?: string;
}

/** A Konvokesyen (convocation). Holds many Sidang. */
export interface ConvoEvent {
  id: string;
  name: string;
  venue: string | null;
  start_date: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  created_at?: string;
}

export type QueueKind = 'song' | 'break';

export interface QueueItem {
  id: string;
  part_id: string;
  song_id: string | null; // null for breaks
  kind: QueueKind;
  break_label: string | null;
  break_minutes: number | null;
  sort_order: number;
  // One-time overrides for this queue position only (null = use the song's value)
  override_intro_bar_count: number | null;
  override_intro_unit: IntroUnit | null; // used together with override_intro_bar_count
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
  // Intermission AFTER this Bahagian (columns added by migration; null = app default)
  interlude_label?: string | null;
  interlude_songs?: number | null;
  created_at?: string;
}

export interface Session {
  id: string;
  event_id: string | null;
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
  is_finished?: boolean; // the live Bahagian has ended (column added by migration)
  interlude_done?: number; // intermission songs performed so far (column added by migration)
  live_key?: string | null; // changes each time a Bahagian goes live (for notifications)
  notified_key?: string | null;
  updated_at: string;
  updated_by_role: string;
}

/** One device's thumbs up (1) or down (-1) for one setlist position. */
export interface QueueVote {
  queue_item_id: string;
  device_id: string;
  vote: 1 | -1;
}

export interface VoteTally {
  up: number;
  down: number;
  mine: 1 | -1 | 0;
}

export interface RoleRow {
  role_name: RoleType;
  passkey: string;
}

/**
 * A queue item resolved against its song, with overrides applied.
 * Breaks resolve to a stand-in `song` (title = break label, no intro/loops) and `isBreak: true`.
 */
export interface ResolvedQueueItem {
  queueItem: QueueItem;
  song: Song;
  isBreak: boolean;
  breakMinutes: number | null;
  introBarCount: number;
  introUnit: IntroUnit;
  introInstruments: string[];
  loopCount: number;
  hasOverride: boolean;
}

export interface DatabaseSnapshot {
  events: ConvoEvent[];
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState | null;
  instruments: string[];
  roles: RoleRow[];
}

/** The intermission between one Bahagian and the next (guest performers). */
export interface Interlude {
  label: string;
  songs: number;
}

/** One live-chat message in a Sidang. */
export interface ChatMessage {
  id: string;
  session_id: string;
  device_id: string;
  author: string;
  instrument: string | null;
  role: string;
  body: string;
  created_at: string;
}

/** One row of the performance log: the stage moved to this item at `started_at`. */
export interface PlayLogRow {
  id: string;
  session_id: string;
  part_id: string;
  part_number: number;
  part_name: string;
  queue_item_id: string | null;
  kind: 'song' | 'break' | 'finish';
  title: string;
  started_part: boolean;
  up: number | null;
  down: number | null;
  started_at: string;
}
