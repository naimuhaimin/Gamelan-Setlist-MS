'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import type { RoleType } from '@/types';
import { Button, Chip, Field, Input, Modal, cx } from './ui';

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

const ROLES: Array<{ id: Exclude<RoleType, 'player'>; title: string; text: string; icon: React.ReactNode }> = [
  { id: 'controller', title: 'Controller', text: 'Next / previous song and loop count', icon: <SlidersHorizontal className="w-5 h-5" /> },
  { id: 'maestro', title: 'Maestro', text: 'Setlists, adjustments, go live', icon: <KeyRound className="w-5 h-5" /> },
  { id: 'admin', title: 'Admin', text: 'Everything, plus instruments & passkeys', icon: <ShieldCheck className="w-5 h-5" /> },
];

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, role } = useStage();
  const [selected, setSelected] = useState<Exclude<RoleType, 'player'>>('controller');
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPasskey('');
      setError(null);
      setSelected(role === 'player' ? 'controller' : role);
    }
  }, [open, role]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = login(selected, passkey);
    if (res.ok) onClose();
    else {
      setError(res.message ?? 'That passkey is not correct.');
      setPasskey('');
      inputRef.current?.focus();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign in"
      description="Musicians don’t need to sign in. This is for the people running the stage."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="login-form" disabled={!passkey.trim()}>
            Sign in
          </Button>
        </>
      }
    >
      <form id="login-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-2" role="radiogroup" aria-label="Role">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={selected === r.id}
              onClick={() => {
                setSelected(r.id);
                setError(null);
                inputRef.current?.focus();
              }}
              className={cx(
                'w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                selected === r.id ? 'border-brass/60 bg-brass-soft' : 'border-line hover:border-line-strong'
              )}
            >
              <span className={selected === r.id ? 'text-brass' : 'text-muted'}>{r.icon}</span>
              <span className="flex-1">
                <span className="block font-medium">{r.title}</span>
                <span className="block text-xs text-muted">{r.text}</span>
              </span>
              <span
                className={cx(
                  'w-4 h-4 rounded-full border-2',
                  selected === r.id ? 'border-brass bg-brass shadow-[inset_0_0_0_3px_#13151c]' : 'border-line-strong'
                )}
              />
            </button>
          ))}
        </div>
        <Field label="Passkey" htmlFor="passkey">
          <Input
            ref={inputRef}
            id="passkey"
            type="password"
            autoComplete="current-password"
            value={passkey}
            onChange={(e) => {
              setPasskey(e.target.value);
              setError(null);
            }}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Instrument picker (musicians)
// ---------------------------------------------------------------------------

export function InstrumentPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { instruments, selectedInstrument, selectInstrument } = useStage();
  const choose = (i: string | null) => {
    selectInstrument(i);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={() => choose(selectedInstrument)}
      title="Which instrument do you play?"
      description="You’ll get a clear alert whenever your instrument starts the intro."
      size="sm"
    >
      <div className="grid grid-cols-2 gap-2">
        {instruments.map((i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={cx(
              'h-14 rounded-xl border text-base font-semibold transition-colors',
              selectedInstrument === i ? 'bg-brass text-brass-ink border-brass' : 'bg-raised border-line hover:border-line-strong'
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <Button variant="ghost" className="w-full mt-3" onClick={() => choose(null)}>
        I’m just watching
      </Button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

export function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setUrl(window.location.origin);
  }, [open]);

  useEffect(() => {
    if (!open || !url) return;
    const id = requestAnimationFrame(() => {
      if (canvasRef.current)
        QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1, color: { dark: '#0b0c10', light: '#ffffff' } }).catch(() => undefined);
    });
    return () => cancelAnimationFrame(id);
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked; the URL is visible and selectable
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Open on other devices" description="Scan with a phone or tablet camera." size="sm">
      <div className="flex flex-col items-center gap-4">
        <div className="p-3 bg-white rounded-2xl">
          <canvas ref={canvasRef} className="block w-[220px] h-[220px]" />
        </div>
        <div className="w-full flex items-center gap-2">
          <Input readOnly value={url} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
          <Button onClick={copy} aria-label="Copy link">
            {copied ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <ul className="w-full text-sm text-muted space-y-1.5">
          <li>• Musicians just open the link and pick their instrument.</li>
          <li>• Controllers and the Maestro sign in from the account menu.</li>
          <li>• Every device updates live. Keep screens open during the ceremony.</li>
        </ul>
        <div className="w-full">
          <Chip selected={false} onClick={() => window.open(url, '_blank')} className="w-full">
            Open in a new tab
          </Chip>
        </div>
      </div>
    </Modal>
  );
}
