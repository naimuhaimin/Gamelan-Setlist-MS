'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { Song, GAMELAN_INSTRUMENTS, GamelanInstrument } from '@/types';
import {
  Music,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  BookOpen,
  ShieldCheck,
  Clock,
  RotateCw,
  Search,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Flame,
} from 'lucide-react';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Quick Ceremony Presets to help Admin quickly set template forms
const TEMPLATE_PRESETS: Array<{
  name: string;
  icon: string;
  bars: number;
  instruments: GamelanInstrument[];
  loops: number;
}> = [
  {
    name: 'Perarakan Diraja / VIP',
    icon: '👑',
    bars: 8,
    instruments: ['Bonang Barung', 'Gendang'],
    loops: 4,
  },
  {
    name: 'Penganugerahan Siswazah',
    icon: '🎓',
    bars: 4,
    instruments: ['Saron Demung', 'Saron Barung', 'Kenong'],
    loops: 12,
  },
  {
    name: 'Selingan Seni Gamelan',
    icon: '🎶',
    bars: 4,
    instruments: ['Bonang Barung', 'Gambang'],
    loops: 3,
  },
  {
    name: 'Perarakan Keluar Dewan',
    icon: '🚶',
    bars: 8,
    instruments: ['Gendang', 'Bonang Barung', 'Gong Ageng'],
    loops: 3,
  },
];

