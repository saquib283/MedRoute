'use client';

/**
 * MediRoute India — Manager Dashboard Overview
 * Clinical light-mode layout showing critical queue statistics.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  Building2,
  Calendar,
  Plus,
  Home,
  MessageSquare,
  Info,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

interface DashboardMetrics {
  totalPatients: number;
  activeCases: number;
  pendingAccommodations: number;
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Operations Overview"
        subtitle="Status of your assigned patients, active cases, and upcoming schedule"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Cohort"
          value={metrics?.totalPatients ?? 0}
          variant="primary"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Active Cases"
          value={metrics?.activeCases ?? 0}
          variant="default"
          icon={<Briefcase className="w-5 h-5" />}
        />
        <StatCard
          title="Pending Stay Bookings"
          value={metrics?.pendingAccommodations ?? 0}
          variant="warning"
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Upcoming Appointments"
          value={metrics?.upcomingAppointments ?? 0}
          variant="primary"
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Actions Card */}
        <Card className="flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-surface-900">Quick Actions</h2>
            <p className="text-sm text-surface-500">Schedule appointments, coordinate recovery stays, or message patients.</p>
          </div>
          <div className="space-y-2.5 mt-5">
            <Link href="/manager/appointments" className="block">
              <Button className="w-full justify-start gap-2.5" variant="secondary">
                <Plus className="w-4 h-4 text-primary-700" />
                Schedule Appointment
              </Button>
            </Link>
            <Link href="/manager/accommodations" className="block">
              <Button className="w-full justify-start gap-2.5" variant="secondary">
                <Home className="w-4 h-4 text-primary-700" />
                Book Accommodation
              </Button>
            </Link>
            <Link href="/manager/chat" className="block">
              <Button className="w-full justify-start gap-2.5" variant="secondary">
                <MessageSquare className="w-4 h-4 text-primary-700" />
                Open Messages
              </Button>
            </Link>
          </div>
        </Card>

        {/* Operational Overview description */}
        <Card className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-surface-900">Coordinator Workflow</h2>
          <div className="space-y-3 text-sm text-surface-600">
            <p>
              Oversee case progression from intake through post-treatment follow-up for assigned international patients.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-600">
              <li>Review uploaded clinical reports and update case pipeline statuses.</li>
              <li>Coordinate consultations, diagnostics, and procedures with partner hospitals.</li>
              <li>Arrange hospital-adjacent recovery accommodations and local transfers.</li>
              <li>Track patient questions and treatment plan approvals in messages.</li>
            </ul>
            <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
              <p className="text-xs text-surface-600">
                Keep medical history profiles and case notes current after each specialist consultation.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
