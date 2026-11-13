'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  HandHeart,
  ListMusic,
  Megaphone,
  MessageSquareText,
  Music2,
  Repeat,
  Timer,
  ThumbsUp,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/useAttendance';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import * as api from '@/lib/supabaseService';
import { buildSummary, formatDuration, type Summary } from '@/lib/summary';
import type { Announcement, Session, SongRequest } from '@/types';
import { useShell } from './AppShell';
import { formatDate, todayKey } from './Cards';
import { SidangModal } from './SidangModal';
import { CopySetlistModal, PasteSetlistModal } from './SetlistText';
import { Badge, Button, Card, Field, IconButton, Input, Modal, cx } from './ui';

const sidangHref = (id: string, view?: string, extra = '') => `/sidang/${encodeURIComponent(id)}${view ? `?view=${view}${extra}` : ''}`;

const byDate = (a: Session, b: Session) => a.date.localeCompare(b.date) || a.sidang_number - b.sidang_number;

/** The next Sidang from today on, and the Sidang already performed (latest first). */
export function useHomeSidang() {
  const { sessions } = useStage();
  const today = todayKey();
  return useMemo(() => {
    const ahead = sessions.filter((s) => s.date >= today).sort(byDate);
    const behind = sessions.filter((s) => s.date <= today).sort((a, b) => byDate(b, a));
    return { next: ahead[0] ?? null, upcoming: ahead, recent: behind };
  }, [sessions, today]);
}

