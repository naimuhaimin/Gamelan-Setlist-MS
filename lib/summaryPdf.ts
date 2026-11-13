import type { jsPDF as JsPDF } from 'jspdf';
import type { ChatMessage } from '@/types';
import type { Summary } from '@/lib/summary';
import { formatClock, formatDuration } from '@/lib/summary';
import type { AppUsage, AttendanceInsights } from '@/lib/attendanceInsights';

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
  const wrap = (text: string, width: number) => doc.splitTextToSize(clean(text), width) as string[];

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
    for (const line of wrap(highlights.join('   ·   '), CW)) {
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
      const lines = wrap(body, CW - 8);
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
      const names = wrap(r.people.map((p) => p.name).join(', ') || '–', cols[4].w - 2);
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
        const title = wrap(it.kind === 'break' && !/^stop\b/i.test(it.title.trim()) ? `STOP: ${it.title}` : it.title, cols[1].w - 2);
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
      const body = wrap(m.body, CW - 6);
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
