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
  Plus,
  Star,
  DollarSign,
  MapPin,
  Percent,
  X,
  Bed,
  Pencil,
  Power,
  RotateCcw,
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
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CHECKED_IN':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'CONFIRMED':
      return 'bg-primary-50 text-primary-700 border-primary-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-surface-500">Loading accommodations workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">
            Partner Accommodations &amp; Commission Workspace
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Manage healthcare-friendly hotels, nightly rates, active status, and Afzal Healthcare commission earnings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-2 px-3 min-h-[44px] bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            />
            Show Inactive
          </label>

          <Button size="sm" onClick={openAddModal}>
            <Plus className="w-4 h-4" /> Add Partner Hotel
          </Button>
        </div>
      </div>

      {/* ─── Revenue & Commission Metrics Cards ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Total Accommodations</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics.totalBookings} Stays Booked
            </p>
            <p className="text-xs text-surface-500 mt-1">Across {hotels.length} partner hotels</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <Bed className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Gross Booking Volume</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              ${metrics.totalGrossRevenue.toLocaleString()} USD
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Active &amp; completed accommodation volume
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Partner Commission Cut Earned</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              ${metrics.totalCommissionEarned.toLocaleString()} USD
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Net revenue earned from hotel partners
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* ─── Partner Hotels Directory Grid ────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm sm:text-base font-semibold text-surface-900">
          Partner Hotels Directory ({hotels.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {hotels.map((hotel) => {
            const imageList = Array.isArray(hotel.images) ? hotel.images : [];
            const amenityList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
            const safeImg = getSafeImageUrl(imageList[0] || DEFAULT_IMAGE_URL);
            const isActive = hotel.isActive !== false;

            return (
              <Card
                key={hotel.id}
                className={`!p-0 overflow-hidden transition-colors flex flex-col justify-between ${
                  isActive ? 'hover:border-surface-300' : 'border-surface-300 opacity-75'
                }`}
              >
                <div>
                  {/* Photo Banner */}
                  <div
                    role="img"
                    aria-label={hotel.name}
                    className="relative h-44 w-full bg-surface-100 bg-cover bg-center border-b border-surface-200 overflow-hidden"
                    style={safeImg ? { backgroundImage: `url("${safeImg}")` } : undefined}
                  >
                    <div className="absolute top-3 right-3 bg-surface-900/85 text-white px-2 py-0.5 rounded-md text-xs font-medium tabular-nums flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {hotel.starRating}
                    </div>
                    {hotel.commissionPercent !== undefined && (
                      <div className="absolute bottom-3 left-3 bg-surface-900/85 text-white px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums">
                        {hotel.commissionPercent}% Partner Commission Cut
                      </div>
                    )}
                    {!isActive && (
                      <div className="absolute top-3 left-3 bg-rose-700 text-white px-2 py-0.5 rounded-md text-[11px] font-medium">
                        Inactive
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-surface-900 leading-snug">
                        {hotel.name}
                      </h3>
                      <p className="text-xs text-surface-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span>{hotel.address} ({hotel.distanceKm} km to hospital)</span>
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
                          className="px-2 py-0.5 bg-surface-50 text-surface-700 rounded text-[11px] font-medium border border-surface-200"
                        >
                          {amenity}
                        </span>
                      ))}
                      {amenityList.length > 3 && (
                        <span className="text-[11px] font-medium text-surface-500">
                          +{amenityList.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Pricing & Actions */}
                <div className="p-5 pt-3.5 border-t border-surface-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-surface-500 block">
                        Nightly Rate
                      </span>
                      <span className="text-lg font-semibold tracking-tight tabular-nums text-surface-900">
                        ${Number(hotel.nightlyRateUsd)}{' '}
                        <span className="text-xs text-surface-500 font-normal">/ night</span>
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-surface-100 text-surface-600 border-surface-200'
                      }`}
                    >
                      {isActive ? 'Active Partner' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditModal(hotel)}
                      className="flex-1"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={togglingHotelId === hotel.id}
                      onClick={() => handleToggleHotelActive(hotel)}
                      className={`flex-1 ${
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
      <div className="space-y-4 pt-2">
        <h2 className="text-sm sm:text-base font-semibold text-surface-900">
          Recent Accommodation Bookings &amp; Commission Ledger
        </h2>

        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Booking No</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient Name</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Hotel Property</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Stay Dates</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Total Stay ($)</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Commission Cut ($)</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Status</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 text-surface-700">
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
                      <tr key={b.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-medium text-surface-900">{b.bookingNo}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-surface-900">{b.patient?.user?.fullName}</p>
                          <p className="text-xs text-surface-500">{b.patient?.user?.email}</p>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-surface-900">{b.hotel?.name}</td>
                        <td className="px-4 py-3.5 text-surface-600 tabular-nums">
                          {new Date(b.checkInDate).toLocaleDateString()} –{' '}
                          {new Date(b.checkOutDate).toLocaleDateString()} ({b.numNights} nights)
                        </td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-surface-900">
                          ${Number(b.totalAmountUsd).toFixed(2)} USD
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block font-medium tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            +${Number(b.commissionAmountUsd).toFixed(2)} USD Cut
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getBookingStatusBadgeClass(
                              b.status
                            )}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canEditStay && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openEditBookingModal(b)}
                                className="px-2.5 py-1 bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                              >
                                Edit Dates
                              </button>
                            )}
                            {canCheckIn && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'CHECKED_IN')}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                              >
                                Check In
                              </button>
                            )}
                            {canComplete && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'COMPLETED')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                              >
                                Complete
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingStatusChange(b.id, 'CANCELLED')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-surface-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-md border border-surface-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <h3 className="text-base font-semibold text-surface-900">
                {editingHotel ? `Edit Partner Hotel — ${editingHotel.name}` : 'Register New Partner Hotel'}
              </h3>
              <button
                type="button"
                aria-label="Close partner hotel modal"
                onClick={() => {
                  setIsHotelModalOpen(false);
                  setEditingHotel(null);
                }}
                className="p-1.5 text-surface-400 hover:text-surface-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHotel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Hotel Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Taj Palace Recovery Suites"
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. New Delhi"
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address & nearby landmarks"
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.distanceKm}
                    onChange={(e) => setFormData({ ...formData, distanceKm: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Star Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.starRating}
                    onChange={(e) => setFormData({ ...formData, starRating: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Nightly Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.nightlyRateUsd}
                    onChange={(e) => setFormData({ ...formData, nightlyRateUsd: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Commission Cut (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-semibold tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Concierge Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Concierge Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">
                  Medical &amp; Hospitality Amenities (Comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.amenitiesInput}
                  onChange={(e) => setFormData({ ...formData, amenitiesInput: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">
                  Photo Gallery Image URLs (1 URL per line)
                </label>
                <textarea
                  rows={3}
                  value={formData.imageUrlsInput}
                  onChange={(e) => setFormData({ ...formData, imageUrlsInput: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-mono text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">
                  Hotel Description &amp; Recovery Features
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsHotelModalOpen(false);
                    setEditingHotel(null);
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSavingHotel}>
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
        <div className="fixed inset-0 z-50 bg-surface-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-5 shadow-md border border-surface-200">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div>
                <h3 className="text-base font-semibold text-surface-900">
                  {editingBooking.hotel?.name}
                </h3>
                <p className="text-xs text-surface-500 mt-0.5 font-mono">
                  Reservation {editingBooking.bookingNo}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close booking edit modal"
                onClick={() => setEditingBooking(null)}
                className="p-1.5 text-surface-400 hover:text-surface-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBookingEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Check-In Date</label>
                  <input
                    type="date"
                    value={bookingForm.checkInDate}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, checkInDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Check-Out Date</label>
                  <input
                    type="date"
                    value={bookingForm.checkOutDate}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, checkOutDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              {!bookingStayPreview.valid && (
                <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                  {bookingStayPreview.error || 'Check-out date must be after check-in date'}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Room Type</label>
                  <input
                    type="text"
                    value={bookingForm.roomType}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, roomType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Guests</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bookingForm.numGuests}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, numGuests: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">Special Requests / Notes</label>
                <textarea
                  rows={2}
                  value={bookingForm.specialRequests}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, specialRequests: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              {bookingStayPreview.valid && Number(editingBooking.hotel?.nightlyRateUsd ?? 0) > 0 && (
                <div className="p-3 bg-surface-50 border border-surface-200 rounded-md flex items-center justify-between text-xs">
                  <span className="font-medium text-surface-600">
                    Recalculated Stay ({bookingStayPreview.numNights} nights)
                  </span>
                  <span className="font-semibold tabular-nums text-surface-900">
                    ${bookingStayPreview.totalUsd.toFixed(2)} USD
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingBooking(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingBooking || !bookingStayPreview.valid}
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
