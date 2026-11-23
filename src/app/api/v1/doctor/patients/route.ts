/**
 * Afzal Healthcare — GET /api/v1/doctor/patients
 * Fetch patients that have appointments with the authenticated doctor.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { formatPatientForViewer } from '@/lib/services/phi.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'DOCTOR') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Doctor access required', 403);
    }

    const doctorProfile = await prisma.doctor.findUnique({
      where: { userId: authUser!.userId },
    });

    if (!doctorProfile || !doctorProfile.isActive) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Active doctor profile not found', 404);
    }

    // Get unique patient IDs who have an active (non-cancelled) appointment with this doctor
    const distinctAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        status: { not: 'CANCELLED' },
      },
      select: { patientId: true },
      distinct: ['patientId'],
    });

    const patientIds = distinctAppointments.map((a) => a.patientId);

    if (patientIds.length === 0) {
      return apiSuccess({ patients: [] });
    }

    // Fetch full patient data for these patients
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        medicalProfile: true,
        cases: {
          where: { status: { not: 'CLOSED' } },
          select: {
            id: true,
            status: true,
            isUrgent: true,
            fitToFlyClearance: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const formattedPatients = patients.map((p) =>
      formatPatientForViewer(p, { maskPassport: true })
    );

    void createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.VIEW_PATIENT,
      entityType: 'Patient',
      entityId: 'doctor-cohort',
      newValue: { count: formattedPatients.length },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ patients: formattedPatients });
  } catch (err) {
    console.error('[Doctor Patients GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch patients', 500);
  }
}
