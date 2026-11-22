'use client';

/**
 * Afzal Healthcare — Modern Toast Notification System
 * Global toast with Zustand store. Supports success, error, warning, info, and secure API error abstraction.
 */

import React, { useEffect, useState } from 'react';
import { create } from 'zustand';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastItemData {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: ToastItemData[];
  addToast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, variant = 'success', options = {}) => {
    const id = `toast-${++counter}-${Date.now()}`;
    const duration = options.duration ?? 4500;
    const title = options.title;

    set((state) => ({
      // Limit visible toasts to 4 max
      toasts: [...state.toasts.slice(-3), { id, title, message, variant, duration }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ─── Security Error Sanitizer ────────────────────────────────────────

const INTERNAL_ERROR_PATTERNS = [
  /prisma/i,
  /mysql/i,
  /mariadb/i,
  /postgres/i,
  /syntax\s+error/i,
  /econnrefused/i,
  /fatal/i,
  /uncaught/i,
  /stack\s+trace/i,
  /at\s+[a-z0-9_$./]+\:[0-9]+/i,
  /select\s+.*from/i,
  /insert\s+into/i,
  /update\s+.*set/i,
  /delete\s+from/i,
  /table\s+.*doesn't\s+exist/i,
  /column\s+.*not\s+found/i,
];

/**
 * Sanitizes an error message to prevent leaking internal database schemas,
 * query syntax, or server tracebacks to end users.
 */
export function sanitizeErrorMessage(rawMessage: string, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return fallback;
  }

  const isSensitive = INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage));
  if (isSensitive) {
    return 'A secure processing issue occurred. Please try again or contact support.';
  }

  // Truncate overly long error strings for UI safety
  if (rawMessage.length > 250) {
    return rawMessage.slice(0, 247) + '...';
  }

  return rawMessage;
}

// ─── Convenience Helpers ────────────────────────────────────────────

export const toast = {
  success: (msg: string, titleOrOpts?: string | ToastOptions, duration?: number) => {
    const opts: ToastOptions = typeof titleOrOpts === 'string' ? { title: titleOrOpts, duration } : (titleOrOpts || {});
    useToastStore.getState().addToast(msg, 'success', opts);
  },
  error: (msg: string, titleOrOpts?: string | ToastOptions, duration?: number) => {
    const opts: ToastOptions = typeof titleOrOpts === 'string' ? { title: titleOrOpts, duration } : (titleOrOpts || {});
    const cleanMsg = sanitizeErrorMessage(msg, 'An error occurred while processing your request.');
    useToastStore.getState().addToast(cleanMsg, 'error', opts);
  },
  warning: (msg: string, titleOrOpts?: string | ToastOptions, duration?: number) => {
    const opts: ToastOptions = typeof titleOrOpts === 'string' ? { title: titleOrOpts, duration } : (titleOrOpts || {});
    useToastStore.getState().addToast(msg, 'warning', opts);
  },
  info: (msg: string, titleOrOpts?: string | ToastOptions, duration?: number) => {
    const opts: ToastOptions = typeof titleOrOpts === 'string' ? { title: titleOrOpts, duration } : (titleOrOpts || {});
    useToastStore.getState().addToast(msg, 'info', opts);
  },
  /**
   * Helper to handle API response error objects or catches cleanly with security abstraction
   */
  apiError: (errorObj: any, fallback = 'Action failed. Please try again.', title = 'Request Error') => {
    let msg = fallback;
    if (typeof errorObj === 'string') {
      msg = errorObj;
    } else if (errorObj?.error?.message) {
      msg = errorObj.error.message;
    } else if (errorObj?.error && typeof errorObj.error === 'string') {
      msg = errorObj.error;
    } else if (errorObj?.message) {
      msg = errorObj.message;
    }

    const safeMessage = sanitizeErrorMessage(msg, fallback);
    useToastStore.getState().addToast(safeMessage, 'error', { title, duration: 5500 });
  },
};

// ─── Variant Design Metadata ────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    bg: string;
    border: string;
    text: string;
    titleColor: string;
    iconBg: string;
    progressColor: string;
    IconComponent: React.ComponentType<{ className?: string }>;
    defaultTitle: string;
  }
> = {
  success: {
    bg: 'bg-white',
    border: 'border-emerald-200 shadow-xl shadow-emerald-900/10',
    text: 'text-surface-700',
    titleColor: 'text-emerald-800 font-extrabold',
    iconBg: 'bg-emerald-100/90 text-emerald-700 border border-emerald-200/80',
    progressColor: 'bg-emerald-500',
    IconComponent: CheckCircle2,
    defaultTitle: 'Success',
  },
  error: {
    bg: 'bg-white',
    border: 'border-rose-200 shadow-xl shadow-rose-900/10',
    text: 'text-surface-700',
    titleColor: 'text-rose-800 font-extrabold',
    iconBg: 'bg-rose-100/90 text-rose-700 border border-rose-200/80',
    progressColor: 'bg-rose-500',
    IconComponent: XCircle,
    defaultTitle: 'Error',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200 shadow-xl shadow-amber-900/10',
    text: 'text-surface-700',
    titleColor: 'text-amber-800 font-extrabold',
    iconBg: 'bg-amber-100/90 text-amber-700 border border-amber-200/80',
    progressColor: 'bg-amber-500',
    IconComponent: AlertTriangle,
    defaultTitle: 'Warning',
  },
  info: {
    bg: 'bg-white',
    border: 'border-sky-200 shadow-xl shadow-sky-900/10',
    text: 'text-surface-700',
    titleColor: 'text-sky-800 font-extrabold',
    iconBg: 'bg-sky-100/90 text-sky-700 border border-sky-200/80',
    progressColor: 'bg-sky-500',
    IconComponent: Info,
    defaultTitle: 'Information',
  },
};

// ─── Single Toast Item ──────────────────────────────────────────────

function ToastCard({ t }: { t: ToastItemData }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = VARIANT_CONFIG[t.variant];
  const Icon = config.IconComponent;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(t.id);
    }, t.duration);

    return () => {
      clearTimeout(timer);
    };
  }, [t.id, t.duration, removeToast]);

  return (
    <div
      className={`
        relative overflow-hidden group
        flex items-start gap-3.5 p-4 rounded-xl border shadow-lg backdrop-blur-md
        transition-all duration-300 transform translate-y-0
        w-[340px] sm:w-[380px] max-w-full select-none
        ${config.bg} ${config.border}
      `}
      role="alert"
    >
      {/* Accent Icon Badge */}
      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${config.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Message Content */}
      <div className="flex-1 pr-2 min-w-0">
        <h4 className={`text-xs uppercase tracking-wider ${config.titleColor}`}>
          {t.title || config.defaultTitle}
        </h4>
        <p className={`text-xs leading-relaxed font-medium mt-0.5 break-words ${config.text}`}>
          {t.message}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={() => removeToast(t.id)}
        className="shrink-0 p-1 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-md transition-colors"
        aria-label="Dismiss toast notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Auto-dismiss Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-100/60 overflow-hidden">
        <div
          className={`h-full ${config.progressColor}`}
          style={{
            animation: `shrink-progress ${t.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Toast Container Component ──────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-auto max-w-[calc(100vw-2.5rem)]"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}
