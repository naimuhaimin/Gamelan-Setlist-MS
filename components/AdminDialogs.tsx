'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { RoleType } from '@/types';
import { Button, ConfirmDialog, Field, IconButton, Input, Modal } from './ui';

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

export function InstrumentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { instruments, songs, addInstrument, renameInstrument, removeInstrument, moveInstrument } = useStage();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
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
      await renameInstrument(editing, editValue);
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
        title="Instruments"
        description="The ensemble’s instruments. Renaming updates every song that uses it."
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <form onSubmit={add} className="flex gap-2 mb-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New instrument name" aria-label="New instrument name" />
          <Button type="submit" disabled={!name.trim()}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </form>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <ul className="rounded-xl border border-line divide-y divide-line">
          {instruments.map((inst, idx) => (
            <li key={inst} className="flex items-center gap-2 px-3 py-2">
              {editing === inst ? (
                <form
                  className="flex-1 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit();
                  }}
                >
                  <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-9" />
                  <IconButton label="Save name" size="sm" variant="primary" onClick={saveEdit}>
                    <Check className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="Cancel" size="sm" onClick={() => setEditing(null)}>
                    <X className="w-4 h-4" />
                  </IconButton>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{inst}</span>
                    <span className="block text-xs text-muted">
                      Intro in {usage(inst)} {usage(inst) === 1 ? 'song' : 'songs'}
                    </span>
                  </span>
                  <IconButton label="Move up" size="sm" onClick={() => moveInstrument(idx, idx - 1)} disabled={idx === 0}>
                    <ArrowUp className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="Move down" size="sm" onClick={() => moveInstrument(idx, idx + 1)} disabled={idx === instruments.length - 1}>
                    <ArrowDown className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    label={`Rename ${inst}`}
                    size="sm"
                    onClick={() => {
                      setEditing(inst);
                      setEditValue(inst);
                      setError(null);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={`Delete ${inst}`} size="sm" onClick={() => setToDelete(inst)} className="hover:text-danger">
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
          {!instruments.length && <li className="px-3 py-6 text-center text-sm text-muted">No instruments yet.</li>}
        </ul>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete}?`}
        confirmLabel="Delete instrument"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeInstrument(toDelete);
          setToDelete(null);
        }}
      >
        {toDelete && usage(toDelete) > 0 ? (
          <p>
            It will also be removed from the intro of <b className="text-ink">{usage(toDelete)}</b>{' '}
            {usage(toDelete) === 1 ? 'song' : 'songs'}.
          </p>
        ) : (
          <p>No songs use it.</p>
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
  { role: 'maestro', label: 'Maestro passkey', hint: 'Edit setlists for every Sidang and choose what goes live.' },
  { role: 'controller', label: 'Controller master passkey', hint: 'Works for any Bahagian whose controller access is on. Leave empty to use only per-Bahagian passkeys.' },
];

export function AccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rolePasskey, setRolePasskey } = useStage();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(ACCESS.map((a) => [a.role, rolePasskey(a.role)])));
      setError(null);
    }
  }, [open, rolePasskey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.admin?.trim()) return setError('The Admin passkey cannot be empty, or nobody could sign in as Admin.');
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
      title="Access & passkeys"
      description="Share these only with the people who need them."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="access-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="access-form" onSubmit={save} className="space-y-4">
        {ACCESS.map((a) => (
          <Field key={a.role} label={a.label} hint={a.hint} htmlFor={`pk-${a.role}`}>
            <Input
              id={`pk-${a.role}`}
              value={values[a.role] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [a.role]: e.target.value }))}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        ))}
        <p className="text-xs text-muted">
          A Maestro can also set a passkey for one Bahagian only in Setlist → Controller access.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
