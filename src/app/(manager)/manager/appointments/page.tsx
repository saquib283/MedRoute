'use client';

/**
 * MediRoute India — Manager Appointments scheduler controller
 * Schedule, reschedule, or cancel patient hospital appointments.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';

enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
}

enum AppointmentType {
  CONSULTATION = 'CONSULTATION',
  PRE_OP_ASSESSMENT = 'PRE_OP_ASSESSMENT',
  SURGERY = 'SURGERY',
  POST_OP_REVIEW = 'POST_OP_REVIEW',
}

interface Doctor {
  id: string;
  fullName: string;
  specialisation: {
    name: string;
  };
}

interface Hospital {
  id: string;
  name: string;
  city: string;
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

interface Appointment {
  id: string;
  caseId: string;
  patientId: string;
  hospitalId: string;
  doctorId: string;
  appointmentType: AppointmentType;
  scheduledAt: string;
  status: AppointmentStatus;
  cancellationReason: string | null;
  patient: {
    user: {
      fullName: string;
    };
  };
  doctor: {
    fullName: string;
    specialisation: {
      name: string;
    };
  };
  hospital: {
    name: string;
    city: string;
  };
}

export default function AppointmentsManager() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<PatientShort[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab Filtering
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');

  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);

  // Form fields: Create
  const [targetPatientId, setTargetPatientId] = useState('');
  const [targetHospitalId, setTargetHospitalId] = useState('');
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [targetApptType, setTargetApptType] = useState<AppointmentType>(AppointmentType.CONSULTATION);
  const [scheduledAtStr, setScheduledAtStr] = useState('');
  
  // Form fields: Reschedule/Cancel
  const [rescheduleDateStr, setRescheduleDateStr] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [apptsRes, metaRes] = await Promise.all([
          fetch('/api/v1/manager/appointments'),
          fetch('/api/v1/manager/appointments?meta=true'),
        ]);

        if (apptsRes.ok && metaRes.ok) {
          const apptsData = await apptsRes.json();
          const metaData = await metaRes.json();
          setAppointments(apptsData.appointments);
          setHospitals(metaData.hospitals);
          setDoctors(metaData.doctors);
          setPatients(metaData.patients);
        }
      } catch (err) {
        console.error('Failed to load appointments metadata:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const patient = patients.find((p) => p.id === targetPatientId);
    const activeCase = patient?.cases[0];

    if (!activeCase) {
      setFormError('Patient must have an active case open to schedule encounters.');
      return;
    }

    if (!targetHospitalId || !targetDoctorId || !scheduledAtStr) {
      setFormError('Please fill out hospital, clinical doctor, and scheduled time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/manager/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeCase.id,
          patientId: targetPatientId,
          hospitalId: targetHospitalId,
          doctorId: targetDoctorId,
          appointmentType: targetApptType,
          scheduledAt: scheduledAtStr,
        }),
      });

      if (res.ok) {
        const reloadRes = await fetch('/api/v1/manager/appointments');
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          setAppointments(reloadData.appointments);
        }
        setIsBookModalOpen(false);
        // Reset
        setTargetPatientId('');
        setTargetHospitalId('');
        setTargetDoctorId('');
        setTargetApptType(AppointmentType.CONSULTATION);
        setScheduledAtStr('');
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to schedule appointment.');
      }
    } catch (err) {
      console.error('Appointment schedule failed:', err);
      setFormError('Appointment registration encountered error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingAppt || !rescheduleDateStr) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/manager/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: reschedulingAppt.id,
          scheduledAt: rescheduleDateStr,
          status: AppointmentStatus.RESCHEDULED,
        }),
      });

      if (res.ok) {
        await res.json();
        setAppointments((prev) =>
          prev.map((a) => (a.id === reschedulingAppt.id ? { ...a, scheduledAt: rescheduleDateStr, status: AppointmentStatus.RESCHEDULED } : a))
        );
        setReschedulingAppt(null);
        setRescheduleDateStr('');
      }
    } catch (err) {
      console.error('Reschedule failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingAppt || !cancellationReason) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/manager/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: cancellingAppt.id,
          status: AppointmentStatus.CANCELLED,
          cancellationReason,
        }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === cancellingAppt.id ? { ...a, status: AppointmentStatus.CANCELLED, cancellationReason } : a))
        );
        setCancellingAppt(null);
        setCancellationReason('');
      }
    } catch (err) {
      console.error('Cancellation failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const upcomingAppointments = appointments.filter(
    (a) => new Date(a.scheduledAt).getTime() >= new Date().getTime() && a.status !== 'CANCELLED'
  );
  
  const pastAppointments = appointments.filter(
    (a) => new Date(a.scheduledAt).getTime() < new Date().getTime() || a.status === 'CANCELLED'
  );

  const activeRoster = activeTab === 'UPCOMING' ? upcomingAppointments : pastAppointments;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading appointments schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[500px] text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Clinical Appointments</h1>
          <p className="text-sm text-surface-500 mt-1">Schedule, reschedule, or cancel patient hospital consultations, assessments, and surgeries.</p>
        </div>
        <Button size="sm" onClick={() => setIsBookModalOpen(true)}>
          Book Appointment
        </Button>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-surface-200 bg-white rounded-t-lg overflow-x-auto flex">
        <button
          type="button"
          className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'UPCOMING'
              ? 'border-primary-600 text-primary-700 bg-primary-50/40'
              : 'border-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-50'
          }`}
          onClick={() => setActiveTab('UPCOMING')}
        >
          Upcoming Appointments ({upcomingAppointments.length})
        </button>
        <button
          type="button"
          className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'PAST'
              ? 'border-primary-600 text-primary-700 bg-primary-50/40'
              : 'border-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-50'
          }`}
          onClick={() => setActiveTab('PAST')}
        >
          Past / Cancelled ({pastAppointments.length})
        </button>
      </div>

      {/* Table list */}
      <Card className="bg-white overflow-hidden border border-surface-200/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200/60">
                <th className="px-6 py-4 font-semibold text-surface-700">Patient</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Doctor / Hospital</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Type</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Scheduled Date</th>
                <th className="px-6 py-4 font-semibold text-surface-700">Status</th>
                <th className="px-6 py-4 font-semibold text-surface-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200/50">
              {activeRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-surface-400">
                    No matching appointments scheduled.
                  </td>
                </tr>
              ) : (
                activeRoster.map((appt) => (
                  <tr key={appt.id} className="hover:bg-surface-50/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-surface-900">{appt.patient.user.fullName}</p>
                      <p className="text-[10px] text-surface-400 font-mono">Case ID: {appt.caseId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-surface-900">Dr. {appt.doctor.fullName}</p>
                      <p className="text-[10px] text-surface-500">
                        {appt.doctor.specialisation.name} • {appt.hospital.name} ({appt.hospital.city})
                      </p>
                    </td>
                    <td className="px-6 py-4 text-surface-600 font-medium">
                      <span className="bg-surface-100 text-surface-700 px-2 py-0.5 rounded text-[10px] border border-surface-200">
                        {appt.appointmentType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-surface-600 font-medium">
                      {new Date(appt.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          appt.status === 'CANCELLED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : appt.status === 'COMPLETED'
                            ? 'bg-surface-100 text-surface-600 border border-surface-200'
                            : 'bg-primary-50 text-primary-700 border border-primary-200'
                        }`}
                      >
                        {appt.status}
                      </span>
                      {appt.cancellationReason && (
                        <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={appt.cancellationReason}>
                          Reason: {appt.cancellationReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                          <>
                            <Button size="sm" onClick={() => setReschedulingAppt(appt)}>
                              Reschedule
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setCancellingAppt(appt)}>
                              Cancel
                            </Button>
                          </>
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

      {/* Booking Modal */}
      <Modal
        open={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Clinic Appointment"
        maxWidth="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-danger-50 text-danger-700 p-2.5 rounded border border-danger-200 text-xs">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateAppointment} className="space-y-4 font-semibold text-surface-700">
            <Select
              label="Patient Selection"
              value={targetPatientId}
              onChange={setTargetPatientId}
              options={[
                { value: '', label: '-- Choose patient --' },
                ...patients.map((p) => ({
                  value: p.id,
                  label: `${p.user.fullName} ${p.cases.length === 0 ? '(No active cases)' : ''}`
                }))
              ]}
              required
            />

            <Select
              label="Partner Hospital"
              value={targetHospitalId}
              onChange={setTargetHospitalId}
              options={[
                { value: '', label: '-- Choose hospital --' },
                ...hospitals.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.city})`
                }))
              ]}
              required
            />

            <Select
              label="Assigned Doctor"
              value={targetDoctorId}
              onChange={setTargetDoctorId}
              options={[
                { value: '', label: '-- Choose doctor --' },
                ...doctors
                  .filter((d) => !targetHospitalId || (d as { hospitalId?: string }).hospitalId === targetHospitalId)
                  .map((d) => ({
                    value: d.id,
                    label: `Dr. ${d.fullName} (${d.specialisation.name})`
                  }))
              ]}
              required
            />

            <Select
              label="Appointment Type"
              value={targetApptType}
              onChange={(val) => setTargetApptType(val as AppointmentType)}
              options={[
                { value: AppointmentType.CONSULTATION, label: 'Clinical Consultation' },
                { value: AppointmentType.PRE_OP_ASSESSMENT, label: 'Pre-Op Assessment' },
                { value: AppointmentType.SURGERY, label: 'Scheduled Surgery' },
                { value: AppointmentType.POST_OP_REVIEW, label: 'Post-Op Review' }
              ]}
              required
            />

            {/* Time */}
            <DatePicker
              label="Scheduled Date & Time"
              value={scheduledAtStr}
              onChange={setScheduledAtStr}
              showTimePicker={true}
              placeholder="Pick date & time"
            />

            <div className="pt-3 border-t border-surface-100 flex gap-2">
              <Button className="flex-1" type="submit" disabled={submitting}>
                {submitting ? 'Scheduling encounter...' : 'Book Appointment'}
              </Button>
              <Button className="flex-1" variant="secondary" type="button" onClick={() => setIsBookModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        open={!!reschedulingAppt}
        onClose={() => setReschedulingAppt(null)}
        title="Reschedule Appointment"
        maxWidth="sm"
      >
        <form onSubmit={handleReschedule} className="space-y-4 font-semibold text-surface-700">
          <DatePicker
            label="New Date & Time"
            value={rescheduleDateStr}
            onChange={setRescheduleDateStr}
            showTimePicker={true}
            placeholder="Pick new date & time"
            required
          />

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" type="submit" disabled={submitting}>
              {submitting ? 'Rescheduling...' : 'Confirm'}
            </Button>
            <Button className="flex-1" variant="secondary" type="button" onClick={() => setReschedulingAppt(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={!!cancellingAppt}
        onClose={() => setCancellingAppt(null)}
        title="Cancel Appointment"
        maxWidth="sm"
      >
        <form onSubmit={handleCancel} className="space-y-4 font-semibold text-surface-700">
          <div className="space-y-1">
            <label htmlFor="reason" className="block">Cancellation Reason</label>
            <textarea
              id="reason"
              rows={3}
              className="w-full p-2.5 rounded border border-surface-300 font-medium text-surface-800"
              placeholder="Explain why consultation is being cancelled (e.g. visa delay, patient request)..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" type="submit" disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Confirm'}
            </Button>
            <Button className="flex-1" variant="secondary" type="button" onClick={() => setCancellingAppt(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
