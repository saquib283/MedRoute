'use client';

/**
 * MediRoute India — Toast Notification System
 * Global toast with Zustand store. Supports success, error, warning, info.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, variant = 'success', duration = 4000) => {
    const id = `toast-${++counter}-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant, duration }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ─── Convenience Helpers ────────────────────────────────────────────

export const toast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'success', duration),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'error', duration),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'warning', duration),
  info: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'info', duration),
};

// ─── Variant Styles ─────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-success-50',
    border: 'border-success-500',
    text: 'text-success-700',
    icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
  },
  error: {
    bg: 'bg-danger-50',
    border: 'border-danger-500',
    text: 'text-danger-700',
    icon: <XCircle className="w-4 h-4 shrink-0" />,
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-500',
    text: 'text-warning-700',
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
  },
  info: {
    bg: 'bg-info-50',
    border: 'border-info-500',
    text: 'text-info-700',
    icon: <Info className="w-4 h-4 shrink-0" />,
  },
};

// ─── Single Toast Item ──────────────────────────────────────────────

function ToastItem({ t }: { t: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const style = VARIANT_STYLES[t.variant];

  useEffect(() => {
    const timer = setTimeout(() => removeToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, removeToast]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} ${style.text} shadow-md animate-slide-up min-w-[300px] max-w-[420px]`}
      role="alert"
    >
      <span className="shrink-0 flex items-center justify-center">
        {style.icon}
      </span>
      <p className="text-sm font-medium flex-1">{t.message}</p>
      <button
        type="button"
        onClick={() => removeToast(t.id)}
        className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Toast Container (mount once in root layout) ────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
