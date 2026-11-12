'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Smartphone } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/useAttendance';
import * as api from '@/lib/supabaseService';
import { formatClock } from '@/lib/summary';
import { ROLE_LABEL } from './SettingsView';
import { Card, cx } from './ui';

const PING_GAP_MS = 90_000; // a phone counts as "on" until 90 s after its last check-in (it checks in every 60 s)
const LAST_MINUTE_MS = 30 * 60_000;

/** Most phones that had the app open at the same moment, from their first/last check-in times. */
function peakAtOnce(rows: api.ViewerRow[]): { peak: number; at: string | null } {
  const events: Array<[number, number]> = [];
  for (const r of rows) {
    events.push([Date.parse(r.first_seen), 1]);
    events.push([Date.parse(r.last_seen) + PING_GAP_MS, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let peak = 0;
  let at: number | null = null;
  for (const [time, d] of events) {
    now += d;
    if (now > peak) {
      peak = now;
      at = time;
    }
  }
  return { peak, at: at === null ? null : new Date(at).toISOString() };
}

/** Summary section: app users while live, and attendance insights. */
export function SummaryPeople({
  sessionId,
  startedAt,
  only,
}: {
  sessionId: string;
  startedAt: string | null;
  /** Show just one of the two cards (the Summary puts App users at the very top). */
  only?: 'usage' | 'attendance';
}) {
  const { roomState, instruments, sessions } = useStage();
  const { t } = useT();
  const att = useAttendance(sessionId, sessions.find((s) => s.id === sessionId)?.event_id ?? null);
  const [viewers, setViewers] = useState<api.ViewerRow[] | null | undefined>(undefined);
  const [eventCounts, setEventCounts] = useState<Record<string, number> | null>(null);

  // Refresh with the stage, so it fills in while the Sidang is running
  useEffect(() => {
    let alive = true;
    api
      .fetchViewers(sessionId)
      .then((v) => alive && setViewers(v))
      .catch(() => alive && setViewers(null));
    return () => {
      alive = false;
    };
  }, [sessionId, roomState.current_queue_item_id, roomState.part_id, roomState.is_finished]);

  // Other Sidang in the same event, for comparison
  const session = sessions.find((s) => s.id === sessionId);
  const siblings = useMemo(
    () => (session?.event_id ? sessions.filter((s) => s.event_id === session.event_id).map((s) => s.id) : []),
    [sessions, session?.event_id]
  );
  useEffect(() => {
    if (siblings.length < 2) return;
    api.fetchAttendanceCounts(siblings).then(setEventCounts).catch(() => undefined);
  }, [siblings, att.entries.length]);

  const usage = useMemo(() => {
    if (!viewers) return null;
    const byRole = new Map<string, number>();
    const byInstrument = new Map<string, number>();
    for (const v of viewers) {
      byRole.set(v.role, (byRole.get(v.role) ?? 0) + 1);
      const key = v.instrument || '';
      byInstrument.set(key, (byInstrument.get(key) ?? 0) + 1);
    }
    return { total: viewers.length, ...peakAtOnce(viewers), byRole, byInstrument };
  }, [viewers]);

  const insight = useMemo(() => {
    const seen = new Set((viewers ?? []).map((v) => v.device_id));
    const registeredDevices = new Set(att.entries.map((e) => e.device_id));
    const wasLive = (viewers?.length ?? 0) > 0;

    const names = [...instruments];
    for (const e of att.entries) if (!names.includes(e.instrument)) names.push(e.instrument);
    const rows = names
      .map((name) => {
        const people = att.entries.filter((e) => e.instrument === name);
        const min = att.needs[name] ?? 0;
        return {
          name,
          people,
          min,
          seen: people.filter((p) => seen.has(p.device_id)).length,
          lacking: Math.max(0, min - people.length),
        };
      })
      .filter((r) => r.people.length > 0 || r.min > 0);

    const withMin = rows.filter((r) => r.min > 0);
    const notSeen = wasLive ? att.entries.filter((e) => !seen.has(e.device_id)) : [];
    const unregistered = (viewers ?? []).filter((v) => v.role === 'player' && v.instrument && !registeredDevices.has(v.device_id));
    const unregByInstrument = new Map<string, number>();
    for (const v of unregistered) unregByInstrument.set(v.instrument!, (unregByInstrument.get(v.instrument!) ?? 0) + 1);

    // Timing, measured against when the Sidang actually started
    let timing: { early: number; lastMinute: number; late: number } | null = null;
    if (startedAt && att.entries.length) {
      const start = Date.parse(startedAt);
      timing = { early: 0, lastMinute: 0, late: 0 };
      for (const e of att.entries) {
        const at = Date.parse(e.created_at);
        if (at > start) timing.late++;
        else if (start - at <= LAST_MINUTE_MS) timing.lastMinute++;
        else timing.early++;
      }
    }
    const times = att.entries.map((e) => e.created_at).sort();

    // Compared with the other Sidang of the event that have registrations
    let avg: number | null = null;
    if (eventCounts) {
      const others = siblings.filter((id) => id !== sessionId).map((id) => eventCounts[id] ?? 0).filter((n) => n > 0);
      if (others.length) avg = others.reduce((a, b) => a + b, 0) / others.length;
    }

    return {
      rows,
      wasLive,
      seenCount: att.entries.filter((e) => seen.has(e.device_id)).length,
      minsMet: withMin.filter((r) => r.lacking === 0).length,
      minsSet: withMin.length,
      notSeen,
      unregistered: unregistered.length,
      unregByInstrument,
      timing,
      first: times[0] ?? null,
      last: times[times.length - 1] ?? null,
      avg,
    };
  }, [viewers, att.entries, att.needs, instruments, startedAt, eventCounts, siblings, sessionId]);

  const showUsage = only !== 'attendance' && viewers !== null && viewers !== undefined;
  const showAttendance = only !== 'usage' && att.available === true;
  if (!showUsage && !showAttendance) return null;

  const instrumentMax = usage ? Math.max(1, ...usage.byInstrument.values()) : 1;
  const total = att.entries.length;
  const diff = insight.avg === null ? null : total - insight.avg;

  return (
    <div className="space-y-4">
      {/* App users while live */}
      {showUsage && usage && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brass" /> {t('App users')}
          </h2>
          <p className="text-xs text-muted mt-0.5">{t('Phones that had the app open while this Sidang was live.')}</p>
          {usage.total === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('Nobody yet. This fills in while the Sidang is live.')}</p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <Tile label={t('In total')} value={usage.total} />
                  <Tile label={t('Most at once')} value={usage.peak} note={usage.at ? t('around {time}', { time: formatClock(usage.at) }) : undefined} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {[...usage.byRole.entries()].map(([role, n]) => (
                    <span key={role} className="h-7 px-2.5 rounded-full bg-raised border border-line inline-flex items-center gap-1">
                      {t((ROLE_LABEL as Record<string, string>)[role] ?? role)} <b className="tabular">{n}</b>
                    </span>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5">
                {[...usage.byInstrument.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([inst, n]) => (
                    <li key={inst || '-'} className="grid grid-cols-[6rem_minmax(0,1fr)_1.75rem] items-center gap-2 text-sm">
                      <span className={cx('truncate', !inst && 'text-muted italic')}>{inst || t('No instrument')}</span>
                      <span className="h-2.5">
                        <span className="block h-full rounded-r-[4px] bg-chart-song" style={{ width: `${(n / instrumentMax) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Attendance insights */}
      {showAttendance && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brass" /> {t('Attendance insights')}
          </h2>
          <p className="text-xs text-muted mt-0.5">{t('Registrations from the Attendance tab, checked against who had the app open while live.')}</p>

          {total === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('Nobody registered for this Sidang.')}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Tile label={t('Registered')} value={total} />
                <Tile
                  label={t('Seen live')}
                  value={insight.wasLive ? `${insight.seenCount}/${total}` : '–'}
                  note={insight.wasLive ? t('{pct}% opened the app', { pct: Math.round((insight.seenCount / total) * 100) }) : t('Not live yet')}
                />
                <Tile
                  label={t('Minimums met')}
                  value={insight.minsSet ? `${insight.minsMet}/${insight.minsSet}` : '–'}
                  note={insight.minsSet ? t('instruments') : t('No minimums set')}
                  warn={insight.minsSet > 0 && insight.minsMet < insight.minsSet}
                />
                <Tile
                  label={t('Vs. this event')}
                  value={insight.avg === null ? '–' : diff! > 0.5 ? `+${Math.round(diff!)}` : diff! < -0.5 ? `${Math.round(diff!)}` : '≈'}
                  note={insight.avg === null ? t('No other Sidang yet') : t('average {n} per Sidang', { n: Math.round(insight.avg * 10) / 10 })}
                />
              </div>

              {/* When people registered */}
              <div className="mt-4 rounded-xl border border-line px-3.5 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{t('When people registered')}</div>
                {insight.timing ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 tabular">
                    <span>
                      <b>{insight.timing.early}</b> <span className="text-muted">{t('early')}</span>
                    </span>
                    <span>
                      <b>{insight.timing.lastMinute}</b> <span className="text-muted">{t('in the last 30 min')}</span>
                    </span>
                    <span className={cx(insight.timing.late > 0 && 'text-songket-light')}>
                      <b>{insight.timing.late}</b> <span className={insight.timing.late ? '' : 'text-muted'}>{t('after it started')}</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-muted tabular">
                    {t('First {first} · latest {last}', { first: formatClock(insight.first), last: formatClock(insight.last) })}
                  </div>
                )}
              </div>

              {/* Things to follow up */}
              {(insight.notSeen.length > 0 || insight.unregistered > 0 || insight.rows.some((r) => r.lacking > 0)) && (
                <div className="mt-3 space-y-2">
                  {insight.rows.some((r) => r.lacking > 0) && (
                    <Callout tone="warn" title={t('Below the minimum')}>
                      {insight.rows
                        .filter((r) => r.lacking > 0)
                        .map((r) => t('{instrument} (lacking {n})', { instrument: r.name, n: r.lacking }))
                        .join(' · ')}
                    </Callout>
                  )}
                  {insight.notSeen.length > 0 && (
                    <Callout title={t('Registered but not seen in the app while live ({n})', { n: insight.notSeen.length })}>
                      {insight.notSeen.map((e) => `${e.name} (${e.instrument})`).join(', ')}
                      <span className="block text-xs text-faint mt-0.5">{t('They may have played without opening the app.')}</span>
                    </Callout>
                  )}
                  {insight.unregistered > 0 && (
                    <Callout title={t('Used the app but didn’t register ({n})', { n: insight.unregistered })}>
                      {[...insight.unregByInstrument.entries()].map(([i, n]) => `${i} ${n}`).join(' · ')}
                    </Callout>
                  )}
                </div>
              )}

              {/* By instrument */}
              <div className="mt-4">
                <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>{t('Instrument')}</span>
                  <span className="text-right">{t('Reg.')}</span>
                  <span className="text-right">{t('Min.')}</span>
                  <span className="text-right">{t('Live')}</span>
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {insight.rows.map((r) => (
                    <li key={r.name} className="px-1 py-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem] gap-2 items-baseline text-sm tabular">
                        <span className="font-semibold truncate">{r.name}</span>
                        <span className={cx('text-right font-bold', r.lacking ? 'text-songket-light' : 'text-ink')}>{r.people.length}</span>
                        <span className="text-right text-muted">{r.min || '–'}</span>
                        <span className="text-right text-muted">{insight.wasLive ? r.seen : '–'}</span>
                      </div>
                      {r.people.length > 0 && <div className="text-xs text-muted break-words">{r.people.map((p) => p.name).join(', ')}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, note, warn }: { label: string; value: React.ReactNode; note?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-raised/50 border border-line px-3 py-2.5 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">{label}</div>
      <div className={cx('font-display text-2xl font-bold tabular leading-tight', warn && 'text-songket-light')}>{value}</div>
      {note && <div className="text-[11px] text-muted leading-snug">{note}</div>}
    </div>
  );
}

function Callout({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className={cx('rounded-xl border px-3.5 py-2.5 text-sm', tone === 'warn' ? 'border-songket/50 bg-songket-soft' : 'border-line bg-raised/40')}>
      <div className={cx('font-semibold inline-flex items-center gap-1.5', tone === 'warn' && 'text-songket-light')}>
        {tone === 'warn' && <AlertTriangle className="w-4 h-4" />} {title}
      </div>
      <div className="mt-0.5 break-words">{children}</div>
    </div>
  );
}
