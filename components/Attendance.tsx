'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Minus, Pencil, Plus, UserCheck, Users, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/useAttendance';
import { Button, Card, Chip, Field, IconButton, Input, Modal, cx } from './ui';

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

const MAX_SEATS = 12; // beyond this a row shows "+n" instead of more boxes

/**
 * Attendance for one Sidang: players register their name and instrument, and a seat chart
 * shows, per instrument, how many are needed (set by the Maestro) against how many registered.
 * Filled seats = registered, empty dashed seats = still needed, extra seats = more than needed.
 */
export function Attendance({ sessionId }: { sessionId: string }) {
  const { instruments, selectedInstrument, isManager, liveSession, isFinished, notify } = useStage();
  const { t } = useT();
  const att = useAttendance(sessionId);
  const [open, setOpen] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isLive = liveSession?.id === sessionId && !isFinished;

  const rows = useMemo(() => {
    const names = [...instruments];
    for (const e of att.entries) if (!names.includes(e.instrument)) names.push(e.instrument);
    return names.map((name) => {
      const people = att.entries.filter((e) => e.instrument === name);
      const needed = att.needs[name] ?? 0;
      return { name, needed, people, have: people.length, short: Math.max(0, needed - people.length), extra: needed ? Math.max(0, people.length - needed) : 0 };
    });
  }, [instruments, att.entries, att.needs]);

  if (att.available === false) return null; // tables not created yet
  if (att.available === null) return null;

  const anyNeeds = rows.some((r) => r.needed > 0);
  const shown = editing ? rows : rows.filter((r) => r.needed > 0 || r.have > 0);
  const totalNeeded = rows.reduce((n, r) => n + r.needed, 0);
  const totalHave = att.entries.length;
  const shortRows = rows.filter((r) => r.short > 0);
  // Collapsed by default once the Sidang is on stage; open before that
  const isOpen = open ?? !isLive;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      notify(t('Not saved: {error}', { error: (err as Error).message }), 'error');
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header + headline numbers */}
      <button type="button" onClick={() => setOpen(!isOpen)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left" aria-expanded={isOpen}>
        <Users className="w-5 h-5 text-brass shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-bold">{t('Attendance')}</h2>
          <p className="text-sm text-muted tabular">
            {anyNeeds
              ? t('{have} of {needed} players registered', { have: totalHave, needed: totalNeeded })
              : t('{n} players registered', { n: totalHave })}
            {anyNeeds &&
              (shortRows.length ? (
                <span className="text-songket-light"> · {t('{n} short', { n: shortRows.reduce((n, r) => n + r.short, 0) })}</span>
              ) : (
                <span className="text-jade-light"> · {t('all covered')}</span>
              ))}
          </p>
        </div>
        <ChevronDown className={cx('w-5 h-5 text-muted transition-transform shrink-0', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="border-t border-line">
          {/* Your registration */}
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 bg-raised/40">
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
          </div>

          {/* Chart header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 pt-3">
            <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] bg-brass" /> {t('Registered')}
              </span>
              {anyNeeds && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[3px] border border-dashed border-line-strong" /> {t('Still needed')}
                </span>
              )}
            </div>
            {isManager && (
              <Button size="sm" variant={editing ? 'primary' : 'ghost'} onClick={() => setEditing((v) => !v)}>
                {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editing ? t('Done') : t('Players needed')}
              </Button>
            )}
          </div>

          {!anyNeeds && !editing && isManager && (
            <p className="px-4 sm:px-5 pt-2 text-xs text-muted">{t('Tap “Players needed” to set how many players each instrument needs.')}</p>
          )}

          {/* Seat chart */}
          {shown.length === 0 ? (
            <p className="px-4 sm:px-5 py-4 text-sm text-muted">{t('Nobody has registered yet.')}</p>
          ) : (
            <ul className="px-2 sm:px-3 py-2">
              {shown.map((r) => {
                const seats = Math.max(r.needed, r.have);
                const drawn = Math.min(seats, MAX_SEATS);
                const status =
                  r.needed === 0 ? null : r.short > 0 ? (
                    <span className="inline-flex items-center gap-1 text-songket-light">
                      <AlertTriangle className="w-3.5 h-3.5" /> {t('Short {n}', { n: r.short })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-jade-light">
                      <Check className="w-3.5 h-3.5" /> {r.extra ? t('+{n} extra', { n: r.extra }) : t('Enough')}
                    </span>
                  );
                return (
                  <li key={r.name}>
                    <div className={cx('flex items-center gap-3 rounded-lg px-2 py-2', expanded === r.name && 'bg-raised/60')}>
                      <button
                        type="button"
                        onClick={() => setExpanded((x) => (x === r.name ? null : r.name))}
                        className="flex-1 min-w-0 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 text-left"
                        aria-expanded={expanded === r.name}
                        aria-label={
                          r.needed
                            ? t('{instrument}: {have} of {needed} registered', { instrument: r.name, have: r.have, needed: r.needed })
                            : t('{instrument}: {have} registered', { instrument: r.name, have: r.have })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{r.name}</span>
                          <span className="block text-xs tabular">
                            <span className="text-ink font-semibold">{r.have}</span>
                            <span className="text-muted">{r.needed ? ` / ${r.needed}` : ''}</span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {Array.from({ length: drawn }, (_, i) => (
                            <span
                              key={i}
                              className={cx(
                                'w-5 h-5 rounded-[4px]',
                                i < r.have ? 'bg-brass' : 'border border-dashed border-line-strong',
                                i >= r.needed && i < r.have && r.needed > 0 && 'ring-2 ring-inset ring-bg/60'
                              )}
                            />
                          ))}
                          {seats > MAX_SEATS && <span className="text-xs text-muted tabular ml-0.5">+{seats - MAX_SEATS}</span>}
                          {seats === 0 && <span className="text-xs text-faint">—</span>}
                          {!editing && status && <span className="basis-full text-xs font-semibold mt-0.5">{status}</span>}
                        </span>
                      </button>
                      {editing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <IconButton label={t('Fewer {instrument}', { instrument: r.name })} size="sm" variant="secondary" disabled={r.needed <= 0} onClick={() => run(() => att.setNeeded(r.name, r.needed - 1))}>
                            <Minus className="w-4 h-4" />
                          </IconButton>
                          <span className="w-6 text-center font-semibold tabular">{r.needed}</span>
                          <IconButton label={t('More {instrument}', { instrument: r.name })} size="sm" variant="secondary" onClick={() => run(() => att.setNeeded(r.name, r.needed + 1))}>
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
                );
              })}
            </ul>
          )}
        </div>
      )}

      <RegisterModal
        open={registering}
        onClose={() => setRegistering(false)}
        initialName={att.mine?.name ?? readName()}
        initialInstrument={att.mine?.instrument ?? selectedInstrument ?? ''}
        instruments={instruments}
        onSave={async (name, instrument) => {
          await att.register(name, instrument);
          saveName(name);
          notify(t('Registered as {name} · {instrument}', { name, instrument }));
        }}
      />
    </Card>
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
