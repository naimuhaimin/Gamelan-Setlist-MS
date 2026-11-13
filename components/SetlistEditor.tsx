'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ClipboardList, ClipboardPaste, Coffee, HandHeart, Pencil, Plus, Radio, Search, SlidersHorizontal, ThumbsUp, Trash2 } from 'lucide-react';
import { DEFAULT_INTERLUDE_LABEL, useStage } from '@/lib/stageContext';
import { plural, useT } from '@/lib/i18n';
import type { Part, ResolvedQueueItem } from '@/types';
import { Badge, BreakIcon, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, LiveDot, Modal, Rhythms, Stepper, Toggle, VoteCounts, cx } from './ui';
import { OverrideModal } from './OverrideModal';
import { CopySetlistModal, PasteSetlistModal } from './SetlistText';
import { formatIntro } from '@/lib/format';
import { useSongRequests } from '@/lib/useSongRequests';
import type { IntroUnit } from '@/types';

/** The Maestro's editor for one Sidang: Bahagian tabs, ordered songs & breaks, controller access. */
export function SetlistEditor({ sessionId, onShowStage }: { sessionId: string; onShowStage: () => void }) {
  const {
    parts,
    songs,
    roomState,
    liveQueue,
    activeIndex,
    resolveQueue,
    goLive,
    addToQueue,
    addBreak,
    removeFromQueue,
    moveQueueItem,
    editPart,
    tally,
    isFinished,
    notify,
  } = useStage();

  const sessionParts = useMemo(
    () => parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number),
    [parts, sessionId]
  );
  const [partNumber, setPartNumber] = useState<number>(
    () => sessionParts.find((p) => p.id === roomState.part_id)?.part_number ?? 1
  );
  const [overrideItem, setOverrideItem] = useState<ResolvedQueueItem | null>(null);
  const [breakItem, setBreakItem] = useState<ResolvedQueueItem | 'new' | null>(null);
  const [toRemove, setToRemove] = useState<ResolvedQueueItem | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const { t } = useT();

  useEffect(() => {
    if (sessionParts.length && !sessionParts.some((p) => p.part_number === partNumber)) setPartNumber(sessionParts[0].part_number);
  }, [sessionParts, partNumber]);

  const part = sessionParts.find((p) => p.part_number === partNumber) ?? sessionParts[0];
  const queue = part ? resolveQueue(part.id) : [];
  const isLive = !!part && roomState.part_id === part.id && !isFinished;
  const liveCurrentId = isLive && activeIndex >= 0 ? liveQueue[activeIndex]?.queueItem.id : null;
  const nextPartOf = (p: Part) => sessionParts.find((x) => x.part_number > p.part_number);

  return (
    <div>
      {/* Whole-Sidang setlist as the usual text message, both ways */}
      <div className="mb-3 grid grid-cols-2 sm:flex gap-2">
        <Button onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="w-4 h-4" /> {t('Paste setlist')}
        </Button>
        <Button onClick={() => setCopyOpen(true)}>
          <ClipboardList className="w-4 h-4" /> {t('Copy as text')}
        </Button>
      </div>
      <PasteSetlistModal open={pasteOpen} onClose={() => setPasteOpen(false)} sessionId={sessionId} />
      <CopySetlistModal open={copyOpen} onClose={() => setCopyOpen(false)} sessionId={sessionId} />

      {/* Bahagian tabs */}
      <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Bahagian">
        {sessionParts.map((p) => {
          const count = resolveQueue(p.id).filter((r) => !r.isBreak).length;
          const selected = p.id === part?.id;
          const live = roomState.part_id === p.id && !isFinished;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={selected}
              aria-label={`Bahagian ${p.part_number}, ${plural(count, '{n} song', '{n} songs')}${live ? `, ${t('live')}` : ''}`}
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
              <div className="text-xs text-muted tabular">{plural(count, '{n} song', '{n} songs')}</div>
            </button>
          );
        })}
      </div>

      {part && (
        <div className="mt-4 grid gap-4 lg:grid-cols-12 items-start">
          {/* Queue */}
          <Card className="min-w-0 lg:col-span-7 xl:col-span-8">
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-line">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold">{part.name}</h2>
                <p className="text-sm text-muted">{t('Set the order. Adjust a song for this ceremony with ⚙. Add breaks anywhere.')}</p>
              </div>
              <div className="w-full sm:w-auto sm:ml-auto grid grid-cols-2 sm:flex items-center gap-2">
                <Button onClick={() => setBreakItem('new')}>
                  <BreakIcon className="w-4 h-4" /> {t('Add break')}
                </Button>
                {isLive ? (
                  <Button variant="secondary" onClick={onShowStage}>
                    <LiveDot /> {t('Live now')}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => goLive(part.id)} disabled={!queue.length}>
                    <Radio className="w-4 h-4" /> {t('Go live')}
                  </Button>
                )}
              </div>
            </div>

            {queue.length ? (
              <ol className="divide-y divide-line">
                {queue.map((r, i) => (
                  <li
                    key={r.queueItem.id}
                    className={cx(
                      'flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-3',
                      r.queueItem.id === liveCurrentId && 'bg-songket-soft',
                      r.isBreak && r.queueItem.id !== liveCurrentId && 'bg-stop/[0.06]'
                    )}
                  >
                    <span className="w-7 text-center text-sm font-semibold text-muted tabular shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      {r.isBreak ? (
                        <div className="flex items-center gap-2 min-w-0 text-stop-light font-medium">
                          <BreakIcon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{r.song.title}</span>
                          {r.breakMinutes ? <span className="text-xs text-muted tabular">· {t('{n} min', { n: r.breakMinutes })}</span> : null}
                          {r.queueItem.id === liveCurrentId && <Badge tone="live">{t('Now')}</Badge>}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{r.song.title}</span>
                            {r.queueItem.id === liveCurrentId && <Badge tone="live">{t('Playing')}</Badge>}
                            {r.hasOverride && <Badge tone="override">{t('Adjusted')}</Badge>}
                          </div>
                          <div className="text-xs text-muted truncate tabular">
                            {formatIntro(r.introBarCount, r.introUnit)} · {r.loopCount}× · {r.introInstruments.join(', ') || t('no intro instrument')}
                          </div>
                          {r.song.rhythms.length > 0 && <Rhythms rhythms={r.song.rhythms} className="mt-1" />}
                          <VoteCounts {...tally(r.queueItem.id)} className="mt-1" />
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 w-full sm:w-auto justify-end -mr-1 sm:mr-0 pl-10 sm:pl-0">
                      <IconButton label={t('Move up')} size="sm" onClick={() => moveQueueItem(part.id, i, i - 1)} disabled={i === 0}>
                        <ArrowUp className="w-4 h-4" />
                      </IconButton>
                      <IconButton label={t('Move down')} size="sm" onClick={() => moveQueueItem(part.id, i, i + 1)} disabled={i === queue.length - 1}>
                        <ArrowDown className="w-4 h-4" />
                      </IconButton>
                      {r.isBreak ? (
                        <IconButton label={t('Edit break')} size="sm" onClick={() => setBreakItem(r)}>
                          <Pencil className="w-4 h-4" />
                        </IconButton>
                      ) : (
                        <IconButton
                          label={t('Adjust for this ceremony')}
                          size="sm"
                          onClick={() => setOverrideItem(r)}
                          className={r.hasOverride ? 'text-songket-light' : undefined}
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </IconButton>
                      )}
                      <IconButton label={t('Remove from setlist')} size="sm" onClick={() => setToRemove(r)} className="hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title={t('No songs in this Bahagian')}>{t('Add songs from the library.')}</EmptyState>
            )}
          </Card>

          {/* Side */}
          <div className="min-w-0 lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
            <RequestedSongs
              sessionId={sessionId}
              part={part}
              sessionParts={sessionParts}
              onAdd={(songId) => addToQueue(part.id, songId)}
              notify={notify}
            />
            <AddSongs
              key={part.id}
              songs={songs}
              countInPart={(songId) => queue.filter((r) => !r.isBreak && r.song.id === songId).length}
              onAdd={(songId) => addToQueue(part.id, songId)}
            />
            <ControllerCard
              key={`ctrl-${part.id}`}
              partName={part.name}
              enabled={part.controller_enabled}
              onToggle={(v) => editPart(part.id, { controller_enabled: v })}
            />
            {nextPartOf(part) && <IntermissionCard key={`int-${part.id}`} part={part} nextName={nextPartOf(part)!.name} />}
          </div>
        </div>
      )}

      <OverrideModal item={overrideItem} onClose={() => setOverrideItem(null)} />
      {part && (
        <BreakModal
          item={breakItem}
          onClose={() => setBreakItem(null)}
          onAdd={(label, minutes) => addBreak(part.id, label, minutes)}
        />
      )}
      <ConfirmDialog
        open={!!toRemove}
        title={toRemove?.isBreak ? t('Remove break?') : t('Remove from setlist?')}
        confirmLabel={t('Remove')}
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) removeFromQueue(toRemove.queueItem.id);
          setToRemove(null);
        }}
      >
        <p>
          {toRemove?.isBreak
            ? t('“{title}” will be removed from {part}.', { title: toRemove.song.title, part: part?.name })
            : t('“{title}” will be removed from {part}. The song stays in the library.', { title: toRemove?.song.title, part: part?.name })}
        </p>
      </ConfirmDialog>
    </div>
  );
}

