'use client';

/**
 * Afzal Healthcare — Accessible Native Modal Dialog
 * Crisp 8px radius, hairline border, and restrained institutional header.
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  preventClose?: boolean;
  lightDismiss?: boolean;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-lg',
  preventClose = false,
  lightDismiss = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || !lightDismiss) return;
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return;
    }

    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    let pressedOutside = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (!preventClose && pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [open, lightDismiss, preventClose]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    if (preventClose) {
      e.preventDefault();
      return;
    }
    onClose();
  };

  const handleNativeClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = '';
    }
    if (open && !preventClose) {
      onClose();
    }
  };

  const closedByMode = preventClose ? 'none' : lightDismiss ? 'any' : 'closerequest';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descId : undefined}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      {...({ closedby: closedByMode } as Record<string, unknown>)}
      className={`
        m-auto w-[calc(100%-2rem)] ${maxWidthClass}
        rounded-lg border border-surface-200 bg-white p-0 text-surface-900 shadow-md
        max-h-[min(90dvh,48rem)] overflow-y-auto
        open:animate-scale-in
      `}
    >
      <div className="flex items-start justify-between gap-4 border-b border-surface-200 px-5 py-4 bg-white">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-semibold text-surface-900 flex items-center gap-2"
          >
            {icon && <span className="text-primary-600 shrink-0" aria-hidden="true">{icon}</span>}
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p id={descId} className="text-xs text-surface-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!preventClose) onClose();
          }}
          disabled={preventClose}
          aria-label="Close dialog"
          className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5">{children}</div>
    </dialog>
  );
}
