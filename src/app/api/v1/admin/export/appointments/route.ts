/**
 * Afzal Healthcare — GET /api/v1/admin/export/appointments
 * CSV export of appointments.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { generateCSV, csvResponse } from '@/lib/api/csv-helper';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
        doctor: { select: { fullName: true } },
        hospital: { select: { name: true, city: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10000,
    });

    const headers = ['Appointment ID', 'Patient Name', 'Doctor Name', 'Hospital Name', 'Hospital City', 'Scheduled Time', 'Status', 'Type'];
    const rows = appointments.map((a) => [
      a.id,
      a.patient.user.fullName,
      a.doctor.fullName,
      a.hospital.name,
      a.hospital.city,
      a.scheduledAt.toISOString(),
      a.status,
      a.appointmentType,
    ]);

    const csv = generateCSV(headers, rows);

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.EXPORT,
      entityType: 'Appointment',
      entityId: 'all',
      newValue: { statusFilter: status, count: appointments.length },
      ipAddress: getClientIP(request),
    });

    return csvResponse(csv, `appointments-export-${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) {
    console.error('[Appointments Export Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to export appointments', 500);
  }
}
