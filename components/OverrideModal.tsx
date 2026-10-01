'use client';

import React, { useState, useEffect } from 'react';
import { QueueItem, Song, GAMELAN_INSTRUMENTS } from '@/types';
import { Sliders, X, RotateCcw, Check, Sparkles } from 'lucide-react';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueItem: QueueItem | null;
  song: Song | null;
  onSaveOverride: (
    queueItemId: string,
    overrides: {
      override_intro_bar_count: number | null;
      override_intro_instruments: string[] | null;
      override_loop_count: number | null;
    }
  ) => Promise<void>;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  queueItem,
  song,
  onSaveOverride,
}) => {
  const [useIntroBarsOverride, setUseIntroBarsOverride] = useState(false);
  const [introBars, setIntroBars] = useState(4);

  const [useIntroInstOverride, setUseIntroInstOverride] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  const [useLoopOverride, setUseLoopOverride] = useState(false);
  const [loops, setLoops] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!queueItem || !song) return;

    if (queueItem.override_intro_bar_count !== null && queueItem.override_intro_bar_count !== undefined) {
      setUseIntroBarsOverride(true);
      setIntroBars(queueItem.override_intro_bar_count);
    } else {
      setUseIntroBarsOverride(false);
      setIntroBars(song.intro_bar_count);
    }

    if (queueItem.override_intro_instruments !== null && queueItem.override_intro_instruments !== undefined) {
      setUseIntroInstOverride(true);
      setSelectedInstruments([...queueItem.override_intro_instruments]);
    } else {
      setUseIntroInstOverride(false);
      setSelectedInstruments([...song.intro_instruments]);
    }

    if (queueItem.override_loop_count !== null && queueItem.override_loop_count !== undefined) {
      setUseLoopOverride(true);
      setLoops(queueItem.override_loop_count);
    } else {
      setUseLoopOverride(false);
      setLoops(song.loop_count);
    }
  }, [queueItem, song, isOpen]);

  if (!isOpen || !queueItem || !song) return null;

  const toggleInstrument = (inst: string) => {
    if (selectedInstruments.includes(inst)) {
      setSelectedInstruments(selectedInstruments.filter((i) => i !== inst));
    } else {
      setSelectedInstruments([...selectedInstruments, inst]);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSaveOverride(queueItem.id, {
        override_intro_bar_count: useIntroBarsOverride ? introBars : null,
        override_intro_instruments: useIntroInstOverride ? selectedInstruments : null,
        override_loop_count: useLoopOverride ? loops : null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAllOverrides = async () => {
    setIsSubmitting(true);
    try {
      await onSaveOverride(queueItem.id, {
        override_intro_bar_count: null,
        override_intro_instruments: null,
        override_loop_count: null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#101422] border-2 border-purple-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative text-white space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-purple-400 font-bold">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Maestro Special Instance Override</span>
          </div>
          <h3 className="text-2xl font-black text-white">{song.title}</h3>
          <p className="text-xs text-slate-400">
            Customize cue metadata exclusively for this queue position without altering the master song library template.
          </p>
        </div>

        {/* Override Fields */}
        <div className="space-y-5">
          
          {/* 1. Intro Bar Count Override */}
          <div className="p-4 rounded-2xl bg-[#151a2d] border border-[#283252] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-2">
                <span>1. Intro Bar Count</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Template: {song.intro_bar_count} bars)
                </span>
              </label>
              <button
                type="button"
                onClick={() => setUseIntroBarsOverride(!useIntroBarsOverride)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  useIntroBarsOverride
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-[#212942] text-slate-400'
                }`}
              >
                {useIntroBarsOverride ? 'Override ACTIVE' : 'Use Template'}
              </button>
            </div>

            {useIntroBarsOverride ? (
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="number"
                  min="0"
                  max="64"
                  value={introBars}
                  onChange={(e) => setIntroBars(parseInt(e.target.value) || 0)}
                  className="w-28 px-3 py-2 rounded-xl bg-[#0d101d] border border-purple-500/50 text-white font-mono font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-xs text-slate-400">bars before ensemble cue</span>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500">
                Inheriting template default: <strong className="text-slate-300">{song.intro_bar_count} bars</strong>
              </div>
            )}
          </div>

          {/* 2. Intro Instruments Override */}
          <div className="p-4 rounded-2xl bg-[#151a2d] border border-[#283252] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-2">
                <span>2. Intro Instruments</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Template: {song.intro_instruments.join(', ') || 'None'})
                </span>
              </label>
              <button
                type="button"
                onClick={() => setUseIntroInstOverride(!useIntroInstOverride)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  useIntroInstOverride
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-[#212942] text-slate-400'
                }`}
              >
                {useIntroInstOverride ? 'Override ACTIVE' : 'Use Template'}
              </button>
            </div>

            {useIntroInstOverride ? (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] text-slate-400">
                  Select Gamelan instruments responsible for the cue:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-[#0d101d] rounded-xl border border-[#20273f]">
                  {GAMELAN_INSTRUMENTS.map((inst) => {
                    const isSelected = selectedInstruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleInstrument(inst)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white border border-purple-400 shadow-sm'
                            : 'bg-[#1b2238] text-slate-400 hover:text-white'
                        }`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500">
                Inheriting template instruments:{' '}
                <strong className="text-slate-300">
                  {song.intro_instruments.join(', ') || 'None'}
                </strong>
              </div>
            )}
          </div>

          {/* 3. Loop Count Override */}
          <div className="p-4 rounded-2xl bg-[#151a2d] border border-[#283252] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-2">
                <span>3. Loop Count</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Template: {song.loop_count} loops)
                </span>
              </label>
              <button
                type="button"
                onClick={() => setUseLoopOverride(!useLoopOverride)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  useLoopOverride
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-[#212942] text-slate-400'
                }`}
              >
                {useLoopOverride ? 'Override ACTIVE' : 'Use Template'}
              </button>
            </div>

            {useLoopOverride ? (
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={loops}
                  onChange={(e) => setLoops(parseInt(e.target.value) || 1)}
                  className="w-28 px-3 py-2 rounded-xl bg-[#0d101d] border border-purple-500/50 text-white font-mono font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-xs text-slate-400">loops for this specific stage instance</span>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500">
                Inheriting template loop count: <strong className="text-slate-300">{song.loop_count}x</strong>
              </div>
            )}
          </div>

        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1f263d]">
          <button
            type="button"
            onClick={handleClearAllOverrides}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-[#181d30] hover:bg-red-950/60 hover:text-red-400 text-slate-400 text-xs font-bold border border-[#2b3552] transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Template</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-300 hover:bg-[#1a2034] text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all shadow-lg flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Saving...' : 'Apply Override'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
