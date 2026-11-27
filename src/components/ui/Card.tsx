/**
 * MediRoute India — Card Component
 * Clinical design system card — white background, subtle border, clean elevation.
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={`
        bg-white border border-surface-200 rounded-xl shadow-xs
        ${paddingStyles[padding]}
        ${hover
          ? 'transition-colors transition-shadow duration-150 hover:shadow-sm hover:border-surface-300'
          : ''
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Card Header sub-component
 */
export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-surface-600 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
