'use client';

/**
 * MediRoute India — Admin Dashboard
 * Platform-wide KPI overview and recent activity feed.
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
    appointmentsThisWeek: number;
    pendingEscalations: number;
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    actor: { fullName: string; role: string };
  }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/v1/admin/dashboard');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = data?.metrics;
  const kpis = [
    { label: 'Total Users', value: m?.totalUsers || 0, color: 'bg-primary-50 text-primary-600', icon: '👥' },
    { label: 'Active Patients', value: m?.totalPatients || 0, color: 'bg-blue-50 text-blue-600', icon: '🏥' },
    { label: 'Active Managers', value: m?.totalManagers || 0, color: 'bg-violet-50 text-violet-600', icon: '📋' },
    { label: 'Active Doctors', value: m?.totalDoctors || 0, color: 'bg-emerald-50 text-emerald-600', icon: '⚕️' },
    { label: 'Active Cases', value: m?.activeCases || 0, color: 'bg-amber-50 text-amber-600', icon: '📂' },
    { label: 'Appointments (7d)', value: m?.appointmentsThisWeek || 0, color: 'bg-cyan-50 text-cyan-600', icon: '📅' },
    { label: 'Pending Escalations', value: m?.pendingEscalations || 0, color: 'bg-red-50 text-red-600', icon: '🚨' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-surface-500 mt-1">Platform-wide operations overview and key performance indicators.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-5 bg-white border border-surface-200">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${kpi.color}`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-surface-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-surface-900 mt-0.5">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-white border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100">
          <h2 className="text-sm font-bold text-surface-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-surface-100">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity.map((log) => (
              <div key={log.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-600 font-bold text-xs shrink-0">
                  {log.actor.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-800">
                    <span className="font-semibold">{log.actor.fullName}</span>{' '}
                    <span className="text-surface-500">{log.action}</span>{' '}
                    <span className="font-medium">{log.entityType}</span>
                  </p>
                  <p className="text-[11px] text-surface-400 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
                <Badge variant="default" className="text-[10px]">{log.actor.role}</Badge>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-sm text-surface-500">
              No audit log entries yet. Activity will appear here as users interact with the platform.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
