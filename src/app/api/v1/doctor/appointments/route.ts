/**
 * Afzal Healthcare — GET / PUT /api/v1/doctor/appointments
 * Fetch and update appointments specifically assigned to the doctor.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { z } from 'zod';

const updateAppointmentSchema = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']),
  clinicalNotes: z.string().max(10000).optional(),
});

async function requireActiveDoctor(request: NextRequest) {
  const { user: authUser, error } = requireAuth(request);
  if (error) return { authUser: null, doctorProfile: null, error };
  if (authUser!.role !== 'DOCTOR') {
    return {
      authUser: null,
      doctorProfile: null,
      error: apiError(ERROR_CODES.FORBIDDEN, 'Doctor access required', 403),
    };
  }

  const doctorProfile = await prisma.doctor.findUnique({
    where: { userId: authUser!.userId },
  });

  if (!doctorProfile || !doctorProfile.isActive) {
    return {
      authUser: null,
      doctorProfile: null,
      error: apiError(ERROR_CODES.USER_NOT_FOUND, 'Active doctor profile not found', 404),
    };
  }

  return { authUser, doctorProfile, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile, error } = await requireActiveDoctor(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, upcoming, past

    let dateFilter = {};
    if (filter === 'upcoming') {
      dateFilter = { gte: new Date() };
    } else if (filter === 'past') {
      dateFilter = { lt: new Date() };
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        ...(filter !== 'all' ? { scheduledAt: dateFilter } : {}),
      },
      include: {
        patient: {
          select: {
            user: { select: { fullName: true } },
            nationality: true,
          },
        },
        case: {
          select: { id: true, isUrgent: true, status: true },
        },
        hospital: {
          select: { name: true, city: true },
        },
      },
      orderBy: { scheduledAt: filter === 'past' ? 'desc' : 'asc' },
    });

    return apiSuccess({ appointments });
  } catch (err) {
    console.error('[Doctor Appointments GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch appointments', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { authUser, doctorProfile, error } = await requireActiveDoctor(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('id');
    if (!appointmentId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Appointment ID is required', 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid request body', 400);
    }

    const result = updateAppointmentSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    // Verify appointment belongs to this doctor
    const existing = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId: doctorProfile.id },
    });

    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Appointment not found or not assigned to you', 404);
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: result.data.status,
        clinicalNotes:
          result.data.clinicalNotes !== undefined
            ? result.data.clinicalNotes
            : existing.clinicalNotes,
      },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action:
        result.data.status !== existing.status
          ? AUDIT_ACTIONS.STATUS_CHANGE
          : AUDIT_ACTIONS.UPDATE,
      entityType: 'Appointment',
      entityId: appointmentId,
      oldValue: {
        status: existing.status,
        clinicalNotes: existing.clinicalNotes,
      },
      newValue: {
        status: updated.status,
        clinicalNotes: updated.clinicalNotes,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ appointment: updated });
  } catch (err) {
    console.error('[Doctor Appointments PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update appointment', 500);
  }
}
