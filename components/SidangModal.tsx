'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStage } from '@/lib/stageContext';
import type { Session } from '@/types';
import { Button, ConfirmDialog, Field, Input, Modal, Stepper } from './ui';

export function SidangModal({
  mode,
  open,
  session,
  eventId = null,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  eventId?: string | null;
  open: boolean;
  session?: Session;
  onClose: () => void;
  onSaved?: (s: Session) => void;
}) {
  const { sessions, createSession, editSession, removeSession, roomState } = useStage();
  // Sidang numbers are unique within a Konvo
  const siblings = useMemo(
    () => sessions.filter((s) => (s.event_id ?? null) === (mode === 'edit' ? session?.event_id ?? null : eventId)),
    [sessions, mode, session?.event_id, eventId]
  );
  const nextNumber = useMemo(() => siblings.reduce((m, s) => Math.max(m, s.sidang_number || 0), 0) + 1, [siblings]);

  const [num, setNum] = useState(nextNumber);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && session) {
      setNum(session.sidang_number);
      setName(session.name);
      setDate(session.date || '');
    } else {
      setNum(nextNumber);
      setName(`Sidang ${nextNumber}`);
      setDate(new Date().toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, session?.id]);

  const changeNumber = (n: number) => {
    // Keep the default name in step with the number unless the user typed a custom one
    if (name === `Sidang ${num}`) setName(`Sidang ${n}`);
    setNum(n);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'create' && siblings.some((s) => s.sidang_number === num)) {
      setError(`Sidang ${num} already exists.`);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await createSession({ eventId, sidangNumber: num, name, date });
        onSaved?.(created);
      } else if (session) {
        await editSession(session.id, { name: name.trim() || session.name, date });
        onSaved?.(session);
      }
      onClose();
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const isLive = session && roomState.session_id === session.id;

  return (
    <>
      <Modal
        open={open && !confirmDelete}
        onClose={onClose}
        title={mode === 'create' ? 'New Sidang' : `${session?.name ?? 'Sidang'} settings`}
        description={mode === 'create' ? 'Bahagian 1–4 are created automatically.' : undefined}
        footer={
          <>
            {mode === 'edit' && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sidang-form" disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? `Create Sidang ${num}` : 'Save'}
            </Button>
          </>
        }
      >
        <form id="sidang-form" onSubmit={submit} className="space-y-4">
          {mode === 'create' && (
            <Field label="Sidang number">
              <Stepper value={num} onChange={changeNumber} min={1} max={99} />
            </Field>
          )}
          <Field label="Name" htmlFor="sidang-name" hint="e.g. “Sidang 3 (Sains & Teknologi)”">
            <Input id="sidang-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Date" htmlFor="sidang-date">
            <Input id="sidang-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${session?.name}?`}
        confirmLabel="Delete Sidang"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (session) await removeSession(session.id);
          onClose();
        }}
      >
        <p>This removes Bahagian 1–4 and their setlists. Songs stay in the library. This cannot be undone.</p>
        {isLive && <p className="text-danger">This Sidang is live right now. The stage will go blank.</p>}
      </ConfirmDialog>
    </>
  );
}
