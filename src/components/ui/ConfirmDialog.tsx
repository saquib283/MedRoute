'use client';

/**
 * MediRoute India — Confirmation Dialog
 * Reusable modal for destructive actions (delete, deactivate, etc.)
 */

import { useEffect, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-[2px]"
      onClick={() => !loading && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white border border-surface-200 rounded-xl shadow-md w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center mx-auto ${
              variant === 'danger' ? 'bg-danger-100 text-danger-600' : 'bg-warning-100 text-warning-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="text-center">
            <h3 id={titleId} className="text-base font-bold text-surface-900">{title}</h3>
            <p className="text-sm text-surface-600 mt-1.5 leading-relaxed">{message}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              className="flex-1"
              onClick={onConfirm}
              isLoading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
