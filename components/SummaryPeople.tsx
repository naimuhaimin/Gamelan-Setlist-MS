'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Smartphone, Users } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/useAttendance';
import * as api from '@/lib/supabaseService';
import { formatClock } from '@/lib/summary';
import { ROLE_LABEL } from './SettingsView';
import { Card, cx } from './ui';

const PING_GAP_MS = 90_000; // a phone counts as "on" until 90 s after its last check-in (it checks in every 60 s)

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

/** Summary section: people who used the app while the Sidang was live, and who registered to play. */
export function SummaryPeople({ sessionId }: { sessionId: string }) {
  const { roomState, instruments } = useStage();
  const { t } = useT();
  const att = useAttendance(sessionId);
  const [viewers, setViewers] = useState<api.ViewerRow[] | null | undefined>(undefined);

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

  const regRows = useMemo(() => {
    const names = [...instruments];
    for (const e of att.entries) if (!names.includes(e.instrument)) names.push(e.instrument);
    return names
      .map((name) => {
        const people = att.entries.filter((e) => e.instrument === name).map((e) => e.name);
        const min = att.needs[name] ?? 0;
        return { name, people, lacking: Math.max(0, min - people.length) };
      })
      .filter((r) => r.people.length > 0 || r.lacking > 0);
  }, [instruments, att.entries, att.needs]);

  const showUsage = viewers !== null && viewers !== undefined;
  const showAttendance = att.available === true;
  if (!showUsage && !showAttendance) return null;

  const instrumentMax = usage ? Math.max(1, ...usage.byInstrument.values()) : 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t('In total')}</div>
                  <div className="font-display text-3xl font-bold tabular">{usage.total}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t('Most at once')}</div>
                  <div className="font-display text-3xl font-bold tabular">{usage.peak}</div>
                  {usage.at && <div className="text-xs text-muted tabular">{t('around {time}', { time: formatClock(usage.at) })}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {[...usage.byRole.entries()].map(([role, n]) => (
                  <span key={role} className="h-7 px-2.5 rounded-full bg-raised border border-line inline-flex items-center gap-1">
                    {t((ROLE_LABEL as Record<string, string>)[role] ?? role)} <b className="tabular">{n}</b>
                  </span>
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
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
            </>
          )}
        </Card>
      )}

      {/* Registered attendance */}
      {showAttendance && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <Users className="w-5 h-5 text-brass" /> {t('Registered players')}
          </h2>
          <p className="text-xs text-muted mt-0.5">{t('From the Attendance tab.')}</p>
          <div className="mt-3 font-display text-3xl font-bold tabular">{att.entries.length}</div>
          {regRows.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t('Nobody registered for this Sidang.')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {regRows.map((r) => (
                <li key={r.name} className="py-2 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold flex-1 min-w-0 truncate">{r.name}</span>
                    {r.lacking > 0 && (
                      <span className="text-xs font-semibold text-songket-light inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t('Lacking {n}', { n: r.lacking })}
                      </span>
                    )}
                    <span className={cx('font-bold tabular w-6 text-right', r.lacking ? 'text-songket-light' : 'text-ink')}>{r.people.length}</span>
                  </div>
                  {r.people.length > 0 && <div className="text-xs text-muted break-words">{r.people.join(', ')}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
