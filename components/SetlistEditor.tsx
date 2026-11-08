'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Plus,
  Radio,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { ResolvedQueueItem } from '@/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, LiveDot, Rhythms, Toggle, cx } from './ui';
import { OverrideModal } from './OverrideModal';
import { formatIntro } from '@/lib/format';
import type { IntroUnit } from '@/types';
import { SidangModal } from './SidangModal';

export function SetlistEditor({ onShowStage }: { onShowStage: () => void }) {
  const {
    sessions,
    parts,
    songs,
    roomState,
    liveQueue,
    activeIndex,
    resolveQueue,
    goLive,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    editPart,
  } = useStage();

  const [sessionId, setSessionId] = useState<string | undefined>(roomState.session_id ?? sessions[0]?.id);
  const [partNumber, setPartNumber] = useState<number>(() => parts.find((p) => p.id === roomState.part_id)?.part_number ?? 1);
  const [sidangModal, setSidangModal] = useState<'create' | 'edit' | null>(null);
  const [overrideItem, setOverrideItem] = useState<ResolvedQueueItem | null>(null);
  const [toRemove, setToRemove] = useState<ResolvedQueueItem | null>(null);

  // Keep the selection valid as Sidang are added/removed
  useEffect(() => {
    if (!sessions.some((s) => s.id === sessionId)) setSessionId(roomState.session_id ?? sessions[0]?.id);
  }, [sessions, sessionId, roomState.session_id]);

  const session = sessions.find((s) => s.id === sessionId);
  const sessionParts = useMemo(
    () => parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number),
    [parts, sessionId]
  );
  const part = sessionParts.find((p) => p.part_number === partNumber) ?? sessionParts[0];
  const queue = part ? resolveQueue(part.id) : [];
  const isLive = !!part && roomState.part_id === part.id;
  const liveCurrentId = isLive && activeIndex >= 0 ? liveQueue[activeIndex]?.queueItem.id : null;

  if (!sessions.length) {
    return (
      <Page>
        <Card className="mt-6">
          <EmptyState
            icon={<CalendarDays className="w-10 h-10" />}
            title="No Sidang yet"
            action={
              <Button variant="primary" onClick={() => setSidangModal('create')}>
                <Plus className="w-4 h-4" /> Create the first Sidang
              </Button>
            }
          >
            Each Sidang gets Bahagian 1–4 automatically. Then add songs to each Bahagian.
          </EmptyState>
        </Card>
        <SidangModal mode="create" open={sidangModal === 'create'} onClose={() => setSidangModal(null)} onSaved={(s) => setSessionId(s.id)} />
      </Page>
    );
  }

  return (
    <Page>
      {/* Sidang bar */}
      <div className="pt-4 sm:pt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="sidang" className="block text-sm text-muted mb-1.5">
            Sidang
          </label>
          <div className="flex items-center gap-2">
            <select
              id="sidang"
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setPartNumber(1);
              }}
              className="h-11 min-w-0 flex-1 sm:flex-none sm:w-72 rounded-xl bg-surface border border-line px-3 text-base font-semibold focus:outline-none focus:border-brass/70"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.id === roomState.session_id ? ' — live' : ''}
                </option>
              ))}
            </select>
            <IconButton label="Sidang settings" variant="secondary" onClick={() => setSidangModal('edit')}>
              <Settings2 className="w-5 h-5" />
            </IconButton>
          </div>
        </div>
        <Button onClick={() => setSidangModal('create')}>
          <Plus className="w-4 h-4" /> New Sidang
        </Button>
      </div>
      {session?.date && (
        <p className="text-sm text-muted mt-2">
          {new Date(session.date + 'T00:00').toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {/* Bahagian tabs */}
      <div className="mt-4 grid grid-cols-4 gap-2" role="tablist" aria-label="Bahagian">
        {sessionParts.map((p) => {
          const count = resolveQueue(p.id).length;
          const selected = p.id === part?.id;
          const live = roomState.part_id === p.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={selected}
              aria-label={`Bahagian ${p.part_number}, ${count} ${count === 1 ? 'song' : 'songs'}${live ? ', live' : ''}`}
              onClick={() => setPartNumber(p.part_number)}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                selected ? 'border-brass/60 bg-brass-soft' : 'border-line bg-surface hover:border-line-strong'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cx('font-semibold', selected ? 'text-brass' : 'text-ink')}>
                  <span className="sm:hidden">B{p.part_number}</span>
                  <span className="hidden sm:inline">Bahagian {p.part_number}</span>
                </span>
                {live && <LiveDot className="ml-auto" />}
              </div>
              <div className="text-xs text-muted tabular">
                {count} {count === 1 ? 'song' : 'songs'}
              </div>
            </button>
          );
        })}
      </div>

      {part && (
        <div className="mt-4 grid gap-4 lg:grid-cols-12 items-start">
          {/* Queue */}
          <Card className="lg:col-span-7 xl:col-span-8">
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-line">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{part.name}</h2>
                <p className="text-sm text-muted">Set the order. Adjust a song only for this ceremony with ⚙.</p>
              </div>
              <div className="ml-auto">
                {isLive ? (
                  <Button variant="secondary" onClick={onShowStage}>
                    <LiveDot /> Live now — view stage
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => goLive(part.id)} disabled={!queue.length}>
                    <Radio className="w-4 h-4" /> Go live
                  </Button>
                )}
              </div>
            </div>

            {queue.length ? (
              <ol className="divide-y divide-line">
                {queue.map((r, i) => (
                  <li
                    key={r.queueItem.id}
                    className={cx('flex items-center gap-3 px-3 sm:px-4 py-3', r.queueItem.id === liveCurrentId && 'bg-red-500/[0.06]')}
                  >
                    <span className="w-7 text-center text-sm font-semibold text-muted tabular shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{r.song.title}</span>
                        {r.queueItem.id === liveCurrentId && <Badge tone="live">Playing</Badge>}
                        {r.hasOverride && <Badge tone="override">Adjusted</Badge>}
                      </div>
                      <div className="text-xs text-muted truncate tabular">
                        {formatIntro(r.introBarCount, r.introUnit)} · {r.loopCount}× · {r.introInstruments.join(', ') || 'no intro instrument'}
                      </div>
                      {r.song.rhythms.length > 0 && <Rhythms rhythms={r.song.rhythms} className="mt-1" />}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <IconButton label="Move up" size="sm" onClick={() => moveQueueItem(part.id, i, i - 1)} disabled={i === 0}>
                        <ArrowUp className="w-4 h-4" />
                      </IconButton>
                      <IconButton label="Move down" size="sm" onClick={() => moveQueueItem(part.id, i, i + 1)} disabled={i === queue.length - 1}>
                        <ArrowDown className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        label="Adjust for this ceremony"
                        size="sm"
                        onClick={() => setOverrideItem(r)}
                        className={r.hasOverride ? 'text-violet-300' : undefined}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </IconButton>
                      <IconButton label="Remove from setlist" size="sm" onClick={() => setToRemove(r)} className="hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No songs in this Bahagian">Add songs from the library on the right.</EmptyState>
            )}
          </Card>

          {/* Side */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
            <AddSongs
              key={part.id}
              songs={songs}
              countInPart={(songId) => queue.filter((r) => r.song.id === songId).length}
              onAdd={(songId) => addToQueue(part.id, songId)}
            />
            <ControllerCard
              key={`ctrl-${part.id}`}
              partName={part.name}
              enabled={part.controller_enabled}
              onToggle={(v) => editPart(part.id, { controller_enabled: v })}
            />
          </div>
        </div>
      )}

      <OverrideModal item={overrideItem} onClose={() => setOverrideItem(null)} />
      <ConfirmDialog
        open={!!toRemove}
        title="Remove from setlist?"
        confirmLabel="Remove"
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) removeFromQueue(toRemove.queueItem.id);
          setToRemove(null);
        }}
      >
        <p>
          “{toRemove?.song.title}” will be removed from {part?.name}. The song stays in the library.
        </p>
      </ConfirmDialog>
      <SidangModal
        mode={sidangModal ?? 'create'}
        open={!!sidangModal}
        session={sidangModal === 'edit' ? session : undefined}
        onClose={() => setSidangModal(null)}
        onSaved={(s) => {
          setSessionId(s.id);
          setPartNumber(1);
        }}
      />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-16">{children}</div>;
}

