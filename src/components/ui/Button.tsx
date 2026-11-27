/**
 * MediRoute India — Button Component
 * Clinical design system button with consistent variants and 44px min touch target.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white',
  secondary:
    'bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 hover:border-surface-400',
  ghost:
    'bg-transparent hover:bg-surface-200 text-surface-700 hover:text-surface-900',
  danger:
    'bg-danger-600 hover:bg-danger-700 text-white',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-5 py-2.5 text-sm min-h-[44px]',
  lg: 'px-7 py-3.5 text-base min-h-[48px]',
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
        font-semibold rounded-lg
        transition-colors duration-150 ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}
