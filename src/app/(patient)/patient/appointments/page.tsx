'use client';

/**
 * MediRoute India — Patient Appointments Page
 * Appointments timeline, status filters, and booking wizard modal using custom Select & DatePicker components.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectOption } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants';
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
  X,
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

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Sessions' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const APPOINTMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'CONSULTATION', label: 'Consultation', description: 'General specialist assessment' },
  { value: 'PRE_OP_ASSESSMENT', label: 'Pre-op Assessment', description: 'Surgeon pre-operation check' },
  { value: 'SURGERY', label: 'Surgery', description: 'Scheduled surgical procedure' },
  { value: 'POST_OP_REVIEW', label: 'Post-op Review', description: 'Follow-up discharge check' },
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for booking modal
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedType, setSelectedType] = useState('CONSULTATION');
  const [scheduledAt, setScheduledAt] = useState('');

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/patient/appointments?meta=true');
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
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAppointments();
    });
  }, [fetchAppointments]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeCaseId) {
      setErrorMsg('No active care case found. Please contact your coordinator first.');
      return;
    }
    if (!selectedHospital || !selectedDoctor || !scheduledAt) {
      setErrorMsg('Please complete all form fields.');
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
          scheduledAt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setSelectedHospital('');
        setSelectedDoctor('');
        setSelectedType('CONSULTATION');
        setScheduledAt('');
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

  const hospitalSelectOptions: SelectOption[] = hospitals.map((h) => ({
    value: h.id,
    label: `${h.name} (${h.city})`,
    description: h.city,
  }));

  const filteredDoctorOptions: SelectOption[] = doctors
    .filter((doc) => doc.hospitalId === selectedHospital)
    .map((d) => ({
      value: d.id,
      label: `Dr. ${d.fullName}`,
      description: 'Attending Specialist',
    }));

  const upcomingAppointments = useMemo(() => {
    return appointments.filter((app) => new Date(app.scheduledAt) >= new Date());
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    return appointments.filter((app) => new Date(app.scheduledAt) < new Date());
  }, [appointments]);

  const filteredAppointmentsList = useMemo(() => {
    return appointments.filter((app) => {
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'UPCOMING') return new Date(app.scheduledAt) >= new Date();
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading your appointments timeline...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Appointments Timeline</h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Review scheduled clinical sessions, surgeon consults, and hospital visits.
            </p>
          </div>
        </div>

        <Button size="lg" onClick={() => setIsModalOpen(true)} className="shadow-xs self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-1.5" /> Request Consultation
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xl shrink-0">
            {upcomingAppointments.length}
          </div>
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Upcoming Sessions</p>
            <p className="text-base font-bold text-surface-900">
              {upcomingAppointments.length > 0 ? 'Next Session Active' : 'No Pending Sessions'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center font-bold text-xl shrink-0">
            {appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED').length}
          </div>
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Confirmed & Done</p>
            <p className="text-base font-bold text-surface-900">Verified Schedule</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-info-50 text-info-600 flex items-center justify-center font-bold text-xl shrink-0">
            {hospitals.length}
          </div>
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Hospital Network</p>
            <p className="text-base font-bold text-surface-900">Accredited Centers</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-warning-50 text-warning-600 flex items-center justify-center font-bold text-xl shrink-0">
            {pastAppointments.length}
          </div>
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Past Consults</p>
            <p className="text-base font-bold text-surface-900">Completed History</p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedFilter === filter.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-surface-100 p-1 rounded-xl border border-surface-200 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'cards'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Timeline Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Detailed Table</span>
          </button>
        </div>
      </div>

      {/* View 1: Timeline Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAppointmentsList.map((app) => (
            <Card key={app.id} className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all border border-surface-200 flex flex-col justify-between space-y-5 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-800 border border-primary-200 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                    Dr
                  </div>
                  <div>
                    <span className="text-[10px] text-primary-700 font-bold uppercase tracking-wider bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100 inline-block">
                      {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                    </span>
                    <h3 className="text-base font-bold text-surface-900 mt-1 group-hover:text-primary-600 transition-colors">
                      Dr. {app.doctor.fullName}
                    </h3>
                    {app.doctor.qualification && (
                      <p className="text-xs text-surface-500">{app.doctor.qualification}</p>
                    )}
                  </div>
                </div>

                <Badge variant={getStatusBadgeVariant(app.status)} dot>
                  {app.status}
                </Badge>
              </div>

              <div className="bg-surface-50/70 p-4 rounded-xl border border-surface-100 space-y-2 text-xs text-surface-700">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary-600 shrink-0" />
                  <span className="font-semibold text-surface-900">{app.hospital.name}</span>
                  <span className="text-surface-400">({app.hospital.city})</span>
                </div>

                <div className="flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4 text-primary-600 shrink-0" />
                  <span>{new Date(app.scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {app.status === 'CANCELLED' && app.cancellationReason && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800">
                  <span className="font-bold">Cancellation Reason: </span>
                  {app.cancellationReason}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* View 2: Detailed Table View */}
      {viewMode === 'table' && (
        <Card className="p-0 rounded-2xl overflow-hidden border border-surface-200 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Medical Specialist</th>
                  <th className="p-4">Accredited Hospital</th>
                  <th className="p-4">Consultation Type</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {filteredAppointmentsList.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-50 transition-colors">
                    <td className="p-4 whitespace-nowrap font-bold text-surface-900">
                      {new Date(app.scheduledAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-surface-900">Dr. {app.doctor.fullName}</div>
                      {app.doctor.qualification && <div className="text-[11px] text-surface-500">{app.doctor.qualification}</div>}
                    </td>
                    <td className="p-4 font-medium">{app.hospital.name} ({app.hospital.city})</td>
                    <td className="p-4 font-medium">
                      {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(app.status)}>
                        {app.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {filteredAppointmentsList.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-surface-200 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-surface-900">No Consultations Scheduled</h3>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
            No session records match your selected status filter. Request a consultation with a specialist physician.
          </p>
          <Button size="md" onClick={() => setIsModalOpen(true)}>
            Request Consultation
          </Button>
        </div>
      )}

      {/* Booking Modal Dialog using Custom Select & DatePicker */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
              <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-primary-600" /> Request Care Consultation
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-200 flex items-center justify-center transition-all font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBook} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Hospital Dropdown */}
              <Select
                label="Select Accredited Hospital"
                options={hospitalSelectOptions}
                value={selectedHospital}
                onChange={(val) => {
                  setSelectedHospital(val);
                  setSelectedDoctor('');
                }}
                placeholder="Choose hospital center..."
                searchable
                icon={<Building2 className="w-4 h-4" />}
                required
              />

              {/* Doctor Dropdown */}
              <Select
                label="Choose Medical Specialist"
                options={filteredDoctorOptions}
                value={selectedDoctor}
                onChange={setSelectedDoctor}
                placeholder={selectedHospital ? 'Select clinician...' : 'Select hospital first'}
                disabled={!selectedHospital}
                searchable
                icon={<UserCheck className="w-4 h-4" />}
                required
              />

              {/* Consultation Type Dropdown */}
              <Select
                label="Consultation Type"
                options={APPOINTMENT_TYPE_OPTIONS}
                value={selectedType}
                onChange={setSelectedType}
                placeholder="Select consultation type..."
                required
              />

              {/* DatePicker UI Component */}
              <DatePicker
                label="Preferred Date & Time"
                value={scheduledAt}
                onChange={setScheduledAt}
                placeholder="Pick consultation date..."
                includeTime
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
