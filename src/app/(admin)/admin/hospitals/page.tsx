'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', accreditation: '', contactPerson: '', commissionRate: '', departments: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/hospitals');
      const data = await res.json();
      if (data.success) setHospitals(data.data.hospitals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchHospitals(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', city: '', address: '', accreditation: '', contactPerson: '', commissionRate: '', departments: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (h: Hospital) => {
    setEditing(h);
    setForm({
      name: h.name, city: h.city, address: h.address,
      accreditation: h.accreditation || '', contactPerson: h.contactPerson || '',
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
        name: form.name, city: form.city, address: form.address,
        accreditation: form.accreditation || undefined,
        contactPerson: form.contactPerson || undefined,
        commissionRate: form.commissionRate ? parseFloat(form.commissionRate) : undefined,
        departments: form.departments ? form.departments.split(',').map((d) => d.trim()).filter(Boolean) : [],
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;

      const res = await fetch('/api/v1/admin/hospitals', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error?.message); return; }
      setShowModal(false);
      fetchHospitals();
    } catch (err) { console.error(err); alert('Failed to save.'); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Hospitals</h1>
          <p className="text-sm text-surface-500 mt-1">Manage hospital partners and their configurations.</p>
        </div>
        <Button onClick={openCreate}>+ Add Hospital</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : hospitals.length === 0 ? (
          <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-12 text-center text-sm text-surface-500 bg-white">No hospitals found.</div>
        ) : (
          hospitals.map((h) => (
            <Card key={h.id} className="p-5 bg-white border border-surface-200 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-surface-900 text-lg">{h.name}</h3>
                <Badge variant={h.isActive ? 'success' : 'danger'} dot>{h.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="text-sm text-surface-500 mb-3">{h.city} • {h.accreditation || 'No accreditation'}</p>
              <div className="text-xs text-surface-600 bg-surface-50 p-3 rounded-lg border border-surface-200 space-y-1 mb-4">
                <p><span className="font-semibold">Doctors:</span> {h._count.doctors} • <span className="font-semibold">Appointments:</span> {h._count.appointments}</p>
                {h.commissionRate && <p><span className="font-semibold">Commission:</span> {Number(h.commissionRate)}%</p>}
                {Array.isArray(h.departments) && h.departments.length > 0 && <p><span className="font-semibold">Depts:</span> {h.departments.join(', ')}</p>}
              </div>
              <div className="mt-auto pt-3 border-t border-surface-100">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => openEdit(h)}>Edit Hospital</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">{editing ? 'Edit Hospital' : 'Add Hospital'}</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Name</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">City</label><input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Accreditation</label><input type="text" value={form.accreditation} onChange={(e) => setForm({ ...form, accreditation: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Address</label><textarea rows={2} required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Contact Person</label><input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Commission %</label><input type="number" step="0.01" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="block text-xs font-semibold text-surface-700">Departments (comma-separated)</label><input type="text" value={form.departments} onChange={(e) => setForm({ ...form, departments: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="Cardiology, Neurology, Orthopaedics" /></div>
              {editing && <div className="flex items-center gap-2"><input type="checkbox" id="hospActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><label htmlFor="hospActive" className="text-sm font-medium text-surface-700">Active</label></div>}
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
