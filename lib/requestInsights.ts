import type { SongRequest } from '@/types';
import type { Summary } from '@/lib/summary';

/**
 * Song-request insights for a Sidang's Summary and its PDF: which requests were played, which weren't,
 * how much support they had, and how the requested songs were rated compared with the rest.
 */

export interface RequestOutcome {
  id: string;
  title: string;
  author: string;
  instrument: string | null;
  note: string | null;
  votes: number; // +1s from others (not the requester)
  status: SongRequest['status'];
  played: boolean;
  playedAt: string | null;
  partName: string | null;
  up: number;
  down: number;
  createdAt: string;
}

export interface RequestInsights {
  total: number;
  people: number; // different phones that requested or gave +1
  totalVotes: number;
  played: RequestOutcome[];
  notPlayed: RequestOutcome[];
  playedRate: number | null; // 0..1
  /** Average thumbs up per played song, requested vs. the rest of the setlist. */
  requestedAvgUp: number | null;
  otherAvgUp: number | null;
  mostWanted: RequestOutcome | null;
  lateRequests: number; // made after the Sidang started
}

/** "36 Gempita", "gempita " and "Gempita" all compare equal. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const bare = (s: string) => norm(s).replace(/^\d+\s*/, '');

export function computeRequestInsights(input: {
  requests: SongRequest[];
  votes: Array<{ request_id: string; device_id: string }>;
  summary: Summary;
  songTitle: (songId: string) => string | undefined;
}): RequestInsights {
  const { requests, votes, summary, songTitle } = input;

  // Every song that was actually played, by its title
  const playedItems = summary.parts.flatMap((p) => p.items.filter((i) => i.kind === 'song').map((i) => ({ ...i, partName: p.partName })));
  const find = (r: SongRequest) => {
    const names = [r.title, r.song_id ? songTitle(r.song_id) : undefined].filter(Boolean) as string[];
    return (
      playedItems.find((i) => names.some((n) => norm(n) === norm(i.title))) ??
      playedItems.find((i) => names.some((n) => bare(n) && bare(n) === bare(i.title))) ??
      null
    );
  };

  const outcomes: RequestOutcome[] = requests.map((r) => {
    const hit = find(r);
    return {
      id: r.id,
      // the setlist's own name once played ("48 Lenggok", not what was typed: "lenggok")
      title: hit?.title ?? (r.song_id ? songTitle(r.song_id) : undefined) ?? r.title,
      author: r.author,
      instrument: r.instrument,
      note: r.note,
      votes: votes.filter((v) => v.request_id === r.id && v.device_id !== r.device_id).length,
      status: r.status,
      played: !!hit,
      playedAt: hit?.startedAt ?? null,
      partName: hit?.partName ?? null,
      up: hit?.up ?? 0,
      down: hit?.down ?? 0,
      createdAt: r.created_at,
    };
  });
  const byVotes = (a: RequestOutcome, b: RequestOutcome) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt);
  const played = outcomes.filter((o) => o.played).sort((a, b) => (a.playedAt ?? '').localeCompare(b.playedAt ?? ''));
  const notPlayed = outcomes.filter((o) => !o.played).sort(byVotes);

  const requestedTitles = new Set(played.map((o) => norm(o.title)));
  const playedRequested = playedItems.filter((i) => played.some((o) => o.playedAt === i.startedAt) || requestedTitles.has(norm(i.title)));
  const others = playedItems.filter((i) => !playedRequested.includes(i));
  const avg = (list: typeof playedItems) => (list.length ? list.reduce((n, i) => n + i.up, 0) / list.length : null);

  const start = summary.startedAt ? Date.parse(summary.startedAt) : null;

  return {
    total: outcomes.length,
    people: new Set([...requests.map((r) => r.device_id), ...votes.map((v) => v.device_id)]).size,
    totalVotes: outcomes.reduce((n, o) => n + o.votes, 0),
    played,
    notPlayed,
    playedRate: outcomes.length ? played.length / outcomes.length : null,
    requestedAvgUp: avg(playedRequested),
    otherAvgUp: avg(others),
    mostWanted: [...outcomes].sort(byVotes)[0] ?? null,
    lateRequests: start === null ? 0 : outcomes.filter((o) => Date.parse(o.createdAt) > start).length,
  };
}
