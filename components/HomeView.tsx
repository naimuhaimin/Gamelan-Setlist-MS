'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import logoMark from '@/assets/logo-mark.png';
import { Button, EmptyState } from './ui';
import { ConvoCard, LiveNowCard, SidangCard } from './Cards';
import { ConvoModal } from './ConvoModal';

export function HomeView() {
  const { events, sessions, isManager, eventsEnabled } = useStage();
  const [creating, setCreating] = useState(false);

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
          <p className="text-muted mt-2">Live setlist & cues for Gamelan Anjung Seni · Pusat Kebudayaan</p>
        </div>
      </section>

      <LiveNowCard />

      {/* Events (Konvokesyen and any other performance) */}
      <section className="mt-10">
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">Events</h2>
            <p className="text-sm text-muted">Choose an event to see its Sidang and setlists.</p>
          </div>
          {isManager && eventsEnabled && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> New event
            </Button>
          )}
        </div>

        {eventsEnabled ? (
          events.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <ConvoCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <EmptyState title="No events yet">{isManager ? 'Create the first one with “New event”.' : 'Check back soon.'}</EmptyState>
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
