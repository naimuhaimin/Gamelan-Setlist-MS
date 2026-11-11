'use client';

import React from 'react';
import { BellDot, BellRing, ChevronRight, KeyRound, Languages, LogOut, Moon, Music2, QrCode, Settings2, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { usePush } from '@/lib/usePush';
import logoMark from '@/assets/logo-mark.png';
import { useShell } from './AppShell';
import { Card, Toggle, cx } from './ui';

export const ROLE_LABEL = { player: 'Musician', controller: 'Controller', maestro: 'Maestro', admin: 'Admin' } as const;
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
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  text?: React.ReactNode;
  extra?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      <span className={cx('w-9 h-9 rounded-xl grid place-items-center shrink-0', danger ? 'bg-songket-soft text-songket-light' : 'bg-raised text-brass')}>
        {icon}
      </span>
      <span className="flex-1 min-w-[9.5rem]">
        <span className={cx('block font-medium', danger && 'text-songket-light')}>{title}</span>
        {text && <span className="block text-sm text-muted">{text}</span>}
        {extra && <span className="block text-sm text-brass mt-0.5">{extra}</span>}
      </span>
      {right ?? (onClick && <ChevronRight className="w-5 h-5 text-faint" />)}
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-raised/60 transition-colors">
      {body}
    </button>
  ) : (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 [&>[role=radiogroup]]:ml-auto">{body}</div>
  );
}

/** Two-option segmented switch used for theme and language. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; text: string; icon?: React.ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-xl bg-bg border border-line shrink-0">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors',
            value === o.id ? 'bg-brass text-brass-ink' : 'text-muted hover:text-ink'
          )}
        >
          {o.icon}
          {o.text}
        </button>
      ))}
    </div>
  );
}

export function SettingsView() {
  const { role, logout, selectedInstrument, connection, notify, canSwitchLive } = useStage();
  const { lockScreen, lockPref, setLockPref, chime, theme, openLogin, openInstrumentPicker, openShare, openInstruments, openAccess } = useShell();
  const { t, lang, setLang } = useT();
  const push = usePush();

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6 pb-10 space-y-6">
      <h1 className="font-display text-3xl font-bold">{t('Settings')}</h1>

      <Section title={t('You')}>
        <Row
          icon={role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : role === 'player' ? <UserRound className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          title={t('Role: {role}', { role: t(ROLE_LABEL[role]) })}
          text={t(ROLE_TEXT[role])}
          onClick={openLogin}
        />
        <Row
          icon={<Music2 className="w-5 h-5" />}
          title={t('My instrument')}
          text={selectedInstrument ?? t('Not chosen (just watching)')}
          onClick={openInstrumentPicker}
        />
        {role !== 'player' && (
          <Row icon={<LogOut className="w-5 h-5" />} title={t('Back to Musician')} text={t('Sign out of your role on this device.')} onClick={logout} danger />
        )}
      </Section>

      <Section title={t('Appearance')}>
        <Row
          icon={<Languages className="w-5 h-5" />}
          title={t('Language')}
          text={lang === 'ms' ? 'Bahasa Melayu' : 'English'}
          right={
            <Segmented
              label={t('Language')}
              value={lang}
              onChange={setLang}
              options={[
                { id: 'en', text: 'English' },
                { id: 'ms', text: 'Melayu' },
              ]}
            />
          }
        />
        <Row
          icon={theme.theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          title={t('Theme')}
          text={theme.theme === 'light' ? t('Light: ivory paper, good in bright halls.') : t('Dark (default): best for the stage.')}
          right={
            <Segmented
              label={t('Theme')}
              value={theme.theme}
              onChange={theme.setTheme}
              options={[
                { id: 'dark', text: t('Dark'), icon: <Moon className="w-3.5 h-3.5" /> },
                { id: 'light', text: t('Light'), icon: <Sun className="w-3.5 h-3.5" /> },
              ]}
            />
          }
        />
      </Section>

      <Section title={t('On this phone')}>
        {chime.supported && (
          <Row
            icon={<BellRing className="w-5 h-5" />}
            title={t('Sound on song change')}
            text={t('A chime when the song changes; an urgent one when it’s your cue. Turn on again after reopening the app.')}
            right={
              <Toggle
                checked={chime.enabled}
                label={t('Sound on song change')}
                onChange={async (v) => {
                  if (!v) return chime.disable();
                  const ok = await chime.enable();
                  if (!ok) notify(t('Your browser blocked sound. Tap again.'), 'error');
                }}
              />
            }
          />
        )}
        {lockScreen.supported && (
          <Row
            icon={<Smartphone className="w-5 h-5" />}
            title={t('Show on lock screen')}
            text={
              lockPref
                ? lockScreen.active
                  ? t('On: the next song, intro and loop show on your locked phone. Keep this tab open.')
                  : t('On: starts at your next tap. Keep this tab open.')
                : t('Off. Turn on to see the next song on your locked phone.')
            }
            extra={canSwitchLive ? t('As {role}, the ⏮ ⏭ buttons on your lock screen move the live stage.', { role: t(ROLE_LABEL[role]) }) : undefined}
            right={
              <Toggle
                checked={lockPref}
                label={t('Show on lock screen')}
                onChange={async (v) => {
                  setLockPref(v);
                  if (!v) return lockScreen.stop();
                  const ok = await lockScreen.start();
                  if (!ok) notify(t('Your browser blocked it. Tap anywhere to start it.'), 'error');
                }}
              />
            }
          />
        )}
        {push.state !== 'unavailable' && (
          <Row
            icon={<BellDot className="w-5 h-5" />}
            title={t('Notifications')}
            text={
              push.state === 'on'
                ? t('On: you’ll get a notification when a Bahagian goes live, even with the app closed.')
                : push.state === 'blocked'
                  ? t('Blocked. Allow notifications for this app in your phone’s settings, then try again.')
                  : push.state === 'needs-install'
                    ? t('On iPhone, add the app to your Home Screen first, then turn this on.')
                    : push.state === 'unsupported'
                      ? t('This browser can’t show notifications.')
                      : t('Get a notification when a Bahagian goes live, even with the app closed.')
            }
            right={
              <Toggle
                checked={push.state === 'on'}
                label={t('Notifications')}
                disabled={push.busy || push.state === 'unsupported' || push.state === 'needs-install'}
                onChange={async (v) => {
                  if (!v) return push.disable();
                  const ok = await push.enable();
                  if (ok) notify(t('Notifications are on'));
                  else notify(t('Notifications were not turned on. Allow them when your phone asks.'), 'error');
                }}
              />
            }
          />
        )}
      </Section>

      <Section title={t('Share')}>
        <Row icon={<QrCode className="w-5 h-5" />} title={t('Open on other devices')} text={t('QR code and link to this app.')} onClick={() => openShare()} />
      </Section>

      {role === 'admin' && (
        <Section title={t('Admin')}>
          <Row icon={<Settings2 className="w-5 h-5" />} title={t('Instruments')} text={t('Add, rename, reorder or remove.')} onClick={openInstruments} />
          <Row icon={<ShieldCheck className="w-5 h-5" />} title={t('Admin passkey')} text={t('Change who can sign in as Admin.')} onClick={openAccess} />
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
          {t('by Naim M.')} ·{' '}
          <span className={connection === 'live' ? 'text-jade-light' : 'text-songket-light'}>
            {connection === 'live' ? t('Live sync on') : connection === 'connecting' ? t('Connecting…') : t('Offline')}
          </span>
        </p>
      </section>
    </div>
  );
}
