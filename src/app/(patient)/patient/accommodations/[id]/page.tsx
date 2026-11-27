'use client';

/**
 * MediRoute India — Accommodation Detail & Reservation Page
 * Property view with photo gallery, amenities breakdown, room options, stay rules, and reservation form.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { PriceTag } from '@/components/ui/PriceTag';
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

  const images = Array.isArray(hotel.images) ? hotel.images : [];

  const amenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];

  const nights = calculateNights(checkInDate, checkOutDate);
  const baseRate = Number(hotel.pricingPerNight || 0);
  const totalCost = nights * baseRate;

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div className="space-y-1">
          <Link href="/patient/accommodations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Accommodations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{hotel.name}</h1>
            {hotel.rating != null && (
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-semibold flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {hotel.rating} / 5.0
              </span>
            )}
          </div>
          <p className="text-xs text-surface-600 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" /> {hotel.address}, {hotel.city}
            {hotel.distanceToHospital && (
              <>
                {' · '}
                <span className="font-semibold text-primary-700">{hotel.distanceToHospital}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hotel.contactPhone && (
            <a href={`tel:${hotel.contactPhone}`} className="px-3.5 py-2 bg-white hover:bg-surface-50 text-surface-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-surface-200">
              <Phone className="w-3.5 h-3.5 text-primary-700" /> {hotel.contactPhone}
            </a>
          )}
        </div>
      </div>

      {/* Property Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-xl overflow-hidden border border-surface-200 bg-surface-100">
        <div className="lg:col-span-2 h-[320px] sm:h-[380px] relative flex items-center justify-center bg-surface-200">
          {images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[activeImageIndex] || images[0]}
                alt={hotel.name}
                className="w-full h-full object-cover"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-surface-400">
              <Building2 className="w-12 h-12" />
              <span className="text-xs">No property photos provided</span>
            </div>
          )}
          <div className="absolute top-3 left-3 bg-surface-950/80 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success-400" /> Verified Partner Property
          </div>
        </div>

        {images.length > 1 && (
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 p-2 bg-white overflow-y-auto max-h-[380px]">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`h-24 sm:h-28 rounded-lg overflow-hidden relative border-2 transition-colors ${
                  activeImageIndex === idx ? 'border-primary-600' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Details (Left) + Booking Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="space-y-4">
            <div className="border-b border-surface-200 pb-3">
              <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-700" /> Property Overview
              </h2>
            </div>
            <p className="text-xs text-surface-700 leading-relaxed">
              {hotel.description || 'Hospital-adjacent partner property supporting patient and attendant accommodation during treatment.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-surface-50 border border-surface-200 rounded-lg flex items-start gap-2.5">
                <HeartHandshake className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-surface-900 text-xs">Recovery Support</h3>
                  <p className="text-[11px] text-surface-600 mt-0.5">Designed for pre-op and post-discharge stays with attendant seating.</p>
                </div>
              </div>

              <div className="p-3.5 bg-surface-50 border border-surface-200 rounded-lg flex items-start gap-2.5">
                <Car className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-surface-900 text-xs">Hospital Access</h3>
                  <p className="text-[11px] text-surface-600 mt-0.5">Coordinate hospital transfers directly with your case manager.</p>
                </div>
              </div>
            </div>
          </Card>

          {amenities.length > 0 && (
            <Card className="space-y-4">
              <div className="border-b border-surface-200 pb-3">
                <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary-700" /> Amenities &amp; Care Features
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {amenities.map((amenity) => (
                  <div key={amenity} className="p-2.5 bg-surface-50 border border-surface-200 rounded-lg flex items-center gap-2 font-medium text-surface-800 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Room Categories */}
          <Card className="space-y-4">
            <div className="border-b border-surface-200 pb-3">
              <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary-700" /> Room Options &amp; Base Rates
              </h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 border border-surface-200 rounded-lg bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Single Private Room</h3>
                  <p className="text-xs text-surface-600 mt-0.5">Private patient room with attendant sofa, Wi-Fi, and bathroom access.</p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-base font-bold text-surface-900"><PriceTag amountInINR={baseRate} /></p>
                  <p className="text-[11px] text-surface-500">per night</p>
                </div>
              </div>

              <div className="p-4 border border-surface-200 rounded-lg bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Double Family Suite</h3>
                  <p className="text-xs text-surface-600 mt-0.5">Two-bed configuration suited for patient and accompanying caregiver.</p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-base font-bold text-surface-900"><PriceTag amountInINR={Math.round(baseRate * 1.35)} /></p>
                  <p className="text-[11px] text-surface-500">per night</p>
                </div>
              </div>

              <div className="p-4 border border-surface-200 rounded-lg bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Executive Suite</h3>
                  <p className="text-xs text-surface-600 mt-0.5">Separate living area and expanded space for extended recovery stays.</p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-base font-bold text-surface-900"><PriceTag amountInINR={Math.round(baseRate * 1.8)} /></p>
                  <p className="text-[11px] text-surface-500">per night</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Stay Policies */}
          <Card className="space-y-3">
            <div className="border-b border-surface-200 pb-3">
              <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-700" /> Stay Policies &amp; House Rules
              </h2>
            </div>
            <p className="text-xs text-surface-700 leading-relaxed">
              {hotel.rules || 'Check-in: 12:00 PM | Check-out: 11:00 AM. One attendant permitted per patient room.'}
            </p>
          </Card>
        </div>

        {/* Right Column: Booking Summary */}
        <div className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
          <Card className="p-6 border-primary-200 shadow-sm bg-white space-y-5">
            <div className="flex justify-between items-baseline border-b border-surface-200 pb-4">
              <div>
                <span className="text-[11px] uppercase font-semibold text-surface-500 tracking-wider">Base Rate</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold text-surface-900"><PriceTag amountInINR={baseRate} /></span>
                  <span className="text-xs text-surface-500 font-medium">/ night</span>
                </div>
              </div>
              <Badge variant="success" dot>Available</Badge>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <Select
                label="Case Reference"
                value={selectedCaseId}
                onChange={setSelectedCaseId}
                options={cases.map((c) => ({
                  value: c.id,
                  label: `Case ${c.id.slice(-8)} (${c.status})`,
                }))}
                required
              />

              <Select
                label="Room Type"
                value={selectedRoomType}
                onChange={(val) => setSelectedRoomType(val as RoomType)}
                options={[
                  { value: RoomType.SINGLE, label: 'Single Private Room' },
                  { value: RoomType.DOUBLE, label: 'Double Family Room' },
                  { value: RoomType.SUITE, label: 'Executive Suite' },
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

              {nights > 0 && (
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-surface-700 font-medium">
                    <span><PriceTag amountInINR={baseRate} /> × {nights} nights</span>
                    <span><PriceTag amountInINR={totalCost} /></span>
                  </div>
                  <div className="border-t border-primary-200 pt-2 flex justify-between font-bold text-primary-950 text-sm">
                    <span>Estimated Total</span>
                    <span><PriceTag amountInINR={totalCost} /></span>
                  </div>
                </div>
              )}

              <Button type="submit" fullWidth size="md" isLoading={submitting}>
                Request Stay Booking
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
