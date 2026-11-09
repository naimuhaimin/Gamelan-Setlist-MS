'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import type { ConvoEvent } from '@/types';
import { Button, ConfirmDialog, Field, Input, Modal } from './ui';

/** Shrinks a photo to at most 1600px wide JPEG before upload (phone photos are huge). */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export function ConvoModal({
  open,
  event,
  onClose,
  onDeleted,
}: {
  open: boolean;
  event?: ConvoEvent;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { createEvent, editEvent, removeEvent, sessions } = useStage();
  const isEdit = !!event;
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeThumb, setRemoveThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    setName(event?.name ?? '');
    setVenue(event?.venue ?? '');
    setDate(event?.start_date ?? '');
    setFile(null);
    setPreview(event?.thumbnail_url ?? null);
    setRemoveThumb(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const small = await shrinkImage(f);
    setFile(small);
    setRemoveThumb(false);
    setPreview(URL.createObjectURL(small));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && event) await editEvent(event.id, { name, venue, startDate: date, thumbnail: file, removeThumbnail: removeThumb });
      else await createEvent({ name, venue, startDate: date, thumbnail: file });
      onClose();
    } catch {
      // toast shown
    } finally {
      setSaving(false);
    }
  };

  const sidangCount = event ? sessions.filter((s) => s.event_id === event.id).length : 0;

  return (
    <>
      <Modal
        open={open && !confirmDelete}
        onClose={onClose}
        title={isEdit ? t('Edit event') : t('New event')}
        footer={
          <>
            {isEdit && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                {t('Delete')}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" type="submit" form="convo-form" disabled={saving || !name.trim()}>
              {saving ? t('Saving…') : isEdit ? t('Save') : t('Create event')}
            </Button>
          </>
        }
      >
        <form id="convo-form" onSubmit={submit} className="space-y-4">
          <Field label={t('Photo')} hint={t('Shown as the event’s thumbnail.')}>
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-line bg-raised">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 grid place-items-center text-muted hover:text-brass"
                >
                  <span className="flex flex-col items-center gap-2">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-sm">{t('Add a photo')}</span>
                  </span>
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-4 h-4" /> {preview ? t('Change photo') : t('Choose photo')}
              </Button>
              {preview && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setRemoveThumb(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" /> {t('Remove')}
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </Field>
          <Field label={t('Name')} htmlFor="convo-name">
            <Input id="convo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Konvokesyen UiTM ke-102')} required />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('Start date')} htmlFor="convo-date">
              <Input id="convo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('Venue')} htmlFor="convo-venue">
              <Input id="convo-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={t('e.g. Dewan Agong Tuanku Canselor')} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete {name}?', { name: event?.name })}
        confirmLabel={t('Delete event')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (event) await removeEvent(event.id);
          onClose();
          onDeleted?.();
        }}
      >
        <p>{t('This also deletes its {n} Sidang and their setlists. Songs stay in the library. This cannot be undone.', { n: sidangCount })}</p>
      </ConfirmDialog>
    </>
  );
}
