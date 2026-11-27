'use client';

/**
 * MediRoute India — Admin Hotels & Accommodation Management
 * Agoda-style property management: CRUD for hotels, medical amenities, photo gallery links, proximity to hospitals, stay rules, and pricing.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { Building2, MapPin, Star, Plus, Image as ImageIcon } from 'lucide-react';

interface Hostel {
  id: string;
  name: string;
  city: string;
  address: string;
  description?: string | null;
  capacity: number;
  pricingPerNight: number;
  roomTypes: string[];
  amenities?: string[] | null;
  images?: string[] | null;
  distanceToHospital?: string | null;
  rating?: number | null;
  contactPhone?: string | null;
  rules?: string | null;
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
    description: '',
    capacity: '',
    pricingPerNight: '',
    roomTypes: 'SINGLE, DOUBLE, SUITE',
    amenities: '24/7 Nursing, Wheelchair Accessible, Hospital Shuttle, High-Speed Wi-Fi, Oxygen Cylinder Support',
    images: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80, https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    distanceToHospital: '0.3 km from Partner Hospital',
    rating: '4.8',
    contactPhone: '+91 11 4055 8899',
    rules: 'Check-in: 12:00 PM | Check-out: 11:00 AM. Quiet hours from 10:00 PM.',
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
    await Promise.resolve();
    setLoading(true);
    try {
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
      toast.error('Failed to load hotel partners');
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter]);

  useEffect(() => {
    queueMicrotask(() => fetchHostels());
  }, [fetchHostels]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      city: '',
      address: '',
      description: '',
      capacity: '50',
      pricingPerNight: '2500',
      roomTypes: 'SINGLE, DOUBLE, SUITE',
      amenities: '24/7 Nursing Support, Wheelchair Accessible, Hospital Shuttle, Oxygen Support, Custom Medical Meals, Free High-Speed Wi-Fi',
      images: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80, https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      distanceToHospital: '0.4 km from Partner Super Speciality Hospital',
      rating: '4.8',
      contactPhone: '+91 11 4055 8899',
      rules: 'Check-in: 12:00 PM | Check-out: 11:00 AM. 1 attendant allowed.',
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
      description: h.description || '',
      capacity: h.capacity.toString(),
      pricingPerNight: Number(h.pricingPerNight).toString(),
      roomTypes: Array.isArray(h.roomTypes) ? h.roomTypes.join(', ') : '',
      amenities: Array.isArray(h.amenities) ? h.amenities.join(', ') : '',
      images: Array.isArray(h.images) ? h.images.join(', ') : '',
      distanceToHospital: h.distanceToHospital || '',
      rating: h.rating ? h.rating.toString() : '4.8',
      contactPhone: h.contactPhone || '',
      rules: h.rules || '',
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
        description: form.description,
        capacity: parseInt(form.capacity, 10) || 1,
        pricingPerNight: parseFloat(form.pricingPerNight) || 0,
        roomTypes: form.roomTypes
          ? form.roomTypes.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        amenities: form.amenities
          ? form.amenities.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        images: form.images
          ? form.images.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        distanceToHospital: form.distanceToHospital,
        rating: parseFloat(form.rating) || 4.8,
        contactPhone: form.contactPhone,
        rules: form.rules,
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
        toast.error(data.error?.message || 'Failed to save hotel');
        return;
      }
      toast.success(editing ? 'Hotel property updated successfully' : 'Hotel property created successfully');
      setShowModal(false);
      fetchHostels();
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving hotel.');
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
        toast.error(data.error?.message || 'Failed to deactivate hotel');
        return;
      }
      toast.success('Hotel deactivated successfully');
      setDeactivateConfirm({ open: false, id: '', name: '' });
      fetchHostels();
    } catch {
      toast.error('An error occurred.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Hotels & Medical Accommodations</h1>
          <p className="text-sm text-surface-600 mt-1">Manage Agoda-style hotel partner listings, photos, medical amenities, and pricing.</p>
        </div>
        <Button onClick={openCreate} size="md">
          <Plus className="w-4 h-4 mr-1.5" /> Add Hotel Property
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by hotel property name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <input
          type="text"
          placeholder="Filter by city..."
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-3 py-2 border border-surface-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchHostels()}>
          Filter
        </Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hostels.length === 0 ? (
          <div className="col-span-full border border-dashed border-surface-200 rounded-2xl p-12 text-center text-sm text-surface-600 bg-white">
            No hotel properties found.
          </div>
        ) : (
          hostels.map((h) => {
            const firstImg = Array.isArray(h.images) && h.images.length > 0 ? h.images[0] : null;

            return (
              <Card key={h.id} className="p-0 bg-white border border-surface-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-all">
                {/* Image preview */}
                <div className="h-44 bg-surface-100 relative overflow-hidden">
                  {firstImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstImg} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-400">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant={h.isActive ? 'success' : 'danger'} dot>
                      {h.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-surface-900/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {h.rating || 4.8}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-surface-900 text-base">{h.name}</h3>
                      <span className="font-extrabold text-primary-700 text-sm shrink-0">₹{Number(h.pricingPerNight).toLocaleString()}/night</span>
                    </div>

                    <p className="text-xs font-semibold text-surface-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-primary-600" /> {h.city} — {h.distanceToHospital || 'Near Hospital'}
                    </p>

                    {h.description && (
                      <p className="text-xs text-surface-600 mt-2 line-clamp-2 leading-relaxed">{h.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1">
                      {Array.isArray(h.amenities) &&
                        h.amenities.slice(0, 3).map((a) => (
                          <span key={a} className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded text-[10px] font-semibold border border-surface-200">
                            {a}
                          </span>
                        ))}
                      {Array.isArray(h.amenities) && h.amenities.length > 3 && (
                        <span className="px-2 py-0.5 bg-surface-100 text-surface-500 rounded text-[10px] font-semibold">
                          +{h.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-surface-100 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(h)}>
                      Edit Details
                    </Button>
                    {h.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600 hover:text-danger-700 font-semibold"
                        onClick={() => setDeactivateConfirm({ open: true, id: h.id, name: h.name })}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Agoda-style Hotel Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in border border-surface-200">
            <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-surface-50">
              <h3 className="font-bold text-surface-900 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                {editing ? 'Edit Hotel Property Details' : 'Add New Medical Hotel Partner'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs font-semibold text-surface-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block">Hotel Property Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. Grand HealthSuites & Recovery Inn"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">City *</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. New Delhi"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block">Full Address *</label>
                <textarea
                  rows={2}
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  placeholder="Street, area, landmark, pincode"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Property Overview & Medical Care Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  placeholder="Describe nursing care, clean suites, custom diets, and patient recovery facilities..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block">Price/Night (₹) *</label>
                  <input
                    type="number"
                    required
                    value={form.pricingPerNight}
                    onChange={(e) => setForm({ ...form, pricingPerNight: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Capacity (Rooms) *</label>
                  <input
                    type="number"
                    required
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Star Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Distance to Partner Hospital</label>
                  <input
                    type="text"
                    value={form.distanceToHospital}
                    onChange={(e) => setForm({ ...form, distanceToHospital: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. 0.3 km from Max Hospital"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Contact Phone</label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                    placeholder="+91 11 4055 8899"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block">Medical Amenities (comma separated)</label>
                <input
                  type="text"
                  value={form.amenities}
                  onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  placeholder="24/7 Nursing, Wheelchair Accessible, Hospital Shuttle, Oxygen Support"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Photo Gallery Image URLs (comma separated URLs)</label>
                <input
                  type="text"
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  placeholder="https://images.unsplash.com/photo-1566..., https://..."
                />
              </div>

              <div className="space-y-1">
                <label className="block">Check-in Policies & Stay Rules</label>
                <input
                  type="text"
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-xl text-xs focus:ring-1 focus:ring-primary-500"
                  placeholder="Check-in: 12:00 PM | Check-out: 11:00 AM"
                />
              </div>

              {editing && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="hostelActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-surface-300 text-primary-600"
                  />
                  <label htmlFor="hostelActive" className="text-xs font-bold text-surface-800">
                    Active Hotel Partner Listing
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-surface-100">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={saving}>
                  {editing ? 'Update Hotel Property' : 'Save Hotel Property'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Deactivation */}
      <ConfirmDialog
        open={deactivateConfirm.open}
        title="Deactivate Hotel Property"
        message={`Are you sure you want to deactivate "${deactivateConfirm.name}"? Patients will not see inactive hotels.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
