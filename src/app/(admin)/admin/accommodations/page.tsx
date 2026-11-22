'use client';

/**
 * Afzal Healthcare — Admin & Manager Partner Hotel Accommodations Workspace
 * Manage partner recovery hotels, photo galleries, nightly rates, medical amenities, and partner commission revenue.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import {
  Building2,
  Plus,
  Star,
  DollarSign,
  MapPin,
  Percent,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  Sparkles,
  TrendingUp,
  Image as ImageIcon,
  X,
  Bed,
} from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  distanceKm: number;
  starRating: number;
  nightlyRateUsd: number | string;
  commissionPercent: number | string;
  amenities: string[];
  images: string[];
  description: string;
  contactPhone: string;
  contactEmail: string;
  nearHospital?: {
    name: string;
    city: string;
  };
}

interface Booking {
  id: string;
  bookingNo: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  numNights: number;
  totalAmountUsd: number | string;
  commissionAmountUsd: number | string;
  status: string;
  patient: {
    user: {
      fullName: string;
      email: string;
    };
  };
  hotel: {
    name: string;
    city: string;
  };
}

interface Metrics {
  totalBookings: number;
  totalGrossRevenue: number;
  totalCommissionEarned: number;
}

export default function AdminAccommodationsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalBookings: 0, totalGrossRevenue: 0, totalCommissionEarned: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    city: 'New Delhi',
    address: '',
    distanceKm: '1.5',
    starRating: '4.5',
    nightlyRateUsd: '110',
    commissionPercent: '15',
    amenitiesInput: 'Wheelchair Accessible, ICU Nurse On-Call, Halal Certified Kitchen, Airport Shuttle',
    imageUrlsInput: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80\nhttps://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    description: 'Luxury recovery suites located near top treating hospitals. Dedicated post-op nurse care and custom diets.',
    contactPhone: '+911126110202',
    contactEmail: 'concierge@partnerhotel.com',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [hotelsRes, bookingsRes] = await Promise.all([
        fetch('/api/v1/accommodations'),
        fetch('/api/v1/accommodations/bookings'),
      ]);

      const hotelsData = await hotelsRes.json();
      const bookingsData = await bookingsRes.json();

      if (hotelsData.success) setHotels(hotelsData.data.hotels || []);
      if (bookingsData.success) {
        setBookings(bookingsData.data.bookings || []);
        setMetrics(bookingsData.data.metrics || { totalBookings: 0, totalGrossRevenue: 0, totalCommissionEarned: 0 });
      }
    } catch (err) {
      console.error('Failed to load accommodations workspace', err);
      toast.apiError(err, 'Failed to load accommodation listings', 'Load Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const amenities = formData.amenitiesInput.split(',').map((s) => s.trim()).filter(Boolean);
      const images = formData.imageUrlsInput.split('\n').map((s) => s.trim()).filter(Boolean);

      const res = await fetch('/api/v1/accommodations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amenities,
          images,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Added partner hotel: ${data.data.hotel.name} with ${formData.commissionPercent}% commission cut!`, 'Hotel Registered');
        setIsAddModalOpen(false);
        fetchData();
      } else {
        toast.apiError(data, 'Failed to register partner hotel', 'Registration Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error adding hotel', 'Connection Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading Accommodations Workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 bg-primary-100 text-primary-800 rounded-md text-[11px] font-black uppercase tracking-wider">
            Revenue & Operations
          </span>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2 mt-1">
            <Building2 className="w-7 h-7 text-primary-600" />
            Partner Accommodations & Commission Workspace
          </h1>
          <p className="text-xs text-surface-500 mt-0.5">
            Manage healthcare-friendly hotels, photo galleries, nightly rates, and Afzal Healthcare commission earnings.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Add Partner Hotel
        </Button>
      </div>

      {/* ─── Revenue & Commission Metrics Cards ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-3xl border border-surface-200 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-surface-400 uppercase tracking-widest">Total Accommodations</span>
            <Bed className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-2xl font-black text-surface-900">{metrics.totalBookings} Stays Booked</p>
          <p className="text-xs text-surface-500 font-medium">Across {hotels.length} partner hotels</p>
        </Card>

        <Card className="p-6 rounded-3xl border border-surface-200 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-surface-400 uppercase tracking-widest">Gross Booking Volume</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800">${metrics.totalGrossRevenue.toLocaleString()} USD</p>
          <p className="text-xs text-surface-500 font-medium">Total accommodation spending</p>
        </Card>

        <Card className="p-6 rounded-3xl border border-primary-200 bg-gradient-to-r from-primary-900 to-primary-950 text-white shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-black text-primary-300 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Partner Commission Cut Earned
            </span>
            <Percent className="w-5 h-5 text-primary-300" />
          </div>
          <p className="text-2xl font-black text-white relative z-10">${metrics.totalCommissionEarned.toLocaleString()} USD</p>
          <p className="text-xs text-primary-200 font-medium relative z-10">Net revenue earned from hotel partners</p>
        </Card>
      </div>

      {/* ─── Partner Hotels Directory Grid ────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          Partner Hotels Directory ({hotels.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hotels.map((hotel) => {
            const imageList = Array.isArray(hotel.images) ? hotel.images : [];
            const amenityList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
            const primaryImg = imageList[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

            return (
              <Card key={hotel.id} className="rounded-3xl border border-surface-200 overflow-hidden bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  {/* Photo Banner */}
                  <div className="relative h-48 w-full bg-surface-100 overflow-hidden">
                    <img src={primaryImg} alt={hotel.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-amber-400 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 border border-white/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {hotel.starRating}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-primary-900/90 text-white px-2.5 py-1 rounded-xl text-xs font-bold border border-white/20">
                      {hotel.commissionPercent}% Partner Commission Cut
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-extrabold text-surface-900 leading-snug">{hotel.name}</h3>
                      <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                        {hotel.address} ({hotel.distanceKm} km to hospital)
                      </p>
                    </div>

                    <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">{hotel.description}</p>

                    {/* Medical Amenities Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {amenityList.slice(0, 3).map((amenity, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-xs font-semibold border border-surface-200">
                          {amenity}
                        </span>
                      ))}
                      {amenityList.length > 3 && (
                        <span className="text-xs font-semibold text-surface-500">+{amenityList.length - 3} more</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Pricing */}
                <div className="p-5 pt-0 border-t border-surface-100 mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider block">Nightly Rate</span>
                    <span className="text-lg font-black text-surface-900">${Number(hotel.nightlyRateUsd)} <span className="text-xs text-surface-500 font-semibold">/ night</span></span>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-xl border border-emerald-200">
                    Active Partner
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Recent Accommodation Bookings & Commission Table ────────── */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Recent Accommodation Bookings & Commission Ledger
        </h2>

        <Card className="rounded-3xl border border-surface-200 overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-bold uppercase text-surface-500 tracking-wider">
                  <th className="p-4">Booking No</th>
                  <th className="p-4">Patient Name</th>
                  <th className="p-4">Hotel Property</th>
                  <th className="p-4">Stay Dates</th>
                  <th className="p-4">Total Stay ($)</th>
                  <th className="p-4">Commission Cut ($)</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs font-semibold text-surface-700">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="p-4 font-black text-surface-900">{b.bookingNo}</td>
                    <td className="p-4">
                      <p className="font-extrabold text-surface-900">{b.patient?.user?.fullName}</p>
                      <p className="text-xs text-surface-500 font-medium">{b.patient?.user?.email}</p>
                    </td>
                    <td className="p-4 font-extrabold text-surface-900">{b.hotel?.name}</td>
                    <td className="p-4 text-surface-600">
                      {new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()} ({b.numNights} nights)
                    </td>
                    <td className="p-4 font-black text-surface-900">${Number(b.totalAmountUsd).toFixed(2)} USD</td>
                    <td className="p-4 font-black text-emerald-700 bg-emerald-50/60 px-3 py-1.5 rounded-xl border border-emerald-200">
                      +${Number(b.commissionAmountUsd).toFixed(2)} USD Cut
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold uppercase tracking-wider">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ─── Add Partner Hotel Modal ──────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-surface-200 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <h3 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                Register New Partner Hotel
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-surface-400 hover:text-surface-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddHotel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Hotel Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Taj Palace Recovery Suites"
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. New Delhi"
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address & nearby landmarks"
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.distanceKm}
                    onChange={(e) => setFormData({ ...formData, distanceKm: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Star Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.starRating}
                    onChange={(e) => setFormData({ ...formData, starRating: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Nightly Rate ($)</label>
                  <input
                    type="number"
                    value={formData.nightlyRateUsd}
                    onChange={(e) => setFormData({ ...formData, nightlyRateUsd: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Commission Cut (%)</label>
                  <input
                    type="number"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-black text-emerald-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Medical & Hospitality Amenities (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.amenitiesInput}
                  onChange={(e) => setFormData({ ...formData, amenitiesInput: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Photo Gallery Image URLs (1 URL per line)</label>
                <textarea
                  rows={3}
                  value={formData.imageUrlsInput}
                  onChange={(e) => setFormData({ ...formData, imageUrlsInput: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-mono text-surface-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Hotel Description & Recovery Features</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
                <Button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  variant="secondary"
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSaving ? 'Registering...' : 'Register Partner Hotel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
