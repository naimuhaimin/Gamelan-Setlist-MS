'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Pencil, Plus } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { Button, EmptyState } from './ui';
import { ConvoThumb, SidangCard, formatDate } from './Cards';
import { ConvoModal } from './ConvoModal';
import { SidangModal } from './SidangModal';

export function ConvoView({ eventId }: { eventId: string }) {
  const { events, sessions, isManager } = useStage();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [creatingSidang, setCreatingSidang] = useState(false);
  const event = events.find((e) => e.id === eventId);
  const list = sessions.filter((s) => s.event_id === eventId).sort((a, b) => a.sidang_number - b.sidang_number);

  if (!event)
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <EmptyState title="Event not found" action={<Link href="/" className="text-brass underline">Back to home</Link>}>
          It may have been deleted.
        </EmptyState>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink pt-4">
        <ChevronLeft className="w-4 h-4" /> Home
      </Link>

      {/* Banner */}
      <div className="mt-3 relative rounded-2xl overflow-hidden border border-line">
        <ConvoThumb event={event} className="aspect-[16/7] sm:aspect-[16/5]" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl sm:text-5xl font-bold leading-tight">{event.name}</h1>
            <p className="text-sm sm:text-base text-muted mt-1 flex flex-wrap items-center gap-x-3">
              {event.start_date && <span>{formatDate(event.start_date)}</span>}
              {event.venue && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {event.venue}
                </span>
              )}
            </p>
          </div>
          {isManager && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
        </div>
      </div>

      <section className="mt-6">
        <div className="flex items-end gap-3 mb-3">
          <h2 className="font-display text-2xl font-bold flex-1">Sidang</h2>
          {isManager && (
            <Button variant="primary" onClick={() => setCreatingSidang(true)}>
              <Plus className="w-4 h-4" /> New Sidang
            </Button>
          )}
        </div>
        {list.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((s) => (
              <SidangCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          <EmptyState title="No Sidang yet">
            {isManager ? 'Create one with “New Sidang”. Bahagian 1–4 are added automatically.' : 'Check back soon.'}
          </EmptyState>
        )}
      </section>

      <ConvoModal open={editing} event={event} onClose={() => setEditing(false)} onDeleted={() => router.push('/')} />
      <SidangModal
        mode="create"
        open={creatingSidang}
        eventId={eventId}
        onClose={() => setCreatingSidang(false)}
        onSaved={(s) => router.push(`/sidang/${encodeURIComponent(s.id)}?view=edit`)}
      />
    </div>
  );
}
