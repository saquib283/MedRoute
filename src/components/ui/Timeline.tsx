'use client';

import React from 'react';

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  status: 'completed' | 'active' | 'upcoming' | 'cancelled';
  icon?: React.ReactNode;
  meta?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function Timeline({ events, className = '' }: TimelineProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Vertical line */}
      <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-surface-200" />

      <div className="space-y-0">
        {events.map((event, idx) => (
          <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Dot / Icon */}
            <div className="relative z-10 shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                event.status === 'completed'
                  ? 'bg-success-50 border-success-500 text-success-600'
                  : event.status === 'active'
                  ? 'bg-primary-50 border-primary-500 text-primary-600 ring-4 ring-primary-100'
                  : event.status === 'cancelled'
                  ? 'bg-danger-50 border-danger-300 text-danger-500'
                  : 'bg-surface-50 border-surface-300 text-surface-400'
              }`}>
                {event.icon || (
                  event.status === 'completed' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : event.status === 'active' ? (
                    <div className="w-3 h-3 rounded-full bg-primary-500 animate-pulse" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-surface-300" />
                  )
                )}
              </div>
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 pt-1.5 ${event.status === 'upcoming' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <h4 className={`text-sm font-bold ${
                  event.status === 'active' ? 'text-primary-700' : 'text-surface-900'
                }`}>
                  {event.title}
                </h4>
                <time className="text-[11px] text-surface-400 font-medium whitespace-nowrap shrink-0">
                  {event.date}
                </time>
              </div>
              {event.description && (
                <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{event.description}</p>
              )}
              {event.meta && (
                <span className="inline-block mt-1.5 text-[10px] font-bold text-surface-400 bg-surface-100 px-2 py-0.5 rounded">
                  {event.meta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
