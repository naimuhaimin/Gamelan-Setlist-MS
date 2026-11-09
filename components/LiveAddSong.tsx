'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ListEnd, Search, SkipForward } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { formatIntro } from '@/lib/format';
import { Button, Input, Modal, cx } from './ui';

/**
 * Emergency / last-minute song for the LIVE Bahagian. Available to whoever can control
 * (Controller included). "Play next" slots it right after the current item; "End" appends it.
 */
export function LiveAddSong({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { songs, livePart, liveQueue, activeItem, addLiveSong } = useStage();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { t } = useT();

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? songs.filter((x) => x.title.toLowerCase().includes(s) || x.rhythms.some((r) => r.toLowerCase().includes(s))) : songs;
  }, [songs, q]);

  const inQueue = useMemo(() => new Set(liveQueue.filter((r) => !r.isBreak).map((r) => r.song.id)), [liveQueue]);

  const add = async (songId: string, where: 'next' | 'end') => {
    setBusy(songId + where);
    try {
      await addLiveSong(songId, where);
      onClose();
    } catch {
      // toast shown
    } finally {
      setBusy(null);
    }
  };

  if (!livePart) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Add a song to {part}', { part: livePart.name })}
      description={activeItem ? t('“Next” plays it right after {title}.', { title: activeItem.song.title }) : t('It will be added to the setlist.')}
    >
      <div className="relative">
        <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search {n} songs or rhythms', { n: songs.length })} className="pl-9" aria-label={t('Search songs')} />
      </div>
      <ul className="mt-3 -mx-2 max-h-[55dvh] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{t('No song matches “{q}”.', { q })}</li>}
        {filtered.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-raised/60">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {s.title}
                {inQueue.has(s.id) && <span className="ml-2 text-xs text-faint font-normal">{t('in setlist')}</span>}
              </span>
              <span className="block text-xs text-muted tabular truncate">
                {formatIntro(s.intro_bar_count, s.intro_unit)} · {s.loop_count}× · {s.intro_instruments.join(', ') || '—'}
                {s.rhythms.length > 0 && ` · ${s.rhythms.join(' → ')}`}
              </span>
            </span>
            {activeItem && (
              <Button
                size="sm"
                variant="primary"
                disabled={!!busy}
                onClick={() => add(s.id, 'next')}
                className={cx('shrink-0', busy === s.id + 'next' && 'opacity-60')}
                aria-label={t('Play {title} next', { title: s.title })}
              >
                <SkipForward className="w-3.5 h-3.5" /> {t('Next')}
              </Button>
            )}
            <Button
              size="sm"
              disabled={!!busy}
              onClick={() => add(s.id, 'end')}
              className="shrink-0"
              aria-label={t('Add {title} to the end', { title: s.title })}
            >
              <ListEnd className="w-3.5 h-3.5" /> {t('End')}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
