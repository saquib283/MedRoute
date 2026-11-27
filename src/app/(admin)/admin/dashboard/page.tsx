'use client';

/**
 * MediRoute India — Admin Dashboard
 * Platform-wide KPI overview with premium trends, interactive analytics charts, and styled timeline feed.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  ClipboardList,
  HeartPulse,
  MapPin,
  User,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

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
  PLAN_CONFIRMED: 'Confirmed',
  IN_TREATMENT: 'Treatment',
  POST_TREATMENT: 'Post-Tx',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, { hex: string }> = {
  INQUIRY_RECEIVED: { hex: '#3b82f6' },
  UNDER_REVIEW: { hex: '#f59e0b' },
  PLAN_CONFIRMED: { hex: '#0d9488' },
  IN_TREATMENT: { hex: '#6366f1' },
  POST_TREATMENT: { hex: '#22c55e' },
  CLOSED: { hex: '#94a3b8' },
};

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

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
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = data?.metrics;
  const kpis: {
    label: string;
    value: number;
    variant: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    icon: React.ReactNode;
    trend?: number;
  }[] = [
    { label: 'Total Users', value: m?.totalUsers || 0, variant: 'default', icon: <Users className="w-5 h-5" /> },
    { label: 'Active Patients', value: m?.totalPatients || 0, variant: 'primary', icon: <User className="w-5 h-5" /> },
    { label: 'Case Coordinators', value: m?.totalManagers || 0, variant: 'default', icon: <ClipboardList className="w-5 h-5" /> },
    { label: 'Active Doctors', value: m?.totalDoctors || 0, variant: 'success', icon: <HeartPulse className="w-5 h-5" /> },
    { label: 'Active Cases', value: m?.activeCases || 0, variant: 'warning', icon: <Briefcase className="w-5 h-5" />, trend: data?.trends.cases },
    { label: 'Appointments', value: m?.appointmentsThisPeriod || 0, variant: 'primary', icon: <Calendar className="w-5 h-5" />, trend: data?.trends.appointments },
    { label: 'Pending Escalations', value: m?.pendingEscalations || 0, variant: 'danger', icon: <AlertTriangle className="w-5 h-5" /> },
  ];

  const statusTotal = data?.statusDistribution.reduce((s, d) => s + d.count, 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Platform case flow, coordinator workload, hospital bookings, and audit activity"
        actions={
          <div className="flex bg-white border border-surface-200 p-1 rounded-lg">
            {PERIODS.map((p) => {
              const isActive = period === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            icon={kpi.icon}
            trend={
              kpi.trend !== undefined && kpi.trend !== null
                ? { value: kpi.trend, label: 'vs previous period' }
                : undefined
            }
          />
        ))}
      </div>

      {/* Row 2: Analytics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-surface-900 uppercase tracking-wider">Case Status Breakdown</h2>
              <p className="text-xs text-surface-500 mt-0.5">Distribution across active pipeline stages</p>
            </div>
            <Badge variant="primary">{statusTotal} Cases</Badge>
          </div>

          {statusTotal > 0 ? (
            <div className="space-y-5">
              <div className="h-3.5 bg-surface-100 rounded-full flex overflow-hidden border border-surface-200">
                {data?.statusDistribution.map((d) => {
                  const pct = (d.count / statusTotal) * 100;
                  const color = STATUS_COLORS[d.status]?.hex || '#cbd5e1';
                  return (
                    <div
                      key={d.status}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${STATUS_LABELS[d.status] || d.status}: ${d.count} cases (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {data?.statusDistribution.map((d) => {
                  const pct = Math.round((d.count / statusTotal) * 100);
                  const style = STATUS_COLORS[d.status] || { hex: '#94a3b8' };
                  return (
                    <div key={d.status} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-200 bg-surface-50">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
                        <span className="text-xs font-semibold text-surface-700">{STATUS_LABELS[d.status] || d.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-surface-900 block">{d.count}</span>
                        <span className="text-[11px] text-surface-500 block">{pct}%</span>
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

        {/* Coordinator Workload */}
        <Card className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-surface-900 uppercase tracking-wider">Coordinator Workload</h2>
            <p className="text-xs text-surface-500 mt-0.5">Active cases assigned per coordinator</p>
          </div>
          {data?.managerWorkload && data.managerWorkload.length > 0 ? (
            <div className="space-y-4">
              {data.managerWorkload.slice(0, 5).map((mw, i) => {
                const maxCases = data.managerWorkload[0]?.activeCases || 1;
                const pct = Math.round((mw.activeCases / maxCases) * 100);
                return (
                  <div key={mw.managerId} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-surface-400 w-4 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-700 font-bold text-xs shrink-0 border border-surface-200">
                      {mw.managerName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-surface-800 truncate">{mw.managerName}</span>
                        <span className="text-surface-900 font-semibold shrink-0">{mw.activeCases} active</span>
                      </div>
                      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-600 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-surface-500 text-center py-10">No coordinator assignments.</p>
          )}
        </Card>
      </div>

      {/* Row 3: Top Hospitals Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-surface-900 uppercase tracking-wider">Partner Hospitals</h2>
            <p className="text-xs text-surface-500 mt-0.5">Facilities ranked by booked appointments</p>
          </div>
          <Badge variant="info">Partners</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 uppercase tracking-wider">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 uppercase tracking-wider">Appointments</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-600 uppercase tracking-wider">Doctors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {data?.topHospitals && data.topHospitals.length > 0 ? (
                data.topHospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-surface-900">{h.name}</td>
                    <td className="px-6 py-3.5 text-surface-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-surface-400" /> {h.city}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-surface-900 font-semibold">{h.appointments}</td>
                    <td className="px-6 py-3.5 text-surface-600">{h.doctors} doctors</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-surface-500">No partner hospitals recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Row 4: Recent Activities Timeline */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200">
          <h2 className="text-sm font-semibold text-surface-900 uppercase tracking-wider">Recent Audit Activity</h2>
          <p className="text-xs text-surface-500 mt-0.5">Latest recorded administrative and clinical actions</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((log) => {
                const isSystemAction = ['DEACTIVATE', 'DELETE', 'ESCALATION'].some((act) => log.action.includes(act));
                const isCreateAction = ['CREATE', 'ACTIVATE'].some((act) => log.action.includes(act));
                const actionBadgeColor = isSystemAction ? 'danger' : isCreateAction ? 'success' : 'primary';

                return (
                  <div key={log.id} className="flex gap-3.5 items-start p-3 rounded-lg border border-surface-200 bg-surface-50">
                    <div className="w-8 h-8 rounded-full bg-primary-50 border border-primary-200 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {log.actor.fullName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-sm text-surface-800 font-medium">
                          <span className="font-semibold text-surface-900">{log.actor.fullName}</span>{' '}
                          performed{' '}
                          <span className="text-surface-900 font-mono font-semibold bg-white border border-surface-200 px-1.5 py-0.5 rounded text-xs">{log.action}</span>
                        </p>
                        <span className="text-xs text-surface-500 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={actionBadgeColor} size="sm">{log.entityType}</Badge>
                        <span className="text-xs text-surface-500 font-mono truncate">Ref: {log.entityId}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-sm text-surface-500">
                No activity logs recorded.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}


