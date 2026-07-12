'use client';

/**
 * MediRoute India — Patient Appointments Page
 * Lists upcoming/past appointments and provides a booking wizard modal.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants';

interface Hospital {
  id: string;
  name: string;
  city: string;
}

interface Doctor {
  id: string;
  fullName: string;
  hospitalId: string;
}

interface Appointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  status: string;
  cancellationReason: string | null;
  hospital: {
    name: string;
    city: string;
  };
  doctor: {
    fullName: string;
    qualification: string | null;
  };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for booking modal
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedType, setSelectedType] = useState('CONSULTATION');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Load appointments + meta (hospitals, doctors, activeCaseId)
      const res = await fetch('/api/v1/patient/appointments?meta=true', { headers });
      const data = await res.json();

      if (data.success && data.data) {
        setAppointments(data.data.appointments || []);
        if (data.data.metadata) {
          setHospitals(data.data.metadata.hospitals || []);
          setDoctors(data.data.metadata.doctors || []);
          setActiveCaseId(data.data.metadata.activeCaseId || null);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeCaseId) {
      setErrorMsg('No active care case found. Please contact coordinator first.');
      return;
    }
    if (!selectedHospital || !selectedDoctor || !scheduledAt) {
      setErrorMsg('Please complete all form fields.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/patient/appointments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          caseId: activeCaseId,
          hospitalId: selectedHospital,
          doctorId: selectedDoctor,
          appointmentType: selectedType,
          scheduledAt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        // Reset inputs
        setSelectedHospital('');
        setSelectedDoctor('');
        setSelectedType('CONSULTATION');
        setScheduledAt('');
        // Reload list
        fetchAppointments();
      } else {
        setErrorMsg(data.error?.message || 'Failed to book appointment.');
      }
    } catch {
      setErrorMsg('Network error booking appointment. Please try again.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Filters doctor options by selected hospital
  const filteredDoctors = doctors.filter((doc) => doc.hospitalId === selectedHospital);

  const upcomingAppointments = appointments.filter(
    (app) => new Date(app.scheduledAt) >= new Date()
  );
  const pastAppointments = appointments.filter(
    (app) => new Date(app.scheduledAt) < new Date()
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      case 'SCHEDULED':
      case 'RESCHEDULED':
        return 'primary';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Loading appointments schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Overview Titles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">Appointments Timeline</h1>
          <p className="text-xs text-surface-500 mt-1">Review scheduled clinical sessions and surgeon consults.</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          Book Consultation
        </Button>
      </div>

      {/* ─── Tabs / Split List ─── */}
      <div className="space-y-8">
        {/* Upcoming appointments block */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Upcoming Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingAppointments.map((app) => (
              <Card key={app.id} className="relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider block">
                      {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                    </span>
                    <h3 className="text-sm font-bold text-surface-900 mt-1">Dr. {app.doctor.fullName}</h3>
                    {app.doctor.qualification && (
                      <p className="text-[11px] text-surface-500">{app.doctor.qualification}</p>
                    )}
                    <div className="mt-3.5 space-y-1 text-xs text-surface-600">
                      <p className="flex items-center gap-1.5">
                        <strong>Hospital:</strong> {app.hospital.name} ({app.hospital.city})
                      </p>
                      <p className="flex items-center gap-1.5 font-medium text-surface-700">
                        <strong>Date:</strong> {new Date(app.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(app.status)} dot>
                    {app.status}
                  </Badge>
                </div>
                {app.status === 'CANCELLED' && app.cancellationReason && (
                  <div className="mt-3 p-2 bg-danger-50 border border-danger-100 rounded text-[11px] text-danger-700">
                    <strong>Cancellation Reason:</strong> {app.cancellationReason}
                  </div>
                )}
              </Card>
            ))}
            {upcomingAppointments.length === 0 && (
              <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-8 text-center text-xs text-surface-500">
                No upcoming consultations scheduled. Click &quot;Book Consultation&quot; to file a request.
              </div>
            )}
          </div>
        </section>

        {/* Past Consultations Block */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Historical Sessions</h2>
          <div className="border border-surface-200 rounded-md bg-white overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold">
                  <th className="p-3">Date</th>
                  <th className="p-3">Clinician</th>
                  <th className="p-3">Accredited Hospital</th>
                  <th className="p-3">Category Type</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {pastAppointments.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-50">
                    <td className="p-3 whitespace-nowrap font-medium text-surface-800">
                      {new Date(app.scheduledAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">Dr. {app.doctor.fullName}</td>
                    <td className="p-3">{app.hospital.name}</td>
                    <td className="p-3">
                      {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                    </td>
                    <td className="p-3">
                      <Badge variant={getStatusBadgeVariant(app.status)}>
                        {app.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {pastAppointments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-surface-400">No historical records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ─── Booking Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-surface-200 shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900">Request Care Consultation</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 font-semibold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleBook} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 p-3 rounded-md">
                  {errorMsg}
                </div>
              )}

              {/* Hospital Dropdown */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-surface-600">Select Accredited Hospital</label>
                <select
                  value={selectedHospital}
                  onChange={(e) => {
                    setSelectedHospital(e.target.value);
                    setSelectedDoctor(''); // reset doctor selection
                  }}
                  className="w-full min-h-[44px] px-3 bg-white border border-surface-200 rounded-md text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  required
                >
                  <option value="">Select hospital center</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Dropdown */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-surface-600">Choose Medical Specialist</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  disabled={!selectedHospital}
                  className="w-full min-h-[44px] px-3 bg-white border border-surface-200 rounded-md text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-surface-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select clinician</option>
                  {filteredDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Appointment Type */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-surface-600">Consultation Category Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-surface-200 rounded-md text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  required
                >
                  <option value="CONSULTATION">Consultation</option>
                  <option value="PRE_OP_ASSESSMENT">Pre-op Assessment</option>
                  <option value="SURGERY">Surgery</option>
                  <option value="POST_OP_REVIEW">Post-op Review</option>
                </select>
              </div>

              {/* Date selection */}
              <Input
                label="Preferred Date & Time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitLoading}>
                  Confirm Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
