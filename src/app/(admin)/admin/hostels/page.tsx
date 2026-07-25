'use client';

/**
 * MediRoute India — Admin Hostels Management
 * CRUD for hostel/accommodation partners with search, filters, deactivation, and toast notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';

interface Hostel {
  id: string;
  name: string;
  city: string;
  address: string;
  capacity: number;
  pricingPerNight: number;
  roomTypes: string[];
  isActive: boolean;
  _count: { accommodationBookings: number };
}

export default function AdminHostelsPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Hostel | null>(null);
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    capacity: '',
    pricingPerNight: '',
    roomTypes: '',
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

  const fetchHostels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const res = await fetch('/api/v1/admin/hostels');
      const data = await res.json();
      if (data.success) {
        let list: Hostel[] = data.data.hostels;
        if (search) {
          list = list.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()));
        }
        if (cityFilter) {
          list = list.filter((h) => h.city.toLowerCase().includes(cityFilter.toLowerCase()));
        }
        setHostels(list);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load hostels');
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      city: '',
      address: '',
      capacity: '',
      pricingPerNight: '',
      roomTypes: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (h: Hostel) => {
    setEditing(h);
    setForm({
      name: h.name,
      city: h.city,
      address: h.address,
      capacity: h.capacity.toString(),
      pricingPerNight: Number(h.pricingPerNight).toString(),
      roomTypes: Array.isArray(h.roomTypes) ? h.roomTypes.join(', ') : '',
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
        capacity: parseInt(form.capacity, 10),
        pricingPerNight: parseFloat(form.pricingPerNight),
        roomTypes: form.roomTypes
          ? form.roomTypes
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;

      const res = await fetch('/api/v1/admin/hostels', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save hostel');
        return;
      }
      toast.success(editing ? 'Hostel updated successfully' : 'Hostel created successfully');
      setShowModal(false);
      fetchHostels();
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
      const res = await fetch(`/api/v1/admin/hostels?id=${deactivateConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to deactivate hostel');
        return;
      }
      toast.success('Hostel deactivated successfully');
      setDeactivateConfirm({ open: false, id: '', name: '' });
      fetchHostels();
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
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Hostels</h1>
          <p className="text-sm text-surface-500 mt-1">Manage partner accommodations and pricing parameters.</p>
        </div>
        <Button onClick={openCreate}>+ Add Hostel</Button>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by hostel name..."
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
        <Button variant="secondary" size="sm" onClick={() => fetchHostels()}>
          Search
        </Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hostels.length === 0 ? (
          <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-12 text-center text-sm text-surface-500 bg-white">
            No hostels found.
          </div>
        ) : (
          hostels.map((h) => (
            <Card key={h.id} className="p-5 bg-white border border-surface-200 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-surface-900 text-lg">{h.name}</h3>
                <Badge variant={h.isActive ? 'success' : 'danger'} dot>
                  {h.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-surface-500 mb-3">{h.city}</p>
              <div className="text-xs text-surface-600 bg-surface-50 p-3 rounded-lg border border-surface-200 space-y-1 mb-4">
                <p>
                  <span className="font-semibold">Capacity:</span> {h.capacity} rooms
                </p>
                <p>
                  <span className="font-semibold">Pricing:</span> ₹{Number(h.pricingPerNight).toLocaleString()}/night
                </p>
                <p>
                  <span className="font-semibold">Bookings:</span> {h._count.accommodationBookings}
                </p>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-scale-up">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-surface-900">{editing ? 'Edit Hostel' : 'Add Hostel'}</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">
                ×
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
                  className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
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
                    className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Capacity</label>
                  <input
                    type="number"
                    required
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
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
                  className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Price/Night (₹)</label>
                  <input
                    type="number"
                    required
                    value={form.pricingPerNight}
                    onChange={(e) => setForm({ ...form, pricingPerNight: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Room Types</label>
                  <input
                    type="text"
                    value={form.roomTypes}
                    onChange={(e) => setForm({ ...form, roomTypes: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="Single, Double"
                  />
                </div>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hostelActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <label htmlFor="hostelActive" className="text-sm font-medium text-surface-700">
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
        title="Deactivate Hostel"
        message={`Are you sure you want to deactivate "${deactivateConfirm.name}"? Active bookings may be affected.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
