'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, HandHeart, ListPlus, Plus, Search, SkipForward, ThumbsUp, Trash2, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useSongRequests, type RequestRow } from '@/lib/useSongRequests';
import { formatIntro } from '@/lib/format';
import { Badge, Button, Card, Input, Modal, cx } from './ui';

const NAME_KEY = 'anjung_chat_name';
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const saveName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // private mode
  }
};

/**
 * "Song requests" for one Sidang: musicians suggest songs from the library (or type one),
 * others back them with +1, and the Maestro adds them to a Bahagian or dismisses them.
 * A Controller can also slot a request in as "Next" while this Sidang is live.
 */
export function SongRequests({ sessionId }: { sessionId: string }) {
  const { songs, parts, selectedInstrument, isManager, canControl, liveSession, livePart, isFinished, addToQueue, addLiveSong, resolveQueue, notify } =
    useStage();
  const { t } = useT();
  const req = useSongRequests(sessionId);
  const [asking, setAsking] = useState(false);
  const [showHandled, setShowHandled] = useState(false);
  const [addFor, setAddFor] = useState<RequestRow | null>(null);

  const myParts = useMemo(() => parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number), [parts, sessionId]);
  const liveHere = liveSession?.id === sessionId && !!livePart && !isFinished;
  const open = req.rows.filter((r) => r.status === 'open');
  const handled = req.rows.filter((r) => r.status !== 'open');
  const inSetlist = (songId: string | null) =>
    !!songId && myParts.some((p) => resolveQueue(p.id).some((r) => !r.isBreak && r.song.id === songId));

  if (req.available === false) return null; // table not created yet

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-line">
        <div className="flex-1 min-w-[12rem]">
          <h2 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <HandHeart className="w-5 h-5 text-brass" /> {t('Song requests')}
            {open.length > 0 && <span className="text-sm font-sans font-normal text-muted tabular">{open.length}</span>}
          </h2>
          <p className="text-sm text-muted">{t('Suggest a song for this Sidang. Tap +1 on requests you agree with.')}</p>
        </div>
        <Button variant="primary" onClick={() => setAsking(true)}>
          <Plus className="w-4 h-4" /> {t('Request a song')}
        </Button>
      </div>

      {open.length === 0 ? (
        <p className="px-4 sm:px-5 py-5 text-sm text-muted">{t('No requests yet.')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((r) => (
            <RequestItem key={r.id} r={r}>
              {/* +1 */}
              <button
                type="button"
                disabled={r.mine}
                onClick={() => run(() => req.toggleVote(r.id))}
                aria-pressed={r.backed}
                aria-label={t('+1 for {title} ({n})', { title: r.title, n: r.votes })}
                className={cx(
                  'h-9 px-3 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 tabular shrink-0 transition-colors',
                  r.backed ? 'bg-brass text-brass-ink border-brass' : 'bg-raised border-line text-ink hover:border-line-strong',
                  r.mine && 'opacity-60 cursor-default'
                )}
              >
                <ThumbsUp className="w-4 h-4" fill={r.backed ? 'currentColor' : 'none'} /> +{r.votes}
              </button>
              {/* Actions */}
              <div className="basis-full flex flex-wrap items-center gap-2 pl-0 sm:pl-0 pt-1">
                {inSetlist(r.song_id) && <Badge tone="ok">{t('Already in this Sidang')}</Badge>}
                {liveHere && canControl && r.song_id && (
                  <Button
                    size="sm"
                    onClick={() =>
                      run(async () => {
                        await addLiveSong(r.song_id!, 'next');
                        await req.setStatus(r.id, 'added', t('Played next in {part}', { part: livePart?.name ?? '' }));
                      })
                    }
                  >
                    <SkipForward className="w-3.5 h-3.5" /> {t('Play next')}
                  </Button>
                )}
                {isManager && r.song_id && myParts.length > 0 && (
                  <Button size="sm" onClick={() => setAddFor(r)}>
                    <ListPlus className="w-3.5 h-3.5" /> {t('Add to setlist')}
                  </Button>
                )}
                {isManager && (
                  <Button size="sm" variant="ghost" onClick={() => run(() => req.setStatus(r.id, 'dismissed'))}>
                    <X className="w-3.5 h-3.5" /> {t('Dismiss')}
                  </Button>
                )}
                {(r.mine || isManager) && (
                  <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => run(() => req.remove(r.id))}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('Delete')}
                  </Button>
                )}
              </div>
            </RequestItem>
          ))}
        </ul>
      )}

      {handled.length > 0 && (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setShowHandled((v) => !v)}
            className="w-full flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm text-muted hover:text-ink"
          >
            <ChevronDown className={cx('w-4 h-4 transition-transform', showHandled && 'rotate-180')} />
            {t('Handled ({n})', { n: handled.length })}
          </button>
          {showHandled && (
            <ul className="divide-y divide-line border-t border-line">
              {handled.map((r) => (
                <RequestItem key={r.id} r={r} faded>
                  <Badge tone={r.status === 'added' ? 'ok' : 'neutral'} className="shrink-0">
                    {r.status === 'added' ? (
                      <>
                        <Check className="w-3 h-3" /> {t('Added')}
                      </>
                    ) : (
                      t('Dismissed')
                    )}
                  </Badge>
                  {isManager && (
                    <div className="basis-full flex gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => run(() => req.setStatus(r.id, 'open'))}>
                        {t('Reopen')}
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => run(() => req.remove(r.id))}>
                        <Trash2 className="w-3.5 h-3.5" /> {t('Delete')}
                      </Button>
                    </div>
                  )}
                </RequestItem>
              ))}
            </ul>
          )}
        </div>
      )}

      <RequestModal
        open={asking}
        onClose={() => setAsking(false)}
        onSubmit={async (input) => {
          const res = await req.request({ ...input, instrument: selectedInstrument });
          notify(res === 'backed' ? t('Already requested: your +1 was added') : t('Request sent'));
        }}
        songs={songs}
      />

      <Modal open={!!addFor} onClose={() => setAddFor(null)} title={t('Add “{title}” to…', { title: addFor?.title ?? '' })} size="sm">
        <div className="grid grid-cols-2 gap-2">
          {myParts.map((p) => (
            <Button
              key={p.id}
              size="lg"
              onClick={() =>
                run(async () => {
                  if (!addFor?.song_id) return;
                  await addToQueue(p.id, addFor.song_id);
                  await req.setStatus(addFor.id, 'added', t('Added to {part}', { part: p.name }));
                  notify(t('“{title}” added to {part}', { title: addFor.title, part: p.name }));
                  setAddFor(null);
                })
              }
            >
              {p.name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">{t('It goes to the end of that Bahagian. Reorder it in the Edit view.')}</p>
      </Modal>
    </Card>
  );
}

function RequestItem({ r, faded, children }: { r: RequestRow; faded?: boolean; children: React.ReactNode }) {
  const { songs } = useStage();
  const { t, lang } = useT();
  const song = r.song_id ? songs.find((s) => s.id === r.song_id) : null;
  const when = new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <li className={cx('flex flex-wrap items-start gap-x-3 gap-y-1 px-4 sm:px-5 py-3', faded && 'opacity-70')}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold break-words">{r.title}</div>
        {song ? (
          <div className="text-xs text-muted tabular">
            {lang === 'ms' ? 'Intro ' : ''}
            {formatIntro(song.intro_bar_count, song.intro_unit)}
            {lang === 'ms' ? '' : ' intro'} · {song.loop_count}× · {song.intro_instruments.join(', ') || '—'}
          </div>
        ) : (
          <div className="text-xs text-songket-light">{t('Not in the library')}</div>
        )}
        {r.note && <div className="mt-1 text-sm italic break-words">“{r.note}”</div>}
        <div className="mt-1 text-xs text-faint">
          {t('Requested by {name}', { name: r.author })}
          {r.instrument ? ` · ${r.instrument}` : ''} · {when}
          {r.handled_note ? ` · ${r.handled_note}` : ''}
        </div>
      </div>
      {children}
    </li>
  );
}

function RequestModal({
  open,
  onClose,
  onSubmit,
  songs,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { songId: string | null; title: string; note: string; author: string }) => Promise<void>;
  songs: ReturnType<typeof useStage>['songs'];
}) {
  const { notify } = useStage();
  const { t } = useT();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<{ id: string | null; title: string } | null>(null);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setQ('');
    setPicked(null);
    setNote('');
    setName(readName());
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? songs.filter((x) => x.title.toLowerCase().includes(s) || x.rhythms.some((r) => r.toLowerCase().includes(s))) : songs).slice(0, 60);
  }, [songs, q]);

  const send = async () => {
    if (!picked || !name.trim()) return;
    setBusy(true);
    try {
      saveName(name.trim());
      await onSubmit({ songId: picked.id, title: picked.title, note, author: name.trim() });
      onClose();
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Request a song')}
      description={picked ? undefined : t('Pick a song from the library, or type one that isn’t there.')}
      footer={
        picked ? (
          <>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              {t('Back')}
            </Button>
            <Button variant="primary" onClick={send} disabled={busy || !name.trim()}>
              {busy ? t('Sending…') : t('Send request')}
            </Button>
          </>
        ) : undefined
      }
    >
      {picked ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-brass/50 bg-brass-soft px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-brass">{t('Your request')}</div>
            <div className="font-display text-xl font-bold break-words">{picked.title}</div>
          </div>
          {!readName() && (
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Your name, e.g. Aiman')} maxLength={40} aria-label={t('Your name')} />
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={t('Why this song? (optional) e.g. “The graduates loved it last year”')}
            aria-label={t('Note')}
            className="w-full rounded-xl bg-bg border border-line px-3.5 py-2.5 text-base placeholder:text-faint focus:outline-none focus:border-brass/70"
          />
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search {n} songs or rhythms', { n: songs.length })} className="pl-9" aria-label={t('Search songs')} />
          </div>
          <ul className="mt-3 -mx-2 max-h-[50dvh] overflow-y-auto scrollbar-thin">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setPicked({ id: s.id, title: s.title })}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-raised"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block text-xs text-muted truncate">{s.rhythms.join(' → ') || '—'}</span>
                  </span>
                  <Plus className="w-4 h-4 text-muted shrink-0" />
                </button>
              </li>
            ))}
            {q.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => setPicked({ id: null, title: q.trim() })}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-raised text-brass"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 truncate">{t('Request “{q}” (not in the library)', { q: q.trim() })}</span>
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </Modal>
  );
}
