'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  KeyRound,
  ListMusic,
  LogIn,
  LogOut,
  MonitorPlay,
  QrCode,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import logoMark from '@/assets/logo-mark.png';
import { cx } from './ui';

export type Tab = 'stage' | 'setlist' | 'library';

const ROLE_LABEL = { player: 'Musician', controller: 'Controller', maestro: 'Maestro', admin: 'Admin' } as const;

interface TopBarProps {
  tab: Tab;
  onTab: (t: Tab) => void;
  onLogin: () => void;
  onPickInstrument: () => void;
  onShare: () => void;
  onInstruments: () => void;
  onAccess: () => void;
}

export function TopBar({ tab, onTab, onLogin, onPickInstrument, onShare, onInstruments, onAccess }: TopBarProps) {
  const { role, isManager, selectedInstrument, connection, logout, liveSession, livePart } = useStage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menuOpen]);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'stage', label: 'Stage', icon: <MonitorPlay className="w-4 h-4" /> },
    ...(isManager ? [{ id: 'setlist' as Tab, label: 'Setlist', icon: <SlidersHorizontal className="w-4 h-4" /> }] : []),
    { id: 'library', label: 'Library', icon: <ListMusic className="w-4 h-4" /> },
  ];

  const tabBar = (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-line" aria-label="Views">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
          className={cx(
            'flex-1 sm:flex-none h-9 px-3.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors',
            tab === t.id ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  );

  const menuItem = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      className={cx(
        'w-full flex items-center gap-3 px-3 h-11 rounded-lg text-sm text-left transition-colors',
        danger ? 'text-danger hover:bg-red-500/10' : 'text-ink hover:bg-raised'
      )}
    >
      <span className={danger ? 'text-danger' : 'text-muted'}>{icon}</span>
      {label}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoMark.src}
              alt="Anjung Seni"
              width={36}
              height={36}
              className="w-9 h-9 rounded-xl shrink-0 ring-1 ring-line object-cover"
            />
            <div className="min-w-0 hidden min-[420px]:block">
              <div className="leading-none flex items-baseline gap-1.5" aria-label="Anjung Live">
                <span className="font-script text-[1.65rem] text-ink -mb-0.5">Anjung</span>
                <span className="font-display text-[0.7rem] font-semibold tracking-[0.28em] text-brass">LIVE</span>
              </div>
              <div className="text-xs text-muted truncate leading-tight">
                {liveSession && livePart ? `${liveSession.name} · ${livePart.name}` : 'Konvokesyen'}
              </div>
            </div>
          </div>

          <div className="hidden md:block mx-auto">{tabBar}</div>

          <div className="ml-auto flex items-center gap-2">
            {/* Instrument */}
            <button
              onClick={onPickInstrument}
              className={cx(
                'h-10 px-3 rounded-xl border text-sm font-medium inline-flex items-center gap-2 max-w-[44vw] transition-colors',
                selectedInstrument
                  ? 'border-brass/50 bg-brass-soft text-brass'
                  : 'border-line bg-surface text-muted hover:text-ink'
              )}
              title="Choose your instrument"
            >
              <span className="truncate">{selectedInstrument ?? 'Instrument'}</span>
              <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
            </button>

            {/* Account */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Account: ${ROLE_LABEL[role]}`}
                className="h-10 pl-2.5 pr-2 rounded-xl border border-line bg-surface hover:border-line-strong inline-flex items-center gap-2 text-sm font-medium"
              >
                <span className="relative">
                  {role === 'admin' ? (
                    <ShieldCheck className="w-5 h-5 text-brass" />
                  ) : role === 'player' ? (
                    <UserRound className="w-5 h-5 text-muted" />
                  ) : (
                    <KeyRound className="w-5 h-5 text-brass" />
                  )}
                  <span
                    className={cx(
                      'absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface',
                      connection === 'live' ? 'bg-ok' : connection === 'connecting' ? 'bg-brass' : 'bg-live'
                    )}
                  />
                </span>
                <span className="hidden sm:inline">{ROLE_LABEL[role]}</span>
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface shadow-2xl p-1.5 animate-fade-in"
                >
                  <div className="px-3 pt-2 pb-2.5 border-b border-line mb-1">
                    <div className="text-sm font-semibold">{ROLE_LABEL[role]}</div>
                    <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cx(
                          'w-1.5 h-1.5 rounded-full',
                          connection === 'live' ? 'bg-ok' : connection === 'connecting' ? 'bg-brass' : 'bg-live'
                        )}
                      />
                      {connection === 'live' ? 'Live sync on' : connection === 'connecting' ? 'Connecting…' : 'Offline — reconnecting'}
                    </div>
                  </div>
                  {role === 'player'
                    ? menuItem(<LogIn className="w-4 h-4" />, 'Switch role', onLogin)
                    : menuItem(<KeyRound className="w-4 h-4" />, 'Switch role', onLogin)}
                  {menuItem(<QrCode className="w-4 h-4" />, 'Share with devices', onShare)}
                  {role === 'admin' && (
                    <>
                      <div className="h-px bg-line my-1" />
                      {menuItem(<Settings2 className="w-4 h-4" />, 'Instruments', onInstruments)}
                      {menuItem(<ShieldCheck className="w-4 h-4" />, 'Admin passkey', onAccess)}
                    </>
                  )}
                  {role !== 'player' && (
                    <>
                      <div className="h-px bg-line my-1" />
                      {menuItem(<LogOut className="w-4 h-4" />, 'Sign out', logout, true)}
                    </>
                  )}
                  <div className="px-3 pt-2 pb-1 mt-1 border-t border-line text-[11px] text-faint">
                    Anjung Live · Gamelan Anjung Seni · by Naim M.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden pb-3">{tabBar}</div>
      </div>
    </header>
  );
}
