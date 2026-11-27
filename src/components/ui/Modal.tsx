'use client';

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const maxWidthStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'lg',
  children,
  footer,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`bg-white border border-surface-200 rounded-xl shadow-md w-full ${maxWidthStyles[maxWidth]} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-surface-200 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-surface-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-surface-200 bg-surface-50 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
