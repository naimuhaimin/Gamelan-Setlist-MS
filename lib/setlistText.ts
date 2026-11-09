import type { Part, ResolvedQueueItem, Session, Song } from '@/types';

/**
 * The Maestro's WhatsApp-style setlist message, both ways:
 *
 *   SIDANG 25
 *
 *   BAHAGIAN 1
 *   36 Gempita
 *   3 Topeng
 *   -STOP (Graduan Meninggal Dunia)-
 *   50 Ulik Seri Rama
 *
 *   BAHAGIAN 2
 *   ...
 *
 * Song lines are matched to the library by title (number + name), so "36 Gempita" finds "36 Gempita".
 * "-STOP-" / "-STOP (reason)-" lines (also REHAT / BREAK) become breaks.
 */

export type ParsedLine =
  | { kind: 'song'; line: number; text: string; song: Song | null; note?: 'number' | 'name'; candidates: Song[] }
  | { kind: 'break'; line: number; text: string; label: string };

export interface ParsedPart {
  number: number;
  items: ParsedLine[];
}

export interface ParsedSetlist {
  sidangNumber: number | null;
  parts: ParsedPart[];
  ignored: Array<{ line: number; text: string }>; // lines we could not place
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** "36 Gempita" -> { num: "36", name: "gempita" } */
const split = (title: string) => {
  const n = norm(title);
  const m = n.match(/^(\d+)\s+(.*)$/);
  return m ? { num: m[1], name: m[2] } : { num: null as string | null, name: n };
};

/** Find the library song for one line of text. */
export function matchSong(text: string, songs: Song[]): { song: Song | null; note?: 'number' | 'name'; candidates: Song[] } {
  const want = norm(text);
  if (!want) return { song: null, candidates: [] };

  const exact = songs.find((s) => norm(s.title) === want);
  if (exact) return { song: exact, candidates: [] };

  const { num, name } = split(text);
  const lib = songs.map((s) => ({ s, ...split(s.title) }));

  if (num) {
    const sameNum = lib.filter((x) => x.num === num);
    if (sameNum.length === 1) return { song: sameNum[0].s, note: 'number', candidates: [] };
    if (sameNum.length > 1) {
      // e.g. "1 Timang Burung" vs "1 Timang Burung Tarian": prefer the same name, then the closest one
      const byName = sameNum.find((x) => x.name === name);
      if (byName) return { song: byName.s, candidates: [] };
      const starts = sameNum.filter((x) => name && (x.name.startsWith(name) || name.startsWith(x.name)));
      if (starts.length === 1) return { song: starts[0].s, note: 'number', candidates: [] };
      return { song: null, candidates: sameNum.map((x) => x.s) };
    }
  }

  // No (matching) number: try the name alone
  const sameName = lib.filter((x) => x.name === name);
  if (sameName.length === 1) return { song: sameName[0].s, note: 'name', candidates: [] };
  if (sameName.length > 1) return { song: null, candidates: sameName.map((x) => x.s) };

  // Last try: the name is part of exactly one title
  if (name.length >= 4) {
    const contains = lib.filter((x) => x.name.includes(name));
    if (contains.length === 1) return { song: contains[0].s, note: 'name', candidates: [] };
    if (contains.length > 1) return { song: null, candidates: contains.slice(0, 5).map((x) => x.s) };
  }
  return { song: null, candidates: [] };
}

const BREAK_RE = /^[\s\-–—_*=~•.]*(stop|rehat|break|berhenti)\b\s*(.*?)[\s\-–—_*=~•.]*$/i;
const PART_RE = /^(?:bahagian|bhg|part|b)\s*[.:#-]?\s*(\d+)\s*[:.-]?\s*$/i;
const SIDANG_RE = /^sidang\s*[.:#-]?\s*(\d+)\b/i;

export function parseSetlist(text: string, songs: Song[]): ParsedSetlist {
  const out: ParsedSetlist = { sidangNumber: null, parts: [], ignored: [] };
  const lines = text.replace(/\r/g, '').split('\n');
  const hasHeaders = lines.some((l) => PART_RE.test(l.replace(/[*_~]/g, '').trim()));
  let current: ParsedPart | null = hasHeaders ? null : { number: 1, items: [] };
  if (current) out.parts.push(current);

  lines.forEach((raw, i) => {
    const line = i + 1;
    // WhatsApp formatting (*bold*, _italic_) and list bullets are not part of the text
    const t = raw.replace(/[*_~]/g, '').trim();
    if (!t) return;

    const sidang = t.match(SIDANG_RE);
    if (sidang) {
      out.sidangNumber = Number(sidang[1]);
      return;
    }
    const part = t.match(PART_RE);
    if (part) {
      const n = Number(part[1]);
      current = out.parts.find((p) => p.number === n) ?? null;
      if (!current) {
        current = { number: n, items: [] };
        out.parts.push(current);
      }
      return;
    }
    if (!current) {
      out.ignored.push({ line, text: t });
      return;
    }
    const brk = t.match(BREAK_RE);
    if (brk) {
      const rest = brk[2].trim();
      const paren = rest.match(/\(([^)]*)\)/);
      const label = (paren ? paren[1] : rest.replace(/^[:\-–—]\s*/, '')).trim() || 'STOP';
      current.items.push({ kind: 'break', line, text: t, label });
      return;
    }
    const songText = t.replace(/^[-–—•·]\s+/, '').trim();
    current.items.push({ kind: 'song', line, text: songText, ...matchSong(songText, songs) });
  });

  out.parts.sort((a, b) => a.number - b.number);
  return out;
}

/** The same message format, from what is in the app. */
export function formatSetlist(session: Session, parts: Part[], resolve: (partId: string) => ResolvedQueueItem[]): string {
  const blocks = parts
    .filter((p) => p.session_id === session.id)
    .sort((a, b) => a.part_number - b.part_number)
    .map((p) => {
      const lines = resolve(p.id).map((r) => {
        if (!r.isBreak) return r.song.title;
        // A label that already starts with STOP / REHAT / BREAK shouldn't say it twice
        const label = r.song.title.trim().replace(/^(break|rehat|stop|berhenti)\b[\s:–—-]*/i, '').trim();
        return label ? `-STOP (${label})-` : '-STOP-';
      });
      return [`BAHAGIAN ${p.part_number}`, ...lines].join('\n');
    });
  const header = /^sidang\s*\d+$/i.test(session.name.trim())
    ? session.name.trim().toUpperCase()
    : `SIDANG ${session.sidang_number}${session.name.trim() ? ` (${session.name.trim()})` : ''}`;
  return [header, ...blocks].join('\n\n') + '\n';
}
