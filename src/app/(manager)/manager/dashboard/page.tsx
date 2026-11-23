'use client';

/**
 * Afzal Healthcare — Manager Dashboard Overview
 * Clinical light-mode layout showing critical queue statistics.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface DashboardMetrics {
  totalPatients: number;
  activeCases: number;
  upcomingAppointments: number;
}

export default function ManagerDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/v1/manager/dashboard');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading operational counts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Operations Overview</h1>
        <p className="text-sm text-surface-500 mt-1">Real-time status of your assigned medical travelers and treatment pipelines.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card className="p-5 flex items-center justify-between bg-white border border-surface-200 rounded-2xl shadow-xs">
          <div>
            <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Assigned Cohort</p>
            <p className="text-3xl font-bold text-surface-900 mt-2">{metrics?.totalPatients ?? 0}</p>
          </div>
          <div className="p-3 bg-primary-50 rounded-xl text-primary-700 shrink-0 border border-primary-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between bg-white border border-surface-200 rounded-2xl shadow-xs">
          <div>
            <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Active Inquiries</p>
            <p className="text-3xl font-bold text-surface-900 mt-2">{metrics?.activeCases ?? 0}</p>
          </div>
          <div className="p-3 bg-teal-50 rounded-xl text-teal-700 shrink-0 border border-teal-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between bg-white border border-surface-200 rounded-2xl shadow-xs">
          <div>
            <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Upcoming Appointments</p>
            <p className="text-3xl font-bold text-surface-900 mt-2">{metrics?.upcomingAppointments ?? 0}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-700 shrink-0 border border-blue-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Actions Card */}
        <Card className="p-6 bg-white flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-surface-900">Coordinator Quick Actions</h3>
            <p className="text-sm text-surface-500">Accelerate treatment logistics by directly booking clinical encounters and sending messages.</p>
          </div>
          <div className="space-y-3 mt-6">
            <Link href="/manager/appointments" className="block">
              <Button className="w-full justify-start gap-3" variant="secondary">
                <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Schedule Clinic Appointment
              </Button>
            </Link>
            <Link href="/manager/chat" className="block">
              <Button className="w-full justify-start gap-3" variant="secondary">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Open Communication Chat
              </Button>
            </Link>
          </div>
        </Card>

        {/* Operational Overview description */}
        <Card className="lg:col-span-2 p-6 bg-white">
          <h3 className="text-base font-bold text-surface-900 mb-4">Workspace Guidelines</h3>
          <div className="space-y-4 text-sm text-surface-600">
            <p>
              As a <strong>Afzal Healthcare Case Manager</strong>, you are responsible for overseeing the logistics of international patient care journeys in India.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-surface-500">
              <li>Review incoming medical records and update the patient&apos;s case pipeline status.</li>
              <li>Schedule JCI accredited hospital consultations, assessments, and surgeries.</li>
              <li>Use the secure coordination chat to maintain continuous messaging with patients.</li>
            </ul>
            <div className="p-3 bg-surface-50 rounded-md border border-surface-200/50 flex items-start gap-3 mt-4">
              <svg className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-surface-500">
                To maintain patient records accuracy, ensure patient medical history profiles are updated regularly with clinical consultation reports.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
