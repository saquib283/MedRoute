'use client';

/**
 * Afzal Healthcare — Admin Appointments Management
 * Paginated appointments list with search, filters, status progression, clinical notes, cancel, and reschedule actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  appointmentType: string;
  clinicalNotes: string | null;
  cancellationReason: string | null;
  patient: { user: { fullName: string } };
  doctor: { fullName: string };
  hospital: { name: string; city: string };
}

interface HospitalOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
const STATUS_BADGE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  SCHEDULED: 'primary',
  CONFIRMED: 'success',
  IN_PROGRESS: 'warning',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  RESCHEDULED: 'warning',
};

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Detail drawer
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Cancel dialog
  const [cancelModal, setCancelModal] = useState({ open: false, id: '', reason: '' });

  // Reschedule dialog
  const [rescheduleModal, setRescheduleModal] = useState({ open: false, id: '', dateStr: '' });

  const fetchAppointments = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (hospitalFilter) params.set('hospitalId', hospitalFilter);

      const res = await fetch(`/api/v1/admin/appointments?${params}`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data.appointments);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, hospitalFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAppointments();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAppointments]);

  useEffect(() => {
    fetch('/api/v1/admin/hospitals')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setHospitals(d.data.hospitals.map((h: { id: string; name: string }) => ({ id: h.id, name: h.name })));
        }
      })
      .catch(() => {});
  }, []);

  const openDetailModal = (appt: Appointment) => {
    setSelectedAppt(appt);
    setNotesDraft(appt.clinicalNotes || '');
  };

  const handleUpdateDetails = async (status?: string) => {
    if (!selectedAppt) return;
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        id: selectedAppt.id,
        clinicalNotes: notesDraft,
      };
      if (status) payload.status = status;

      const res = await fetch('/api/v1/admin/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to update appointment');
        return;
      }
      toast.success(status ? `Appointment marked ${APPOINTMENT_STATUS_LABELS[status] || status}` : 'Clinical notes saved');
      setSelectedAppt((prev) =>
        prev
          ? {
              ...prev,
              status: status || prev.status,
              clinicalNotes: notesDraft,
            }
          : null
      );
      fetchAppointments(pagination.page);
    } catch {
      toast.error('An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModal.reason.trim()) {
      toast.error('Cancellation reason is required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/v1/admin/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cancelModal.id,
          status: 'CANCELLED',
          cancellationReason: cancelModal.reason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to cancel appointment');
        return;
      }
      toast.success('Appointment cancelled successfully');
      setCancelModal({ open: false, id: '', reason: '' });
      setSelectedAppt(null);
      fetchAppointments(pagination.page);
    } catch {
      toast.error('An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModal.dateStr) {
      toast.error('New date and time are required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/v1/admin/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rescheduleModal.id,
          status: 'RESCHEDULED',
          scheduledAt: new Date(rescheduleModal.dateStr).toISOString(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to reschedule appointment');
        return;
      }
      toast.success('Appointment rescheduled successfully');
      setRescheduleModal({ open: false, id: '', dateStr: '' });
      setSelectedAppt(null);
      fetchAppointments(pagination.page);
    } catch {
      toast.error('An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">All Appointments</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Platform-wide overview and scheduling control of doctor appointments.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            window.open(`/api/v1/admin/export/appointments?status=${statusFilter}`, '_blank');
            toast.success('Export started — check your downloads.');
          }}
        >
          ↓ Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm" className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search patient or doctor name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Statuses' },
            ...STATUS_OPTIONS.map((s) => ({ value: s, label: APPOINTMENT_STATUS_LABELS[s] || s }))
          ]}
          placeholder="All Statuses"
          className="w-full sm:w-48"
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'All Types' },
            ...Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))
          ]}
          placeholder="All Types"
          className="w-full sm:w-48"
        />
        <Select
          value={hospitalFilter}
          onChange={setHospitalFilter}
          options={[
            { value: '', label: 'All Hospitals' },
            ...hospitals.map((h) => ({ value: h.id, label: h.name }))
          ]}
          placeholder="All Hospitals"
          className="w-full sm:w-48"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchAppointments()}>
          Search
        </Button>
      </Card>

      {/* Table */}
      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Doctor &amp; Hospital</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Date &amp; Time</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Type</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Status</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-surface-500">
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-100/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-surface-900">{a.patient.user.fullName}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-surface-900">{formatDoctorDisplayName(a.doctor.fullName)}</p>
                        <p className="text-xs text-surface-500">
                          {a.hospital.name}, {a.hospital.city}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-surface-600 tabular-nums">
                        {new Date(a.scheduledAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-surface-600">
                        {APPOINTMENT_TYPE_LABELS[a.appointmentType] || a.appointmentType}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={STATUS_BADGE[a.status] || 'default'}>
                          {APPOINTMENT_STATUS_LABELS[a.status] || a.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetailModal(a)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-surface-500 tabular-nums">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchAppointments(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchAppointments(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Appointment Detail Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm sm:text-base font-semibold text-surface-900">Appointment details</h3>
              <button
                onClick={() => setSelectedAppt(null)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-md hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-surface-500">Patient</p>
                  <p className="text-sm font-medium text-surface-900">{selectedAppt.patient.user.fullName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-500">Doctor</p>
                  <p className="text-sm font-medium text-surface-900">{formatDoctorDisplayName(selectedAppt.doctor.fullName)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-500">Hospital</p>
                  <p className="text-sm text-surface-700">
                    {selectedAppt.hospital.name} ({selectedAppt.hospital.city})
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-500">Scheduled time</p>
                  <p className="text-sm text-surface-700 tabular-nums">{new Date(selectedAppt.scheduledAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-500">Type &amp; status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default">{APPOINTMENT_TYPE_LABELS[selectedAppt.appointmentType] || selectedAppt.appointmentType}</Badge>
                    <Badge variant={STATUS_BADGE[selectedAppt.status] || 'default'}>
                      {APPOINTMENT_STATUS_LABELS[selectedAppt.status] || selectedAppt.status}
                    </Badge>
                  </div>
                </div>

                {selectedAppt.cancellationReason && (
                  <div>
                    <p className="text-xs font-medium text-danger-600 mb-1">Cancellation reason</p>
                    <p className="text-sm text-danger-700 bg-danger-50 p-3 rounded-md border border-danger-200">{selectedAppt.cancellationReason}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="admin-clinical-notes" className="block text-xs font-medium text-surface-700">
                    Clinical notes
                  </label>
                  <textarea
                    id="admin-clinical-notes"
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Record clinical notes or visit summary..."
                    className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={actionLoading}
                      onClick={() => handleUpdateDetails()}
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>

              {selectedAppt.status !== 'CANCELLED' && selectedAppt.status !== 'COMPLETED' && (
                <div className="pt-4 border-t border-surface-200 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedAppt.status !== 'CONFIRMED' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={actionLoading}
                        onClick={() => handleUpdateDetails('CONFIRMED')}
                      >
                        Confirm
                      </Button>
                    )}
                    {selectedAppt.status !== 'IN_PROGRESS' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={actionLoading}
                        onClick={() => handleUpdateDetails('IN_PROGRESS')}
                      >
                        Mark In Progress
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={actionLoading}
                      onClick={() => handleUpdateDetails('COMPLETED')}
                    >
                      Mark Completed
                    </Button>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1 text-danger-600 hover:bg-danger-50 border-danger-200"
                      onClick={() => setCancelModal({ open: true, id: selectedAppt.id, reason: '' })}
                    >
                      Cancel Appointment
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() =>
                        setRescheduleModal({
                          open: true,
                          id: selectedAppt.id,
                          dateStr: new Date(selectedAppt.scheduledAt).toISOString().slice(0, 16),
                        })
                      }
                    >
                      Reschedule
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-sm animate-scale-in p-6">
            <h3 className="text-base font-semibold text-surface-900 mb-1.5">Cancel appointment</h3>
            <p className="text-sm text-surface-500 mb-4">Please provide a reason for cancelling this appointment.</p>
            <form onSubmit={handleCancel} className="space-y-4">
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                required
                rows={3}
                placeholder="Reason for cancellation..."
                className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setCancelModal({ open: false, id: '', reason: '' })}
                >
                  Go Back
                </Button>
                <Button type="submit" className="flex-1" variant="primary" isLoading={actionLoading}>
                  Confirm Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Dialog */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-sm animate-scale-in p-6">
            <h3 className="text-base font-semibold text-surface-900 mb-1.5">Reschedule appointment</h3>
            <p className="text-sm text-surface-500 mb-4">Select the new date and time for this appointment.</p>
            <form onSubmit={handleReschedule} className="space-y-4">
              <DatePicker
                label="New Date & Time"
                value={rescheduleModal.dateStr}
                onChange={(dateStr) => setRescheduleModal({ ...rescheduleModal, dateStr })}
                showTimePicker={true}
                placeholder="Select date & time"
                required
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setRescheduleModal({ open: false, id: '', dateStr: '' })}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" variant="primary" isLoading={actionLoading}>
                  Reschedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
