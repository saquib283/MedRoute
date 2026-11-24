'use client';

/**
 * Afzal Healthcare — Manager Appointments scheduler controller
 * Schedule, confirm, complete, reschedule, or cancel patient hospital appointments.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { APPOINTMENT_MODES, APPOINTMENT_MODE_LABELS } from '@/lib/constants';
import {
  formatConsultationScheduleDualTz,
  formatDoctorDisplayName,
} from '@/lib/validation/booking-helpers';
import { Video, Languages, ExternalLink } from 'lucide-react';

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
  hospitalId?: string;
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
  mode?: string;
  meetingUrl?: string | null;
  interpreterLanguage?: string | null;
  scheduledAt: string;
  status: AppointmentStatus;
  cancellationReason: string | null;
  clinicalNotes?: string | null;
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
  const [targetMode, setTargetMode] = useState<string>(APPOINTMENT_MODES.IN_PERSON);
  const [targetMeetingUrl, setTargetMeetingUrl] = useState('');
  const [targetInterpreterLanguage, setTargetInterpreterLanguage] = useState('');
  const [scheduledAtStr, setScheduledAtStr] = useState('');

  // Form fields: Reschedule/Edit/Cancel
  const [rescheduleDateStr, setRescheduleDateStr] = useState('');
  const [editMode, setEditMode] = useState<string>(APPOINTMENT_MODES.IN_PERSON);
  const [editMeetingUrl, setEditMeetingUrl] = useState('');
  const [editInterpreterLanguage, setEditInterpreterLanguage] = useState('');
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
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
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
          mode: targetMode,
          meetingUrl: targetMode === APPOINTMENT_MODES.TELECONSULTATION ? targetMeetingUrl.trim() || null : null,
          interpreterLanguage: targetInterpreterLanguage.trim() || null,
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
        setTargetPatientId('');
        setTargetHospitalId('');
        setTargetDoctorId('');
        setTargetApptType(AppointmentType.CONSULTATION);
        setTargetMode(APPOINTMENT_MODES.IN_PERSON);
        setTargetMeetingUrl('');
        setTargetInterpreterLanguage('');
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

  const handleQuickStatus = async (appointmentId: string, status: AppointmentStatus) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/manager/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
        );
      }
    } catch (err) {
      console.error('Quick status update failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingAppt) return;
    setSubmitting(true);

    const hasNewDate = Boolean(rescheduleDateStr);
    const normalizedMeetingUrl =
      editMode === APPOINTMENT_MODES.TELECONSULTATION ? editMeetingUrl.trim() || null : null;
    const normalizedInterpreter = editInterpreterLanguage.trim() || null;

    try {
      const res = await fetch('/api/v1/manager/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: reschedulingAppt.id,
          mode: editMode,
          meetingUrl: normalizedMeetingUrl,
          interpreterLanguage: normalizedInterpreter,
          ...(hasNewDate
            ? {
                scheduledAt: rescheduleDateStr,
                status: AppointmentStatus.RESCHEDULED,
              }
            : {}),
        }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === reschedulingAppt.id
              ? {
                  ...a,
                  mode: editMode,
                  meetingUrl: normalizedMeetingUrl,
                  interpreterLanguage: normalizedInterpreter,
                  ...(hasNewDate
                    ? { scheduledAt: rescheduleDateStr, status: AppointmentStatus.RESCHEDULED }
                    : {}),
                }
              : a
          )
        );
        setReschedulingAppt(null);
        setRescheduleDateStr('');
        setEditMeetingUrl('');
        setEditInterpreterLanguage('');
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
    (a) => new Date(a.scheduledAt).getTime() >= new Date().getTime() && a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
  );

  const pastAppointments = appointments.filter(
    (a) => new Date(a.scheduledAt).getTime() < new Date().getTime() || a.status === 'CANCELLED' || a.status === 'COMPLETED'
  );

  const activeRoster = activeTab === 'UPCOMING' ? upcomingAppointments : pastAppointments;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-surface-500">Loading appointments schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Clinical Appointments</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Schedule, confirm, complete, reschedule, or cancel patient hospital consultations, assessments, and surgeries.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsBookModalOpen(true)}>
          Book Appointment
        </Button>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-surface-200 flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'UPCOMING'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
          onClick={() => setActiveTab('UPCOMING')}
        >
          <span>Upcoming Appointments</span>
          <span
            className={`px-1.5 py-0.5 text-[11px] rounded font-medium tabular-nums ${
              activeTab === 'UPCOMING'
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'bg-surface-100 text-surface-600'
            }`}
          >
            {upcomingAppointments.length}
          </span>
        </button>
        <button
          type="button"
          className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PAST'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
          onClick={() => setActiveTab('PAST')}
        >
          <span>Past / Completed / Cancelled</span>
          <span
            className={`px-1.5 py-0.5 text-[11px] rounded font-medium tabular-nums ${
              activeTab === 'PAST'
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'bg-surface-100 text-surface-600'
            }`}
          >
            {pastAppointments.length}
          </span>
        </button>
      </div>

      {/* Table list */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Doctor / Hospital</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Type &amp; Mode</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Scheduled Date (IST / Local)</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Status &amp; Notes</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {activeRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-surface-500">
                    No matching appointments scheduled.
                  </td>
                </tr>
              ) : (
                activeRoster.map((appt) => {
                  const dualTz = formatConsultationScheduleDualTz(appt.scheduledAt);
                  const isTeleconsult = appt.mode === APPOINTMENT_MODES.TELECONSULTATION;
                  return (
                    <tr key={appt.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-surface-900">{appt.patient.user.fullName}</p>
                        <p className="text-[11px] text-surface-500 font-mono">Case ID: {appt.caseId}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-surface-900">{formatDoctorDisplayName(appt.doctor.fullName)}</p>
                        <p className="text-xs text-surface-500">
                          {appt.doctor.specialisation.name} • {appt.hospital.name} ({appt.hospital.city})
                        </p>
                      </td>
                      <td className="px-5 py-3.5 space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center bg-surface-100 text-surface-700 px-2 py-0.5 rounded-md text-[11px] font-medium border border-surface-200">
                            {appt.appointmentType.replace(/_/g, ' ')}
                          </span>
                          <Badge variant={isTeleconsult ? 'primary' : 'default'} size="sm">
                            {isTeleconsult && <Video className="w-3 h-3" aria-hidden="true" />}
                            <span>{APPOINTMENT_MODE_LABELS[appt.mode || 'IN_PERSON'] || 'In-Person'}</span>
                          </Badge>
                        </div>
                        {appt.interpreterLanguage && (
                          <Badge variant="info" size="sm">
                            <Languages className="w-3 h-3" aria-hidden="true" />
                            <span>Interpreter: {appt.interpreterLanguage}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-surface-700 tabular-nums">
                        <p className="font-medium text-surface-900">{dualTz.istLabel}</p>
                        <p className="text-[11px] text-surface-500">Local: {dualTz.localLabel}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                            appt.status === 'CANCELLED'
                              ? 'bg-danger-50 text-danger-700 border-danger-200'
                              : appt.status === 'COMPLETED'
                              ? 'bg-surface-100 text-surface-600 border-surface-200'
                              : 'bg-primary-50 text-primary-700 border-primary-200'
                          }`}
                        >
                          {appt.status}
                        </span>
                        {appt.cancellationReason && (
                          <p className="text-xs text-danger-600 mt-1 max-w-[180px] truncate" title={appt.cancellationReason}>
                            Reason: {appt.cancellationReason}
                          </p>
                        )}
                        {appt.clinicalNotes && (
                          <p className="text-xs text-surface-600 mt-1 max-w-[200px] truncate" title={appt.clinicalNotes}>
                            Notes: {appt.clinicalNotes}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {isTeleconsult && appt.meetingUrl && appt.status !== 'CANCELLED' && (
                            <a
                              href={appt.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 min-h-11 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Join Video Consultation</span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          )}
                          {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                            <>
                              {(appt.status === 'SCHEDULED' || appt.status === 'RESCHEDULED') && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={submitting}
                                  onClick={() => handleQuickStatus(appt.id, AppointmentStatus.CONFIRMED)}
                                >
                                  Confirm
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={submitting}
                                onClick={() => handleQuickStatus(appt.id, AppointmentStatus.COMPLETED)}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReschedulingAppt(appt);
                                  setRescheduleDateStr('');
                                  setEditMode(appt.mode || APPOINTMENT_MODES.IN_PERSON);
                                  setEditMeetingUrl(appt.meetingUrl || '');
                                  setEditInterpreterLanguage(appt.interpreterLanguage || '');
                                }}
                              >
                                Reschedule / Video
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setCancellingAppt(appt)}>
                                Cancel
                              </Button>
                            </>
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

      {/* Booking Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 bg-surface-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 border border-surface-200 shadow-md">
            <div className="flex justify-between items-center pb-3 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900 text-base">Schedule Clinic Appointment</h2>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="text-surface-500 hover:text-surface-800 font-medium text-xs"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs text-surface-700">
              <Select
                label="Patient Selection"
                value={targetPatientId}
                onChange={setTargetPatientId}
                options={[
                  { value: '', label: '-- Choose patient --' },
                  ...patients.map((p) => ({
                    value: p.id,
                    label: `${p.user.fullName} ${p.cases.length === 0 ? '(No active cases)' : ''}`,
                  })),
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
                    label: `${h.name} (${h.city})`,
                  })),
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
                    .filter((d) => !targetHospitalId || d.hospitalId === targetHospitalId)
                    .map((d) => ({
                      value: d.id,
                      label: `${formatDoctorDisplayName(d.fullName)} (${d.specialisation.name})`,
                    })),
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
                  { value: AppointmentType.POST_OP_REVIEW, label: 'Post-Op Review' },
                ]}
                required
              />

              <Select
                label="Consultation Mode"
                value={targetMode}
                onChange={setTargetMode}
                options={[
                  {
                    value: APPOINTMENT_MODES.IN_PERSON,
                    label: APPOINTMENT_MODE_LABELS.IN_PERSON,
                  },
                  {
                    value: APPOINTMENT_MODES.TELECONSULTATION,
                    label: APPOINTMENT_MODE_LABELS.TELECONSULTATION,
                  },
                ]}
                required
              />

              {targetMode === APPOINTMENT_MODES.TELECONSULTATION && (
                <Input
                  label="Video Consultation URL"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={targetMeetingUrl}
                  onChange={(e) => setTargetMeetingUrl(e.target.value)}
                />
              )}

              <Input
                label="Medical Interpreter Language (Optional)"
                type="text"
                placeholder="e.g. Arabic, French, Swahili"
                value={targetInterpreterLanguage}
                onChange={(e) => setTargetInterpreterLanguage(e.target.value)}
              />

              <DatePicker
                label="Scheduled Date & Time (IST)"
                value={scheduledAtStr}
                onChange={setScheduledAtStr}
                showTimePicker={true}
                placeholder="Pick date & time"
              />

              <div className="pt-3 border-t border-surface-200 flex gap-2">
                <Button className="flex-1" type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Scheduling encounter...' : 'Book Appointment'}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule / Teleconsultation Modal */}
      {reschedulingAppt && (
        <div className="fixed inset-0 bg-surface-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 border border-surface-200 shadow-md">
            <div className="flex justify-between items-center pb-3 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900 text-sm sm:text-base">
                Update Teleconsultation &amp; Schedule
              </h2>
              <button
                type="button"
                onClick={() => setReschedulingAppt(null)}
                className="text-surface-500 hover:text-surface-800 font-medium text-xs min-h-11 px-2"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleReschedule} className="space-y-4 text-xs text-surface-700">
              <Select
                label="Consultation Mode"
                value={editMode}
                onChange={setEditMode}
                options={[
                  {
                    value: APPOINTMENT_MODES.IN_PERSON,
                    label: APPOINTMENT_MODE_LABELS.IN_PERSON,
                  },
                  {
                    value: APPOINTMENT_MODES.TELECONSULTATION,
                    label: APPOINTMENT_MODE_LABELS.TELECONSULTATION,
                  },
                ]}
                required
              />

              {editMode === APPOINTMENT_MODES.TELECONSULTATION && (
                <Input
                  label="Video Meeting URL"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={editMeetingUrl}
                  onChange={(e) => setEditMeetingUrl(e.target.value)}
                />
              )}

              <Input
                label="Medical Interpreter Language (Optional)"
                type="text"
                placeholder="e.g. Arabic, French, Swahili"
                value={editInterpreterLanguage}
                onChange={(e) => setEditInterpreterLanguage(e.target.value)}
              />

              <DatePicker
                label="New Date & Time (Leave empty to keep current slot)"
                value={rescheduleDateStr}
                onChange={setRescheduleDateStr}
                showTimePicker={true}
                placeholder="Pick new date & time"
              />

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Updates'}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setReschedulingAppt(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingAppt && (
        <div className="fixed inset-0 bg-surface-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 space-y-4 border border-surface-200 shadow-md">
            <div className="flex justify-between items-center pb-3 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900 text-sm sm:text-base">Cancel Appointment</h2>
              <button
                type="button"
                onClick={() => setCancellingAppt(null)}
                className="text-surface-500 hover:text-surface-800 font-medium text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCancel} className="space-y-4 text-xs text-surface-700">
              <div className="space-y-1">
                <label htmlFor="reason" className="block font-medium text-surface-700">
                  Cancellation Reason
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-surface-900 focus:border-primary-600 focus:outline-none"
                  placeholder="Explain why consultation is being cancelled (e.g. visa delay, patient request)..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Cancelling...' : 'Confirm'}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setCancellingAppt(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
