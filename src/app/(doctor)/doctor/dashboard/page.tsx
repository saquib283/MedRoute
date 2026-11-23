'use client';

/**
 * Afzal Healthcare — Doctor Portal Dashboard
 * Displays specialist greeting banner, 4 clinical KPIs, upcoming encounters,
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
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading clinical overview...</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <Card className="p-6 border-rose-200 bg-rose-50/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
          <Button size="sm" variant="secondary" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Specialist Greeting Banner */}
      <Card className="bg-gradient-to-r from-primary-700 via-primary-600 to-teal-600 text-white border-0 p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-100">
              Attending Specialist Command Center
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome, {formatDoctorDisplayName(doctorProfile?.fullName || '')}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-primary-50">
              {doctorProfile?.specialisation?.name && (
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-primary-200" />
                  {doctorProfile.specialisation.name}
                </span>
              )}
              {doctorProfile?.hospital?.name && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary-200" />
                  {doctorProfile.hospital.name}
                  {doctorProfile.hospital.city ? `, ${doctorProfile.hospital.city}` : ''}
                </span>
              )}
              {doctorProfile?.qualification && (
                <span className="text-primary-100">{doctorProfile.qualification}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link href="/doctor/appointments">
              <Button
                variant="secondary"
                size="sm"
                className="!bg-white !text-primary-700 hover:!bg-primary-50 !border-0"
              >
                <Calendar className="w-4 h-4" />
                View Schedule
              </Button>
            </Link>
            <Link href="/doctor/patients">
              <Button
                variant="ghost"
                size="sm"
                className="!text-white hover:!bg-white/15 border border-white/25"
              >
                My Patients
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Today&apos;s Encounters
            </p>
            <p className="text-3xl font-bold text-surface-900 mt-2">
              {metrics?.todayAppointments ?? 0}
            </p>
          </div>
          <div className="p-3 bg-primary-50 rounded-xl text-primary-700 border border-primary-100">
            <Calendar className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Pending Assessments
            </p>
            <p className="text-3xl font-bold text-surface-900 mt-2">
              {metrics?.pendingAssessments ?? 0}
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700 border border-amber-100">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Upcoming Surgeries
            </p>
            <p className="text-3xl font-bold text-surface-900 mt-2">
              {metrics?.upcomingSurgeries ?? 0}
            </p>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-700 border border-rose-100">
            <Activity className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Active Clinical Cases
            </p>
            <p className="text-3xl font-bold text-surface-900 mt-2">
              {metrics?.activeCases ?? 0}
            </p>
          </div>
          <div className="p-3 bg-teal-50 rounded-xl text-teal-700 border border-teal-100">
            <BriefcaseMedical className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Two-Column Clinical Queues */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Today / Upcoming Schedule */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-100">
            <div>
              <h2 className="text-lg font-bold text-surface-900">Today &amp; Upcoming Schedule</h2>
              <p className="text-xs text-surface-500">
                Next clinical encounters assigned to you
              </p>
            </div>
            <Link
              href="/doctor/appointments"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              All Appointments <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {upcomingSchedule.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-surface-50 border border-dashed border-surface-200 text-sm text-surface-500">
              No upcoming appointments scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedule.map((appt) => {
                const targetCaseId = appt.case?.id || appt.caseId;
                return (
                  <div
                    key={appt.id}
                    className="p-4 rounded-xl border border-surface-200 bg-surface-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-surface-900">
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
                        <span className="font-semibold text-primary-700">
                          {APPOINTMENT_TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                        </span>
                        <span>•</span>
                        <span>{new Date(appt.scheduledAt).toLocaleString()}</span>
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
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-100">
            <div>
              <h2 className="text-lg font-bold text-surface-900">
                Active Cases Requiring Physician Review
              </h2>
              <p className="text-xs text-surface-500">
                Sign pathway milestones, issue medical opinions, or certify Fit-to-Fly
              </p>
            </div>
            <Link
              href="/doctor/patients"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              Patient Roster <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingCases.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-surface-50 border border-dashed border-surface-200 text-sm text-surface-500">
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
                    className="p-4 rounded-xl border border-surface-200 bg-surface-50/40 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-surface-900">
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
                        <div className="flex flex-wrap items-center gap-2">
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
                      <div className="pt-2 border-t border-surface-200/70">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1.5">
                          Pending Physician Milestones ({doctorPendingSteps.length})
                        </p>
                        <ul className="space-y-1">
                          {doctorPendingSteps.slice(0, 3).map((step) => (
                            <li
                              key={step.id}
                              className="text-xs text-surface-700 flex items-center justify-between gap-2"
                            >
                              <span className="truncate">• {step.title}</span>
                              <span className="text-[11px] font-semibold text-amber-700 shrink-0">
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
