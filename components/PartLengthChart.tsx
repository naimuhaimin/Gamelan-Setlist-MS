'use client';

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatClock, formatDuration, type SummaryPart } from '@/lib/summary';
import { Card, cx } from './ui';

/**
 * How long each Bahagian took, as horizontal bars on one shared scale,
 * split into song time (gold) and break time (red, striped).
 * Colours were checked for colour-blind separation; the stripes, gaps, legend and
 * printed durations mean nothing depends on colour alone. Tap/hover a bar for details.
 */
export function PartLengthChart({ parts }: { parts: SummaryPart[] }) {
  const { t } = useT();
  const [active, setActive] = useState<string | null>(null);

  const rows = parts
    .filter((p) => p.seconds !== null && p.seconds > 0)
    .map((p) => {
      const song = p.items.filter((i) => i.kind === 'song').reduce((n, i) => n + (i.seconds ?? 0), 0);
      const brk = p.items.filter((i) => i.kind === 'break').reduce((n, i) => n + (i.seconds ?? 0), 0);
      const total = p.seconds ?? 0;
      // Song + break time should equal the Bahagian's length; scale if rounding differs
      const known = song + brk || total;
      return { p, total, song: (song / known) * total, brk: (brk / known) * total, songs: p.items.filter((i) => i.kind === 'song').length };
    });
  if (rows.length < 1) return null;

  const max = Math.max(...rows.map((r) => r.total));
  const anyBreaks = rows.some((r) => r.brk > 0);
  const shown = rows.find((r) => r.p.partId === active);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <h2 className="font-display text-xl font-bold flex-1 min-w-0 inline-flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brass" /> {t('Length of each Bahagian')}
        </h2>
        {/* Legend: always present for two series */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-chart-song" /> {t('Songs')}
          </span>
          {anyBreaks && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-chart-break chart-stripes" /> {t('Breaks')}
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-1" role="list">
        {rows.map((r) => {
          const on = active === r.p.partId;
          return (
            <li key={r.p.partId}>
              <button
                type="button"
                onMouseEnter={() => setActive(r.p.partId)}
                onMouseLeave={() => setActive((a) => (a === r.p.partId ? null : a))}
                onFocus={() => setActive(r.p.partId)}
                onClick={() => setActive((a) => (a === r.p.partId ? null : r.p.partId))}
                aria-label={t('{part}: {total} (songs {songs}, breaks {breaks})', {
                  part: r.p.partName,
                  total: formatDuration(r.total),
                  songs: formatDuration(r.song),
                  breaks: formatDuration(r.brk),
                })}
                className={cx(
                  'w-full grid grid-cols-[4.75rem_minmax(0,1fr)_3.75rem] items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors',
                  on ? 'bg-raised' : 'hover:bg-raised/60'
                )}
              >
                <span className="text-sm font-medium truncate">
                  {r.p.partName}
                  {r.p.ongoing && <span className="ml-1 text-[10px] font-bold uppercase text-songket-light">{t('live')}</span>}
                </span>
                {/* Bar on a shared scale; rounded only at the data end */}
                <span className="h-4 flex items-stretch">
                  <span className="flex h-full gap-[2px]" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }}>
                    {r.song > 0 && (
                      <span
                        className={cx('h-full bg-chart-song', r.brk > 0 ? '' : 'rounded-r', r.p.ongoing && 'opacity-80')}
                        style={{ flexGrow: r.song, flexBasis: 0 }}
                      />
                    )}
                    {r.brk > 0 && (
                      <span className="h-full bg-chart-break chart-stripes rounded-r" style={{ flexGrow: r.brk, flexBasis: 0 }} />
                    )}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular text-right">{formatDuration(r.total)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Details for the tapped / hovered bar */}
      <div className="mt-3 min-h-[2.5rem] rounded-xl border border-line px-3 py-2 text-sm" aria-live="polite">
        {shown ? (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 tabular">
            <b>{shown.p.partName}</b>
            <span className="text-muted">
              {formatClock(shown.p.startedAt)}
              {shown.p.endedAt ? `–${formatClock(shown.p.endedAt)}` : ''}
            </span>
            <span>
              {t('Songs')}: <b>{formatDuration(shown.song)}</b> <span className="text-muted">({shown.songs})</span>
            </span>
            {shown.brk > 0 && (
              <span>
                {t('Breaks')}: <b>{formatDuration(shown.brk)}</b>
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted">{t('Tap a bar for details.')}</span>
        )}
      </div>
    </Card>
  );
}
