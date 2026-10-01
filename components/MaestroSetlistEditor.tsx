'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { QueueItem, Song } from '@/types';
import {
  Sliders,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Shield,
  KeyRound,
  Check,
  Music,
  BookOpen,
  Eye,
  Lock,
  Unlock,
} from 'lucide-react';
import { OverrideModal } from './OverrideModal';
import { AddSidangModal } from './AddSidangModal';

interface MaestroSetlistEditorProps {
  onOpenLibrary: () => void;
  onJumpToStage: () => void;
}

export const MaestroSetlistEditor: React.FC<MaestroSetlistEditorProps> = ({
  onOpenLibrary,
  onJumpToStage,
}) => {
  const {
    sessions,
    parts,
    songs,
    queueItems,
    currentSession,
    currentPart,
    switchActiveSession,
    switchActivePart,
    deleteSession,
    addSongToPartQueue,
    removeQueueItem,
    reorderQueueItems,
    saveInstanceOverride,
    updatePartController,
    activeRole,
  } = useStage();

  // Selected session and part within the editor (can browse any Sidang / Bahagian)
  const [selectedSessionId, setSelectedSessionId] = useState(currentSession?.id || sessions[0]?.id);
  
  // Ensure selectedSessionId is valid
  const effectiveSessionId = sessions.some((s) => s.id === selectedSessionId)
    ? selectedSessionId
    : sessions[0]?.id || '';
  const currentSelectedSession = sessions.find((s) => s.id === effectiveSessionId) || sessions[0];
  const sessionParts = parts.filter((p) => p.session_id === effectiveSessionId);

  const [selectedPartId, setSelectedPartId] = useState(sessionParts[0]?.id || parts[0]?.id);
  const activePartObj = sessionParts.find((p) => p.id === selectedPartId) || sessionParts[0];

  // Add Sidang Modal state
  const [addSidangModalOpen, setAddSidangModalOpen] = useState(false);

  // Queue items for this specific Bahagian
  const partQueue = queueItems
    .filter((q) => q.part_id === activePartObj?.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Add Song state
  const [selectedSongToAdd, setSelectedSongToAdd] = useState(songs[0]?.id || '');

  // Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideQueueItem, setOverrideQueueItem] = useState<QueueItem | null>(null);
  const [overrideSong, setOverrideSong] = useState<Song | null>(null);

  // Controller passkey edit state
  const [controllerPasskeyInput, setControllerPasskeyInput] = useState(activePartObj?.controller_passkey || 'ctrl1');
  const [passkeySaved, setPasskeySaved] = useState(false);

  // Handlers for Queue Reordering
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const ordered = [...partQueue];
    const temp = ordered[index];
    ordered[index] = ordered[index - 1];
    ordered[index - 1] = temp;
    reorderQueueItems(activePartObj.id, ordered.map((q) => q.id));
  };

  const handleMoveDown = (index: number) => {
    if (index >= partQueue.length - 1) return;
    const ordered = [...partQueue];
    const temp = ordered[index];
    ordered[index] = ordered[index + 1];
    ordered[index + 1] = temp;
    reorderQueueItems(activePartObj.id, ordered.map((q) => q.id));
  };

  const handleAddSong = async () => {
    if (!selectedSongToAdd || !activePartObj) return;
    await addSongToPartQueue(activePartObj.id, selectedSongToAdd);
  };

  const handleOpenOverride = (queueItem: QueueItem) => {
    const song = songs.find((s) => s.id === queueItem.song_id) || null;
    setOverrideQueueItem(queueItem);
    setOverrideSong(song);
    setOverrideModalOpen(true);
  };

  const handleToggleControllerPermission = async () => {
    if (!activePartObj) return;
    await updatePartController(activePartObj.id, !activePartObj.controller_enabled);
  };

  const handleSaveControllerPasskey = async () => {
    if (!activePartObj || !controllerPasskeyInput.trim()) return;
    await updatePartController(activePartObj.id, activePartObj.controller_enabled, controllerPasskeyInput.trim());
    setPasskeySaved(true);
    setTimeout(() => setPasskeySaved(false), 2000);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;
    if (sessions.length <= 1) {
      alert('Cannot delete the only remaining Sidang. At least one Sidang must remain in the system.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete ${targetSession.name}? All 4 Bahagian and associated songs in this Sidang will be removed.`
    );
    if (!confirmed) return;

    await deleteSession(sessionId);
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length > 0) {
      setSelectedSessionId(remaining[0].id);
      const remainingParts = parts.filter((p) => p.session_id === remaining[0].id);
      if (remainingParts.length > 0) {
        setSelectedPartId(remainingParts[0].id);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Top Header & Fast Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0e111d] border border-[#232a42] rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest font-bold text-amber-400">
              Maestro Setlist Director
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40">
              Flexible Sidang Sequencing
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Konvokesyen Queue & Setlist Editor
          </h2>
          <p className="text-xs text-slate-400">
            Structure and sequence live Gamelan repertoire per numbered Sidang and Bahagian. Add flexible ceremony sessions, configure one-time special overrides, and delegate stage controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddSidangModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black transition-all flex items-center gap-2 shadow-glow-gold"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New Sidang</span>
          </button>

          <button
            onClick={onOpenLibrary}
            className="px-4 py-2.5 rounded-xl bg-[#171c2e] hover:bg-[#232b45] text-slate-200 text-xs font-bold border border-[#2e3756] transition-all flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Master Song Library ({songs.length})</span>
          </button>

          <button
            onClick={onJumpToStage}
            className="px-4 py-2.5 rounded-xl bg-[#1b2238] hover:bg-[#263050] text-slate-200 text-xs font-bold transition-all flex items-center gap-2 border border-[#2e3b5e]"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>View Live Stage</span>
          </button>
        </div>
      </div>

      {/* Sidang (Session) & Bahagian (Part) Tabs Bar */}
      <div className="space-y-3">
        {/* Sidang Level Tabs Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e111d] border border-[#232a42] p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase font-bold text-slate-400 mr-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>SIDANG:</span>
            </span>

            {sessions.map((s) => {
              const isSelected = effectiveSessionId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    const sParts = parts.filter((p) => p.session_id === s.id);
                    if (sParts.length) setSelectedPartId(sParts[0].id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-[#121523] border-[#22283e] text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-400">
                    {s.code}
                  </span>
                </button>
              );
            })}

            {/* Quick Add Sidang Button */}
            <button
              onClick={() => setAddSidangModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-dashed border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 shadow-sm"
              title="Add a new numbered Sidang"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sidang</span>
            </button>
          </div>

          {/* Current Sidang Info & Delete Button */}
          {currentSelectedSession && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="hidden sm:inline">
                Passkey: <strong className="text-purple-400">{currentSelectedSession.maestro_passkey}</strong>
              </span>
              {sessions.length > 1 && (
                <button
                  onClick={() => handleDeleteSession(currentSelectedSession.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-500/30 text-[11px] font-mono flex items-center gap-1 transition-all"
                  title={`Delete ${currentSelectedSession.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Sidang</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bahagian (Parts 1-4) Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {sessionParts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPartId(p.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                activePartObj?.id === p.id
                  ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                  : 'bg-[#111422] border-[#21273f] text-slate-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400">
                  Bahagian {p.part_number}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/40 text-slate-300">
                  {queueItems.filter((q) => q.part_id === p.id).length} songs
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Setlist Workspace Grid: Setlist on Left, Controller Delegation & Add Song on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SETLIST ORDERED QUEUE (Col 1-8) */}
        <div className="lg:col-span-8 bg-[#0e111d] border border-[#232a42] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f263d] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-extrabold text-white text-base">
                  {activePartObj?.name}
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Active Queue Setlist • Reorder positions or apply one-time special overrides
              </p>
            </div>

            <button
              onClick={() => {
                switchActivePart(activePartObj.id);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#192033] hover:bg-cyan-500 hover:text-black text-cyan-300 text-xs font-bold transition-all border border-[#2d3a5a]"
              title="Set this Bahagian as the active stage broadcast"
            >
              Broadcast This Bahagian Live
            </button>
          </div>

          {/* Queue List Items */}
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {partQueue.length > 0 ? (
              partQueue.map((queueItem, index) => {
                const song = songs.find((s) => s.id === queueItem.song_id);
                if (!song) return null;

                const hasOverride =
                  queueItem.override_intro_bar_count !== null ||
                  queueItem.override_intro_instruments !== null ||
                  queueItem.override_loop_count !== null;

                const effectiveBars = queueItem.override_intro_bar_count ?? song.intro_bar_count;
                const effectiveLoops = queueItem.override_loop_count ?? song.loop_count;
                const effectiveInstruments = queueItem.override_intro_instruments ?? song.intro_instruments;

                return (
                  <div
                    key={queueItem.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasOverride
                        ? 'bg-[#15172b] border-purple-500/50 shadow-sm'
                        : 'bg-[#121524] border-[#222941] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      
                      {/* Left: Position & Title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#1c2236] border border-[#2d3655] flex items-center justify-center font-mono font-bold text-xs text-amber-400 shrink-0">
                          #{index + 1}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-white text-sm sm:text-base truncate">
                              {song.title}
                            </h4>
                            {hasOverride && (
                              <span className="text-[10px] font-mono uppercase font-extrabold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/50 shrink-0">
                                Overridden
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                            <span>
                              Intro: <strong className="text-cyan-400">{effectiveBars} bars</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Loops: <strong className="text-amber-400">{effectiveLoops}x</strong>
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[220px]">
                              Cue: <strong className="text-slate-300">{effectiveInstruments.join(', ') || 'None'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions (Move Up/Down, Override, Delete) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Move Up */}
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-2 rounded-xl bg-[#1a2034] hover:bg-[#252e4b] disabled:opacity-30 text-slate-300"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        {/* Move Down */}
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === partQueue.length - 1}
                          className="p-2 rounded-xl bg-[#1a2034] hover:bg-[#252e4b] disabled:opacity-30 text-slate-300"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Special Override Button */}
                        <button
                          onClick={() => handleOpenOverride(queueItem)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            hasOverride
                              ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400'
                              : 'bg-[#1d2338] hover:bg-purple-950/60 hover:text-purple-300 hover:border-purple-500/50 text-slate-300 border-[#2d3654]'
                          }`}
                          title="Configure One-Time Special Overrides"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Override</span>
                        </button>

                        {/* Remove from Queue */}
                        <button
                          onClick={() => removeQueueItem(queueItem.id)}
                          className="p-2 rounded-xl bg-[#1a2034] hover:bg-red-950 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/50 transition-all"
                          title="Remove from Queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 bg-[#111422] rounded-2xl border border-dashed border-[#242c46] space-y-2">
                <Music className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
                <p className="text-sm font-bold text-slate-400">Queue is Currently Empty</p>
                <p className="text-xs text-slate-500">
                  Select a song from the library panel on the right to add to this Bahagian.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* SIDE CONTROLS: ADD SONG & CONTROLLER DELEGATION (Col 9-12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Add Song to Queue Card */}
          <div className="bg-[#0e111d] border border-[#232a42] rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f263d] pb-3">
              <Plus className="w-4 h-4 text-amber-400" />
              <h4 className="font-extrabold text-sm text-white uppercase font-mono">
                Add Song to Bahagian
              </h4>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-400 font-bold block">
                Choose Repertoire Template:
              </label>
              <select
                value={selectedSongToAdd}
                onChange={(e) => setSelectedSongToAdd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#121626] border border-[#28324e] text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.intro_bar_count}b intro, {s.loop_count}x loops)
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddSong}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-glow-gold"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Append to Queue</span>
              </button>
            </div>
          </div>

          {/* Delegated Controller Permission Card */}
          <div className="bg-[#0e111d] border border-[#232a42] rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f263d] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <h4 className="font-extrabold text-sm text-white uppercase font-mono">
                  Controller Delegation
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-400">
                Bahagian {activePartObj?.part_number}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              The Maestro can assign or revoke live navigation control (Next/Prev/Jump) for this specific Bahagian.
            </p>

            {/* Permission Toggle */}
            <div className="p-3.5 rounded-2xl bg-[#131726] border border-[#252d47] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  {activePartObj?.controller_enabled ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Controller Access Active</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-red-400" />
                      <span>Controller Disabled</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activePartObj?.controller_enabled
                    ? 'Delegated user can advance songs'
                    : 'Stage navigation locked to Maestro/Admin'}
                </div>
              </div>

              <button
                onClick={handleToggleControllerPermission}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  activePartObj?.controller_enabled
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 hover:bg-emerald-600/40'
                    : 'bg-red-600/30 border-red-500 text-red-300 hover:bg-red-600/40'
                }`}
              >
                {activePartObj?.controller_enabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            {/* Delegated Passkey Input */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center justify-between">
                <span>Delegated Passkey:</span>
                {passkeySaved && (
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Saved!
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={controllerPasskeyInput}
                  onChange={(e) => setControllerPasskeyInput(e.target.value)}
                  placeholder="e.g. ctrl1"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0c0f1a] border border-[#2c3654] text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  onClick={handleSaveControllerPasskey}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xs transition-all"
                >
                  Save
                </button>
              </div>
              <div className="text-[10px] text-slate-500">
                Share this passkey with your live stage controller operator.
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* One-Time Special Override Modal */}
      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        queueItem={overrideQueueItem}
        song={overrideSong}
        onSaveOverride={saveInstanceOverride}
      />

      {/* Add Flexible Sidang Modal */}
      <AddSidangModal
        isOpen={addSidangModalOpen}
        onClose={() => setAddSidangModalOpen(false)}
        onCreated={(newSession) => {
          setSelectedSessionId(newSession.id);
        }}
      />

    </div>
  );
};
