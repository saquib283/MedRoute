'use client';

/**
 * Afzal Healthcare — Admin Audit Logs
 * Enhanced with date range, action filter, actor search, and CSV export.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';

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

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'ACTIVATE', 'RESET_PASSWORD', 'STATUS_CHANGE', 'REASSIGN', 'RESOLVE_ESCALATION'];
const ENTITY_OPTIONS = ['User', 'Patient', 'Case', 'Appointment', 'Hospital', 'Doctor', 'Specialisation'];

function AuditLogDiff({ oldVal, newVal }: { oldVal: unknown; newVal: unknown }) {
  const isObject = (val: unknown): val is Record<string, unknown> =>
    Boolean(val) && typeof val === 'object' && !Array.isArray(val);

  if (!oldVal && !newVal) return <span className="text-surface-400 text-xs">—</span>;

  // Handle primitive values diff
  if (!isObject(oldVal) || !isObject(newVal)) {
    return (
      <div className="text-xs space-y-1">
        {oldVal !== undefined && oldVal !== null && (
          <div className="text-danger-700 bg-danger-50 px-2.5 py-1 rounded-md border border-danger-200 line-through">
            - {String(oldVal)}
          </div>
        )}
        {newVal !== undefined && newVal !== null && (
          <div className="text-success-700 bg-success-50 px-2.5 py-1 rounded-md border border-success-200 font-medium">
            + {String(newVal)}
          </div>
        )}
      </div>
    );
  }

  const oldObj = isObject(oldVal) ? oldVal : {};
  const newObj = isObject(newVal) ? newVal : {};
  // Handle object keys diff
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  const changes = allKeys.map((key) => {
    const o = oldObj[key];
    const n = newObj[key];

    if (JSON.stringify(o) === JSON.stringify(n)) {
      return { key, type: 'unchanged', oldValue: o, newValue: n };
    }
    if (o !== undefined && n === undefined) {
      return { key, type: 'removed', oldValue: o };
    }
    if (o === undefined && n !== undefined) {
      return { key, type: 'added', newValue: n };
    }
    return { key, type: 'modified', oldValue: o, newValue: n };
  });

  return (
    <div className="border border-surface-200 rounded-md overflow-hidden text-xs bg-white divide-y divide-surface-200 w-full">
      <div className="px-3 py-2 bg-surface-100 font-medium text-surface-500 uppercase tracking-wide text-[11px] grid grid-cols-3 gap-4">
        <span>Field</span>
        <span>Before</span>
        <span>After</span>
      </div>
      {changes.map((c) => {
        if (c.type === 'unchanged') return null;
        return (
          <div key={c.key} className="px-3 py-2 grid grid-cols-3 gap-4 items-center">
            <span className="font-mono font-medium text-surface-700">{c.key}</span>
            <div className="min-w-0 break-all">
              {c.oldValue !== undefined ? (
                <span className="px-1.5 py-0.5 rounded bg-danger-50 text-danger-700 border border-danger-200 line-through font-mono">
                  {typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : String(c.oldValue)}
                </span>
              ) : (
                <span className="text-surface-300">—</span>
              )}
            </div>
            <div className="min-w-0 break-all">
              {c.newValue !== undefined ? (
                <span className="px-1.5 py-0.5 rounded bg-success-50 text-success-700 border border-success-200 font-medium font-mono">
                  {typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : String(c.newValue)}
                </span>
              ) : (
                <span className="text-surface-300">—</span>
              )}
            </div>
          </div>
        );
      })}
      {changes.every(c => c.type === 'unchanged') && (
        <div className="p-3 text-center text-surface-500">No changes detected.</div>
      )}
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/me').then(r => r.json()).then(d => {
      if (d.success) setIsSuperAdmin(d.data?.user?.role === 'ADMIN');
    }).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (entityFilter) params.set('entityType', entityFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (actorSearch) params.set('actorSearch', actorSearch);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/v1/admin/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) { setLogs(data.data.logs); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [entityFilter, actionFilter, actorSearch, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (entityFilter) params.set('entityType', entityFilter);
    if (actionFilter) params.set('action', actionFilter);
    window.open(`/api/v1/admin/audit-logs/export?${params}`, '_blank');
    toast.success('Export started — check your downloads.');
  };

  const clearFilters = () => {
    setEntityFilter('');
    setActionFilter('');
    setActorSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = entityFilter || actionFilter || actorSearch || dateFrom || dateTo;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Audit Logs</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Chronological record of all administrative actions on the platform.</p>
        </div>
        {isSuperAdmin && (
          <Button variant="secondary" onClick={handleExport}>↓ Export CSV</Button>
        )}
      </div>

      <Card padding="sm" className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by actor name..."
            value={actorSearch}
            onChange={(e) => setActorSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
          />
          <Select
            value={entityFilter}
            onChange={setEntityFilter}
            options={[
              { value: '', label: 'All Entities' },
              ...ENTITY_OPTIONS.map((e) => ({ value: e, label: e }))
            ]}
            placeholder="All Entities"
            className="w-full sm:w-48"
          />
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { value: '', label: 'All Actions' },
              ...ACTION_OPTIONS.map((a) => ({ value: a, label: a }))
            ]}
            placeholder="All Actions"
            className="w-full sm:w-48"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="w-full sm:w-48">
            <DatePicker label="From Date" value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
          </div>
          <div className="w-full sm:w-48">
            <DatePicker label="To Date" value={dateTo} onChange={setDateTo} placeholder="End date" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-surface-500 sm:mt-5">Clear Filters</Button>
          )}
        </div>
      </Card>

      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="divide-y divide-surface-200">
            {logs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-surface-500">
                No audit log entries found. {hasFilters ? 'Try adjusting your filters.' : 'Actions will be recorded here as users interact with the platform.'}
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id}>
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex items-center gap-3.5 hover:bg-surface-100/60 transition-colors text-left"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 font-semibold text-xs shrink-0">
                      {log.actor.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800">
                        <span className="font-medium text-surface-900">{log.actor.fullName}</span>{' '}
                        <Badge variant="default" size="sm" className="mx-1">{log.action}</Badge>{' '}
                        <span className="font-medium text-surface-700">{log.entityType}</span>{' '}
                        <span className="text-surface-500 text-xs tabular-nums">({log.entityId.substring(0, 8)}…)</span>
                      </p>
                      <p className="text-xs text-surface-500 tabular-nums mt-0.5">
                        {new Date(log.createdAt).toLocaleString()} {log.ipAddress && `• IP: ${log.ipAddress}`}
                      </p>
                    </div>
                    <Badge variant="default" size="sm">{log.actor.role}</Badge>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {expandedId === log.id && (
                    <div className="px-5 pb-5">
                      <p className="text-xs font-medium text-surface-500 mb-2">Change details</p>
                      <AuditLogDiff oldVal={log.oldValue} newVal={log.newValue} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-surface-500 tabular-nums">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
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
