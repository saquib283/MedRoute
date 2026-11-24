'use client';

/**
 * Afzal Healthcare — Select Dropdown Component
 * Clean institutional select control with 6px radius, restrained typography, and keyboard support.
 */

import React, { useState, useRef, useEffect, useId } from 'react';
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
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <label className="block text-xs font-medium text-surface-700">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className={`
            w-full min-h-[44px] px-3 py-2 rounded-md border text-sm text-left flex items-center justify-between gap-2 transition-colors
            ${
              disabled
                ? 'bg-surface-100 border-surface-200 text-surface-400 cursor-not-allowed'
                : isOpen
                ? 'bg-white border-primary-600 text-surface-900'
                : error
                ? 'bg-white border-danger-400 text-surface-900 hover:border-danger-500'
                : 'bg-white border-surface-300 text-surface-900 hover:border-surface-400'
            }
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-surface-400 shrink-0">{icon}</span>}
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}

            <span className={`truncate ${!selectedOption ? 'text-surface-400 font-normal' : 'font-normal text-surface-900'}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-surface-400 shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-surface-700' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-md max-h-60 overflow-hidden flex flex-col animate-scale-in">
            {searchable && (
              <div className="p-2 border-b border-surface-100 bg-surface-50 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter options..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear filter"
                      className="absolute right-2 text-surface-400 hover:text-surface-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div id={listboxId} className="overflow-y-auto p-1 space-y-0.5" role="listbox">
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
                        w-full px-3 py-2 rounded-md text-xs flex items-center justify-between gap-2 transition-colors text-left
                        ${
                          isSelected
                            ? 'bg-primary-50 text-primary-900 font-medium'
                            : 'hover:bg-surface-100 text-surface-700 font-normal'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="min-w-0">
                          <p className="truncate">{opt.label}</p>
                          {opt.description && (
                            <p className="text-[11px] text-surface-500 font-normal truncate mt-0.5">
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
                <div className="p-4 text-center text-xs text-surface-500">No matching options</div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
      {!error && helperText && <p className="text-xs text-surface-500 mt-1">{helperText}</p>}
    </div>
  );
}
