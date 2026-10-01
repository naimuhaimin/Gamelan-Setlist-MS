'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { RoleType } from '@/types';
import {
  ShieldCheck,
  KeyRound,
  Sliders,
  UserCheck,
  X,
  Lock,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface RoleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleLoginModal: React.FC<RoleLoginModalProps> = ({ isOpen, onClose }) => {
  const { activeRole, currentSession, currentPart, loginRole, logoutRole } = useStage();

  const [selectedRole, setSelectedRole] = useState<RoleType>(activeRole);
  const [passkey, setPasskey] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPasskey('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = loginRole(selectedRole, passkey.trim());
    if (result.success) {
      setSuccessMsg(`Successfully authenticated as ${selectedRole.toUpperCase()}`);
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setErrorMsg(result.message || 'Authentication failed. Check passkey.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#101423] border-2 border-[#2b3552] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-white space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Multi-Role Access Control System</span>
          </div>
          <h3 className="text-2xl font-black text-white">Switch Stage Role</h3>
          <p className="text-xs text-slate-400">
            Access levels are isolated by Master PIN, Session Passkey, or Delegated Controller Passkey.
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Player View */}
          <button
            type="button"
            onClick={() => handleRoleSelect('player')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedRole === 'player'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                : 'bg-[#15192a] border-[#252e4a] text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase mb-1">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Player View</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Public read-only stage sync & instrument cue highlights.
            </div>
          </button>

          {/* 2. Controller */}
          <button
            type="button"
            onClick={() => handleRoleSelect('controller')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedRole === 'controller'
                ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                : 'bg-[#15192a] border-[#252e4a] text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase mb-1">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Controller</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Live Next/Prev/Jump navigation delegated per Bahagian.
            </div>
          </button>

          {/* 3. Maestro */}
          <button
            type="button"
            onClick={() => handleRoleSelect('maestro')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedRole === 'maestro'
                ? 'bg-purple-500/20 border-purple-400 text-white shadow-sm'
                : 'bg-[#15192a] border-[#252e4a] text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase mb-1">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>Maestro</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Setlist editor, instance overrides, & controller delegation.
            </div>
          </button>

          {/* 4. Admin */}
          <button
            type="button"
            onClick={() => handleRoleSelect('admin')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedRole === 'admin'
                ? 'bg-red-500/20 border-red-400 text-white shadow-sm'
                : 'bg-[#15192a] border-[#252e4a] text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase mb-1">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span>Master Admin</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Full master rights over user roles, sessions, and database.
            </div>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Passkey Input Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {selectedRole === 'player' ? (
            <div className="p-4 rounded-2xl bg-[#141829] border border-[#242c46] text-xs text-slate-300 space-y-1">
              <p className="font-bold text-white">No Passkey Required for Players</p>
              <p className="text-slate-400">
                Stage monitors, players, and musicians connect freely via room code or read-only display link.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase font-bold text-slate-300 flex items-center justify-between">
                <span>Enter {selectedRole.toUpperCase()} Passkey / PIN:</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {selectedRole === 'admin' && 'PIN: admin999'}
                  {selectedRole === 'maestro' && `Passkey: ${currentSession?.maestro_passkey || 'sidang1'}`}
                  {selectedRole === 'controller' && `Passkey: ${currentPart?.controller_passkey || 'ctrl1'}`}
                </span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder={`Enter ${selectedRole} passkey...`}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0c0f1a] border border-[#2d3754] text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-24"
                />
                {/* Quick Auto-fill button for smooth testing */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRole === 'admin') setPasskey('admin999');
                    if (selectedRole === 'maestro') setPasskey(currentSession?.maestro_passkey || 'sidang1');
                    if (selectedRole === 'controller') setPasskey(currentPart?.controller_passkey || 'ctrl1');
                  }}
                  className="absolute right-2 top-2 px-2.5 py-1.5 rounded-lg bg-[#1c233a] hover:bg-[#283252] text-slate-300 text-[10px] font-mono font-bold"
                >
                  Quick Fill
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            {activeRole !== 'player' ? (
              <button
                type="button"
                onClick={() => {
                  logoutRole();
                  onClose();
                }}
                className="text-xs text-red-400 hover:text-red-300 font-bold underline"
              >
                Logout to Public View
              </button>
            ) : <div />}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-glow-gold"
            >
              <span>{selectedRole === 'player' ? 'Switch to Player' : 'Authenticate Role'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Demo Helper Callout */}
        <div className="p-3.5 rounded-2xl bg-[#0c0e18] border border-[#1f263e] flex items-start gap-3 text-xs text-slate-400">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-200">Default Passkeys in Database Seed:</span>
            <div className="font-mono text-[11px] text-slate-400 grid grid-cols-2 gap-1 pt-1">
              <span>Admin Master PIN: <strong className="text-amber-400">admin999</strong></span>
              <span>Maestro Sidang: <strong className="text-purple-400">sidang1 (or sidang&lt;N&gt;)</strong></span>
              <span>Controller Bahagian: <strong className="text-cyan-400">ctrl1</strong></span>
              <span>Player: <strong className="text-emerald-400">Public (No PIN)</strong></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
