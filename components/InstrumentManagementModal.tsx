'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  RotateCcw,
  AlertTriangle,
  Search,
  CheckCircle2,
  ShieldCheck,
  Music,
} from 'lucide-react';

interface InstrumentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstrumentManagementModal: React.FC<InstrumentManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    instruments,
    songs,
    addInstrument,
    updateInstrument,
    deleteInstrument,
    restoreDefaultInstruments,
    activeRole,
  } = useStage();

  const [newInstrumentName, setNewInstrumentName] = useState('');
  const [editingOldName, setEditingOldName] = useState<string | null>(null);
  const [editingNewName, setEditingNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirm state
  const [instrumentToDelete, setInstrumentToDelete] = useState<string | null>(null);
  // Restore defaults confirm state
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmed = newInstrumentName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an instrument name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addInstrument(trimmed);
      setSuccessMsg(`Added "${trimmed}" to the Gamelan instruments ensemble!`);
      setNewInstrumentName('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to add instrument.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (name: string) => {
    setEditingOldName(name);
    setEditingNewName(name);
    setErrorMsg(null);
  };

  const handleSaveEdit = async (oldName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmed = editingNewName.trim();
    if (!trimmed) {
      setErrorMsg('Instrument name cannot be empty.');
      return;
    }

    if (trimmed === oldName) {
      setEditingOldName(null);
      return;
    }

    try {
      setIsSubmitting(true);
      await updateInstrument(oldName, trimmed);
      setSuccessMsg(`Renamed "${oldName}" to "${trimmed}".`);
      setEditingOldName(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to update instrument.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!instrumentToDelete) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await deleteInstrument(instrumentToDelete);
      setSuccessMsg(`Removed "${instrumentToDelete}" from instruments.`);
      setInstrumentToDelete(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to delete instrument.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRestoreDefaults = async () => {
    try {
      setIsSubmitting(true);
      await restoreDefaultInstruments();
      setShowRestoreConfirm(false);
      setSuccessMsg('Restored default 12 Gamelan instruments.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to restore default instruments.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsageCount = (instName: string) => {
    return songs.filter((s) => s.intro_instruments.includes(instName)).length;
  };

  const filteredInstruments = instruments.filter((inst) =>
    inst.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#101423] border-2 border-amber-500/50 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative text-white space-y-5 max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-[#171c2f] border border-[#262f4e] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-10 border-b border-[#21273f] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest font-bold text-amber-400">
              Gamelan Ensemble Config
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/50 flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3 h-3 text-red-400" />
              Master Admin
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Manage Gamelan Instruments
          </h3>
          <p className="text-xs text-slate-400">
            Add new instruments, rename existing ones, or delete instruments from the ensemble. These instruments are used for intro cue timing and player highlights.
          </p>
        </div>

        {/* Feedback Alerts */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-bold flex items-center gap-2">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Add Instrument Form */}
        <form onSubmit={handleAdd} className="bg-[#141828] border border-[#252e4d] p-3.5 rounded-2xl space-y-2">
          <label className="text-xs font-mono uppercase font-bold text-slate-300 block">
            + Add New Instrument into Ensemble:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              placeholder="e.g. Gong Suwukan, Gendang Anak, Kenong Telon..."
              value={newInstrumentName}
              onChange={(e) => setNewInstrumentName(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#0c0f1b] border border-[#2a3454] text-white text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-glow-gold shrink-0 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Search & List Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase">
            Active Instruments ({instruments.length})
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter instrument..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#141828] border border-[#252e4d] text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* Instruments List */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 flex-1">
          {filteredInstruments.length > 0 ? (
            filteredInstruments.map((inst) => {
              const usageCount = getUsageCount(inst);
              const isCurrentlyEditing = editingOldName === inst;

              return (
                <div
                  key={inst}
                  className="p-3 rounded-2xl bg-[#131728] border border-[#232c48] flex items-center justify-between gap-3 hover:border-slate-500 transition-all"
                >
                  {isCurrentlyEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingNewName}
                        onChange={(e) => setEditingNewName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[#0c0f1b] border border-amber-400 text-white text-xs font-bold focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(inst)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => setEditingOldName(null)}
                        className="px-3 py-1.5 rounded-xl bg-[#1d243b] text-slate-400 hover:text-white text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-white truncate block">
                            {inst}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c223a] text-slate-400 shrink-0">
                          {usageCount} songs cue this
                        </span>
                      </div>

                      {/* Edit and Delete Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(inst)}
                          className="p-2 rounded-xl bg-[#1d243b] hover:bg-[#283250] text-slate-300 hover:text-white transition-all text-xs"
                          title="Rename Instrument"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                        <button
                          onClick={() => setInstrumentToDelete(inst)}
                          className="p-2 rounded-xl bg-[#1d243b] hover:bg-red-950 text-slate-400 hover:text-red-400 transition-all text-xs"
                          title="Delete Instrument"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No matching instruments found
            </div>
          )}
        </div>

        {/* Footer with Restore Defaults & Close */}
        <div className="pt-3 border-t border-[#21273f] flex items-center justify-between text-xs">
          <button
            onClick={() => setShowRestoreConfirm(true)}
            className="text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors font-mono"
            title="Reset instruments to the standard 12 Gamelan instruments"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restore Default 12 Instruments</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1a2034] hover:bg-[#252e4a] text-slate-200 font-bold transition-all"
          >
            Done
          </button>
        </div>

      </div>

      {/* Delete Confirmation Dialog */}
      {instrumentToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#121626] border-2 border-red-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">Delete Instrument?</h4>
                <p className="text-xs text-slate-400">Ensemble Configuration</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0f1b] border border-[#242e4a] space-y-1.5 text-xs">
              <span className="text-slate-400 font-medium">You are deleting:</span>
              <p className="font-black text-sm text-red-300 truncate">
                {instrumentToDelete}
              </p>
              {getUsageCount(instrumentToDelete) > 0 && (
                <p className="text-[11px] text-amber-400 font-bold">
                  ⚠️ Note: {getUsageCount(instrumentToDelete)} song(s) in the library currently use this instrument for intro cues.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInstrumentToDelete(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#1a2034] hover:bg-[#242e48] text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Deleting...' : 'Delete Instrument'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Restore Defaults Confirmation Dialog */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#121626] border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">Restore Standard 12?</h4>
                <p className="text-xs text-slate-400">Ensemble Configuration</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0f1b] border border-[#242e4a] space-y-1.5 text-xs text-slate-300">
              <p>
                Are you sure you want to reset the ensemble to the standard 12 Gamelan instruments?
              </p>
              <p className="text-slate-400 text-[11px]">
                Any custom instruments added will be removed, and default names restored.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#1a2034] hover:bg-[#242e48] text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreDefaults}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isSubmitting ? 'Restoring...' : 'Restore Defaults'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
