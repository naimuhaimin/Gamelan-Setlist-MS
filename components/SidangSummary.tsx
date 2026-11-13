'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Coffee, Copy, FileDown, Loader2, MessageSquareText, Music2, Send, ThumbsDown, ThumbsUp, Timer, Trash2, Trophy } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { plural, useT } from '@/lib/i18n';
import { computeInsights, computeUsage } from '@/lib/attendanceInsights';
import { formatDate } from './Cards';
import logoMark from '@/assets/logo-mark.png';
import { useChat } from '@/lib/useChat';
import * as api from '@/lib/supabaseService';
import { buildSummary, formatClock, formatDuration, type Summary } from '@/lib/summary';
import type { PlayLogRow } from '@/types';
import { ROLE_LABEL } from './SettingsView';
import { PartLengthChart } from './PartLengthChart';
import { SummaryPeople } from './SummaryPeople';
import { Badge, BreakIcon, Button, Card, EmptyState, Input, LiveDot, cx } from './ui';

/** After-event summary of one Sidang: what was played, when, for how long, the ratings, and people's comments. */
export function SidangSummary({ sessionId }: { sessionId: string }) {
  const { sessions, events, instruments, roomState, queueItems, tally, playLogEnabled, isFinished, notify } = useStage();
  const { t, lang } = useT();
  const session = sessions.find((s) => s.id === sessionId);
  const [rows, setRows] = useState<PlayLogRow[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [making, setMaking] = useState(false);

  // Reload whenever the stage moves (a moment later, so the controller's log row has landed)
  useEffect(() => {
    if (!playLogEnabled) return;
    let alive = true;
    const timer = setTimeout(() => {
      api
        .fetchPlayLog(sessionId)
        .then((r) => alive && setRows(r ?? []))
        .catch(() => alive && setRows([]));
    }, rows === null ? 0 : 900);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, playLogEnabled, roomState.current_queue_item_id, roomState.part_id, roomState.is_finished]);

  const livePartId = roomState.session_id === sessionId && !isFinished ? roomState.part_id : null;
  const existing = useMemo(() => new Set(queueItems.map((q) => q.id)), [queueItems]);
  const summary = useMemo(
    () =>
      buildSummary(rows ?? [], {
        now,
        livePartId,
        liveVotes: (id) => (existing.has(id) ? tally(id) : null),
      }),
    [rows, now, livePartId, existing, tally]
  );

  // Tick while something is on stage, so running times count up
  const anyOngoing = summary.parts.some((p) => p.ongoing);
  useEffect(() => {
    if (!anyOngoing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyOngoing]);

  const copy = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(summaryText(session.name, summary, t));
      setCopied(true);
      notify(t('Summary copied'));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify(t('Copy blocked. Select the text and copy it.'), 'error');
    }
  };

  /** Gather everything fresh, then draw and save the PDF report (jsPDF loads only now). */
  const downloadPdf = async () => {
    if (!session || making) return;
    setMaking(true);
    try {
      const event = events.find((e) => e.id === session.event_id) ?? null;
      const siblings = session.event_id ? sessions.filter((s) => s.event_id === session.event_id).map((s) => s.id) : [];
      const [viewers, att, counts, comments] = await Promise.all([
        api.fetchViewers(session.id).catch(() => null),
        api.fetchAttendance(session.id, session.event_id).catch(() => null),
        siblings.length > 1 ? api.fetchAttendanceCounts(siblings).catch(() => null) : Promise.resolve(null),
        api.fetchChat(session.id, 'sidang_comments').catch(() => null),
      ]);
      const insights = att
        ? computeInsights({
            entries: att.entries,
            needs: att.needs,
            viewers,
            instruments,
            startedAt: summary.startedAt,
            eventCounts: counts,
            siblings,
            sessionId: session.id,
          })
        : null;
      const { buildSummaryPdf, summaryFileName } = await import('@/lib/summaryPdf');
      const doc = await buildSummaryPdf({
        t,
        lang,
        sessionName: session.name,
        eventName: event?.name ?? null,
        venue: event?.venue ?? null,
        dateText: formatDate(session.date) || '',
        summary,
        usage: viewers && viewers.length ? computeUsage(viewers) : null,
        insights,
        registeredCount: att?.entries.length ?? 0,
        comments: comments ?? [],
        roleLabel: (r) => t(ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r),
        logoUrl: typeof logoMark === 'string' ? logoMark : logoMark.src,
      });
      doc.save(summaryFileName(session.name, session.date));
      notify(t('PDF report downloaded'));
    } catch (err) {
      console.error(err);
      notify(t('Couldn’t make the PDF. Try again.'), 'error');
    } finally {
      setMaking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10 space-y-5">
      <SummaryPeople sessionId={sessionId} startedAt={summary.startedAt} only="usage" />

      {!playLogEnabled ? (
        <Card>
          <EmptyState title={t('The summary isn’t switched on yet')}>
            {t('Run the latest supabase-schema.sql (section 10) in Supabase to start recording what is played.')}
          </EmptyState>
        </Card>
      ) : rows === null ? (
        <p className="text-sm text-muted text-center py-8">{t('Loading…')}</p>
      ) : !summary.parts.length ? (
        <Card>
          <EmptyState icon={<Timer className="w-10 h-10" />} title={t('Nothing performed yet')}>
            {t('This fills in by itself as the Sidang is performed: songs, times and ratings.')}
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<Music2 className="w-4 h-4" />} label={t('Songs played')} value={String(summary.songsPlayed)} />
            <Stat icon={<Timer className="w-4 h-4" />} label={t('Playing time')} value={formatDuration(summary.playSeconds)} />
            <Stat
              icon={<Clock className="w-4 h-4" />}
              label={t('Time')}
              value={`${formatClock(summary.startedAt)}–${summary.endedAt ? formatClock(summary.endedAt) : '…'}`}
            />
            <Stat
              icon={<ThumbsUp className="w-4 h-4" />}
              label={t('Ratings')}
              value={
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-jade-light">
                    <ThumbsUp className="w-4 h-4" /> {summary.up}
                  </span>
                  <span className="inline-flex items-center gap-1 text-songket-light">
                    <ThumbsDown className="w-4 h-4" /> {summary.down}
                  </span>
                </span>
              }
            />
          </div>

          {(summary.mostLiked || summary.longest) && (
            <Card className="p-4 grid gap-3 sm:grid-cols-2">
              {summary.mostLiked && (
                <Highlight icon={<Trophy className="w-5 h-5" />} label={t('Most liked')} title={summary.mostLiked.title}>
                  <ThumbsUp className="w-3.5 h-3.5" /> {summary.mostLiked.up}
                  {summary.mostLiked.down > 0 && (
                    <>
                      {' · '}
                      <ThumbsDown className="w-3.5 h-3.5" /> {summary.mostLiked.down}
                    </>
                  )}
                </Highlight>
              )}
              {summary.longest && (
                <Highlight icon={<Timer className="w-5 h-5" />} label={t('Longest song')} title={summary.longest.title}>
                  {formatDuration(summary.longest.seconds)}
                </Highlight>
              )}
            </Card>
          )}

          <PartLengthChart parts={summary.parts} />

          <SummaryPeople sessionId={sessionId} startedAt={summary.startedAt} only="attendance" />

    
          {/* Bahagian by Bahagian */}
          {summary.parts.map((p) => (
            <React.Fragment key={p.partId}>
              <Card className={cx('overflow-hidden', p.ongoing && 'border-songket/50')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-3 border-b border-line">
                  <h2 className="font-display text-xl font-bold flex-1 whitespace-nowrap">{p.partName}</h2>
                  {p.ongoing ? (
                    <Badge tone="live">
                      <LiveDot /> {t('Live')}
                    </Badge>
                  ) : p.finished ? (
                    <Badge tone="ok">{t('Finished')}</Badge>
                  ) : (
                    <Badge tone="neutral">{t('Not finished')}</Badge>
                  )}
                  <span className="text-sm text-muted tabular basis-full sm:basis-auto">
                    {formatClock(p.startedAt)}
                    {p.endedAt ? ` – ${formatClock(p.endedAt)}` : ''} · <b className="text-ink">{formatDuration(p.seconds)}</b>
                  </span>
                </div>
                <ol className="divide-y divide-line">
                  {p.items.map((it, i) => (
                    <li key={it.key} className={cx('flex items-center gap-3 px-4 sm:px-5 py-2.5', it.ongoing && 'bg-songket-soft')}>
                      <span className="w-6 text-sm text-faint tabular shrink-0">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('flex items-center gap-2 font-medium min-w-0', it.kind === 'break' && 'text-stop-light')}>
                          {it.kind === 'break' && <BreakIcon className="w-4 h-4 shrink-0" />}
                          <span className="truncate">{it.title}</span>
                        </span>
                        <span className="block text-xs text-muted tabular">{formatClock(it.startedAt)}</span>
                      </span>
                      {it.kind === 'song' && (it.up > 0 || it.down > 0) && (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold tabular shrink-0">
                          <span className="inline-flex items-center gap-1 text-jade-light">
                            <ThumbsUp className="w-3.5 h-3.5" /> {it.up}
                          </span>
                          <span className="inline-flex items-center gap-1 text-songket-light">
                            <ThumbsDown className="w-3.5 h-3.5" /> {it.down}
                          </span>
                        </span>
                      )}
                      <span className={cx('w-14 text-right text-sm font-semibold tabular shrink-0', it.ongoing ? 'text-songket-light' : 'text-ink')}>
                        {formatDuration(it.seconds)}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
              {p.intermissionSeconds !== null && (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-2.5 text-sm">
                  <Coffee className="w-4 h-4 text-brass shrink-0" />
                  <span className="flex-1 text-muted">{t('Intermission')}</span>
                  <b className="tabular">{formatDuration(p.intermissionSeconds)}</b>
                </div>
              )}
            </React.Fragment>
          ))}

          <div className="flex justify-center">
            <Button onClick={copy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {t('Copy summary as text')}
            </Button>
          </div>
        </>
      )}

      {!(playLogEnabled && rows !== null && summary.parts.length > 0) && (
        <SummaryPeople sessionId={sessionId} startedAt={summary.startedAt} only="attendance" />
      )}

      <SidangComments sessionId={sessionId} />

      {session && (
        <Card className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <FileDown className="w-8 h-8 text-brass shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{t('Summary report (PDF)')}</p>
            <p className="text-sm text-muted">{t('Everything on this page in one printable A4 file, to share or keep.')}</p>
          </div>
          <Button variant="primary" onClick={downloadPdf} disabled={making}>
            {making ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}{' '}
            {making ? t('Making PDF…') : t('Download PDF report')}
          </Button>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-3.5 min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
        <span className="text-brass">{icon}</span> {label}
      </div>
      <div className="mt-1 font-display text-xl min-[400px]:text-2xl font-bold tabular whitespace-nowrap">{value}</div>
    </Card>
  );
}

function Highlight({ icon, label, title, children }: { icon: React.ReactNode; label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 rounded-xl bg-brass-soft text-brass grid place-items-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className="font-semibold truncate">{title}</div>
        <div className="text-xs text-muted tabular inline-flex items-center gap-1">{children}</div>
      </div>
    </div>
  );
}

/** Plain-text version for WhatsApp. */
function summaryText(name: string, s: Summary, t: ReturnType<typeof useT>['t']): string {
  const lines: string[] = [
    `${t('Summary')}: ${name}`,
    `${plural(s.songsPlayed, '{n} song', '{n} songs')} · ${t('Playing time')} ${formatDuration(s.playSeconds)} · ${formatClock(s.startedAt)}–${s.endedAt ? formatClock(s.endedAt) : '…'}`,
  ];
  if (s.mostLiked) lines.push(`${t('Most liked')}: ${s.mostLiked.title} (+${s.mostLiked.up})`);
  for (const p of s.parts) {
    lines.push('', `${p.partName.toUpperCase()} (${formatClock(p.startedAt)}, ${formatDuration(p.seconds)})`);
    for (const it of p.items) {
      const votes = it.kind === 'song' && (it.up || it.down) ? `  +${it.up}/-${it.down}` : '';
      lines.push(`${it.kind === 'break' ? `-STOP (${it.title})-` : it.title}  ${formatDuration(it.seconds)}${votes}`);
    }
    if (p.intermissionSeconds !== null) lines.push(`(${t('Intermission')} ${formatDuration(p.intermissionSeconds)})`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------

const when = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Comments people leave to sum up the Sidang. Kept with the Sidang (unlike the live chat, it is meant to be read later). */
function SidangComments({ sessionId }: { sessionId: string }) {
  const { role, selectedInstrument, isManager, notify } = useStage();
  const { t, lang } = useT();
  const c = useChat(sessionId, 'sidang_comments');
  const [draft, setDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [sending, setSending] = useState(false);

  if (c.available === false) return null; // table not created yet

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = c.name || nameDraft.trim();
    if (!draft.trim() || !name || sending) return;
    if (!c.name) c.setName(name);
    setSending(true);
    const text = draft;
    try {
      await c.send(text, { instrument: selectedInstrument, role, author: name });
      setDraft('');
    } catch (err) {
      notify(t('Comment not posted: {error}', { error: (err as Error).message }), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-line">
        <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-brass" /> {t('Comments')}
          {c.messages.length > 0 && <span className="text-sm font-sans font-normal text-muted tabular">{c.messages.length}</span>}
        </h2>
        <p className="text-sm text-muted">{t('How did this Sidang go? Leave a short summary for the team.')}</p>
      </div>

      {c.messages.length > 0 && (
        <ul className="divide-y divide-line">
          {c.messages.map((m) => {
            const mine = m.device_id === c.myDeviceId;
            const roleLabel = (ROLE_LABEL as Record<string, string>)[m.role];
            return (
              <li key={m.id} className="px-4 sm:px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-semibold">{m.author}</span>
                  {m.instrument && <span className="text-muted">· {m.instrument}</span>}
                  {roleLabel && m.role !== 'player' && (
                    <span className="px-1.5 rounded bg-songket-soft text-songket-light text-xs font-semibold">{t(roleLabel)}</span>
                  )}
                  <span className="text-xs text-faint tabular ml-auto">{when(m.created_at, lang)}</span>
                  {(mine || isManager) && (
                    <button
                      onClick={() => c.remove(m.id).catch((err) => notify(t('Not deleted: {error}', { error: (err as Error).message }), 'error'))}
                      aria-label={t('Delete comment')}
                      className="w-7 h-7 grid place-items-center rounded-full text-faint hover:text-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="p-4 sm:p-5 space-y-2 border-t border-line">
        {!c.name && (
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder={t('Your name, e.g. Aiman')} maxLength={40} aria-label={t('Your name')} />
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t('e.g. Tempo was good in Bahagian 2. Watch the ending of 46 Medley next time.')}
          aria-label={t('Your comment')}
          className="w-full rounded-xl bg-bg border border-line px-3.5 py-2.5 text-base placeholder:text-faint focus:outline-none focus:border-brass/70"
        />
        <div className="flex items-center gap-3">
          <span className="flex-1 text-xs text-faint">
            {c.name ? (
              <>
                {t('Posting as')} <b className="text-muted">{c.name}</b>
                {selectedInstrument ? ` · ${selectedInstrument}` : ''}
              </>
            ) : (
              t('Everyone with the app can read comments.')
            )}
          </span>
          <Button type="submit" variant="primary" disabled={sending || !draft.trim() || !(c.name || nameDraft.trim())}>
            <Send className="w-4 h-4" /> {sending ? t('Posting…') : t('Post')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