export const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose }) => {
  const {
    songs,
    addSongToLibrary,
    updateSongInLibrary,
    deleteSongFromLibrary,
    activeRole,
    selectedInstrument,
    loginRole,
  } = useStage();

  const isManagementRole = activeRole === 'admin' || activeRole === 'maestro';
  const isAdmin = activeRole === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Template Form fields (Strict 4 Fields: Title, Intro Bars, Intro Instruments, Loop Count)
  const [title, setTitle] = useState('');
  const [introBarCount, setIntroBarCount] = useState<number>(4);
  const [introInstruments, setIntroInstruments] = useState<string[]>(['Bonang Barung']);
  const [loopCount, setLoopCount] = useState<number>(4);

  // In-app Delete Confirmation State (Rock-solid, no browser window.confirm issues)
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setIntroBarCount(4);
    setIntroInstruments(['Bonang Barung']);
    setLoopCount(4);
    setIsEditing(false);
    setEditingSongId(null);
    setErrorMsg(null);
  };

  const applyPreset = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setIntroBarCount(preset.bars);
    setIntroInstruments([...preset.instruments]);
    setLoopCount(preset.loops);
    if (!title.trim()) {
      setTitle(preset.name);
    }
  };

  const handleStartEdit = (song: Song) => {
    setTitle(song.title);
    setIntroBarCount(song.intro_bar_count);
    setIntroInstruments([...song.intro_instruments]);
    setLoopCount(song.loop_count);
    setEditingSongId(song.id);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const toggleInstrument = (inst: string) => {
    if (introInstruments.includes(inst)) {
      setIntroInstruments(introInstruments.filter((i) => i !== inst));
    } else {
      setIntroInstruments([...introInstruments, inst]);
    }
  };

  const handleSelectAllInstruments = () => {
    setIntroInstruments([...GAMELAN_INSTRUMENTS]);
  };

  const handleClearInstruments = () => {
    setIntroInstruments([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isManagementRole) {
      setErrorMsg('Only Admin or Maestro can modify the system song repertoire.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Song Title is required.');
      return;
    }

    if (introInstruments.length === 0) {
      setErrorMsg('Select at least one Gamelan intro instrument for cue timing.');
      return;
    }

    try {
      if (isEditing && editingSongId) {
        await updateSongInLibrary({
          id: editingSongId,
          title: title.trim(),
          intro_bar_count: Math.max(0, Number(introBarCount) || 0),
          intro_instruments: introInstruments,
          loop_count: Math.max(1, Number(loopCount) || 1),
        });
        setSuccessMsg(`Updated song template "${title.trim()}" in the system.`);
      } else {
        await addSongToLibrary({
          title: title.trim(),
          intro_bar_count: Math.max(0, Number(introBarCount) || 0),
          intro_instruments: introInstruments,
          loop_count: Math.max(1, Number(loopCount) || 1),
        });
        setSuccessMsg(`Added new song "${title.trim()}" into the system!`);
      }

      resetForm();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to save song template.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;
    try {
      setIsDeleting(true);
      setErrorMsg(null);
      await deleteSongFromLibrary(songToDelete.id);
      if (editingSongId === songToDelete.id) {
        resetForm();
      }
      setSuccessMsg(`Deleted "${songToDelete.title}" from the master library.`);
      setSongToDelete(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to delete song from library.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnlockAdmin = () => {
    loginRole('admin', 'admin999');
  };

  // Filter songs by search query
  const filteredSongs = songs.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.intro_instruments.some((inst) => inst.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className={`bg-[#0f121e] border-2 border-amber-500/50 rounded-3xl w-full shadow-2xl relative text-white space-y-4 max-h-[92vh] flex flex-col ${
        isManagementRole ? 'max-w-5xl p-5 sm:p-7' : 'max-w-3xl p-5 sm:p-6'
      }`}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header & Role Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#21273f] pb-4 pr-12">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-black flex items-center justify-center shadow-glow-gold">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest font-bold text-amber-400">
                  {isManagementRole ? 'Master Repertoire Library' : 'Song Repertoire Catalog'}
                </span>

                {isAdmin ? (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/50 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3 h-3 text-red-400" />
                    Admin Mode: Full Template Authority
                  </span>
                ) : activeRole === 'maestro' ? (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/50 font-bold">
                    Maestro Mode
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#182035] text-slate-300 border border-[#2d3856] flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-cyan-400" />
                    {activeRole.toUpperCase()} VIEW (READ-ONLY)
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {isManagementRole ? 'Song Template & Library Manager' : 'Gamelan Repertoire List'}
              </h3>
            </div>
          </div>

          {!isAdmin && (
            <button
              onClick={handleUnlockAdmin}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-bold border border-red-500/50 flex items-center gap-1.5 transition-all shadow-sm"
              title="Authenticate as Admin (PIN: admin999) to add songs and set templates"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
              <span>Unlock Admin Access</span>
            </button>
          )}
        </div>

        {/* Success or Error Banners */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-bold flex items-center gap-2">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: PLAYER & CONTROLLER (CLEAN SONG LIST WITH FORM INFORMATION ONLY) */}
        {/* NO ADD, EDIT, OR DELETE BUTTONS. NO TEMPLATE FORM.                     */}
        {/* ========================================================================= */}
        {!isManagementRole ? (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            
            {/* Top Filter and Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131627] border border-[#232c49] p-3 rounded-2xl">
              <div>
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                  Available Songs ({filteredSongs.length})
                </span>
                <p className="text-[11px] text-slate-400">
                  Surface form summary: Intro cue length, ensemble cue instruments, and repetition loops.
                </p>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter song name or cue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0c0f1a] border border-[#263150] text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                />
              </div>
            </div>

            {/* Song Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredSongs.length > 0 ? (
                filteredSongs.map((song) => {
                  const isInstrumentMatch =
                    selectedInstrument && song.intro_instruments.includes(selectedInstrument);

                  return (
                    <div
                      key={song.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                        isInstrumentMatch
                          ? 'bg-amber-950/25 border-amber-500/60 shadow-glow-gold/10'
                          : 'bg-[#131728] border-[#242c47] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-base text-white tracking-tight leading-snug">
                            {song.title}
                          </h4>
                        </div>
                        {isInstrumentMatch && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-400 text-black font-extrabold flex items-center gap-1 shrink-0 shadow-sm">
                            <Flame className="w-3 h-3 fill-black" />
                            Your Cue
                          </span>
                        )}
                      </div>

                      {/* Song Form Surface Information */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1f263e] text-xs font-mono">
                        <div className="p-2 rounded-xl bg-[#0c0f1b] border border-[#1f263e]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Intro Form:</span>
                          <span className="font-bold text-cyan-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {song.intro_bar_count} Bars
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-[#0c0f1b] border border-[#1f263e]">
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Loop Form:</span>
                          <span className="font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                            <RotateCw className="w-3 h-3 text-amber-400" />
                            {song.loop_count} Cycles
                          </span>
                        </div>
                      </div>

                      {/* Cue Instruments Array */}
                      <div className="text-xs font-mono pt-0.5">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold mb-1">
                          Intro Cue Instruments:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {song.intro_instruments.map((inst) => {
                            const isMyInst = selectedInstrument === inst;
                            return (
                              <span
                                key={inst}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                  isMyInst
                                    ? 'bg-amber-400 text-black border-amber-300 font-bold'
                                    : 'bg-[#1b2238] text-slate-300 border-[#28324f]'
                                }`}
                              >
                                {inst}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-16 bg-[#111424] rounded-2xl border border-dashed border-[#242d48] space-y-2">
                  <Music className="w-10 h-10 mx-auto stroke-1 text-slate-600" />
                  <p className="text-sm font-bold text-slate-400">No songs match your search query</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: ADMIN & MAESTRO WORKSPACE                                        */
          /* FULL CAPABILITY: ADD NEW SONGS, SET TEMPLATE FORM, EDIT & DELETE.        */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto pr-1">
            
            {/* TEMPLATE SONG FORM (Col 1-5) */}
            <div className="lg:col-span-5 bg-[#131627] border border-[#252e4d] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                
                <div className="flex items-center justify-between border-b border-[#212942] pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h4 className="font-extrabold text-sm text-white font-mono uppercase">
                      {isEditing ? 'Edit Song Template' : 'Set Template Song Form'}
                    </h4>
                  </div>
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

                {/* Ceremony Template Presets Quick Fill */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="font-bold uppercase text-amber-400">Ceremony Template Presets:</span>
                    <span>Click to pre-fill</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TEMPLATE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#0c0f1a] hover:bg-[#1a2136] text-left text-xs font-semibold text-slate-300 hover:text-white border border-[#252f4c] hover:border-amber-500/50 transition-all flex items-center gap-1.5"
                      >
                        <span>{preset.icon}</span>
                        <span className="truncate">{preset.name.split('/')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Form Inputs (Strict 4 Fields) */}
                <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
                  
                  {/* Field 1: Song Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center justify-between">
                      <span>1. Song Title</span>
                      <span className="text-[10px] text-slate-500">Repertoire Name</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Gending Raja Berangkat"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0c0f1b] border border-[#2b3552] text-white text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Field 2: Intro Bar Count */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center justify-between">
                      <span>2. Intro Bar Count</span>
                      <span className="text-[10px] text-cyan-400 font-mono">{introBarCount} Bars</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="64"
                        required
                        value={introBarCount}
                        onChange={(e) => setIntroBarCount(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1.5 rounded-xl bg-[#0c0f1b] border border-[#2b3552] text-white font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex items-center gap-1">
                        {[0, 4, 8, 12, 16].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setIntroBarCount(b)}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                              introBarCount === b
                                ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                                : 'bg-[#181e30] border-[#293350] text-slate-300 hover:text-white'
                            }`}
                          >
                            {b}b
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">Number of bars played before full ensemble entry.</p>
                  </div>

                  {/* Field 3: Intro Cue Instruments */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 font-mono uppercase">
                        3. Intro Cue Instruments
                      </label>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={handleSelectAllInstruments}
                          className="text-amber-400 hover:underline"
                        >
                          All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleClearInstruments}
                          className="text-slate-400 hover:underline"
                        >
                          Clear
                        </button>
                        <span className="ml-1 text-amber-300">({introInstruments.length})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-[#0c0f1b] rounded-xl border border-[#262f4e]">
                      {GAMELAN_INSTRUMENTS.map((inst) => {
                        const isSelected = introInstruments.includes(inst);
                        return (
                          <button
                            key={inst}
                            type="button"
                            onClick={() => toggleInstrument(inst)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
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
                    <label className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center justify-between">
                      <span>4. Loop Count</span>
                      <span className="text-[10px] text-amber-400 font-mono">{loopCount} Cycles</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        required
                        value={loopCount}
                        onChange={(e) => setLoopCount(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 rounded-xl bg-[#0c0f1b] border border-[#2b3552] text-white font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex items-center gap-1">
                        {[1, 2, 4, 6, 8, 12].map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setLoopCount(l)}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                              loopCount === l
                                ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                                : 'bg-[#181e30] border-[#293350] text-slate-300 hover:text-white'
                            }`}
                          >
                            {l}x
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">Standard repetitions before conclusion.</p>
                  </div>

                  {/* Live Template Preview Card */}
                  <div className="p-3 rounded-xl bg-[#0c0e18] border border-[#242c46] space-y-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
                      Live Template Card Preview:
                    </span>
                    <div className="font-bold text-slate-200 truncate">
                      {title.trim() || 'Untitled Song'}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-cyan-400">{introBarCount} bars intro</span>
                      <span>•</span>
                      <span className="text-amber-400">{loopCount} loops</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">
                        {introInstruments.length ? introInstruments.join(', ') : 'No cue'}
                      </span>
                    </div>
                  </div>

                  {/* Submit Action */}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-glow-gold"
                  >
                    {isEditing ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Update Template in System</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Save Song Template into System</span>
                      </>
                    )}
                  </button>

                </form>

              </div>
            </div>

            {/* MASTER SONG REPERTOIRE LIST (Col 6-12) */}
            <div className="lg:col-span-7 space-y-3 flex flex-col">
              
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-white font-mono uppercase flex items-center gap-1.5">
                    <span>System Repertoire Repository</span>
                    <span className="text-amber-400 text-xs">({songs.length} Songs)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pre-configured song templates available for Maestros to sequence into any Sidang.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search song or cue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#141829] border border-[#273250] text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* List of Song Cards with Edit & Delete */}
              <div className="space-y-2.5 max-h-[490px] overflow-y-auto pr-1 flex-1">
                {filteredSongs.length > 0 ? (
                  filteredSongs.map((song) => (
                    <div
                      key={song.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        editingSongId === song.id
                          ? 'bg-[#1b1c33] border-amber-400 shadow-glow-gold/10'
                          : 'bg-[#131728] border-[#242c47] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-sm sm:text-base text-white truncate">
                              {song.title}
                            </h5>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              Template Ready
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-[#1c233c] text-cyan-400 font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {song.intro_bar_count} Intro Bars
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#1c233c] text-amber-400 font-semibold flex items-center gap-1">
                              <RotateCw className="w-3 h-3" />
                              {song.loop_count} Loops
                            </span>
                            <span className="text-slate-400 text-[11px] truncate max-w-[260px]">
                              Cue: <strong className="text-slate-300">{song.intro_instruments.join(', ')}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Actions (Edit & Delete) */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <button
                            onClick={() => handleStartEdit(song)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#1d243b] hover:bg-[#2a3454] text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1 border border-[#303c62]"
                            title="Edit Template Form"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => setSongToDelete(song)}
                            className="p-2 rounded-xl bg-[#1d243b] hover:bg-red-950 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/50 transition-all cursor-pointer"
                            title="Delete Song from Library"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-[#111424] rounded-2xl border border-dashed border-[#242d48] space-y-2">
                    <Music className="w-10 h-10 mx-auto stroke-1 text-slate-600" />
                    <p className="text-sm font-bold text-slate-400">No matching song templates found</p>
                    <p className="text-xs text-slate-500">
                      Use the form on the left to add a new song template into the system.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[#21273f] flex items-center justify-between text-xs text-slate-400">
          <span className="hidden sm:inline">
            {isManagementRole
              ? 'Admin Repertoire & Template Form System • Strictly Title, Intro Bars, Intro Instruments, and Loop Count'
              : 'Gamelan Repertoire Overview • Public Read-Only Access'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1a2034] hover:bg-[#252e4a] text-slate-200 font-bold transition-all ml-auto"
          >
            Close
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* IN-APP DELETE CONFIRMATION DIALOG (STABLE, RELIABLE, NO POPUP BLOCKER)     */}
      {/* ========================================================================= */}
      {songToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#121626] border-2 border-red-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">Delete Song from Library?</h4>
                <p className="text-xs text-slate-400">Master Repertoire Deletion</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0f1b] border border-[#242e4a] space-y-1.5 text-xs">
              <span className="text-slate-400 font-medium">You are deleting:</span>
              <p className="font-black text-sm text-red-300 truncate">
                {songToDelete.title}
              </p>
              <p className="text-[11px] text-slate-500">
                This song will be permanently removed from the master song library and unlinked from any scheduled setlists.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1a2034] hover:bg-[#242e48] text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Song'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
