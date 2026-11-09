'use client';

import React from 'react';
import { BellRing, ChevronRight, KeyRound, LogOut, Music2, QrCode, Settings2, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import logoMark from '@/assets/logo-mark.png';
import { useShell } from './AppShell';
import { Card, Toggle, cx } from './ui';

const ROLE_LABEL = { player: 'Musician', controller: 'Controller', maestro: 'Maestro', admin: 'Admin' } as const;
const ROLE_TEXT = {
  player: 'View the stage and setlists. No sign-in needed.',
  controller: 'Change songs, loops and what’s live.',
  maestro: 'Build setlists and Sidang, add breaks, choose what’s live.',
  admin: 'Everything, plus instruments and the Admin passkey.',
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted px-1 mb-2">{title}</h2>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
    </section>
  );
}

function Row({
  icon,
  title,
  text,
  right,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  text?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      <span className={cx('w-9 h-9 rounded-xl grid place-items-center shrink-0', danger ? 'bg-songket-soft text-songket-light' : 'bg-raised text-brass')}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={cx('block font-medium', danger && 'text-songket-light')}>{title}</span>
        {text && <span className="block text-sm text-muted">{text}</span>}
      </span>
      {right ?? (onClick && <ChevronRight className="w-5 h-5 text-faint" />)}
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-raised/60 transition-colors">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
  );
}

export function SettingsView() {
  const { role, logout, selectedInstrument, connection, notify } = useStage();
  const { lockScreen, chime, openLogin, openInstrumentPicker, openShare, openInstruments, openAccess } = useShell();

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6 pb-10 space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Section title="You">
        <Row
          icon={role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : role === 'player' ? <UserRound className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          title={`Role: ${ROLE_LABEL[role]}`}
          text={ROLE_TEXT[role]}
          onClick={openLogin}
        />
        <Row icon={<Music2 className="w-5 h-5" />} title="My instrument" text={selectedInstrument ?? 'Not chosen (just watching)'} onClick={openInstrumentPicker} />
        {role !== 'player' && <Row icon={<LogOut className="w-5 h-5" />} title="Back to Musician" text="Sign out of your role on this device." onClick={logout} danger />}
      </Section>

      <Section title="On this phone">
        {chime.supported && (
          <Row
            icon={<BellRing className="w-5 h-5" />}
            title="Sound on song change"
            text="A chime when the song changes; an urgent one when it’s your cue. Turn on again after reopening the app."
            right={
              <Toggle
                checked={chime.enabled}
                label="Sound on song change"
                onChange={async (v) => {
                  if (!v) return chime.disable();
                  const ok = await chime.enable();
                  if (!ok) notify('Your browser blocked sound. Tap again.', 'error');
                }}
              />
            }
          />
        )}
        {lockScreen.supported && (
          <Row
            icon={<Smartphone className="w-5 h-5" />}
            title="Show on lock screen"
            text="The next song, intro and loop on your locked phone. Keep this tab open."
            right={
              <Toggle
                checked={lockScreen.active}
                label="Show on lock screen"
                onChange={async (v) => {
                  if (!v) return lockScreen.stop();
                  const ok = await lockScreen.start();
                  notify(ok ? 'On: lock your phone to see the next song.' : 'Your browser blocked it. Tap again.', ok ? 'info' : 'error');
                }}
              />
            }
          />
        )}
      </Section>

      <Section title="Share">
        <Row icon={<QrCode className="w-5 h-5" />} title="Open on other devices" text="QR code and link to this app." onClick={() => openShare()} />
      </Section>

      {role === 'admin' && (
        <Section title="Admin">
          <Row icon={<Settings2 className="w-5 h-5" />} title="Instruments" text="Add, rename, reorder or remove." onClick={openInstruments} />
          <Row icon={<ShieldCheck className="w-5 h-5" />} title="Admin passkey" text="Change who can sign in as Admin." onClick={openAccess} />
        </Section>
      )}

      <section className="flex flex-col items-center text-center gap-2 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoMark.src} alt="" className="w-12 h-12 rounded-xl ring-1 ring-brass/30" />
        <div className="leading-none">
          <span className="font-script text-3xl">Anjung</span>{' '}
          <span className="font-display text-xs font-semibold tracking-[0.3em] text-brass">LIVE</span>
        </div>
        <p className="text-sm text-muted">Gamelan Anjung Seni · Pusat Kebudayaan</p>
        <p className="text-xs text-faint">
          by Naim M. ·{' '}
          <span className={connection === 'live' ? 'text-jade-light' : 'text-songket-light'}>
            {connection === 'live' ? 'Live sync on' : connection === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>
        </p>
      </section>
    </div>
  );
}
