import type { jsPDF as JsPDF } from 'jspdf';
import type { ChatMessage } from '@/types';
import type { Summary } from '@/lib/summary';
import { formatClock, formatDuration } from '@/lib/summary';
import type { AppUsage, AttendanceInsights } from '@/lib/attendanceInsights';
import type { RequestInsights, RequestOutcome } from '@/lib/requestInsights';

/**
 * The Sidang summary as a printable A4 PDF report, drawn with jsPDF (loaded only when needed).
 * Same numbers as the Summary tab: everything is passed in already calculated.
 */

type T = (en: string, vars?: Record<string, string | number | null | undefined>) => string;

export interface SummaryReportInput {
  t: T;
  lang: string;
  sessionName: string;
  eventName: string | null;
  venue: string | null;
  dateText: string;
  summary: Summary;
  usage: AppUsage | null;
  insights: AttendanceInsights | null;
  registeredCount: number;
  comments: ChatMessage[];
  requests?: RequestInsights | null;
  roleLabel: (role: string) => string;
  logoUrl: string;
}

// Brand colours (light, print-friendly)
const C = {
  night: [13, 11, 9],
  ink: [29, 23, 18],
  muted: [107, 95, 80],
  faint: [150, 138, 122],
  line: [227, 216, 198],
  gold: [168, 116, 24],
  goldSoft: [246, 236, 216],
  goldLight: [227, 173, 72],
  crimson: [190, 52, 42],
  crimsonSoft: [248, 227, 224],
  breakBar: [196, 22, 48],
  jade: [26, 135, 103],
  jadeSoft: [221, 241, 233],
  stone: [196, 186, 172],
  stoneSoft: [238, 233, 225],
  paper: [255, 253, 248],
} as const;

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margin
const CW = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 18;