function BreakModal({
  item,
  onClose,
  onAdd,
}: {
  item: ResolvedQueueItem | 'new' | null;
  onClose: () => void;
  onAdd: (label: string, minutes: number | null) => Promise<void>;
}) {
  const { editBreak } = useStage();
  const { t } = useT();
  const [label, setLabel] = useState('Break');
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    if (item === 'new') {
      setLabel(t('Break'));
      setTimed(false);
      setMinutes(10);
    } else {
      setLabel(item.song.title);
      setTimed(!!item.breakMinutes);
      setMinutes(item.breakMinutes ?? 10);
    }
  }, [item]);

  if (!item) return null;
  const isNew = item === 'new';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) await onAdd(label, timed ? minutes : null);
      else await editBreak(item.queueItem.id, label, timed ? minutes : null);
      onClose();
    } catch {
      // toast shown
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? t('Add a break') : t('Edit break')}
      description={isNew ? t('It goes to the end of this Bahagian. Move it into place with the arrows.') : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="break-form" disabled={saving}>
            {saving ? t('Saving…') : isNew ? t('Add break') : t('Save')}
          </Button>
        </>
      }
    >
      <form id="break-form" onSubmit={save} className="space-y-4">
        <Field label={t('Label')} htmlFor="break-label" hint={t('e.g. “Break”, “Ucapan Canselor”, “Penyampaian Ijazah”')}>
          <Input id="break-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium text-sm">{t('Show a length')}</div>
            <div className="text-xs text-muted">{t('Optional, for musicians’ info only.')}</div>
          </div>
          <Toggle checked={timed} onChange={setTimed} label={t('Show a length')} />
        </div>
        {timed && <Stepper value={minutes} onChange={setMinutes} min={1} max={240} suffix={t('minutes')} />}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** "36 Gempita", "gempita" and "Gempita" all match the same library song. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const bare = (s: string) => norm(s).replace(/^\d+\s*/, '');

