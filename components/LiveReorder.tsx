'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { formatIntro } from '@/lib/format';
import { BreakIcon, Button, Card, IconButton, cx } from './ui';

/**
 * Reorder what is still to come in the live Bahagian (Controller, Maestro, Admin).
 * Only upcoming items move; the current song and everything already played stay put.
 */
export function LiveReorder({ onDone }: { onDone: () => void }) {
  const { liveQueue, activeIndex, moveLiveItem, isCued } = useStage();
  const upcoming = liveQueue.slice(activeIndex + 1);

  return (
    <Card className="p-2 border-brass/50">
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Reorder what’s next</div>
          <div className="text-xs text-muted">Changes show on every phone straight away.</div>
        </div>
        <Button size="sm" variant="primary" onClick={onDone}>
          <Check className="w-4 h-4" /> Done
        </Button>
      </div>
      <ol className="flex flex-col gap-1">
        {upcoming.map((r, i) => {
          const pos = activeIndex + 2 + i;
          return (
            <li
              key={r.queueItem.id}
              className={cx(
                'flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-xl border',
                i === 0 ? 'border-brass/40 bg-brass/[0.06]' : 'border-transparent',
                r.isBreak && 'bg-stop/[0.06]'
              )}
            >
              <span className="w-6 text-sm text-faint tabular shrink-0">{pos}</span>
              <span className="flex-1 min-w-0">
                {r.isBreak ? (
                  <span className="flex items-center gap-2 text-stop-light font-medium">
                    <BreakIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{r.song.title}</span>
                  </span>
                ) : (
                  <>
                    <span className="block truncate font-medium">
                      {r.song.title}
                      {isCued(r.introInstruments) && <span className="ml-1.5 text-xs text-brass">· your cue</span>}
                    </span>
                    <span className="block text-xs text-muted tabular truncate">
                      {formatIntro(r.introBarCount, r.introUnit)} · {r.loopCount}× · {r.introInstruments.join(', ') || '—'}
                    </span>
                  </>
                )}
                {i === 0 && <span className="block text-[11px] font-semibold uppercase tracking-wider text-brass mt-0.5">Up next</span>}
              </span>
              <IconButton
                label={`Move ${r.song.title} up`}
                onClick={() => moveLiveItem(r.queueItem.id, -1)}
                disabled={i === 0}
                className="w-11 h-11 shrink-0"
              >
                <ArrowUp className="w-5 h-5" />
              </IconButton>
              <IconButton
                label={`Move ${r.song.title} down`}
                onClick={() => moveLiveItem(r.queueItem.id, 1)}
                disabled={i === upcoming.length - 1}
                className="w-11 h-11 shrink-0"
              >
                <ArrowDown className="w-5 h-5" />
              </IconButton>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
