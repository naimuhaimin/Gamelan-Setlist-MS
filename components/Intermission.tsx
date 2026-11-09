'use client';

import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Coffee, Layers, Music2, Undo2 } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { Interlude, Part } from '@/types';
import { formatIntro } from '@/lib/format';
import { Badge, Button, Card, LiveDot, Rhythms, cx } from './ui';
import { LivePicker } from './LivePicker';

/** Little dots showing how many guest songs are done. */
function SongDots({ total, done, className }: { total: number; done: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)} aria-label={`${done} of ${total} songs done`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            'w-3 h-3 rounded-full border',
            i < done ? 'bg-brass border-brass' : i === done ? 'border-brass bg-brass/30 animate-pulse' : 'border-line-strong'
          )}
        />
      ))}
    </span>
  );
}

/** Full live screen while the guest group plays between two Bahagian. */
export function IntermissionStage() {
  const {
    liveSession,
    livePart,
    nextPart,
    liveInterlude,
    interludeDone,
    interludeTracking,
    setInterludeDone,
    resolveQueue,
    canControl,
    canSwitchLive,
    goLive,
    goPrev,
    isCued,
    selectedInstrument,
  } = useStage();
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!liveSession || !livePart || !nextPart || !liveInterlude) return null;

  const { label, songs } = liveInterlude;
  const ready = interludeDone >= songs;
  const first = resolveQueue(nextPart.id)[0];
  const firstSong = first && !first.isBreak ? first : null;
  const cued = firstSong ? isCued(firstSong.introInstruments) : false;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 sm:pt-6">
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-brass-soft text-brass border border-brass/45 text-sm font-bold">
          <Coffee className="w-4 h-4" /> INTERMISSION
        </span>
        <span className="text-sm sm:text-base font-medium text-ink">
          {liveSession.name} · after {livePart.name}
        </span>
        {canSwitchLive && (
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setPickerOpen(true)}>
            <Layers className="w-3.5 h-3.5" /> Change
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7 p-6 sm:p-10 border-t-[3px] border-t-brass">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-20 h-20 rounded-full bg-brass-soft text-brass ring-1 ring-brass/45 grid place-items-center">
              <Coffee className="w-10 h-10" />
            </div>
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-brass">Intermission</div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight [text-wrap:balance] break-words">{label}</h1>
            <p className="text-lg text-muted">
              Performing <b className="text-ink tabular">{songs}</b> {songs === 1 ? 'song' : 'songs'} · rest until {nextPart.name}
            </p>

            {interludeTracking && (
              <div className="mt-1 flex flex-col items-center gap-2">
                <SongDots total={songs} done={interludeDone} />
                <div className={cx('text-base font-semibold tabular', ready ? 'text-brass' : 'text-ink')}>
                  {ready ? 'Kombo done · get ready!' : `Song ${interludeDone + 1} of ${songs} playing`}
                </div>
              </div>
            )}

            {canControl && interludeTracking && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {!ready && (
                  <Button size="lg" variant="primary" onClick={() => setInterludeDone(interludeDone + 1)}>
                    <Check className="w-5 h-5" /> Song {interludeDone + 1} done
                  </Button>
                )}
                {interludeDone > 0 && (
                  <Button size="lg" variant="ghost" onClick={() => setInterludeDone(interludeDone - 1)}>
                    <Undo2 className="w-4 h-4" /> Undo
                  </Button>
                )}
              </div>
            )}

            {(canSwitchLive || canControl) && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {canSwitchLive && (
                  <Button
                    size="lg"
                    variant={ready || !interludeTracking ? 'primary' : 'secondary'}
                    onClick={() => goLive(nextPart.id)}
                  >
                    Go live: {nextPart.name} <ChevronRight className="w-5 h-5" />
                  </Button>
                )}
                {canControl && (
                  <Button size="lg" variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="w-4 h-4" /> Back to {livePart.name}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className={cx('min-w-0 lg:col-span-5 p-5 sm:p-6 flex flex-col gap-3', (ready || cued) && 'border-brass/60')}>
          <div className="text-sm text-muted font-medium">After the intermission</div>
          <div className="font-display text-2xl font-bold">{nextPart.name}</div>
          {first ? (
            <div className={cx('rounded-xl p-4 border', cued ? 'border-brass/60 bg-brass-soft' : 'border-line bg-raised/60')}>
              {cued && <div className="text-xs font-bold uppercase tracking-wider text-brass mb-1">Your cue · {selectedInstrument}</div>}
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Opens with</div>
              <div className="font-display text-xl sm:text-2xl font-bold leading-tight break-words">{first.song.title}</div>
              {firstSong && (
                <>
                  <div className="mt-2 text-sm text-muted tabular">
                    {formatIntro(firstSong.introBarCount, firstSong.introUnit)} intro · {firstSong.loopCount}× ·{' '}
                    {firstSong.introInstruments.join(', ') || '—'}
                  </div>
                  {firstSong.song.rhythms.length > 0 && <Rhythms rhythms={firstSong.song.rhythms} className="mt-2" />}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No songs added yet.</p>
          )}
        </Card>
      </div>
      <LivePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}

/** The intermission shown between two Bahagian in lists. */
export function IntermissionRow({ part, interlude }: { part: Part; interlude: Interlude }) {
  const { livePart, liveInterlude, interludeDone, interludeTracking } = useStage();
  const now = !!liveInterlude && livePart?.id === part.id;
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl border px-4 py-3',
        now ? 'border-brass/60 bg-brass-soft ring-1 ring-brass/40' : 'border-dashed border-line-strong bg-surface/60'
      )}
    >
      <span className={cx('w-9 h-9 rounded-full grid place-items-center shrink-0', now ? 'bg-brass text-brass-ink' : 'bg-raised text-brass')}>
        <Coffee className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-brass">Intermission</span>
          {now && (
            <Badge tone="live">
              <LiveDot /> Now
            </Badge>
          )}
        </div>
        <div className="font-medium break-words">{interlude.label}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular inline-flex items-center gap-1">
          <Music2 className="w-3.5 h-3.5 text-muted" /> {interlude.songs} {interlude.songs === 1 ? 'song' : 'songs'}
        </div>
        {now && interludeTracking && <SongDots total={interlude.songs} done={interludeDone} className="mt-1 flex justify-end" />}
      </div>
    </div>
  );
}