/** Open song requests for this Sidang, one tap to add each to the Bahagian being edited. */
function RequestedSongs({
  sessionId,
  part,
  sessionParts,
  onAdd,
  notify,
}: {
  sessionId: string;
  part: Part;
  sessionParts: Part[];
  onAdd: (songId: string) => Promise<unknown> | void;
  notify: (msg: string, tone?: 'error') => void;
}) {
  const { songs, resolveQueue } = useStage();
  const { t } = useT();
  const req = useSongRequests(sessionId);
  const [busy, setBusy] = useState<string | null>(null);

  const open = req.rows.filter((r) => r.status === 'open');
  if (req.available === false || !open.length) return null;

  // Library song for a request: picked from the library, or matched by its typed title
  const songFor = (r: (typeof open)[number]) =>
    (r.song_id ? songs.find((x) => x.id === r.song_id) : undefined) ??
    songs.find((x) => norm(x.title) === norm(r.title)) ??
    songs.find((x) => bare(r.title) && bare(x.title) === bare(r.title)) ??
    null;
  // Which Bahagian already has it
  const whereIs = (songId: string) => sessionParts.filter((p) => resolveQueue(p.id).some((q) => !q.isBreak && q.song.id === songId));

  const add = async (r: (typeof open)[number], songId: string) => {
    setBusy(r.id);
    try {
      await onAdd(songId);
      await req.setStatus(r.id, 'added', t('Added to {part}', { part: part.name }));
      notify(t('{title} added to {part}', { title: songs.find((x) => x.id === songId)?.title ?? r.title, part: part.name }));
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-brass/40">
      <div className="px-4 pt-4 pb-3 border-b border-line">
        <h3 className="font-semibold inline-flex items-center gap-2">
          <HandHeart className="w-4 h-4 text-brass" /> {t('Requested songs')}
          <span className="text-xs text-muted font-normal tabular">{open.length}</span>
        </h3>
        <p className="text-xs text-muted mt-0.5">{t('Tap + to add a request to {part}.', { part: part.name })}</p>
      </div>
      <ul className="max-h-[260px] overflow-y-auto scrollbar-thin p-1.5">
        {open.map((r) => {
          const song = songFor(r);
          const inParts = song ? whereIs(song.id) : [];
          return (
            <li key={r.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{song?.title ?? r.title}</span>
                <span className="block text-xs text-muted truncate">
                  {t('by {name}', { name: r.author })}
                  {r.note ? ` · “${r.note}”` : ''}
                </span>
                {inParts.length > 0 && (
                  <span className="text-xs text-ok inline-flex items-center gap-0.5">
                    <Check className="w-3.5 h-3.5" /> {t('Already in {parts}', { parts: inParts.map((p) => `B${p.part_number}`).join(', ') })}
                  </span>
                )}
                {!song && <span className="block text-xs text-songket-light">{t('Not in the library')}</span>}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-jade-light tabular shrink-0">
                <ThumbsUp className="w-3.5 h-3.5" /> +{r.votes}
              </span>
              <button
                onClick={() => song && add(r, song.id)}
                disabled={!song || busy === r.id}
                aria-label={t('Add {title} to {part}', { title: song?.title ?? r.title, part: part.name })}
                title={song ? t('Add to {part}', { part: part.name }) : t('Not in the library')}
                className="w-8 h-8 rounded-lg grid place-items-center bg-brass text-brass-ink shrink-0 disabled:bg-raised disabled:text-faint"
              >
                <Plus className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

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
  const { t } = useT();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? songs.filter((x) => x.title.toLowerCase().includes(s) || x.rhythms.some((r) => r.toLowerCase().includes(s)))
      : songs;
  }, [songs, q]);

  return (
    <Card>
      <div className="px-4 pt-4 pb-3 border-b border-line">
        <h3 className="font-semibold mb-2.5">{t('Add songs')}</h3>
        <div className="relative">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search {n} songs', { n: songs.length })} className="pl-9" />
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
                    {n > 1 ? `×${n}` : t('Added')}
                  </span>
                )}
                <span className="w-8 h-8 rounded-lg grid place-items-center bg-raised text-muted group-hover:bg-brass group-hover:text-brass-ink shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
              </button>
            </li>
          );
        })}
        {!filtered.length && <li className="px-3 py-6 text-sm text-muted text-center">{t('No song matches “{q}”.', { q })}</li>}
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
  const { t } = useT();
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold">{t('Controller access')}</h3>
          <p className="text-sm text-muted">
            {enabled
              ? t('Anyone in Controller mode can change songs and loops during {part}.', { part: partName })
              : t('Locked: only Maestro and Admin can control {part}.', { part: partName })}
          </p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={t('Allow controller')} />
      </div>
    </Card>
  );
}

