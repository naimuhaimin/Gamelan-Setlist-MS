'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import logoMark from '@/assets/logo-mark.png';
import { Button, EmptyState } from './ui';
import { ConvoCard, LiveNowCard, SidangCard } from './Cards';
import { ConvoModal } from './ConvoModal';
import { splitEvents } from './EventsView';

export function HomeView() {
  const { events, sessions, isManager, eventsEnabled } = useStage();
  const [creating, setCreating] = useState(false);
  const { t } = useT();
  const soon = useMemo(() => splitEvents(events, sessions).upcoming.slice(0, 3), [events, sessions]);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-10">
      {/* Hero */}
      <section className="pt-8 sm:pt-12 pb-6 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoMark.src} alt="Anjung Seni" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ring-1 ring-brass/30 shrink-0" />
        <div className="min-w-0">
          <h1 className="leading-none">
            <span className="font-script text-5xl sm:text-6xl text-ink">Anjung</span>{' '}
            <span className="font-display text-lg sm:text-xl font-semibold tracking-[0.3em] text-brass align-middle">LIVE</span>
          </h1>
          <p className="text-muted mt-2">{t('Live setlist & cues for Gamelan Anjung Seni · Pusat Kebudayaan')}</p>
        </div>
      </section>

      <LiveNowCard />

      {/* Events (Konvokesyen and any other performance) */}
      <section className="mt-10">
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">{t('On now & coming up')}</h2>
            <Link href="/events" className="text-sm text-brass hover:underline inline-flex items-center gap-0.5">
              {t('See all events')} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {isManager && eventsEnabled && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> {t('New event')}
            </Button>
          )}
        </div>

        {eventsEnabled ? (
          soon.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {soon.map((e) => (
                <ConvoCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <EmptyState title={events.length ? t('Nothing coming up') : t('No events yet')}>
              {events.length ? (
                <Link href="/events" className="text-brass underline">
                  {t('See past events')}
                </Link>
              ) : isManager ? (
                t('Create the first one with “New event”.')
              ) : (
                t('Check back soon.')
              )}
            </EmptyState>
          )
        ) : (
          // Database not migrated yet: show Sidang directly
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <SidangCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>

      <ConvoModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
