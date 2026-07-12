'use client';

/**
 * MediRoute India — Doctor Dashboard
 * Provides an overview of today's schedule and pending tasks for the doctor.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

interface DashboardMetrics {
  todayAppointments: number;
  pendingAssessments: number;
  upcomingSurgeries: number;
}

export default function DoctorDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/v1/doctor/dashboard', { headers });
        const data = await res.json();
        
        if (data.success && data.data?.metrics) {
          setMetrics(data.data.metrics);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Clinical Overview</h1>
        <p className="text-sm text-surface-500 mt-1">Review your schedule and operational metrics for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric Cards */}
        <Card className="p-6 bg-white border border-surface-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-500">Today's Appointments</p>
              <p className="text-3xl font-bold text-surface-900 mt-1">{metrics?.todayAppointments || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-surface-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-500">Pending Assessments</p>
              <p className="text-3xl font-bold text-surface-900 mt-1">{metrics?.pendingAssessments || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-surface-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-500">Upcoming Surgeries</p>
              <p className="text-3xl font-bold text-surface-900 mt-1">{metrics?.upcomingSurgeries || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white border border-surface-200">
          <h2 className="text-sm font-bold text-surface-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/doctor/appointments" className="block w-full text-left px-4 py-3 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-lg text-sm font-semibold text-surface-700 transition-colors">
              View Schedule & Update Notes
            </Link>
            <Link href="/doctor/patients" className="block w-full text-left px-4 py-3 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-lg text-sm font-semibold text-surface-700 transition-colors">
              Browse Patient Directory
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
