import type { PlayLogRow } from '@/types';

/**
 * Turns the performance log (one row each time the stage moved) into a per-Sidang summary:
 * what was played in each Bahagian, when, for how long, and how it was rated.
 * Only the latest run of each Bahagian counts (a rehearsal earlier in the day is ignored).
 */

export interface SummaryItem {
  key: string;
  kind: 'song' | 'break';
  title: string;
  startedAt: string;
  seconds: number | null; // null = unknown (e.g. the Bahagian was left without finishing)
  ongoing: boolean;
  up: number;
  down: number;
}

export interface SummaryPart {
  partId: string;
  partNumber: number;
  partName: string;
  startedAt: string;
  endedAt: string | null;
  seconds: number | null;
  finished: boolean;
  ongoing: boolean;
  items: SummaryItem[];
  intermissionSeconds: number | null; // gap before the next Bahagian started
}

export interface Summary {
  parts: SummaryPart[];
  songsPlayed: number;
  playSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
  up: number;
  down: number;
  mostLiked: SummaryItem | null;
  longest: SummaryItem | null;
}

const MAX_GAP = 3 * 60 * 60; // anything longer is "walked away", not a duration
const secs = (a: string, b: string | number) => Math.round(((typeof b === 'number' ? b : Date.parse(b)) - Date.parse(a)) / 1000);

export function buildSummary(
  rows: PlayLogRow[],
  opts: {
    now: number;
    /** The Bahagian on stage right now and not finished, if it belongs to this Sidang. */
    livePartId: string | null;
    /** Current thumbs for a setlist position that still exists; null once it has been removed. */
    liveVotes: (queueItemId: string) => { up: number; down: number } | null;
  }
): Summary {
  const byPart = new Map<string, PlayLogRow[]>();
  for (const r of [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    byPart.set(r.part_id, [...(byPart.get(r.part_id) ?? []), r]);
  }

  const parts: SummaryPart[] = [];
  for (const [partId, all] of byPart) {
    // Latest run: from the last "went live" row
    let start = 0;
    all.forEach((r, i) => {
      if (r.started_part) start = i;
    });
    const run = all.slice(start);
    const last = run[run.length - 1];
    const finished = last.kind === 'finish';
    const ongoing = !finished && opts.livePartId === partId;

    const merged = new Map<string, SummaryItem>();
    run.forEach((r, i) => {
      if (r.kind === 'finish') return;
      const next = run[i + 1];
      let seconds: number | null = next ? secs(r.started_at, next.started_at) : ongoing ? secs(r.started_at, opts.now) : null;
      if (seconds !== null && (seconds < 0 || seconds > MAX_GAP)) seconds = null;
      const key = r.queue_item_id ?? `${r.kind}:${r.title}`;
      const live = r.queue_item_id ? opts.liveVotes(r.queue_item_id) : null;
      const prev = merged.get(key);
      if (prev) {
        // Went back to it: add the time, keep its first start
        prev.seconds = prev.seconds === null && seconds === null ? null : (prev.seconds ?? 0) + (seconds ?? 0);
        prev.ongoing = prev.ongoing || (!next && ongoing);
        if (!live) {
          prev.up = Math.max(prev.up, r.up ?? 0);
          prev.down = Math.max(prev.down, r.down ?? 0);
        }
      } else {
        merged.set(key, {
          key,
          kind: r.kind,
          title: r.title,
          startedAt: r.started_at,
          seconds,
          ongoing: !next && ongoing,
          up: live ? live.up : r.up ?? 0,
          down: live ? live.down : r.down ?? 0,
        });
      }
    });

    const first = run[0];
    const endedAt = finished ? last.started_at : null;
    let seconds: number | null = finished ? secs(first.started_at, last.started_at) : ongoing ? secs(first.started_at, opts.now) : null;
    if (seconds !== null && (seconds < 0 || seconds > MAX_GAP)) seconds = null;
    parts.push({
      partId,
      partNumber: first.part_number,
      partName: first.part_name,
      startedAt: first.started_at,
      endedAt,
      seconds,
      finished,
      ongoing,
      items: [...merged.values()],
      intermissionSeconds: null,
    });
  }

  parts.sort((a, b) => a.partNumber - b.partNumber);
  parts.forEach((p, i) => {
    const next = parts[i + 1];
    if (p.endedAt && next) {
      const gap = secs(p.endedAt, next.startedAt);
      if (gap > 0 && gap < MAX_GAP) p.intermissionSeconds = gap;
    }
  });

  const songs = parts.flatMap((p) => p.items.filter((i) => i.kind === 'song'));
  const liked = [...songs].filter((s) => s.up > 0).sort((a, b) => b.up - b.down - (a.up - a.down) || b.up - a.up)[0] ?? null;
  const longest = [...songs].filter((s) => s.seconds !== null && !s.ongoing).sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0))[0] ?? null;
  const starts = parts.map((p) => p.startedAt).sort();
  const ends = parts.map((p) => p.endedAt).filter((x): x is string => !!x).sort();

  return {
    parts,
    songsPlayed: songs.length,
    playSeconds: parts.reduce((n, p) => n + (p.seconds ?? 0), 0),
    startedAt: starts[0] ?? null,
    endedAt: parts.length && parts.every((p) => p.finished) ? ends[ends.length - 1] ?? null : null,
    up: songs.reduce((n, s) => n + s.up, 0),
    down: songs.reduce((n, s) => n + s.down, 0),
    mostLiked: liked,
    longest,
  };
}

/** 75 -> "1:15", 3700 -> "1:01:40". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '–';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const formatClock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–';
