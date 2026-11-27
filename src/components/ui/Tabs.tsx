'use client';

import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', className = '' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-100 hover:text-surface-900'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`border-b border-surface-200 ${className}`}>
      <nav className="flex gap-0 -mb-px overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-800 hover:border-surface-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-danger-500 text-white text-[11px] font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
  return <div className={`animate-fade-in ${className}`}>{children}</div>;
}
