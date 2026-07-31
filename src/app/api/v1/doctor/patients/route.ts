/**
 * Afzal Healthcare — GET /api/v1/doctor/patients
 * Fetch patients that have appointments with the authenticated doctor.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const doctorProfile = await prisma.doctor.findUnique({
      where: { userId: authUser!.userId },
    });

    if (!doctorProfile) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Doctor profile not found', 404);
    }

    // Get unique patient IDs who have an appointment with this doctor
    const distinctAppointments = await prisma.appointment.findMany({
      where: { doctorId: doctorProfile.id },
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
      },
    });

    return apiSuccess({ patients });
  } catch (err) {
    console.error('[Doctor Patients GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch patients', 500);
  }
}
