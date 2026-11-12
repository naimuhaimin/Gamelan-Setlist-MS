import { supabase } from '@/lib/supabaseClient';
import type {
  AttendanceEntry,
  ChatMessage,
  SongRequest,
  PlayLogRow,
  ConvoEvent,
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
  return (check(res, 'Load Sidang') as Session[]).map((s) => ({ ...s, event_id: s.event_id ?? null }));
}
/** Konvo list; empty if the events table hasn't been created yet. */
export async function fetchEvents(): Promise<ConvoEvent[]> {
  const res = await db().from('events').select('*').order('sort_order', { ascending: true });
  if (res.error) return [];
  return res.data as ConvoEvent[];
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
  return (check(res, 'Load setlists') as QueueItem[]).map((q) => ({
    ...q,
    override_intro_unit: q.override_intro_unit ?? null,
    kind: q.kind ?? 'song',
    break_label: q.break_label ?? null,
    break_minutes: q.break_minutes ?? null,
  }));
}
export async function fetchInstruments() {
  const res = await db().from('instruments').select('name, sort_order').order('sort_order', { ascending: true });
  return (check(res, 'Load instruments') as Array<{ name: string }>).map((i) => i.name);
}
/** Admin-written catchphrases per instrument; null while the slogan column doesn't exist yet. */
export async function fetchInstrumentSlogans(): Promise<Record<string, string> | null> {
  const res = await db().from('instruments').select('name, slogan');
  if (res.error) return null;
  const out: Record<string, string> = {};
  for (const r of res.data as Array<{ name: string; slogan: string | null }>) if (r.slogan?.trim()) out[r.name] = r.slogan.trim();
  return out;
}
export async function updateInstrumentSlogan(name: string, slogan: string | null) {
  check(await db().from('instruments').update({ slogan }).eq('name', name), 'Save catchphrase');
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
  const [events, sessions, parts, songs, queueItems, roomState, instruments, roles] = await Promise.all([
    fetchEvents(),
    fetchSessions(),
    fetchParts(),
    fetchSongs(),
    fetchQueueItems(),
    fetchRoomState(),
    fetchInstruments(),
    fetchRoles(),
  ]);
  return { events, sessions, parts, songs, queueItems, roomState, instruments, roles };
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

// `notes` is only sent when the caller set it, so saving works before the notes column exists
export async function insertSong(song: Song) {
  const { notes, ...rest } = song;
  check(await db().from('songs').insert(notes === undefined ? rest : song), 'Add song');
}
export async function updateSong(song: Song) {
  const { id, title, intro_bar_count, intro_unit, intro_instruments, loop_count, rhythms, notes } = song;
  const fields = { title, intro_bar_count, intro_unit, intro_instruments, loop_count, rhythms };
  check(await db().from('songs').update(notes === undefined ? fields : { ...fields, notes }).eq('id', id), 'Update song');
}
export async function deleteSong(songId: string) {
  // queue_items cascade on delete
  check(await db().from('songs').delete().eq('id', songId), 'Delete song');
}

// ---------------------------------------------------------------------------
// Setlists
// ---------------------------------------------------------------------------

export async function insertQueueItem(item: QueueItem) {
  // Only send break columns for breaks, so song inserts work even before the breaks migration
  const { kind, break_label, break_minutes, ...rest } = item;
  const row = kind === 'break' ? { ...rest, kind, break_label, break_minutes } : rest;
  check(await db().from('queue_items').insert(row), item.kind === 'break' ? 'Add break' : 'Add to setlist');
}
/** Replace a Bahagian's whole setlist (used by "Paste setlist"). Rows must all have the same keys. */
export async function replacePartQueue(partId: string, items: QueueItem[]) {
  check(await db().from('queue_items').delete().eq('part_id', partId), 'Clear Bahagian');
  if (!items.length) return;
  const rows = items.map(({ created_at, ...rest }) => rest);
  check(await db().from('queue_items').insert(rows), 'Save setlist');
}
export async function updateBreak(id: string, label: string, minutes: number | null) {
  check(await db().from('queue_items').update({ break_label: label, break_minutes: minutes }).eq('id', id), 'Update break');
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

export async function updatePart(
  partId: string,
  updates: Partial<Pick<Part, 'controller_enabled' | 'controller_passkey' | 'interlude_label' | 'interlude_songs'>>
) {
  check(await db().from('parts').update(updates).eq('id', partId), 'Update Bahagian');
}
export async function insertSession(session: Session, parts: Part[]) {
  const { event_id, ...rest } = session;
  check(await db().from('sessions').insert(event_id ? session : rest), 'Create Sidang');
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
// Konvo (events) & thumbnails
// ---------------------------------------------------------------------------

export async function insertEvent(ev: ConvoEvent) {
  check(await db().from('events').insert(ev), 'Create Konvo');
}
export async function updateEvent(id: string, updates: Partial<ConvoEvent>) {
  check(await db().from('events').update(updates).eq('id', id), 'Update Konvo');
}
export async function deleteEvent(id: string) {
  // sessions → parts → queue_items cascade on delete
  check(await db().from('events').delete().eq('id', id), 'Delete Konvo');
}
/** Uploads an image to the public `thumbnails` bucket and returns its URL. */
export async function uploadThumbnail(file: Blob, name: string): Promise<string> {
  const path = `${newId('thumb')}-${name.replace(/[^a-z0-9.]+/gi, '-').toLowerCase()}`;
  const up = await db().storage.from('thumbnails').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (up.error) throw new Error(`Upload photo: ${up.error.message}`);
  return db().storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
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

// ---- Live chat (table may not exist until the migration has run) ----------------
export type MessageTable = 'chat_messages' | 'sidang_comments';
export async function fetchChat(sessionId: string, table: MessageTable = 'chat_messages'): Promise<ChatMessage[] | null> {
  const res = await db()
    .from(table)
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (res.error) return null;
  return (res.data as ChatMessage[]).reverse();
}
export async function sendChat(msg: Omit<ChatMessage, 'created_at'>, table: MessageTable = 'chat_messages'): Promise<ChatMessage> {
  return check(await db().from(table).insert(msg).select().single(), 'Send message') as ChatMessage;
}
export async function deleteChat(id: string, table: MessageTable = 'chat_messages') {
  check(await db().from(table).delete().eq('id', id), 'Delete message');
}

// ---- Performance log (table may not exist until the migration has run) ----------
export async function playLogAvailable(): Promise<boolean> {
  const res = await db().from('play_log').select('id').limit(1);
  return !res.error;
}
export async function fetchPlayLog(sessionId: string): Promise<PlayLogRow[] | null> {
  const res = await db().from('play_log').select('*').eq('session_id', sessionId).order('started_at', { ascending: true }).limit(2000);
  if (res.error) return null;
  return res.data as PlayLogRow[];
}
export async function insertPlayLog(row: Omit<PlayLogRow, 'id' | 'up' | 'down' | 'started_at'>) {
  check(await db().from('play_log').insert(row), 'Log performance');
}
/** When a Bahagian finishes, keep its thumbs counts with the log (votes are lost if the setlist is replaced later). */
export async function snapshotPlayVotes(partId: string, votes: Array<{ queueItemId: string; up: number; down: number }>) {
  await Promise.all(
    votes.map((v) =>
      db().from('play_log').update({ up: v.up, down: v.down }).eq('part_id', partId).eq('queue_item_id', v.queueItemId).is('up', null)
    )
  );
}

// ---- Notifications -----------------------------------------------------------------
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; device_id: string; lang: string }) {
  check(await db().from('push_subscriptions').upsert(sub, { onConflict: 'endpoint' }), 'Turn on notifications');
}
export async function deletePushSubscription(endpoint: string) {
  check(await db().from('push_subscriptions').delete().eq('endpoint', endpoint), 'Turn off notifications');
}

// ---- Song requests (tables may not exist until the migration has run) ------------
export async function fetchSongRequests(sessionId: string): Promise<{ requests: SongRequest[]; votes: Array<{ request_id: string; device_id: string }> } | null> {
  const res = await db().from('song_requests').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(500);
  if (res.error) return null;
  const requests = res.data as SongRequest[];
  if (!requests.length) return { requests, votes: [] };
  const v = await db().from('song_request_votes').select('request_id, device_id').in('request_id', requests.map((r) => r.id));
  return { requests, votes: v.error ? [] : (v.data as Array<{ request_id: string; device_id: string }>) };
}
export async function insertSongRequest(r: Omit<SongRequest, 'created_at' | 'handled_note'>) {
  check(await db().from('song_requests').insert(r), 'Send request');
}
export async function updateSongRequest(id: string, updates: Partial<Pick<SongRequest, 'status' | 'handled_note'>>) {
  check(await db().from('song_requests').update(updates).eq('id', id), 'Update request');
}
export async function deleteSongRequest(id: string) {
  check(await db().from('song_requests').delete().eq('id', id), 'Delete request');
}
export async function setRequestVote(requestId: string, deviceId: string, on: boolean) {
  if (on) check(await db().from('song_request_votes').upsert({ request_id: requestId, device_id: deviceId }, { onConflict: 'request_id,device_id' }), 'Back request');
  else check(await db().from('song_request_votes').delete().eq('request_id', requestId).eq('device_id', deviceId), 'Remove +1');
}

// ---- Attendance (tables may not exist until the migration has run) ---------------
export async function fetchAttendance(
  sessionId: string
): Promise<{ entries: AttendanceEntry[]; needs: Record<string, number> } | null> {
  const [a, n] = await Promise.all([
    db().from('sidang_attendance').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    db().from('sidang_needs').select('instrument, needed').eq('session_id', sessionId),
  ]);
  if (a.error || n.error) return null;
  const needs: Record<string, number> = {};
  for (const r of n.data as Array<{ instrument: string; needed: number }>) needs[r.instrument] = r.needed;
  return { entries: a.data as AttendanceEntry[], needs };
}
export async function upsertAttendance(e: Omit<AttendanceEntry, 'created_at'>) {
  check(await db().from('sidang_attendance').upsert(e, { onConflict: 'session_id,device_id' }), 'Register');
}
export async function deleteAttendance(id: string) {
  check(await db().from('sidang_attendance').delete().eq('id', id), 'Remove registration');
}
export async function setNeeded(sessionId: string, instrument: string, needed: number) {
  check(await db().from('sidang_needs').upsert({ session_id: sessionId, instrument, needed }, { onConflict: 'session_id,instrument' }), 'Save players needed');
}

// ---- App usage during a live Sidang (table may not exist until the migration has run) ----
export interface ViewerRow {
  device_id: string;
  role: string;
  instrument: string | null;
  first_seen: string;
  last_seen: string;
}
/** Upsert without first_seen, so the first check-in keeps its time and later ones only move last_seen. */
export async function pingViewer(v: { session_id: string; device_id: string; role: string; instrument: string | null }) {
  const res = await db()
    .from('sidang_viewers')
    .upsert({ ...v, last_seen: new Date().toISOString() }, { onConflict: 'session_id,device_id' });
  return !res.error;
}
export async function fetchViewers(sessionId: string): Promise<ViewerRow[] | null> {
  const res = await db().from('sidang_viewers').select('device_id, role, instrument, first_seen, last_seen').eq('session_id', sessionId);
  if (res.error) return null;
  return res.data as ViewerRow[];
}
/** Registrations per Sidang, for comparing a Sidang with the rest of its event. */
export async function fetchAttendanceCounts(sessionIds: string[]): Promise<Record<string, number> | null> {
  if (!sessionIds.length) return {};
  const res = await db().from('sidang_attendance').select('session_id').in('session_id', sessionIds);
  if (res.error) return null;
  const out: Record<string, number> = {};
  for (const r of res.data as Array<{ session_id: string }>) out[r.session_id] = (out[r.session_id] ?? 0) + 1;
  return out;
}
