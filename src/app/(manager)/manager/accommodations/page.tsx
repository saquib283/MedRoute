'use client';

/**
 * MediRoute India — Manager Accommodation bookings coordinator
 * Track, book, and update local hostel accommodation parameters.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

enum AccommodationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
}

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
  pricingPerNight: number;
}

interface CaseShort {
  id: string;
  status: string;
}

interface PatientShort {
  id: string;
  user: {
    fullName: string;
  };
  cases: CaseShort[];
}

interface Booking {
  id: string;
  caseId: string;
  hostelId: string;
  checkIn: string;
  checkOut: string;
  roomType: RoomType;
  status: AccommodationStatus;
  hostel: Hostel;
  case: {
    patient: {
      user: {
        fullName: string;
      };
    };
  };
}

export default function AccommodationsManager() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [patients, setPatients] = useState<PatientShort[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Form fields
  const [targetPatientId, setTargetPatientId] = useState('');
  const [targetHostelId, setTargetHostelId] = useState('');
  const [targetRoomType, setTargetRoomType] = useState<RoomType>(RoomType.SINGLE);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [bookingsRes, metaRes] = await Promise.all([
          fetch('/api/v1/manager/accommodations'),
          fetch('/api/v1/manager/accommodations?meta=true'),
        ]);

        if (bookingsRes.ok && metaRes.ok) {
          const bookingsData = await bookingsRes.json();
          const metaData = await metaRes.json();
          setBookings(bookingsData.bookings);
          setHostels(metaData.hostels);
          setPatients(metaData.patients);
        }
      } catch (err) {
        console.error('Failed to load accommodations operational metadata:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const patient = patients.find((p) => p.id === targetPatientId);
    const activeCase = patient?.cases[0];

    if (!activeCase) {
      setFormError('Patient must have an active case open to schedule lodging.');
      return;
    }

    if (!targetHostelId || !checkInDate || !checkOutDate) {
      setFormError('Please populate all booking dates and hostel targets.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/manager/accommodations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeCase.id,
          hostelId: targetHostelId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          roomType: targetRoomType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reload list
        const reloadRes = await fetch('/api/v1/manager/accommodations');
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          setBookings(reloadData.bookings);
        }
        setIsBookModalOpen(false);
        // Reset form
        setTargetPatientId('');
        setTargetHostelId('');
        setTargetRoomType(RoomType.SINGLE);
        setCheckInDate('');
        setCheckOutDate('');
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to request lodging.');
      }
    } catch (err) {
      console.error('Accommodation booking failed:', err);
      setFormError('Lodging registration encounter error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: AccommodationStatus) => {
    try {
      const res = await fetch('/api/v1/manager/accommodations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          status,
        }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
        );
        setSelectedBooking(null);
      }
    } catch (err) {
      console.error('Failed to update booking status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading accommodations register...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[500px] text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Hostel Accommodations</h1>
          <p className="text-sm text-surface-500 mt-1">Book and manage verified local recuperation hostels for patients.</p>
        </div>
        <Button size="sm" onClick={() => setIsBookModalOpen(true)}>
          Book Lodging
        </Button>
      </div>

      {/* Bookings Table List */}
      <Card className="bg-white overflow-hidden border border-surface-200/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200/60">
                <th className="px-6 py-4 font-semibold text-surface-700">Patient</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Hostel Address</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Room Details</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Dates</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Status</th>
                <th className="px-6 py-4 font-semibold text-surface-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200/50">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-surface-400">
                    No active hostel bookings recorded.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-surface-50/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-surface-900">{booking.case.patient.user.fullName}</p>
                      <p className="text-[10px] text-surface-400 font-mono">Case: {booking.caseId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-surface-900">{booking.hostel.name}</p>
                      <p className="text-[10px] text-surface-500">{booking.hostel.city}</p>
                    </td>
                    <td className="px-6 py-4 text-surface-600 font-medium">
                      {booking.roomType}
                    </td>
                    <td className="px-6 py-4 text-surface-600">
                      <p>
                        In:{' '}
                        {new Date(booking.checkIn).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p>
                        Out:{' '}
                        {new Date(booking.checkOut).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED'
                            ? 'bg-surface-100 text-surface-600 border border-surface-200'
                            : booking.status === 'CHECKED_IN'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : 'bg-primary-50 text-primary-700 border border-primary-200'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        {booking.status === 'CONFIRMED' && (
                          <Button size="sm" onClick={() => handleUpdateStatus(booking.id, AccommodationStatus.CHECKED_IN)}>
                            Check In
                          </Button>
                        )}
                        {booking.status === 'CHECKED_IN' && (
                          <Button size="sm" onClick={() => handleUpdateStatus(booking.id, AccommodationStatus.CHECKED_OUT)}>
                            Check Out
                          </Button>
                        )}
                        {booking.status !== 'CANCELLED' && booking.status !== 'CHECKED_OUT' && (
                          <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(booking.id, AccommodationStatus.CANCELLED)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Booking Wizard Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 bg-surface-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="bg-white max-w-md w-full p-6 space-y-4 border border-surface-200 shadow-lg animate-slide-up">
            <div className="flex justify-between items-center pb-2.5 border-b border-surface-100">
              <h3 className="font-bold text-surface-900 text-base">Book Hostel Lodging</h3>
              <button onClick={() => setIsBookModalOpen(false)} className="text-surface-400 hover:text-surface-600 font-semibold text-sm">
                Cancel
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-700 p-2.5 rounded border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="space-y-4 font-semibold text-surface-700">
              {/* Select Patient */}
              <div className="space-y-1">
                <label htmlFor="patient" className="block">Patient Selection</label>
                <select
                  id="patient"
                  className="w-full p-2.5 rounded border border-surface-300 bg-white font-medium text-surface-800"
                  value={targetPatientId}
                  onChange={(e) => setTargetPatientId(e.target.value)}
                >
                  <option value="">-- Choose patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user.fullName} {p.cases.length === 0 ? '(No active cases)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Hostel */}
              <div className="space-y-1">
                <label htmlFor="hostel" className="block">Hostel Property</label>
                <select
                  id="hostel"
                  className="w-full p-2.5 rounded border border-surface-300 bg-white font-medium text-surface-800"
                  value={targetHostelId}
                  onChange={(e) => setTargetHostelId(e.target.value)}
                >
                  <option value="">-- Choose partner hostel --</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city}) — ${h.pricingPerNight}/night
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Type */}
              <div className="space-y-1">
                <label htmlFor="room" className="block">Room Type</label>
                <select
                  id="room"
                  className="w-full p-2.5 rounded border border-surface-300 bg-white font-medium text-surface-800"
                  value={targetRoomType}
                  onChange={(e) => setTargetRoomType(e.target.value as RoomType)}
                >
                  <option value={RoomType.SINGLE}>Single Private Room</option>
                  <option value={RoomType.DOUBLE}>Shared Double Room</option>
                  <option value={RoomType.SUITE}>Full Recovery Suite</option>
                  <option value={RoomType.DORMITORY}>Shared Ward Room</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="checkin" className="block">Check-in Date</label>
                  <input
                    type="date"
                    id="checkin"
                    className="w-full p-2.5 rounded border border-surface-300 font-medium text-surface-800"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkout" className="block">Check-out Date</label>
                  <input
                    type="date"
                    id="checkout"
                    className="w-full p-2.5 rounded border border-surface-300 font-medium text-surface-800"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-surface-100 flex gap-2">
                <Button className="flex-1" type="submit" disabled={submitting}>
                  {submitting ? 'Registering booking...' : 'Confirm Lodging'}
                </Button>
                <Button className="flex-1" variant="secondary" type="button" onClick={() => setIsBookModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
