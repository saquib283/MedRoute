'use client';

/**
 * Afzal Healthcare — Shared Partner Accommodations & Hotel Booking Workspace
 * Used by both Admin and Manager portals to manage partner hotels, commission cuts,
 * soft deactivation/reactivation, and booking lifecycle transitions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import {
  getDefaultStayDates,
  previewHotelStayCost,
} from '@/lib/validation/booking-helpers';
import {
  Building2,
  Plus,
  Star,
  DollarSign,
  MapPin,
  Percent,
  Sparkles,
  TrendingUp,
  X,
  Bed,
  Pencil,
  Power,
  RotateCcw,
  Calendar,
} from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  distanceKm: number;
  starRating: number;
  nightlyRateUsd: number | string;
  commissionPercent?: number | string;
  amenities: string[];
  images: string[];
  description?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
  nearHospital?: {
    id?: string;
    name: string;
    city: string;
  } | null;
}

interface Booking {
  id: string;
  bookingNo: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  numGuests: number;
  numNights: number;
  totalAmountUsd: number | string;
  commissionAmountUsd: number | string;
  status: string;
  specialRequests?: string | null;
  patient: {
    user: {
      fullName: string;
      email: string;
    };
  };
  hotel: {
    id?: string;
    name: string;
    city: string;
    nightlyRateUsd?: number | string;
  };
}

interface Metrics {
  totalBookings: number;
  totalGrossRevenue: number;
  totalCommissionEarned: number;
}

const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

const EMPTY_HOTEL_FORM = {
  name: '',
  city: 'New Delhi',
  address: '',
  distanceKm: '1.5',
  starRating: '4.5',
  nightlyRateUsd: '110',
  commissionPercent: '15',
  amenitiesInput:
    'Wheelchair Accessible, ICU Nurse On-Call, Halal Certified Kitchen, Airport Shuttle',
  imageUrlsInput:
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80\nhttps://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
  description:
    'Luxury recovery suites located near top treating hospitals. Dedicated post-op nurse care and custom diets.',
  contactPhone: '+911126110202',
  contactEmail: 'concierge@partnerhotel.com',
};

function getSafeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed.replace(/["'()\\]/g, '');
  }
  return null;
}

function formatDateInput(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return getDefaultStayDates().checkInDate;
  }
  return parsed.toISOString().slice(0, 10);
}

function getBookingStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CHECKED_IN':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'CONFIRMED':
      return 'bg-primary-100 text-primary-800 border-primary-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-amber-100 text-amber-800 border-amber-200';
  }
}

export default function PartnerAccommodationsWorkspace() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalBookings: 0,
    totalGrossRevenue: 0,
    totalCommissionEarned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Hotel Add / Edit Modal State
  const [isHotelModalOpen, setIsHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [isSavingHotel, setIsSavingHotel] = useState(false);
  const [togglingHotelId, setTogglingHotelId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_HOTEL_FORM);

  // Booking Lifecycle / Edit State
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState(() => {
    const defaults = getDefaultStayDates();
    return {
      checkInDate: defaults.checkInDate,
      checkOutDate: defaults.checkOutDate,
      roomType: 'Deluxe Medical Suite',
      numGuests: '2',
      specialRequests: '',
    };
  });

  const fetchData = useCallback(async (includeInactive: boolean) => {
    try {
      const hotelsUrl = includeInactive
        ? '/api/v1/accommodations?includeInactive=true'
        : '/api/v1/accommodations';
      const [hotelsRes, bookingsRes] = await Promise.all([
        fetch(hotelsUrl),
        fetch('/api/v1/accommodations/bookings'),
      ]);

      const hotelsData = await hotelsRes.json();
      const bookingsData = await bookingsRes.json();

      if (hotelsData.success) setHotels(hotelsData.data.hotels || []);
      if (bookingsData.success) {
        setBookings(bookingsData.data.bookings || []);
        setMetrics(
          bookingsData.data.metrics || {
            totalBookings: 0,
            totalGrossRevenue: 0,
            totalCommissionEarned: 0,
          }
        );
      }
    } catch (err) {
      console.error('Failed to load accommodations workspace', err);
      toast.apiError(err, 'Failed to load accommodation listings', 'Load Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData(showInactive);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData, showInactive]);

  const openAddModal = () => {
    setEditingHotel(null);
    setFormData(EMPTY_HOTEL_FORM);
    setIsHotelModalOpen(true);
  };

  const openEditModal = (hotel: Hotel) => {
    const amenitiesList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
    const imagesList = Array.isArray(hotel.images) ? hotel.images : [];
    setEditingHotel(hotel);
    setFormData({
      name: hotel.name,
      city: hotel.city,
      address: hotel.address,
      distanceKm: String(hotel.distanceKm ?? 1.5),
      starRating: String(hotel.starRating ?? 4.5),
      nightlyRateUsd: String(hotel.nightlyRateUsd ?? 110),
      commissionPercent: String(hotel.commissionPercent ?? 15),
      amenitiesInput: amenitiesList.join(', '),
      imageUrlsInput: imagesList.join('\n'),
      description: hotel.description || '',
      contactPhone: hotel.contactPhone || '',
      contactEmail: hotel.contactEmail || '',
    });
    setIsHotelModalOpen(true);
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingHotel(true);

    try {
      const amenities = formData.amenitiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const images = formData.imageUrlsInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: formData.name,
        city: formData.city,
        address: formData.address,
        distanceKm: Number(formData.distanceKm),
        starRating: Number(formData.starRating),
        nightlyRateUsd: Number(formData.nightlyRateUsd),
        commissionPercent: Number(formData.commissionPercent),
        amenities,
        images,
        description: formData.description,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
      };

      const isEdit = Boolean(editingHotel);
      const res = await fetch('/api/v1/accommodations', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingHotel!.id, ...payload } : payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          isEdit
            ? `Updated partner hotel: ${data.data.hotel.name}`
            : `Added partner hotel: ${data.data.hotel.name} with ${formData.commissionPercent}% commission cut!`,
          isEdit ? 'Hotel Updated' : 'Hotel Registered'
        );
        setIsHotelModalOpen(false);
        setEditingHotel(null);
        void fetchData(showInactive);
      } else {
        toast.apiError(
          data,
          isEdit ? 'Failed to update partner hotel' : 'Failed to register partner hotel',
          isEdit ? 'Update Error' : 'Registration Error'
        );
      }
    } catch (err) {
      toast.apiError(err, 'Network error saving hotel', 'Connection Error');
    } finally {
      setIsSavingHotel(false);
    }
  };

  const handleToggleHotelActive = async (hotel: Hotel) => {
    setTogglingHotelId(hotel.id);
    const currentlyActive = hotel.isActive !== false;

    try {
      const res = currentlyActive
        ? await fetch(`/api/v1/accommodations?id=${encodeURIComponent(hotel.id)}`, {
            method: 'DELETE',
          })
        : await fetch('/api/v1/accommodations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: hotel.id, isActive: true }),
          });

      const data = await res.json();
      if (data.success) {
        toast.success(
          currentlyActive
            ? `${hotel.name} deactivated from new bookings`
            : `${hotel.name} reactivated`,
          currentlyActive ? 'Hotel Deactivated' : 'Hotel Reactivated'
        );
        void fetchData(showInactive);
      } else {
        toast.apiError(data, 'Failed to update hotel status', 'Status Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error updating hotel status', 'Connection Error');
    } finally {
      setTogglingHotelId(null);
    }
  };

  const handleBookingStatusChange = async (bookingId: string, status: string) => {
    setUpdatingBookingId(bookingId);
    try {
      const res = await fetch('/api/v1/accommodations/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Booking status updated to ${status}`, 'Booking Updated');
        void fetchData(showInactive);
      } else {
        toast.apiError(data, 'Failed to update booking status', 'Update Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error updating booking', 'Connection Error');
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditingBooking(booking);
    setBookingForm({
      checkInDate: formatDateInput(booking.checkInDate),
      checkOutDate: formatDateInput(booking.checkOutDate),
      roomType: booking.roomType || 'Deluxe Medical Suite',
      numGuests: String(booking.numGuests ?? 2),
      specialRequests: booking.specialRequests || '',
    });
  };

  const bookingStayPreview = editingBooking
    ? previewHotelStayCost(
        bookingForm.checkInDate,
        bookingForm.checkOutDate,
        Number(editingBooking.hotel?.nightlyRateUsd ?? 0)
      )
    : { valid: false, numNights: 0, totalUsd: 0 };

  const handleSaveBookingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setIsSavingBooking(true);

    try {
      const res = await fetch('/api/v1/accommodations/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: editingBooking.id,
          checkInDate: bookingForm.checkInDate,
          checkOutDate: bookingForm.checkOutDate,
          roomType: bookingForm.roomType,
          numGuests: Number(bookingForm.numGuests),
          specialRequests: bookingForm.specialRequests,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Stay dates & booking details updated', 'Booking Updated');
        setEditingBooking(null);
        void fetchData(showInactive);
      } else {
        toast.apiError(data, 'Failed to update hotel booking', 'Update Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error updating booking', 'Connection Error');
    } finally {
      setIsSavingBooking(false);
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
            Manage healthcare-friendly hotels, nightly rates, active status, and Afzal Healthcare commission earnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-xl text-xs font-bold text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            />
            Show Inactive
          </label>

          <Button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Partner Hotel
          </Button>
        </div>
      </div>

      {/* ─── Revenue & Commission Metrics Cards ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-3xl border border-surface-200 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-surface-400 uppercase tracking-widest">
              Total Accommodations
            </span>
            <Bed className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-2xl font-black text-surface-900">{metrics.totalBookings} Stays Booked</p>
          <p className="text-xs text-surface-500 font-medium">Across {hotels.length} partner hotels</p>
        </Card>

        <Card className="p-6 rounded-3xl border border-surface-200 bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-surface-400 uppercase tracking-widest">
              Gross Booking Volume
            </span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800">
            ${metrics.totalGrossRevenue.toLocaleString()} USD
          </p>
          <p className="text-xs text-surface-500 font-medium">
            Active & completed accommodation volume
          </p>
        </Card>

        <Card className="p-6 rounded-3xl border border-primary-200 bg-gradient-to-r from-primary-900 to-primary-950 text-white shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-black text-primary-300 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Partner Commission Cut Earned
            </span>
            <Percent className="w-5 h-5 text-primary-300" />
          </div>
          <p className="text-2xl font-black text-white relative z-10">
            ${metrics.totalCommissionEarned.toLocaleString()} USD
          </p>
          <p className="text-xs text-primary-200 font-medium relative z-10">
            Net revenue earned from hotel partners
          </p>
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
            const safeImg = getSafeImageUrl(imageList[0] || DEFAULT_IMAGE_URL);
            const isActive = hotel.isActive !== false;

            return (
              <Card
                key={hotel.id}
                className={`rounded-3xl border overflow-hidden bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isActive ? 'border-surface-200' : 'border-surface-300 opacity-75'
                }`}
              >
                <div>
                  {/* Photo Banner */}
                  <div
                    role="img"
                    aria-label={hotel.name}
                    className="relative h-48 w-full bg-surface-100 bg-cover bg-center overflow-hidden"
                    style={safeImg ? { backgroundImage: `url("${safeImg}")` } : undefined}
                  >
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-amber-400 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 border border-white/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {hotel.starRating}
                    </div>
                    {hotel.commissionPercent !== undefined && (
                      <div className="absolute bottom-3 left-3 bg-primary-900/90 text-white px-2.5 py-1 rounded-xl text-xs font-bold border border-white/20">
                        {hotel.commissionPercent}% Partner Commission Cut
                      </div>
                    )}
                    {!isActive && (
                      <div className="absolute top-3 left-3 bg-rose-700 text-white px-2.5 py-1 rounded-xl text-xs font-bold">
                        Inactive
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-extrabold text-surface-900 leading-snug">
                        {hotel.name}
                      </h3>
                      <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                        {hotel.address} ({hotel.distanceKm} km to hospital)
                      </p>
                    </div>

                    <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
                      {hotel.description}
                    </p>

                    {/* Medical Amenities Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {amenityList.slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-xs font-semibold border border-surface-200"
                        >
                          {amenity}
                        </span>
                      ))}
                      {amenityList.length > 3 && (
                        <span className="text-xs font-semibold text-surface-500">
                          +{amenityList.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Pricing & Actions */}
                <div className="p-5 pt-3 border-t border-surface-100 mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-surface-500 uppercase tracking-wider block">
                        Nightly Rate
                      </span>
                      <span className="text-lg font-black text-surface-900">
                        ${Number(hotel.nightlyRateUsd)}{' '}
                        <span className="text-xs text-surface-500 font-semibold">/ night</span>
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-xs font-extrabold rounded-xl border ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-surface-100 text-surface-600 border-surface-200'
                      }`}
                    >
                      {isActive ? 'Active Partner' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => openEditModal(hotel)}
                      className="flex-1 px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={togglingHotelId === hotel.id}
                      onClick={() => handleToggleHotelActive(hotel)}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Power className="w-3.5 h-3.5" />
                          {togglingHotelId === hotel.id ? 'Deactivating...' : 'Deactivate'}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          {togglingHotelId === hotel.id ? 'Reactivating...' : 'Reactivate'}
                        </>
                      )}
                    </Button>
                  </div>
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
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs font-semibold text-surface-700">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-surface-500">
                      No hotel bookings recorded yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => {
                    const isBusy = updatingBookingId === b.id;
                    const canCheckIn = b.status === 'PENDING' || b.status === 'CONFIRMED';
                    const canComplete = b.status === 'CONFIRMED' || b.status === 'CHECKED_IN';
                    const canCancel = b.status === 'PENDING' || b.status === 'CONFIRMED';
                    const canEditStay =
                      b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'CHECKED_IN';

                    return (
                      <tr key={b.id} className="hover:bg-surface-50/60 transition-colors">
                        <td className="p-4 font-black text-surface-900">{b.bookingNo}</td>
                        <td className="p-4">
                          <p className="font-extrabold text-surface-900">{b.patient?.user?.fullName}</p>
                          <p className="text-xs text-surface-500 font-medium">{b.patient?.user?.email}</p>
                        </td>
                        <td className="p-4 font-extrabold text-surface-900">{b.hotel?.name}</td>
                        <td className="p-4 text-surface-600">
                          {new Date(b.checkInDate).toLocaleDateString()} -{' '}
                          {new Date(b.checkOutDate).toLocaleDateString()} ({b.numNights} nights)
                        </td>
                        <td className="p-4 font-black text-surface-900">
                          ${Number(b.totalAmountUsd).toFixed(2)} USD
                        </td>
                        <td className="p-4">
                          <span className="inline-block font-black text-emerald-700 bg-emerald-50/60 px-3 py-1 rounded-xl border border-emerald-200">
                            +${Number(b.commissionAmountUsd).toFixed(2)} USD Cut
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${getBookingStatusBadgeClass(
                              b.status
                            )}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canEditStay && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openEditBookingModal(b)}
                                className="px-2.5 py-1 bg-surface-100 hover:bg-surface-200 text-surface-800 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                              >
                                Edit Dates
                              </button>
                            )}
                            {canCheckIn && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'CHECKED_IN')}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                              >
                                Check In
                              </button>
                            )}
                            {canComplete && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'COMPLETED')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                              >
                                Complete
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'CANCELLED')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ─── Add / Edit Partner Hotel Modal ───────────────────────────── */}
      {isHotelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-surface-200 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <h3 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                {editingHotel ? `Edit Partner Hotel — ${editingHotel.name}` : 'Register New Partner Hotel'}
              </h3>
              <button
                type="button"
                aria-label="Close partner hotel modal"
                onClick={() => {
                  setIsHotelModalOpen(false);
                  setEditingHotel(null);
                }}
                className="p-1 text-surface-400 hover:text-surface-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHotel} className="space-y-4">
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
                    min="0"
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
                    min="0"
                    max="5"
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
                    step="0.01"
                    min="1"
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
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-black text-emerald-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Concierge Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Concierge Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">
                  Medical & Hospitality Amenities (Comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.amenitiesInput}
                  onChange={(e) => setFormData({ ...formData, amenitiesInput: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">
                  Photo Gallery Image URLs (1 URL per line)
                </label>
                <textarea
                  rows={3}
                  value={formData.imageUrlsInput}
                  onChange={(e) => setFormData({ ...formData, imageUrlsInput: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-mono text-surface-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">
                  Hotel Description & Recovery Features
                </label>
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
                  onClick={() => {
                    setIsHotelModalOpen(false);
                    setEditingHotel(null);
                  }}
                  variant="secondary"
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingHotel}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSavingHotel
                    ? 'Saving...'
                    : editingHotel
                    ? 'Save Hotel Changes'
                    : 'Register Partner Hotel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Booking Stay Dates & Details Modal ──────────────────── */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-surface-200 animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase text-primary-700 tracking-wider">
                  Update Reservation {editingBooking.bookingNo}
                </span>
                <h3 className="text-lg font-extrabold text-surface-900 mt-0.5 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  {editingBooking.hotel?.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close booking edit modal"
                onClick={() => setEditingBooking(null)}
                className="p-1 text-surface-400 hover:text-surface-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBookingEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Check-In Date</label>
                  <input
                    type="date"
                    value={bookingForm.checkInDate}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, checkInDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Check-Out Date</label>
                  <input
                    type="date"
                    value={bookingForm.checkOutDate}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, checkOutDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {!bookingStayPreview.valid && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {bookingStayPreview.error || 'Check-out date must be after check-in date'}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Room Type</label>
                  <input
                    type="text"
                    value={bookingForm.roomType}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, roomType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Guests</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bookingForm.numGuests}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, numGuests: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Special Requests / Notes</label>
                <textarea
                  rows={2}
                  value={bookingForm.specialRequests}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, specialRequests: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                />
              </div>

              {bookingStayPreview.valid && Number(editingBooking.hotel?.nightlyRateUsd ?? 0) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800">
                    Recalculated Stay ({bookingStayPreview.numNights} nights)
                  </span>
                  <span className="font-black text-emerald-900">
                    ${bookingStayPreview.totalUsd.toFixed(2)} USD
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingBooking || !bookingStayPreview.valid}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs"
                >
                  {isSavingBooking ? 'Updating...' : 'Save Stay Update'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
