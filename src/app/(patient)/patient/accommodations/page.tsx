'use client';

/**
 * Afzal Healthcare — Patient Accommodation Marketplace & Hotel Booking Engine
 * Patients search, compare, and book healthcare-friendly recovery hotels near their treating hospital.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import {
  Building2,
  Star,
  MapPin,
  CheckCircle2,
  Calendar,
  Bed,
  ShieldCheck,
  Search,
  Sparkles,
  DollarSign,
  X,
  Clock,
  ChevronRight,
  Filter,
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
  status: string;
  specialRequests?: string;
  hotel: {
    name: string;
    city: string;
    address: string;
  };
}

export default function PatientAccommodationsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Booking Form State
  const [checkInDate, setCheckInDate] = useState('2026-08-10');
  const [checkOutDate, setCheckOutDate] = useState('2026-08-15');
  const [roomType, setRoomType] = useState('Deluxe Medical Suite with Recliner');
  const [numGuests, setNumGuests] = useState('2');
  const [specialRequests, setSpecialRequests] = useState('Ground floor suite preferred. Wheelchair access and Arabic halal meal plan requested.');

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
      if (bookingsData.success) setMyBookings(bookingsData.data.bookings || []);
    } catch (err) {
      console.error('Failed to load accommodations marketplace', err);
      toast.apiError(err, 'Failed to load hotels', 'Marketplace Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBookingModal = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setIsBookingModalOpen(true);
  };

  const calculateStayPrice = () => {
    if (!selectedHotel) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return nights * Number(selectedHotel.nightlyRateUsd);
  };

  const handleBookHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotel) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/accommodations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: selectedHotel.id,
          checkInDate,
          checkOutDate,
          roomType,
          numGuests,
          specialRequests,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Booking ${data.data.booking.bookingNo} confirmed at ${selectedHotel.name}! Stay voucher generated.`, 'Hotel Stay Reserved');
        setIsBookingModalOpen(false);
        fetchData();
      } else {
        toast.apiError(data, 'Failed to reserve hotel stay', 'Booking Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error completing booking', 'Connection Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading Accommodations Marketplace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 bg-primary-100 text-primary-800 rounded-md text-[11px] font-black uppercase tracking-wider">
            Patient Concierge
          </span>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2 mt-1">
            <Building2 className="w-7 h-7 text-primary-600" />
            Healthcare Partner Accommodations & Recovery Suites
          </h1>
          <p className="text-xs text-surface-500 mt-0.5">
            Verified recovery hotels and service apartments located within 2 km of your treating hospital.
          </p>
        </div>

        {myBookings.length > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-extrabold text-emerald-900">
              {myBookings.length} Active Reservation Voucher
            </span>
          </div>
        )}
      </div>

      {/* ─── Active Patient Hotel Bookings Section (If any) ────────────── */}
      {myBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-surface-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Your Reserved Accommodation Vouchers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myBookings.map((b) => (
              <Card key={b.id} className="p-5 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-white shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-xs font-bold uppercase tracking-wider">
                    Voucher: {b.bookingNo}
                  </span>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {b.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-surface-900">{b.hotel?.name}</h3>
                  <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-600" /> {b.hotel?.address}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-surface-100">
                  <div>
                    <span className="text-xs font-bold text-surface-500 block">Check-In / Out</span>
                    <span className="font-extrabold text-surface-800">
                      {new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-surface-500 block">Total Stay Price</span>
                    <span className="font-black text-emerald-800">${Number(b.totalAmountUsd).toFixed(2)} USD</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── Accommodations Marketplace Grid ──────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          Browse Nearby Partner Hotels & Guest Suites ({hotels.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hotels.map((hotel) => {
            const imageList = Array.isArray(hotel.images) ? hotel.images : [];
            const amenityList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
            const primaryImg = imageList[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

            return (
              <Card key={hotel.id} className="rounded-3xl border border-surface-200 overflow-hidden bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  {/* Photo Gallery Banner */}
                  <div className="relative h-48 w-full bg-surface-100 overflow-hidden">
                    <img src={primaryImg} alt={hotel.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-amber-400 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 border border-white/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {hotel.starRating}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-surface-900 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1 border border-surface-200 shadow-2xs">
                      <MapPin className="w-3.5 h-3.5 text-primary-600" /> {hotel.distanceKm} km to hospital
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-extrabold text-surface-900 leading-snug">{hotel.name}</h3>
                      <p className="text-xs text-surface-500 mt-0.5">{hotel.address}</p>
                    </div>

                    <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">{hotel.description}</p>

                    {/* Medical Amenities Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {amenityList.map((amenity, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-primary-50 text-primary-800 rounded-md text-xs font-semibold border border-primary-100">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Pricing & Reserve Button */}
                <div className="p-5 pt-0 border-t border-surface-100 mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider block">Nightly Rate</span>
                    <span className="text-lg font-black text-surface-900">${Number(hotel.nightlyRateUsd)} <span className="text-xs text-surface-500 font-semibold">/ night</span></span>
                  </div>

                  <Button
                    onClick={() => handleOpenBookingModal(hotel)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs"
                  >
                    Reserve Stay <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Reserve Hotel Stay Modal ──────────────────────────────────── */}
      {isBookingModalOpen && selectedHotel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl border border-surface-200 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase text-primary-700 tracking-wider">Hotel Reservation</span>
                <h3 className="text-lg font-extrabold text-surface-900 mt-0.5">{selectedHotel.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="p-1 text-surface-400 hover:text-surface-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookHotel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Check-In Date</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Check-Out Date</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Room Type</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                  >
                    <option value="Deluxe Medical Suite with Recliner">Deluxe Medical Suite with Recliner</option>
                    <option value="Executive Attendant Family Suite">Executive Attendant Family Suite</option>
                    <option value="Standard Recovery Room">Standard Recovery Room</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-surface-700">Number of Guests</label>
                  <input
                    type="number"
                    value={numGuests}
                    onChange={(e) => setNumGuests(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-surface-700">Special Medical / Dietary Requests</label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none"
                />
              </div>

              {/* Calculated Price Summary */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider block">Estimated Total Stay Cost</span>
                  <span className="text-xl font-black text-emerald-900">${calculateStayPrice().toFixed(2)} USD</span>
                </div>

                <span className="text-xs font-bold text-emerald-700 bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                  Pay at Check-In / Voucher Generated
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
                <Button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  variant="secondary"
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSubmitting ? 'Reserving...' : 'Confirm Stay Reservation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
