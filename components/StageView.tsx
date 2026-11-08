'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  SkipForward,
} from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useWakeLock } from '@/lib/useWakeLock';
import type { ResolvedQueueItem } from '@/types';
import { Badge, Button, Card, EmptyState, IconButton, LiveDot, Rhythms, cx } from './ui';
import { LivePicker } from './LivePicker';
import { formatIntro, introUnitWord } from '@/lib/format';

export function StageView({ onOpenSetlist }: { onOpenSetlist: () => void }) {
  const {
    liveSession,
    livePart,
    liveQueue,
    activeIndex,
    activeItem,
    nextPart,
    roomState,
    role,
    isManager,
    canControl,
    canSwitchLive,
    controlBlockedReason,
    selectedInstrument,
    isCued,
    goNext,
    goPrev,
    jumpTo,
    changeLoop,
    togglePause,
    goLive,
  } = useStage();

  const [pickerOpen, setPickerOpen] = useState(false);
  const picker = <LivePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />;
  const openPicker = () => setPickerOpen(true);

  useWakeLock(true);

  // Keyboard & presenter-clicker shortcuts for whoever is controlling
  useEffect(() => {
    if (!canControl) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="dialog"]')) return;
      const map: Record<string, () => void> = {
        ArrowRight: goNext,
        PageDown: goNext,
        ArrowLeft: goPrev,
        PageUp: goPrev,
        ArrowUp: () => changeLoop(1),
        '+': () => changeLoop(1),
        '=': () => changeLoop(1),
        ArrowDown: () => changeLoop(-1),
        '-': () => changeLoop(-1),
      };
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Nothing live -------------------------------------------------------
  if (!liveSession || !livePart) {
    return (
      <Shell>
        <Card className="mt-6">
          <EmptyState
            icon={<Radio className="w-10 h-10" />}
            title="Nothing is live yet"
            action={
              canSwitchLive && (
                <Button variant="primary" onClick={openPicker}>
                  <Layers className="w-4 h-4" /> Choose Sidang & Bahagian
                </Button>
              )
            }
          >
            {canSwitchLive
              ? 'Pick which Sidang and Bahagian to put on every screen.'
              : 'Keep this screen open. It will update by itself when the performance starts.'}
          </EmptyState>
        </Card>
        {picker}
      </Shell>
    );
  }

  const location = `${liveSession.name} · ${livePart.name}`;
  const upcoming = liveQueue.slice(activeIndex + 1);
  const next = upcoming[0];
  const later = upcoming.slice(1);
  const isLast = activeIndex === liveQueue.length - 1;
  const cued = activeItem ? isCued(activeItem.introInstruments) : false;
  const loop = roomState.current_loop_iteration || 1;

  return (
    <Shell padBottom={canControl || role === 'controller'}>
      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 sm:pt-6">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-400">
          <LiveDot /> LIVE
        </span>
        <span className="text-sm sm:text-base font-medium text-ink">{location}</span>
        {liveQueue.length > 0 && (
          <span className="text-sm text-muted tabular">
            Song {activeIndex + 1} of {liveQueue.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canControl && activeItem && (
            <Button size="sm" variant={roomState.is_paused ? 'primary' : 'secondary'} onClick={togglePause}>
              {roomState.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {roomState.is_paused ? 'Resume' : 'Hold'}
            </Button>
          )}
          {canSwitchLive && (
            <Button size="sm" variant="secondary" onClick={openPicker}>
              <Layers className="w-3.5 h-3.5" /> Change
            </Button>
          )}
        </div>
      </div>

      {roomState.is_paused && (
        <div className="mt-3 rounded-xl border border-brass/40 bg-brass-soft text-brass px-4 py-3 font-semibold flex items-center gap-2">
          <Pause className="w-4 h-4" /> On hold — wait for the signal
        </div>
      )}

      {!activeItem ? (
        <Card className="mt-4">
          <EmptyState
            title={`${livePart.name} has no songs yet`}
            action={
              isManager ? (
                <Button variant="primary" onClick={onOpenSetlist}>Add songs</Button>
              ) : canSwitchLive ? (
                <Button variant="primary" onClick={openPicker}>Change Bahagian</Button>
              ) : undefined
            }
          >
            {isManager ? 'Add songs to this Bahagian in the Setlist tab.' : 'The Maestro has not added songs to this Bahagian.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          {/* NOW */}
          <Card className={cx('lg:col-span-8 p-5 sm:p-8 flex flex-col gap-6', cued && 'border-brass/60')}>
            {cued && (
              <div className="rounded-2xl bg-brass text-brass-ink px-5 py-4 animate-cue-pulse">
                <div className="text-xs font-bold uppercase tracking-[0.18em]">Your cue</div>
                <div className="text-xl sm:text-2xl font-bold leading-tight mt-0.5">
                  {selectedInstrument} starts the intro · {formatIntro(activeItem.introBarCount, activeItem.introUnit)}
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm text-muted font-medium">Now playing</span>
                {activeItem.hasOverride && <Badge tone="override">Adjusted for this ceremony</Badge>}
              </div>
              <h1 className="text-4xl sm:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] [text-wrap:balance] break-words">
                {activeItem.song.title}
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat label="Intro">
                <span className="text-5xl sm:text-6xl font-bold tabular">{activeItem.introBarCount}</span>
                <span
                  className={cx(
                    'ml-2',
                    activeItem.introUnit === 'beats'
                      ? 'text-2xl font-bold uppercase tracking-wide text-teal-300'
                      : 'text-lg text-muted'
                  )}
                >
                  {introUnitWord(activeItem.introBarCount, activeItem.introUnit)}
                </span>
              </Stat>
              <Stat label="Loop" accent>
                <span className="text-5xl sm:text-6xl font-bold tabular text-brass">{loop}</span>
                <span className="text-2xl sm:text-3xl text-muted ml-1.5 tabular">/ {activeItem.loopCount}</span>
                <LoopPips current={loop} total={activeItem.loopCount} />
              </Stat>
            </div>

            {activeItem.song.rhythms.length > 0 && (
              <div>
                <div className="text-sm text-muted font-medium mb-2">Rhythm</div>
                <Rhythms rhythms={activeItem.song.rhythms} size="lg" />
              </div>
            )}

            <div>
              <div className="text-sm text-muted font-medium mb-2">Intro instruments</div>
              <div className="flex flex-wrap gap-2">
                {activeItem.introInstruments.length ? (
                  activeItem.introInstruments.map((inst) => (
                    <span
                      key={inst}
                      className={cx(
                        'h-10 px-4 rounded-full inline-flex items-center text-base font-semibold border',
                        inst === selectedInstrument ? 'bg-brass text-brass-ink border-brass' : 'bg-raised border-line'
                      )}
                    >
                      {inst}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">None set</span>
                )}
              </div>
            </div>

            {canControl && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-faint">
                Shortcuts: ← → change song · ↑ ↓ change loop · presenter clicker works too
              </div>
            )}
          </Card>

          {/* NEXT */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card className="p-5">
              <div className="text-sm text-muted font-medium mb-3">Up next</div>
              {next ? (
                <NextCard item={next} cued={isCued(next.introInstruments)} />
              ) : (
                <div className="space-y-3">
                  <p className="text-ink font-medium">This is the last song of {livePart.name}.</p>
                  {nextPart && canSwitchLive && (
                    <Button variant="primary" className="w-full" onClick={() => goLive(nextPart.id)}>
                      Go live: {nextPart.name} <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                  {nextPart && !canSwitchLive && <p className="text-sm text-muted">Next up: {nextPart.name}</p>}
                </div>
              )}
            </Card>

            {later.length > 0 && (
              <Card className="p-2">
                <div className="px-3 pt-2 pb-1 text-sm text-muted font-medium">Later</div>
                <ol>
                  {later.map((r) => {
                    const pos = liveQueue.indexOf(r) + 1;
                    const mine = isCued(r.introInstruments);
                    const body = (
                      <>
                        <span className="w-6 text-sm text-faint tabular shrink-0">{pos}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{r.song.title}</span>
                          <span className="block text-xs text-muted tabular">
                            {formatIntro(r.introBarCount, r.introUnit)} · {r.loopCount}× · {r.introInstruments.join(', ') || '—'}
                          </span>
                          {r.song.rhythms.length > 0 && <Rhythms rhythms={r.song.rhythms} className="mt-1" />}
                        </span>
                        {mine && <Badge tone="brass">Cue</Badge>}
                      </>
                    );
                    return (
                      <li key={r.queueItem.id}>
                        {canControl ? (
                          <button
                            onClick={() => jumpTo(r.queueItem.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-raised group"
                            title="Jump to this song"
                          >
                            {body}
                            <span className="text-xs text-faint group-hover:text-brass">Jump</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {canControl && activeItem && (
        <ControlBar
          canPrev={activeIndex > 0}
          canNext={!isLast}
          loop={loop}
          onPrev={goPrev}
          onNext={goNext}
          onLoop={changeLoop}
        />
      )}
      {role === 'controller' && !canControl && controlBlockedReason && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur safe-bottom">
          <div className="max-w-7xl mx-auto px-4 pt-3 flex items-center gap-3 text-sm text-muted">
            <Lock className="w-4 h-4 shrink-0" />
            <span className="flex-1">{controlBlockedReason}</span>
            <Button size="sm" onClick={openPicker}>
              Change
            </Button>
          </div>
        </div>
      )}
      {picker}
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function Shell({ children, padBottom }: { children: React.ReactNode; padBottom?: boolean }) {
  return <div className={cx('max-w-7xl mx-auto w-full px-4 sm:px-6', padBottom ? 'pb-40' : 'pb-10')}>{children}</div>;
}

function Stat({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cx('rounded-2xl border p-4 sm:p-5', accent ? 'border-brass/30 bg-brass/[0.06]' : 'border-line bg-raised/60')}>
      <div className="text-sm text-muted font-medium mb-1">{label}</div>
      <div className="flex items-baseline flex-wrap">{children}</div>
    </div>
  );
}

function LoopPips({ current, total }: { current: number; total: number }) {
  const extra = current - total;
  if (total > 16) {
    return (
      <div className="w-full mt-3 h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full bg-brass rounded-full transition-all" style={{ width: `${Math.min(100, (current / total) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div className="w-full mt-3 flex flex-wrap items-center gap-1.5" aria-label={`Loop ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            'h-2.5 flex-1 min-w-[10px] max-w-[36px] rounded-full transition-colors',
            i + 1 < current ? 'bg-brass/60' : i + 1 === current ? 'bg-brass' : 'bg-line'
          )}
        />
      ))}
      {extra > 0 && <span className="text-xs font-semibold text-danger ml-1">+{extra} extra</span>}
      {extra === 0 && <span className="text-xs font-semibold text-brass ml-1">Final loop</span>}
    </div>
  );
}

function NextCard({ item, cued }: { item: ResolvedQueueItem; cued: boolean }) {
  return (
    <div className={cx('rounded-xl p-4 border', cued ? 'border-brass/60 bg-brass-soft' : 'border-line bg-raised/60')}>
      {cued && <div className="text-xs font-bold uppercase tracking-wider text-brass mb-1">Your cue next</div>}
      <div className="text-xl sm:text-2xl font-bold leading-tight break-words">{item.song.title}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted tabular">
        <span>
          <b className="text-ink">{item.introBarCount}</b> {introUnitWord(item.introBarCount, item.introUnit)} intro
        </span>
        <span>
          <b className="text-ink">{item.loopCount}</b>× loop
        </span>
      </div>
      <div className="mt-1 text-sm text-muted">{item.introInstruments.join(', ') || 'No intro instruments'}</div>
      {item.song.rhythms.length > 0 && <Rhythms rhythms={item.song.rhythms} className="mt-2" />}
      {item.hasOverride && <Badge tone="override" className="mt-2">Adjusted</Badge>}
    </div>
  );
}

function ControlBar({
  canPrev,
  canNext,
  loop,
  onPrev,
  onNext,
  onLoop,
}: {
  canPrev: boolean;
  canNext: boolean;
  loop: number;
  onPrev: () => void;
  onNext: () => void;
  onLoop: (d: number) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md safe-bottom">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] gap-2 sm:gap-3 items-stretch">
        <Button size="xl" variant="secondary" onClick={onPrev} disabled={!canPrev} className="px-2" aria-label="Previous song">
          <ChevronLeft className="w-6 h-6" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        <div className="flex items-center gap-0.5 sm:gap-1 rounded-2xl border border-brass/30 bg-brass/[0.06] px-1 sm:px-1.5">
          <IconButton label="Loop −1" onClick={() => onLoop(-1)} disabled={loop <= 1} className="w-11 h-11 sm:w-12 sm:h-12 text-ink">
            <Minus className="w-5 h-5" />
          </IconButton>
          <div className="w-10 sm:w-14 flex flex-col items-center leading-none" aria-live="polite">
            <span className="text-[10px] uppercase tracking-wider text-muted">Loop</span>
            <span className="text-2xl font-bold text-brass tabular">{loop}</span>
          </div>
          <IconButton label="Loop +1" onClick={() => onLoop(1)} className="w-11 h-11 sm:w-12 sm:h-12 bg-brass text-brass-ink hover:bg-brass-strong">
            <Plus className="w-5 h-5" />
          </IconButton>
        </div>

        <Button size="xl" variant="primary" onClick={onNext} disabled={!canNext} aria-label="Next song" className="px-3 sm:px-6">
          <span>Next</span>
          <SkipForward className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
