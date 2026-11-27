'use client';

/**
 * MediRoute India — Admin Patient Management
 * Paginated patient list with search, filters, and manager reassignment.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { URGENCY_LEVEL_LABELS } from '@/lib/constants';

interface Patient {
  id: string;
  nationality: string;
  urgencyLevel: string;
  primaryLanguage: string | null;
  createdAt: string;
  user: { fullName: string; email: string; phone: string | null; isActive: boolean; createdAt: string };
  assignedManager: { id?: string; fullName: string } | null;
  _count: { cases: number; documents: number; appointments: number };
}

interface ManagerOption { id: string; fullName: string; }

const URGENCY_OPTIONS = ['ROUTINE', 'SEMI_URGENT', 'URGENT'];
const URGENCY_BADGE: Record<string, 'default' | 'warning' | 'danger'> = {
  ROUTINE: 'default', SEMI_URGENT: 'warning', URGENT: 'danger',
};

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Detail drawer
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [reassignManagerId, setReassignManagerId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchPatients = useCallback(async (page = 1) => {
    await Promise.resolve();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (urgencyFilter) params.set('urgency', urgencyFilter);
      if (managerFilter) params.set('managerId', managerFilter);
      const res = await fetch(`/api/v1/admin/patients?${params}`);
      const data = await res.json();
      if (data.success) {
        setPatients(data.data.patients);
        setPagination(data.data.pagination);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [search, urgencyFilter, managerFilter]);

  useEffect(() => { queueMicrotask(() => fetchPatients()); }, [fetchPatients]);

  useEffect(() => {
    // Fetch managers for filter + reassignment
    fetch('/api/v1/admin/users?role=MANAGER&limit=100')
      .then(r => r.json())
      .then(d => { if (d.success) setManagers(d.data.users.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName }))); })
      .catch(() => {});
  }, []);

  const handleReassign = async () => {
    if (!selectedPatient) return;
    setReassigning(true);
    try {
      const res = await fetch('/api/v1/admin/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedPatient.id, assignedManagerId: reassignManagerId || null }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed'); return; }
      toast.success('Manager reassigned successfully');
      setSelectedPatient(null);
      fetchPatients(pagination.page);
    } catch { toast.error('Failed to reassign manager.'); } finally { setReassigning(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Patients</h1>
        <p className="text-sm text-surface-500 mt-1">Manage registered patients and their assignments.</p>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search name, email, nationality..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <Select
          value={urgencyFilter}
          onChange={setUrgencyFilter}
          options={[
            { value: '', label: 'All Urgency' },
            ...URGENCY_OPTIONS.map((u) => ({ value: u, label: URGENCY_LEVEL_LABELS[u] || u }))
          ]}
          placeholder="All Urgency"
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
        <Button variant="secondary" size="sm" onClick={() => fetchPatients()}>Search</Button>
      </Card>

      {/* Table */}
      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Nationality</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Urgency</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Manager</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Cases</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {patients.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-surface-500">No patients found.</td></tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-surface-900">{p.user.fullName}</p>
                        <p className="text-xs text-surface-400">{p.user.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{p.nationality}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={URGENCY_BADGE[p.urgencyLevel] || 'default'}>{URGENCY_LEVEL_LABELS[p.urgencyLevel] || p.urgencyLevel}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{p.assignedManager?.fullName || '—'}</td>
                      <td className="px-5 py-3.5 text-surface-600">{p._count.cases}</td>
                      <td className="px-5 py-3.5 text-xs text-surface-500">{new Date(p.user.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(p); setReassignManagerId(p.assignedManager?.id || ''); }}>View</Button>
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
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchPatients(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchPatients(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Patient Detail Modal */}
      <Modal
        open={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        title="Patient Details"
        subtitle={selectedPatient?.user.fullName}
        maxWidth="lg"
      >
        {selectedPatient && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Name</p><p className="text-sm font-semibold text-surface-900 mt-0.5">{selectedPatient.user.fullName}</p></div>
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Email</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.user.email}</p></div>
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Nationality</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.nationality}</p></div>
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Language</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.primaryLanguage || '—'}</p></div>
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Urgency</p><p className="mt-0.5"><Badge variant={URGENCY_BADGE[selectedPatient.urgencyLevel] || 'default'}>{URGENCY_LEVEL_LABELS[selectedPatient.urgencyLevel]}</Badge></p></div>
              <div><p className="text-[11px] font-semibold text-surface-500 uppercase">Status</p><p className="mt-0.5"><Badge variant={selectedPatient.user.isActive ? 'success' : 'danger'} dot>{selectedPatient.user.isActive ? 'Active' : 'Inactive'}</Badge></p></div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 bg-surface-50 rounded-lg border border-surface-200">
              <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.cases}</p><p className="text-[11px] text-surface-500 font-semibold uppercase">Cases</p></div>
              <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.appointments}</p><p className="text-[11px] text-surface-500 font-semibold uppercase">Appts</p></div>
              <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.documents}</p><p className="text-[11px] text-surface-500 font-semibold uppercase">Docs</p></div>
            </div>

            <div className="space-y-2 pt-2 border-t border-surface-200">
              <p className="text-xs font-semibold text-surface-700">Assigned Coordinator</p>
              <p className="text-sm text-surface-600">{selectedPatient.assignedManager?.fullName || 'Unassigned'}</p>
              <Select
                value={reassignManagerId}
                onChange={setReassignManagerId}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...managers.map((m) => ({ value: m.id, label: m.fullName }))
                ]}
                placeholder="Select Coordinator"
              />
              <Button size="sm" className="w-full" onClick={handleReassign} isLoading={reassigning}>Reassign Coordinator</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
