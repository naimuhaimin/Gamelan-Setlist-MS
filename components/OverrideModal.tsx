'use client';

import React, { useEffect, useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import type { ResolvedQueueItem } from '@/types';
import { Button, Chip, Modal, Stepper, Toggle, UnitSwitch } from './ui';
import { formatIntro } from '@/lib/format';
import type { IntroUnit } from '@/types';

/** One-time adjustments for a single setlist position; the library song is never changed. */
export function OverrideModal({ item, onClose }: { item: ResolvedQueueItem | null; onClose: () => void }) {
  const { instruments, saveOverride } = useStage();
  const [useBars, setUseBars] = useState(false);
  const [bars, setBars] = useState(4);
  const [unit, setUnit] = useState<IntroUnit>('bars');
  const [useInst, setUseInst] = useState(false);
  const [insts, setInsts] = useState<string[]>([]);
  const [useLoops, setUseLoops] = useState(false);
  const [loops, setLoops] = useState(1);
  const [saving, setSaving] = useState(false);
  const { t } = useT();

  useEffect(() => {
    if (!item) return;
    const q = item.queueItem;
    setUseBars(q.override_intro_bar_count !== null);
    setBars(item.introBarCount);
    setUnit(item.introUnit);
    setUseInst(q.override_intro_instruments !== null);
    setInsts(item.introInstruments);
    setUseLoops(q.override_loop_count !== null);
    setLoops(item.loopCount);
  }, [item]);

  if (!item) return null;
  const song = item.song;

  const save = async (clear = false) => {
    setSaving(true);
    try {
      await saveOverride(item.queueItem.id, {
        override_intro_bar_count: !clear && useBars ? bars : null,
        override_intro_unit: !clear && useBars ? unit : null,
        override_intro_instruments: !clear && useInst ? insts : null,
        override_loop_count: !clear && useLoops ? loops : null,
      });
      onClose();
    } catch {
      // error already shown as a toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Adjust “{title}”', { title: song.title })}
      description={t('Only for this spot in this Bahagian. The song in the library stays the same.')}
      footer={
        <>
          {item.hasOverride && (
            <Button variant="ghost" className="mr-auto" onClick={() => save(true)} disabled={saving}>
              {t('Reset to default')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={() => save()} disabled={saving || (useInst && insts.length === 0)}>
            {saving ? t('Saving…') : t('Save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Row title={t('Intro length')} original={formatIntro(song.intro_bar_count, song.intro_unit)} on={useBars} setOn={setUseBars}>
          <div className="flex flex-wrap items-center gap-3">
            <Stepper value={bars} onChange={setBars} min={0} max={64} />
            <UnitSwitch value={unit} onChange={setUnit} />
          </div>
        </Row>
        <Row
          title={t('Intro instruments')}
          original={song.intro_instruments.join(', ') || t('none')}
          on={useInst}
          setOn={setUseInst}
        >
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
          {insts.length === 0 && <p className="text-xs text-danger">{t('Pick at least one instrument.')}</p>}
        </Row>
        <Row title={t('Loops')} original={`${song.loop_count}×`} on={useLoops} setOn={setUseLoops}>
          <Stepper value={loops} onChange={setLoops} min={1} max={99} suffix={t('times')} />
        </Row>
      </div>
    </Modal>
  );
}

function Row({
  title,
  original,
  on,
  setOn,
  children,
}: {
  title: string;
  original: string;
  on: boolean;
  setOn: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-line p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted">{t('Song default: {value}', { value: original })}</div>
        </div>
        <span className="text-xs text-muted">{on ? t('Changed') : t('Default')}</span>
        <Toggle checked={on} onChange={setOn} label={t('Change {what}', { what: title.toLowerCase() })} />
      </div>
      {on && children}
    </div>
  );
}
