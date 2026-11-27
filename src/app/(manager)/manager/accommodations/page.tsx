'use client';

/**
 * MediRoute India — Manager Accommodation bookings coordinator
 * Track, book, and update local hostel accommodation parameters.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';

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
        await res.json();
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
                        className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                          booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED'
                            ? 'bg-surface-100 text-surface-600 border-surface-200'
                            : booking.status === 'CHECKED_IN'
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : booking.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-primary-50 text-primary-700 border-primary-200'
                        }`}
                      >
                        {booking.status === 'PENDING' ? 'Pending Review' : booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        {booking.status === 'PENDING' && (
                          <Button size="sm" onClick={() => handleUpdateStatus(booking.id, AccommodationStatus.CONFIRMED)}>
                            Approve Stay
                          </Button>
                        )}
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
      <Modal
        open={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Book Stay Accommodation"
        maxWidth="md"
      >
        {formError && (
          <div className="bg-danger-50 text-danger-700 p-2.5 rounded-lg border border-danger-200 mb-4 text-xs">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateBooking} className="space-y-4 font-semibold text-surface-700">
          <Select
            label="Patient"
            value={targetPatientId}
            onChange={setTargetPatientId}
            options={[
              { value: '', label: 'Select patient' },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.user.fullName} ${p.cases.length === 0 ? '(No active case)' : ''}`,
              })),
            ]}
            required
          />

          <Select
            label="Property"
            value={targetHostelId}
            onChange={setTargetHostelId}
            options={[
              { value: '', label: 'Select partner property' },
              ...hostels.map((h) => ({
                value: h.id,
                label: `${h.name} (${h.city}) — ₹${Number(h.pricingPerNight).toLocaleString()}/night`,
              })),
            ]}
            required
          />

          <Select
            label="Room Type"
            value={targetRoomType}
            onChange={(val) => setTargetRoomType(val as RoomType)}
            options={[
              { value: RoomType.SINGLE, label: 'Single Private Room' },
              { value: RoomType.DOUBLE, label: 'Shared Double Room' },
              { value: RoomType.SUITE, label: 'Executive Suite' },
              { value: RoomType.DORMITORY, label: 'Shared Ward Room' },
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <DatePicker label="Check-in Date" value={checkInDate} onChange={setCheckInDate} placeholder="Pick check-in" />
            <DatePicker label="Check-out Date" value={checkOutDate} onChange={setCheckOutDate} placeholder="Pick check-out" />
          </div>

          <div className="pt-3 border-t border-surface-200 flex gap-2">
            <Button className="flex-1" variant="secondary" type="button" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" type="submit" disabled={submitting}>
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
