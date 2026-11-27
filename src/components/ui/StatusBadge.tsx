'use client';

import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusVariantMap: Record<string, BadgeVariant> = {
  // Case statuses
  INQUIRY_RECEIVED: 'info',
  UNDER_REVIEW: 'warning',
  PLAN_CONFIRMED: 'primary',
  IN_TREATMENT: 'warning',
  POST_TREATMENT: 'success',
  CLOSED: 'default',
  // Treatment plan statuses
  DRAFT: 'default',
  SENT_TO_PATIENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  REVISED: 'warning',
  // Invoice statuses
  SENT: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
  REFUNDED: 'info',
  // Appointment statuses
  SCHEDULED: 'info',
  CONFIRMED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  RESCHEDULED: 'warning',
  // Transfer/follow-up statuses
  MISSED: 'danger',
  // Visa statuses
  REQUESTED: 'warning',
  GENERATED: 'info',
  EXPIRED: 'danger',
  // Accommodation
  PENDING: 'warning',
  CHECKED_IN: 'primary',
  CHECKED_OUT: 'success',
  // Generic
  ACTIVE: 'success',
  INACTIVE: 'default',
  NEW: 'info',
  CONTACTED: 'primary',
  CONVERTED: 'success',
  // Discharge
  STABLE: 'success',
  IMPROVED: 'success',
  CRITICAL: 'danger',
  UNCHANGED: 'warning',
};

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 text-surface-600 border-surface-200',
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-info-50 text-info-700 border-info-200',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-400',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
};

function formatLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('To Patient', 'to Patient');
}

export function StatusBadge({ status, label, size = 'sm', className = '' }: StatusBadgeProps) {
  const variant = statusVariantMap[status] || 'default';
  const displayLabel = label || formatLabel(status);
  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${sizeClass} ${variantStyles[variant]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />
      {displayLabel}
    </span>
  );
}
