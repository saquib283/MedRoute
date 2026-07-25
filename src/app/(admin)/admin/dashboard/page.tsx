'use client';

/**
 * MediRoute India — Admin Dashboard
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
  PLAN_CONFIRMED: 'Confirmed',
  IN_TREATMENT: 'Treatment',
  POST_TREATMENT: 'Post-Tx',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  INQUIRY_RECEIVED: { bg: 'bg-blue-50', text: 'text-blue-700', hex: '#3b82f6' },
  UNDER_REVIEW: { bg: 'bg-warning-50', text: 'text-warning-700', hex: '#f59e0b' },
  PLAN_CONFIRMED: { bg: 'bg-primary-50', text: 'text-primary-700', hex: '#0d9488' },
  IN_TREATMENT: { bg: 'bg-violet-50', text: 'text-violet-700', hex: '#8b5cf6' },
  POST_TREATMENT: { bg: 'bg-success-50', text: 'text-success-700', hex: '#22c55e' },
  CLOSED: { bg: 'bg-surface-200', text: 'text-surface-600', hex: '#94a3b8' },
};

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-surface-400 font-semibold">—</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
      isUp ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
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
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = data?.metrics;
  const kpis = [
    { label: 'Total Users', value: m?.totalUsers || 0, color: 'from-primary-500/10 to-primary-600/5 text-primary-700 border-primary-200/50', icon: UsersIcon },
    { label: 'Active Patients', value: m?.totalPatients || 0, color: 'from-blue-500/10 to-blue-600/5 text-blue-700 border-blue-200/50', icon: PatientIcon },
    { label: 'Active Managers', value: m?.totalManagers || 0, color: 'from-violet-500/10 to-violet-600/5 text-violet-700 border-violet-200/50', icon: ChecklistIcon },
    { label: 'Active Doctors', value: m?.totalDoctors || 0, color: 'from-emerald-500/10 to-emerald-600/5 text-emerald-700 border-emerald-200/50', icon: DoctorIcon },
    { label: 'Active Cases', value: m?.activeCases || 0, color: 'from-amber-500/10 to-amber-600/5 text-amber-700 border-amber-200/50', icon: CasesIcon, trend: data?.trends.cases },
    { label: `Appointments`, value: m?.appointmentsThisPeriod || 0, color: 'from-cyan-500/10 to-cyan-600/5 text-cyan-700 border-cyan-200/50', icon: CalendarIcon, trend: data?.trends.appointments },
    { label: 'Pending Escalations', value: m?.pendingEscalations || 0, color: 'from-red-500/10 to-red-600/5 text-red-700 border-red-200/50', icon: EscalationIcon },
  ];

  // For segmented bar representation
  const statusTotal = data?.statusDistribution.reduce((s, d) => s + d.count, 0) || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-surface-200/60">
        <div>
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight bg-gradient-to-r from-surface-900 to-surface-700 bg-clip-text text-transparent">Operations Dashboard</h1>
          <p className="text-sm text-surface-500 mt-1.5 font-medium">Real-time metrics, case flow, hospital assignments, and system audit feed.</p>
        </div>
        
        {/* Glassmorphism Period Picker */}
        <div className="flex bg-white/70 backdrop-blur-md border border-surface-300/80 p-1 rounded-xl shadow-xs self-start sm:self-center">
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`relative px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100/50'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Premium KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card 
              key={kpi.label} 
              className="group relative overflow-hidden bg-white border border-surface-200/80 p-5 hover:-translate-y-1 hover:shadow-md hover:border-primary-300 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-3xl font-extrabold text-surface-900 tracking-tight mt-1">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center border shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              
              {/* Sparkline & Trend Info */}
              {'trend' in kpi && kpi.trend !== undefined && kpi.trend !== null && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-100/80">
                  <TrendBadge value={kpi.trend} />
                  <span className="text-[10px] text-surface-400 font-semibold">vs previous period</span>
                </div>
              )}
              {!('trend' in kpi) && (
                <div className="h-4 mt-4" /> // empty spacer for matching layout height
              )}
            </Card>
          );
        })}
      </div>

      {/* Row 2: Analytics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Case Status Distribution */}
        <Card className="p-6 bg-white border border-surface-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Case Status Proportions</h2>
              <p className="text-xs text-surface-400 mt-0.5">Platform cases status segment breakdown</p>
            </div>
            <Badge variant="primary">{statusTotal} Active Cases</Badge>
          </div>

          {/* Segmented Timeline Bar */}
          {statusTotal > 0 ? (
            <div className="space-y-6">
              <div className="h-4 bg-surface-100 rounded-full flex overflow-hidden shadow-inner border border-surface-200/50">
                {data?.statusDistribution.map((d) => {
                  const pct = (d.count / statusTotal) * 100;
                  const color = STATUS_COLORS[d.status]?.hex || '#cbd5e1';
                  return (
                    <div
                      key={d.status}
                      className="h-full transition-all hover:brightness-95 cursor-pointer first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${STATUS_LABELS[d.status] || d.status}: ${d.count} cases (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Status List Legend Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {data?.statusDistribution.map((d) => {
                  const pct = Math.round((d.count / statusTotal) * 100);
                  const style = STATUS_COLORS[d.status] || { bg: 'bg-surface-200', text: 'text-surface-700' };
                  return (
                    <div key={d.status} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-100 bg-surface-50/50">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.hex }} />
                        <span className="text-xs font-bold text-surface-700">{STATUS_LABELS[d.status] || d.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-surface-950 block">{d.count}</span>
                        <span className="text-[10px] text-surface-400 block mt-0.5">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-10">No active cases registered.</p>
          )}
        </Card>

        {/* Manager Workload */}
        <Card className="p-6 bg-white border border-surface-200">
          <div>
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider mb-1">Manager Load Leaderboard</h2>
            <p className="text-xs text-surface-400 mb-6">Active case distribution across operations managers</p>
          </div>
          {data?.managerWorkload && data.managerWorkload.length > 0 ? (
            <div className="space-y-4">
              {data.managerWorkload.slice(0, 5).map((mw, i) => {
                const maxCases = data.managerWorkload[0]?.activeCases || 1;
                const pct = Math.round((mw.activeCases / maxCases) * 100);
                const colors = ['bg-primary-500', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'];
                return (
                  <div key={mw.managerId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-surface-400 w-4 text-center">{i + 1}</span>
                    
                    {/* Avatars */}
                    <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-700 font-extrabold text-xs shrink-0 border border-surface-200 shadow-xs">
                      {mw.managerName.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-surface-700">{mw.managerName}</span>
                        <span className="text-surface-950 font-bold">{mw.activeCases} active cases</span>
                      </div>
                      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${colors[i % colors.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-10">No active manager assignments.</p>
          )}
        </Card>
      </div>

      {/* Row 3: Top Hospitals Table */}
      <Card className="bg-white border border-surface-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-surface-150 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Top Hospital Partners</h2>
            <p className="text-xs text-surface-400 mt-0.5">Top-performing healthcare providers based on bookings</p>
          </div>
          <Badge variant="info">Hospital Partnerships</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="px-6 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Hospital Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">City Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Total Appointments</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Active Staff Doctors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data?.topHospitals && data.topHospitals.length > 0 ? (
                data.topHospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-surface-900">{h.name}</td>
                    <td className="px-6 py-4 text-surface-600 font-medium flex items-center gap-1">
                      <MapPinIcon className="w-3.5 h-3.5 text-surface-400" /> {h.city}
                    </td>
                    <td className="px-6 py-4 text-surface-900 font-bold">{h.appointments}</td>
                    <td className="px-6 py-4 text-surface-500 font-medium">{h.doctors} doctors</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-surface-400">No partner hospitals records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Row 4: Recent Activities Timeline */}
      <Card className="bg-white border border-surface-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-surface-150">
          <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Operational Audit Activity</h2>
          <p className="text-xs text-surface-400 mt-0.5">Real-time log of administrative modifications and platform actions</p>
        </div>
        <div className="p-6 relative">
          <div className="absolute top-6 bottom-6 left-12 w-0.5 bg-surface-200/70" />
          
          <div className="space-y-6 relative">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((log) => {
                const isSystemAction = ['DEACTIVATE', 'DELETE', 'ESCALATION'].some(act => log.action.includes(act));
                const isCreateAction = ['CREATE', 'ACTIVATE'].some(act => log.action.includes(act));
                const actionBadgeColor = isSystemAction ? 'danger' : isCreateAction ? 'success' : 'primary';

                return (
                  <div key={log.id} className="flex gap-4 items-start hover:bg-surface-50/40 p-2.5 rounded-xl transition-colors">
                    {/* Circle Avatar */}
                    <div className="w-8 h-8 rounded-full bg-primary-50 border border-primary-200 text-primary-700 font-extrabold text-xs flex items-center justify-center shrink-0 z-10 shadow-xs">
                      {log.actor.fullName.charAt(0)}
                    </div>
                    
                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-sm text-surface-800 font-semibold">
                          {log.actor.fullName}{' '}
                          <span className="text-surface-500 font-medium">performed action</span>{' '}
                          <span className="text-surface-900 font-bold bg-surface-100 px-1.5 py-0.5 rounded text-xs">{log.action}</span>
                        </p>
                        <span className="text-[10px] text-surface-400 font-semibold sm:text-right">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={actionBadgeColor} size="sm">{log.entityType}</Badge>
                        <span className="text-xs text-surface-400 font-medium">Entity Reference: {log.entityId}</span>
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


