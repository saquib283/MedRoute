'use client';

/**
 * Afzal Healthcare — Confirmation Dialog
 * Built on the native <dialog> element with initial focus placed on the safe Cancel action.
 */

import React, { useEffect, useId, useRef } from 'react';

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

  const confirmColor =
    variant === 'danger'
      ? 'bg-danger-600 hover:bg-danger-700 text-white'
      : 'bg-warning-600 hover:bg-warning-700 text-white';

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
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-surface-200 bg-white p-0 text-surface-900 shadow-2xl open:animate-scale-in"
    >
      <div className="p-6 space-y-5">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
            variant === 'danger'
              ? 'bg-danger-100 text-danger-600 border border-danger-200'
              : 'bg-warning-100 text-warning-700 border border-warning-200'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="text-center">
          <h2 id={titleId} className="text-lg font-bold text-surface-900">
            {title}
          </h2>
          <p id={descId} className="text-sm text-surface-600 mt-1.5 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            ref={cancelBtnRef}
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.96] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-[color,background-color,transform] duration-150 active:scale-[0.96] disabled:opacity-50 ${confirmColor}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
