'use client';

/**
 * MediRoute India — Doctor Dashboard
 * Provides an overview of today's schedule and pending tasks for the doctor.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ClipboardList, HeartPulse, Calendar, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

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
        const res = await fetch('/api/v1/doctor/dashboard');
        const data = await res.json();

        if (data.success && data.data?.metrics) {
          setMetrics(data.data.metrics);
        }
      } catch (err) {
        console.error('Failed to load doctor dashboard metrics:', err);
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clinical Overview"
        subtitle="Today's appointments, assessments, and upcoming procedures"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Today's Appointments"
          value={metrics?.todayAppointments || 0}
          variant="primary"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Pending Assessments"
          value={metrics?.pendingAssessments || 0}
          variant="warning"
          icon={<ClipboardList className="w-5 h-5" />}
        />
        <StatCard
          title="Upcoming Surgeries"
          value={metrics?.upcomingSurgeries || 0}
          variant="success"
          icon={<HeartPulse className="w-5 h-5" />}
        />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-surface-900 mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/doctor/appointments"
            className="flex items-center gap-3 px-4 py-3 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-lg text-sm font-medium text-surface-800 transition-colors"
          >
            <Calendar className="w-4 h-4 text-primary-700 shrink-0" />
            <span>View Schedule &amp; Update Notes</span>
          </Link>
          <Link
            href="/doctor/patients"
            className="flex items-center gap-3 px-4 py-3 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-lg text-sm font-medium text-surface-800 transition-colors"
          >
            <Users className="w-4 h-4 text-primary-700 shrink-0" />
            <span>Open Patient Directory</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
