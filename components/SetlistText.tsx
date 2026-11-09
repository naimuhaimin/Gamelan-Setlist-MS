'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Send } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { plural, useT } from '@/lib/i18n';
import { formatSetlist, parseSetlist, type ParsedLine } from '@/lib/setlistText';
import { BreakIcon, Button, Modal, cx } from './ui';

const EXAMPLE = `SIDANG 25

BAHAGIAN 1
36 Gempita
3 Topeng
-STOP (Graduan Meninggal Dunia)-
50 Ulik Seri Rama

BAHAGIAN 2
46 Medley
9 Baba Layar`;

/** Maestro: paste the usual WhatsApp setlist message and fill the Sidang's Bahagian from it. */
export function PasteSetlistModal({ open, onClose, sessionId }: { open: boolean; onClose: () => void; sessionId: string }) {
  const { songs, parts, sessions, roomState, replaceSetlists } = useStage();
  const { t } = useT();
  const [text, setText] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({}); // "line|text" -> song id, for lines that didn't match
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setPicks({});
    }
  }, [open]);

  const session = sessions.find((s) => s.id === sessionId);
  const myParts = useMemo(
    () => parts.filter((p) => p.session_id === sessionId).sort((a, b) => a.part_number - b.part_number),
    [parts, sessionId]
  );
  const parsed = useMemo(() => (text.trim() ? parseSetlist(text, songs) : null), [text, songs]);
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const keyOf = (l: ParsedLine) => `${l.line}|${l.text}`;
  const resolved = (l: ParsedLine) => (l.kind === 'song' ? l.song ?? songById.get(picks[keyOf(l)] ?? '') ?? null : null);

  const targets = (parsed?.parts ?? []).map((p) => ({ parsed: p, part: myParts.find((x) => x.part_number === p.number) }));
  const usable = targets.filter((x) => x.part);
  const missing = (parsed?.parts ?? []).flatMap((p) => p.items).filter((l) => l.kind === 'song' && !resolved(l));
  const liveHit = usable.some((x) => x.part!.id === roomState.part_id && !roomState.is_finished);
  const wrongSidang = parsed?.sidangNumber != null && session && parsed.sidangNumber !== session.sidang_number;

  const save = async () => {
    setSaving(true);
    try {
      await replaceSetlists(
        usable.map(({ parsed: p, part }) => ({
          partId: part!.id,
          items: p.items.flatMap((l): Array<{ kind: 'song'; songId: string } | { kind: 'break'; label: string }> => {
            if (l.kind === 'break') return [{ kind: 'break' as const, label: l.label }];
            const s = resolved(l);
            return s ? [{ kind: 'song' as const, songId: s.id }] : [];
          }),
        }))
      );
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
      size="lg"
      title={t('Paste setlist')}
      description={t('Paste the setlist message as usual. Each BAHAGIAN in it replaces that Bahagian here.')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !usable.length}>
            {saving ? t('Saving…') : usable.length ? t('Save {n} Bahagian', { n: usable.length }) : t('Save')}
          </Button>
        </>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={8}
        spellCheck={false}
        aria-label={t('Setlist message')}
        className="w-full rounded-xl bg-bg border border-line px-3.5 py-3 text-[15px] leading-relaxed font-mono placeholder:text-faint focus:outline-none focus:border-brass/70"
      />

      {parsed && (
        <div className="mt-4 space-y-3">
          {wrongSidang && (
            <Notice>
              {t('The message says Sidang {n}, but you are editing {name}.', { n: parsed.sidangNumber, name: session?.name })}
            </Notice>
          )}
          {liveHit && <Notice>{t('A Bahagian in this message is live now. It will restart from its first song.')}</Notice>}
          {missing.length > 0 && (
            <Notice>
              {missing.length === 1
                ? t('1 song is not in the library. Pick the right song below, or it will be skipped.')
                : t('{n} songs are not in the library. Pick the right song below, or they will be skipped.', { n: missing.length })}
            </Notice>
          )}
          {!targets.length && <Notice>{t('No BAHAGIAN lines found. Start each part with “BAHAGIAN 1”, “BAHAGIAN 2”…')}</Notice>}

          {targets.map(({ parsed: p, part }) => {
            const count = p.items.filter((l) => l.kind === 'song' && resolved(l)).length;
            return (
              <div key={p.number} className={cx('rounded-xl border', part ? 'border-line' : 'border-songket/50')}>
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-line">
                  <span className="font-semibold flex-1">Bahagian {p.number}</span>
                  <span className="text-xs text-muted tabular">
                    {part ? plural(count, '{n} song', '{n} songs') : t('Not in this Sidang: skipped')}
                  </span>
                </div>
                <ol className="divide-y divide-line">
                  {p.items.map((l) => (
                    <li key={keyOf(l)} className="px-3.5 py-2 text-sm flex items-center gap-2 min-w-0">
                      {l.kind === 'break' ? (
                        <span className="flex items-center gap-2 text-stop-light font-medium min-w-0">
                          <BreakIcon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{l.label}</span>
                        </span>
                      ) : l.song ? (
                        <>
                          <Check className="w-4 h-4 text-ok shrink-0" />
                          <span className="font-medium truncate">{l.song.title}</span>
                          {l.note && norm(l.song.title) !== norm(l.text) && (
                            <span className="text-xs text-faint truncate">{t('from “{text}”', { text: l.text })}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                          <span className="text-danger shrink-0 max-w-[40%] truncate">{l.text}</span>
                          <select
                            value={picks[keyOf(l)] ?? ''}
                            onChange={(e) => setPicks((cur) => ({ ...cur, [keyOf(l)]: e.target.value }))}
                            aria-label={t('Choose the song for “{text}”', { text: l.text })}
                            className="ml-auto min-w-0 flex-1 h-9 rounded-lg bg-bg border border-line px-2 text-sm"
                          >
                            <option value="">{t('Skip this line')}</option>
                            {l.candidates.length > 0 && (
                              <optgroup label={t('Closest')}>
                                {l.candidates.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label={t('All songs')}>
                              {songs.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </>
                      )}
                    </li>
                  ))}
                  {!p.items.length && <li className="px-3.5 py-2 text-sm text-muted">{t('Empty: this Bahagian will be cleared.')}</li>}
                </ol>
              </div>
            );
          })}

          {parsed.ignored.length > 0 && (
            <p className="text-xs text-muted">
              {t('Ignored (before the first BAHAGIAN): {lines}', { lines: parsed.ignored.map((x) => x.text).join(' · ') })}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-brass/40 bg-brass-soft px-3.5 py-2.5 text-sm">
      <AlertTriangle className="w-4 h-4 text-brass shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

/** Anyone: the Sidang's setlist as the usual text message, to copy or send. */
export function CopySetlistModal({ open, onClose, sessionId }: { open: boolean; onClose: () => void; sessionId: string }) {
  const { sessions, parts, resolveQueue, notify } = useStage();
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const session = sessions.find((s) => s.id === sessionId);
  const text = useMemo(() => (session ? formatSetlist(session, parts, resolveQueue) : ''), [session, parts, resolveQueue]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify(t('Setlist copied'));
    } catch {
      notify(t('Copy blocked. Select the text and copy it.'), 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Setlist as text')}
      description={t('Ready to paste into WhatsApp or anywhere else.')}
      footer={
        <>
          {canShare && (
            <Button className="mr-auto" onClick={() => navigator.share({ text }).catch(() => undefined)}>
              <Send className="w-4 h-4" /> {t('Send…')}
            </Button>
          )}
          <Button variant="primary" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t('Copied') : t('Copy')}
          </Button>
        </>
      }
    >
      <textarea
        readOnly
        value={text}
        rows={14}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t('Setlist as text')}
        className="w-full rounded-xl bg-bg border border-line px-3.5 py-3 text-[15px] leading-relaxed font-mono focus:outline-none focus:border-brass/70"
      />
    </Modal>
  );
}

