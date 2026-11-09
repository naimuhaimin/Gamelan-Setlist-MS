'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { plural, useT } from '@/lib/i18n';
import { LiveDot, Modal, cx } from './ui';

/** Quick "what is live" switcher for Controller, Maestro and Admin. */
export function LivePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sessions, parts, events, roomState, resolveQueue, goLive, isFinished } = useStage();
  const eventName = (id: string | null) => events.find((e) => e.id === id)?.name;
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const { t } = useT();

  useEffect(() => {
    if (open) setSessionId(roomState.session_id ?? sessions[0]?.id);
  }, [open, roomState.session_id, sessions]);

  const sessionParts = useMemo(
    () => parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number),
    [parts, sessionId]
  );

  return (
    <Modal open={open} onClose={onClose} title={t('Change what’s live')} description={t('Every screen switches immediately.')} size="sm">
      {sessions.length ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="live-sidang" className="block text-sm text-muted mb-1.5">
              Sidang
            </label>
            <select
              id="live-sidang"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full h-12 rounded-xl bg-bg border border-line px-3 text-base font-semibold focus:outline-none focus:border-brass/70"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {eventName(s.event_id) ? `${eventName(s.event_id)} · ` : ''}
                  {s.name}
                  {s.id === roomState.session_id ? ` — ${t('live')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {sessionParts.map((p) => {
              const count = resolveQueue(p.id).length;
              const live = roomState.part_id === p.id && !isFinished;
              return (
                <button
                  key={p.id}
                  disabled={!count || live}
                  onClick={async () => {
                    await goLive(p.id);
                    onClose();
                  }}
                  className={cx(
                    'rounded-xl border px-4 py-3.5 text-left transition-colors',
                    live ? 'border-songket/60 bg-songket-soft' : 'border-line bg-raised hover:border-brass/60',
                    !count && 'opacity-40'
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {p.name}
                    {live && <LiveDot className="ml-auto" />}
                  </div>
                  <div className="text-xs text-muted tabular mt-0.5">
                    {live ? t('Live now') : count ? `${plural(count, '{n} song', '{n} songs')} · ${t('tap to go live')}` : t('No songs')}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">{t('Going live starts the Bahagian from its first song.')}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('There are no Sidang yet. A Maestro creates them on the event page.')}</p>
      )}
    </Modal>
  );
}
