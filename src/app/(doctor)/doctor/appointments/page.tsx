'use client';

/**
 * MediRoute India — Doctor Appointments
 * Lists appointments assigned to the doctor and allows updating status & notes.
 */

import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants';

interface Appointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  status: string;
  clinicalNotes: string | null;
  patient: {
    user: { fullName: string };
    nationality: string;
  };
  case: {
    id: string;
    isUrgent: boolean;
  };
}

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchAppointments = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/doctor/appointments?filter=${filter}`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data.appointments);
      }
    } catch (err) {
      console.error('Failed to load doctor appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAppointments();
    });
  }, [fetchAppointments]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;

    setIsUpdating(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };

      const res = await fetch(`/api/v1/doctor/appointments?id=${selectedAppt.id}`, {

        method: 'PUT',
        headers,
        body: JSON.stringify({ status, clinicalNotes: notes }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Consultation updated');
        setSelectedAppt(null);
        fetchAppointments();
      } else {
        toast.error(data.error?.message || 'Failed to update consultation');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating appointment');
    } finally {
      setIsUpdating(false);
    }
  };

  const openUpdateModal = (appt: Appointment) => {
    setSelectedAppt(appt);
    setStatus(appt.status);
    setNotes(appt.clinicalNotes || '');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Consultations Schedule"
        subtitle="Manage appointments, update statuses, and record clinical notes"
        actions={
          <div className="flex gap-2">
            <Button variant={filter === 'upcoming' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('upcoming')}>Upcoming</Button>
            <Button variant={filter === 'past' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('past')}>Past</Button>
            <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>All</Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No consultations found"
            description="No appointments match the selected schedule filter."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.map((appt) => (
            <Card key={appt.id} className="p-5 flex flex-col">
              <div className="flex justify-between items-start gap-2 mb-3">
                <Badge variant={appt.status === 'COMPLETED' ? 'success' : appt.status === 'CANCELLED' ? 'danger' : 'primary'} dot>
                  {appt.status}
                </Badge>
                <span className="text-[11px] text-surface-500 font-semibold uppercase tracking-wider text-right">
                  {APPOINTMENT_TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                </span>
              </div>

              <h3 className="font-semibold text-surface-900 mb-1">{appt.patient.user.fullName}</h3>
              <p className="text-xs text-surface-500 mb-4 flex items-center gap-2">
                <span>Nationality: {appt.patient.nationality}</span>
                {appt.case.isUrgent && (
                  <Badge variant="danger" size="sm">Urgent</Badge>
                )}
              </p>

              <div className="text-xs font-medium text-surface-700 bg-surface-50 border border-surface-200 p-3 rounded-lg mb-4">
                Scheduled: {new Date(appt.scheduledAt).toLocaleString()}
              </div>

              <div className="mt-auto pt-3 border-t border-surface-200">
                <Button className="w-full" variant="secondary" size="sm" onClick={() => openUpdateModal(appt)}>
                  {appt.status === 'COMPLETED' ? 'View / Edit Notes' : 'Update & Notes'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedAppt)}
        onClose={() => setSelectedAppt(null)}
        title="Update Consultation"
        subtitle={selectedAppt?.patient.user.fullName}
        maxWidth="md"
      >
        {selectedAppt && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'SCHEDULED', label: 'Scheduled' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' }
              ]}
              required
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-800">Clinical Notes</label>
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record clinical findings, prescriptions, or follow-up notes..."
                className="w-full p-3 border border-surface-300 rounded-lg text-sm focus:border-primary-600"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setSelectedAppt(null)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" isLoading={isUpdating}>
                Save Update
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
