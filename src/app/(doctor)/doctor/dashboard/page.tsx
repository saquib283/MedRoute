'use client';

/**
 * Afzal Healthcare — Doctor Portal Dashboard
 * Displays specialist clinical header, 4 clinical KPIs, upcoming encounters,
 * and active cases requiring physician review or Fit-to-Fly sign-off.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, CaseStatusBadge } from '@/components/ui/Badge';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import {
  Calendar,
  ClipboardCheck,
  Activity,
  BriefcaseMedical,
  Building2,
  Stethoscope,
  ArrowRight,
  Plane,
  AlertTriangle,
} from 'lucide-react';

interface DoctorProfile {
  id: string;
  fullName: string;
  qualification: string | null;
  hospital?: { name: string; city: string } | null;
  specialisation?: { name: string } | null;
}

interface DashboardMetrics {
  todayAppointments: number;
  pendingAssessments: number;
  upcomingSurgeries: number;
  activeCases: number;
}

interface UpcomingAppointment {
  id: string;
  caseId: string;
  appointmentType: string;
  scheduledAt: string;
  status: string;
  patient: {
    user: { fullName: string };
    nationality: string;
  };
  case?: {
    id: string;
    status: string;
    isUrgent: boolean;
  } | null;
}

interface PendingClinicalCase {
  id: string;
  status: string;
  isUrgent: boolean;
  patient: {
    nationality: string;
    user: { fullName: string };
  };
  clinicalSteps: Array<{
    id: string;
    title: string;
    status: string;
    requiredRole: string | null;
  }>;
  fitToFlyClearance?: {
    isCleared: boolean;
  } | null;
}

export default function DoctorDashboardPage() {
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [upcomingSchedule, setUpcomingSchedule] = useState<UpcomingAppointment[]>([]);
  const [pendingCases, setPendingCases] = useState<PendingClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isCancelled?: () => boolean) => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/v1/doctor/dashboard');
      const json = await res.json();
      if (isCancelled?.()) return;

      if (!res.ok || !json.success) {
        setErrorMsg(json?.error?.message || 'Failed to load doctor dashboard');
        return;
      }

      setDoctorProfile(json.data?.doctorProfile ?? null);
      setMetrics(json.data?.metrics ?? null);
      setUpcomingSchedule(json.data?.upcomingSchedule ?? []);
      setPendingCases(json.data?.pendingClinicalCases ?? []);
    } catch (err) {
      console.error('Failed to load doctor dashboard:', err);
      if (!isCancelled?.()) {
        setErrorMsg('Network error loading dashboard data');
      }
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadDashboard(() => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading clinical overview...</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <Card className="p-5 border-danger-200 bg-danger-50/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-medium text-danger-800">{errorMsg}</p>
          <Button size="sm" variant="secondary" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Flat Institutional Specialist Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-surface-200">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
            Welcome, {formatDoctorDisplayName(doctorProfile?.fullName || '')}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500">
            {doctorProfile?.specialisation?.name && (
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-surface-400" />
                {doctorProfile.specialisation.name}
              </span>
            )}
            {doctorProfile?.hospital?.name && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-surface-400" />
                {doctorProfile.hospital.name}
                {doctorProfile.hospital.city ? `, ${doctorProfile.hospital.city}` : ''}
              </span>
            )}
            {doctorProfile?.qualification && (
              <span className="text-surface-500">{doctorProfile.qualification}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link href="/doctor/appointments">
            <Button variant="secondary" size="sm">
              <Calendar className="w-4 h-4" />
              View Schedule
            </Button>
          </Link>
          <Link href="/doctor/patients">
            <Button size="sm">
              My Patients
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">
              Today&apos;s encounters
            </p>
            <p className="text-2xl font-semibold text-surface-900 tabular-nums mt-1.5">
              {metrics?.todayAppointments ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">
              Pending assessments
            </p>
            <p className="text-2xl font-semibold text-surface-900 tabular-nums mt-1.5">
              {metrics?.pendingAssessments ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">
              Upcoming surgeries
            </p>
            <p className="text-2xl font-semibold text-surface-900 tabular-nums mt-1.5">
              {metrics?.upcomingSurgeries ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">
              Active clinical cases
            </p>
            <p className="text-2xl font-semibold text-surface-900 tabular-nums mt-1.5">
              {metrics?.activeCases ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 shrink-0">
            <BriefcaseMedical className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Two-Column Clinical Queues */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Today / Upcoming Schedule */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-200">
            <div>
              <h2 className="text-base font-semibold text-surface-900">Today &amp; upcoming schedule</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Next clinical encounters assigned to you
              </p>
            </div>
            <Link
              href="/doctor/appointments"
              className="min-h-9 text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              All appointments <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {upcomingSchedule.length === 0 ? (
            <div className="py-10 text-center rounded-md bg-surface-50 border border-dashed border-surface-200 text-sm text-surface-500">
              No upcoming appointments scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedule.map((appt) => {
                const targetCaseId = appt.case?.id || appt.caseId;
                return (
                  <div
                    key={appt.id}
                    className="p-3.5 rounded-lg border border-surface-200 bg-surface-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-surface-900">
                          {appt.patient.user.fullName}
                        </span>
                        <span className="text-xs text-surface-500">
                          ({appt.patient.nationality})
                        </span>
                        {appt.case?.isUrgent && (
                          <Badge variant="danger" size="sm">
                            <AlertTriangle className="w-3 h-3" /> Urgent
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-surface-600">
                        <span className="font-medium text-primary-700">
                          {APPOINTMENT_TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                        </span>
                        <span>•</span>
                        <span className="tabular-nums">{new Date(appt.scheduledAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>{APPOINTMENT_STATUS_LABELS[appt.status] || appt.status}</span>
                      </div>
                    </div>

                    {targetCaseId && (
                      <Link href={`/doctor/cases/${targetCaseId}`} className="shrink-0">
                        <Button size="sm" variant="secondary">
                          Open Case
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Active Cases Requiring Physician Review */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-200">
            <div>
              <h2 className="text-base font-semibold text-surface-900">
                Cases requiring physician review
              </h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Sign pathway milestones, issue medical opinions, or certify Fit-to-Fly
              </p>
            </div>
            <Link
              href="/doctor/patients"
              className="min-h-9 text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              Patient roster <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingCases.length === 0 ? (
            <div className="py-10 text-center rounded-md bg-surface-50 border border-dashed border-surface-200 text-sm text-surface-500">
              No active clinical cases currently assigned.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCases.map((c) => {
                const doctorPendingSteps = c.clinicalSteps.filter(
                  (s) => !s.requiredRole || s.requiredRole === 'DOCTOR'
                );
                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-lg border border-surface-200 bg-surface-50/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-surface-900">
                            {c.patient.user.fullName}
                          </span>
                          <span className="text-xs text-surface-500">
                            ({c.patient.nationality})
                          </span>
                          {c.isUrgent && (
                            <Badge variant="danger" size="sm">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <CaseStatusBadge status={c.status} />
                          {c.fitToFlyClearance?.isCleared ? (
                            <Badge variant="success" size="sm">
                              <Plane className="w-3 h-3" /> Fit-to-Fly Cleared
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              <Plane className="w-3 h-3" /> Fit-to-Fly Pending
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Link href={`/doctor/cases/${c.id}`}>
                        <Button size="sm">
                          Open Case
                        </Button>
                      </Link>
                    </div>

                    {doctorPendingSteps.length > 0 && (
                      <div className="pt-2.5 border-t border-surface-200/80">
                        <p className="text-xs font-medium text-surface-500 mb-1.5">
                          Pending physician milestones ({doctorPendingSteps.length})
                        </p>
                        <ul className="space-y-1">
                          {doctorPendingSteps.slice(0, 3).map((step) => (
                            <li
                              key={step.id}
                              className="text-xs text-surface-700 flex items-center justify-between gap-2"
                            >
                              <span className="truncate">• {step.title}</span>
                              <span className="text-xs font-medium text-warning-700 shrink-0">
                                {step.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
