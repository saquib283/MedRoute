'use client';

/**
 * MediRoute India — Admin Advanced Analytics
 * Rich data visualization with CSS-based charts, trend analysis,
 * nationality distribution, hospital & doctor leaderboards, and case lifecycle.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Users,
  User,
  Building2,
  Stethoscope,
  Calendar,
  Briefcase,
  Mail,
  FileText,
  Lock,
} from 'lucide-react';

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
  hospitalUtilization: { id: string; name: string; city: string; appointments: number; doctors: number; commissionRate: number }[];
  doctorLeaderboard: { id: string; name: string; specialisation: string; hospital: string; appointments: number }[];
  caseLifecycle: { totalCases: number; closedCases: number; completionRate: number; avgDurationDays: number };
  revenueEstimates: { completedAppointments: number; avgCommissionRate: number };
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
        <div className="w-14 h-14 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-surface-900">Access Denied</h2>
        <p className="text-sm text-surface-500 mt-2">Only Administrators can access platform analytics.</p>
      </div>
    );
  }

  if (!data) return null;

  const p = data.platformTotals;
  const maxMonthly = Math.max(...data.monthlyRegistrations.map((m) => m.total), 1);
  const maxNationality = data.nationalityDistribution[0]?.count || 1;
  const totalApptTypes = data.appointmentTypeBreakdown.reduce((s, a) => s + a.count, 0) || 1;
  const maxHospAppt = data.hospitalUtilization[0]?.appointments || 1;
  const maxDocAppt = data.doctorLeaderboard[0]?.appointments || 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Platform Analytics"
        subtitle="Registration trends, nationality breakdown, hospital utilization, and case lifecycle metrics"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Analytics' },
        ]}
      />

      {/* Platform Totals - Compact Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Users', value: p.totalUsers, icon: Users },
          { label: 'Patients', value: p.totalPatients, icon: User },
          { label: 'Hospitals', value: p.totalHospitals, icon: Building2 },
          { label: 'Doctors', value: p.totalDoctors, icon: Stethoscope },
          { label: 'Appointments', value: p.totalAppointments, icon: Calendar },
          { label: 'Cases', value: p.totalCases, icon: Briefcase },
          { label: 'Campaigns', value: p.totalCampaigns, icon: Mail },
          { label: 'Templates', value: p.totalTemplates, icon: FileText },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4 bg-white border border-surface-200 text-center flex flex-col items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-primary-50 text-primary-700 border border-primary-100">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-900 tabular-nums">{kpi.value}</p>
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mt-0.5">{kpi.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Row 1: Monthly Registrations + Appointment Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Registrations */}
        <Card className="p-6 bg-white border border-surface-200 lg:col-span-2">
          <h2 className="text-sm font-bold text-surface-900 mb-1">Monthly User Registrations</h2>
          <p className="text-xs text-surface-400 mb-5">Last 12 months</p>
          <div className="flex items-end gap-1.5 h-40">
            {data.monthlyRegistrations.map((m) => {
              const pct = Math.max((m.total / maxMonthly) * 100, 4);
              const label = m.month.split('-')[1];
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" title={`${m.month}: ${m.total} registrations (${m.patients}P / ${m.managers}M / ${m.doctors}D)`}>
                  <span className="text-[9px] font-bold text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity">{m.total}</span>
                  <div
                    className="w-full rounded-t-md bg-primary-500 hover:bg-primary-600 transition-colors cursor-pointer"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                  />
                  <span className="text-[9px] font-semibold text-surface-400">{label}</span>
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
                        className="h-full rounded-full bg-primary-500 transition-all duration-700"
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
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">Total Cases</p>
            </div>
            <div className="p-4 bg-success-50 rounded-xl border border-success-200 text-center">
              <p className="text-3xl font-extrabold text-success-700">{data.caseLifecycle.closedCases}</p>
              <p className="text-[10px] font-bold text-success-600 uppercase tracking-wider mt-1">Closed</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-xl border border-primary-200 text-center">
              <p className="text-3xl font-extrabold text-primary-700">{data.caseLifecycle.completionRate}%</p>
              <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mt-1">Completion Rate</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <p className="text-3xl font-extrabold text-amber-700">{data.caseLifecycle.avgDurationDays}d</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1">Avg Duration</p>
            </div>
          </div>

          {/* Revenue Estimates */}
          <div className="border-t border-surface-100 pt-4">
            <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider mb-3">Revenue Indicators</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-50 rounded-lg">
                <p className="text-lg font-bold text-surface-900">{data.revenueEstimates.completedAppointments}</p>
                <p className="text-[10px] text-surface-500 font-semibold">Completed Appts</p>
              </div>
              <div className="p-3 bg-surface-50 rounded-lg">
                <p className="text-lg font-bold text-surface-900">{data.revenueEstimates.avgCommissionRate}%</p>
                <p className="text-[10px] text-surface-500 font-semibold">Avg Commission</p>
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
            <p className="text-xs text-surface-400 mt-0.5">Top 10 by appointment volume</p>
          </div>
          <div className="divide-y divide-surface-100">
            {data.hospitalUtilization.map((h, i) => {
              const pct = Math.round((h.appointments / maxHospAppt) * 100);
              return (
                <div key={h.id} className="px-6 py-3.5 hover:bg-surface-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{h.name}</p>
                        <p className="text-[10px] text-surface-400">{h.city} • {h.doctors} doctors • {h.commissionRate}% comm.</p>
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
            <p className="text-xs text-surface-400 mt-0.5">Top 10 by total appointments</p>
          </div>
          <div className="divide-y divide-surface-100">
            {data.doctorLeaderboard.map((d, i) => {
              const pct = Math.round((d.appointments / maxDocAppt) * 100);
              return (
                <div key={d.id} className="px-6 py-3.5 hover:bg-surface-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-surface-200 text-surface-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-surface-100 text-surface-500'
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{d.name}</p>
                        <p className="text-[10px] text-surface-400">{d.specialisation} • {d.hospital}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-surface-700">{d.appointments}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden ml-8">
                    <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
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

