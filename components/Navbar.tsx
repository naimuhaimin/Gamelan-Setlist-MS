'use client';

import React, { useState, useEffect } from 'react';
import { useStage } from '@/lib/stageContext';
import { GamelanInstrument, RoleType } from '@/types';
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
import { InstrumentManagementModal } from './InstrumentManagementModal';

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
    instruments,
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
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [addSidangModalOpen, setAddSidangModalOpen] = useState(false);
  const [instrumentModalOpen, setInstrumentModalOpen] = useState(false);

  const canEdit = activeRole === 'maestro' || activeRole === 'admin';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-scope')) {
        setSessionDropdownOpen(false);
        setPartDropdownOpen(false);
        setInstrumentDropdownOpen(false);
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#0c0e17]/95 backdrop-blur-md border-b border-[#1f2438] text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2">
          
          {/* LEFT: Brand Logo + Ceremony Breadcrumb Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Logo & Title */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-glow-gold shrink-0">
                <Music className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-white flex items-center gap-1.5">
                  GAMELAN SYNC
                  <span className="text-[9px] font-mono tracking-widest uppercase px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Konvo
                  </span>
                </h1>
                <p className="hidden xl:block text-[10px] text-slate-400 font-medium">Stage Queue & Real-Time Cue</p>
              </div>
            </div>

            {/* Unified Ceremony Breadcrumb: [ Sidang ▾ | Bahagian ▾ ] */}
            <div className="flex items-center bg-[#131726] p-0.5 rounded-xl border border-[#232b42] text-xs">
              
              {/* Sidang Selector */}
              <div className="relative dropdown-scope">
                <button
                  onClick={() => {
                    if (canEdit) {
                      setSessionDropdownOpen(!sessionDropdownOpen);
                      setPartDropdownOpen(false);
                      setAdminMenuOpen(false);
                      setInstrumentDropdownOpen(false);
                    }
                  }}
                  disabled={!canEdit}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                    canEdit
                      ? 'hover:bg-[#1a2034] text-amber-300'
                      : 'text-slate-200 cursor-default'
                  }`}
                  title={canEdit ? 'Switch Session (Maestro/Admin)' : 'Current Active Session'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block sm:hidden" />
                  <span className="font-mono text-amber-400 font-bold">[{currentSession?.code || 'S1'}]</span>
                  <span className="hidden md:inline max-w-[100px] truncate">{currentSession?.name || 'Sidang'}</span>
                  {canEdit && <ChevronDown className="w-3 h-3 text-slate-400" />}
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

              {/* Separator Divider */}
              <div className="w-px h-4 bg-[#232b42] mx-0.5" />

              {/* Bahagian Selector */}
              <div className="relative dropdown-scope">
                <button
                  onClick={() => {
                    if (canEdit) {
                      setPartDropdownOpen(!partDropdownOpen);
                      setSessionDropdownOpen(false);
                      setAdminMenuOpen(false);
                      setInstrumentDropdownOpen(false);
                    }
                  }}
                  disabled={!canEdit}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                    canEdit
                      ? 'hover:bg-[#1a2034] text-cyan-300'
                      : 'text-slate-200 cursor-default'
                  }`}
                  title={canEdit ? 'Switch Bahagian (Maestro/Admin)' : 'Current Active Bahagian'}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bahagian {currentPart?.part_number || 1}</span>
                  {canEdit && <ChevronDown className="w-3 h-3 text-slate-400" />}
                </button>

                {partDropdownOpen && canEdit && (
                  <div className="absolute left-0 mt-2 w-56 bg-[#121522] border border-[#2d3550] rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in">
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

            </div>

          </div>

          {/* RIGHT: View Tabs, Admin Menu / Song Library, Instrument Cue, Role Badge, Connection */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* View Tab Switcher for Maestro/Admin */}
            {canEdit && (
              <div className="flex items-center bg-[#131726] p-1 rounded-xl border border-[#242b44]">
                <button
                  onClick={() => setActiveTab('stage')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'stage'
                      ? 'bg-amber-500 text-black shadow-glow-gold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="View Live Stage Projection"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stage</span>
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'editor'
                      ? 'bg-amber-500 text-black shadow-glow-gold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="View Maestro Setlist Editor"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editor</span>
                </button>
              </div>
            )}

            {/* ADMIN STUDIO TOOLS DROPDOWN (Consolidates Song Library & Instruments & Sidang) */}
            {activeRole === 'admin' ? (
              <div className="relative dropdown-scope">
                <button
                  onClick={() => {
                    setAdminMenuOpen(!adminMenuOpen);
                    setSessionDropdownOpen(false);
                    setPartDropdownOpen(false);
                    setInstrumentDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    adminMenuOpen
                      ? 'bg-red-900/60 border-red-400 text-white shadow-md'
                      : 'bg-red-950/40 border-red-500/50 text-red-300 hover:bg-red-900/40 hover:border-red-400'
                  }`}
                  title="Admin Tools: Song Library & Instruments Ensemble"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                  <span>Admin Tools</span>
                  <ChevronDown className="w-3 h-3 text-red-400 ml-0.5" />
                </button>

                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#121522] border border-[#2d3550] rounded-2xl shadow-2xl p-1.5 z-50 animate-fade-in space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-[#212840] flex items-center justify-between">
                      <span>Admin Management</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                        Master
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setAdminMenuOpen(false);
                        onOpenLibraryModal();
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs hover:bg-[#1a2034] text-slate-200 transition-colors flex items-center gap-2.5 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:border-amber-400">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white group-hover:text-amber-300 transition-colors">Song Library</div>
                        <div className="text-[10px] text-slate-400 truncate">Repertoire & template forms</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setAdminMenuOpen(false);
                        setInstrumentModalOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs hover:bg-[#1a2034] text-slate-200 transition-colors flex items-center gap-2.5 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 group-hover:border-red-400">
                        <Sparkles className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white group-hover:text-red-300 transition-colors">Manage Instruments</div>
                        <div className="text-[10px] text-slate-400 truncate">Add, edit, delete ({instruments.length})</div>
                      </div>
                    </button>

                    <div className="pt-1 border-t border-[#1f263d]">
                      <button
                        onClick={() => {
                          setAdminMenuOpen(false);
                          setAddSidangModalOpen(true);
                        }}
                        className="w-full text-left p-2 rounded-xl text-xs hover:bg-[#1a2034] text-slate-300 transition-colors flex items-center gap-2.5 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:border-emerald-400">
                          <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">Add New Sidang</div>
                          <div className="text-[10px] text-slate-400 truncate">Create numbered ceremony</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Non-Admin: Single Standard Song Library Button */
              <button
                onClick={onOpenLibraryModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all bg-[#151928] border-[#29324e] hover:border-amber-500/60 text-slate-200 hover:text-amber-300"
                title="Open Repertoire Template Library"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Song Library</span>
              </button>
            )}

            {/* Instrument Cue Filter Selector (Compact) */}
            <div className="relative dropdown-scope">
              <button
                onClick={() => {
                  setInstrumentDropdownOpen(!instrumentDropdownOpen);
                  setSessionDropdownOpen(false);
                  setPartDropdownOpen(false);
                  setAdminMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedInstrument
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-[#151928] border-[#29324e] text-slate-300 hover:border-slate-500'
                }`}
                title="Select your Gamelan instrument to trigger personal cue highlights"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-white max-w-[85px] sm:max-w-[100px] truncate">
                  {selectedInstrument || 'All Cues'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
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
                  {instruments.map((inst) => (
                    <button
                      key={inst}
                      onClick={() => {
                        selectInstrument(inst);
                        setInstrumentDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedInstrument === inst
                          ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-slate-300 hover:bg-[#1a2033]'
                      }`}
                    >
                      <span className="truncate">{inst}</span>
                      {selectedInstrument === inst && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 ml-1" />
                      )}
                    </button>
                  ))}

                  {/* Admin Manage Instruments Shortcut inside dropdown */}
                  {activeRole === 'admin' && (
                    <div className="pt-1.5 mt-1 border-t border-[#232a42]">
                      <button
                        onClick={() => {
                          setInstrumentDropdownOpen(false);
                          setInstrumentModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:bg-amber-500/15 flex items-center gap-1.5 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Manage Instruments (Admin)...</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role Badge & Passkey Switch Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenRoleModal}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
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

            {/* Compact Connection Status Pill on Far Right */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-mono border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : connectionStatus === 'demo_local'
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
              title={
                connectionStatus === 'connected'
                  ? 'Connected to Supabase Realtime Sync'
                  : connectionStatus === 'demo_local'
                  ? 'Local Cross-Tab Sync Active'
                  : 'Reconnecting to stage channel'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStatus === 'demo_local'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <span className="hidden xl:inline">
                {connectionStatus === 'connected' ? 'REALTIME' : 'LOCAL'}
              </span>
            </div>

          </div>

        </div>
      </div>

      {/* Add New Sidang Modal for Maestro/Admin */}
      <AddSidangModal
        isOpen={addSidangModalOpen}
        onClose={() => setAddSidangModalOpen(false)}
      />

      {/* Instrument Management Modal for Admin */}
      <InstrumentManagementModal
        isOpen={instrumentModalOpen}
        onClose={() => setInstrumentModalOpen(false)}
      />
    </header>
  );
};
