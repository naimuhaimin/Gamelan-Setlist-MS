'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { GAMELAN_INSTRUMENTS, GamelanInstrument, RoleType } from '@/types';
import {
  Radio,
  Sliders,
  ShieldCheck,
  UserCheck,
  Music,
  ChevronDown,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  Layers,
  KeyRound,
  Eye,
  Plus,
  BookOpen,
} from 'lucide-react';
import { AddSidangModal } from './AddSidangModal';

interface NavbarProps {
  onOpenRoleModal: () => void;
  onOpenLibraryModal: () => void;
  activeTab: 'stage' | 'editor';
  setActiveTab: (tab: 'stage' | 'editor') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenRoleModal,
  onOpenLibraryModal,
  activeTab,
  setActiveTab,
}) => {
  const {
    sessions,
    parts,
    currentSession,
    currentPart,
    activeRole,
    selectedInstrument,
    selectInstrument,
    connectionStatus,
    logoutRole,
    switchActiveSession,
    switchActivePart,
  } = useStage();

  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [partDropdownOpen, setPartDropdownOpen] = useState(false);
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState(false);
  const [addSidangModalOpen, setAddSidangModalOpen] = useState(false);

  const canEdit = activeRole === 'maestro' || activeRole === 'admin';

  return (
    <header className="sticky top-0 z-50 bg-[#0c0e17]/95 backdrop-blur-md border-b border-[#1f2438] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          
          {/* Brand & Stage Indicators */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-glow-gold">
                <Music className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div className="hidden md:block">
                <h1 className="font-extrabold text-base tracking-tight leading-none text-white flex items-center gap-2">
                  GAMELAN SYNC
                  <span className="text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Konvo
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Stage Queue & Real-Time Cue</p>
              </div>
            </div>

            {/* Session (Sidang) Selector / Indicator */}
            <div className="relative">
              <button
                onClick={() => canEdit && setSessionDropdownOpen(!sessionDropdownOpen)}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  canEdit
                    ? 'bg-[#161a29] border-[#29324d] hover:border-amber-500/60 text-amber-300'
                    : 'bg-[#121522] border-[#22283d] text-slate-200 cursor-default'
                }`}
                title={canEdit ? 'Switch Session (Maestro/Admin)' : 'Current Active Session'}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block sm:hidden" />
                <span className="font-mono text-amber-400">[{currentSession?.code || 'SIDANG'}]</span>
                <span className="hidden sm:inline max-w-[130px] truncate">{currentSession?.name || 'Sidang'}</span>
                {canEdit && <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />}
              </button>

              {sessionDropdownOpen && canEdit && (
                <div className="absolute left-0 mt-2 w-64 bg-[#121522] border border-[#2d3550] rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between">
                    <span>Select Active Sidang</span>
                    <span className="text-amber-400">{sessions.length} Available</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {[...sessions]
                      .sort((a, b) => (a.sidang_number || 0) - (b.sidang_number || 0))
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            switchActiveSession(s.id);
                            setSessionDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                            s.id === currentSession?.id
                              ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                              : 'text-slate-300 hover:bg-[#1c2237]'
                          }`}
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-400">
                            {s.code}
                          </span>
                        </button>
                      ))}
                  </div>

                  {/* Add New Sidang Shortcut */}
                  <div className="pt-1.5 mt-1 border-t border-[#232a42]">
                    <button
                      onClick={() => {
                        setSessionDropdownOpen(false);
                        setAddSidangModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:bg-amber-500/15 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Add New Sidang...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Part (Bahagian) Selector / Indicator */}
            <div className="relative">
              <button
                onClick={() => canEdit && setPartDropdownOpen(!partDropdownOpen)}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  canEdit
                    ? 'bg-[#161a29] border-[#29324d] hover:border-cyan-500/60 text-cyan-300'
                    : 'bg-[#121522] border-[#22283d] text-slate-200 cursor-default'
                }`}
                title={canEdit ? 'Switch Bahagian (Maestro/Admin)' : 'Current Active Bahagian'}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bahagian {currentPart?.part_number || 1}</span>
                {canEdit && <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />}
              </button>

              {partDropdownOpen && canEdit && (
                <div className="absolute left-0 mt-2 w-72 bg-[#121522] border border-[#2d3550] rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1">
                    Select Active Bahagian
                  </div>
                  {parts
                    .filter((p) => p.session_id === currentSession?.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          switchActivePart(p.id);
                          setPartDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                          p.id === currentPart?.id
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                            : 'text-slate-300 hover:bg-[#1c2237]'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-cyan-400 ml-2 shrink-0">
                          B{p.part_number}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Connection Status Indicator */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wide border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : connectionStatus === 'demo_local'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>SUPABASE REALTIME</span>
                </>
              ) : connectionStatus === 'demo_local' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>LOCAL CROSS-TAB SYNC</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-400" />
                  <span>RECONNECTING</span>
                </>
              )}
            </div>
          </div>

          {/* Right Controls: Tab Switcher, Instrument Picker, Role Passkey */}
          <div className="flex items-center gap-2">
            
            {/* View Tab Selector for Maestro/Admin */}
            {canEdit && (
              <div className="flex items-center bg-[#131726] p-1 rounded-xl border border-[#242b44]">
                <button
                  onClick={() => setActiveTab('stage')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'stage'
                      ? 'bg-amber-500 text-black shadow-glow-gold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Stage</span>
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'editor'
                      ? 'bg-amber-500 text-black shadow-glow-gold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Setlist Editor</span>
                </button>
              </div>
            )}

            {/* Song Library / Template Manager Button (Admin / Maestro Repertoire) */}
            <button
              onClick={onOpenLibraryModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                activeRole === 'admin'
                  ? 'bg-red-950/40 border-red-500/60 text-red-300 hover:bg-red-900/50 shadow-sm'
                  : 'bg-[#151928] border-[#29324e] hover:border-amber-500/60 text-slate-200 hover:text-amber-300'
              }`}
              title={
                activeRole === 'admin'
                  ? 'Admin: Add songs and set template song form'
                  : 'Open Repertoire Template Library'
              }
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Song Library</span>
              {activeRole === 'admin' && (
                <span className="text-[9px] font-mono uppercase font-black px-1.5 py-0.5 rounded bg-red-600 text-white shadow-sm">
                  Admin
                </span>
              )}
            </button>

            {/* Instrument Filter Selector (Player Cue Highlighting) */}
            <div className="relative">
              <button
                onClick={() => setInstrumentDropdownOpen(!instrumentDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedInstrument
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-[#151928] border-[#29324e] text-slate-300 hover:border-slate-500'
                }`}
                title="Select your Gamelan instrument to trigger personal cue highlights"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-slate-400">My Instrument:</span>
                <span className="font-bold text-white max-w-[110px] truncate">
                  {selectedInstrument || 'All Instruments'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {instrumentDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#121522] border border-[#2d3550] rounded-xl shadow-2xl p-2 z-50 animate-fade-in max-h-96 overflow-y-auto">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-[#22283d] mb-1">
                    Select Your Instrument Cue
                  </div>
                  <button
                    onClick={() => {
                      selectInstrument(null);
                      setInstrumentDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-colors ${
                      !selectedInstrument
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-slate-300 hover:bg-[#1a2033]'
                    }`}
                  >
                    View All (No Highlight)
                  </button>
                  {GAMELAN_INSTRUMENTS.map((inst) => (
                    <button
                      key={inst}
                      onClick={() => {
                        selectInstrument(inst as GamelanInstrument);
                        setInstrumentDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedInstrument === inst
                          ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-slate-300 hover:bg-[#1a2033]'
                      }`}
                    >
                      <span>{inst}</span>
                      {selectedInstrument === inst && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Role Badge & Passkey Switch Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenRoleModal}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  activeRole === 'admin'
                    ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'
                    : activeRole === 'maestro'
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30'
                    : activeRole === 'controller'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30'
                    : 'bg-[#151928] border-[#29324e] text-slate-300 hover:border-slate-500'
                }`}
                title="Switch Role or Enter Passkey"
              >
                {activeRole === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-red-400" />}
                {activeRole === 'maestro' && <KeyRound className="w-3.5 h-3.5 text-purple-400" />}
                {activeRole === 'controller' && <Sliders className="w-3.5 h-3.5 text-cyan-400" />}
                {activeRole === 'player' && <UserCheck className="w-3.5 h-3.5 text-slate-400" />}
                <span className="capitalize">{activeRole}</span>
              </button>

              {activeRole !== 'player' && (
                <button
                  onClick={logoutRole}
                  className="p-1.5 rounded-xl bg-[#161a29] border border-[#29324d] text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all"
                  title="Logout to Player View"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Add New Sidang Modal for Maestro/Admin */}
      <AddSidangModal
        isOpen={addSidangModalOpen}
        onClose={() => setAddSidangModalOpen(false)}
      />
    </header>
  );
};
