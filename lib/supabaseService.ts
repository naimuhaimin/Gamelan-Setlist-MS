import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Session, Part, Song, QueueItem, RoomState } from '@/types';
import {
  INITIAL_SONGS,
  INITIAL_SESSIONS,
  INITIAL_PARTS,
  INITIAL_QUEUE_ITEMS,
  INITIAL_ROOM_STATE,
  INITIAL_INSTRUMENTS,
} from './seedData';

export interface SupabaseFullState {
  sessions: Session[];
  parts: Part[];
  songs: Song[];
  queueItems: QueueItem[];
  roomState: RoomState;
  instruments: string[];
}

/**
 * Fetches all stage data directly from Supabase tables.
 * Returns null if Supabase is not configured or query fails.
 */
export async function fetchFullDatabaseState(): Promise<SupabaseFullState | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const [
      sessionsRes,
      partsRes,
      songsRes,
      queueRes,
      roomRes,
      instrumentsRes,
    ] = await Promise.all([
      supabase.from('sessions').select('*').order('sidang_number', { ascending: true }),
      supabase.from('parts').select('*').order('part_number', { ascending: true }),
      supabase.from('songs').select('*').order('title', { ascending: true }),
      supabase.from('queue_items').select('*').order('sort_order', { ascending: true }),
      supabase.from('room_state').select('*').eq('id', 'main_stage').maybeSingle(),
      supabase.from('instruments').select('*').order('sort_order', { ascending: true }),
    ]);

    // If query failed on critical tables, return null
    if (sessionsRes.error || partsRes.error || songsRes.error || queueRes.error) {
      console.warn('[SupabaseService] Query error:', {
        sessions: sessionsRes.error,
        parts: partsRes.error,
        songs: songsRes.error,
        queue: queueRes.error,
      });
      return null;
    }

    const sessions = (sessionsRes.data as Session[]) || [];
    const parts = (partsRes.data as Part[]) || [];
    const songs = (songsRes.data as Song[]) || [];
    const queueItems = (queueRes.data as QueueItem[]) || [];
    const roomState = (roomRes.data as RoomState) || INITIAL_ROOM_STATE;
    const instruments = instrumentsRes.data && instrumentsRes.data.length > 0
      ? (instrumentsRes.data as Array<{ name: string }>).map((i) => i.name)
      : INITIAL_INSTRUMENTS;

    // If tables are empty (first run after creating tables), auto-seed from client
    if (sessions.length === 0 && songs.length === 0) {
      await seedDatabaseIfEmpty();
      return {
        sessions: INITIAL_SESSIONS,
        parts: INITIAL_PARTS,
        songs: INITIAL_SONGS,
        queueItems: INITIAL_QUEUE_ITEMS,
        roomState: INITIAL_ROOM_STATE,
        instruments: INITIAL_INSTRUMENTS,
      };
    }

    return {
      sessions: sessions.length > 0 ? sessions : INITIAL_SESSIONS,
      parts: parts.length > 0 ? parts : INITIAL_PARTS,
      songs: songs.length > 0 ? songs : INITIAL_SONGS,
      queueItems,
      roomState,
      instruments,
    };
  } catch (err) {
    console.error('[SupabaseService] Unexpected error loading state:', err);
    return null;
  }
}

/**
 * Seeds Supabase with the default traditional repertoire if tables are empty.
 */
export async function seedDatabaseIfEmpty(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    await supabase.from('roles').upsert([
      { role_name: 'admin', passkey: 'admin999', description: 'Admin master authority' },
      { role_name: 'maestro', passkey: 'sidang1', description: 'Maestro passkey' },
      { role_name: 'controller', passkey: 'ctrl1', description: 'Controller passkey' },
      { role_name: 'player', passkey: '', description: 'Musician view' },
    ], { onConflict: 'role_name' });

    await supabase.from('songs').upsert(INITIAL_SONGS, { onConflict: 'id' });
    await supabase.from('sessions').upsert(INITIAL_SESSIONS, { onConflict: 'id' });
    await supabase.from('parts').upsert(INITIAL_PARTS, { onConflict: 'id' });
    await supabase.from('queue_items').upsert(INITIAL_QUEUE_ITEMS, { onConflict: 'id' });
    await supabase.from('room_state').upsert(INITIAL_ROOM_STATE, { onConflict: 'id' });
    await supabase.from('instruments').upsert(
      INITIAL_INSTRUMENTS.map((name, i) => ({ id: `inst-${i + 1}`, name, sort_order: i + 1 })),
      { onConflict: 'name' }
    );
    return true;
  } catch (err) {
    console.warn('[SupabaseService] Auto-seed failed:', err);
    return false;
  }
}

/**
 * Updates stage room state in Supabase.
 */
export async function updateRoomStateInSupabase(updates: Partial<RoomState>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await supabase.from('room_state').upsert({ id: 'main_stage', ...payload }, { onConflict: 'id' });
  } catch (err) {
    console.error('[SupabaseService] Failed to update room_state:', err);
  }
}

/**
 * Adds a new song to the song library.
 */
