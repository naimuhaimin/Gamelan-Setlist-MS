'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { Song, GAMELAN_INSTRUMENTS } from '@/types';
import { Music, Plus, Trash2, Edit3, X, Check, BookOpen } from 'lucide-react';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose }) => {
  const { songs, addSongToLibrary, updateSongInLibrary, deleteSongFromLibrary } = useStage();

  const [isEditing, setIsEditing] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Form states - STRICT 4 FIELDS ONLY:
  const [title, setTitle] = useState('');
  const [introBarCount, setIntroBarCount] = useState(4);
  const [introInstruments, setIntroInstruments] = useState<string[]>(['Bonang Barung']);
  const [loopCount, setLoopCount] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setIntroBarCount(4);
    setIntroInstruments(['Bonang Barung']);
    setLoopCount(1);
    setIsEditing(false);
    setEditingSongId(null);
    setErrorMsg(null);
  };

  const handleStartEdit = (song: Song) => {
    setTitle(song.title);
    setIntroBarCount(song.intro_bar_count);
    setIntroInstruments([...song.intro_instruments]);
    setLoopCount(song.loop_count);
    setEditingSongId(song.id);
    setIsEditing(true);
    setErrorMsg(null);
  };

  const toggleInstrument = (inst: string) => {
    if (introInstruments.includes(inst)) {
      setIntroInstruments(introInstruments.filter((i) => i !== inst));
    } else {
      setIntroInstruments([...introInstruments, inst]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Song Title is required.');
      return;
    }
    if (introInstruments.length === 0) {
      setErrorMsg('Select at least one Gamelan intro instrument for cue timing.');
      return;
    }

    if (isEditing && editingSongId) {
      await updateSongInLibrary({
        id: editingSongId,
        title: title.trim(),
        intro_bar_count: Number(introBarCount) || 0,
        intro_instruments: introInstruments,
        loop_count: Math.max(1, Number(loopCount) || 1),
      });
    } else {
      await addSongToLibrary({
        title: title.trim(),
        intro_bar_count: Number(introBarCount) || 0,
        intro_instruments: introInstruments,
        loop_count: Math.max(1, Number(loopCount) || 1),
      });
    }

    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f121e] border-2 border-amber-500/40 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative text-white space-y-6 max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#21273f] pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white">Gamelan Repertoire Template Library</h3>
            <p className="text-xs text-slate-400">
              Master song templates for graduation ceremonies. Metadata strictly strictly restricted to Title, Intro Bars, Intro Instruments, and Loop Count.
            </p>
          </div>
        </div>

        {/* Content Split: Form on Left, Template List on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-y-auto pr-1">
          
          {/* Form (Col 1-5) */}
          <div className="md:col-span-5 bg-[#141828] border border-[#262f4e] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-amber-400 font-mono uppercase">
                {isEditing ? 'Edit Song Template' : 'Add New Song'}
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Field 1: Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 font-mono uppercase">
                  1. Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gending Raja Berangkat"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0e18] border border-[#2b3552] text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Field 2: Intro Bar Count */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 font-mono uppercase">
                  2. Intro Bar Count
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="64"
                    required
                    value={introBarCount}
                    onChange={(e) => setIntroBarCount(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 rounded-xl bg-[#0b0e18] border border-[#2b3552] text-white font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-xs text-slate-400">bars before ensemble starts</span>
                </div>
              </div>

              {/* Field 3: Intro Instruments */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 font-mono uppercase">
                    3. Intro Instruments
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">{introInstruments.length} selected</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-[#0b0e18] rounded-xl border border-[#242c46]">
                  {GAMELAN_INSTRUMENTS.map((inst) => {
                    const isSelected = introInstruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleInstrument(inst)}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-black font-bold shadow-sm'
                            : 'bg-[#1b2238] text-slate-300 hover:text-white'
                        }`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 4: Loop Count */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 font-mono uppercase">
                  4. Loop Count
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    value={loopCount}
                    onChange={(e) => setLoopCount(parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 rounded-xl bg-[#0b0e18] border border-[#2b3552] text-white font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-xs text-slate-400">standard section loops</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-glow-gold"
              >
                {isEditing ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Update Template</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Save to Library</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Existing Song Templates (Col 6-12) */}
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 px-1">
              <span>Saved Repertoire ({songs.length})</span>
              <span>Metadata Summary</span>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="p-3.5 rounded-2xl bg-[#141828] border border-[#242c46] hover:border-slate-500 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <h5 className="font-bold text-sm text-white truncate">{song.title}</h5>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-[#1c233a] text-cyan-400 font-semibold">
                        {song.intro_bar_count} Intro Bars
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#1c233a] text-amber-400 font-semibold">
                        {song.loop_count} Loops
                      </span>
                      <span className="text-slate-500 text-[11px] truncate max-w-[200px]">
                        Cue: {song.intro_instruments.join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleStartEdit(song)}
                      className="p-2 rounded-xl bg-[#1c233a] hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Edit Template"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteSongFromLibrary(song.id)}
                      className="p-2 rounded-xl bg-[#1c233a] hover:bg-red-950/80 text-slate-400 hover:text-red-400 transition-all"
                      title="Delete from Library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#21273f] flex items-center justify-between text-xs text-slate-400">
          <span>Konvokesyen Song Library • Strictly 4 standard metadata fields</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1a2034] text-slate-200 hover:bg-[#252e4a] font-bold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
