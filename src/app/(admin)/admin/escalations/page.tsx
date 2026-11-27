'use client';

/**
 * MediRoute India — Escalation Queue
 * Cases with escalation notes that need admin attention.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { CASE_STATUS_LABELS } from '@/lib/constants';

interface Escalation {
  id: string;
  status: string;
  isUrgent: boolean;
  escalationNote: string | null;
  createdAt: string;
  patient: { user: { fullName: string; email: string } };
  manager: { fullName: string } | null;
}

export default function AdminEscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const [resolveConfirm, setResolveConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [resolving, setResolving] = useState(false);

  const fetchEscalations = useCallback(async (page = 1) => {
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/escalations?page=${page}&limit=15`);
      const data = await res.json();
      if (data.success) { setEscalations(data.data.escalations); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchEscalations()); }, [fetchEscalations]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch('/api/v1/admin/escalations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resolveConfirm.id, clearEscalation: true }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed'); return; }
      toast.success('Escalation resolved');
      setResolveConfirm({ open: false, id: '', name: '' });
      fetchEscalations(pagination.page);
    } catch { toast.error('Failed to resolve.'); } finally { setResolving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Escalation Queue</h1>
        <p className="text-sm text-surface-500 mt-1">Cases escalated by managers that require admin intervention.</p>
      </div>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : escalations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-surface-700">No pending escalations</p>
            <p className="text-xs text-surface-500 mt-1">All escalated cases have been resolved.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {escalations.map((e) => (
              <div key={e.id} className="px-6 py-4 hover:bg-surface-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-surface-900">{e.patient.user.fullName}</p>
                      {e.isUrgent && <Badge variant="danger" dot>Urgent</Badge>}
                      <Badge variant="default">{CASE_STATUS_LABELS[e.status] || e.status}</Badge>
                    </div>
                    <p className="text-xs text-surface-500">Manager: {e.manager?.fullName || 'Unassigned'} • {new Date(e.createdAt).toLocaleDateString()}</p>
                    {e.escalationNote && (
                      <div className="mt-2 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                        <p className="text-xs font-bold text-warning-700 uppercase mb-0.5">Escalation Note</p>
                        <p className="text-sm text-warning-800">{e.escalationNote}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setResolveConfirm({ open: true, id: e.id, name: e.patient.user.fullName })}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchEscalations(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchEscalations(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={resolveConfirm.open}
        title="Resolve Escalation"
        message={`Mark the escalation for "${resolveConfirm.name}" as resolved? This will clear the escalation note.`}
        confirmLabel="Resolve"
        variant="warning"
        loading={resolving}
        onConfirm={handleResolve}
        onCancel={() => setResolveConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
