'use client';

/**
 * Afzal Healthcare — Confirmation Dialog
 * Restrained native <dialog> confirmation with 8px panel radius and 6px buttons.
 */

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const confirmColor =
    variant === 'danger'
      ? 'bg-danger-600 hover:bg-danger-700 text-white'
      : 'bg-warning-600 hover:bg-warning-700 text-white';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
      cancelBtnRef.current?.focus();
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onCancel();
      }}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        if (open && !loading) {
          onCancel();
        }
      }}
      {...({ closedby: loading ? 'none' : 'closerequest' } as Record<string, unknown>)}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-surface-200 bg-white p-0 text-surface-900 shadow-md open:animate-scale-in"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-danger-50 text-danger-600 border border-danger-200'
                : 'bg-warning-50 text-warning-700 border border-warning-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-surface-900">
              {title}
            </h2>
            <p id={descId} className="text-xs text-surface-600 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-100">
          <button
            ref={cancelBtnRef}
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-md text-xs font-medium bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${confirmColor}`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
