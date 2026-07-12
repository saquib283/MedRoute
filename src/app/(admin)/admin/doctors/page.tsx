'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

interface HospitalOption { id: string; name: string; city: string; }
interface SpecOption { id: string; name: string; }

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [specs, setSpecs] = useState<SpecOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ fullName: '', hospitalId: '', specialisationId: '', qualification: '', consultationFee: '', availableDays: [] as string[], isActive: true });
  const [saving, setSaving] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/doctors');
      const data = await res.json();
      if (data.success) setDoctors(data.data.doctors);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchMeta = async () => {
    try {
      const [hRes, sRes] = await Promise.all([fetch('/api/v1/admin/hospitals'), fetch('/api/v1/admin/specialisations')]);
      const [hData, sData] = await Promise.all([hRes.json(), sRes.json()]);
      if (hData.success) setHospitals(hData.data.hospitals);
      if (sData.success) setSpecs(sData.data.specialisations);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchDoctors(); fetchMeta(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ fullName: '', hospitalId: '', specialisationId: '', qualification: '', consultationFee: '', availableDays: [], isActive: true });
    setShowModal(true);
  };

  const openEdit = (d: Doctor) => {
    setEditing(d);
    setForm({
      fullName: d.fullName, hospitalId: '', specialisationId: '',
      qualification: d.qualification || '', consultationFee: d.consultationFee?.toString() || '',
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
      if (!data.success) { alert(data.error?.message); return; }
      setShowModal(false);
      fetchDoctors();
    } catch (err) { console.error(err); alert('Failed to save.'); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Doctors</h1>
          <p className="text-sm text-surface-500 mt-1">Manage registered doctors and their hospital affiliations.</p>
        </div>
        <Button onClick={openCreate}>+ Add Doctor</Button>
      </div>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
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
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-surface-500">No doctors found.</td></tr>
                ) : (
                  doctors.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-surface-900">{d.fullName}</p>
                        <p className="text-xs text-surface-400">{d.qualification || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">{d.hospital.name}, {d.hospital.city}</td>
                      <td className="px-5 py-3.5"><Badge variant="default">{d.specialisation.name}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-600">{d.consultationFee ? `₹${Number(d.consultationFee).toLocaleString()}` : '—'}</td>
                      <td className="px-5 py-3.5 text-surface-600">{d._count.appointments}</td>
                      <td className="px-5 py-3.5"><Badge variant={d.isActive ? 'success' : 'danger'} dot>{d.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-5 py-3.5 text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Button></td>
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">{editing ? 'Edit Doctor' : 'Add Doctor'}</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Full Name</label><input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              {!editing && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Hospital</label><select required value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm">{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.city})</option>)}</select></div>
                  <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Specialisation</label><select required value={form.specialisationId} onChange={(e) => setForm({ ...form, specialisationId: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm">{specs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Qualification</label><input type="text" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Consultation Fee (₹)</label><input type="number" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Available Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${form.availableDays.includes(day) ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{day}</button>
                  ))}
                </div>
              </div>
              {editing && <div className="flex items-center gap-2"><input type="checkbox" id="docActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><label htmlFor="docActive" className="text-sm font-medium text-surface-700">Active</label></div>}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={saving}>{editing ? 'Save' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
