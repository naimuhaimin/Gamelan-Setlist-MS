'use client';

import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import type { ConvoEvent, Session } from '@/types';
import { Button, EmptyState } from './ui';
import { ConvoCard, SidangCard, eventStatus } from './Cards';
import { ConvoModal } from './ConvoModal';

/** Events still to come or happening now (soonest first), then past ones (latest first). Undated events count as upcoming. */
export function splitEvents(events: ConvoEvent[], sessions: Session[]) {
  const upcoming: ConvoEvent[] = [];
  const past: ConvoEvent[] = [];
  for (const e of events) (eventStatus(e, sessions) === 'past' ? past : upcoming).push(e);
  const key = (e: ConvoEvent) => e.start_date ?? '9999-12-31';
  upcoming.sort((a, b) => key(a).localeCompare(key(b)) || a.sort_order - b.sort_order);
  past.sort((a, b) => key(b).localeCompare(key(a)) || a.sort_order - b.sort_order);
  return { upcoming, past };
}

/** The Events tab: every event, with "New event" for Maestro/Admin. */
export function EventsView() {
  const { events, sessions, isManager, eventsEnabled } = useStage();
  const [creating, setCreating] = useState(false);
  const { t } = useT();
  const { upcoming, past } = useMemo(() => splitEvents(events, sessions), [events, sessions]);

  const grid = (list: ConvoEvent[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((e) => (
        <ConvoCard key={e.id} event={e} />
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-10">
      <div className="pt-8 sm:pt-10 mb-6 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{t('Events')}</h1>
          <p className="text-sm text-muted mt-1">{t('Choose an event to see its Sidang and setlists.')}</p>
        </div>
        {isManager && eventsEnabled && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> {t('New event')}
          </Button>
        )}
      </div>

      {eventsEnabled ? (
        events.length ? (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold mb-3">{t('On now & coming up')}</h2>
                {grid(upcoming)}
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold mb-3 text-muted">{t('Past events')}</h2>
                {grid(past)}
              </section>
            )}
          </div>
        ) : (
          <EmptyState title={t('No events yet')}>{isManager ? t('Create the first one with “New event”.') : t('Check back soon.')}</EmptyState>
        )
      ) : (
        // Database not migrated yet: show Sidang directly
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <SidangCard key={s.id} session={s} />
          ))}
        </div>
      )}

      <ConvoModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
