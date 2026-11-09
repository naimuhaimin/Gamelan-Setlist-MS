'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useT } from '@/lib/i18n';
import { useChat } from '@/lib/useChat';
import type { ChatMessage } from '@/types';
import { Button, IconButton, Input, Modal, cx } from './ui';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', maestro: 'Maestro', controller: 'Controller' };

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short' });

/**
 * Floating chat button for one Sidang, with an unread count. Opens the Sidang's live chat as a sheet.
 * `raised` lifts it above the live control bar.
 */
export function ChatLauncher({ sessionId, sessionName, raised }: { sessionId: string; sessionName: string; raised?: boolean }) {
  const chat = useChat(sessionId);
  const [open, setOpen] = useState(false);
  const { t } = useT();

  // While open, everything that arrives counts as read
  useEffect(() => {
    if (open) chat.markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.messages.length]);

  if (chat.available === false) return null; // table not created yet

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={chat.unread ? t('Open live chat, {n} unread', { n: chat.unread }) : t('Open live chat')}
        className={cx(
          'fixed right-4 z-30 h-14 pl-4 pr-5 rounded-full shadow-2xl inline-flex items-center gap-2 font-semibold',
          'bg-brass text-brass-ink hover:bg-brass-strong transition-[bottom]',
          raised
            ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))] md:bottom-[7rem]'
            : 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6'
        )}
      >
        <MessageCircle className="w-6 h-6" />
        <span className="hidden sm:inline">{t('Chat')}</span>
        {chat.unread > 0 && (
          <span className="min-w-6 h-6 px-1.5 rounded-full bg-songket text-white text-xs font-bold grid place-items-center tabular">
            {chat.unread > 9 ? '9+' : chat.unread}
          </span>
        )}
      </button>
      <ChatSheet open={open} onClose={() => setOpen(false)} sessionName={sessionName} chat={chat} />
    </>
  );
}

function ChatSheet({
  open,
  onClose,
  sessionName,
  chat,
}: {
  open: boolean;
  onClose: () => void;
  sessionName: string;
  chat: ReturnType<typeof useChat>;
}) {
  const { role, selectedInstrument, isManager, notify } = useStage();
  const [draft, setDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { t, lang } = useT();

  // Keep the newest message in view
  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, chat.messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    const text = draft;
    setDraft('');
    try {
      await chat.send(text, { instrument: selectedInstrument, role });
    } catch (err) {
      setDraft(text);
      notify(t('Message not sent: {error}', { error: (err as Error).message }), 'error');
    } finally {
      setSending(false);
    }
  };

  const needsName = !chat.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Live chat')}
      description={t('{sidang} · everyone with the app can read this', { sidang: sessionName })}
      footer={
        needsName ? (
          <form
            className="w-full flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameDraft.trim()) chat.setName(nameDraft);
            }}
          >
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={t('Your name, e.g. Aiman')}
              maxLength={40}
              aria-label={t('Your name')}
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={!nameDraft.trim()}>
              {t('Join chat')}
            </Button>
          </form>
        ) : (
          <form className="w-full flex gap-2" onSubmit={submit}>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('Message as {name}…', { name: chat.name })}
              maxLength={500}
              aria-label={t('Message')}
              className="flex-1"
              enterKeyHint="send"
            />
            <IconButton label={t('Send')} type="submit" variant="primary" disabled={!draft.trim() || sending} className="w-11 h-11 shrink-0">
              <Send className="w-5 h-5" />
            </IconButton>
          </form>
        )
      }
    >
      <div ref={listRef} className="h-[55dvh] sm:h-[60vh] overflow-y-auto scrollbar-thin -mx-5 px-5 flex flex-col gap-2 py-1">
        {chat.available === null ? (
          <p className="m-auto text-sm text-muted">{t('Loading…')}</p>
        ) : chat.messages.length === 0 ? (
          <div className="m-auto text-center text-muted">
            <MessageCircle className="w-10 h-10 mx-auto text-faint" />
            <p className="mt-2 font-medium text-ink">{t('No messages yet')}</p>
            <p className="text-sm">{t('Say hello to the ensemble.')}</p>
          </div>
        ) : (
          chat.messages.map((m, i) => (
            <Bubble
              key={m.id}
              m={m}
              mine={m.device_id === chat.myDeviceId}
              showDay={i === 0 || dayOf(chat.messages[i - 1].created_at, lang) !== dayOf(m.created_at, lang)}
              grouped={i > 0 && chat.messages[i - 1].device_id === m.device_id && chat.messages[i - 1].author === m.author}
              canDelete={isManager || m.device_id === chat.myDeviceId}
              onDelete={() => chat.remove(m.id).catch((err) => notify(t('Not deleted: {error}', { error: (err as Error).message }), 'error'))}
            />
          ))
        )}
      </div>
      {!needsName && (
        <p className="text-xs text-faint mt-2">
          {t('Chatting as')} <b className="text-muted">{chat.name}</b>
          {selectedInstrument ? ` · ${selectedInstrument}` : ''} ·{' '}
          <button className="underline hover:text-ink" onClick={() => chat.setName('')}>
            {t('change name')}
          </button>
        </p>
      )}
    </Modal>
  );
}

function Bubble({
  m,
  mine,
  showDay,
  grouped,
  canDelete,
  onDelete,
}: {
  m: ChatMessage;
  mine: boolean;
  showDay: boolean;
  grouped: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const roleLabel = ROLE_LABEL[m.role];
  const { t, lang } = useT();
  return (
    <>
      {showDay && <div className="self-center text-xs text-faint py-1">{dayOf(m.created_at, lang)}</div>}
      <div className={cx('group flex flex-col max-w-[85%] min-w-0', mine ? 'self-end items-end' : 'self-start items-start', grouped && !showDay && '-mt-1')}>
        {(!grouped || showDay) && (
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted px-1 mb-0.5">
            <span className="font-semibold text-ink">{mine ? t('You') : m.author}</span>
            {m.instrument && <span>· {m.instrument}</span>}
            {roleLabel && <span className="px-1.5 rounded bg-songket-soft text-songket-light font-semibold">{t(roleLabel)}</span>}
          </div>
        )}
        <div className="flex items-end gap-1 max-w-full">
          {mine && canDelete && <DeleteBtn onDelete={onDelete} />}
          <div
            className={cx(
              'rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words min-w-0',
              mine ? 'bg-brass text-brass-ink rounded-br-md' : 'bg-raised border border-line rounded-bl-md'
            )}
          >
            {m.body}
            <span className={cx('ml-2 text-[11px] tabular align-bottom', mine ? 'text-brass-ink/70' : 'text-faint')}>{timeOf(m.created_at)}</span>
          </div>
          {!mine && canDelete && <DeleteBtn onDelete={onDelete} />}
        </div>
      </div>
    </>
  );
}

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
  const { t } = useT();
  return (
    <button
      onClick={onDelete}
      aria-label={t('Delete message')}
      className="w-7 h-7 shrink-0 grid place-items-center rounded-full text-faint hover:text-danger opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
