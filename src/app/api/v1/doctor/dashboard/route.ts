/**
 * Afzal Healthcare — GET /api/v1/doctor/dashboard
 * Aggregates summary counters for the doctor dashboard.
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

    // Resolve the doctor profile tied to this user
    const doctorProfile = await prisma.doctor.findUnique({
      where: { userId: authUser!.userId },
    });

    if (!doctorProfile) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Doctor profile not found for this account', 404);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Appointments Today
    const todayAppointmentsCount = await prisma.appointment.count({
      where: {
        doctorId: doctorProfile.id,
        scheduledAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: { not: 'CANCELLED' },
      },
    });

    // 2. Pending Pre-op / Post-op assessments
    const pendingAssessmentsCount = await prisma.appointment.count({
      where: {
        doctorId: doctorProfile.id,
        appointmentType: { in: ['PRE_OP_ASSESSMENT', 'POST_OP_REVIEW'] },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    });

    // 3. Total Surgeries scheduled
    const totalSurgeriesCount = await prisma.appointment.count({
      where: {
        doctorId: doctorProfile.id,
        appointmentType: 'SURGERY',
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    return apiSuccess({
      metrics: {
        todayAppointments: todayAppointmentsCount,
        pendingAssessments: pendingAssessmentsCount,
        upcomingSurgeries: totalSurgeriesCount,
      },
    });
  } catch (err) {
    console.error('[Doctor Dashboard GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch doctor dashboard metrics', 500);
  }
}