export async function addSongInSupabase(song: Song): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('songs').insert(song);
  } catch (err) {
    console.error('[SupabaseService] Failed to insert song:', err);
  }
}

/**
 * Updates an existing song in the library.
 */
export async function updateSongInSupabase(song: Song): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('songs').update(song).eq('id', song.id);
  } catch (err) {
    console.error('[SupabaseService] Failed to update song:', err);
  }
}

/**
 * Deletes a song from the library and cleans up references.
 */
export async function deleteSongInSupabase(songId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('queue_items').delete().eq('song_id', songId);
    await supabase.from('songs').delete().eq('id', songId);
  } catch (err) {
    console.error('[SupabaseService] Failed to delete song:', err);
  }
}

/**
 * Adds a song to a specific Bahagian setlist queue.
 */
export async function addQueueItemInSupabase(item: QueueItem): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('queue_items').insert(item);
  } catch (err) {
    console.error('[SupabaseService] Failed to insert queue item:', err);
  }
}

/**
 * Removes a queue item from a Bahagian setlist.
 */
export async function removeQueueItemInSupabase(queueItemId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('queue_items').delete().eq('id', queueItemId);
  } catch (err) {
    console.error('[SupabaseService] Failed to delete queue item:', err);
  }
}

/**
 * Reorders items in a Bahagian setlist.
 */
export async function reorderQueueInSupabase(orderedIds: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const updates = orderedIds.map((id, index) =>
      supabase!.from('queue_items').update({ sort_order: index + 1 }).eq('id', id)
    );
    await Promise.all(updates);
  } catch (err) {
    console.error('[SupabaseService] Failed to reorder queue items:', err);
  }
}

/**
 * Saves one-time instance overrides for a queue item.
 */
export async function saveOverrideInSupabase(
  queueItemId: string,
  overrides: {
    override_intro_bar_count: number | null;
    override_intro_instruments: string[] | null;
    override_loop_count: number | null;
  }
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('queue_items').update(overrides).eq('id', queueItemId);
  } catch (err) {
    console.error('[SupabaseService] Failed to save overrides:', err);
  }
}

/**
 * Updates controller settings for a Bahagian.
 */
export async function updatePartControllerInSupabase(
  partId: string,
  enabled: boolean,
  passkey?: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const payload: Partial<Part> = { controller_enabled: enabled };
    if (passkey) payload.controller_passkey = passkey;
    await supabase.from('parts').update(payload).eq('id', partId);
  } catch (err) {
    console.error('[SupabaseService] Failed to update part controller:', err);
  }
}

/**
 * Adds a new Sidang session and its 4 parts.
 */
export async function addSessionInSupabase(session: Session, parts: Part[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('sessions').insert(session);
    await supabase.from('parts').insert(parts);
  } catch (err) {
    console.error('[SupabaseService] Failed to add session:', err);
  }
}

/**
 * Deletes a session and cascades to its parts and queue items.
 */
export async function deleteSessionInSupabase(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('sessions').delete().eq('id', sessionId);
  } catch (err) {
    console.error('[SupabaseService] Failed to delete session:', err);
  }
}

/**
 * Updates session metadata (name, date, passkey, etc.).
 */
export async function updateSessionInSupabase(
  sessionId: string,
  updates: Partial<Session>
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('sessions').update(updates).eq('id', sessionId);
  } catch (err) {
    console.error('[SupabaseService] Failed to update session:', err);
  }
}

/**
 * Adds an instrument to the ensemble library.
 */
export async function addInstrumentInSupabase(name: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('instruments').upsert({ id: `inst-${Date.now()}`, name, sort_order: 99 }, { onConflict: 'name' });
  } catch (err) {
    console.error('[SupabaseService] Failed to add instrument:', err);
  }
}

/**
 * Renames an instrument.
 */
export async function updateInstrumentInSupabase(oldName: string, newName: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('instruments').update({ name: newName }).eq('name', oldName);
  } catch (err) {
    console.error('[SupabaseService] Failed to update instrument:', err);
  }
}

/**
 * Deletes an instrument.
 */
export async function deleteInstrumentInSupabase(name: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('instruments').delete().eq('name', name);
  } catch (err) {
    console.error('[SupabaseService] Failed to delete instrument:', err);
  }
}

/**
 * Restores the default 12 Gamelan instruments.
 */
export async function restoreDefaultInstrumentsInSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('instruments').delete().neq('id', 'keep-all');
    await supabase.from('instruments').upsert(
      INITIAL_INSTRUMENTS.map((name, i) => ({ id: `inst-${i + 1}`, name, sort_order: i + 1 })),
      { onConflict: 'name' }
    );
  } catch (err) {
    console.error('[SupabaseService] Failed to restore default instruments:', err);
  }
}

/**
 * Resets all tables in Supabase to initial seed repertoire.
 */
export async function resetAllInSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('queue_items').delete().neq('id', 'none');
    await supabase.from('parts').delete().neq('id', 'none');
    await supabase.from('sessions').delete().neq('id', 'none');
    await supabase.from('songs').delete().neq('id', 'none');
    await seedDatabaseIfEmpty();
  } catch (err) {
    console.error('[SupabaseService] Failed to reset database:', err);
  }
}
