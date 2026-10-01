'use client';

import React, { useState, useEffect } from 'react';
import { useStage } from '@/lib/stageContext';
import { Session } from '@/types';
import { Plus, X, Calendar, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddSidangModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (session: Session) => void;
}

export const AddSidangModal: React.FC<AddSidangModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { sessions, addSession, switchActiveSession } = useStage();

  // Calculate next suggested sidang number
  const nextDefaultNumber = React.useMemo(() => {
    if (!sessions.length) return 1;
    const maxNum = Math.max(...sessions.map((s) => s.sidang_number || 0), 0);
    return maxNum + 1;
  }, [sessions]);

  const [sidangNumber, setSidangNumber] = useState<number>(nextDefaultNumber);
  const [customName, setCustomName] = useState<string>('');
  const [ceremonyDate, setCeremonyDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [passkey, setPasskey] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync default number when modal opens
  useEffect(() => {
    if (isOpen) {
      setSidangNumber(nextDefaultNumber);
      setCustomName(`Sidang ${nextDefaultNumber}`);
      setPasskey(`sidang${nextDefaultNumber}`);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, nextDefaultNumber]);

  if (!isOpen) return null;

  const handleNumberChange = (num: number) => {
    const validNum = Math.max(1, num);
    setSidangNumber(validNum);
    setCustomName(`Sidang ${validNum}`);
    setPasskey(`sidang${validNum}`);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (sidangNumber <= 0 || isNaN(sidangNumber)) {
      setErrorMsg('Please enter a valid Sidang number (1, 2, 3...).');
      return;
    }

    // Check if duplicate sidang number already exists
    const duplicate = sessions.find((s) => s.sidang_number === sidangNumber);
    if (duplicate) {
      setErrorMsg(`Sidang ${sidangNumber} already exists (${duplicate.name}). Please pick a different number.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await addSession(
        sidangNumber,
        customName.trim() || `Sidang ${sidangNumber}`,
        passkey.trim() || `sidang${sidangNumber}`,
        ceremonyDate
      );

      // Switch active stage / editor to the newly created Sidang
      await switchActiveSession(created.id);

      if (onCreated) {
        onCreated(created);
      }

      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to create Sidang');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#101423] border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-white space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Ceremony Session Configuration</span>
          </div>
          <h3 className="text-2xl font-black text-white">Add New Sidang</h3>
          <p className="text-xs text-slate-400">
            Create a flexible numbered Sidang (e.g. Sidang {nextDefaultNumber}). Standard Bahagian 1 - 4 will automatically be generated.
          </p>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Sidang Number Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase font-bold text-slate-300 flex items-center justify-between">
              <span>1. Sidang Number:</span>
              <span className="text-[11px] text-amber-400">e.g. 1, 2, 3, 4, 5...</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="99"
                required
                value={sidangNumber}
                onChange={(e) => handleNumberChange(parseInt(e.target.value) || 1)}
                className="w-28 px-4 py-2.5 rounded-xl bg-[#0c0f1a] border border-[#2d3754] text-white font-mono text-lg font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumberChange(num)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                      sidangNumber === num
                        ? 'bg-amber-500 text-black border-amber-400 shadow-glow-gold'
                        : 'bg-[#181d30] border-[#29324e] text-slate-300 hover:text-white'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sidang Label / Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase font-bold text-slate-300">
              2. Sidang Label / Display Name:
            </label>
            <input
              type="text"
              required
              placeholder={`e.g. Sidang ${sidangNumber}`}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0c0f1a] border border-[#2d3754] text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-500">
              You can append specific faculty or details (e.g. &ldquo;Sidang {sidangNumber} (Sains &amp; IT)&rdquo;)
            </p>
          </div>

          {/* Ceremony Date & Maestro Passkey Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Date:</span>
              </label>
              <input
                type="date"
                required
                value={ceremonyDate}
                onChange={(e) => setCeremonyDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0c0f1a] border border-[#2d3754] text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase font-bold text-slate-300">
                Maestro Passkey:
              </label>
              <input
                type="text"
                required
                placeholder={`e.g. sidang${sidangNumber}`}
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0c0f1a] border border-[#2d3754] text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Automatic Bahagian Info Banner */}
          <div className="p-3.5 rounded-2xl bg-[#0d101c] border border-[#1f263d] space-y-1.5 text-xs text-slate-400">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Standard 4 Bahagian Generated Automatically:</span>
            </div>
            <ul className="text-[11px] font-mono text-slate-400 space-y-0.5 pl-5 list-disc">
              <li>Bahagian 1: Perarakan Masuk VIP &amp; Canselor</li>
              <li>Bahagian 2: Penganugerahan Ijazah Siswazah</li>
              <li>Bahagian 3: Persembahan Selingan Seni Gamelan</li>
              <li>Bahagian 4: Perarakan Keluar &amp; Penutup Rasmi</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#171c2f] hover:bg-[#222944] text-slate-300 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-glow-gold disabled:opacity-50"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Creating...' : `Create Sidang ${sidangNumber}`}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
