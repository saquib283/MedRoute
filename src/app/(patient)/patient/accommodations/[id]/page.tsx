'use client';

/**
 * MediRoute India — Dedicated Agoda-Style Hotel Detail & Booking Page
 * Complete hotel property view with photo gallery, medical amenities breakdown, room options, stay rules, and sticky reservation widget.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  ArrowLeft,
  Star,
  MapPin,
  Building2,
  CheckCircle2,
  BedDouble,
  ShieldCheck,
  Phone,
  Clock,
  Sparkles,
  HeartHandshake,
  Car,
} from 'lucide-react';

enum RoomType {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  SUITE = 'SUITE',
  DORMITORY = 'DORMITORY',
}

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
}

interface CaseShort {
  id: string;
  status: string;
}

export default function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const hotelId = resolvedParams.id;

  const [hotel, setHotel] = useState<Hostel | null>(null);
  const [cases, setCases] = useState<CaseShort[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Form State
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>(RoomType.SINGLE);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    async function loadHotelDetails() {
      try {
        const res = await fetch(`/api/v1/patient/accommodations?hotelId=${hotelId}`);
        const data = await res.json();

        if (data.success && data.data?.hotel) {
          setHotel(data.data.hotel);
          setCases(data.data.cases || []);

          if (data.data.cases?.length > 0) {
            setSelectedCaseId(data.data.cases[0].id);
          }
        } else {
          toast.error('Failed to load hotel property details');
        }
      } catch (err) {
        console.error('Failed to fetch hotel details:', err);
        toast.error('Network error loading hotel details');
      } finally {
        setLoading(false);
      }
    }

    loadHotelDetails();
  }, [hotelId]);

  const calculateNights = (inDate: string, outDate: string) => {
    if (!inDate || !outDate) return 0;
    const diff = new Date(outDate).getTime() - new Date(inDate).getTime();
    const nights = Math.ceil(diff / (1000 * 3600 * 24));
    return nights > 0 ? nights : 0;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCaseId) {
      toast.error('You must have an active medical care case to book accommodation.');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      toast.error('Please select check-in and check-out dates.');
      return;
    }

    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      toast.error('Check-out date must be after check-in date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/patient/accommodations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseId,
          hostelId: hotelId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          roomType: selectedRoomType,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Hotel stay reserved successfully! Your case coordinator will confirm your room.');
        setCheckInDate('');
        setCheckOutDate('');
      } else {
        toast.error(data.error?.message || 'Failed to submit stay reservation');
      }
    } catch (err) {
      console.error('Booking error:', err);
      toast.error('Failed to register hotel booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-700">Loading medical hotel property details...</p>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <Building2 className="w-12 h-12 text-surface-400 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900">Hotel Property Not Found</h2>
        <p className="text-sm text-surface-600">The requested accommodation listing does not exist or has been deactivated.</p>
        <Link href="/patient/accommodations">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Hotel Directory
          </Button>
        </Link>
      </div>
    );
  }

  const images = Array.isArray(hotel.images) && hotel.images.length > 0
    ? hotel.images
    : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'];

  const amenities = Array.isArray(hotel.amenities) && hotel.amenities.length > 0
    ? hotel.amenities
    : ['24/7 On-Call Nursing', 'Wheelchair Accessible', 'Hospital Shuttle Service', 'Custom Medical Diets', 'Free High-Speed Wi-Fi', 'Air Conditioned'];

  const nights = calculateNights(checkInDate, checkOutDate);
  const baseRate = Number(hotel.pricingPerNight || 0);
  const totalCost = nights * baseRate;

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-4 animate-fade-in text-xs">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200/80 pb-4">
        <div className="space-y-1">
          <Link href="/patient/accommodations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Medical Hotels Directory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">{hotel.name}</h1>
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {hotel.rating || 4.8} / 5.0
            </span>
          </div>
          <p className="text-xs text-surface-600 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" /> {hotel.address}, {hotel.city} —{' '}
            <span className="font-bold text-primary-700">{hotel.distanceToHospital || 'Proximity to Partner Hospital'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hotel.contactPhone && (
            <a href={`tel:${hotel.contactPhone}`} className="px-3.5 py-2 bg-surface-100 hover:bg-surface-200 text-surface-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-surface-200">
              <Phone className="w-3.5 h-3.5 text-primary-600" /> {hotel.contactPhone}
            </a>
          )}
        </div>
      </div>

      {/* Agoda-style Hero Photo Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-3xl overflow-hidden shadow-sm border border-surface-200 bg-surface-900">
        <div className="lg:col-span-2 h-[340px] sm:h-[420px] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[activeImageIndex] || images[0]}
            alt={hotel.name}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute top-4 left-4 bg-surface-900/80 backdrop-blur-xs text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verified Partner Medical Hotel
          </div>
        </div>

        {/* Thumbnail Stack */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 p-2 bg-surface-900/90 overflow-y-auto max-h-[420px]">
          {images.map((imgUrl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImageIndex(idx)}
              className={`h-24 sm:h-28 rounded-xl overflow-hidden relative border-2 transition-all ${
                activeImageIndex === idx ? 'border-primary-500 ring-2 ring-primary-500/40' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Details (Left) + Sticky Booking Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Details & Amenities */}
        <div className="lg:col-span-2 space-y-8">
          {/* About Property */}
          <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-base font-bold text-surface-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" /> Property Overview & Medical Care Environment
              </h2>
            </div>
            <p className="text-xs text-surface-700 leading-relaxed font-medium">
              {hotel.description ||
                'This medical hotel partner offers sterile, calm, and hospital-adjacent accommodations designed specifically for international medical tourists undergoing surgical procedures, post-op recovery, or long-term therapy.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-primary-50/70 border border-primary-100 rounded-xl flex items-start gap-2.5">
                <HeartHandshake className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-primary-900 text-xs">Medical Concierge Assist</h4>
                  <p className="text-[11px] text-primary-800 mt-0.5 leading-tight">24/7 nursing dispatch and prescription medicine delivery service.</p>
                </div>
              </div>

              <div className="p-3.5 bg-teal-50/70 border border-teal-100 rounded-xl flex items-start gap-2.5">
                <Car className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-teal-900 text-xs">Direct Hospital Transfers</h4>
                  <p className="text-[11px] text-teal-800 mt-0.5 leading-tight">Scheduled shuttle rides directly to partner hospital appointments.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Medical & Hotel Amenities */}
          <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-base font-bold text-surface-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-600" /> Medical Support & Hotel Amenities
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {amenities.map((amenity) => (
                <div key={amenity} className="p-3 bg-surface-50 border border-surface-200/80 rounded-xl flex items-center gap-2 font-semibold text-surface-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Room Categories */}
          <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-base font-bold text-surface-900 tracking-tight flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary-600" /> Available Room Layouts & Rates
              </h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 border border-surface-200 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-surface-900 text-sm">Single Private Recovery Room</h3>
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-bold rounded">Popular</span>
                  </div>
                  <p className="text-xs text-surface-600 mt-1">Adjustable medical bed, attached bathroom with safety rails, attendant couch, AC, Wi-Fi.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-surface-900">₹{baseRate.toLocaleString()}</p>
                  <p className="text-[10px] text-surface-500">per night / incl. taxes</p>
                </div>
              </div>

              <div className="p-4 border border-surface-200 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-surface-900 text-sm">Double Family Suite</h3>
                  <p className="text-xs text-surface-600 mt-1">2 plush beds for patient & companion, mini kitchenette, dining counter, smart TV.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-surface-900">₹{(baseRate * 1.35).toLocaleString()}</p>
                  <p className="text-[10px] text-surface-500">per night / incl. taxes</p>
                </div>
              </div>

              <div className="p-4 border border-surface-200 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-surface-900 text-sm">Full Care Executive Suite</h3>
                  <p className="text-xs text-surface-600 mt-1">Spacious 2-room layout with private nursing console, living room, and balcony.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-surface-900">₹{(baseRate * 1.8).toLocaleString()}</p>
                  <p className="text-[10px] text-surface-500">per night / incl. taxes</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Hotel Policies & Rules */}
          <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-3">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-base font-bold text-surface-900 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" /> Stay Policies & House Rules
              </h2>
            </div>
            <p className="text-xs text-surface-700 leading-relaxed font-medium">
              {hotel.rules || 'Check-in: 12:00 PM | Check-out: 11:00 AM. 24/7 reception desk available. 1 attendant stay permitted per patient room.'}
            </p>
          </Card>
        </div>

        {/* Right Column: Sticky Agoda-style Booking Card */}
        <div className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
          <Card className="p-6 rounded-3xl border border-primary-200 shadow-lg bg-white space-y-5">
            <div className="flex justify-between items-baseline border-b border-surface-100 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">Starting Rate</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-extrabold text-surface-900">₹{baseRate.toLocaleString()}</span>
                  <span className="text-xs text-surface-500 font-semibold">/ night</span>
                </div>
              </div>
              <Badge variant="success" dot>Available</Badge>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <Select
                label="Target Care Case"
                value={selectedCaseId}
                onChange={setSelectedCaseId}
                options={cases.map((c) => ({
                  value: c.id,
                  label: `Active Case ID: ${c.id.slice(-8)} (${c.status})`,
                }))}
                required
              />

              <Select
                label="Room Layout Option"
                value={selectedRoomType}
                onChange={(val) => setSelectedRoomType(val as RoomType)}
                options={[
                  { value: RoomType.SINGLE, label: 'Single Private Room' },
                  { value: RoomType.DOUBLE, label: 'Double Family Room' },
                  { value: RoomType.SUITE, label: 'Full Executive Suite' },
                  { value: RoomType.DORMITORY, label: 'Shared Recovery Ward' },
                ]}
                required
              />

              <div className="space-y-3">
                <DatePicker
                  label="Check-In Date"
                  value={checkInDate}
                  onChange={setCheckInDate}
                  placeholder="Select check-in"
                />
                <DatePicker
                  label="Check-Out Date"
                  value={checkOutDate}
                  onChange={setCheckOutDate}
                  placeholder="Select check-out"
                />
              </div>

              {/* Real-time price calculator */}
              {nights > 0 && (
                <div className="p-4 bg-primary-50/80 border border-primary-200/80 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between text-surface-700 font-medium">
                    <span>₹{baseRate.toLocaleString()} x {nights} Nights</span>
                    <span>₹{totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-surface-700 font-medium">
                    <span>Medical Assist & Shuttle Fee</span>
                    <span className="text-emerald-700 font-bold">FREE</span>
                  </div>
                  <div className="border-t border-primary-200/60 pt-2 flex justify-between font-extrabold text-primary-950 text-sm">
                    <span>Total Est. Stay Cost</span>
                    <span>₹{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <Button type="submit" fullWidth size="lg" isLoading={submitting} className="font-bold">
                Book Stay Now
              </Button>
            </form>

            <div className="pt-2 text-center text-[11px] text-surface-500 font-medium flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-600" /> Free Cancellation up to 24h prior to check-in.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
