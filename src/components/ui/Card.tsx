/**
 * MediRoute India — Card Component
 * Clinical design system card — white background, subtle border, clean elevation.
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingStyles: Record<string, string> = {
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
        bg-white border border-surface-300 rounded-lg shadow-xs
        ${paddingStyles[padding]}
        ${hover
          ? 'transition-shadow duration-200 hover:shadow-md hover:border-surface-400'
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
