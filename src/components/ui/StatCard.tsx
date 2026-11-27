'use client';

import React from 'react';

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
  primary: 'bg-gradient-to-br from-primary-50 to-primary-100/50 border-primary-200',
  success: 'bg-gradient-to-br from-success-50 to-success-100/50 border-success-200',
  warning: 'bg-gradient-to-br from-warning-50 to-warning-100/50 border-warning-200',
  danger: 'bg-gradient-to-br from-danger-50 to-danger-100/50 border-danger-200',
};

const iconStyles = {
  default: 'bg-surface-100 text-surface-600',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
};

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', className = '' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${variantStyles[variant]} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500">{title}</p>
          <p className="text-2xl font-extrabold text-surface-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-500">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-bold ${
              trend.value >= 0 ? 'text-success-600' : 'text-danger-600'
            }`}>
              <svg className={`w-3 h-3 ${trend.value < 0 ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[variant]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
