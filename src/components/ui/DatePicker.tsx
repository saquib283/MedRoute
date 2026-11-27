'use client';

/**
 * Afzal Healthcare — Premium Date & Time Picker Component
 * Interactive calendar modal popover with Lucide icons, month navigation, and time selection.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

export function parseLocalCalendarDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

interface DatePickerProps {
  label?: string;
  value: string; // ISO date string or datetime-local format 'YYYY-MM-DDTHH:mm'
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  includeTime?: boolean;
  showTimePicker?: boolean;
  helperText?: string;
  error?: string;
  className?: string;
  required?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date...',
  disabled = false,
  includeTime = false,
  showTimePicker,
  helperText,
  error,
  className = '',
  required = false,
}: DatePickerProps) {
  const hasTimePicker = showTimePicker !== undefined ? showTimePicker : includeTime;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected date object parsing
  const parsedDate = value ? parseLocalCalendarDate(value) : new Date();
  const initialDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedTime, setSelectedTime] = useState(
    value && value.includes('T') ? value.split('T')[1].slice(0, 5) : '10:00'
  );

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        queueMicrotask(() => {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        });
      }
    }
  }, [value]);

  // Close popover on click outside or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Days calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen && value) {
      const d = parseLocalCalendarDate(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
    setIsOpen(!isOpen);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${m}-${d}`;

    if (hasTimePicker) {
      onChange(`${dateStr}T${selectedTime}`);
    } else {
      onChange(dateStr);
    }
    if (!hasTimePicker) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    if (value) {
      const datePart = value.split('T')[0];
      onChange(`${datePart}T${newTime}`);
    }
  };

  const formatDisplay = () => {
    if (!value) return '';
    const d = parseLocalCalendarDate(value);
    if (isNaN(d.getTime())) return value;
    if (hasTimePicker) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-surface-700">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger input button */}
        <button
          type="button"
          onClick={handleToggleOpen}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`
            w-full min-h-[44px] px-3 py-2 ${value && !disabled ? 'pr-9' : ''} rounded-md border text-sm text-left flex items-center justify-between gap-2 transition-colors
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
            <CalendarIcon className="w-4 h-4 text-surface-400 shrink-0" />
            <span className={`truncate ${!value ? 'text-surface-400 font-normal' : 'font-normal text-surface-900'}`}>
              {formatDisplay() || placeholder}
            </span>
          </div>

          {!value && <Clock className="w-3.5 h-3.5 text-surface-400 shrink-0" />}
        </button>

        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600 rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Calendar Popover */}
        {isOpen && (
          <div className="absolute z-50 left-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-md p-3.5 w-72 space-y-3 animate-scale-in">
            {/* Header: Month & Year Navigator */}
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-surface-500 hover:text-surface-900 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-surface-900">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-surface-500 hover:text-surface-900 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {DAYS_OF_WEEK.map((d) => (
                <span key={d} className="text-xs font-bold text-surface-500 uppercase">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty padding for first week offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Days numbers */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const m = String(viewMonth + 1).padStart(2, '0');
                const dStr = String(day).padStart(2, '0');
                const dateKey = `${viewYear}-${m}-${dStr}`;

                const isSelected = value && value.startsWith(dateKey);
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === viewMonth &&
                  new Date().getFullYear() === viewYear;

                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={`${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}`}
                    onClick={() => handleDaySelect(day)}
                    className={`
                      w-8 h-8 rounded-md text-xs font-medium flex items-center justify-center transition-colors relative after:absolute after:-inset-1.5 after:content-['']
                      ${
                        isSelected
                          ? 'bg-primary-600 text-white font-semibold'
                          : isToday
                          ? 'border border-primary-500 text-primary-700 bg-primary-50'
                          : 'text-surface-700 hover:bg-surface-100'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Picker Controls (If hasTimePicker is true) */}
            {hasTimePicker && (
              <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
                <span className="text-xs font-bold text-surface-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary-600" /> Time:
                </span>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="px-2 py-1 bg-surface-50 border border-surface-200 rounded-lg text-xs font-semibold text-surface-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {helperText && !error && <p className="text-xs text-surface-500">{helperText}</p>}
      {error && <p className="text-[11px] text-danger-600 font-semibold mt-1">{error}</p>}
    </div>
  );
}
