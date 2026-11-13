'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, ChevronDown, Home, KeyRound, ListMusic, MonitorPlay, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { inEventsSection, rememberEventsSpot, useEventsHref, useRestoreEventsScroll } from '@/lib/eventsMemory';
import logoMark from '@/assets/logo-mark.png';
import { useShell } from './AppShell';
import { cx } from './ui';

const ROLE_LABEL = { player: 'Musician', controller: 'Controller', maestro: 'Maestro', admin: 'Admin' } as const;

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/live', label: 'Live', icon: MonitorPlay },
  { href: '/library', label: 'Library', icon: ListMusic },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function useActive() {
  const path = usePathname() || '/';
  return (href: string) => (href === '/' ? path === '/' : href === '/events' ? inEventsSection(path) : path.startsWith(href));
}

/** Where each tab goes. Leaving the Events section remembers the spot; Events takes you back to it. */
function useNavTarget() {
  const path = usePathname() || '/';
  const events = useEventsHref(path);
  return (href: string) =>
    href === '/events' ? events : { href, onClick: rememberEventsSpot };
}

function LiveDotSmall() {
  return (
    <span className="relative inline-flex w-2 h-2">
      <span className="absolute inset-0 rounded-full bg-live animate-ping opacity-60" />
      <span className="relative w-2 h-2 rounded-full bg-live" />
    </span>
  );
}

export function TopBar() {
  const { role, selectedInstrument, connection, stageLive } = useStage();
  const { openInstrumentPicker } = useShell();
  const { t } = useT();
  const isActive = useActive();
  const navTarget = useNavTarget();
  const isLive = stageLive;
  useRestoreEventsScroll(usePathname() || '/');

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        {/* Brand */}
        <Link href="/" onClick={rememberEventsSpot} className="flex items-center gap-2.5 min-w-0" aria-label={t('Anjung Live home')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoMark.src} alt="" width={36} height={36} className="w-9 h-9 rounded-xl shrink-0 ring-1 ring-line object-cover" />
          <div className="min-w-0 hidden min-[380px]:block">
            <div className="leading-none flex items-baseline gap-1.5">
              <span className="font-script text-[1.65rem] text-ink -mb-0.5">Anjung</span>
              <span className="font-display text-[0.7rem] font-semibold tracking-[0.28em] text-brass">LIVE</span>
            </div>
            <div className="text-[11px] text-muted truncate leading-tight mt-0.5">Gamelan Anjung Seni</div>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1 mx-auto p-1 rounded-xl bg-surface border border-line" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              {...navTarget(href)}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cx(
                'h-9 px-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors',
                isActive(href) ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              <Icon className="w-4 h-4" />
              {t(label)}
              {href === '/live' && isLive && <LiveDotSmall />}
            </Link>
          ))}
        </nav>

        <div className="ml-auto md:ml-0 flex items-center gap-2">
          <button
            onClick={openInstrumentPicker}
            className={cx(
              'h-10 px-3 rounded-xl border text-sm font-medium inline-flex items-center gap-2 max-w-[42vw] transition-colors',
              selectedInstrument ? 'border-brass/50 bg-brass-soft text-brass' : 'border-line bg-surface text-muted hover:text-ink'
            )}
            title={t('Choose your instrument')}
          >
            <span className="truncate">{selectedInstrument ?? t('Instrument')}</span>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
          </button>

          <Link
            href="/settings"
            aria-label={`${t('Settings')} · ${t(ROLE_LABEL[role])}`}
            className="h-10 pl-2.5 pr-3 rounded-xl border border-line bg-surface hover:border-line-strong inline-flex items-center gap-2 text-sm font-medium"
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
            <span className="hidden sm:inline">{t(ROLE_LABEL[role])}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** App-style bottom tabs on phones. */
export function BottomNav() {
  const { stageLive } = useStage();
  const { t } = useT();
  const isActive = useActive();
  const navTarget = useNavTarget();
  const isLive = stageLive;
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md safe-bottom" aria-label="Main">
      <div className="grid grid-cols-5 pt-1.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              {...navTarget(href)}
              aria-current={active ? 'page' : undefined}
              className={cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', active ? 'text-brass' : 'text-muted')}
            >
              <span className="relative">
                <Icon className="w-6 h-6" strokeWidth={active ? 2.4 : 2} />
                {href === '/live' && isLive && (
                  <span className="absolute -top-0.5 -right-1.5">
                    <LiveDotSmall />
                  </span>
                )}
              </span>
              {t(label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
