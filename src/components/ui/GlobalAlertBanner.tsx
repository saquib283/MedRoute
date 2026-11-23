'use client';

/**
 * Afzal Healthcare — Global System Alert Banner
 * Renders admin-configured platform alertBannerText across all 4 portals.
 */

import { AlertTriangle } from 'lucide-react';

interface GlobalAlertBannerProps {
  text?: string | null;
  className?: string;
}

export function GlobalAlertBanner({ text, className = '' }: GlobalAlertBannerProps) {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-warning-500 text-white px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-xs shrink-0 border-b border-warning-600 animate-slide-down ${className}`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{trimmed}</span>
    </div>
  );
}
