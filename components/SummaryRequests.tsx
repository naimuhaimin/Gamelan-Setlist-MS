'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, HandHeart, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import * as api from '@/lib/supabaseService';
import { formatClock, type Summary } from '@/lib/summary';
import { computeRequestInsights, type RequestOutcome } from '@/lib/requestInsights';
import { Badge, Card, cx } from './ui';
import { Tile } from './SummaryPeople';

/** Song requests for this Sidang, checked against what was actually played. */
export function SummaryRequests({ sessionId, summary }: { sessionId: string; summary: Summary }) {
  const { songs } = useStage();
  const { t } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.fetchSongRequests>> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    api
      .fetchSongRequests(sessionId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [sessionId, summary.songsPlayed]);

  const ins = useMemo(
    () =>
      data
        ? computeRequestInsights({
            requests: data.requests,
            votes: data.votes,
            summary,
            songTitle: (id) => songs.find((s) => s.id === id)?.title,
          })
        : null,
    [data, summary, songs]
  );

  if (!data || !ins) return null; // loading, or the requests tables don't exist

  const fmtAvg = (n: number | null) => (n === null ? '–' : (Math.round(n * 10) / 10).toString());
  const compare =
    ins.requestedAvgUp !== null && ins.otherAvgUp !== null
      ? ins.requestedAvgUp > ins.otherAvgUp + 0.05
        ? t('Requested songs were liked more than the rest')
        : ins.requestedAvgUp < ins.otherAvgUp - 0.05
          ? t('Requested songs were liked less than the rest')
          : t('Requested songs were liked about the same as the rest')
      : null;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
        <HandHeart className="w-5 h-5 text-brass" /> {t('Song request insights')}
      </h2>
      <p className="text-xs text-muted mt-0.5">{t('Requests from the Requests tab, checked against what was actually played.')}</p>

      {ins.total === 0 ? (
        <p className="mt-3 text-sm text-muted">{t('Nobody requested a song for this Sidang.')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label={t('Requests')} value={ins.total} note={t('from {n} people', { n: ins.people })} />
            <Tile
              label={t('Played')}
              value={`${ins.played.length}/${ins.total}`}
              note={ins.playedRate === null ? undefined : t('{pct}% of requests', { pct: Math.round(ins.playedRate * 100) })}
            />
            <Tile label={t('+1 given')} value={ins.totalVotes} note={ins.mostWanted && ins.mostWanted.votes > 0 ? t('most for {title}', { title: ins.mostWanted.title }) : undefined} />
            <Tile
              label={t('Avg. 👍 per song')}
              value={fmtAvg(ins.requestedAvgUp)}
              note={ins.otherAvgUp === null ? t('requested songs') : t('requested · {n} for the rest', { n: fmtAvg(ins.otherAvgUp) })}
            />
          </div>
          {(compare || ins.lateRequests > 0) && (
            <p className="mt-3 text-sm text-muted">
              {[compare, ins.lateRequests > 0 ? t('{n} requested after the Sidang started', { n: ins.lateRequests }) : null].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <RequestList
              title={t('Requested and played ({n})', { n: ins.played.length })}
              rows={ins.played}
              empty={t('None of the requests were played.')}
              render={(o) => (
                <>
                  <span className="text-xs text-muted tabular">
                    {o.partName} · {formatClock(o.playedAt)}
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold tabular">
                    <span className={cx('inline-flex items-center gap-0.5', o.up ? 'text-jade-light' : 'text-faint')}>
                      <ThumbsUp className="w-3.5 h-3.5" /> {o.up}
                    </span>
                    <span className={cx('inline-flex items-center gap-0.5', o.down ? 'text-songket-light' : 'text-faint')}>
                      <ThumbsDown className="w-3.5 h-3.5" /> {o.down}
                    </span>
                  </span>
                </>
              )}
              played
            />
            <RequestList
              title={t('Requested but not played ({n})', { n: ins.notPlayed.length })}
              rows={ins.notPlayed}
              empty={t('Every request was played.')}
              render={(o) => (
                <Badge tone={o.status === 'dismissed' ? 'neutral' : o.status === 'added' ? 'override' : 'brass'}>
                  {o.status === 'dismissed' ? t('Not taken') : o.status === 'added' ? t('Added but not played') : t('Still open')}
                </Badge>
              )}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function RequestList({
  title,
  rows,
  empty,
  render,
  played,
}: {
  title: string;
  rows: RequestOutcome[];
  empty: string;
  render: (o: RequestOutcome) => React.ReactNode;
  played?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-line">
      <div className="px-3.5 py-2 border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((o) => (
            <li key={o.id} className="px-3.5 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                {played && <Check className="w-4 h-4 text-jade-light shrink-0" />}
                <span className="font-semibold flex-1 min-w-0 truncate">{o.title}</span>
                <span className="text-xs font-semibold text-jade-light tabular shrink-0">+{o.votes}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-xs text-muted truncate">
                  {t('by {name}', { name: o.author })}
                  {o.instrument ? ` · ${o.instrument}` : ''}
                </span>
                {render(o)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3.5 py-3 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}
