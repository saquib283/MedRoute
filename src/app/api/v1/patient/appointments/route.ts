/**
 * MediRoute India — Patient Appointments API Endpoint
 * GET /api/v1/patient/appointments — List appointments & available metadata
 * POST /api/v1/patient/appointments — Request/book a new consultation
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { bookAppointmentSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const fetchMeta = searchParams.get('meta') === 'true';

    // Locate patient
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    // 1. Fetch patient's appointments
    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          select: {
            fullName: true,
            qualification: true,
          },
        },
        hospital: {
          select: {
            name: true,
            city: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // 2. Fetch metadata if requested (to populate dropdowns for new bookings)
    let hospitals: unknown[] = [];
    let doctors: unknown[] = [];
    let activeCaseId: string | null = null;

    if (fetchMeta) {
      hospitals = await prisma.hospital.findMany({
        where: { isActive: true },
        select: { id: true, name: true, city: true, departments: true },
      });

      doctors = await prisma.doctor.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, hospitalId: true, availableDays: true },
      });

      // Find an active case for booking references
      const activeCase = await prisma.case.findFirst({
        where: { patientId: patient.id, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' },
      });
      activeCaseId = activeCase ? activeCase.id : null;
    }

    return apiSuccess({
      appointments,
      metadata: fetchMeta ? { hospitals, doctors, activeCaseId } : undefined,
    });
  } catch (err) {
    console.error('[Patient Appointments GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch appointments', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();

    // Verify patient profile
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    // Attach patientId dynamically to payload for schema validation
    const payload = {
      ...body,
      patientId: patient.id,
    };

    const result = bookAppointmentSchema.safeParse(payload);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { caseId, hospitalId, doctorId, appointmentType, scheduledAt } = result.data;

    // Create the appointment record
    const appointment = await prisma.appointment.create({
      data: {
        caseId,
        patientId: patient.id,
        hospitalId,
        doctorId,
        appointmentType,
        scheduledAt: new Date(scheduledAt),
        createdBy: authUser!.userId,
        status: 'SCHEDULED',
      },
      include: {
        doctor: { select: { fullName: true } },
        hospital: { select: { name: true } },
      },
    });

    return apiSuccess({ appointment });
  } catch (err) {
    console.error('[Patient Appointments POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to request appointment', 500);
  }
}