// ---------------------------------------------------------------------------

function AddSongs({
  songs,
  countInPart,
  onAdd,
}: {
  songs: {
    id: string;
    title: string;
    intro_bar_count: number;
    intro_unit: IntroUnit;
    loop_count: number;
    intro_instruments: string[];
    rhythms: string[];
  }[];
  countInPart: (songId: string) => number;
  onAdd: (songId: string) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? songs.filter((x) => x.title.toLowerCase().includes(s) || x.rhythms.some((r) => r.toLowerCase().includes(s)))
      : songs;
  }, [songs, q]);

  return (
    <Card>
      <div className="px-4 pt-4 pb-3 border-b border-line">
        <h3 className="font-semibold mb-2.5">Add songs</h3>
        <div className="relative">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${songs.length} songs`} className="pl-9" />
        </div>
      </div>
      <ul className="max-h-[380px] overflow-y-auto scrollbar-thin p-1.5">
        {filtered.map((s) => {
          const n = countInPart(s.id);
          return (
            <li key={s.id}>
              <button
                onClick={() => onAdd(s.id)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-raised group"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block text-xs text-muted tabular truncate">
                    {formatIntro(s.intro_bar_count, s.intro_unit)} · {s.loop_count}× · {s.intro_instruments.join(', ')}
                    {s.rhythms.length > 0 && ` · ${s.rhythms.join(' → ')}`}
                  </span>
                </span>
                {n > 0 && (
                  <span className="text-xs text-ok inline-flex items-center gap-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    {n > 1 ? `×${n}` : 'Added'}
                  </span>
                )}
                <span className="w-8 h-8 rounded-lg grid place-items-center bg-raised text-muted group-hover:bg-brass group-hover:text-brass-ink shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
              </button>
            </li>
          );
        })}
        {!filtered.length && <li className="px-3 py-6 text-sm text-muted text-center">No songs match “{q}”.</li>}
      </ul>
    </Card>
  );
}

function ControllerCard({
  partName,
  enabled,
  onToggle,
}: {
  partName: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold">Controller access</h3>
          <p className="text-sm text-muted">
            {enabled
              ? `Anyone in Controller mode can change songs and loops during ${partName}.`
              : `Locked: only Maestro and Admin can control ${partName}.`}
          </p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label="Allow controller" />
      </div>
    </Card>
  );
}
