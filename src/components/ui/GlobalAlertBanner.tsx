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
      className={`bg-warning-50 text-warning-900 px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 shrink-0 border-b border-warning-200 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0" aria-hidden="true" />
      <span>{trimmed}</span>
    </div>
  );
}
