'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Coffee, Pause, Share2 } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { ConvoEvent, Session } from '@/types';
import logoMark from '@/assets/logo-mark.png';
import { useShell } from './AppShell';
import { Badge, BreakIcon, Card, LiveDot, cx } from './ui';

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const sidangUrl = (id: string, view?: 'live' | 'list') =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/sidang/${encodeURIComponent(id)}${view ? `?view=${view}` : ''}`;

/** Konvo thumbnail, or a logo pattern when there is no photo. */
export function ConvoThumb({ event, className }: { event: ConvoEvent; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden bg-raised', className)}>
      {event.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-bronze/60 via-surface to-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoMark.src} alt="" className="w-16 h-16 rounded-2xl opacity-80 ring-1 ring-brass/30" />
        </div>
      )}
    </div>
  );
}

export function ConvoCard({ event }: { event: ConvoEvent }) {
  const { sessions, liveSession, stageLive } = useStage();
  const count = sessions.filter((s) => s.event_id === event.id).length;
  const live = liveSession?.event_id === event.id && stageLive;
  return (
    <Link href={`/konvo/${encodeURIComponent(event.id)}`} className="group block min-w-0">
      <Card className={cx('overflow-hidden transition-colors group-hover:border-line-strong', live && 'border-songket/60')}>
        <ConvoThumb event={event} className="aspect-[16/9]" />
        <div className="p-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-display text-lg font-bold truncate min-w-0">{event.name}</h3>
              {live && (
                <Badge tone="live">
                  <LiveDot /> Live
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted truncate">
              {[formatDate(event.start_date), event.venue].filter(Boolean).join(' · ') || ' '}
            </p>
            <p className="text-xs text-faint mt-1 tabular">
              {count} Sidang
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-faint group-hover:text-brass mt-1 shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

export function SidangCard({ session }: { session: Session }) {
  const { parts, resolveQueue, liveSession, livePart, roomState, isFinished, stageLive } = useStage();
  const { openShare } = useShell();
  const myParts = parts.filter((p) => p.session_id === session.id);
  const songCount = myParts.reduce((n, p) => n + resolveQueue(p.id).filter((r) => !r.isBreak).length, 0);
  const live = liveSession?.id === session.id && stageLive;
  return (
    <Card className={cx('flex items-stretch overflow-hidden min-w-0', live && 'border-songket/60')}>
      <Link href={`/sidang/${encodeURIComponent(session.id)}`} className="flex-1 min-w-0 p-4 hover:bg-raised/50 transition-colors">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <h3 className="font-display text-lg font-bold truncate min-w-0 max-w-full">{session.name}</h3>
          {live && (
            <Badge tone="live">
              <LiveDot /> {isFinished ? `Intermission after ${livePart?.name}` : `${roomState.is_paused ? 'On hold' : 'Live'} · ${livePart?.name}`}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
          <CalendarDays className="w-3.5 h-3.5" /> {formatDate(session.date) || 'No date'}
          <span className="text-faint">·</span>
          <span className="tabular">{songCount} songs</span>
        </p>
      </Link>
      <button
        onClick={() => openShare({ url: sidangUrl(session.id), title: `Share ${session.name}` })}
        className="px-4 border-l border-line text-muted hover:text-brass hover:bg-raised/50"
        aria-label={`Share link to ${session.name}`}
        title="Share link"
      >
        <Share2 className="w-5 h-5" />
      </button>
    </Card>
  );
}

/** "Live now" summary for the home page. */
export function LiveNowCard() {
  const { liveSession, livePart, liveEvent, activeItem, liveQueue, activeIndex, isFinished, roomState, liveInterlude, nextPart, interludeDone, interludeTracking } =
    useStage();
  if (liveSession && livePart && liveInterlude && nextPart) {
    const ready = interludeDone >= liveInterlude.songs;
    return (
      <Card className="overflow-hidden border-brass/50">
        <div className="p-5 sm:p-6 border-t-[3px] border-t-brass">
          <div className="flex items-center gap-2 text-sm font-semibold text-brass">
            <Coffee className="w-4 h-4" /> INTERMISSION
            {liveEvent && <span className="text-muted font-normal">· {liveEvent.name}</span>}
          </div>
          <div className="mt-1 text-muted">
            {liveSession.name} · after {livePart.name}
          </div>
          <div className="mt-2 font-display text-3xl sm:text-4xl font-bold leading-tight break-words">{liveInterlude.label}</div>
          <div className="mt-1 text-sm text-muted tabular">
            {interludeTracking
              ? ready
                ? `All ${liveInterlude.songs} songs done · ${nextPart.name} is next`
                : `Song ${interludeDone + 1} of ${liveInterlude.songs} · then ${nextPart.name}`
              : `${liveInterlude.songs} ${liveInterlude.songs === 1 ? 'song' : 'songs'} · then ${nextPart.name}`}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/live"
              className="h-11 px-5 rounded-xl bg-brass text-brass-ink font-semibold inline-flex items-center gap-2 hover:bg-brass-strong"
            >
              Open live view <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/sidang/${encodeURIComponent(liveSession.id)}?view=list`}
              className="h-11 px-5 rounded-xl bg-raised border border-line font-medium inline-flex items-center gap-2 hover:border-line-strong"
            >
              Full Sidang list
            </Link>
          </div>
        </div>
      </Card>
    );
  }
  if (!liveSession || !livePart || isFinished)
    return (
      <Card className="p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-raised grid place-items-center text-faint">
          <Pause className="w-6 h-6" />
        </div>
        <div>
          <div className="font-semibold">Nothing is live right now</div>
          <div className="text-sm text-muted">
            {isFinished && liveSession && livePart
              ? `${liveSession.name} · ${livePart.name} has ended. The next Bahagian will appear here when it goes live.`
              : 'The stage will appear here as soon as a Bahagian goes live.'}
          </div>
        </div>
      </Card>
    );

  const status = roomState.is_paused ? 'On hold' : 'Live now';
  const next = liveQueue[activeIndex + 1];
  return (
    <Card className="overflow-hidden border-songket/50">
      <div className="p-5 sm:p-6 border-t-[3px] border-t-songket">
        <div className="flex items-center gap-2 text-sm font-semibold text-songket-light">
          <LiveDot /> {status.toUpperCase()}
          {liveEvent && <span className="text-muted font-normal">· {liveEvent.name}</span>}
        </div>
        <div className="mt-1 text-muted">
          {liveSession.name} · {livePart.name}
        </div>
        <div className="mt-2 font-display text-3xl sm:text-4xl font-bold leading-tight">
          {activeItem ? (
            <span className="inline-flex items-center gap-3">
              {activeItem.isBreak && <BreakIcon className="w-8 h-8 text-stop-light" />}
              {activeItem.song.title}
            </span>
          ) : (
            'No songs yet'
          )}
        </div>
        {next && <div className="mt-1 text-sm text-muted">Next: {next.song.title}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/live"
            className="h-11 px-5 rounded-xl bg-brass text-brass-ink font-semibold inline-flex items-center gap-2 hover:bg-brass-strong"
          >
            Open live view <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/sidang/${encodeURIComponent(liveSession.id)}?view=list`}
            className="h-11 px-5 rounded-xl bg-raised border border-line font-medium inline-flex items-center gap-2 hover:border-line-strong"
          >
            Full Sidang list
          </Link>
        </div>
      </div>
    </Card>
  );
}
