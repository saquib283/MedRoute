'use client';

/**
 * MediRoute India — Dynamic PriceTag Component
 * Formats amounts according to user's selected viewing currency with optional base INR indicator.
 */

import React from 'react';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import { CurrencyCode } from '@/lib/currency/types';

interface PriceTagProps {
  amountInINR: number | string | null | undefined;
  currency?: CurrencyCode; // Override currency if explicitly set
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showOriginalINR?: boolean;
  showCode?: boolean;
  className?: string;
  prefix?: string;
  suffix?: string;
  approximate?: boolean;
}

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm font-semibold',
  md: 'text-base font-bold',
  lg: 'text-lg font-extrabold',
  xl: 'text-xl font-extrabold',
  '2xl': 'text-2xl font-black tracking-tight',
};

export function PriceTag({
  amountInINR,
  currency,
  size = 'md',
  showOriginalINR = false,
  showCode = false,
  className = '',
  prefix = '',
  suffix = '',
  approximate = false,
}: PriceTagProps) {
  const { format, currentCurrency } = useCurrency();

  const activeCurrency = currency || currentCurrency;
  const isConverted = activeCurrency !== 'INR';

  const formatted = format(amountInINR, activeCurrency);

  // Original INR string for tooltip / sub-label
  const originalINRFormatted =
    amountInINR !== null && amountInINR !== undefined && amountInINR !== ''
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(Number(amountInINR))
      : '—';

  return (
    <span
      className={`inline-flex items-baseline gap-1 text-surface-900 ${sizeClasses[size]} ${className}`}
      title={isConverted ? `Base price: ${originalINRFormatted}` : undefined}
    >
      {prefix && <span className="font-normal text-surface-500">{prefix}</span>}
      {approximate && isConverted && <span className="font-normal text-surface-400">~</span>}
      <span>{formatted}</span>
      {showCode && <span className="text-[0.75em] font-bold text-surface-500 uppercase ml-0.5">{activeCurrency}</span>}
      {suffix && <span className="font-normal text-surface-500 text-[0.85em]">{suffix}</span>}
      {showOriginalINR && isConverted && (
        <span className="text-xs font-normal text-surface-400 ml-1">
          ({originalINRFormatted})
        </span>
      )}
    </span>
  );
}
