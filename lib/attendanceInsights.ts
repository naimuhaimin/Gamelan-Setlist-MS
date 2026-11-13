import type { AttendanceEntry } from '@/types';
import type { ViewerRow } from '@/lib/supabaseService';

/**
 * Attendance + app-usage maths shared by the Summary page and its PDF report,
 * so both always show the same numbers.
 */

const PING_GAP_MS = 90_000; // a phone counts as "on" until 90 s after its last check-in (it checks in every 60 s)
const LAST_MINUTE_MS = 30 * 60_000;

/** Most phones that had the app open at the same moment, from their first/last check-in times. */
export function peakAtOnce(rows: ViewerRow[]): { peak: number; at: string | null } {
  const events: Array<[number, number]> = [];
  for (const r of rows) {
    events.push([Date.parse(r.first_seen), 1]);
    events.push([Date.parse(r.last_seen) + PING_GAP_MS, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let peak = 0;
  let at: number | null = null;
  for (const [time, d] of events) {
    now += d;
    if (now > peak) {
      peak = now;
      at = time;
    }
  }
  return { peak, at: at === null ? null : new Date(at).toISOString() };
}

export interface AppUsage {
  total: number;
  peak: number;
  at: string | null;
  byRole: Map<string, number>;
  byInstrument: Map<string, number>; // '' = no instrument chosen
}

export function computeUsage(viewers: ViewerRow[]): AppUsage {
  const byRole = new Map<string, number>();
  const byInstrument = new Map<string, number>();
  for (const v of viewers) {
    byRole.set(v.role, (byRole.get(v.role) ?? 0) + 1);
    const key = v.instrument || '';
    byInstrument.set(key, (byInstrument.get(key) ?? 0) + 1);
  }
  return { total: viewers.length, ...peakAtOnce(viewers), byRole, byInstrument };
}

export interface InstrumentRow {
  name: string;
  people: AttendanceEntry[];
  min: number;
  seen: number;
  lacking: number;
}

export interface AttendanceInsights {
  rows: InstrumentRow[];
  wasLive: boolean;
  seenCount: number;
  minsMet: number;
  minsSet: number;
  notSeen: AttendanceEntry[];
  unregistered: number;
  unregByInstrument: Map<string, number>;
  timing: { early: number; lastMinute: number; late: number } | null;
  first: string | null;
  last: string | null;
  avg: number | null; // average registrations of the event's other Sidang that have any
}

export function computeInsights(input: {
  entries: AttendanceEntry[];
  needs: Record<string, number>;
  viewers: ViewerRow[] | null | undefined;
  instruments: string[];
  startedAt: string | null;
  eventCounts: Record<string, number> | null;
  siblings: string[];
  sessionId: string;
}): AttendanceInsights {
  const { entries, needs, viewers, instruments, startedAt, eventCounts, siblings, sessionId } = input;
  const seen = new Set((viewers ?? []).map((v) => v.device_id));
  const registeredDevices = new Set(entries.map((e) => e.device_id));
  const wasLive = (viewers?.length ?? 0) > 0;

  const names = [...instruments];
  for (const e of entries) if (!names.includes(e.instrument)) names.push(e.instrument);
  const rows = names
    .map((name) => {
      const people = entries.filter((e) => e.instrument === name);
      const min = needs[name] ?? 0;
      return { name, people, min, seen: people.filter((p) => seen.has(p.device_id)).length, lacking: Math.max(0, min - people.length) };
    })
    .filter((r) => r.people.length > 0 || r.min > 0);

  const withMin = rows.filter((r) => r.min > 0);
  const notSeen = wasLive ? entries.filter((e) => !seen.has(e.device_id)) : [];
  const unregistered = (viewers ?? []).filter((v) => v.role === 'player' && v.instrument && !registeredDevices.has(v.device_id));
  const unregByInstrument = new Map<string, number>();
  for (const v of unregistered) unregByInstrument.set(v.instrument!, (unregByInstrument.get(v.instrument!) ?? 0) + 1);

  // Timing, measured against when the Sidang actually started
  let timing: AttendanceInsights['timing'] = null;
  if (startedAt && entries.length) {
    const start = Date.parse(startedAt);
    timing = { early: 0, lastMinute: 0, late: 0 };
    for (const e of entries) {
      const at = Date.parse(e.created_at);
      if (at > start) timing.late++;
      else if (start - at <= LAST_MINUTE_MS) timing.lastMinute++;
      else timing.early++;
    }
  }
  const times = entries.map((e) => e.created_at).sort();

  let avg: number | null = null;
  if (eventCounts) {
    const others = siblings.filter((id) => id !== sessionId).map((id) => eventCounts[id] ?? 0).filter((n) => n > 0);
    if (others.length) avg = others.reduce((a, b) => a + b, 0) / others.length;
  }

  return {
    rows,
    wasLive,
    seenCount: entries.filter((e) => seen.has(e.device_id)).length,
    minsMet: withMin.filter((r) => r.lacking === 0).length,
    minsSet: withMin.length,
    notSeen,
    unregistered: unregistered.length,
    unregByInstrument,
    timing,
    first: times[0] ?? null,
    last: times[times.length - 1] ?? null,
    avg,
  };
}
