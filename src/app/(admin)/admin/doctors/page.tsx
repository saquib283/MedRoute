'use client';

/**
 * Afzal Healthcare — Admin Doctors Management
 * CRUD for doctors with search, filters, deactivation, and toast notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { DAYS_OF_WEEK } from '@/lib/constants';

interface Doctor {
  id: string;
  fullName: string;
  qualification: string | null;
  consultationFee: number | null;
  availableDays: string[];
  languages: string[];
  isActive: boolean;
  hospital: { name: string; city: string };
  specialisation: { name: string };
  user: { email: string } | null;
  _count: { appointments: number };
}

interface HospitalOption {
  id: string;
  name: string;
  city: string;
}

interface SpecOption {
  id: string;
  name: string;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [specs, setSpecs] = useState<SpecOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    hospitalId: '',
    specialisationId: '',
    qualification: '',
    consultationFee: '',
    availableDays: [] as string[],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Deactivate confirmation
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [deactivating, setDeactivating] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/doctors');
      const data = await res.json();
      if (data.success) {
        let list: Doctor[] = data.data.doctors;
        if (search) {
          list = list.filter((d) => d.fullName.toLowerCase().includes(search.toLowerCase()));
        }
        if (hospitalFilter) {
          list = list.filter((d) => d.hospital.name === hospitalFilter);
        }
        if (specFilter) {
          list = list.filter((d) => d.specialisation.name === specFilter);
        }
        setDoctors(list);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }, [search, hospitalFilter, specFilter]);

  const fetchMeta = async () => {
    try {
      const [hRes, sRes] = await Promise.all([fetch('/api/v1/admin/hospitals'), fetch('/api/v1/admin/specialisations')]);
      const [hData, sData] = await Promise.all([hRes.json(), sRes.json()]);
      if (hData.success) setHospitals(hData.data.hospitals);
      if (sData.success) setSpecs(sData.data.specialisations);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchMeta();
  }, [fetchDoctors]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      fullName: '',
      hospitalId: hospitals[0]?.id || '',
      specialisationId: specs[0]?.id || '',
      qualification: '',
      consultationFee: '',
      availableDays: [],
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (d: Doctor) => {
    setEditing(d);
    setForm({
      fullName: d.fullName,
      hospitalId: '',
      specialisationId: '',
      qualification: d.qualification || '',
      consultationFee: d.consultationFee?.toString() || '',
      availableDays: Array.isArray(d.availableDays) ? d.availableDays : [],
      isActive: d.isActive,
    });
    setShowModal(true);
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        qualification: form.qualification || undefined,
        consultationFee: form.consultationFee ? parseFloat(form.consultationFee) : undefined,
        availableDays: form.availableDays,
        isActive: form.isActive,
      };
      if (!editing) {
        payload.hospitalId = form.hospitalId;
        payload.specialisationId = form.specialisationId;
      }
      if (editing) payload.id = editing.id;

      const res = await fetch('/api/v1/admin/doctors', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save doctor');
        return;
      }
      toast.success(editing ? 'Doctor updated successfully' : 'Doctor created successfully');
      setShowModal(false);
      fetchDoctors();
    } catch (err) {
      console.error(err);
      toast.error('An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/v1/admin/doctors?id=${deactivateConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to deactivate doctor');
        return;
      }
      toast.success('Doctor deactivated successfully');
      setDeactivateConfirm({ open: false, id: '', name: '' });
      fetchDoctors();
    } catch {
      toast.error('An error occurred.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Doctors</h1>
          <p className="text-sm text-surface-500 mt-1">Manage doctors, qualifications, fees, and weekly schedule availability.</p>
        </div>
        <Button onClick={openCreate}>+ Add Doctor</Button>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by doctor name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <Select
          value={hospitalFilter}
          onChange={setHospitalFilter}
          options={[
            { value: '', label: 'All Hospitals' },
            ...hospitals.map((h) => ({ value: h.name, label: h.name }))
          ]}
          placeholder="All Hospitals"
          className="w-full sm:w-48"
        />
        <Select
          value={specFilter}
          onChange={setSpecFilter}
          options={[
            { value: '', label: 'All Specialisations' },
            ...specs.map((s) => ({ value: s.name, label: s.name }))
          ]}
          placeholder="All Specialisations"
          className="w-full sm:w-48"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchDoctors()}>
          Search
        </Button>
      </Card>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Hospital</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Specialisation</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Fee</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Appts</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-surface-500">
                      No doctors found.
                    </td>
                  </tr>
                ) : (
                  doctors.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-surface-900">{d.fullName}</p>
                        <p className="text-xs text-surface-400">{d.qualification || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">
                        {d.hospital.name}, {d.hospital.city}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="default">{d.specialisation.name}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">
                        {d.consultationFee ? `₹${Number(d.consultationFee).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{d._count.appointments}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={d.isActive ? 'success' : 'danger'} dot>
                          {d.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                            Edit
                          </Button>
                          {d.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-600 hover:text-danger-700"
                              onClick={() => setDeactivateConfirm({ open: true, id: d.id, name: d.fullName })}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">{editing ? 'Edit Doctor' : 'Add Doctor'}</h3>
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
                <label className="block text-xs font-semibold text-surface-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              {!editing && (
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Hospital"
                    value={form.hospitalId}
                    onChange={(val) => setForm({ ...form, hospitalId: val })}
                    options={hospitals.map((h) => ({ value: h.id, label: `${h.name} (${h.city})` }))}
                    required
                    className="col-span-1"
                  />
                  <Select
                    label="Specialisation"
                    value={form.specialisationId}
                    onChange={(val) => setForm({ ...form, specialisationId: val })}
                    options={specs.map((s) => ({ value: s.id, label: s.name }))}
                    required
                    className="col-span-1"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Qualification</label>
                  <input
                    type="text"
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    value={form.consultationFee}
                    onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
                    className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Available Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        form.availableDays.includes(day)
                          ? 'bg-primary-600 text-white'
                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="docActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <label htmlFor="docActive" className="text-sm font-medium text-surface-700">
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
        title="Deactivate Doctor"
        message={`Are you sure you want to deactivate "${deactivateConfirm.name}"? They will not be selectable for new patient appointments.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
