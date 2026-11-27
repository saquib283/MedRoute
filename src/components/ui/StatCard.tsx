'use client';

import React from 'react';
import { ArrowUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantStyles = {
  default: 'bg-white border-surface-200',
  primary: 'bg-white border-surface-200',
  success: 'bg-white border-surface-200',
  warning: 'bg-white border-surface-200',
  danger: 'bg-white border-surface-200',
};

const iconStyles = {
  default: 'bg-surface-100 text-surface-600',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
};

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', className = '' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 shadow-xs ${variantStyles[variant]} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">{title}</p>
          <p className="text-2xl font-bold text-surface-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-500">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${
              trend.value >= 0 ? 'text-success-700' : 'text-danger-700'
            }`}>
              <ArrowUp className={`w-3.5 h-3.5 ${trend.value < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconStyles[variant]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
