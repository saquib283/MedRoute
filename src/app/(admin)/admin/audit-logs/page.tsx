'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { fullName: string; role: string; email: string };
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (entityFilter) params.set('entityType', entityFilter);
      const res = await fetch(`/api/v1/admin/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) { setLogs(data.data.logs); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Audit Logs</h1>
        <p className="text-sm text-surface-500 mt-1">Chronological record of all administrative actions on the platform.</p>
      </div>

      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-lg text-sm flex-1">
          <option value="">All Entity Types</option>
          <option value="User">User</option>
          <option value="Case">Case</option>
          <option value="Appointment">Appointment</option>
          <option value="Hospital">Hospital</option>
          <option value="Doctor">Doctor</option>
          <option value="Hostel">Hostel</option>
        </select>
      </Card>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="divide-y divide-surface-100">
            {logs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-surface-500">
                No audit log entries found. Actions will be recorded here as users interact with the platform.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id}>
                  <button
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors text-left"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-600 font-bold text-xs shrink-0">
                      {log.actor.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800">
                        <span className="font-semibold">{log.actor.fullName}</span>{' '}
                        <span className="text-surface-500">{log.action}</span>{' '}
                        <span className="font-medium">{log.entityType}</span>{' '}
                        <span className="text-surface-400 text-xs">({log.entityId.substring(0, 8)}…)</span>
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleString()} {log.ipAddress && `• IP: ${log.ipAddress}`}
                      </p>
                    </div>
                    <Badge variant="default" className="text-[10px]">{log.actor.role}</Badge>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {expandedId === log.id && (
                    <div className="px-6 pb-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">Old Value</p>
                        <pre className="text-xs bg-red-50 text-red-800 p-3 rounded-lg overflow-x-auto max-h-48">{log.oldValue ? JSON.stringify(log.oldValue, null, 2) : '—'}</pre>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">New Value</p>
                        <pre className="text-xs bg-green-50 text-green-800 p-3 rounded-lg overflow-x-auto max-h-48">{log.newValue ? JSON.stringify(log.newValue, null, 2) : '—'}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLogs(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
