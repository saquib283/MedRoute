'use client';

/**
 * Afzal Healthcare — Escalation Queue
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
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/escalations?page=${page}&limit=15`);
      const data = await res.json();
      if (data.success) { setEscalations(data.data.escalations); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchEscalations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEscalations]);

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Escalation Queue</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Cases escalated by managers that require administrative intervention.</p>
        </div>
      </div>

      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : escalations.length === 0 ? (
          <div className="px-6 py-16 text-center max-w-md mx-auto">
            <div className="w-10 h-10 rounded-md bg-success-50 border border-success-200 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-surface-900">No pending escalations</p>
            <p className="text-xs text-surface-500 mt-1">All escalated cases have been resolved.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {escalations.map((e) => (
              <div key={e.id} className="px-5 py-4 hover:bg-surface-100/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-surface-900">{e.patient.user.fullName}</p>
                      {e.isUrgent && <Badge variant="danger" dot>Urgent</Badge>}
                      <Badge variant="default">{CASE_STATUS_LABELS[e.status] || e.status}</Badge>
                    </div>
                    <p className="text-xs text-surface-500 tabular-nums">Manager: {e.manager?.fullName || 'Unassigned'} • {new Date(e.createdAt).toLocaleDateString()}</p>
                    {e.escalationNote && (
                      <div className="mt-2.5 p-3 bg-warning-50 border border-warning-200 rounded-md">
                        <p className="text-xs font-medium text-warning-700 mb-0.5">Escalation note</p>
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
          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-surface-500 tabular-nums">Page {pagination.page} of {pagination.totalPages}</span>
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
