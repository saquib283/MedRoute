/**
 * Afzal Healthcare — Input Component
 * Clean institutional form input with 6px radius, medium label weight, and 44px height.
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-surface-700"
        >
          {label}
          {props.required && (
            <span className="text-danger-500 ml-0.5">*</span>
          )}
        </label>

        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`
              w-full min-h-[44px] px-3 py-2 text-sm
              ${icon ? 'pl-9' : ''}
              bg-white border rounded-md
              text-surface-900 placeholder:text-surface-400
              disabled:bg-surface-100 disabled:text-surface-500
              transition-colors duration-150
              focus:outline-none focus:border-primary-600
              ${
                error
                  ? 'border-danger-500 focus:border-danger-600'
                  : 'border-surface-300 hover:border-surface-400 focus:border-primary-600'
              }
              ${className}
            `}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            {...props}
          />
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-danger-600 flex items-center gap-1"
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-surface-600"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
