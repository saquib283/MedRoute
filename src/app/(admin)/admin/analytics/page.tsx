'use client';

/**
 * Afzal Healthcare — Admin Advanced Analytics
 * Rich data visualization with CSS-based charts, trend analysis,
 * nationality distribution, hospital & doctor leaderboards, case lifecycle,
 * and financial / commission override intelligence.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';

interface AnalyticsData {
  platformTotals: {
    totalUsers: number;
    totalPatients: number;
    totalHospitals: number;
    totalDoctors: number;
    totalAppointments: number;
    totalCases: number;
    totalCampaigns: number;
    totalTemplates: number;
  };
  nationalityDistribution: { nationality: string; count: number }[];
  monthlyRegistrations: { month: string; patients: number; managers: number; doctors: number; admins: number; total: number }[];
  appointmentTypeBreakdown: { type: string; count: number }[];
  hospitalUtilization: {
    id: string;
    name: string;
    city: string;
    appointments: number;
    doctors: number;
    commissionRate: number;
    effectiveCommissionRate: number;
    hasActiveOverride: boolean;
  }[];
  doctorLeaderboard: { id: string; name: string; specialisation: string; hospital: string; appointments: number }[];
  caseLifecycle: { totalCases: number; closedCases: number; completionRate: number; avgDurationDays: number };
  revenueEstimates: {
    completedAppointments: number;
    avgCommissionRate: number;
    activeCommissionOverrides: number;
    medicalBilling: {
      totalInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
      estimatedHospitalCommission: number;
    };
    accommodations: {
      activeBookings: number;
      grossRevenueUsd: number;
      partnerCommissionUsd: number;
    };
  };
}

const APPT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PRE_OP_ASSESSMENT: 'Pre-op Assessment',
  SURGERY: 'Surgery',
  POST_OP_REVIEW: 'Post-op Review',
};

const APPT_TYPE_COLORS: Record<string, string> = {
  CONSULTATION: '#0d9488',
  PRE_OP_ASSESSMENT: '#f59e0b',
  SURGERY: '#ef4444',
  POST_OP_REVIEW: '#8b5cf6',
};

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/v1/admin/analytics');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else if (res.status === 403) {
          setAccessDenied(true);
        }
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <div className="w-12 h-12 rounded-md bg-danger-50 text-danger-600 border border-danger-200 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-surface-900">Access denied</h2>
        <p className="text-sm text-surface-500 mt-1.5">Only administrators can access advanced analytics.</p>
      </div>
    );
  }

  if (!data) return null;

  const p = data.platformTotals;
  const rev = data.revenueEstimates;
  const maxMonthly = Math.max(...data.monthlyRegistrations.map((m) => m.total), 1);
  const maxNationality = data.nationalityDistribution[0]?.count || 1;
  const totalApptTypes = data.appointmentTypeBreakdown.reduce((s, a) => s + a.count, 0) || 1;
  const maxHospAppt = data.hospitalUtilization[0]?.appointments || 1;
  const maxDocAppt = data.doctorLeaderboard[0]?.appointments || 1;
  const collectionPct =
    rev.medicalBilling.totalInvoiced > 0
      ? Math.min(100, Math.round((rev.medicalBilling.totalCollected / rev.medicalBilling.totalInvoiced) * 100))
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Advanced Analytics</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Platform insights, trends, financial settlement, and operational intelligence.</p>
        </div>
      </div>

      {/* Platform Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total users', value: p.totalUsers, icon: UsersIcon },
          { label: 'Patients', value: p.totalPatients, icon: PatientIcon },
          { label: 'Hospitals', value: p.totalHospitals, icon: HospitalIcon },
          { label: 'Doctors', value: p.totalDoctors, icon: DoctorIcon },
          { label: 'Appointments', value: p.totalAppointments, icon: CalendarIcon },
          { label: 'Cases', value: p.totalCases, icon: CasesIcon },
          { label: 'Campaigns', value: p.totalCampaigns, icon: CampaignIcon },
          { label: 'Templates', value: p.totalTemplates, icon: TemplateIcon },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-surface-500">{kpi.label}</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900">{kpi.value}</p>
                </div>
                <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Financial & Commission Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-surface-900">Financial &amp; commission intelligence</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Non-cancelled MedicalBill settlement totals &amp; date-bound hospital commission estimates
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-warning-50 text-warning-800 border border-warning-200">
              {rev.activeCommissionOverrides} Active Override{rev.activeCommissionOverrides === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3.5 rounded-md bg-surface-100 border border-surface-200">
              <p className="text-xs font-medium text-surface-500">Total invoiced</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-surface-900 mt-1">
                {formatUsd(rev.medicalBilling.totalInvoiced)}
              </p>
            </div>
            <div className="p-3.5 rounded-md bg-success-50 border border-success-200">
              <p className="text-xs font-medium text-success-700">Collected</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-success-800 mt-1">
                {formatUsd(rev.medicalBilling.totalCollected)}
              </p>
            </div>
            <div className="p-3.5 rounded-md bg-warning-50 border border-warning-200">
              <p className="text-xs font-medium text-warning-700">Outstanding</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-warning-800 mt-1">
                {formatUsd(rev.medicalBilling.totalOutstanding)}
              </p>
            </div>
            <div className="p-3.5 rounded-md bg-primary-50 border border-primary-200">
              <p className="text-xs font-medium text-primary-700">Hospital commission</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-primary-800 mt-1">
                {formatUsd(rev.medicalBilling.estimatedHospitalCommission)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-surface-600">Medical billing collection rate</span>
              <span className="font-semibold tabular-nums text-surface-900">{collectionPct}%</span>
            </div>
            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-600 transition-all duration-500"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Partner hotel revenue</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Confirmed, checked-in, and completed accommodations
            </p>
          </div>

          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-100 border border-surface-200">
              <span className="text-xs font-medium text-surface-600">Active bookings</span>
              <span className="text-lg font-semibold tracking-tight tabular-nums text-surface-900">{rev.accommodations.activeBookings}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-100 border border-surface-200">
              <span className="text-xs font-medium text-surface-600">Gross volume</span>
              <span className="text-lg font-semibold tracking-tight tabular-nums text-surface-900">
                {formatUsd(rev.accommodations.grossRevenueUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-primary-50 border border-primary-200">
              <span className="text-xs font-medium text-primary-700">Partner commission</span>
              <span className="text-lg font-semibold tracking-tight tabular-nums text-primary-800">
                {formatUsd(rev.accommodations.partnerCommissionUsd)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 1: Monthly Registrations + Appointment Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Registrations */}
        <Card padding="lg" className="lg:col-span-2">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900 mb-0.5">Monthly user registrations</h2>
          <p className="text-xs text-surface-500 mb-5">Last 12 months</p>
          <div className="flex items-end gap-1.5 h-40">
            {data.monthlyRegistrations.map((m) => {
              const pct = Math.max((m.total / maxMonthly) * 100, 4);
              const label = m.month.split('-')[1];
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" title={`${m.month}: ${m.total} registrations (${m.patients}P / ${m.managers}M / ${m.doctors}D)`}>
                  <span className="text-xs font-medium tabular-nums text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">{m.total}</span>
                  <div
                    className="w-full rounded-t-sm bg-primary-600 hover:bg-primary-700 transition-colors cursor-pointer"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs font-medium tabular-nums text-surface-500">{label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Appointment Type Breakdown */}
        <Card padding="lg">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900 mb-5">Appointment types</h2>
          <div className="space-y-4">
            {data.appointmentTypeBreakdown.map((a) => {
              const pct = Math.round((a.count / totalApptTypes) * 100);
              return (
                <div key={a.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-surface-700">{APPT_TYPE_LABELS[a.type] || a.type}</span>
                    <span className="text-surface-500 tabular-nums">{a.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: APPT_TYPE_COLORS[a.type] || '#94a3b8' }}
                    />
                  </div>
                </div>
              );
            })}
            {data.appointmentTypeBreakdown.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-4">No appointment data yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Nationality + Case Lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nationality Distribution */}
        <Card padding="lg">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900 mb-0.5">Patient nationality distribution</h2>
          <p className="text-xs text-surface-500 mb-5">Top 15 countries of origin</p>
          <div className="space-y-2.5">
            {data.nationalityDistribution.map((n, i) => {
              const pct = Math.round((n.count / maxNationality) * 100);
              return (
                <div key={n.nationality} className="flex items-center gap-3">
                  <span className="text-xs font-medium tabular-nums text-surface-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-surface-700">{n.nationality}</span>
                      <span className="text-surface-600 font-medium tabular-nums">{n.count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {data.nationalityDistribution.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-4">No patient nationality data yet.</p>
            )}
          </div>
        </Card>

        {/* Case Lifecycle Metrics */}
        <Card padding="lg">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900 mb-5">Case lifecycle metrics</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-4 bg-surface-100 rounded-md border border-surface-200">
              <p className="text-xs font-medium text-surface-500">Total cases</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">{data.caseLifecycle.totalCases}</p>
            </div>
            <div className="p-4 bg-surface-100 rounded-md border border-surface-200">
              <p className="text-xs font-medium text-surface-500">Closed cases</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">{data.caseLifecycle.closedCases}</p>
            </div>
            <div className="p-4 bg-surface-100 rounded-md border border-surface-200">
              <p className="text-xs font-medium text-surface-500">Completion rate</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">{data.caseLifecycle.completionRate}%</p>
            </div>
            <div className="p-4 bg-surface-100 rounded-md border border-surface-200">
              <p className="text-xs font-medium text-surface-500">Average duration</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">{data.caseLifecycle.avgDurationDays}d</p>
            </div>
          </div>

          {/* Revenue Estimates */}
          <div className="border-t border-surface-200 pt-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Revenue indicators</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-100 border border-surface-200 rounded-md">
                <p className="text-xs text-surface-500 font-medium">Completed appointments</p>
                <p className="text-lg font-semibold tabular-nums text-surface-900 mt-0.5">{rev.completedAppointments}</p>
              </div>
              <div className="p-3 bg-surface-100 border border-surface-200 rounded-md">
                <p className="text-xs text-surface-500 font-medium">Average base commission</p>
                <p className="text-lg font-semibold tabular-nums text-surface-900 mt-0.5">{rev.avgCommissionRate}%</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Hospital Utilization + Doctor Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospital Utilization */}
        <Card className="p-0! overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200">
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Hospital utilization</h2>
            <p className="text-xs text-surface-500 mt-0.5">Top 10 by appointment volume</p>
          </div>
          <div className="divide-y divide-surface-200">
            {data.hospitalUtilization.map((h, i) => {
              const pct = Math.round((h.appointments / maxHospAppt) * 100);
              const displayRate = h.effectiveCommissionRate ?? h.commissionRate;
              return (
                <div key={h.id} className="px-5 py-3.5 hover:bg-surface-100/60 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-surface-100 border border-surface-200 text-surface-600 flex items-center justify-center text-xs font-medium tabular-nums">{i + 1}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-surface-900">{h.name}</p>
                          {h.hasActiveOverride && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning-50 text-warning-800 border border-warning-200">
                              Override active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-surface-500">
                          {h.city} • {h.doctors} doctors • {displayRate}% comm.
                          {h.hasActiveOverride ? ` (base ${h.commissionRate}%)` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-surface-900">{h.appointments}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden ml-8">
                    <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.hospitalUtilization.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-surface-500">No hospital data yet.</div>
            )}
          </div>
        </Card>

        {/* Doctor Leaderboard */}
        <Card className="p-0! overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200">
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Doctor consultation leaderboard</h2>
            <p className="text-xs text-surface-500 mt-0.5">Top 10 by total appointments</p>
          </div>
          <div className="divide-y divide-surface-200">
            {data.doctorLeaderboard.map((d, i) => {
              const pct = Math.round((d.appointments / maxDocAppt) * 100);
              return (
                <div key={d.id} className="px-5 py-3.5 hover:bg-surface-100/60 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-surface-100 border border-surface-200 text-surface-600 flex items-center justify-center text-xs font-medium tabular-nums">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-surface-900">{d.name}</p>
                        <p className="text-xs text-surface-500">{d.specialisation} • {d.hospital}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-surface-900">{d.appointments}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden ml-8">
                    <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.doctorLeaderboard.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-surface-500">No doctor data yet.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Local SVG Icons ──────────────────────────────────────────────────
function UsersIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function PatientIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function HospitalIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function DoctorIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
}
function CalendarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function CasesIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
}
function CampaignIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}
function TemplateIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
}
