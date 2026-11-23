'use client';

/**
 * Afzal Healthcare — Recovery Stays & Partner Hotels
 * Patients compare, reserve, and manage healthcare-equipped recovery accommodations
 * near their treating hospital with confirmation guardrails and direct front-desk contact.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  getDefaultStayDates,
  previewHotelStayCost,
} from '@/lib/validation/booking-helpers';
import {
  Building2,
  Star,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Phone,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  distanceKm: number;
  starRating: number;
  nightlyRateUsd: number | string;
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

const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

const ROOM_TYPE_OPTIONS: SelectOption[] = [
  {
    value: 'Deluxe Medical Suite with Recliner',
    label: 'Deluxe Medical Suite with Recliner',
    description: 'Step-free bath, motorized recliner & nurse call bell',
  },
  {
    value: 'Executive Attendant Family Suite',
    label: 'Executive Attendant Family Suite',
    description: 'Separate companion bedroom & kitchenette',
  },
  {
    value: 'Standard Recovery Room',
    label: 'Standard Recovery Room',
    description: 'Quiet floor with elevator access near hospital',
  },
];

const BOOKING_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PENDING: 'Pending Confirmation',
  CHECKED_IN: 'Checked In',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function getSafeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed.replace(/["'()\\]/g, '');
  }
  return null;
}

export default function PatientAccommodationsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation dialog state for destructive reservation cancellation
  const [cancelTargetBooking, setCancelTargetBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Booking Form State — empty specialRequests by default so needs are never submitted unintentionally
  const [defaultDates] = useState(() => getDefaultStayDates());
  const [checkInDate, setCheckInDate] = useState(defaultDates.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(defaultDates.checkOutDate);
  const [roomType, setRoomType] = useState('Deluxe Medical Suite with Recliner');
  const [numGuests, setNumGuests] = useState('2');
  const [specialRequests, setSpecialRequests] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [hotelsRes, bookingsRes] = await Promise.all([
        fetch('/api/v1/accommodations'),
        fetch('/api/v1/accommodations/bookings'),
      ]);

      if (!hotelsRes.ok && !bookingsRes.ok) {
        throw new Error('Unable to load accommodations right now.');
      }

      const [hotelsData, bookingsData] = await Promise.all([
        hotelsRes.json(),
        bookingsRes.json(),
      ]);

      if (hotelsData.success) setHotels(hotelsData.data.hotels || []);
      if (bookingsData.success) setMyBookings(bookingsData.data.bookings || []);
    } catch (err) {
      console.error('Failed to load accommodations marketplace', err);
      setLoadError(
        'Could not load recovery stays and reservations. Please check your connection and try again.'
      );
      toast.apiError(err, 'Failed to load hotels', 'Marketplace Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const hotelContactByName = useMemo(() => {
    const map = new Map<string, string>();
    hotels.forEach((h) => {
      if (h.name && h.contactPhone) {
        map.set(h.name, h.contactPhone);
      }
    });
    return map;
  }, [hotels]);

  const handleOpenBookingModal = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setIsBookingModalOpen(true);
  };

  const stayPreview = selectedHotel
    ? previewHotelStayCost(checkInDate, checkOutDate, Number(selectedHotel.nightlyRateUsd))
    : { valid: false, numNights: 0, totalUsd: 0 };

  const handleBookHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotel || !stayPreview.valid) return;

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
          ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          `Voucher ${data.data.booking.bookingNo} confirmed at ${selectedHotel.name}.`,
          'Recovery Stay Reserved'
        );
        setIsBookingModalOpen(false);
        setSpecialRequests('');
        void fetchData();
      } else {
        toast.apiError(data, 'Failed to reserve hotel stay', 'Booking Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error completing booking', 'Connection Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancelBooking = async () => {
    if (!cancelTargetBooking) return;
    setIsCancelling(true);
    try {
      const res = await fetch('/api/v1/accommodations/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancelTargetBooking.id, status: 'CANCELLED' }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Your hotel reservation has been cancelled.', 'Reservation Cancelled');
        setCancelTargetBooking(null);
        void fetchData();
      } else {
        toast.apiError(data, 'Failed to cancel reservation', 'Cancellation Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error cancelling reservation', 'Connection Error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 py-2">
        <div className="h-16 w-80 rounded-2xl bg-surface-200/70 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-96 rounded-3xl bg-white border border-surface-200 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ─── Single Authoritative Header ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
            Recovery Stays &amp; Partner Hotels
          </h1>
          <p className="text-xs sm:text-sm text-surface-600 mt-1 max-w-2xl">
            Step-free recovery suites and serviced apartments inspected for post-procedure comfort within minutes of your treating hospital.
          </p>
        </div>

        {myBookings.length > 0 && (
          <div className="inline-flex items-center gap-2 bg-success-50 px-4 py-2.5 rounded-2xl border border-success-200 self-start md:self-auto">
            <ShieldCheck className="w-5 h-5 text-success-600 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-success-900 tabular-nums">
              {myBookings.length} Stay Voucher{myBookings.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* ─── Error Recovery Banner ────────────────────────────────────── */}
      {loadError && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Unable to load recovery stays</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* ─── Reserved Stay Vouchers ───────────────────────────────────── */}
      {myBookings.length > 0 && (
        <section aria-labelledby="reserved-vouchers-heading" className="space-y-3.5">
          <h2
            id="reserved-vouchers-heading"
            className="text-base font-bold text-surface-900 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-success-600" aria-hidden="true" />
            <span>Your Stay Vouchers</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myBookings.map((b) => {
              const canCancel = b.status === 'PENDING' || b.status === 'CONFIRMED';
              const isCancelled = b.status === 'CANCELLED';
              const frontDeskPhone = b.hotel?.name ? hotelContactByName.get(b.hotel.name) : undefined;

              return (
                <Card
                  key={b.id}
                  className={`p-5 rounded-3xl border shadow-xs space-y-4 ${
                    isCancelled
                      ? 'border-surface-200 bg-surface-50/70 opacity-85'
                      : 'border-success-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-primary-50 text-primary-900 border border-primary-200 rounded-lg text-xs font-bold uppercase tracking-wider tabular-nums">
                      Voucher {b.bookingNo}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        isCancelled
                          ? 'text-danger-800 bg-danger-50 border-danger-200'
                          : 'text-success-800 bg-success-50 border-success-200'
                      }`}
                    >
                      {BOOKING_STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-surface-900">{b.hotel?.name}</h3>
                    <p className="text-xs text-surface-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" aria-hidden="true" />
                      <span>{b.hotel?.address}</span>
                    </p>
                    <p className="text-xs text-surface-500">{b.roomType}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-surface-100">
                    <div>
                      <span className="text-xs font-semibold text-surface-500 block">
                        Check-In &amp; Check-Out
                      </span>
                      <span className="font-bold text-surface-900 tabular-nums">
                        {new Date(b.checkInDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        –{' '}
                        {new Date(b.checkOutDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-surface-500 block">
                        Total ({b.numNights} {b.numNights === 1 ? 'night' : 'nights'})
                      </span>
                      <span className="font-extrabold text-primary-800 tabular-nums">
                        ${Number(b.totalAmountUsd).toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  {(frontDeskPhone || canCancel) && (
                    <div className="pt-3 border-t border-surface-100 flex items-center justify-between gap-3 flex-wrap">
                      {frontDeskPhone ? (
                        <a
                          href={`tel:${frontDeskPhone}`}
                          className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-surface-50 hover:bg-primary-50 border border-surface-200 text-xs font-semibold text-surface-800 transition-colors tabular-nums"
                        >
                          <Phone className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                          <span>Front Desk: {frontDeskPhone}</span>
                        </a>
                      ) : (
                        <span />
                      )}

                      {canCancel && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setCancelTargetBooking(b)}
                          className="text-danger-700 hover:bg-danger-50 border-danger-200"
                        >
                          Cancel Reservation
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Partner Hotels Grid ──────────────────────────────────────── */}
      {!loadError && (
        <section aria-labelledby="partner-hotels-heading" className="space-y-4">
          <h2
            id="partner-hotels-heading"
            className="text-lg font-bold text-surface-900 flex items-center gap-2"
          >
            <Building2 className="w-5 h-5 text-primary-600" aria-hidden="true" />
            <span>Nearby Partner Hotels ({hotels.length})</span>
          </h2>

          {hotels.length === 0 ? (
            <Card className="p-12 text-center rounded-3xl border border-surface-200 space-y-2">
              <h3 className="text-sm font-bold text-surface-900">No partner hotels listed yet</h3>
              <p className="text-xs text-surface-600 max-w-sm mx-auto">
                Message your care coordinator for curated hospital guest-house recommendations.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map((hotel) => {
                const imageList = Array.isArray(hotel.images) ? hotel.images : [];
                const amenityList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
                const safeImg = getSafeImageUrl(imageList[0] || DEFAULT_IMAGE_URL);

                return (
                  <Card
                    key={hotel.id}
                    padding="sm"
                    className="p-0 rounded-3xl border border-surface-200 overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Photo Banner with subtle 1px optical outline */}
                      <div
                        role="img"
                        aria-label={hotel.name}
                        className="relative h-48 w-full bg-surface-100 bg-cover bg-center overflow-hidden outline-1 -outline-offset-1 outline-black/10"
                        style={safeImg ? { backgroundImage: `url("${safeImg}")` } : undefined}
                      >
                        <div className="absolute top-3 right-3 bg-surface-900/85 backdrop-blur-xs text-warning-300 px-2.5 py-1 rounded-xl text-xs font-bold tabular-nums flex items-center gap-1 border border-white/15">
                          <Star className="w-3.5 h-3.5 fill-warning-400 text-warning-400" aria-hidden="true" />
                          <span>{hotel.starRating}.0</span>
                        </div>
                        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs text-surface-900 px-2.5 py-1 rounded-xl text-xs font-semibold tabular-nums flex items-center gap-1 border border-surface-200 shadow-2xs">
                          <MapPin className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                          <span>{hotel.distanceKm} km from hospital</span>
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="text-base font-bold text-surface-900 leading-snug">
                            {hotel.name}
                          </h3>
                          <p className="text-xs text-surface-500 mt-0.5">{hotel.address}</p>
                        </div>

                        <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
                          {hotel.description}
                        </p>

                        {hotel.contactPhone && (
                          <a
                            href={`tel:${hotel.contactPhone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 min-h-11 tabular-nums"
                          >
                            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{hotel.contactPhone}</span>
                          </a>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {amenityList.map((amenity, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 bg-primary-50 text-primary-800 rounded-md text-xs font-medium border border-primary-200/70"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-4 border-t border-surface-100 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-surface-500 block">
                          Nightly Rate
                        </span>
                        <span className="text-lg font-extrabold text-surface-900 tabular-nums">
                          ${Number(hotel.nightlyRateUsd)}{' '}
                          <span className="text-xs text-surface-500 font-medium">/ night</span>
                        </span>
                      </div>

                      <Button type="button" size="sm" onClick={() => handleOpenBookingModal(hotel)}>
                        <span>Reserve Stay</span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Native <dialog> Reserve Hotel Stay Modal ─────────────────── */}
      <Modal
        open={isBookingModalOpen && Boolean(selectedHotel)}
        onClose={() => setIsBookingModalOpen(false)}
        preventClose={isSubmitting}
        title={selectedHotel ? `Reserve ${selectedHotel.name}` : 'Reserve Recovery Stay'}
        subtitle={
          selectedHotel
            ? `${selectedHotel.address} • ${selectedHotel.distanceKm} km from hospital`
            : undefined
        }
        icon={<Building2 className="w-5 h-5" />}
        maxWidthClass="max-w-xl"
      >
        {selectedHotel && (
          <form onSubmit={handleBookHotel} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="hotel-checkin-date" className="text-xs font-bold text-surface-700 block">
                  Check-In Date
                </label>
                <input
                  id="hotel-checkin-date"
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full min-h-11 px-3.5 bg-white border border-surface-300 rounded-xl text-xs font-semibold text-surface-900 tabular-nums focus:outline-none focus:border-primary-600"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="hotel-checkout-date" className="text-xs font-bold text-surface-700 block">
                  Check-Out Date
                </label>
                <input
                  id="hotel-checkout-date"
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full min-h-11 px-3.5 bg-white border border-surface-300 rounded-xl text-xs font-semibold text-surface-900 tabular-nums focus:outline-none focus:border-primary-600"
                  required
                />
              </div>
            </div>

            {!stayPreview.valid && (
              <p
                role="alert"
                className="text-xs font-semibold text-danger-800 bg-danger-50 border border-danger-200 rounded-xl px-3.5 py-2.5"
              >
                {stayPreview.error || 'Check-out date must be after check-in date.'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Suite Type"
                options={ROOM_TYPE_OPTIONS}
                value={roomType}
                onChange={setRoomType}
                required
              />

              <div className="space-y-1.5">
                <label htmlFor="hotel-num-guests" className="text-xs font-bold text-surface-700 block">
                  Guests (Patient + Companions)
                </label>
                <input
                  id="hotel-num-guests"
                  type="number"
                  min="1"
                  max="10"
                  value={numGuests}
                  onChange={(e) => setNumGuests(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 bg-white border border-surface-200 rounded-xl text-xs font-semibold text-surface-900 tabular-nums focus:outline-none focus:border-primary-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="hotel-special-requests"
                className="text-xs font-bold text-surface-700 block"
              >
                Accessibility, Mobility, or Dietary Notes (Optional)
              </label>
              <textarea
                id="hotel-special-requests"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Optional: e.g. ground-floor room, wheelchair ramp, low-sodium or halal meals, airport pickup..."
                className="w-full p-3.5 bg-white border border-surface-200 rounded-xl text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div className="p-4 bg-success-50 rounded-2xl border border-success-200 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-xs font-semibold text-success-800 block tabular-nums">
                  Estimated Stay ({stayPreview.numNights}{' '}
                  {stayPreview.numNights === 1 ? 'night' : 'nights'})
                </span>
                <span className="text-xl font-extrabold text-success-900 tabular-nums">
                  ${stayPreview.totalUsd.toFixed(2)} USD
                </span>
              </div>

              <span className="text-xs font-semibold text-success-800 bg-white px-3 py-1.5 rounded-xl border border-success-200">
                Pay at check-in • Instant voucher
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsBookingModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={isSubmitting || !stayPreview.valid}
              >
                {isSubmitting ? 'Reserving…' : 'Confirm Stay Reservation'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Destructive Cancellation Confirmation Guardrail ──────────── */}
      <ConfirmDialog
        open={Boolean(cancelTargetBooking)}
        title="Cancel hotel reservation?"
        message={
          cancelTargetBooking
            ? `This will cancel voucher ${cancelTargetBooking.bookingNo} at ${cancelTargetBooking.hotel?.name}. You can book another partner stay at any time.`
            : ''
        }
        cancelLabel="Keep Reservation"
        confirmLabel="Cancel Reservation"
        variant="danger"
        loading={isCancelling}
        onCancel={() => setCancelTargetBooking(null)}
        onConfirm={() => void handleConfirmCancelBooking()}
      />
    </div>
  );
}
