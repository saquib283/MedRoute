/**
 * MediRoute India — Badge Component
 * Status indicator badges with semantic colors — clinical light-mode.
 */

import React from 'react';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-200 text-surface-700 border-surface-300',
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-info-50 text-info-700 border-info-200',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-surface-500',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
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
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}
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
    IN_TREATMENT: { variant: 'warning', label: 'In Treatment' },
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
