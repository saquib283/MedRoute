'use client';

/**
 * Afzal Healthcare — Consultations & Care Schedule
 * Clean architectural 8px/6px schedule layout, aligned grid, and restrained typography.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectOption } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { toast } from '@/components/ui/Toast';
import {
  APPOINTMENT_MODES,
  APPOINTMENT_MODE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from '@/lib/constants';
import {
  formatConsultationScheduleDualTz,
  formatDoctorDisplayName,
} from '@/lib/validation/booking-helpers';
import {
  Calendar,
  Building2,
  UserCheck,
  Plus,
  LayoutGrid,
  Table,
  Clock,
  AlertCircle,
  Stethoscope,
  RefreshCw,
  Video,
  Languages,
  ExternalLink,
} from 'lucide-react';

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
  mode?: string;
  meetingUrl?: string | null;
  interpreterLanguage?: string | null;
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

const APPOINTMENT_MODE_OPTIONS: SelectOption[] = [
  {
    value: APPOINTMENT_MODES.TELECONSULTATION,
    label: APPOINTMENT_MODE_LABELS.TELECONSULTATION,
    description: 'Remote video consultation prior to travel or after return',
  },
  {
    value: APPOINTMENT_MODES.IN_PERSON,
    label: APPOINTMENT_MODE_LABELS.IN_PERSON,
    description: 'In-hospital consultation at partner facility in India',
  },
];

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Sessions' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const APPOINTMENT_TYPE_OPTIONS: SelectOption[] = [
  {
    value: 'CONSULTATION',
    label: 'Specialist Consultation',
    description: 'Initial clinical assessment and treatment review',
  },
  {
    value: 'PRE_OP_ASSESSMENT',
    label: 'Pre-Procedure Assessment',
    description: 'Anesthesia & surgical readiness clearance',
  },
  {
    value: 'POST_OP_REVIEW',
    label: 'Post-Procedure Follow-Up',
    description: 'Recovery checkup and Fit-to-Fly evaluation',
  },
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedType, setSelectedType] = useState('CONSULTATION');
  const [selectedMode, setSelectedMode] = useState<string>(APPOINTMENT_MODES.TELECONSULTATION);
  const [interpreterLanguage, setInterpreterLanguage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [isCancelLoading, setIsCancelLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/v1/patient/appointments?meta=true');
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setAppointments(data.data.appointments || []);
        if (data.data.metadata) {
          setHospitals(data.data.metadata.hospitals || []);
          setDoctors(data.data.metadata.doctors || []);
          setActiveCaseId(data.data.metadata.activeCaseId || null);
        }
      } else {
        setLoadError(data?.error?.message || 'Unable to load your consultation schedule.');
      }
    } catch (err) {
      console.error('Failed to load appointments data', err);
      setLoadError('Could not connect to the scheduling service. Please check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAppointments();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAppointments]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeCaseId) {
      setErrorMsg('No active care case found. Please message your coordinator first.');
      return;
    }
    if (!selectedHospital || !selectedDoctor || !scheduledAt) {
      setErrorMsg('Please select a hospital, specialist, and preferred date & time.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const res = await fetch('/api/v1/patient/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeCaseId,
          hospitalId: selectedHospital,
          doctorId: selectedDoctor,
          appointmentType: selectedType,
          mode: selectedMode,
          interpreterLanguage: interpreterLanguage.trim() || undefined,
          scheduledAt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          'Your consultation request has been sent. Your care coordinator will confirm the slot shortly.',
          'Consultation Requested'
        );
        setIsModalOpen(false);
        setSelectedHospital('');
        setSelectedDoctor('');
        setSelectedType('CONSULTATION');
        setSelectedMode(APPOINTMENT_MODES.TELECONSULTATION);
        setInterpreterLanguage('');
        setScheduledAt('');
        void fetchAppointments();
      } else {
        setErrorMsg(data.error?.message || 'Failed to request appointment.');
      }
    } catch {
      setErrorMsg('Network error requesting appointment. Please try again.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleSelfCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelError('');

    if (cancelReason.trim().length < 3) {
      setCancelError('Please share a brief reason (at least 3 characters) so your coordinator can assist.');
      return;
    }

    setIsCancelLoading(true);
    try {
      const res = await fetch('/api/v1/patient/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: cancelTarget.id,
          cancellationReason: cancelReason.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          'Appointment cancelled and your care coordinator has been notified.',
          'Appointment Cancelled'
        );
        setCancelTarget(null);
        setCancelReason('');
        void fetchAppointments();
      } else {
        setCancelError(data.error?.message || 'Failed to cancel appointment.');
      }
    } catch {
      setCancelError('Network error cancelling appointment. Please try again.');
    } finally {
      setIsCancelLoading(false);
    }
  };

  const hospitalSelectOptions: SelectOption[] = hospitals.map((h) => ({
    value: h.id,
    label: `${h.name} (${h.city})`,
    description: h.city,
  }));

  const filteredDoctorOptions: SelectOption[] = doctors
    .filter((doc) => doc.hospitalId === selectedHospital)
    .map((d) => ({
      value: d.id,
      label: formatDoctorDisplayName(d.fullName),
      description: 'Attending Specialist',
    }));

  const upcomingAppointments = useMemo(() => {
    return appointments.filter(
      (app) => new Date(app.scheduledAt) >= new Date() && app.status !== 'CANCELLED'
    );
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    return appointments.filter((app) => new Date(app.scheduledAt) < new Date());
  }, [appointments]);

  const filteredAppointmentsList = useMemo(() => {
    return appointments.filter((app) => {
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'UPCOMING') {
        return new Date(app.scheduledAt) >= new Date() && app.status !== 'CANCELLED';
      }
      return app.status === selectedFilter;
    });
  }, [appointments, selectedFilter]);

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
      <div className="space-y-6">
        <div className="h-14 rounded-lg bg-surface-200/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-20 rounded-lg bg-white border border-surface-200 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Flat Aligned Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
            Consultations &amp; Care Schedule
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Review specialist appointments, pre-procedure assessments, and follow-up hospital visits.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Request Consultation</span>
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Unable to load your schedule</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchAppointments()}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Restrained Neutral Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-surface-500">Upcoming Visits</p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {upcomingAppointments.length}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-surface-500">Confirmed &amp; Completed</p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED').length}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-surface-500">Partner Hospitals</p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {hospitals.length}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-surface-500">Past Visits</p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {pastAppointments.length}
          </p>
        </Card>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter appointments by status"
          className="edge-fade-scroller flex items-center gap-1.5 w-full sm:w-auto"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selectedFilter === filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`min-h-11 px-3.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                selectedFilter === filter.id
                  ? 'bg-primary-50 text-primary-900 border-primary-300'
                  : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Appointment display layout"
          className="flex items-center bg-surface-100 p-0.5 rounded-md border border-surface-200 self-end sm:self-auto shrink-0"
        >
          <button
            type="button"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
            className={`min-h-11 px-3 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'cards'
                ? 'bg-white text-surface-900 shadow-2xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            className={`min-h-11 px-3 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-white text-surface-900 shadow-2xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* View 1: Cards */}
      {viewMode === 'cards' && filteredAppointmentsList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointmentsList.map((app) => {
            const dualTz = formatConsultationScheduleDualTz(app.scheduledAt);
            const isTeleconsult = app.mode === APPOINTMENT_MODES.TELECONSULTATION;
            const canJoinVideo =
              isTeleconsult &&
              Boolean(app.meetingUrl) &&
              app.status !== 'CANCELLED' &&
              app.status !== 'COMPLETED';

            return (
              <Card key={app.id} hover className="p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-surface-100 text-surface-700 border border-surface-200 flex items-center justify-center font-semibold text-xs shrink-0">
                      Dr
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-surface-600 font-medium">
                        {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                      </span>
                      <h2 className="text-sm sm:text-base font-semibold text-surface-900 truncate">
                        {formatDoctorDisplayName(app.doctor.fullName)}
                      </h2>
                      {app.doctor.qualification && (
                        <p className="text-xs text-surface-500 truncate">{app.doctor.qualification}</p>
                      )}
                    </div>
                  </div>

                  <Badge variant={getStatusBadgeVariant(app.status)} dot>
                    {APPOINTMENT_STATUS_LABELS[app.status] || app.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isTeleconsult ? 'primary' : 'default'}>
                    {isTeleconsult ? (
                      <Video className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Building2 className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span>
                      {APPOINTMENT_MODE_LABELS[app.mode || 'IN_PERSON'] || 'In-Person Hospital Visit'}
                    </span>
                  </Badge>

                  {app.interpreterLanguage && (
                    <Badge variant="info">
                      <Languages className="w-3 h-3" aria-hidden="true" />
                      <span>Interpreter: {app.interpreterLanguage}</span>
                    </Badge>
                  )}
                </div>

                <div className="bg-surface-50 px-3.5 py-3 rounded-md border border-surface-200 space-y-1.5 text-xs text-surface-700">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-surface-500 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-surface-900">{app.hospital.name}</span>
                    <span className="text-surface-500">({app.hospital.city})</span>
                  </div>

                  <div className="flex items-start gap-2 tabular-nums text-surface-700">
                    <Clock className="w-3.5 h-3.5 text-surface-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-0.5">
                      <span className="block font-medium text-surface-900">{dualTz.istLabel}</span>
                      <span className="block text-[11px] text-surface-500">
                        Your time: {dualTz.localLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {isTeleconsult && !app.meetingUrl && app.status !== 'CANCELLED' && (
                  <p className="text-[11px] text-surface-500">
                    Secure video consultation link will appear here once assigned by your care coordinator.
                  </p>
                )}

                {app.status === 'CANCELLED' && app.cancellationReason && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-md text-xs text-danger-800">
                    <span className="font-medium">Cancellation note: </span>
                    {app.cancellationReason}
                  </div>
                )}

                {(canJoinVideo || (app.status !== 'CANCELLED' && app.status !== 'COMPLETED')) && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {canJoinVideo && app.meetingUrl && (
                      <a
                        href={app.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Join Video Consultation</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}

                    {app.status !== 'CANCELLED' && app.status !== 'COMPLETED' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-danger-700 hover:bg-danger-50 border-danger-200"
                        onClick={() => {
                          setCancelTarget(app);
                          setCancelReason('');
                          setCancelError('');
                        }}
                      >
                        Cancel or Reschedule
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* View 2: Table */}
      {viewMode === 'table' && filteredAppointmentsList.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div
            tabIndex={0}
            role="region"
            aria-label="Scheduled consultations table"
            className="overflow-x-auto"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                  <th scope="col" className="px-4 py-3">
                    Date &amp; Time (IST / Local)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Specialist
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Mode &amp; Interpreter
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Session Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {filteredAppointmentsList.map((app) => {
                  const dualTz = formatConsultationScheduleDualTz(app.scheduledAt);
                  const isTeleconsult = app.mode === APPOINTMENT_MODES.TELECONSULTATION;
                  const canJoinVideo =
                    isTeleconsult &&
                    Boolean(app.meetingUrl) &&
                    app.status !== 'CANCELLED' &&
                    app.status !== 'COMPLETED';

                  return (
                    <tr key={app.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                        <div className="font-medium text-surface-900">{dualTz.istLabel}</div>
                        <div className="text-[11px] text-surface-500">
                          Your time: {dualTz.localLabel}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-surface-900">
                          {formatDoctorDisplayName(app.doctor.fullName)}
                        </div>
                        <div className="text-[11px] text-surface-500">
                          {app.hospital.name} ({app.hospital.city})
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={isTeleconsult ? 'primary' : 'default'} size="sm">
                            {APPOINTMENT_MODE_LABELS[app.mode || 'IN_PERSON'] || 'In-Person'}
                          </Badge>
                          {app.interpreterLanguage && (
                            <Badge variant="info" size="sm">
                              {app.interpreterLanguage}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={getStatusBadgeVariant(app.status)} dot>
                          {APPOINTMENT_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {canJoinVideo && app.meetingUrl && (
                            <a
                              href={app.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 min-h-11 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Join Video Consultation</span>
                            </a>
                          )}
                          {app.status !== 'CANCELLED' && app.status !== 'COMPLETED' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-danger-700 hover:text-danger-800 hover:bg-danger-50"
                              onClick={() => {
                                setCancelTarget(app);
                                setCancelReason('');
                                setCancelError('');
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loadError && filteredAppointmentsList.length === 0 && (
        <Card className="p-10 text-center space-y-3">
          <div className="w-10 h-10 rounded-md bg-surface-100 text-surface-500 border border-surface-200 flex items-center justify-center mx-auto">
            <Calendar className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold text-surface-900">No Consultations Scheduled</h2>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
            {selectedFilter === 'ALL'
              ? 'Request a video or in-person consultation with an accredited specialist.'
              : 'No consultations match this filter. Try viewing all sessions or request a new consultation.'}
          </p>
          <Button type="button" size="sm" onClick={() => setIsModalOpen(true)}>
            Request Consultation
          </Button>
        </Card>
      )}

      {/* Booking Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preventClose={isSubmitLoading}
        title="Request Specialist Consultation"
        subtitle="Your care coordinator will confirm hospital availability and notify you once scheduled."
        icon={<Stethoscope className="w-4 h-4" />}
      >
        <form onSubmit={handleBook} className="space-y-4 text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Select
            label="Partner Hospital"
            options={hospitalSelectOptions}
            value={selectedHospital}
            onChange={(val) => {
              setSelectedHospital(val);
              setSelectedDoctor('');
            }}
            placeholder="Choose accredited hospital..."
            searchable
            icon={<Building2 className="w-4 h-4" />}
            required
          />

          <Select
            label="Attending Specialist"
            options={filteredDoctorOptions}
            value={selectedDoctor}
            onChange={setSelectedDoctor}
            placeholder={selectedHospital ? 'Select specialist...' : 'Select a hospital first'}
            disabled={!selectedHospital}
            searchable
            icon={<UserCheck className="w-4 h-4" />}
            required
          />

          <Select
            label="Session Type"
            options={APPOINTMENT_TYPE_OPTIONS}
            value={selectedType}
            onChange={setSelectedType}
            placeholder="Select consultation type..."
            required
          />

          <Select
            label="Consultation Mode"
            options={APPOINTMENT_MODE_OPTIONS}
            value={selectedMode}
            onChange={setSelectedMode}
            required
          />

          <Input
            label="Preferred Medical Interpreter Language (Optional)"
            type="text"
            placeholder="e.g. Arabic, French, Swahili, Russian"
            value={interpreterLanguage}
            onChange={(e) => setInterpreterLanguage(e.target.value)}
          />

          <DatePicker
            label="Preferred Date & Time"
            value={scheduledAt}
            onChange={setScheduledAt}
            placeholder="Select preferred date & time..."
            includeTime
            required
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitLoading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitLoading}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Self-Cancellation Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        preventClose={isCancelLoading}
        title="Cancel or Reschedule Consultation"
        subtitle="Your care coordinator will be notified immediately and can arrange a new slot if needed."
      >
        {cancelTarget && (
          <form onSubmit={handleSelfCancel} className="space-y-4 text-xs">
            <p className="text-surface-700 leading-relaxed">
              Cancel your{' '}
              <strong className="font-semibold text-surface-900">
                {APPOINTMENT_TYPE_LABELS[cancelTarget.appointmentType] ||
                  cancelTarget.appointmentType}
              </strong>{' '}
              with{' '}
              <strong className="font-semibold text-surface-900">
                {formatDoctorDisplayName(cancelTarget.doctor.fullName)}
              </strong>
              ?
            </p>

            {cancelError && (
              <div
                role="alert"
                className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" aria-hidden="true" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="patient-cancel-reason" className="block font-medium text-surface-700">
                Note for Your Coordinator
              </label>
              <textarea
                id="patient-cancel-reason"
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Flight schedule changed — requesting afternoon slot next Tuesday..."
                className="w-full p-3 border border-surface-300 rounded-md text-sm text-surface-900 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelLoading}
              >
                Keep Appointment
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isCancelLoading}>
                Confirm Cancellation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
