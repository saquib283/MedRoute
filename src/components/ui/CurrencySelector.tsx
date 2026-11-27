'use client';

/**
 * MediRoute India — Currency & Country Selector Component
 * Interactive dropdown for switching viewing currency and regional locale with flags.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import { CurrencyCode } from '@/lib/currency/types';
import { ChevronDown, Check, Search } from 'lucide-react';

interface CurrencySelectorProps {
  variant?: 'compact' | 'pill' | 'header' | 'full';
  className?: string;
  showFlag?: boolean;
}

export function CurrencySelector({
  variant = 'header',
  className = '',
  showFlag = true,
}: CurrencySelectorProps) {
  const {
    currentCurrency,
    currencyMeta,
    supportedCurrencies,
    setCurrency,
    rates,
  } = useCurrency();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currencyList = Object.values(supportedCurrencies).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  });

  const handleSelect = (code: CurrencyCode) => {
    setCurrency(code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 hover:text-surface-900 transition-colors text-xs font-semibold shadow-xs cursor-pointer"
          aria-label="Change currency"
          title={`Viewing in ${currencyMeta.name} (${currencyMeta.code})`}
        >
          {showFlag && <span className="text-sm">{currencyMeta.flag}</span>}
          <span className="font-bold text-surface-900">{currencyMeta.code}</span>
          <span className="text-surface-400 font-normal">({currencyMeta.symbol})</span>
          <ChevronDown className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {variant === 'pill' && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-100 hover:bg-surface-200 text-surface-700 text-xs font-bold transition-colors cursor-pointer"
        >
          <span className="text-sm">{currencyMeta.flag}</span>
          <span>{currencyMeta.code}</span>
          <ChevronDown className="w-3 h-3 text-surface-400" />
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-bold text-surface-600 hover:text-primary-600 transition-colors p-1"
        >
          <span>{currencyMeta.flag}</span>
          <span>{currencyMeta.code}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {variant === 'full' && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-sm font-medium text-surface-900 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">{currencyMeta.flag}</span>
            <div className="text-left">
              <p className="font-bold text-surface-900 leading-none">{currencyMeta.code} ({currencyMeta.symbol})</p>
              <p className="text-xs text-surface-500 mt-0.5">{currencyMeta.name}</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-surface-400" />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-xl bg-white shadow-xl border border-surface-200 py-2 z-50 animate-fade-in divide-y divide-surface-100">
          {/* Search Header */}
          <div className="p-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currency or country..."
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-50 border border-surface-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Currency List */}
          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">
              Select Currency
            </div>
            {currencyList.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-3">No currencies found</p>
            ) : (
              currencyList.map((c) => {
                const isSelected = c.code === currentCurrency;
                const rateVsINR = rates[c.code] || 1;
                const inverse = rateVsINR > 0 ? (1 / rateVsINR).toFixed(2) : '—';

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-primary-50 text-primary-900 font-bold'
                        : 'text-surface-700 hover:bg-surface-50 hover:text-surface-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{c.flag}</span>
                      <div className="min-w-0">
                        <p className="font-bold truncate text-surface-900">
                          {c.code} <span className="text-surface-500 font-normal">({c.symbol})</span>
                        </p>
                        <p className="text-[11px] text-surface-400 truncate">{c.name}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary-600 inline" />
                      ) : c.code !== 'INR' ? (
                        <span className="text-[10px] text-surface-400 font-mono">1 {c.code} ≈ ₹{inverse}</span>
                      ) : (
                        <span className="text-[10px] text-surface-400 font-mono">Base</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Footer */}
          <div className="px-3 py-1.5 bg-surface-50 text-[10px] text-surface-500 flex items-center justify-between">
            <span>Base currency: INR</span>
            <span>Reference rates</span>
          </div>
        </div>
      )}
    </div>
  );
}
