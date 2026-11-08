'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ListMusic, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { Song } from '@/types';
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Stepper, cx } from './ui';

export function LibraryView() {
  const { songs, instruments, queueItems, isManager, selectedInstrument, removeSong } = useStage();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Song | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Song | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return songs.filter(
      (x) => (!s || x.title.toLowerCase().includes(s)) && (!filter || x.intro_instruments.includes(filter))
    );
  }, [songs, q, filter]);

  const usage = (songId: string) => queueItems.filter((qi) => qi.song_id === songId).length;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pb-16">
      <div className="pt-4 sm:pt-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-semibold">Song library</h1>
          <p className="text-sm text-muted tabular">
            {songs.length} songs{isManager ? '' : ' · view only'}
          </p>
        </div>
        {isManager && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> Add song
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs" className="pl-9" />
        </div>
        {instruments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            <Chip selected={!filter} onClick={() => setFilter(null)} className="shrink-0">
              All
            </Chip>
            {instruments.map((i) => (
              <Chip key={i} selected={filter === i} onClick={() => setFilter(filter === i ? null : i)} className="shrink-0">
                {i} intro
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Card className="mt-4 overflow-hidden">
        {filtered.length ? (
          <ul className="divide-y divide-line">
            {filtered.map((s) => {
              const mine = !!selectedInstrument && s.intro_instruments.includes(selectedInstrument);
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{s.title}</span>
                      {mine && <Badge tone="brass">Your cue</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted tabular">
                      <span>
                        <b className="text-ink font-semibold">{s.intro_bar_count}</b> bars intro
                      </span>
                      <span>
                        <b className="text-ink font-semibold">{s.loop_count}</b>× loop
                      </span>
                      <span className="truncate">{s.intro_instruments.join(', ') || 'no intro instrument'}</span>
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <IconButton label={`Edit ${s.title}`} size="sm" onClick={() => setEditing(s)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton label={`Delete ${s.title}`} size="sm" onClick={() => setToDelete(s)} className="hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<ListMusic className="w-10 h-10" />}
            title={songs.length ? 'No songs match' : 'The library is empty'}
            action={
              !songs.length && isManager ? (
                <Button variant="primary" onClick={() => setEditing('new')}>
                  <Plus className="w-4 h-4" /> Add the first song
                </Button>
              ) : undefined
            }
          >
            {songs.length ? 'Try another search or instrument.' : null}
          </EmptyState>
        )}
      </Card>

      <SongFormModal song={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Delete “${toDelete?.title}”?`}
        confirmLabel="Delete song"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeSong(toDelete.id);
          setToDelete(null);
        }}
      >
        <p>The song is removed from the library permanently.</p>
        {toDelete && usage(toDelete.id) > 0 && (
          <p className="text-danger">
            It is used {usage(toDelete.id)} {usage(toDelete.id) === 1 ? 'time' : 'times'} in setlists. Those spots will be removed too.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SongFormModal({ song, onClose }: { song: Song | 'new' | null; onClose: () => void }) {
  const { instruments, songs, addSong, editSong } = useStage();
  const isNew = song === 'new';
  const [title, setTitle] = useState('');
  const [bars, setBars] = useState(4);
  const [insts, setInsts] = useState<string[]>([]);
  const [loops, setLoops] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!song) return;
    setError(null);
    if (song === 'new') {
      setTitle('');
      setBars(4);
      setInsts([]);
      setLoops(4);
    } else {
      setTitle(song.title);
      setBars(song.intro_bar_count);
      setInsts(song.intro_instruments);
      setLoops(song.loop_count);
    }
  }, [song]);

  if (!song) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('Enter a song title.');
    if (!insts.length) return setError('Pick at least one intro instrument.');
    if (songs.some((s) => s.title.toLowerCase() === t.toLowerCase() && (isNew || s.id !== (song as Song).id)))
      return setError(`“${t}” is already in the library.`);
    setSaving(true);
    try {
      const data = { title: t, intro_bar_count: bars, intro_instruments: insts, loop_count: loops };
      if (isNew) await addSong(data);
      else await editSong({ ...(song as Song), ...data });
      onClose();
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  const quick = (values: number[], current: number, set: (n: number) => void, unit: string) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          className={cx(
            'h-8 px-3 rounded-lg text-sm tabular border',
            current === v ? 'bg-brass text-brass-ink border-brass font-semibold' : 'bg-raised border-line text-muted hover:text-ink'
          )}
        >
          {v}
          {unit}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add song' : 'Edit song'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="song-form" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add song' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="song-form" onSubmit={submit} className="space-y-5">
        <Field label="Title" htmlFor="song-title">
          <Input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 54 Joget Pahang" />
        </Field>
        <Field label="Intro bars" hint="Bars played before the whole ensemble comes in.">
          <Stepper value={bars} onChange={setBars} min={0} max={64} suffix="bars" />
          {quick([1, 2, 4, 6, 8], bars, setBars, '')}
        </Field>
        <Field label="Intro instruments" hint="Musicians on these instruments get a “Your cue” alert.">
          {instruments.length ? (
            <div className="flex flex-wrap gap-2">
              {instruments.map((i) => (
                <Chip
                  key={i}
                  selected={insts.includes(i)}
                  onClick={() => setInsts((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                >
                  {i}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-danger">No instruments yet. An Admin must add them first.</p>
          )}
        </Field>
        <Field label="Loops" hint="How many times the song repeats.">
          <Stepper value={loops} onChange={setLoops} min={1} max={99} suffix="times" />
          {quick([1, 2, 3, 4, 6], loops, setLoops, '×')}
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