function SectionTitle({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-brass">{icon}</span>
      <h2 className="font-display text-xl font-bold flex-1 min-w-0">{children}</h2>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Next Sidang: countdown, your part, registration, players still needed
// ------------------------------------------------------------------------------------------------

export function NextSidangCard({ session }: { session: Session }) {
  const { events, parts, resolveQueue, selectedInstrument, isCued, instruments } = useStage();
  const { openInstrumentPicker } = useShell();
  const { t } = useT();
  const att = useAttendance(session.id, session.event_id);
  const event = events.find((e) => e.id === session.event_id);

  const songs = useMemo(
    () =>
      parts
        .filter((p) => p.session_id === session.id)
        .sort((a, b) => a.part_number - b.part_number)
        .flatMap((p) => resolveQueue(p.id))
        .filter((r) => !r.isBreak),
    [parts, resolveQueue, session.id]
  );
  const cued = selectedInstrument ? songs.filter((r) => isCued(r.introInstruments)) : [];

  const days = Math.round((Date.parse(session.date + 'T00:00') - Date.parse(todayKey() + 'T00:00')) / 86_400_000);
  const when = days <= 0 ? t('Today') : days === 1 ? t('Tomorrow') : t('In {n} days', { n: days });

  const lacking = useMemo(() => {
    const names = [...instruments];
    for (const k of Object.keys(att.needs)) if (!names.includes(k)) names.push(k);
    return names
      .map((name) => ({ name, short: (att.needs[name] ?? 0) - att.entries.filter((e) => e.instrument === name).length }))
      .filter((r) => r.short > 0);
  }, [instruments, att.needs, att.entries]);
  const minimumsSet = Object.values(att.needs).some((n) => n > 0);

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6 border-t-[3px] border-t-brass">
        <div className="flex items-center gap-2 text-sm font-semibold text-brass">
          <CalendarDays className="w-4 h-4" /> {t('NEXT SIDANG')}
          {event && <span className="text-muted font-normal truncate">· {event.name}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <h2 className="font-display text-3xl font-bold leading-tight">{session.name}</h2>
          <Badge tone={days <= 0 ? 'live' : 'brass'}>{when}</Badge>
        </div>
        <p className="text-sm text-muted mt-1">
          {formatDate(session.date)} · {t('{n} songs', { n: songs.length })}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={sidangHref(session.id, 'list')}>
            <Button variant="primary">
              <ListMusic className="w-4 h-4" /> {t('View setlist')}
            </Button>
          </Link>
          {att.available &&
            (att.mine ? (
              <Link href={sidangHref(session.id, 'attendance')}>
                <Button>
                  <Check className="w-4 h-4 text-jade-light" /> {t('Registered as {name}', { name: att.mine.name })}
                </Button>
              </Link>
            ) : (
              <Link href={sidangHref(session.id, 'attendance', '&register=1')}>
                <Button>
                  <UserPlus className="w-4 h-4" /> {t('Register attendance')}
                </Button>
              </Link>
            ))}
        </div>
      </div>

      {/* Your part */}
      <div className="px-5 sm:px-6 py-4 border-t border-line">
        <div className="text-xs font-semibold tracking-wide text-muted uppercase">{t('Your part')}</div>
        {selectedInstrument ? (
          songs.length ? (
            <>
              <p className="mt-1">
                {cued.length
                  ? t('{instrument} starts {n} of {total} songs', { instrument: selectedInstrument, n: cued.length, total: songs.length })
                  : t('No intro cues for {instrument} in this Sidang', { instrument: selectedInstrument })}
              </p>
              {cued.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cued.slice(0, 6).map((r) => (
                    <span key={r.queueItem.id} className="text-xs px-2 py-1 rounded-lg bg-brass-soft text-brass font-medium">
                      {r.song.title}
                    </span>
                  ))}
                  {cued.length > 6 && <span className="text-xs px-2 py-1 text-muted">{t('+{n} more', { n: cued.length - 6 })}</span>}
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-muted">{t('The setlist isn’t ready yet.')}</p>
          )
        ) : (
          <button onClick={openInstrumentPicker} className="mt-1 text-brass hover:underline text-left">
            {t('Choose your instrument to see your cues')}
          </button>
        )}
      </div>

      {/* Players still needed */}
      {att.available && minimumsSet && (
        <div className={cx('px-5 sm:px-6 py-3 border-t', lacking.length ? 'border-stop/40 bg-stop/[0.08]' : 'border-line')}>
          {lacking.length ? (
            <p className="text-sm">
              <b className="text-stop-light">{t('Still needed')}:</b>{' '}
              {lacking.map((r) => `${r.name} ${r.short}`).join(' · ')}
              <Link href={sidangHref(session.id, 'attendance')} className="ml-2 text-brass hover:underline whitespace-nowrap">
                {t('See attendance')}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted">
              <Check className="w-4 h-4 inline text-jade-light" /> {t('Every instrument has its minimum players')} ·{' '}
              {t('{n} registered', { n: att.entries.length })}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// Shortcuts for Maestro/Admin
// ------------------------------------------------------------------------------------------------

export function ManagerShortcuts({ next, onAnnounce }: { next: Session | null; onAnnounce: () => void }) {
  const { events } = useStage();
  const { t } = useT();
  const [modal, setModal] = useState<'sidang' | 'paste' | 'copy' | null>(null);
  const eventId = next?.event_id ?? events[0]?.id ?? null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        <Button size="sm" onClick={() => setModal('sidang')}>
          <CalendarPlus className="w-4 h-4" /> {t('New Sidang')}
        </Button>
        <Button size="sm" onClick={() => setModal('paste')} disabled={!next} title={next ? next.name : undefined}>
          <ClipboardPaste className="w-4 h-4" /> {t('Paste setlist')}
        </Button>
        <Button size="sm" onClick={() => setModal('copy')} disabled={!next} title={next ? next.name : undefined}>
          <ClipboardCopy className="w-4 h-4" /> {t('Copy setlist')}
        </Button>
        <Button size="sm" onClick={onAnnounce}>
          <Megaphone className="w-4 h-4" /> {t('New announcement')}
        </Button>
      </div>
      <SidangModal mode="create" open={modal === 'sidang'} eventId={eventId} onClose={() => setModal(null)} />
      {next && <PasteSetlistModal open={modal === 'paste'} onClose={() => setModal(null)} sessionId={next.id} />}
      {next && <CopySetlistModal open={modal === 'copy'} onClose={() => setModal(null)} sessionId={next.id} />}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// Announcements
// ------------------------------------------------------------------------------------------------

export function Announcements({ composing, setComposing }: { composing: boolean; setComposing: (v: boolean) => void }) {
  const { isManager, role, notify } = useStage();
  const { t } = useT();
  const [list, setList] = useState<Announcement[] | null | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const load = () => api.fetchAnnouncements().then(setList).catch(() => setList(null));
    load();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`announcements_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => load())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const today = todayKey();
  const visible = (list ?? []).filter((a) => !a.show_until || a.show_until >= today);

  const remove = async (id: string) => {
    setList((prev) => prev?.filter((a) => a.id !== id));
    try {
      await api.deleteAnnouncement(id);
    } catch {
      notify(t('Couldn’t remove it. Try again.'), 'error');
      api.fetchAnnouncements().then(setList).catch(() => undefined);
    }
  };

  return (
    <>
      {visible.length > 0 && (
        <Card className="border-brass/40 overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-line bg-brass-soft/40">
            <Megaphone className="w-4 h-4 text-brass" />
            <h2 className="font-semibold flex-1">{t('Announcements')}</h2>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="whitespace-pre-wrap break-words">{a.body}</p>
                  <p className="text-xs text-faint mt-1">
                    {[a.author, new Date(a.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    {a.show_until && ` · ${t('until {date}', { date: formatDate(a.show_until) })}`}
                  </p>
                </div>
                {isManager && (
                  <IconButton label={t('Remove announcement')} onClick={() => remove(a.id)}>
                    <X className="w-4 h-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {isManager && list === null && (
        <p className="text-xs text-muted">{t('Announcements need the latest supabase-schema.sql (section 16) to be run in Supabase.')}</p>
      )}
      <AnnouncementComposer
        open={composing}
        onClose={() => setComposing(false)}
        roleLabel={role === 'admin' ? 'Admin' : 'Maestro'}
        onPosted={(a) => setList((prev) => [a, ...(prev ?? [])])}
        ready={list !== null}
      />
    </>
  );
}

function AnnouncementComposer({
  open,
  onClose,
  roleLabel,
  onPosted,
  ready,
}: {
  open: boolean;
  onClose: () => void;
  roleLabel: string;
  onPosted: (a: Announcement) => void;
  ready: boolean;
}) {
  const { role, notify } = useStage();
  const { t } = useT();
  const [body, setBody] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBody('');
      setUntil('');
    }
  }, [open]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim().slice(0, 500);
    if (!text) return;
    const a: Announcement = {
      id: api.newId('ann'),
      body: text,
      author: t(roleLabel),
      role,
      show_until: until || null,
      created_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const { created_at: _c, ...row } = a;
      await api.insertAnnouncement(row);
      onPosted(a);
      notify(t('Announcement posted'));
      onClose();
    } catch {
      notify(t('Couldn’t post it. Try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('New announcement')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="announce-form" disabled={saving || !body.trim() || !ready}>
            {saving ? t('Posting…') : t('Post')}
          </Button>
        </>
      }
    >
      <form id="announce-form" onSubmit={post} className="space-y-4">
        {!ready && <p className="text-sm text-stop-light">{t('Announcements need the latest supabase-schema.sql (section 16) to be run in Supabase.')}</p>}
        <Field label={t('Message')} htmlFor="announce-body" hint={t('Everyone sees this at the top of Home.')}>
          <textarea
            id="announce-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder={t('e.g. Practice on Thursday, 8pm at Dewan Seni. Wear black baju Melayu for Sidang 33.')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-ink placeholder:text-faint focus:outline-none focus:border-brass/70 focus:ring-2 focus:ring-brass/20"
          />
        </Field>
        <Field label={t('Show until')} htmlFor="announce-until" hint={t('Hides by itself after this day. Leave empty to keep it until you remove it.')}>
          <Input id="announce-until" type="date" value={until} min={todayKey()} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------------
// Last Sidang recap
// ------------------------------------------------------------------------------------------------

export function LastSidangRecap({ recent }: { recent: Session[] }) {
  const { t } = useT();
  const [found, setFound] = useState<{ session: Session; summary: Summary; comments: number | null } | null | undefined>(undefined);
  const ids = recent.slice(0, 5).map((s) => s.id).join(',');

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const s of recent.slice(0, 5)) {
        const rows = await api.fetchPlayLog(s.id).catch(() => null);
        if (rows === null) break; // no performance log yet
        if (!rows.length) continue;
        const summary = buildSummary(rows, { now: Date.now(), livePartId: null, liveVotes: () => null });
        if (!summary.songsPlayed) continue;
        const comments = await api.countComments(s.id).catch(() => null);
        if (alive) setFound({ session: s, summary, comments });
        return;
      }
      if (alive) setFound(null);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (!found) return null;
  const { session, summary: s, comments } = found;
  return (
    <Card className="p-5 flex flex-col">
      <SectionTitle icon={<BarChart3 className="w-5 h-5" />}>{t('Last Sidang')}</SectionTitle>
      <div className="font-display text-lg font-bold">{session.name}</div>
      <p className="text-sm text-muted">{formatDate(session.date)}</p>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat icon={<Music2 className="w-4 h-4" />} value={String(s.songsPlayed)} label={t('Songs played')} />
        <Stat icon={<Timer className="w-4 h-4" />} value={formatDuration(s.playSeconds)} label={t('Playing time')} />
        <Stat icon={<MessageSquareText className="w-4 h-4" />} value={comments === null ? '–' : String(comments)} label={t('Comments')} />
      </div>
      {s.mostLiked && (
        <p className="text-sm mt-3">
          <Trophy className="w-4 h-4 inline text-brass mr-1" />
          {t('Most liked: {title} (+{n})', { title: s.mostLiked.title, n: s.mostLiked.up })}
        </p>
      )}
      <Link href={sidangHref(session.id, 'summary')} className="mt-auto pt-3 text-sm text-brass hover:underline inline-flex items-center gap-0.5">
        {t('Open summary & PDF')} <ChevronRight className="w-4 h-4" />
      </Link>
    </Card>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-raised px-3 py-2.5 min-w-0">
      <div className="flex items-start gap-1.5 text-muted text-[11px] font-medium leading-tight min-h-[1.75rem]">
        <span className="shrink-0 mt-px hidden sm:inline">{icon}</span> <span className="min-w-0">{label}</span>
      </div>
      <div className="font-display text-lg font-bold tabular truncate">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Open song requests across upcoming Sidang
// ------------------------------------------------------------------------------------------------

export function OpenRequests({ upcoming }: { upcoming: Session[] }) {
  const { t } = useT();
  const [rows, setRows] = useState<Array<SongRequest & { votes: number }> | null | undefined>(undefined);
  const ids = upcoming.map((s) => s.id).join(',');

  useEffect(() => {
    let alive = true;
    api
      .fetchOpenRequests(upcoming.map((s) => s.id))
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (!rows) return null;
  const top = [...rows].sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at)).slice(0, 3);
  const name = (id: string) => upcoming.find((s) => s.id === id)?.name ?? '';
  return (
    <Card className="p-5 flex flex-col">
      <SectionTitle icon={<HandHeart className="w-5 h-5" />}>{t('Song requests')}</SectionTitle>
      {top.length ? (
        <ul className="space-y-2">
          {top.map((r) => (
            <li key={r.id}>
              <Link href={sidangHref(r.session_id, 'list')} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-raised hover:bg-line/40">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.title}</div>
                  <div className="text-xs text-muted truncate">
                    {name(r.session_id)} · {r.author}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-jade-light tabular">
                  <ThumbsUp className="w-3.5 h-3.5" /> +{r.votes}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('No open requests for the coming Sidang.')}</p>
      )}
      {rows.length > 3 && <p className="text-xs text-muted mt-2">{t('{n} open requests in total', { n: rows.length })}</p>}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// Season stats for the current event
// ------------------------------------------------------------------------------------------------

export function SeasonStats({ eventId }: { eventId: string | null }) {
  const { events, sessions } = useStage();
  const { t } = useT();
  const event = events.find((e) => e.id === eventId) ?? null;
  const mine = useMemo(() => sessions.filter((s) => s.event_id === eventId), [sessions, eventId]);
  const [stats, setStats] = useState<{ done: number; songs: number; seconds: number; top: { title: string; n: number } | null } | null>(null);
  const ids = mine.map((s) => s.id).join(',');

  useEffect(() => {
    if (!mine.length) return;
    let alive = true;
    api
      .fetchPlayLogFor(mine.map((s) => s.id))
      .then((rows) => {
        if (!alive || !rows) return;
        const bySession = new Map<string, typeof rows>();
        for (const r of rows) bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]);
        let done = 0;
        let songs = 0;
        let seconds = 0;
        const plays = new Map<string, number>();
        for (const list of bySession.values()) {
          const s = buildSummary(list, { now: Date.now(), livePartId: null, liveVotes: () => null });
          if (s.parts.some((p) => p.finished)) done++;
          songs += s.songsPlayed;
          seconds += s.playSeconds;
          const titles = new Set(s.parts.flatMap((p) => p.items.filter((i) => i.kind === 'song').map((i) => i.title)));
          for (const title of titles) plays.set(title, (plays.get(title) ?? 0) + 1);
        }
        const best = [...plays.entries()].sort((a, b) => b[1] - a[1])[0];
        setStats({ done, songs, seconds, top: best && best[1] > 1 ? { title: best[0], n: best[1] } : null });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (!event || !stats || !stats.songs) return null;
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Trophy className="w-5 h-5" />}
        action={
          <Link href={`/konvo/${encodeURIComponent(event.id)}`} className="text-sm text-brass hover:underline shrink-0">
            {t('Open')}
          </Link>
        }
      >
        {t('{event} so far', { event: event.name })}
      </SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<CalendarDays className="w-4 h-4" />} value={`${stats.done}/${mine.length}`} label={t('Sidang done')} />
        <Stat icon={<Music2 className="w-4 h-4" />} value={String(stats.songs)} label={t('Songs played')} />
        <Stat icon={<Timer className="w-4 h-4" />} value={formatDuration(stats.seconds)} label={t('Playing time')} />
        <Stat icon={<Repeat className="w-4 h-4" />} value={stats.top ? stats.top.title : '–'} label={t('Most played')} />
      </div>
      {stats.top && (
        <p className="text-xs text-muted mt-2">{t('Most played: {title}, in {n} Sidang', { title: stats.top.title, n: stats.top.n })}</p>
      )}
    </Card>
  );
}
