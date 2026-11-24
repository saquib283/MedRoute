'use client';

/**
 * Afzal Healthcare — Admin Dashboard
 * Platform-wide KPI overview with premium trends, interactive analytics charts, and styled timeline feed.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface DashboardData {
  metrics: {
    totalUsers: number;
    totalPatients: number;
    totalManagers: number;
    totalDoctors: number;
    activeCases: number;
    appointmentsThisPeriod: number;
    pendingEscalations: number;
  };
  trends: { appointments: number; cases: number };
  statusDistribution: { status: string; count: number }[];
  managerWorkload: { managerId: string; managerName: string; activeCases: number }[];
  topHospitals: { id: string; name: string; city: string; appointments: number; doctors: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    actor: { fullName: string; role: string };
  }[];
  period: string;
}

const STATUS_LABELS: Record<string, string> = {
  INQUIRY_RECEIVED: 'Inquiry',
  UNDER_REVIEW: 'Review',
  PRE_OP_CLEARANCE: 'Pre-Op',
  PLAN_CONFIRMED: 'Confirmed',
  IN_TREATMENT: 'Treatment',
  ICU_RECOVERY: 'ICU / CCU',
  WARD_RECOVERY: 'Ward',
  POST_TREATMENT: 'Post-Tx',
  OUTPATIENT_RECUPERATION: 'Outpatient',
  FIT_TO_FLY_CLEARED: 'Fit-to-Fly',
  REMOTE_REHAB: 'Tele-Rehab',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  INQUIRY_RECEIVED: { bg: 'bg-blue-50', text: 'text-blue-700', hex: '#3b82f6' },
  UNDER_REVIEW: { bg: 'bg-warning-50', text: 'text-warning-700', hex: '#f59e0b' },
  PRE_OP_CLEARANCE: { bg: 'bg-sky-50', text: 'text-sky-700', hex: '#0ea5e9' },
  PLAN_CONFIRMED: { bg: 'bg-primary-50', text: 'text-primary-700', hex: '#0d9488' },
  IN_TREATMENT: { bg: 'bg-violet-50', text: 'text-violet-700', hex: '#8b5cf6' },
  ICU_RECOVERY: { bg: 'bg-red-50', text: 'text-red-700', hex: '#ef4444' },
  WARD_RECOVERY: { bg: 'bg-amber-50', text: 'text-amber-700', hex: '#d97706' },
  POST_TREATMENT: { bg: 'bg-success-50', text: 'text-success-700', hex: '#22c55e' },
  OUTPATIENT_RECUPERATION: { bg: 'bg-cyan-50', text: 'text-cyan-700', hex: '#06b6d4' },
  FIT_TO_FLY_CLEARED: { bg: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10b981' },
  REMOTE_REHAB: { bg: 'bg-indigo-50', text: 'text-indigo-700', hex: '#6366f1' },
  CLOSED: { bg: 'bg-surface-200', text: 'text-surface-600', hex: '#94a3b8' },
};

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-surface-400 font-medium">—</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${
      isUp ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-danger-50 text-danger-700 border border-danger-200'
    }`}>
      {isUp ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/dashboard?period=${period}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = data?.metrics;
  const kpis = [
    { label: 'Total users', value: m?.totalUsers || 0, icon: UsersIcon },
    { label: 'Active patients', value: m?.totalPatients || 0, icon: PatientIcon },
    { label: 'Active managers', value: m?.totalManagers || 0, icon: ChecklistIcon },
    { label: 'Active doctors', value: m?.totalDoctors || 0, icon: DoctorIcon },
    { label: 'Active cases', value: m?.activeCases || 0, icon: CasesIcon, trend: data?.trends.cases },
    { label: 'Appointments', value: m?.appointmentsThisPeriod || 0, icon: CalendarIcon, trend: data?.trends.appointments },
    { label: 'Pending escalations', value: m?.pendingEscalations || 0, icon: EscalationIcon },
  ];

  // For segmented bar representation
  const statusTotal = data?.statusDistribution.reduce((s, d) => s + d.count, 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Operations Dashboard</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Real-time metrics, case flow, hospital assignments, and system audit feed.</p>
        </div>

        {/* Period Switcher */}
        <div className="flex bg-surface-100 p-1 rounded-md border border-surface-200 self-start sm:self-center">
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-white text-surface-900 shadow-2xs border border-surface-200'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
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

              {'trend' in kpi && kpi.trend !== undefined && kpi.trend !== null ? (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-200">
                  <TrendBadge value={kpi.trend} />
                  <span className="text-xs text-surface-500 font-medium">vs previous period</span>
                </div>
              ) : (
                <div className="h-4 mt-4" />
              )}
            </Card>
          );
        })}
      </div>

      {/* Row 2: Analytics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case Status Distribution */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-surface-900">Case status proportions</h2>
              <p className="text-xs text-surface-500 mt-0.5">Platform case status segment breakdown</p>
            </div>
            <Badge variant="primary">{statusTotal} Active Cases</Badge>
          </div>

          {statusTotal > 0 ? (
            <div className="space-y-5">
              <div className="h-2.5 bg-surface-100 rounded-full flex overflow-hidden border border-surface-200">
                {data?.statusDistribution.map((d) => {
                  const pct = (d.count / statusTotal) * 100;
                  const color = STATUS_COLORS[d.status]?.hex || '#cbd5e1';
                  return (
                    <div
                      key={d.status}
                      className="h-full transition-opacity hover:opacity-90 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${STATUS_LABELS[d.status] || d.status}: ${d.count} cases (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {data?.statusDistribution.map((d) => {
                  const pct = Math.round((d.count / statusTotal) * 100);
                  const style = STATUS_COLORS[d.status] || { bg: 'bg-surface-200', text: 'text-surface-700', hex: '#94a3b8' };
                  return (
                    <div key={d.status} className="flex items-center justify-between p-2.5 rounded-md border border-surface-200 bg-surface-100/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
                        <span className="text-xs font-medium text-surface-700 truncate">{STATUS_LABELS[d.status] || d.status}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-semibold tabular-nums text-surface-900">{d.count}</span>
                        <span className="text-[11px] text-surface-500 tabular-nums ml-1">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-surface-500 text-center py-10">No active cases registered.</p>
          )}
        </Card>

        {/* Manager Workload */}
        <Card padding="lg">
          <div className="mb-5">
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Manager workload</h2>
            <p className="text-xs text-surface-500 mt-0.5">Active case distribution across operations managers</p>
          </div>
          {data?.managerWorkload && data.managerWorkload.length > 0 ? (
            <div className="space-y-4">
              {data.managerWorkload.slice(0, 5).map((mw, i) => {
                const maxCases = data.managerWorkload[0]?.activeCases || 1;
                const pct = Math.round((mw.activeCases / maxCases) * 100);
                return (
                  <div key={mw.managerId} className="flex items-center gap-3">
                    <span className="text-xs font-medium tabular-nums text-surface-400 w-4 text-center">{i + 1}</span>

                    <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-700 font-semibold text-xs shrink-0 border border-surface-200">
                      {mw.managerName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-surface-700 truncate">{mw.managerName}</span>
                        <span className="text-surface-900 font-semibold tabular-nums">{mw.activeCases} active</span>
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
            </div>
          ) : (
            <p className="text-sm text-surface-500 text-center py-10">No active manager assignments.</p>
          )}
        </Card>
      </div>

      {/* Row 3: Top Hospitals Table */}
      <Card className="p-0! overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">Top hospital partners</h2>
            <p className="text-xs text-surface-500 mt-0.5">Healthcare providers ranked by appointment volume</p>
          </div>
          <Badge variant="info">Partnerships</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-100">
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Hospital Name</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">City Location</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Total Appointments</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Active Staff Doctors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {data?.topHospitals && data.topHospitals.length > 0 ? (
                data.topHospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-100/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-surface-900">{h.name}</td>
                    <td className="px-5 py-3.5 text-surface-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-surface-400" /> {h.city}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-surface-900 font-semibold tabular-nums">{h.appointments}</td>
                    <td className="px-5 py-3.5 text-surface-600 tabular-nums">{h.doctors} doctors</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-surface-500">No partner hospital records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Row 4: Recent Activities Timeline */}
      <Card className="p-0! overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900">Operational audit activity</h2>
          <p className="text-xs text-surface-500 mt-0.5">Recent administrative modifications and platform actions</p>
        </div>
        <div className="p-5 relative">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-4 relative">
              <div className="absolute top-4 bottom-4 left-6 w-px bg-surface-200" />
              {data.recentActivity.map((log) => {
                const isSystemAction = ['DEACTIVATE', 'DELETE', 'ESCALATION'].some(act => log.action.includes(act));
                const isCreateAction = ['CREATE', 'ACTIVATE'].some(act => log.action.includes(act));
                const actionBadgeColor = isSystemAction ? 'danger' : isCreateAction ? 'success' : 'primary';

                return (
                  <div key={log.id} className="flex gap-3.5 items-start hover:bg-surface-100/60 p-2 rounded-md transition-colors relative">
                    <div className="w-8 h-8 rounded-full bg-surface-100 border border-surface-200 text-surface-700 font-semibold text-xs flex items-center justify-center shrink-0 z-10">
                      {log.actor.fullName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-sm text-surface-800 font-medium">
                          <span className="font-semibold text-surface-900">{log.actor.fullName}</span>{' '}
                          <span className="text-surface-500">performed</span>{' '}
                          <span className="text-surface-800 font-medium bg-surface-100 border border-surface-200 px-1.5 py-0.5 rounded text-xs font-mono">{log.action}</span>
                        </p>
                        <span className="text-xs text-surface-500 tabular-nums sm:text-right">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={actionBadgeColor} size="sm">{log.entityType}</Badge>
                        <span className="text-xs text-surface-500 tabular-nums">Ref: {log.entityId}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-surface-500">
              No activity logs recorded.
            </div>
          )}
        </div>
      </Card>
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
function ChecklistIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
}
function DoctorIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
}
function CasesIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
}
function CalendarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function EscalationIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}
function MapPinIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}


