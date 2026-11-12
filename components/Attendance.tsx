'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Link2, Minus, Pencil, Plus, UserCheck, Users, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/useAttendance';
import { Button, Card, Chip, EmptyState, Field, IconButton, Input, Modal, cx } from './ui';
import { useShell } from './AppShell';
import { registerUrl } from './Cards';

const NAME_KEY = 'anjung_chat_name';
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const saveName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // private mode
  }
};

/**
 * Attendance tab for one Sidang. Players register their name and instrument; a bar chart
 * compares, per instrument, players registered (gold bar) with players needed (grey bar below),
 * on one shared scale with a gridline per player. The Maestro sets the numbers needed.
 */
export function Attendance({
  sessionId,
  autoRegister,
  onAutoRegisterDone,
}: {
  sessionId: string;
  /** Opened from the registration link: show the form straight away (unless already registered). */
  autoRegister?: boolean;
  onAutoRegisterDone?: () => void;
}) {
  const { instruments, selectedInstrument, isManager, notify, sessions, instrumentChosen, selectInstrument } = useStage();
  const { openShare } = useShell();
  const { t } = useT();
  const att = useAttendance(sessionId);
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sessionName = sessions.find((s) => s.id === sessionId)?.name ?? 'Sidang';

  // Registration link: open the form once the data has loaded
  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (!autoRegister || autoOpened.current || att.available !== true) return;
    autoOpened.current = true;
    if (att.mine) {
      notify(t('You’re already registered for {name}.', { name: sessionName }), 'info');
      onAutoRegisterDone?.();
    } else setRegistering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRegister, att.available, att.mine]);

  const rows = useMemo(() => {
    const names = [...instruments];
    for (const e of att.entries) if (!names.includes(e.instrument)) names.push(e.instrument);
    return names.map((name) => {
      const people = att.entries.filter((e) => e.instrument === name);
      const needed = att.needs[name] ?? 0;
      return { name, needed, people, have: people.length, short: Math.max(0, needed - people.length), extra: needed ? Math.max(0, people.length - needed) : 0 };
    });
  }, [instruments, att.entries, att.needs]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    }
  };

  const wrap = (children: React.ReactNode) => <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-4 pb-10 space-y-4">{children}</div>;

  if (att.available === null) return wrap(<p className="text-sm text-muted text-center py-8">{t('Loading…')}</p>);
  if (att.available === false)
    return wrap(
      <Card>
        <EmptyState icon={<Users className="w-10 h-10" />} title={t('Attendance isn’t switched on yet')}>
          {t('Run the latest supabase-schema.sql (section 12) in Supabase.')}
        </EmptyState>
      </Card>
    );

  const anyMin = rows.some((r) => r.needed > 0);
  const shown = editing ? rows : rows.filter((r) => r.needed > 0 || r.have > 0);
  const totalHave = att.entries.length;
  const lacking = rows.filter((r) => r.short > 0);
  const scale = Math.max(1, ...shown.map((r) => Math.max(r.needed, r.have)));
  const pct = (n: number) => `${(n / scale) * 100}%`;

  return wrap(
    <>
      {/* Headline: who's registered; only a shortfall is highlighted */}
      <Card className="p-4 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t('Players registered')}</div>
        <div className="font-display text-4xl font-bold tabular leading-tight">{totalHave}</div>
        {lacking.length > 0 && (
          <div className="mt-3 rounded-xl border border-songket/50 bg-songket-soft px-3.5 py-3">
            <div className="text-sm font-semibold text-songket-light inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {t('Lacking players')}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lacking.map((r) => (
                <span key={r.name} className="h-7 px-2.5 rounded-full bg-songket text-white text-xs font-semibold inline-flex items-center gap-1">
                  {r.name} <span className="opacity-80">· {t('{n} more', { n: r.short })}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Your registration */}
      <Card className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
        {att.mine ? (
          <>
            <UserCheck className="w-5 h-5 text-jade-light shrink-0" />
            <span className="flex-1 min-w-[12rem] text-sm">
              {t('You’re registered as')} <b>{att.mine.name}</b> · <b>{att.mine.instrument}</b>
            </span>
            <Button size="sm" onClick={() => setRegistering(true)}>
              {t('Change')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(() => att.remove(att.mine!.id))}>
              {t('Cancel registration')}
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-[10rem] text-sm text-muted">{t('Playing in this Sidang? Register so the Maestro knows.')}</span>
            <Button variant="primary" onClick={() => setRegistering(true)}>
              <Plus className="w-4 h-4" /> {t('Register')}
            </Button>
          </>
        )}
      </Card>

      {/* One link people can tap to register, without finding their way through the app */}
      <Card className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
        <Link2 className="w-5 h-5 text-brass shrink-0" />
        <span className="flex-1 min-w-[12rem] text-sm text-muted">{t('Send this link to the group. It opens the registration form for this Sidang.')}</span>
        <Button size="sm" onClick={() => openShare({ url: registerUrl(sessionId), title: t('Registration link · {name}', { name: sessionName }) })}>
          <Link2 className="w-4 h-4" /> {t('Share registration link')}
        </Button>
      </Card>

      {/* Bar chart: registered players, with the minimum as a reference mark */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          <h2 className="font-display text-xl font-bold flex-1 min-w-0">{t('By instrument')}</h2>
          {isManager && (
            <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)}>
              {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {editing ? t('Done') : t('Minimum players')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-[3px] bg-chart-song" /> {t('Registered')}
          </span>
          {anyMin && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-0.5 h-3.5 bg-ink/70" /> {t('Minimum')}
            </span>
          )}
          {lacking.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-3 rounded-[3px] bg-chart-break chart-stripes" /> {t('Lacking')}
            </span>
          )}
        </div>

        {!anyMin && !editing && isManager && (
          <p className="text-xs text-muted mb-2">{t('Tap “Minimum players” to set the least number of players each instrument needs.')}</p>
        )}

        {shown.length === 0 ? (
          <p className="py-4 text-sm text-muted">{t('Nobody has registered yet.')}</p>
        ) : (
          <ul className="-mx-2">
            {shown.map((r) => (
              <li key={r.name}>
                <div className={cx('flex items-center gap-2 rounded-lg px-2 py-2.5', expanded === r.name && 'bg-raised/60')}>
                  <button
                    type="button"
                    onClick={() => setExpanded((x) => (x === r.name ? null : r.name))}
                    aria-expanded={expanded === r.name}
                    aria-label={
                      r.short
                        ? t('{instrument}: {have} registered, lacking {n}', { instrument: r.name, have: r.have, n: r.short })
                        : t('{instrument}: {have} registered', { instrument: r.name, have: r.have })
                    }
                    className="flex-1 min-w-0 grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight break-words">{r.name}</span>
                      {r.short > 0 && !editing && (
                        <span className="block text-[11px] font-semibold text-songket-light">{t('Lacking {n}', { n: r.short })}</span>
                      )}
                      {editing && <span className="block text-[11px] text-muted tabular">{t('Minimum {n}', { n: r.needed })}</span>}
                    </span>
                    {/* One bar on a shared scale; a gridline at every player */}
                    <span className="relative h-6 flex items-center">
                      <span
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: 'linear-gradient(to right, rgb(var(--line)) 1px, transparent 1px)',
                          backgroundSize: `${100 / scale}% 100%`,
                        }}
                      />
                      <span className="relative h-3.5 w-full flex gap-[2px]">
                        {r.have > 0 && (
                          <span className={cx('h-full bg-chart-song', r.short ? '' : 'rounded-r-[4px]')} style={{ width: pct(r.have) }} />
                        )}
                        {r.short > 0 && (
                          <span className="h-full bg-chart-break chart-stripes rounded-r-[4px]" style={{ width: `calc(${pct(r.short)} - 2px)` }} />
                        )}
                      </span>
                      {r.needed > 0 && (
                        <span aria-hidden className="absolute top-0 bottom-0 w-0.5 bg-ink/70 rounded-full" style={{ left: `calc(${pct(r.needed)} - 1px)` }} />
                      )}
                    </span>
                    <span className={cx('text-right text-base font-bold tabular', r.short ? 'text-songket-light' : 'text-ink')}>{r.have}</span>
                  </button>
                  {editing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton
                        label={t('Lower the minimum for {instrument}', { instrument: r.name })}
                        size="sm"
                        variant="secondary"
                        disabled={r.needed <= 0}
                        onClick={() => run(() => att.setNeeded(r.name, r.needed - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        label={t('Raise the minimum for {instrument}', { instrument: r.name })}
                        size="sm"
                        variant="secondary"
                        onClick={() => run(() => att.setNeeded(r.name, r.needed + 1))}
                      >
                        <Plus className="w-4 h-4" />
                      </IconButton>
                    </div>
                  )}
                </div>
                {expanded === r.name && (
                  <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                    {r.people.length ? (
                      r.people.map((p) => (
                        <span key={p.id} className="h-8 pl-3 pr-1 rounded-full bg-raised border border-line inline-flex items-center gap-1 text-sm">
                          {p.name}
                          {(isManager || p.id === att.mine?.id) && (
                            <button
                              type="button"
                              aria-label={t('Remove {name}', { name: p.name })}
                              onClick={() => run(() => att.remove(p.id))}
                              className="w-6 h-6 grid place-items-center rounded-full text-faint hover:text-danger"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted">{t('Nobody yet.')}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-faint">{t('Tap an instrument to see who registered.')}</p>
      </Card>

      <RegisterModal
        open={registering}
        onClose={() => {
          setRegistering(false);
          if (autoRegister) onAutoRegisterDone?.();
        }}
        initialName={att.mine?.name ?? readName()}
        initialInstrument={att.mine?.instrument ?? selectedInstrument ?? ''}
        instruments={instruments}
        onSave={async (name, instrument) => {
          await att.register(name, instrument);
          saveName(name);
          // First time here (came from the link): remember the instrument for cue alerts too
          if (!instrumentChosen || !selectedInstrument) selectInstrument(instrument);
          notify(t('Registered as {name} · {instrument}', { name, instrument }));
        }}
      />
    </>
  );
}

function RegisterModal({
  open,
  onClose,
  initialName,
  initialInstrument,
  instruments,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialInstrument: string;
  instruments: string[];
  onSave: (name: string, instrument: string) => Promise<void>;
}) {
  const { notify } = useStage();
  const { t } = useT();
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initialName);
    setInstrument(initialInstrument);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instrument) return;
    setBusy(true);
    try {
      await onSave(name.trim(), instrument);
      onClose();
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Register for this Sidang')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="register-form" disabled={busy || !name.trim() || !instrument}>
            {busy ? t('Saving…') : t('Register')}
          </Button>
        </>
      }
    >
      <form id="register-form" onSubmit={save} className="space-y-4">
        <Field label={t('Name')} htmlFor="reg-name">
          <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('Your name, e.g. Aiman')} />
        </Field>
        <Field label={t('Instrument')}>
          <div className="flex flex-wrap gap-2">
            {instruments.map((i) => (
              <Chip key={i} selected={instrument === i} onClick={() => setInstrument(i)}>
                {i}
              </Chip>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
