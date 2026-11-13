'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, CalendarDays, HandHeart, Users, Check, ChevronLeft, ClipboardList, List, MonitorPlay, Radio, Settings2, Share2, SlidersHorizontal } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import * as api from '@/lib/supabaseService';
import { plural, useT } from '@/lib/i18n';
import type { Part, ResolvedQueueItem } from '@/types';
import { formatIntro } from '@/lib/format';
import { useShell } from './AppShell';
import { StageView } from './StageView';
import { SetlistEditor } from './SetlistEditor';
import { SidangModal } from './SidangModal';
import { Badge, BreakIcon, Button, Card, EmptyState, IconButton, LiveDot, Rhythms, SongNote, VoteButtons, cx } from './ui';
import { formatDate, sidangUrl } from './Cards';
import { IntermissionRow } from './Intermission';
import { ChatLauncher } from './SidangChat';
import { CopySetlistModal } from './SetlistText';
import { SidangSummary } from './SidangSummary';
import { SongRequests } from './SongRequests';
import { Attendance } from './Attendance';
import { registeredHint, useAttendance } from '@/lib/useAttendance';
import { TabCarousel, usePhone } from './TabCarousel';
import { rememberEventsSpot } from '@/lib/eventsMemory';

type View = 'attendance' | 'requests' | 'live' | 'list' | 'summary' | 'edit';

