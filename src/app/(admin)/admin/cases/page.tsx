'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CASE_STATUS_LABELS } from '@/lib/constants';

interface AdminCase {
  id: string;
  status: string;
  isUrgent: boolean;
  escalationNote: string | null;
  notes: string | null;
  createdAt: string;
  patient: { user: { fullName: string; email: string } };
  manager: { fullName: string } | null;
  _count: { appointments: number };
}

const STATUS_OPTIONS = ['INQUIRY_RECEIVED', 'UNDER_REVIEW', 'PLAN_CONFIRMED', 'IN_TREATMENT', 'POST_TREATMENT', 'CLOSED'];

export default function AdminCasesPage() {
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchCases = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) params.set('status', statusFilter);
      if (urgentOnly) params.set('urgent', 'true');
      const res = await fetch(`/api/v1/admin/cases?${params}`);
      const data = await res.json();
      if (data.success) { setCases(data.data.cases); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [statusFilter, urgentOnly]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">All Cases</h1>
        <p className="text-sm text-surface-500 mt-1">Platform-wide case oversight across all managers and patients.</p>
      </div>
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3 items-center">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-lg text-sm flex-1">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium text-surface-700">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} /> Urgent Only
        </label>
      </Card>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Manager</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Appts</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {cases.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-surface-500">No cases found.</td></tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-surface-900">{c.patient.user.fullName}</p>
                        <p className="text-xs text-surface-400">{c.patient.user.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{c.manager?.fullName || '—'}</td>
                      <td className="px-5 py-3.5"><Badge variant={c.status === 'CLOSED' ? 'default' : 'primary'}>{CASE_STATUS_LABELS[c.status] || c.status}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-600">{c._count.appointments}</td>
                      <td className="px-5 py-3.5 text-xs text-surface-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 flex gap-1">
                        {c.isUrgent && <Badge variant="danger" dot>Urgent</Badge>}
                        {c.escalationNote && <Badge variant="warning" dot>Escalated</Badge>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchCases(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchCases(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
