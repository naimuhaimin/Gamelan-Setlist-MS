import { supabase } from '@/lib/supabaseClient';
import type {
  DatabaseSnapshot,
  QueueVote,
  Part,
  QueueItem,
  RoleRow,
  RoleType,
  RoomState,
  Session,
  Song,
} from '@/types';

/**
 * All reads and writes go straight to Supabase. Every write THROWS on failure,
 * so the UI can tell the user instead of silently pretending it saved.
 * There is no seeding and no fallback data: what is in the database is what the app shows.
 */

export const ROOM_ID = 'main_stage';

function db() {
  if (!supabase) throw new Error('Database is not configured.');
  return supabase;
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/** Natural sort so "2 Togok" comes before "10 Ganda Melati". */
export const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export const sortSongs = (songs: Song[]) => [...songs].sort((a, b) => naturalCompare(a.title, b.title));

export const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchSessions() {
  const res = await db().from('sessions').select('*').order('sidang_number', { ascending: true });
  return check(res, 'Load Sidang') as Session[];
}
export async function fetchParts() {
  const res = await db().from('parts').select('*').order('part_number', { ascending: true });
  return (check(res, 'Load Bahagian') as Part[]).map((p) => ({ ...p, name: p.name || `Bahagian ${p.part_number}` }));
}
export async function fetchSongs() {
  const res = await db().from('songs').select('*');
  // `rhythms` may be missing until the column migration has run
  return sortSongs(
    (check(res, 'Load songs') as Song[]).map((s) => ({ ...s, rhythms: s.rhythms ?? [], intro_unit: s.intro_unit ?? 'bars' }))
  );
}
export async function fetchQueueItems() {
  const res = await db().from('queue_items').select('*').order('sort_order', { ascending: true });
  return (check(res, 'Load setlists') as QueueItem[]).map((q) => ({ ...q, override_intro_unit: q.override_intro_unit ?? null }));
}
export async function fetchInstruments() {
  const res = await db().from('instruments').select('name, sort_order').order('sort_order', { ascending: true });
  return (check(res, 'Load instruments') as Array<{ name: string }>).map((i) => i.name);
}
export async function fetchRoles() {
  const res = await db().from('roles').select('role_name, passkey');
  return check(res, 'Load access settings') as RoleRow[];
}
export async function fetchRoomState() {
  const res = await db().from('room_state').select('*').eq('id', ROOM_ID).maybeSingle();
  return check(res, 'Load stage state') as RoomState | null;
}

export async function fetchSnapshot(): Promise<DatabaseSnapshot> {
  const [sessions, parts, songs, queueItems, roomState, instruments, roles] = await Promise.all([
    fetchSessions(),
    fetchParts(),
    fetchSongs(),
    fetchQueueItems(),
    fetchRoomState(),
    fetchInstruments(),
    fetchRoles(),
  ]);
  return { sessions, parts, songs, queueItems, roomState, instruments, roles };
}

/** Votes live in their own table; if it doesn't exist yet the app simply shows no votes. */
export async function fetchVotes(): Promise<QueueVote[] | null> {
  const res = await db().from('queue_votes').select('queue_item_id, device_id, vote');
  if (res.error) return null; // table not created yet
  return res.data as QueueVote[];
}

export async function setVote(queueItemId: string, deviceId: string, vote: 1 | -1 | 0) {
  if (vote === 0) {
    check(
      await db().from('queue_votes').delete().eq('queue_item_id', queueItemId).eq('device_id', deviceId),
      'Remove vote'
    );
  } else {
    check(
      await db()
        .from('queue_votes')
        .upsert(
          { queue_item_id: queueItemId, device_id: deviceId, vote, updated_at: new Date().toISOString() },
          { onConflict: 'queue_item_id,device_id' }
        ),
      'Save vote'
    );
  }
}

// ---------------------------------------------------------------------------
// Live stage
// ---------------------------------------------------------------------------

export async function updateRoomState(updates: Partial<RoomState>) {
  const res = await db()
    .from('room_state')
    .upsert({ id: ROOM_ID, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  check(res, 'Update stage');
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export async function insertSong(song: Song) {
  check(await db().from('songs').insert(song), 'Add song');
}
export async function updateSong(song: Song) {
  const { id, title, intro_bar_count, intro_unit, intro_instruments, loop_count, rhythms } = song;
  check(
    await db().from('songs').update({ title, intro_bar_count, intro_unit, intro_instruments, loop_count, rhythms }).eq('id', id),
    'Update song'
  );
}
export async function deleteSong(songId: string) {
  // queue_items cascade on delete
  check(await db().from('songs').delete().eq('id', songId), 'Delete song');
}

// ---------------------------------------------------------------------------
// Setlists
// ---------------------------------------------------------------------------

export async function insertQueueItem(item: QueueItem) {
  check(await db().from('queue_items').insert(item), 'Add to setlist');
}
export async function deleteQueueItem(id: string) {
  check(await db().from('queue_items').delete().eq('id', id), 'Remove from setlist');
}
export async function reorderQueue(orderedIds: string[]) {
  const results = await Promise.all(
    orderedIds.map((id, index) => db().from('queue_items').update({ sort_order: index + 1 }).eq('id', id))
  );
  results.forEach((r) => check(r, 'Reorder setlist'));
}
export async function saveOverride(
  queueItemId: string,
  overrides: Pick<
    QueueItem,
    'override_intro_bar_count' | 'override_intro_unit' | 'override_intro_instruments' | 'override_loop_count'
  >
) {
  check(await db().from('queue_items').update(overrides).eq('id', queueItemId), 'Save override');
}

// ---------------------------------------------------------------------------
// Sidang & Bahagian
// ---------------------------------------------------------------------------

export async function updatePart(partId: string, updates: Partial<Pick<Part, 'controller_enabled' | 'controller_passkey'>>) {
  check(await db().from('parts').update(updates).eq('id', partId), 'Update Bahagian');
}
export async function insertSession(session: Session, parts: Part[]) {
  check(await db().from('sessions').insert(session), 'Create Sidang');
  check(await db().from('parts').insert(parts), 'Create Bahagian');
}
export async function updateSession(sessionId: string, updates: Partial<Session>) {
  check(await db().from('sessions').update(updates).eq('id', sessionId), 'Update Sidang');
}
export async function deleteSession(sessionId: string) {
  // parts and their queue_items cascade on delete
  check(await db().from('sessions').delete().eq('id', sessionId), 'Delete Sidang');
}

// ---------------------------------------------------------------------------
// Instruments (renames/deletes also rewrite every song & override that uses them)
// ---------------------------------------------------------------------------

async function rewriteInstrumentReferences(map: (list: string[]) => string[], affected: (list: string[]) => boolean) {
  const [songs, queue] = await Promise.all([fetchSongs(), fetchQueueItems()]);
  const songUpdates = songs
    .filter((s) => affected(s.intro_instruments))
    .map((s) => db().from('songs').update({ intro_instruments: map(s.intro_instruments) }).eq('id', s.id));
  const queueUpdates = queue
    .filter((q) => q.override_intro_instruments && affected(q.override_intro_instruments))
    .map((q) =>
      db()
        .from('queue_items')
        .update({ override_intro_instruments: map(q.override_intro_instruments as string[]) })
        .eq('id', q.id)
    );
  (await Promise.all([...songUpdates, ...queueUpdates])).forEach((r) => check(r, 'Update instrument references'));
}

export async function insertInstrument(name: string, sortOrder: number) {
  check(await db().from('instruments').insert({ id: newId('inst'), name, sort_order: sortOrder }), 'Add instrument');
}
export async function renameInstrument(oldName: string, newName: string) {
  check(await db().from('instruments').update({ name: newName }).eq('name', oldName), 'Rename instrument');
  await rewriteInstrumentReferences(
    (list) => list.map((i) => (i === oldName ? newName : i)),
    (list) => list.includes(oldName)
  );
}
export async function deleteInstrument(name: string) {
  check(await db().from('instruments').delete().eq('name', name), 'Delete instrument');
  await rewriteInstrumentReferences(
    (list) => list.filter((i) => i !== name),
    (list) => list.includes(name)
  );
}
export async function reorderInstruments(names: string[]) {
  const results = await Promise.all(
    names.map((name, i) => db().from('instruments').update({ sort_order: i + 1 }).eq('name', name))
  );
  results.forEach((r) => check(r, 'Reorder instruments'));
}

// ---------------------------------------------------------------------------
// Access (global passkeys in the roles table)
// ---------------------------------------------------------------------------

export async function updateRolePasskey(role: RoleType, passkey: string) {
  check(
    await db().from('roles').upsert({ role_name: role, passkey }, { onConflict: 'role_name' }),
    'Update passkey'
  );
}
