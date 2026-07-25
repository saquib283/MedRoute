'use client';

/**
 * MediRoute India — Doctor Appointments
 * Lists appointments assigned to the doctor and allows updating status & notes.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
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

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchAppointments = async () => {
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
  };

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
        setSelectedAppt(null);
        fetchAppointments(); // refresh
      } else {
        alert('Failed to update: ' + data.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating appointment.');
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
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Consultations Schedule</h1>
          <p className="text-sm text-surface-500 mt-1">Manage your appointments, update statuses, and log clinical notes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === 'upcoming' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('upcoming')}>Upcoming</Button>
          <Button variant={filter === 'past' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('past')}>Past</Button>
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>All</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.length === 0 ? (
            <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-12 text-center text-sm text-surface-500 bg-white">
              No appointments found for the selected filter.
            </div>
          ) : (
            appointments.map((appt) => (
              <Card key={appt.id} className="p-5 bg-white border border-surface-200 flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <Badge variant={appt.status === 'COMPLETED' ? 'success' : appt.status === 'CANCELLED' ? 'danger' : 'primary'} dot>
                    {appt.status}
                  </Badge>
                  <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">
                    {APPOINTMENT_TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                  </span>
                </div>
                
                <h3 className="font-bold text-surface-900 mb-1">{appt.patient.user.fullName}</h3>
                <p className="text-xs text-surface-500 mb-4">
                  Nationality: {appt.patient.nationality} 
                  {appt.case.isUrgent && <span className="ml-2 text-danger-600 font-bold px-1.5 py-0.5 bg-danger-50 rounded">URGENT</span>}
                </p>

                <div className="text-xs font-semibold text-surface-700 bg-surface-50 p-3 rounded mb-4">
                  <p>Date: {new Date(appt.scheduledAt).toLocaleString()}</p>
                </div>

                <div className="mt-auto pt-4 border-t border-surface-100 flex gap-2">
                  <Button className="w-full" variant="secondary" size="sm" onClick={() => openUpdateModal(appt)}>
                    {appt.status === 'COMPLETED' ? 'View/Edit Notes' : 'Update & Notes'}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Update Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-scale-up">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900">Update Consultation</h3>
              <button onClick={() => setSelectedAppt(null)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Patient</label>
                <div className="p-2.5 bg-surface-50 rounded text-sm font-medium border border-surface-200">
                  {selectedAppt.patient.user.fullName}
                </div>
              </div>
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
                <label className="block text-xs font-semibold text-surface-700">Clinical Notes</label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record diagnosis, prescriptions, or post-op notes here..."
                  className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setSelectedAppt(null)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={isUpdating}>Save Update</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
