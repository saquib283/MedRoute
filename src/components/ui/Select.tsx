'use client';

/**
 * Afzal Healthcare — Premium Select Dropdown Component
 * Accessible custom dropdown UI with search filtering, Lucide icons, and keyboard support.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
  required?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  searchable = false,
  error,
  helperText,
  icon,
  className = '',
  required = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search term
  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-surface-700">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`
            w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border text-xs font-medium text-left flex items-center justify-between gap-2 transition-all
            ${
              disabled
                ? 'bg-surface-100 border-surface-200 text-surface-400 cursor-not-allowed'
                : isOpen
                ? 'bg-white border-primary-600 text-surface-900 shadow-xs'
                : error
                ? 'bg-white border-danger-300 text-surface-900 hover:border-danger-400'
                : 'bg-white border-surface-300 text-surface-900 hover:border-surface-400'
            }
          `}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-surface-400 shrink-0">{icon}</span>}
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}

            <span className={`truncate ${!selectedOption ? 'text-surface-400 font-normal' : 'font-semibold'}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-surface-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary-600' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-surface-200 rounded-2xl shadow-xl max-h-60 overflow-hidden flex flex-col animate-scale-in">
            {/* Optional Search Bar */}
            {searchable && (
              <div className="p-2 border-b border-surface-100 bg-surface-50 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-surface-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-surface-200 rounded-lg text-xs text-surface-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 text-surface-400 hover:text-surface-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto p-1.5 space-y-0.5" role="listbox">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`
                        w-full px-3 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all text-left
                        ${
                          isSelected
                            ? 'bg-primary-50 text-primary-900 font-bold'
                            : 'hover:bg-surface-50 text-surface-700 font-medium'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="min-w-0">
                          <p className="truncate">{opt.label}</p>
                          {opt.description && (
                            <p className="text-[10px] text-surface-400 font-normal truncate mt-0.5">
                              {opt.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-surface-400">No options found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-danger-600 font-semibold mt-1">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-surface-400 font-medium mt-1">{helperText}</p>}
    </div>
  );
}
