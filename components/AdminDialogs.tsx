'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { plural, useT } from '@/lib/i18n';
import { instrumentSlogan } from '@/lib/instrumentSlogans';
import type { RoleType } from '@/types';
import { Button, ConfirmDialog, Field, IconButton, Input, Modal } from './ui';

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

export function InstrumentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { instruments, songs, addInstrument, renameInstrument, removeInstrument, moveInstrument, instrumentSlogans, slogansEditable, setInstrumentSlogan } =
    useStage();
  const { t } = useT();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSlogan, setEditSlogan] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setEditing(null);
      setError(null);
    }
  }, [open]);

  const usage = (i: string) => songs.filter((s) => s.intro_instruments.includes(i)).length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await addInstrument(name);
      setName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setError(null);
    try {
      const newName = editValue.trim();
      if (newName && newName !== editing) await renameInstrument(editing, newName);
      if (slogansEditable && editSlogan.trim() !== (instrumentSlogans[editing] ?? '')) await setInstrumentSlogan(newName || editing, editSlogan);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <Modal
        open={open && !toDelete}
        onClose={onClose}
        title={t('Instruments')}
        description={
          slogansEditable
            ? t('Tap the pencil to rename an instrument or change its catchphrase. Leave the catchphrase empty to use the default.')
            : t('The ensemble’s instruments. Renaming updates every song that uses it.')
        }
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('Done')}
          </Button>
        }
      >
        <form onSubmit={add} className="flex gap-2 mb-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('New instrument name')} aria-label={t('New instrument name')} />
          <Button type="submit" disabled={!name.trim()}>
            <Plus className="w-4 h-4" /> {t('Add')}
          </Button>
        </form>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <ul className="rounded-xl border border-line divide-y divide-line">
          {instruments.map((inst, idx) => (
            <li key={inst} className="flex items-center gap-2 px-3 py-2">
              {editing === inst ? (
                <form
                  className="flex-1 flex items-start gap-2 min-w-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit();
                  }}
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-9" aria-label={t('Name')} />
                    {slogansEditable && (
                      <Input
                        value={editSlogan}
                        onChange={(e) => setEditSlogan(e.target.value)}
                        maxLength={60}
                        className="h-9 italic"
                        aria-label={t('Catchphrase')}
                        placeholder={t('Catchphrase, e.g. “{example}”', { example: t(instrumentSlogan(inst)) })}
                      />
                    )}
                  </div>
                  <IconButton label={t('Save')} size="sm" variant="primary" type="submit">
                    <Check className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={t('Cancel')} size="sm" onClick={() => setEditing(null)}>
                    <X className="w-4 h-4" />
                  </IconButton>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{inst}</span>
                    <span className="block text-xs italic text-brass">
                      “{instrumentSlogans[inst] ?? t(instrumentSlogan(inst))}”
                      {!instrumentSlogans[inst] && <span className="not-italic text-faint"> · {t('default')}</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {t('Intro in {songs}', { songs: plural(usage(inst), '{n} song', '{n} songs') })}
                    </span>
                  </span>
                  <IconButton label={t('Move up')} size="sm" onClick={() => moveInstrument(idx, idx - 1)} disabled={idx === 0}>
                    <ArrowUp className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={t('Move down')} size="sm" onClick={() => moveInstrument(idx, idx + 1)} disabled={idx === instruments.length - 1}>
                    <ArrowDown className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    label={t('Edit {name}', { name: inst })}
                    size="sm"
                    onClick={() => {
                      setEditing(inst);
                      setEditValue(inst);
                      setEditSlogan(instrumentSlogans[inst] ?? '');
                      setError(null);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={t('Delete {name}', { name: inst })} size="sm" onClick={() => setToDelete(inst)} className="hover:text-danger">
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
          {!instruments.length && <li className="px-3 py-6 text-center text-sm text-muted">{t('No instruments yet.')}</li>}
        </ul>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t('Delete {name}?', { name: toDelete })}
        confirmLabel={t('Delete instrument')}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeInstrument(toDelete);
          setToDelete(null);
        }}
      >
        {toDelete && usage(toDelete) > 0 ? (
          <p>{t('It will also be removed from the intro of {songs}.', { songs: plural(usage(toDelete), '{n} song', '{n} songs') })}</p>
        ) : (
          <p>{t('No songs use it.')}</p>
        )}
      </ConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Access & passkeys
// ---------------------------------------------------------------------------

const ACCESS: Array<{ role: RoleType; label: string; hint: string }> = [
  { role: 'admin', label: 'Admin passkey', hint: 'Full access, including this screen.' },
];

export function AccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rolePasskey, setRolePasskey } = useStage();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(ACCESS.map((a) => [a.role, rolePasskey(a.role)])));
      setError(null);
    }
  }, [open, rolePasskey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.admin?.trim()) return setError(t('The Admin passkey cannot be empty, or nobody could sign in as Admin.'));
    setSaving(true);
    try {
      for (const a of ACCESS) {
        if ((values[a.role] ?? '').trim() !== rolePasskey(a.role)) await setRolePasskey(a.role, values[a.role] ?? '');
      }
      onClose();
    } catch {
      // toast shown
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Admin passkey')}
      description={t('Only Admin needs a passkey. Controller and Maestro are open to anyone using the app.')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="access-form" disabled={saving}>
            {saving ? t('Saving…') : t('Save')}
          </Button>
        </>
      }
    >
      <form id="access-form" onSubmit={save} className="space-y-4">
        {ACCESS.map((a) => (
          <Field key={a.role} label={t(a.label)} hint={t(a.hint)} htmlFor={`pk-${a.role}`}>
            <Input
              id={`pk-${a.role}`}
              value={values[a.role] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [a.role]: e.target.value }))}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        ))}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