export function SidangView({ sessionId }: { sessionId: string }) {
  const { sessions, events, liveSession, isManager, stageLive, canControl, role, isFinished, parts, resolveQueue, roomState, nextPart } = useStage();
  const { openShare } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const { t } = useT();

  const session = sessions.find((s) => s.id === sessionId);
  const event = events.find((e) => e.id === session?.event_id);
  const isLive = liveSession?.id === sessionId && stageLive;

  // ---- Which tab to open when none is asked for ----
  // live: Live · finished or after the day: Summary · before the day: Attendance
  // on the day: List if this phone has registered, otherwise Attendance (so people register first)
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const sameDay = !!session?.date && session.date === today;
  // The last Bahagian that has songs; when it has been played to the end, the Sidang is done
  const lastPart = parts
    .filter((p) => p.session_id === sessionId && resolveQueue(p.id).length > 0)
    .sort((a, b) => b.part_number - a.part_number)[0];
  const finishedOnStage = roomState.session_id === sessionId && isFinished && (!nextPart || roomState.part_id === lastPart?.id);
  const [finishedInLog, setFinishedInLog] = useState(false);
  useEffect(() => {
    if (!sameDay || !lastPart) return;
    let alive = true;
    api.partFinished(lastPart.id).then((done) => alive && setFinishedInLog(done)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sameDay, lastPart?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const att = useAttendance(sessionId, session?.event_id ?? null);
  const [hint, setHint] = useState<boolean | null>(null);
  useEffect(() => setHint(registeredHint(sessionId)), [sessionId]);
  // No attendance tables yet: behave as before (List on the day)
  const registeredNow = att.available === false ? true : att.available ? !!att.mine : hint ?? false;
  // Decided once per visit: registering on the Attendance tab doesn't throw you onto List;
  // the next time you open this Sidang it opens on List.
  const [registeredAtOpen, setRegisteredAtOpen] = useState<boolean | null>(null);
  useEffect(() => setRegisteredAtOpen(null), [sessionId]);
  useEffect(() => {
    if (registeredAtOpen === null && att.available !== null) setRegisteredAtOpen(registeredNow);
  }, [att.available, registeredNow, registeredAtOpen]);
  const registered = registeredAtOpen ?? registeredNow;

  const defaultView: View = isLive
    ? 'live'
    : !session?.date
      ? 'list'
      : session.date > today
        ? 'attendance'
        : session.date < today
          ? 'summary'
          : finishedOnStage || finishedInLog
            ? 'summary'
            : registered
              ? 'list'
              : 'attendance';

  const requested = params.get('view') as View | null;
  const view: View =
    requested === 'edit' && isManager ? 'edit' : requested === 'attendance' || requested === 'requests' || requested === 'live' || requested === 'list' || requested === 'summary' ? requested : defaultView;
  const urlView = view;
  const [pendingView, setPendingView] = useState<View | null>(null);
  useEffect(() => {
    if (pendingView && urlView === pendingView) setPendingView(null);
  }, [urlView, pendingView]);
  const shown: View = pendingView ?? urlView;
  const setView = (v: View) => {
    setPendingView(v);
    router.replace(`${pathname}?view=${v}`, { scroll: false });
  };
  const phone = usePhone();

  // ---- Phones: a carousel of the tabs; past the ends, on to the next main tab (Home / Live) ----
  const order: View[] = ['attendance', 'requests', 'live', 'list', 'summary', ...(isManager ? (['edit'] as View[]) : [])];
  const at = Math.max(0, order.indexOf(shown));
  const leaveTo = (dir: -1 | 1) => {
    rememberEventsSpot();
    router.push(dir === 1 ? '/live' : '/');
  };

  if (!session)
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <EmptyState title={t('Sidang not found')} action={<Link href="/" className="text-brass underline">{t('Back to home')}</Link>}>
          {t('It may have been deleted.')}
        </EmptyState>
      </div>
    );

  const views: Array<{ id: View; label: string; icon: React.ReactNode }> = [
    { id: 'attendance', label: t('Attendance'), icon: <Users className="w-4 h-4" /> },
    { id: 'requests', label: t('Requests'), icon: <HandHeart className="w-4 h-4" /> },
    { id: 'live', label: t('Live'), icon: <MonitorPlay className="w-4 h-4" /> },
    { id: 'list', label: t('List'), icon: <List className="w-4 h-4" /> },
    { id: 'summary', label: t('Summary'), icon: <BarChart3 className="w-4 h-4" /> },
    ...(isManager ? [{ id: 'edit' as View, label: t('Edit'), icon: <SlidersHorizontal className="w-4 h-4" /> }] : []),
  ];

  return (
    <div>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <Link
          href={event ? `/konvo/${encodeURIComponent(event.id)}` : '/'}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink pt-4"
        >
          <ChevronLeft className="w-4 h-4" /> {event?.name ?? t('Home')}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl sm:text-4xl font-bold">{session.name}</h1>
              {isLive && (
                <Badge tone="live">
                  <LiveDot /> {t('Live')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted flex items-center gap-1.5 mt-1">
              <CalendarDays className="w-3.5 h-3.5" /> {formatDate(session.date) || t('No date')}
            </p>
          </div>
          <Button onClick={() => openShare({ url: sidangUrl(session.id), title: t('Share {name}', { name: session.name }) })}>
            <Share2 className="w-4 h-4" /> {t('Share')}
          </Button>
          <Button onClick={() => setTextOpen(true)} aria-label={t('Setlist as text')} title={t('Setlist as text')}>
            <ClipboardList className="w-4 h-4" /> <span className="hidden sm:inline">{t('Copy text')}</span>
          </Button>
          {isManager && (
            <IconButton label={t('Sidang settings')} variant="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="w-5 h-5" />
            </IconButton>
          )}
        </div>

        {/* View switch */}
        <div className="mt-4 flex justify-center">
        <div className="inline-flex p-1 rounded-xl bg-surface border border-line" role="tablist" aria-label={t('View')}>
          {views.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={shown === v.id}
              aria-label={v.label}
              title={v.label}
              onClick={() => setView(v.id)}
              className={cx(
                'h-9 px-3 sm:px-4 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 sm:gap-2 transition-colors',
                shown === v.id ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              {v.icon}
              <span className={shown === v.id ? '' : 'hidden sm:inline'}>{v.label}</span>
              {v.id === 'live' && isLive && <LiveDot />}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <TabCarousel
          enabled={phone}
          index={at}
          count={order.length}
          onChange={(i) => setView(order[i])}
          onBeyond={leaveTo}
          beyondPrevLabel={t('Home')}
          beyondNextLabel={t('Live')}
          render={(i, active) => {
            const v = order[i];
            if (v === 'live') return isLive ? <StageView inactive={!active} /> : <NotLive sessionId={sessionId} onList={() => setView('list')} />;
            if (v === 'list') return <SidangList sessionId={sessionId} active={active} />;
            if (v === 'requests')
              return (
                <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10">
                  <SongRequests sessionId={sessionId} />
                </div>
              );
            if (v === 'summary') return <SidangSummary sessionId={sessionId} />;
            if (v === 'attendance')
              return (
                <Attendance
                  sessionId={sessionId}
                  autoRegister={active && params.get('register') === '1'}
                  onAutoRegisterDone={() => router.replace(`${pathname}?view=attendance`, { scroll: false })}
                />
              );
            if (v === 'edit' && isManager)
              return (
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10">
                  <SetlistEditor sessionId={sessionId} onShowStage={() => setView('live')} />
                </div>
              );
            return null;
          }}
        />
      </div>

      <CopySetlistModal open={textOpen} onClose={() => setTextOpen(false)} sessionId={session.id} />
      <ChatLauncher
        sessionId={session.id}
        sessionName={session.name}
        raised={shown === 'live' && isLive && !isFinished && (canControl || role === 'controller')}
      />

      <SidangModal
        mode="edit"
        open={settingsOpen}
        session={session}
        onClose={() => {
          setSettingsOpen(false);
          // If it was deleted, leave the page
          if (!sessions.some((s) => s.id === sessionId)) router.push(event ? `/konvo/${encodeURIComponent(event.id)}` : '/');
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function NotLive({ sessionId, onList }: { sessionId: string; onList: () => void }) {
  const { parts, resolveQueue, liveSession, canSwitchLive, goLive } = useStage();
  const { t } = useT();
  const myParts = parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number);
  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10">
      <Card>
        <EmptyState
          icon={<Radio className="w-10 h-10" />}
          title={t('This Sidang isn’t live right now')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onList}>
                <List className="w-4 h-4" /> {t('See the full list')}
              </Button>
              {liveSession && (
                <Link href="/live" className="h-10 px-4 rounded-xl bg-raised border border-line inline-flex items-center gap-2 text-sm font-medium">
                  <LiveDot /> {t('See what’s live')}
                </Link>
              )}
            </div>
          }
        >
          {canSwitchLive ? t('Put one of its Bahagian live:') : t('This page will switch to the live stage when it starts.')}
        </EmptyState>
        {canSwitchLive && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 pb-5 -mt-4">
            {myParts.map((p) => {
              const n = resolveQueue(p.id).length;
              return (
                <Button key={p.id} variant="primary" disabled={!n} onClick={() => goLive(p.id)}>
                  {t('Go live: {part}', { part: p.name.replace('Bahagian', 'B') })}
                </Button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Every Bahagian and its items in order, with the live item highlighted. */
function SidangList({ sessionId, active = true }: { sessionId: string; active?: boolean }) {
  const { parts, resolveQueue, livePart, activeIndex, isFinished, roomState, interludeFor } = useStage();
  const myParts = parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number);
  const liveRef = useRef<HTMLLIElement | null>(null);
  const liveItemId = roomState.current_queue_item_id;

  // Bring the live item into view once (only when this is the tab on screen, not a neighbour kept ready)
  const scrolled = useRef(false);
  useEffect(() => {
    if (active && !scrolled.current && liveRef.current) {
      liveRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      scrolled.current = true;
    }
  });

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10 space-y-5">
      {myParts.map((p) => {
        const interlude = interludeFor(p);
        return (
        <React.Fragment key={p.id}>
        <PartSection
          part={p}
          items={resolveQueue(p.id)}
          isLivePart={livePart?.id === p.id}
          activeIndex={livePart?.id === p.id ? activeIndex : -1}
          finished={livePart?.id === p.id && isFinished}
          liveItemId={liveItemId}
          liveRef={liveRef}
        />
        {interlude && <IntermissionRow part={p} interlude={interlude} />}
        </React.Fragment>
        );
      })}
    </div>
  );
}

function PartSection({
  part,
  items,
  isLivePart,
  activeIndex,
  finished,
  liveRef,
}: {
  part: Part;
  items: ResolvedQueueItem[];
  isLivePart: boolean;
  activeIndex: number;
  finished: boolean;
  liveItemId: string | null;
  liveRef: React.MutableRefObject<HTMLLIElement | null>;
}) {
  const { isCued, roomState, votesEnabled, tally, vote } = useStage();
  const { t } = useT();
  return (
    <Card className={cx('overflow-hidden', isLivePart && !finished && 'border-songket/50')}>
      <div className={cx('flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-line', isLivePart && !finished && 'border-t-[3px] border-t-songket')}>
        <h2 className="font-display text-xl font-bold flex-1">{part.name}</h2>
        {isLivePart && (
          <Badge tone={finished ? 'ok' : 'live'}>
            {!finished && <LiveDot />} {finished ? t('Finished') : roomState.is_paused ? t('On hold') : t('Live')}
          </Badge>
        )}
        <span className="text-xs text-muted tabular">{plural(items.filter((r) => !r.isBreak).length, '{n} song', '{n} songs')}</span>
      </div>
      {items.length ? (
        <ol className="divide-y divide-line">
          {items.map((r, i) => {
            const now = isLivePart && !finished && i === activeIndex;
            const done = isLivePart && (finished || i < activeIndex);
            const mine = !r.isBreak && isCued(r.introInstruments);
            return (
              <li
                key={r.queueItem.id}
                ref={now ? liveRef : undefined}
                className={cx(
                  'flex items-start gap-3 px-4 sm:px-5 py-3 transition-colors',
                  now && 'bg-songket-soft ring-1 ring-inset ring-songket/60',
                  r.isBreak && !now && 'bg-stop/[0.06]'
                )}
              >
                <span className={cx('w-7 pt-0.5 text-center text-sm font-semibold text-muted tabular shrink-0', done && 'opacity-45')}>
                  {done ? <Check className="w-4 h-4 inline text-jade-light" /> : i + 1}
                </span>
                <div className={cx('min-w-0 flex-1', done && 'opacity-45')}>
                  {r.isBreak ? (
                    <div className="flex items-center gap-2 text-stop-light font-semibold">
                      <BreakIcon className="w-4 h-4" /> {r.song.title}
                      {r.breakMinutes ? <span className="text-xs text-muted font-normal tabular">· {t('{n} min', { n: r.breakMinutes })}</span> : null}
                      {now && <Badge tone="live">{t('Now')}</Badge>}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cx('font-display font-bold', now ? 'text-xl' : 'text-base')}>{r.song.title}</span>
                        {now && (
                          <Badge tone="live">
                            <LiveDot /> {t('Now playing')}
                          </Badge>
                        )}
                        {mine && <Badge tone="brass">{t('Your cue')}</Badge>}
                        {r.hasOverride && <Badge tone="override">{t('Adjusted')}</Badge>}
                      </div>
                      <div className="text-sm text-muted tabular mt-0.5">
                        {t('{intro} intro', { intro: formatIntro(r.introBarCount, r.introUnit) })} · {r.loopCount}× · {r.introInstruments.join(', ') || '—'}
                      </div>
                      {r.song.rhythms.length > 0 && <Rhythms rhythms={r.song.rhythms} className="mt-1.5" />}
                      {r.song.notes && <SongNote text={r.song.notes} className="mt-1.5" />}
                    </>
                  )}
                </div>
                {votesEnabled && !r.isBreak && (
                  <span className="pt-0.5">
                    <VoteButtons {...tally(r.queueItem.id)} onVote={(v) => vote(r.queueItem.id, v)} label={r.song.title} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-muted">{t('No songs yet.')}</p>
      )}
    </Card>
  );
}
