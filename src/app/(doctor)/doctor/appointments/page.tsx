'use client';

/**
 * Afzal Healthcare — Doctor Appointments Console
 * Filter upcoming/past/all encounters, update encounter statuses, record clinical notes,
 * and jump directly into the patient's Case Workspace.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, CaseStatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  APPOINTMENT_MODES,
  APPOINTMENT_MODE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from '@/lib/constants';
import { formatConsultationScheduleDualTz } from '@/lib/validation/booking-helpers';
import {
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  AlertTriangle,
  Save,
  X,
  Video,
  Languages,
} from 'lucide-react';

type FilterTab = 'upcoming' | 'past' | 'all';

interface DoctorAppointment {
  id: string;
  caseId: string;
  appointmentType: string;
  mode?: string;
  meetingUrl?: string | null;
  interpreterLanguage?: string | null;
  scheduledAt: string;
  status: string;
  clinicalNotes: string | null;
  patient: {
    user: { fullName: string };
    nationality: string;
  };
  case?: {
    id: string;
    isUrgent: boolean;
    status: string;
  } | null;
  hospital?: {
    name: string;
    city: string;
  } | null;
}

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function DoctorAppointmentsPage() {
  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Inline clinical notes editor
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const loadAppointments = useCallback(
    async (activeFilter: FilterTab, isCancelled?: () => boolean) => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/doctor/appointments?filter=${activeFilter}`);
        const json = await res.json();
        if (isCancelled?.()) return;

        if (!res.ok || !json.success) {
          toast.apiError(json, 'Failed to load appointments');
          return;
        }
        setAppointments(json.data?.appointments ?? []);
      } catch (err) {
        if (!isCancelled?.()) {
          toast.apiError(err, 'Network error loading appointments');
        }
      } finally {
        if (!isCancelled?.()) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadAppointments(filter, () => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filter, loadAppointments]);

  const handleUpdateAppointment = async (
    appt: DoctorAppointment,
    newStatus: string,
    clinicalNotes?: string
  ) => {
    setUpdatingId(appt.id);
    try {
      const payload: { status: string; clinicalNotes?: string } = { status: newStatus };
      if (clinicalNotes !== undefined) {
        payload.clinicalNotes = clinicalNotes;
      }

      const res = await fetch(`/api/v1/doctor/appointments?id=${appt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to update appointment');
        return;
      }

      const updated = json.data?.appointment;
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appt.id
            ? {
                ...item,
                status: updated?.status ?? newStatus,
                clinicalNotes:
                  updated?.clinicalNotes !== undefined
                    ? updated.clinicalNotes
                    : clinicalNotes ?? item.clinicalNotes,
              }
            : item
        )
      );
      setEditingNotesId(null);
      toast.success('Appointment record updated.', 'Encounter Updated');
    } catch (err) {
      toast.apiError(err, 'Network error updating appointment');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return 'primary';
      case 'CANCELLED':
        return 'danger';
      case 'RESCHEDULED':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">Clinical schedule</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Manage encounter statuses, document clinical observations, and open patient case workspaces.
          </p>
        </div>

        <div className="inline-flex p-1 bg-surface-100 border border-surface-200 rounded-md self-start">
          {(['upcoming', 'past', 'all'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-9 px-3.5 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                filter === tab
                  ? 'bg-white text-surface-900 shadow-2xs'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-surface-500">Loading encounters...</span>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <Card className="p-10 text-center text-sm text-surface-500">
          No {filter === 'all' ? '' : `${filter} `}appointments found.
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const targetCaseId = appt.case?.id || appt.caseId;
            const isEditingNotes = editingNotesId === appt.id;
            const isSaving = updatingId === appt.id;
            const dualTz = formatConsultationScheduleDualTz(appt.scheduledAt);
            const isTeleconsult = appt.mode === APPOINTMENT_MODES.TELECONSULTATION;
            const canJoinVideo =
              isTeleconsult && Boolean(appt.meetingUrl) && appt.status !== 'CANCELLED';

            return (
              <Card key={appt.id} className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-surface-900">
                        {appt.patient.user.fullName}
                      </h3>
                      <span className="text-xs font-medium text-surface-500">
                        ({appt.patient.nationality})
                      </span>
                      <Badge variant={getStatusBadgeVariant(appt.status)} dot>
                        {APPOINTMENT_STATUS_LABELS[appt.status] || appt.status}
                      </Badge>
                      <Badge variant={isTeleconsult ? 'primary' : 'default'}>
                        {isTeleconsult && <Video className="w-3 h-3" aria-hidden="true" />}
                        <span>
                          {APPOINTMENT_MODE_LABELS[appt.mode || 'IN_PERSON'] || 'In-Person Hospital Visit'}
                        </span>
                      </Badge>
                      {appt.interpreterLanguage && (
                        <Badge variant="info">
                          <Languages className="w-3 h-3" aria-hidden="true" />
                          <span>Interpreter: {appt.interpreterLanguage}</span>
                        </Badge>
                      )}
                      {appt.case?.status && <CaseStatusBadge status={appt.case.status} />}
                      {appt.case?.isUrgent && (
                        <Badge variant="danger" size="sm">
                          <AlertTriangle className="w-3 h-3" /> Urgent Case
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-600">
                      <span className="inline-flex items-center gap-1.5 font-medium text-primary-700 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {APPOINTMENT_TYPE_LABELS[appt.appointmentType] || appt.appointmentType} —{' '}
                          {dualTz.istLabel}
                        </span>
                      </span>
                      <span className="text-[11px] text-surface-500 tabular-nums">
                        Local: {dualTz.localLabel}
                      </span>
                      {appt.hospital?.name && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-surface-400" />
                          {appt.hospital.name}
                          {appt.hospital.city ? `, ${appt.hospital.city}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions & Status Control */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {canJoinVideo && appt.meetingUrl && (
                      <a
                        href={appt.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Join Video Consultation</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                    <div className="w-44">
                      <Select
                        value={appt.status}
                        onChange={(newStatus) => void handleUpdateAppointment(appt, newStatus)}
                        options={STATUS_OPTIONS}
                        disabled={isSaving}
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (isEditingNotes) {
                          setEditingNotesId(null);
                          setNotesDraft('');
                        } else {
                          setEditingNotesId(appt.id);
                          setNotesDraft(appt.clinicalNotes || '');
                        }
                      }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {appt.clinicalNotes ? 'Edit Notes' : 'Add Notes'}
                    </Button>

                    {targetCaseId && (
                      <Link href={`/doctor/cases/${targetCaseId}`}>
                        <Button size="sm">
                          Case Workspace <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Quick Transition Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-surface-100">
                  <span className="text-xs font-medium text-surface-500 mr-1">
                    Quick status:
                  </span>
                  {(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(
                    (statusOption) => (
                      <button
                        key={statusOption}
                        type="button"
                        disabled={isSaving || appt.status === statusOption}
                        onClick={() => void handleUpdateAppointment(appt, statusOption)}
                        className={`min-h-8 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          appt.status === statusOption
                            ? 'bg-primary-50 text-primary-700 border-primary-200 cursor-default'
                            : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50 hover:text-surface-900 disabled:opacity-50'
                        }`}
                      >
                        {APPOINTMENT_STATUS_LABELS[statusOption]}
                      </button>
                    )
                  )}
                </div>

                {/* Existing Notes Preview */}
                {!isEditingNotes && appt.clinicalNotes && (
                  <div className="p-3 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-700">
                    <span className="font-semibold text-surface-900 block mb-1">Clinical notes</span>
                    <p className="whitespace-pre-wrap">{appt.clinicalNotes}</p>
                  </div>
                )}

                {/* Inline Clinical Notes Editor */}
                {isEditingNotes && (
                  <div className="p-4 rounded-md bg-surface-50 border border-surface-200 space-y-3">
                    <label htmlFor={`notes-${appt.id}`} className="block text-xs font-medium text-surface-700">
                      Clinical encounter notes
                    </label>
                    <textarea
                      id={`notes-${appt.id}`}
                      rows={3}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Document assessment findings, vitals, operative summary, or post-op instructions..."
                      className="w-full p-3 rounded-md border border-surface-300 bg-white text-sm text-surface-900 focus:border-primary-600 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingNotesId(null);
                          setNotesDraft('');
                        }}
                        disabled={isSaving}
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        isLoading={isSaving}
                        onClick={() =>
                          void handleUpdateAppointment(appt, appt.status, notesDraft)
                        }
                      >
                        <Save className="w-3.5 h-3.5" /> Save Clinical Notes
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
