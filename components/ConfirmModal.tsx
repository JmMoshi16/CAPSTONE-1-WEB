'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  /** May be async: both buttons stay disabled until it settles, so it cannot run twice (audit M-09). */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="bg-card border border-border rounded-card p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/10' : 'bg-orange/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-500' : 'text-orange'}`} aria-hidden />
          </div>
          <h3 id="confirm-title" className="text-white font-bold">{title}</h3>
        </div>
        <p id="confirm-message" className="text-white/60 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-btn border border-border text-white/60 hover:text-white hover:border-white/30 transition text-sm font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            autoFocus
            className={`flex-1 py-2.5 rounded-btn font-bold text-sm transition disabled:opacity-50 ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-orange hover:bg-orange/80 text-black'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
