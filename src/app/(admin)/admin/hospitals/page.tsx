'use client';

/**
 * Afzal Healthcare — Admin Hospitals Management
 * CRUD for hospital partners with search, filters, deactivation, and toast notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';

interface Hospital {
  id: string;
  name: string;
  city: string;
  address: string;
  accreditation: string | null;
  contactPerson: string | null;
  commissionRate: number | null;
  departments: string[];
  isActive: boolean;
  _count: { doctors: number; appointments: number };
}

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [userRole, setUserRole] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'hospitals' | 'overrides'>('hospitals');

  // Overrides State
  const [overrides, setOverrides] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    rate: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    accreditation: '',
    contactPerson: '',
    commissionRate: '',
    departments: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Deactivate state
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [deactivating, setDeactivating] = useState(false);

  // Fetch role on mount
  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) setUserRole(d.data?.user?.role || '');
      })
      .catch(() => {});
  }, []);

  const fetchOverrides = useCallback(async (hospitalId: string) => {
    if (!hospitalId) {
      setOverrides([]);
      return;
    }
    setLoadingOverrides(true);
    try {
      const res = await fetch(`/api/v1/admin/hospitals/overrides?hospitalId=${hospitalId}`);
      const data = await res.json();
      if (data.success) {
        setOverrides(data.data.overrides);
      }
    } catch {
      toast.error('Failed to load commission overrides');
    } finally {
      setLoadingOverrides(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHospitalId) {
      fetchOverrides(selectedHospitalId);
    }
  }, [selectedHospitalId, fetchOverrides]);

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) {
      toast.error('Please select a hospital');
      return;
    }
    if (!overrideForm.rate || !overrideForm.startDate || !overrideForm.endDate) {
      toast.error('Please fill in all override fields');
      return;
    }
    setSavingOverride(true);
    try {
      const res = await fetch('/api/v1/admin/hospitals/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: selectedHospitalId,
          rate: parseFloat(overrideForm.rate),
          startDate: overrideForm.startDate,
          endDate: overrideForm.endDate,
          notes: overrideForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Commission override applied successfully');
        setOverrideForm({ rate: '', startDate: '', endDate: '', notes: '' });
        fetchOverrides(selectedHospitalId);
      } else {
        toast.error(data.error?.message || 'Failed to apply override');
      }
    } catch {
      toast.error('An error occurred.');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and remove this commission override?')) return;
    try {
      const res = await fetch(`/api/v1/admin/hospitals/overrides?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Override removed successfully');
        fetchOverrides(selectedHospitalId);
      } else {
        toast.error(data.error?.message || 'Failed to delete override');
      }
    } catch {
      toast.error('Failed to delete override');
    }
  };

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (cityFilter) params.set('city', cityFilter);

      const res = await fetch(`/api/v1/admin/hospitals?${params}`);
      const data = await res.json();
      if (data.success) {
        setHospitals(data.data.hospitals);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load hospitals');
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      city: '',
      address: '',
      accreditation: '',
      contactPerson: '',
      commissionRate: '',
      departments: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (h: Hospital) => {
    setEditing(h);
    setForm({
      name: h.name,
      city: h.city,
      address: h.address,
      accreditation: h.accreditation || '',
      contactPerson: h.contactPerson || '',
      commissionRate: h.commissionRate?.toString() || '',
      departments: Array.isArray(h.departments) ? h.departments.join(', ') : '',
      isActive: h.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        city: form.city,
        address: form.address,
        accreditation: form.accreditation || undefined,
        contactPerson: form.contactPerson || undefined,
        commissionRate: form.commissionRate ? parseFloat(form.commissionRate) : undefined,
        departments: form.departments
          ? form.departments
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
          : [],
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;

      const res = await fetch('/api/v1/admin/hospitals', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save hospital');
        return;
      }
      toast.success(editing ? 'Hospital updated successfully' : 'Hospital created successfully');
      setShowModal(false);
      fetchHospitals();
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/v1/admin/hospitals?id=${deactivateConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to deactivate hospital');
        return;
      }
      toast.success('Hospital deactivated successfully');
      setDeactivateConfirm({ open: false, id: '', name: '' });
      fetchHospitals();
    } catch {
      toast.error('An error occurred.');
    } finally {
      setDeactivating(false);
    }
  };  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Hospitals</h1>
          <p className="text-sm text-surface-500 mt-1">Manage hospital partners, commissions, and overrides.</p>
        </div>
        <Button onClick={openCreate}>+ Add Hospital</Button>
      </div>

      {/* Tabs */}
      {userRole === 'ADMIN' && (
        <div className="flex border-b border-surface-200 gap-4">
          <button
            onClick={() => setActiveTab('hospitals')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'hospitals'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Hospitals Directory
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'overrides'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Commission Overrides
          </button>
        </div>
      )}

      {activeTab === 'hospitals' ? (
        <>
          {/* Filters */}
          <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by hospital name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <Button variant="secondary" size="sm" onClick={() => fetchHospitals()}>
              Search
            </Button>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : hospitals.length === 0 ? (
              <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-12 text-center text-sm text-surface-500 bg-white">
                No hospitals found.
              </div>
            ) : (
              hospitals.map((h) => (
                <Card key={h.id} className="p-5 bg-white border border-surface-200 flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-surface-900 text-lg">{h.name}</h3>
                    <Badge variant={h.isActive ? 'success' : 'danger'} dot>
                      {h.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-surface-500 mb-3">
                    {h.city} • {h.accreditation || 'No accreditation'}
                  </p>
                  <div className="text-xs text-surface-600 bg-surface-50 p-3 rounded-lg border border-surface-200 space-y-1 mb-4">
                    <p>
                      <span className="font-semibold">Doctors:</span> {h._count.doctors} • <span className="font-semibold">Appointments:</span>{' '}
                      {h._count.appointments}
                    </p>
                    {h.commissionRate && (
                      <p>
                        <span className="font-semibold">Commission:</span> {Number(h.commissionRate)}%
                      </p>
                    )}
                    {Array.isArray(h.departments) && h.departments.length > 0 && (
                      <p>
                        <span className="font-semibold">Depts:</span> {h.departments.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-surface-100 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(h)}>
                      Edit
                    </Button>
                    {h.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600 hover:text-danger-700"
                        onClick={() => setDeactivateConfirm({ open: true, id: h.id, name: h.name })}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      ) : (
        /* Commission Overrides Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 bg-white border border-surface-200 space-y-4">
              <h3 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-2.5 uppercase tracking-wider">Configure Rate Override</h3>
              
              <Select
                label="Select Hospital"
                value={selectedHospitalId}
                onChange={setSelectedHospitalId}
                options={[
                  { value: '', label: 'Choose hospital...' },
                  ...hospitals.map((h) => ({
                    value: h.id,
                    label: `${h.name} (${h.city})`
                  }))
                ]}
                required
              />

              {selectedHospitalId && (
                <form onSubmit={handleAddOverride} className="space-y-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-surface-700 uppercase">Override Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 12.5"
                      value={overrideForm.rate}
                      onChange={(e) => setOverrideForm({ ...overrideForm, rate: e.target.value })}
                      className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>

                  <DatePicker
                    label="Override Start Date"
                    value={overrideForm.startDate}
                    onChange={(startDate) => setOverrideForm({ ...overrideForm, startDate })}
                    placeholder="Pick start date"
                    required
                  />

                  <DatePicker
                    label="Override End Date"
                    value={overrideForm.endDate}
                    onChange={(endDate) => setOverrideForm({ ...overrideForm, endDate })}
                    placeholder="Pick end date"
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-surface-700 uppercase">Override Reason / Notes</label>
                    <textarea
                      placeholder="e.g., Promotional wellness package rate."
                      value={overrideForm.notes}
                      onChange={(e) => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                      className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-h-[80px]"
                    />
                  </div>

                  <Button type="submit" isLoading={savingOverride} className="w-full justify-center">
                    Apply Commission Override
                  </Button>
                </form>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-6 bg-white border border-surface-200 space-y-4">
              <h3 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-2.5 uppercase tracking-wider">Active & Scheduled Overrides</h3>
              
              {!selectedHospitalId ? (
                <p className="text-sm text-surface-500 text-center py-12">Please select a hospital from the left panel to manage overrides.</p>
              ) : loadingOverrides ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : overrides.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-12">No commission overrides configured for this hospital.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-surface-100 bg-surface-50">
                        <th className="px-4 py-2.5 font-bold text-surface-600">Rate (%)</th>
                        <th className="px-4 py-2.5 font-bold text-surface-600">Start Date</th>
                        <th className="px-4 py-2.5 font-bold text-surface-600">End Date</th>
                        <th className="px-4 py-2.5 font-bold text-surface-600">Notes</th>
                        <th className="px-4 py-2.5 font-bold text-surface-600 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 font-medium">
                      {overrides.map((o) => (
                        <tr key={o.id} className="hover:bg-surface-50">
                          <td className="px-4 py-3 font-mono font-bold text-primary-700">{Number(o.rate)}%</td>
                          <td className="px-4 py-3 text-surface-600">{new Date(o.startDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-surface-600">{new Date(o.endDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-surface-500 italic max-w-[150px] truncate" title={o.notes}>{o.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteOverride(o.id)}
                              className="text-danger-600 hover:text-danger-700 font-bold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">{editing ? 'Edit Hospital' : 'Add Hospital'}</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">City</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Accreditation</label>
                  <input
                    type="text"
                    value={form.accreditation}
                    onChange={(e) => setForm({ ...form, accreditation: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Address</label>
                <textarea
                  rows={2}
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Contact Person</label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Commission %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.commissionRate}
                    onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Departments (comma-separated)</label>
                <input
                  type="text"
                  value={form.departments}
                  onChange={(e) => setForm({ ...form, departments: e.target.value })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                  placeholder="Cardiology, Neurology, Orthopaedics"
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hospActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <label htmlFor="hospActive" className="text-sm font-medium text-surface-700">
                    Active
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={saving}>
                  {editing ? 'Save' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Deactivation */}
      <ConfirmDialog
        open={deactivateConfirm.open}
        title="Deactivate Hospital"
        message={`Are you sure you want to deactivate "${deactivateConfirm.name}"? Active cases and schedules may be affected.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
