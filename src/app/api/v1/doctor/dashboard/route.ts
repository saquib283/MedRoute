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
    if (authUser!.role !== 'DOCTOR') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Doctor access required', 403);
    }

    // Resolve the doctor profile tied to this user
    const doctorProfile = await prisma.doctor.findUnique({
      where: { userId: authUser!.userId },
      include: {
        hospital: { select: { name: true, city: true } },
        specialisation: { select: { name: true } },
      },
    });

    if (!doctorProfile || !doctorProfile.isActive) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Active doctor profile not found', 404);
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

    // 4. Top 6 upcoming appointments from today onward
    const upcomingSchedule = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        scheduledAt: { gte: todayStart },
        status: { not: 'CANCELLED' },
      },
      take: 6,
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: {
          select: {
            user: { select: { fullName: true } },
            nationality: true,
          },
        },
        case: {
          select: { id: true, status: true, isUrgent: true },
        },
      },
    });

    // 5. Active clinical cases linked to this doctor's non-cancelled appointments
    const distinctCaseAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        status: { not: 'CANCELLED' },
      },
      select: { caseId: true },
      distinct: ['caseId'],
    });

    const caseIds = Array.from(
      new Set(distinctCaseAppointments.map((a) => a.caseId).filter(Boolean))
    );

    const pendingClinicalCases =
      caseIds.length > 0
        ? await prisma.case.findMany({
            where: {
              id: { in: caseIds },
              status: { not: 'CLOSED' },
            },
            include: {
              patient: {
                select: {
                  nationality: true,
                  user: { select: { fullName: true } },
                },
              },
              clinicalSteps: {
                where: { status: { not: 'COMPLETED' } },
                orderBy: [{ stageOrder: 'asc' }, { stepOrder: 'asc' }],
              },
              fitToFlyClearance: true,
            },
            orderBy: [{ isUrgent: 'desc' }, { lastUpdatedAt: 'desc' }],
          })
        : [];

    return apiSuccess({
      doctorProfile,
      metrics: {
        todayAppointments: todayAppointmentsCount,
        pendingAssessments: pendingAssessmentsCount,
        upcomingSurgeries: totalSurgeriesCount,
        activeCases: pendingClinicalCases.length,
      },
      upcomingSchedule,
      pendingClinicalCases,
    });
  } catch (err) {
    console.error('[Doctor Dashboard GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch doctor dashboard metrics', 500);
  }
}