/** Intermission after this Bahagian: guest performers and how many songs they play. */
function IntermissionCard({ part, nextName }: { part: Part; nextName: string }) {
  const { interludeFor, interludeEditable, editInterlude } = useStage();
  const current = interludeFor(part);
  const [label, setLabel] = useState(current?.label ?? DEFAULT_INTERLUDE_LABEL);
  const [songs, setSongs] = useState(current?.songs ?? 0);
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const dirty = label.trim() !== (current?.label ?? DEFAULT_INTERLUDE_LABEL) || songs !== (current?.songs ?? 0);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Coffee className="w-5 h-5 text-brass" />
        <h3 className="font-semibold flex-1">{t('Intermission after {part}', { part: part.name })}</h3>
      </div>
      <p className="text-sm text-muted mt-1">
        {current
          ? t('{label} plays {songs} before {part}.', { label: current.label, songs: plural(current.songs, '{n} song', '{n} songs'), part: nextName })
          : t('No intermission: {part} follows straight away.', { part: nextName })}
      </p>
      {interludeEditable ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await editInterlude(part.id, label, songs);
            } catch {
              // toast shown
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label={t('Performed by')} htmlFor={`int-label-${part.id}`}>
            <Input id={`int-label-${part.id}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={DEFAULT_INTERLUDE_LABEL} />
          </Field>
          <Field label={t('Songs')} hint={t('0 = no intermission')}>
            <Stepper value={songs} onChange={setSongs} min={0} max={10} suffix={t(songs === 1 ? 'song' : 'songs')} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={!dirty || saving}>
              {saving ? t('Saving…') : t('Save')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-faint mt-2">{t('To change it, run the latest supabase-schema.sql (section 8) in Supabase.')}</p>
      )}
    </Card>
  );
}
