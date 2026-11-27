'use client';

/**
 * MediRoute India — Admin Cases Management
 * Full case oversight with search, filters, status transitions, and manager reassignment.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { CASE_STATUS_LABELS, CASE_STATUS_ORDER } from '@/lib/constants';

interface AdminCase {
  id: string;
  status: string;
  isUrgent: boolean;
  escalationNote: string | null;
  notes: string | null;
  createdAt: string;
  patient: { user: { fullName: string; email: string } };
  manager: { id: string; fullName: string } | null;
  _count: { appointments: number };
}

interface ManagerOption { id: string; fullName: string; }

const STATUS_OPTIONS = ['INQUIRY_RECEIVED', 'UNDER_REVIEW', 'PLAN_CONFIRMED', 'IN_TREATMENT', 'POST_TREATMENT', 'CLOSED'];
const STATUS_BADGE: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'default'> = {
  INQUIRY_RECEIVED: 'primary', UNDER_REVIEW: 'warning', PLAN_CONFIRMED: 'primary',
  IN_TREATMENT: 'warning', POST_TREATMENT: 'success', CLOSED: 'default',
};

export default function AdminCasesPage() {
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Detail drawer
  const [selectedCase, setSelectedCase] = useState<AdminCase | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchCases = useCallback(async (page = 1) => {
    await Promise.resolve();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) params.set('status', statusFilter);
      if (urgentOnly) params.set('urgent', 'true');
      if (search) params.set('search', search);
      if (managerFilter) params.set('managerId', managerFilter);
      const res = await fetch(`/api/v1/admin/cases?${params}`);
      const data = await res.json();
      if (data.success) { setCases(data.data.cases); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [statusFilter, urgentOnly, search, managerFilter]);

  useEffect(() => { queueMicrotask(() => fetchCases()); }, [fetchCases]);

  useEffect(() => {
    fetch('/api/v1/admin/users?role=MANAGER&limit=100')
      .then(r => r.json())
      .then(d => { if (d.success) setManagers(d.data.users.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName }))); })
      .catch(() => {});
  }, []);

  const handleStatusChange = async (caseId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/v1/admin/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseId, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed to update status'); return; }
      toast.success(`Case status updated to ${CASE_STATUS_LABELS[newStatus]}`);
      setSelectedCase(null);
      fetchCases(pagination.page);
    } catch { toast.error('Failed to update case.'); } finally { setUpdating(false); }
  };

  const handleReassign = async (caseId: string, managerId: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/v1/admin/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseId, managerId: managerId || null }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed'); return; }
      toast.success('Case manager reassigned');
      setSelectedCase(null);
      fetchCases(pagination.page);
    } catch { toast.error('Failed to reassign.'); } finally { setUpdating(false); }
  };

  const getNextStatus = (current: string): string | null => {
    const idx = CASE_STATUS_ORDER.indexOf(current as typeof CASE_STATUS_ORDER[number]);
    if (idx < 0 || idx >= CASE_STATUS_ORDER.length - 1) return null;
    return CASE_STATUS_ORDER[idx + 1];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">All Cases</h1>
          <p className="text-sm text-surface-500 mt-1">Platform-wide case oversight across all managers and patients.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            window.open(`/api/v1/admin/export/cases?status=${statusFilter}`, '_blank');
            toast.success('Export started — check your downloads.');
          }}
        >
          ↓ Export CSV
        </Button>
      </div>

      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search patient name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Statuses' },
            ...STATUS_OPTIONS.map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] || s }))
          ]}
          placeholder="All Statuses"
          className="w-full sm:w-48"
        />
        <Select
          value={managerFilter}
          onChange={setManagerFilter}
          options={[
            { value: '', label: 'All Managers' },
            ...managers.map((m) => ({ value: m.id, label: m.fullName }))
          ]}
          placeholder="All Managers"
          className="w-full sm:w-48"
        />
        <label className="flex items-center gap-2 text-sm font-medium text-surface-700 whitespace-nowrap">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} /> Urgent
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
                  <th className="px-5 py-3 text-right text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {cases.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-surface-500">No cases found.</td></tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-surface-900">{c.patient.user.fullName}</p>
                        <p className="text-xs text-surface-400">{c.patient.user.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{c.manager?.fullName || '—'}</td>
                      <td className="px-5 py-3.5"><Badge variant={STATUS_BADGE[c.status] || 'default'}>{CASE_STATUS_LABELS[c.status] || c.status}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-600">{c._count.appointments}</td>
                      <td className="px-5 py-3.5 text-xs text-surface-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1">
                          {c.isUrgent && <Badge variant="danger" dot>Urgent</Badge>}
                          {c.escalationNote && <Badge variant="warning" dot>Escalated</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCase(c)}>Manage</Button>
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

      {/* Case Detail Drawer */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">Case Details</h3>
              <button onClick={() => setSelectedCase(null)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[10px] font-bold text-surface-400 uppercase">Patient</p><p className="text-sm font-semibold text-surface-900 mt-0.5">{selectedCase.patient.user.fullName}</p></div>
                <div><p className="text-[10px] font-bold text-surface-400 uppercase">Manager</p><p className="text-sm text-surface-600 mt-0.5">{selectedCase.manager?.fullName || 'Unassigned'}</p></div>
                <div><p className="text-[10px] font-bold text-surface-400 uppercase">Status</p><p className="mt-0.5"><Badge variant={STATUS_BADGE[selectedCase.status] || 'default'}>{CASE_STATUS_LABELS[selectedCase.status]}</Badge></p></div>
                <div><p className="text-[10px] font-bold text-surface-400 uppercase">Appointments</p><p className="text-sm text-surface-600 mt-0.5">{selectedCase._count.appointments}</p></div>
              </div>

              {selectedCase.notes && (
                <div><p className="text-[10px] font-bold text-surface-400 uppercase mb-1">Notes</p><p className="text-sm text-surface-600 bg-surface-50 p-3 rounded-lg border border-surface-200">{selectedCase.notes}</p></div>
              )}
              {selectedCase.escalationNote && (
                <div><p className="text-[10px] font-bold text-surface-400 uppercase mb-1">Escalation Note</p><p className="text-sm text-warning-700 bg-warning-50 p-3 rounded-lg border border-warning-200">{selectedCase.escalationNote}</p></div>
              )}

              {/* Status Transition */}
              {selectedCase.status !== 'CLOSED' && (
                <div className="pt-3 border-t border-surface-100 space-y-2">
                  <p className="text-xs font-bold text-surface-700">Advance Status</p>
                  {(() => {
                    const next = getNextStatus(selectedCase.status);
                    return next ? (
                      <Button size="sm" className="w-full" onClick={() => handleStatusChange(selectedCase.id, next)} isLoading={updating}>
                        Move to → {CASE_STATUS_LABELS[next]}
                      </Button>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Reassign Manager */}
              <div className="space-y-2 pt-3 border-t border-surface-100">
                <p className="text-xs font-bold text-surface-700">Reassign Manager</p>
                <Select
                  value={selectedCase.manager?.id || ''}
                  onChange={(val) => handleReassign(selectedCase.id, val)}
                  options={[
                    { value: '', label: '— Select Manager —' },
                    ...managers.map((m) => ({ value: m.id, label: m.fullName }))
                  ]}
                  placeholder="Select Manager"
                  disabled={updating}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
