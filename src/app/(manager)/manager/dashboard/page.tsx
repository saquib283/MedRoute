'use client';

/**
 * Afzal Healthcare — Manager Dashboard Overview
 * Clinical light-mode layout showing critical queue statistics.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

interface DashboardMetrics {
  totalPatients: number;
  activeCases: number;
  upcomingAppointments: number;
  openLeads?: number;
  slaBreachedLeads?: number;
}

export default function ManagerDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/v1/manager/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMetrics(data.metrics);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const timer = setTimeout(() => {
      void fetchMetrics();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-surface-500">Loading operational counts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Operations Overview</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Real-time status of your assigned medical travelers and treatment pipelines.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Assigned Cohort</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics?.totalPatients ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Active Cases</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics?.activeCases ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Upcoming Appointments</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics?.upcomingAppointments ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-surface-500">Active Leads</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
                {metrics?.openLeads ?? 0}
              </p>
            </div>
            <div className="w-9 h-9 rounded-md bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <Link
            href="/manager/leads"
            className="inline-flex items-center min-h-11 mt-2 text-xs font-medium text-primary-700 hover:text-primary-800 transition-colors"
          >
            Open Leads CRM →
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-surface-500">SLA Attention</p>
              <p
                className={`text-2xl font-semibold tracking-tight tabular-nums mt-1.5 ${
                  (metrics?.slaBreachedLeads ?? 0) > 0 ? 'text-danger-700' : 'text-surface-900'
                }`}
              >
                {metrics?.slaBreachedLeads ?? 0}
              </p>
            </div>
            <div
              className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${
                (metrics?.slaBreachedLeads ?? 0) > 0
                  ? 'bg-danger-50 text-danger-700 border-danger-200'
                  : 'bg-surface-100 text-surface-600 border-surface-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <Link
            href="/manager/leads"
            className="inline-flex items-center min-h-11 mt-2 text-xs font-medium text-primary-700 hover:text-primary-800 transition-colors"
          >
            {(metrics?.slaBreachedLeads ?? 0) > 0 ? 'Respond to overdue leads →' : 'View lead SLA queue →'}
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Actions Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Coordinator Quick Actions</h2>
            <p className="text-xs text-surface-500 mt-1 leading-relaxed">
              Accelerate treatment logistics by directly booking clinical encounters and sending messages.
            </p>
          </div>
          <div className="space-y-2.5 mt-5">
            <Link
              href="/manager/leads"
              className="w-full min-h-[44px] px-3.5 py-2 inline-flex items-center justify-start gap-2.5 text-xs font-medium rounded-md bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 hover:border-surface-400 shadow-2xs transition-colors"
            >
              <svg className="w-4 h-4 text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Open Leads CRM Pipeline
            </Link>
            <Link
              href="/manager/appointments"
              className="w-full min-h-[44px] px-3.5 py-2 inline-flex items-center justify-start gap-2.5 text-xs font-medium rounded-md bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 hover:border-surface-400 shadow-2xs transition-colors"
            >
              <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Schedule Clinic Appointment
            </Link>
            <Link
              href="/manager/chat"
              className="w-full min-h-[44px] px-3.5 py-2 inline-flex items-center justify-start gap-2.5 text-xs font-medium rounded-md bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 hover:border-surface-400 shadow-2xs transition-colors"
            >
              <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Open Communication Chat
            </Link>
          </div>
        </Card>

        {/* Operational Overview description */}
        <Card className="lg:col-span-2 p-5">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900 mb-3">Workspace Guidelines</h2>
          <div className="space-y-3 text-xs sm:text-sm text-surface-600 leading-relaxed">
            <p>
              As an <span className="font-semibold text-surface-800">Afzal Healthcare Case Manager</span>, you oversee the clinical and travel logistics of international patient care journeys in India.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-surface-600">
              <li>Review incoming medical records and update the patient&apos;s case pipeline status.</li>
              <li>Schedule JCI-accredited hospital consultations, assessments, and surgeries.</li>
              <li>Use the secure coordination chat to maintain continuous messaging with patients.</li>
            </ul>
            <div className="p-3 bg-surface-50 rounded-md border border-surface-200 flex items-start gap-2.5 mt-4">
              <svg className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-surface-600">
                To maintain patient record accuracy, ensure patient medical history profiles are updated regularly with clinical consultation reports.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
