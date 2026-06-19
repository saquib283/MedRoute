/**
 * MediRoute India — Badge Component
 * Status indicator badges with semantic colors.
 */

import React from 'react';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-700 text-surface-300 border-surface-600',
  primary: 'bg-primary-900/50 text-primary-300 border-primary-700/50',
  success: 'bg-success-700/20 text-success-500 border-success-700/30',
  warning: 'bg-warning-600/20 text-warning-500 border-warning-600/30',
  danger: 'bg-danger-700/20 text-danger-500 border-danger-700/30',
  info: 'bg-info-600/20 text-info-500 border-info-600/30',
  accent: 'bg-accent-700/20 text-accent-400 border-accent-700/30',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-surface-400',
  primary: 'bg-primary-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  accent: 'bg-accent-400',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-full border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} animate-pulse-soft`}
        />
      )}
      {children}
    </span>
  );
}

// ─── Preset badges for common statuses ──────────────────────────

export function CaseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    INQUIRY_RECEIVED: { variant: 'info', label: 'Inquiry Received' },
    UNDER_REVIEW: { variant: 'warning', label: 'Under Review' },
    PLAN_CONFIRMED: { variant: 'primary', label: 'Plan Confirmed' },
    IN_TREATMENT: { variant: 'accent', label: 'In Treatment' },
    POST_TREATMENT: { variant: 'success', label: 'Post-Treatment' },
    CLOSED: { variant: 'default', label: 'Closed' },
  };

  const { variant, label } = config[status] || {
    variant: 'default' as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

export function UrgencyBadge({ level }: { level: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    ROUTINE: { variant: 'default', label: 'Routine' },
    SEMI_URGENT: { variant: 'warning', label: 'Semi-Urgent' },
    URGENT: { variant: 'danger', label: 'Urgent' },
  };

  const { variant, label } = config[level] || {
    variant: 'default' as BadgeVariant,
    label: level,
  };

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
