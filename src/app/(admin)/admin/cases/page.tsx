'use client';

/**
 * Afzal Healthcare — Admin Cases Management
 * Full case oversight with search, filters, status transitions, and manager reassignment.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { CaseDocumentsManagerPanel } from '@/components/clinical/CaseDocumentsManagerPanel';
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

const STATUS_OPTIONS = CASE_STATUS_ORDER;
const STATUS_BADGE: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'info' | 'default'> = {
  INQUIRY_RECEIVED: 'info',
  UNDER_REVIEW: 'warning',
  PRE_OP_CLEARANCE: 'info',
  PLAN_CONFIRMED: 'primary',
  IN_TREATMENT: 'warning',
  ICU_RECOVERY: 'danger',
  WARD_RECOVERY: 'warning',
  POST_TREATMENT: 'success',
  OUTPATIENT_RECUPERATION: 'info',
  FIT_TO_FLY_CLEARED: 'success',
  REMOTE_REHAB: 'primary',
  CLOSED: 'default',
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

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCases();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCases]);

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">All Cases</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Platform-wide case oversight across all managers and patients.</p>
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

      <Card padding="sm" className="flex flex-col sm:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search patient name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:flex-1 px-3 py-2 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
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
        <label className="flex items-center gap-2 text-sm font-medium text-surface-700 whitespace-nowrap self-start sm:self-center">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} className="rounded accent-primary-600" /> Urgent
        </label>
      </Card>

      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Manager</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Status</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Appts</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Created</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Flags</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {cases.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-surface-500">No cases found.</td></tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-100/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-surface-900">{c.patient.user.fullName}</p>
                        <p className="text-xs text-surface-500">{c.patient.user.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{c.manager?.fullName || '—'}</td>
                      <td className="px-5 py-3.5"><Badge variant={STATUS_BADGE[c.status] || 'default'}>{CASE_STATUS_LABELS[c.status] || c.status}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-600 tabular-nums">{c._count.appointments}</td>
                      <td className="px-5 py-3.5 text-xs text-surface-600 tabular-nums">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1">
                          {c.isUrgent && <Badge variant="danger" dot>Urgent</Badge>}
                          {c.escalationNote && <Badge variant="warning" dot>Escalated</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/cases/${c.id}`}
                            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 shadow-2xs transition-colors whitespace-nowrap"
                          >
                            Open Case Workspace
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCase(c)}>
                            Manage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-surface-500 tabular-nums">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchCases(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchCases(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm sm:text-base font-semibold text-surface-900">Case details</h3>
              <button
                onClick={() => setSelectedCase(null)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-md hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-surface-500">Patient</p><p className="text-sm font-medium text-surface-900 mt-0.5">{selectedCase.patient.user.fullName}</p></div>
                <div><p className="text-xs font-medium text-surface-500">Manager</p><p className="text-sm text-surface-700 mt-0.5">{selectedCase.manager?.fullName || 'Unassigned'}</p></div>
                <div><p className="text-xs font-medium text-surface-500">Status</p><p className="mt-0.5"><Badge variant={STATUS_BADGE[selectedCase.status] || 'default'}>{CASE_STATUS_LABELS[selectedCase.status] || selectedCase.status}</Badge></p></div>
                <div><p className="text-xs font-medium text-surface-500">Appointments</p><p className="text-sm text-surface-700 tabular-nums mt-0.5">{selectedCase._count.appointments}</p></div>
              </div>

              {selectedCase.notes && (
                <div><p className="text-xs font-medium text-surface-500 mb-1">Notes</p><p className="text-sm text-surface-700 bg-surface-100 p-3 rounded-md border border-surface-200">{selectedCase.notes}</p></div>
              )}
              {selectedCase.escalationNote && (
                <div><p className="text-xs font-medium text-warning-700 mb-1">Escalation note</p><p className="text-sm text-warning-800 bg-warning-50 p-3 rounded-md border border-warning-200">{selectedCase.escalationNote}</p></div>
              )}

              {/* Status Transition */}
              {selectedCase.status !== 'CLOSED' && (
                <div className="pt-4 border-t border-surface-200 space-y-2">
                  <p className="text-xs font-medium text-surface-700">Advance status</p>
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
              <div className="space-y-2 pt-4 border-t border-surface-200">
                <p className="text-xs font-medium text-surface-700">Reassign manager</p>
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

              {/* Clinical Workspace & Pathway Navigation */}
              <div className="pt-4 border-t border-surface-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Link
                  href={`/admin/cases/${selectedCase.id}`}
                  className="inline-flex items-center justify-center w-full min-h-11 px-4 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 border border-primary-700/20 shadow-2xs transition-colors"
                >
                  Open Case Workspace
                </Link>
                <Link
                  href={`/admin/cases/${selectedCase.id}/pathway`}
                  className="inline-flex items-center justify-center w-full min-h-11 px-4 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors"
                >
                  Configure Clinical Pathway
                </Link>
              </div>

              {/* Case Documents Verification & Official Certificate Issuance */}
              <div className="pt-4 border-t border-surface-200">
                <CaseDocumentsManagerPanel key={selectedCase.id} caseId={selectedCase.id} canVerify />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
