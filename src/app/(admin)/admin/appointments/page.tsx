'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants';

interface AdminAppointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  status: string;
  patient: { user: { fullName: string } };
  doctor: { fullName: string };
  hospital: { name: string; city: string };
}

const STATUS_OPTIONS = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
const TYPE_OPTIONS = ['CONSULTATION', 'PRE_OP_ASSESSMENT', 'SURGERY', 'POST_OP_REVIEW'];

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchAppointments = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/v1/admin/appointments?${params}`);
      const data = await res.json();
      if (data.success) { setAppointments(data.data.appointments); setPagination(data.data.pagination); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const statusColor = (s: string) => {
    if (s === 'COMPLETED') return 'success';
    if (s === 'CANCELLED') return 'danger';
    if (s === 'IN_PROGRESS') return 'warning';
    return 'primary';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">All Appointments</h1>
        <p className="text-sm text-surface-500 mt-1">Platform-wide appointment register.</p>
      </div>
      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-lg text-sm flex-1">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-lg text-sm flex-1">
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{APPOINTMENT_TYPE_LABELS[t]}</option>)}
        </select>
      </Card>

      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Doctor</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Hospital</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {appointments.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-surface-500">No appointments found.</td></tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-surface-900">{a.patient.user.fullName}</td>
                      <td className="px-5 py-3.5 text-surface-600">{a.doctor.fullName}</td>
                      <td className="px-5 py-3.5 text-surface-600">{a.hospital.name}, {a.hospital.city}</td>
                      <td className="px-5 py-3.5"><Badge variant="default">{APPOINTMENT_TYPE_LABELS[a.appointmentType] || a.appointmentType}</Badge></td>
                      <td className="px-5 py-3.5"><Badge variant={statusColor(a.status)} dot>{a.status}</Badge></td>
                      <td className="px-5 py-3.5 text-xs text-surface-500">{new Date(a.scheduledAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchAppointments(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchAppointments(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
