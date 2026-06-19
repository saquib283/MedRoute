/**
 * MediRoute India — Card Component
 * Glassmorphic card with hover effects.
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
        glass-card rounded-2xl
        ${paddingStyles[padding]}
        ${
          hover
            ? 'transition-all duration-300 hover:shadow-glow hover:border-primary-800/30 hover:-translate-y-0.5'
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
        <h3 className="text-lg font-semibold text-surface-100">{title}</h3>
        {subtitle && (
          <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