/** Built-in PDF fonts only cover Western European characters: keep those, drop the rest (e.g. emoji). */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return [...s]
    .map((ch) => (ch === '→' ? '>' : ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.includes(ch) ? ch : ''))
    .join('')
    .trim();
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildSummaryPdf(input: SummaryReportInput): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const { t, summary: s, usage, insights: ins } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${clean(input.sessionName)} · ${t('Summary')}`, author: 'Anjung Live', creator: 'Anjung Live' });

  const fill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold' | 'italic', size: number) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  let y = 0;
  const newPage = () => {
    doc.addPage();
    fill(C.paper);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    // slim running header on follow-on pages
    fill(C.gold);
    doc.rect(M, 12, 18, 0.8, 'F');
    font('normal', 8);
    color(C.muted);
    doc.text(clean(`${input.sessionName}${input.eventName ? ` · ${input.eventName}` : ''}`), M, 10);
    y = 20;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const section = (title: string, needed = 30) => {
    ensure(needed);
    y += 4;
    font('bold', 13);
    color(C.ink);
    doc.text(clean(title), M, y);
    fill(C.gold);
    doc.rect(M, y + 2, 12, 0.8, 'F');
    y += 8;
  };
  const wrap = (text: string, width: number, style: 'normal' | 'bold' | 'italic', size: number) => {
    font(style, size);
    return doc.splitTextToSize(clean(text), width) as string[];
  };

  // ---------------------------------------------------------------- header band
  fill(C.paper);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  fill(C.night);
  doc.rect(0, 0, PAGE_W, 46, 'F');
  fill(C.gold);
  doc.rect(0, 46, PAGE_W, 1.2, 'F');
  const logo = await loadImage(input.logoUrl);
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', M, 9, 28, 28);
    } catch {
      // logo is optional
    }
  }
  const tx = logo ? M + 34 : M;
  font('bold', 8.5);
  color(C.goldLight);
  doc.text(t('SIDANG SUMMARY REPORT'), tx, 15, { charSpace: 0.6 });
  font('bold', 22);
  color([244, 238, 228]);
  doc.text(clean(input.sessionName), tx, 25);
  font('normal', 10);
  color([200, 190, 175]);
  doc.text(clean([input.eventName, input.dateText, input.venue].filter(Boolean).join('  ·  ')), tx, 32, { maxWidth: PAGE_W - tx - M });
  font('normal', 8);
  color([150, 140, 125]);
  const generated = new Date().toLocaleString(input.lang === 'ms' ? 'ms-MY' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(clean(t('Generated {when}', { when: generated })), tx, 39);
  y = 58;

  // ---------------------------------------------------------------- key figures
  const tiles: Array<[string, string, string?]> = [
    [t('Songs played'), String(s.songsPlayed)],
    [t('Playing time'), formatDuration(s.parts.length ? s.playSeconds : null)],
    [t('Time'), s.startedAt ? `${formatClock(s.startedAt)} – ${s.endedAt ? formatClock(s.endedAt) : '...'}` : '–'],
    [t('Ratings'), `+${s.up}  /  -${s.down}`, t('thumbs up / down')],
    [t('App users'), usage && usage.total ? String(usage.total) : '–', usage && usage.total ? t('{n} at once at most', { n: usage.peak }) : undefined],
    [
      t('Registered players'),
      String(input.registeredCount),
      ins && ins.wasLive && input.registeredCount ? t('{n} seen live', { n: ins.seenCount }) : undefined,
    ],
  ];
  const tw = (CW - 2 * 4) / 3;
  const th = 21;
  tiles.forEach(([label, value, note], i) => {
    const x = M + (i % 3) * (tw + 4);
    const ty = y + Math.floor(i / 3) * (th + 4);
    fill(C.goldSoft);
    doc.roundedRect(x, ty, tw, th, 2, 2, 'F');
    font('bold', 7.5);
    color(C.muted);
    doc.text(clean(label.toUpperCase()), x + 4, ty + 6, { charSpace: 0.3 });
    font('bold', 15);
    color(C.ink);
    doc.text(clean(value), x + 4, ty + 14);
    if (note) {
      font('normal', 7.5);
      color(C.muted);
      doc.text(clean(note), x + 4, ty + 18.5);
    }
  });
  y += 2 * th + 4 + 6;

  const highlights: string[] = [];
  if (s.mostLiked) highlights.push(t('Most liked: {title} (+{n})', { title: s.mostLiked.title, n: s.mostLiked.up }));
  if (s.longest) highlights.push(t('Longest song: {title} ({time})', { title: s.longest.title, time: formatDuration(s.longest.seconds) }));
  if (highlights.length) {
    font('normal', 9.5);
    color(C.ink);
    for (const line of wrap(highlights.join('   ·   '), CW, 'normal', 9.5)) {
      doc.text(line, M, y);
      y += 5;
    }
    y += 2;
  }

  // ---------------------------------------------------------------- app users
  if (usage && usage.total) {
    section(t('App users'), 34);
    font('normal', 9);
    color(C.muted);
    doc.text(clean(t('Phones that had the app open while this Sidang was live.')), M, y);
    y += 6;
    const roles = [...usage.byRole.entries()].map(([r, n]) => `${input.roleLabel(r)} ${n}`).join('   ·   ');
    font('normal', 9.5);
    color(C.ink);
    doc.text(clean(`${t('In total')}: ${usage.total}   ·   ${t('Most at once')}: ${usage.peak}${usage.at ? ` (${t('around {time}', { time: formatClock(usage.at) })})` : ''}`), M, y);
    y += 5.5;
    doc.text(clean(roles), M, y);
    y += 6;
    const insts = [...usage.byInstrument.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...insts.map(([, n]) => n));
    for (const [inst, n] of insts) {
      ensure(6);
      font('normal', 9);
      color(inst ? C.ink : C.muted);
      doc.text(clean(inst || t('No instrument')), M, y);
      fill(C.gold);
      doc.rect(M + 38, y - 3, ((CW - 52) * n) / max, 3.2, 'F');
      font('bold', 9);
      color(C.ink);
      doc.text(String(n), M + CW, y, { align: 'right' });
      y += 5.5;
    }
    y += 2;
  }

  // ---------------------------------------------------------------- Bahagian length chart
  const timed = s.parts.filter((p) => p.seconds !== null && p.seconds > 0);
  if (timed.length) {
    section(t('Length of each Bahagian'), 20 + timed.length * 9);
    // legend
    font('normal', 8);
    color(C.muted);
    fill(C.gold);
    doc.rect(M, y - 2.6, 4, 3, 'F');
    doc.text(t('Songs'), M + 5.5, y);
    fill(C.breakBar);
    doc.rect(M + 22, y - 2.6, 4, 3, 'F');
    doc.text(t('Breaks'), M + 27.5, y);
    y += 6;
    const max = Math.max(...timed.map((p) => p.seconds!));
    const labelW = 28;
    const valueW = 58; // room for the total and the songs/breaks split
    const barW = CW - labelW - valueW - 4;
    for (const p of timed) {
      ensure(9);
      const song = p.items.filter((i) => i.kind === 'song').reduce((n, i) => n + (i.seconds ?? 0), 0);
      const brk = p.items.filter((i) => i.kind === 'break').reduce((n, i) => n + (i.seconds ?? 0), 0);
      const known = song + brk || p.seconds!;
      const total = (p.seconds! / max) * barW;
      const sw = (song / known) * total;
      const bw = (brk / known) * total;
      font('bold', 9.5);
      color(C.ink);
      doc.text(clean(p.partName), M, y);
      fill(C.gold);
      if (sw > 0) doc.rect(M + labelW, y - 3.4, sw, 4.2, 'F');
      if (bw > 0) {
        fill(C.breakBar);
        doc.rect(M + labelW + sw + (sw > 0 ? 0.6 : 0), y - 3.4, Math.max(0, bw - 0.6), 4.2, 'F');
      }
      font('bold', 9.5);
      doc.text(formatDuration(p.seconds), M + CW, y, { align: 'right' });
      font('normal', 7.5);
      color(C.muted);
      doc.text(
        clean(`${t('Songs')} ${formatDuration(song)}${brk ? ` · ${t('Breaks')} ${formatDuration(brk)}` : ''}`),
        M + CW - 16,
        y,
        { align: 'right' }
      );
      y += 8;
    }
    const gaps = s.parts.filter((p) => p.intermissionSeconds !== null);
    if (gaps.length) {
      font('normal', 8.5);
      color(C.muted);
      doc.text(
        clean(`${t('Intermission')}: ${gaps.map((p) => `${t('after {part}', { part: p.partName })} ${formatDuration(p.intermissionSeconds)}`).join('  ·  ')}`),
        M,
        y
      );
      y += 6;
    }
  }

  // ---------------------------------------------------------------- attendance insights
  if (ins && input.registeredCount > 0) {
    section(t('Attendance insights'), 60);
    const facts = [
      `${t('Registered')}: ${input.registeredCount}`,
      ins.wasLive ? `${t('Seen live')}: ${ins.seenCount}/${input.registeredCount}` : null,
      ins.minsSet ? `${t('Minimums met')}: ${ins.minsMet}/${ins.minsSet}` : null,
      ins.avg !== null ? t('Event average {n} per Sidang', { n: Math.round(ins.avg * 10) / 10 }) : null,
    ].filter(Boolean);
    font('normal', 9.5);
    color(C.ink);
    doc.text(clean(facts.join('   ·   ')), M, y);
    y += 5.5;
    if (ins.timing) {
      font('normal', 9);
      color(C.muted);
      doc.text(
        clean(
          `${t('When people registered')}: ${ins.timing.early} ${t('early')} · ${ins.timing.lastMinute} ${t('in the last 30 min')} · ${ins.timing.late} ${t('after it started')}`
        ),
        M,
        y
      );
      y += 6;
    }

    const callout = (title: string, body: string, warn: boolean) => {
      const lines = wrap(body, CW - 8, 'normal', 8.5);
      const h = 8 + lines.length * 4.4;
      ensure(h + 2);
      fill(warn ? C.crimsonSoft : C.goldSoft);
      doc.roundedRect(M, y, CW, h, 1.5, 1.5, 'F');
      fill(warn ? C.crimson : C.gold);
      doc.rect(M, y, 1.2, h, 'F');
      font('bold', 9);
      color(warn ? C.crimson : C.ink);
      doc.text(clean(title), M + 4, y + 5);
      font('normal', 8.5);
      color(C.ink);
      lines.forEach((l, i) => doc.text(l, M + 4, y + 9.4 + i * 4.4));
      y += h + 2.5;
    };
    const lacking = ins.rows.filter((r) => r.lacking > 0);
    if (lacking.length)
      callout(t('Below the minimum'), lacking.map((r) => t('{instrument} (lacking {n})', { instrument: r.name, n: r.lacking })).join('  ·  '), true);
    if (ins.notSeen.length)
      callout(
        t('Registered but not seen in the app while live ({n})', { n: ins.notSeen.length }),
        ins.notSeen.map((e) => `${e.name} (${e.instrument})`).join(', '),
        false
      );
    if (ins.unregistered > 0)
      callout(
        t('Used the app but didn’t register ({n})', { n: ins.unregistered }),
        [...ins.unregByInstrument.entries()].map(([i, n]) => `${i} ${n}`).join('  ·  '),
        false
      );

    // table
    y += 5;
    const cols = [
      { w: 34, label: t('Instrument') },
      { w: 14, label: t('Reg.'), right: true },
      { w: 14, label: t('Min.'), right: true },
      { w: 14, label: t('Live'), right: true },
      { w: CW - 76, label: t('Players') },
    ];
    const head = () => {
      ensure(10);
      fill(C.goldSoft);
      doc.rect(M, y - 4.5, CW, 7, 'F');
      font('bold', 8);
      color(C.muted);
      let x = M + 2;
      for (const c of cols) {
        doc.text(clean(c.label.toUpperCase()), c.right ? x + c.w - 4 : x, y, { align: c.right ? 'right' : 'left' });
        x += c.w;
      }
      y += 6;
    };
    head();
    for (const r of ins.rows) {
      const names = wrap(r.people.map((p) => p.name).join(', ') || '–', cols[4].w - 2, 'normal', 8.5);
      const h = Math.max(r.lacking ? 9.5 : 6, names.length * 4.2 + 2);
      if (y + h > BOTTOM) {
        newPage();
        head();
      }
      font('bold', 9);
      color(C.ink);
      let x = M + 2;
      doc.text(clean(r.name), x, y);
      x += cols[0].w;
      color(r.lacking ? C.crimson : C.ink);
      doc.text(String(r.people.length), x + cols[1].w - 4, y, { align: 'right' });
      x += cols[1].w;
      font('normal', 9);
      color(C.muted);
      doc.text(r.min ? String(r.min) : '–', x + cols[2].w - 4, y, { align: 'right' });
      x += cols[2].w;
      doc.text(ins.wasLive ? String(r.seen) : '–', x + cols[3].w - 4, y, { align: 'right' });
      x += cols[3].w;
      font('normal', 8.5);
      color(C.ink);
      names.forEach((l, i) => doc.text(l, x, y + i * 4.2));
      if (r.lacking) {
        font('bold', 7.5);
        color(C.crimson);
        doc.text(clean(t('Lacking {n}', { n: r.lacking })), M + 2, y + 4);
      }
      y += h;
      stroke(C.line);
      doc.setLineWidth(0.2);
      doc.line(M, y - 3.6, M + CW, y - 3.6);
    }
    y += 2;
  }

  // ---------------------------------------------------------------- song requests
  const rq = input.requests;
  if (rq && rq.total > 0) {
    section(t('Song request insights'), 70);
    const avg = (n: number | null) => (n === null ? '–' : String(Math.round(n * 10) / 10));

    // -- four key figures
    const tiles: Array<[string, string, string | undefined, readonly number[]]> = [
      [t('Requests'), String(rq.total), t('from {n} people', { n: rq.people }), C.goldSoft],
      [
        t('Played'),
        `${rq.played.length}/${rq.total}`,
        rq.playedRate === null ? undefined : t('{pct}% of requests', { pct: Math.round(rq.playedRate * 100) }),
        C.jadeSoft,
      ],
      [
        t('+1 given'),
        rq.totalDowns ? `${rq.totalVotes} / -${rq.totalDowns}` : String(rq.totalVotes),
        rq.totalDowns ? t(rq.totalDowns === 1 ? '{n} dislike' : '{n} dislikes', { n: rq.totalDowns }) : rq.mostWanted && rq.mostWanted.votes ? t('most for {title}', { title: rq.mostWanted.title }) : undefined,
        C.goldSoft,
      ],
      [t('Likes per song'), avg(rq.requestedAvgUp), rq.requestedAvgUp === null ? t('none played yet') : t('requested songs'), C.goldSoft],
    ];
    const tw4 = (CW - 3 * 3) / 4;
    tiles.forEach(([label, value, note, bg], i) => {
      const x = M + i * (tw4 + 3);
      fill(bg);
      doc.roundedRect(x, y, tw4, 19, 2, 2, 'F');
      font('bold', 6.8);
      color(C.muted);
      doc.text(clean(label.toUpperCase()), x + 3, y + 5.2, { charSpace: 0.25 });
      font('bold', 14);
      color(i === 1 ? C.jade : C.ink);
      doc.text(clean(value), x + 3, y + 12.4);
      if (note) {
        font('normal', 6.8);
        color(C.muted);
        doc.text(clean(note), x + 3, y + 16.6, { maxWidth: tw4 - 5 });
      }
    });
    y += 19 + 6;

    // -- the top requested song (most likes) and what happened to it
    const top = rq.topRequest;
    if (top) {
      ensure(28);
      const h = top.played ? 24 : 20;
      fill(C.goldSoft);
      doc.roundedRect(M, y, CW, h, 2, 2, 'F');
      fill(C.gold);
      doc.rect(M, y, 1.4, h, 'F');
      font('bold', 7);
      color(C.gold);
      doc.text(clean(t('Top requested song').toUpperCase()), M + 5, y + 5.5, { charSpace: 0.3 });
      font('bold', 14);
      color(C.ink);
      doc.text(clean(top.title), M + 5, y + 12.2, { maxWidth: CW - 70 });
      font('normal', 8);
      color(C.muted);
      doc.text(
        clean([t('by {name}', { name: top.author }), top.instrument, top.note ? `"${top.note}"` : null].filter(Boolean).join(' · ')),
        M + 5,
        y + 17,
        { maxWidth: CW - 70 }
      );
      // likes / dislikes on the right
      font('bold', 16);
      color(C.jade);
      doc.text(`+${top.votes}`, M + CW - (top.downs ? 26 : 5), y + 12.2, { align: 'right' });
      if (top.downs) {
        color(C.crimson);
        doc.text(`-${top.downs}`, M + CW - 5, y + 12.2, { align: 'right' });
      }
      font('normal', 7.5);
      color(C.muted);
      doc.text(clean(top.downs ? `${t(top.votes === 1 ? 'like' : 'likes')} / ${t(top.downs === 1 ? 'dislike' : 'dislikes')}` : t(top.votes === 1 ? 'like' : 'likes')), M + CW - 5, y + 17, { align: 'right' });
      if (top.played) {
        font('bold', 8);
        color(C.jade);
        doc.text(
          clean(`${t('Played in {part} at {time}', { part: top.partName ?? '', time: formatClock(top.playedAt) })}  ·  ${t('On stage')} +${top.up} / -${top.down}`),
          M + 5,
          y + 21.6
        );
      } else {
        font('bold', 8);
        color(C.muted);
        doc.text(
          clean(top.status === 'dismissed' ? t('Not taken') : top.status === 'added' ? t('Added but not played') : t('Still open')),
          M + CW - 5,
          y + 5.5,
          { align: 'right' }
        );
      }
      y += h + 7;
    } else {
      y += 2;
    }

    // -- what happened to the requests: one stacked bar
    const groups = [
      { label: t('Played'), n: rq.played.length, bar: C.jade, text: [255, 255, 255] },
      { label: t('Added but not played'), n: rq.notPlayed.filter((o) => o.status === 'added').length, bar: C.goldLight, text: C.night },
      { label: t('Still open'), n: rq.notPlayed.filter((o) => o.status === 'open').length, bar: C.stone, text: C.night },
      { label: t('Not taken'), n: rq.notPlayed.filter((o) => o.status === 'dismissed').length, bar: C.stoneSoft, text: C.muted },
    ].filter((g) => g.n > 0);
    ensure(24);
    font('bold', 9.5);
    color(C.ink);
    doc.text(clean(t('What happened to the requests')), M, y);
    y += 3.5;
    let bx = M;
    groups.forEach((g, i) => {
      const w = (g.n / rq.total) * CW;
      fill(g.bar);
      if (groups.length === 1) doc.roundedRect(bx, y, w, 8, 2, 2, 'F');
      else {
        doc.rect(bx + (i === 0 ? 2 : 0), y, w - (i === 0 ? 2 : 0) - (i === groups.length - 1 ? 2 : 0), 8, 'F');
        if (i === 0) doc.roundedRect(bx, y, Math.min(w, 6), 8, 2, 2, 'F');
        if (i === groups.length - 1) doc.roundedRect(bx + w - Math.min(w, 6), y, Math.min(w, 6), 8, 2, 2, 'F');
      }
      if (w > 9) {
        font('bold', 9);
        color(g.text);
        doc.text(String(g.n), bx + w / 2, y + 5.6, { align: 'center' });
      }
      bx += w;
    });
    y += 13;
    // legend
    let lx = M;
    font('normal', 8);
    groups.forEach((g) => {
      fill(g.bar);
      doc.roundedRect(lx, y - 2.7, 3.2, 3.2, 0.8, 0.8, 'F');
      color(C.ink);
      const label = clean(`${g.label} ${g.n}`);
      doc.text(label, lx + 4.6, y);
      lx += 4.6 + doc.getTextWidth(label) + 7;
    });
    y += 8;

    // -- do requested songs get more likes?
    if (rq.requestedAvgUp !== null && rq.otherAvgUp !== null) {
      ensure(26);
      font('bold', 9.5);
      color(C.ink);
      doc.text(clean(t('Likes per song: requested vs the rest')), M, y);
      y += 5;
      const max = Math.max(rq.requestedAvgUp, rq.otherAvgUp, 0.1);
      const labelW = 40;
      const barMax = CW - labelW - 16;
      const bars: Array<[string, number, readonly number[]]> = [
        [t('Requested songs'), rq.requestedAvgUp, C.jade],
        [t('Rest of the setlist'), rq.otherAvgUp, C.stone],
      ];
      for (const [label, v, c] of bars) {
        font('normal', 8.5);
        color(C.ink);
        doc.text(clean(label), M, y + 3.3);
        fill(C.stoneSoft);
        doc.roundedRect(M + labelW, y, barMax, 4.6, 1.2, 1.2, 'F');
        fill(c);
        if (v > 0) doc.roundedRect(M + labelW, y, Math.max(2.4, (v / max) * barMax), 4.6, 1.2, 1.2, 'F');
        font('bold', 9.5);
        color(C.ink);
        doc.text(avg(v), M + CW, y + 3.5, { align: 'right' });
        y += 7;
      }
      const diff = rq.requestedAvgUp - rq.otherAvgUp;
      font('italic', 8.5);
      color(diff > 0.05 ? C.jade : diff < -0.05 ? C.crimson : C.muted);
      doc.text(
        clean(
          diff > 0.05
            ? t('Requested songs were liked more than the rest')
            : diff < -0.05
              ? t('Requested songs were liked less than the rest')
              : t('Requested songs were liked about the same as the rest')
        ),
        M,
        y + 1
      );
      y += 7;
    }
    if (rq.lateRequests > 0) {
      font('normal', 8.5);
      color(C.muted);
      doc.text(clean(t('{n} requested after the Sidang started', { n: rq.lateRequests })), M, y);
      y += 6;
    }

    // -- the requests themselves: one row each, with a +1 bar and a status pill
    const maxVotes = Math.max(1, ...rq.played.map((o) => o.votes), ...rq.notPlayed.map((o) => o.votes));
    const pill = (text: string, right: number, py: number, bg: readonly number[], fg: readonly number[]) => {
      font('bold', 7.2);
      const w = doc.getTextWidth(clean(text)) + 5;
      fill(bg);
      doc.roundedRect(right - w, py - 3.6, w, 5.2, 2.6, 2.6, 'F');
      color(fg);
      doc.text(clean(text), right - w / 2, py + 0.2, { align: 'center' });
    };
    const rows = (title: string, list: RequestOutcome[], played: boolean) => {
      if (!list.length) return;
      ensure(12 + 13.2 * Math.min(list.length, 2)); // keep the heading with at least two rows
      y += 5;
      font('bold', 9.5);
      color(played ? C.jade : C.ink);
      doc.text(clean(title), M, y);
      y += 3;
      for (const o of list) {
        ensure(13);
        const top = y;
        fill(played ? C.jadeSoft : [252, 249, 243]);
        doc.roundedRect(M, top, CW, 11.5, 1.6, 1.6, 'F');
        // status dot
        fill(played ? C.jade : o.status === 'added' ? C.goldLight : C.stone);
        doc.circle(M + 4.5, top + 5.75, 1.6, 'F');
        // title + who
        font('bold', 9.5);
        color(C.ink);
        doc.text(clean(o.title), M + 9, top + 5, { maxWidth: 70 });
        font('normal', 7.6);
        color(C.muted);
        doc.text(clean([t('by {name}', { name: o.author }), o.instrument].filter(Boolean).join(' · ')), M + 9, top + 9.3, { maxWidth: 70 });
        // +1 bar
        const bx0 = M + 84;
        const bw = 34;
        fill(C.stoneSoft);
        doc.roundedRect(bx0, top + 4.2, bw, 3, 1, 1, 'F');
        if (o.votes > 0) {
          fill(C.gold);
          doc.roundedRect(bx0, top + 4.2, Math.max(2, (o.votes / maxVotes) * bw), 3, 1, 1, 'F');
        }
        font('bold', 8.5);
        color(o.votes ? C.gold : C.faint);
        doc.text(`+${o.votes}`, bx0 + bw + 2.5, top + 6.8);
        if (o.downs > 0) {
          const w = doc.getTextWidth(`+${o.votes}`);
          color(C.crimson);
          doc.text(`-${o.downs}`, bx0 + bw + 2.5 + w + 2, top + 6.8);
        }
        // status / when it was played
        if (played) {
          pill(`${o.partName ?? ''} ${formatClock(o.playedAt)}`.trim(), M + CW - 3, top + 4.6, C.jade, [255, 255, 255]);
          font('normal', 7.4);
          color(C.muted);
          doc.text(clean(`${t('Likes')} +${o.up}  /  -${o.down}`), M + CW - 3, top + 9.6, { align: 'right' });
        } else {
          const [bg, fg] =
            o.status === 'added' ? [C.goldSoft, C.gold] : o.status === 'dismissed' ? [C.stoneSoft, C.muted] : [[255, 255, 255], C.ink];
          pill(o.status === 'dismissed' ? t('Not taken') : o.status === 'added' ? t('Added but not played') : t('Still open'), M + CW - 3, top + 6.2, bg, fg);
        }
        y += 13.2;
      }
    };
    rows(t('Requested and played ({n})', { n: rq.played.length }), rq.played, true);
    rows(t('Requested but not played ({n})', { n: rq.notPlayed.length }), rq.notPlayed, false);
    y += 3;
  }

  // ---------------------------------------------------------------- Bahagian details
  if (s.parts.length) {
    section(t('Bahagian details'), 40);
    const cols = [
      { w: 8, label: '#' },
      { w: CW - 8 - 18 - 18 - 14 - 14, label: t('Item') },
      { w: 18, label: t('Start'), right: true },
      { w: 18, label: t('Length'), right: true },
      { w: 14, label: '+', right: true },
      { w: 14, label: '–', right: true },
    ];
    for (const p of s.parts) {
      ensure(24);
      // part header
      fill(C.night);
      doc.roundedRect(M, y - 4.6, CW, 7.5, 1.2, 1.2, 'F');
      font('bold', 10);
      color([244, 238, 228]);
      doc.text(clean(p.partName), M + 3, y);
      font('normal', 8.5);
      color([210, 200, 185]);
      const status = p.ongoing ? t('Live') : p.finished ? t('Finished') : t('Not finished');
      doc.text(
        clean(`${formatClock(p.startedAt)}${p.endedAt ? ` – ${formatClock(p.endedAt)}` : ''}  ·  ${formatDuration(p.seconds)}  ·  ${status}`),
        M + CW - 3,
        y,
        { align: 'right' }
      );
      y += 7;
      font('bold', 7.5);
      color(C.muted);
      let hx = M + 2;
      for (const c of cols) {
        doc.text(clean(c.label.toUpperCase()), c.right ? hx + c.w - 2 : hx, y, { align: c.right ? 'right' : 'left' });
        hx += c.w;
      }
      y += 5;
      p.items.forEach((it, i) => {
        const title = wrap(it.kind === 'break' && !/^stop\b/i.test(it.title.trim()) ? `STOP: ${it.title}` : it.title, cols[1].w - 2, it.kind === 'break' ? 'bold' : 'normal', 9);
        const h = Math.max(5.4, title.length * 4.2 + 1.2);
        ensure(h + 1);
        let x = M + 2;
        font('normal', 8.5);
        color(C.faint);
        doc.text(String(i + 1), x, y);
        x += cols[0].w;
        font(it.kind === 'break' ? 'bold' : 'normal', 9);
        color(it.kind === 'break' ? C.breakBar : C.ink);
        title.forEach((l, k) => doc.text(l, x, y + k * 4.2));
        x += cols[1].w;
        font('normal', 8.5);
        color(C.muted);
        doc.text(formatClock(it.startedAt), x + cols[2].w - 2, y, { align: 'right' });
        x += cols[2].w;
        font('bold', 9);
        color(C.ink);
        doc.text(formatDuration(it.seconds), x + cols[3].w - 2, y, { align: 'right' });
        x += cols[3].w;
        font('normal', 8.5);
        color(it.up ? C.jade : C.faint);
        doc.text(it.kind === 'song' ? String(it.up) : '', x + cols[4].w - 2, y, { align: 'right' });
        x += cols[4].w;
        color(it.down ? C.crimson : C.faint);
        doc.text(it.kind === 'song' ? String(it.down) : '', x + cols[5].w - 2, y, { align: 'right' });
        y += h;
        stroke(C.line);
        doc.setLineWidth(0.15);
        doc.line(M, y - 3.8, M + CW, y - 3.8);
      });
      if (p.intermissionSeconds !== null) {
        ensure(8);
        font('italic', 8.5);
        color(C.gold);
        doc.text(clean(`${t('Intermission')}  ·  ${formatDuration(p.intermissionSeconds)}`), M + 2, y + 0.5);
        y += 6;
      }
      y += 4;
    }
  }

  // ---------------------------------------------------------------- comments
  if (input.comments.length) {
    section(t('Comments'), 26);
    for (const m of input.comments) {
      const body = wrap(m.body, CW - 6, 'normal', 9);
      const h = 6 + body.length * 4.4 + 3;
      ensure(h);
      const who = [m.author, m.instrument, m.role && m.role !== 'player' ? input.roleLabel(m.role) : null].filter(Boolean).join(' · ');
      const when = new Date(m.created_at).toLocaleString(input.lang === 'ms' ? 'ms-MY' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      fill(C.gold);
      doc.rect(M, y - 3.5, 0.9, h - 2, 'F');
      font('bold', 9);
      color(C.ink);
      doc.text(clean(who), M + 4, y);
      font('normal', 8);
      color(C.faint);
      doc.text(clean(when), M + CW, y, { align: 'right' });
      font('normal', 9);
      color(C.ink);
      body.forEach((l, i) => doc.text(l, M + 4, y + 5 + i * 4.4));
      y += h;
    }
  }

  // ---------------------------------------------------------------- footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    stroke(C.line);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, M + CW, PAGE_H - 12);
    font('normal', 7.5);
    color(C.muted);
    doc.text('Anjung Live · Gamelan Anjung Seni · Pusat Kebudayaan', M, PAGE_H - 7.5);
    doc.text(clean(t('Page {n} of {total}', { n: i, total: pages })), M + CW, PAGE_H - 7.5, { align: 'right' });
  }
  return doc;
}

/** "Anjung-Live-Sidang-25-Summary-2026-11-09.pdf" */
export function summaryFileName(sessionName: string, date: string | null) {
  const base = clean(sessionName).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Sidang';
  return `Anjung-Live-${base}-Summary${date ? `-${date}` : ''}.pdf`;
}
