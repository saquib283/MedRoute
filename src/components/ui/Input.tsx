/**
 * MediRoute India — Input Component
 * Accessible form input with label, error state, and icons.
 * Clinical design system — light-mode, white background, subtle borders.
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
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-800"
        >
          {label}
          {props.required && (
            <span className="text-danger-500 ml-0.5">*</span>
          )}
        </label>

        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`
              w-full min-h-[44px] px-4 py-2.5
              ${icon ? 'pl-11' : ''}
              bg-white border rounded-lg
              text-surface-900 placeholder:text-surface-400
              transition-colors duration-150
              focus:border-primary-600
              ${error
                ? 'border-danger-500 focus:border-danger-600'
                : 'border-surface-300 hover:border-surface-400'
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
            className="text-sm text-danger-600 flex items-center gap-1.5"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
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
