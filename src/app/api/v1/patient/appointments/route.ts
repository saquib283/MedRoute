/**
 * Afzal Healthcare — Patient Appointments API Endpoint
 * GET /api/v1/patient/appointments — List appointments & available metadata
 * POST /api/v1/patient/appointments — Request/book a new consultation
 * PUT /api/v1/patient/appointments — Self-cancel an active appointment with reason
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { bookAppointmentSchema } from '@/lib/validation/schemas';
import { isDoctorAvailableOnDate } from '@/lib/validation/booking-helpers';

interface HospitalOption {
  id: string;
  name: string;
  city: string;
  departments: unknown;
}

interface DoctorOption {
  id: string;
  fullName: string;
  hospitalId: string;
  availableDays: unknown;
}

const patientCancelSchema = z.object({
  appointmentId: z.string().min(1),
  cancellationReason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(1000),
});

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
    let hospitals: HospitalOption[] = [];
    let doctors: DoctorOption[] = [];
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

    if (appointmentType === 'SURGERY') {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Surgical procedures must be scheduled by your Case Manager',
        400
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid scheduled date', 400);
    }

    // Verify case ownership and active status
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord || caseRecord.patientId !== patient.id) {
      return apiError(ERROR_CODES.FORBIDDEN, 'Invalid case for patient', 403);
    }
    if (caseRecord.status === 'CLOSED') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Cannot request an appointment for a closed case', 400);
    }

    // Verify doctor & hospital are active and match
    const [doctor, hospital] = await Promise.all([
      prisma.doctor.findUnique({ where: { id: doctorId } }),
      prisma.hospital.findUnique({ where: { id: hospitalId } }),
    ]);

    if (!doctor || !hospital || !doctor.isActive || !hospital.isActive || doctor.hospitalId !== hospitalId) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Selected doctor or hospital is inactive or mismatched',
        400
      );
    }

    if (!isDoctorAvailableOnDate(doctor.availableDays, scheduledDate)) {
      return apiError(
        ERROR_CODES.SLOT_UNAVAILABLE,
        'Doctor is not available on the selected day',
        400
      );
    }

    // Create the appointment record
    const appointment = await prisma.appointment.create({
      data: {
        caseId,
        patientId: patient.id,
        hospitalId,
        doctorId,
        appointmentType,
        scheduledAt: scheduledDate,
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

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });
    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    const body = await request.json();
    const parsed = patientCancelSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, parsed.error.issues[0].message, 400);
    }

    const { appointmentId, cancellationReason } = parsed.data;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.patientId !== patient.id) {
      return apiError(ERROR_CODES.APPOINTMENT_NOT_FOUND, 'Appointment not found', 404);
    }

    if (!['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status)) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Only scheduled, confirmed, or rescheduled appointments can be cancelled',
        400
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancellationReason,
      },
    });

    return apiSuccess({ appointment: updated });
  } catch (err) {
    console.error('[Patient Appointments PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel appointment', 500);
  }
}
