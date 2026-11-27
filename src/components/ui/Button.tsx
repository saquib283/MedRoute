/**
 * Afzal Healthcare — Button Component
 * Clean institutional button with architectural 6px radius, restrained medium weight, and 44px touch target.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  staticMotion?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white border border-primary-700/20 shadow-2xs',
  secondary:
    'bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 hover:border-surface-400 shadow-2xs',
  ghost:
    'bg-transparent hover:bg-surface-150 text-surface-600 hover:text-surface-900 border border-transparent',
  danger:
    'bg-danger-600 hover:bg-danger-700 text-white border border-danger-700/20 shadow-2xs',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[44px]',
  md: 'px-4 py-2 text-sm min-h-[44px]',
  lg: 'px-5 py-2.5 text-sm min-h-[44px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-md
        transition-colors duration-150 ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
