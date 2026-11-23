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
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-surface-900">Access Denied</h2>
        <p className="text-sm text-surface-500 mt-2">Only Administrators can access advanced analytics.</p>
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
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Advanced Analytics</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200">Admin</span>
        </div>
        <p className="text-sm text-surface-500">Deep platform insights, trends, financial settlement, and operational intelligence.</p>
      </div>

      {/* Platform Totals - Compact Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Users', value: p.totalUsers, icon: UsersIcon, color: 'bg-primary-50 text-primary-700' },
          { label: 'Patients', value: p.totalPatients, icon: PatientIcon, color: 'bg-info-50 text-info-700' },
          { label: 'Hospitals', value: p.totalHospitals, icon: HospitalIcon, color: 'bg-success-50 text-success-700' },
          { label: 'Doctors', value: p.totalDoctors, icon: DoctorIcon, color: 'bg-primary-50 text-primary-800' },
          { label: 'Appointments', value: p.totalAppointments, icon: CalendarIcon, color: 'bg-info-50 text-info-800' },
          { label: 'Cases', value: p.totalCases, icon: CasesIcon, color: 'bg-warning-50 text-warning-700' },
          { label: 'Campaigns', value: p.totalCampaigns, icon: CampaignIcon, color: 'bg-danger-50 text-danger-700' },
          { label: 'Templates', value: p.totalTemplates, icon: TemplateIcon, color: 'bg-surface-200 text-surface-700' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4 bg-white border border-surface-200 text-center flex flex-col items-center justify-between">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 text-sm ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-900">{kpi.value}</p>
                <p className="text-xs font-semibold text-surface-600 uppercase tracking-wider mt-0.5">{kpi.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Financial & Commission Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-white border border-surface-200 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Financial &amp; Commission Intelligence</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Non-cancelled MedicalBill settlement totals &amp; date-bound hospital commission estimates
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              {rev.activeCommissionOverrides} Active Override{rev.activeCommissionOverrides === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3.5 rounded-xl bg-surface-50 border border-surface-200">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total Invoiced</p>
              <p className="text-lg font-extrabold text-surface-900 mt-1">
                {formatUsd(rev.medicalBilling.totalInvoiced)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-success-50 border border-success-200">
              <p className="text-xs font-semibold text-success-700 uppercase tracking-wider">Collected</p>
              <p className="text-lg font-extrabold text-success-800 mt-1">
                {formatUsd(rev.medicalBilling.totalCollected)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-warning-50 border border-warning-200">
              <p className="text-xs font-semibold text-warning-700 uppercase tracking-wider">Outstanding</p>
              <p className="text-lg font-extrabold text-warning-800 mt-1">
                {formatUsd(rev.medicalBilling.totalOutstanding)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-primary-50 border border-primary-200">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Hospital Comm.</p>
              <p className="text-lg font-extrabold text-primary-800 mt-1">
                {formatUsd(rev.medicalBilling.estimatedHospitalCommission)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-surface-600">Medical Billing Collection Rate</span>
              <span className="font-bold text-surface-800">{collectionPct}%</span>
            </div>
            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-success-500 transition-all duration-700"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-surface-200 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-surface-900">Partner Hotel Revenue</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Confirmed, checked-in, and completed accommodations
            </p>
          </div>

          <div className="space-y-3 my-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 border border-surface-200">
              <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Active Bookings</span>
              <span className="text-lg font-extrabold text-surface-900">{rev.accommodations.activeBookings}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 border border-surface-200">
              <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Gross Volume</span>
              <span className="text-lg font-extrabold text-surface-900">
                {formatUsd(rev.accommodations.grossRevenueUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50 border border-primary-200">
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Partner Commission</span>
              <span className="text-lg font-extrabold text-primary-800">
                {formatUsd(rev.accommodations.partnerCommissionUsd)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 1: Monthly Registrations + Appointment Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Registrations */}
        <Card className="p-6 bg-white border border-surface-200 lg:col-span-2">
          <h2 className="text-sm font-bold text-surface-900 mb-1">Monthly User Registrations</h2>
          <p className="text-xs text-surface-500 mb-5">Last 12 months</p>
          <div className="flex items-end gap-1.5 h-40">
            {data.monthlyRegistrations.map((m) => {
              const pct = Math.max((m.total / maxMonthly) * 100, 4);
              const label = m.month.split('-')[1];
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" title={`${m.month}: ${m.total} registrations (${m.patients}P / ${m.managers}M / ${m.doctors}D)`}>
                  <span className="text-xs font-bold text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">{m.total}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary-600 to-primary-400 transition-all duration-500 hover:from-primary-700 hover:to-primary-500 cursor-pointer"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs font-semibold text-surface-500">{label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Appointment Type Breakdown */}
        <Card className="p-6 bg-white border border-surface-200">
          <h2 className="text-sm font-bold text-surface-900 mb-5">Appointment Types</h2>
          <div className="space-y-4">
            {data.appointmentTypeBreakdown.map((a) => {
              const pct = Math.round((a.count / totalApptTypes) * 100);
              return (
                <div key={a.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-surface-700">{APPT_TYPE_LABELS[a.type] || a.type}</span>
                    <span className="text-surface-500">{a.count} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: APPT_TYPE_COLORS[a.type] || '#94a3b8' }}
                    />
                  </div>
                </div>
              );
            })}
            {data.appointmentTypeBreakdown.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-4">No appointment data yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Nationality + Case Lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nationality Distribution */}
        <Card className="p-6 bg-white border border-surface-200">
          <h2 className="text-sm font-bold text-surface-900 mb-1">Patient Nationality Distribution</h2>
          <p className="text-xs text-surface-400 mb-5">Top 15 countries of origin</p>
          <div className="space-y-2.5">
            {data.nationalityDistribution.map((n, i) => {
              const pct = Math.round((n.count / maxNationality) * 100);
              return (
                <div key={n.nationality} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-surface-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-surface-700">{n.nationality}</span>
                      <span className="text-surface-500 font-medium">{n.count}</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {data.nationalityDistribution.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-4">No patient nationality data yet.</p>
            )}
          </div>
        </Card>

        {/* Case Lifecycle Metrics */}
        <Card className="p-6 bg-white border border-surface-200">
          <h2 className="text-sm font-bold text-surface-900 mb-5">Case Lifecycle Metrics</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 text-center">
              <p className="text-3xl font-extrabold text-surface-900">{data.caseLifecycle.totalCases}</p>
              <p className="text-xs font-bold text-surface-600 uppercase tracking-wider mt-1">Total Cases</p>
            </div>
            <div className="p-4 bg-success-50 rounded-xl border border-success-200 text-center">
              <p className="text-3xl font-extrabold text-success-700">{data.caseLifecycle.closedCases}</p>
              <p className="text-xs font-bold text-success-700 uppercase tracking-wider mt-1">Closed</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-xl border border-primary-200 text-center">
              <p className="text-3xl font-extrabold text-primary-700">{data.caseLifecycle.completionRate}%</p>
              <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mt-1">Completion Rate</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <p className="text-3xl font-extrabold text-amber-700">{data.caseLifecycle.avgDurationDays}d</p>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mt-1">Avg Duration</p>
            </div>
          </div>

          {/* Revenue Estimates */}
          <div className="border-t border-surface-100 pt-4">
            <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider mb-3">Revenue Indicators</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-50 rounded-lg">
                <p className="text-lg font-bold text-surface-900">{rev.completedAppointments}</p>
                <p className="text-xs text-surface-600 font-semibold">Completed Appts</p>
              </div>
              <div className="p-3 bg-surface-50 rounded-lg">
                <p className="text-lg font-bold text-surface-900">{rev.avgCommissionRate}%</p>
                <p className="text-xs text-surface-600 font-semibold">Avg Base Commission</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Hospital Utilization + Doctor Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospital Utilization */}
        <Card className="bg-white border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900">Hospital Utilization</h2>
            <p className="text-xs text-surface-500 mt-0.5">Top 10 by appointment volume</p>
          </div>
          <div className="divide-y divide-surface-100">
            {data.hospitalUtilization.map((h, i) => {
              const pct = Math.round((h.appointments / maxHospAppt) * 100);
              const displayRate = h.effectiveCommissionRate ?? h.commissionRate;
              return (
                <div key={h.id} className="px-6 py-3.5 hover:bg-surface-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-surface-900">{h.name}</p>
                          {h.hasActiveOverride && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Override Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-surface-500">
                          {h.city} • {h.doctors} doctors • {displayRate}% comm.
                          {h.hasActiveOverride ? ` (base ${h.commissionRate}%)` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-surface-700">{h.appointments}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden ml-8">
                    <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.hospitalUtilization.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-surface-500">No hospital data yet.</div>
            )}
          </div>
        </Card>

        {/* Doctor Leaderboard */}
        <Card className="bg-white border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900">Doctor Consultation Leaderboard</h2>
            <p className="text-xs text-surface-500 mt-0.5">Top 10 by total appointments</p>
          </div>
          <div className="divide-y divide-surface-100">
            {data.doctorLeaderboard.map((d, i) => {
              const pct = Math.round((d.appointments / maxDocAppt) * 100);
              return (
                <div key={d.id} className="px-6 py-3.5 hover:bg-surface-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-surface-200 text-surface-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-surface-100 text-surface-500'
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{d.name}</p>
                        <p className="text-xs text-surface-500">{d.specialisation} • {d.hospital}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-surface-700">{d.appointments}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden ml-8">
                    <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.doctorLeaderboard.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-surface-500">No doctor data yet.</div>
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
