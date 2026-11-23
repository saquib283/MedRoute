'use client';

/**
 * Afzal Healthcare — Admin Patient Management
 * Paginated patient list with search, filters, and manager reassignment.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { URGENCY_LEVEL_LABELS } from '@/lib/constants';

interface Patient {
  id: string;
  nationality: string;
  urgencyLevel: string;
  primaryLanguage: string | null;
  createdAt: string;
  user: { fullName: string; email: string; phone: string | null; isActive: boolean; createdAt: string };
  assignedManager: { id: string; fullName: string; email?: string } | null;
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

  // Onboard modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    nationality: '',
    passportNo: '',
    dob: '',
    urgencyLevel: 'ROUTINE',
    assignedManagerId: '',
    medicalCondition: '',
  });

  const fetchPatients = useCallback(async (page = 1) => {
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

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  useEffect(() => {
    // Fetch managers for filter + reassignment
    fetch('/api/v1/admin/users?role=MANAGER&limit=100')
      .then(r => r.json())
      .then(d => { if (d.success) setManagers(d.data.users.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName }))); })
      .catch(() => {});
  }, []);

  const handleOnboardPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboarding(true);
    try {
      const payload = {
        fullName: onboardForm.fullName.trim(),
        email: onboardForm.email.trim(),
        password: onboardForm.password,
        phone: onboardForm.phone.trim() || undefined,
        nationality: onboardForm.nationality.trim(),
        passportNo: onboardForm.passportNo.trim(),
        dob: onboardForm.dob,
        urgencyLevel: onboardForm.urgencyLevel,
        assignedManagerId: onboardForm.assignedManagerId || undefined,
        medicalCondition: onboardForm.medicalCondition.trim() || undefined,
      };
      const res = await fetch('/api/v1/admin/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to onboard patient');
        return;
      }
      toast.success('Patient onboarded with initial case created');
      setShowOnboardModal(false);
      setOnboardForm({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        nationality: '',
        passportNo: '',
        dob: '',
        urgencyLevel: 'ROUTINE',
        assignedManagerId: '',
        medicalCondition: '',
      });
      fetchPatients(1);
    } catch {
      toast.error('Failed to onboard patient.');
    } finally {
      setOnboarding(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Patients</h1>
          <p className="text-sm text-surface-500 mt-1">Manage registered patients and their assignments.</p>
        </div>
        <Button onClick={() => setShowOnboardModal(true)}>+ Onboard Patient</Button>
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

      {/* Patient Detail Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">Patient Details</h3>
              <button
                onClick={() => setSelectedPatient(null)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-surface-500 uppercase">Name</p><p className="text-sm font-semibold text-surface-900 mt-0.5">{selectedPatient.user.fullName}</p></div>
                <div><p className="text-xs font-bold text-surface-500 uppercase">Email</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.user.email}</p></div>
                <div><p className="text-xs font-bold text-surface-500 uppercase">Nationality</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.nationality}</p></div>
                <div><p className="text-xs font-bold text-surface-500 uppercase">Language</p><p className="text-sm text-surface-600 mt-0.5">{selectedPatient.primaryLanguage || '—'}</p></div>
                <div><p className="text-xs font-bold text-surface-500 uppercase">Urgency</p><p className="mt-0.5"><Badge variant={URGENCY_BADGE[selectedPatient.urgencyLevel] || 'default'}>{URGENCY_LEVEL_LABELS[selectedPatient.urgencyLevel]}</Badge></p></div>
                <div><p className="text-xs font-bold text-surface-500 uppercase">Status</p><p className="mt-0.5"><Badge variant={selectedPatient.user.isActive ? 'success' : 'danger'} dot>{selectedPatient.user.isActive ? 'Active' : 'Inactive'}</Badge></p></div>
              </div>
              <div className="grid grid-cols-3 gap-4 p-3 bg-surface-50 rounded-lg border border-surface-200">
                <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.cases}</p><p className="text-xs text-surface-500 font-semibold uppercase">Cases</p></div>
                <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.appointments}</p><p className="text-xs text-surface-500 font-semibold uppercase">Appts</p></div>
                <div className="text-center"><p className="text-lg font-bold text-surface-900">{selectedPatient._count.documents}</p><p className="text-xs text-surface-500 font-semibold uppercase">Docs</p></div>
              </div>

              {/* Reassign Manager */}
              <div className="space-y-2 pt-2 border-t border-surface-100">
                <p className="text-xs font-bold text-surface-700">Assigned Manager</p>
                <p className="text-sm text-surface-600">{selectedPatient.assignedManager?.fullName || 'No manager assigned'}</p>
                <Select
                  value={reassignManagerId}
                  onChange={setReassignManagerId}
                  options={[
                    { value: '', label: '— No Manager —' },
                    ...managers.map((m) => ({ value: m.id, label: m.fullName }))
                  ]}
                  placeholder="Select Manager"
                />
                <Button size="sm" className="w-full" onClick={handleReassign} isLoading={reassigning}>Reassign Manager</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Patient Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">Onboard New Patient</h3>
              <button
                onClick={() => setShowOnboardModal(false)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleOnboardPatient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.fullName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, fullName: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={onboardForm.password}
                    onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Phone</label>
                  <input
                    type="text"
                    value={onboardForm.phone}
                    onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Nationality *</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.nationality}
                    onChange={(e) => setOnboardForm({ ...onboardForm, nationality: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Passport No *</label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={onboardForm.passportNo}
                    onChange={(e) => setOnboardForm({ ...onboardForm, passportNo: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={onboardForm.dob}
                    onChange={(e) => setOnboardForm({ ...onboardForm, dob: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Urgency Level"
                  value={onboardForm.urgencyLevel}
                  onChange={(val) => setOnboardForm({ ...onboardForm, urgencyLevel: val })}
                  options={URGENCY_OPTIONS.map((u) => ({ value: u, label: URGENCY_LEVEL_LABELS[u] || u }))}
                  required
                />
                <Select
                  label="Assigned Coordinator"
                  value={onboardForm.assignedManagerId}
                  onChange={(val) => setOnboardForm({ ...onboardForm, assignedManagerId: val })}
                  options={[
                    { value: '', label: 'Auto-assign (least loaded)' },
                    ...managers.map((m) => ({ value: m.id, label: m.fullName })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Medical Condition / Initial Case Notes</label>
                <textarea
                  rows={3}
                  value={onboardForm.medicalCondition}
                  onChange={(e) => setOnboardForm({ ...onboardForm, medicalCondition: e.target.value })}
                  placeholder="Diagnosis, treatment inquiry, or triage notes..."
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowOnboardModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={onboarding}>Onboard Patient</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
