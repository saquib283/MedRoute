/**
 * Afzal Healthcare — /api/v1/admin/appointments
 * Platform-wide appointment listing with enhanced filters and cancel/reschedule.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const updateApptSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
  cancellationReason: z.string().optional(),
  scheduledAt: z.string().optional(), // ISO date string for reschedule
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const search = searchParams.get('search') || '';
    const hospitalId = searchParams.get('hospitalId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.appointmentType = type;
    if (hospitalId) where.hospitalId = hospitalId;
    if (search) {
      where.OR = [
        { patient: { user: { fullName: { contains: search } } } },
        { doctor: { fullName: { contains: search } } },
      ];
    }
    if (dateFrom || dateTo) {
      const scheduledAt: Record<string, Date> = {};
      if (dateFrom) scheduledAt.gte = new Date(dateFrom);
      if (dateTo) scheduledAt.lte = new Date(dateTo);
      where.scheduledAt = scheduledAt;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: { include: { user: { select: { fullName: true } } } },
          doctor: { select: { fullName: true } },
          hospital: { select: { name: true, city: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return apiSuccess({ appointments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Appointments GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch appointments', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = updateApptSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, ...updateData } = result.data;

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.APPOINTMENT_NOT_FOUND, 'Appointment not found', 404);
    }

    if (existing.status === 'CANCELLED') {
      return apiError(ERROR_CODES.APPOINTMENT_ALREADY_CANCELLED, 'Appointment already cancelled', 400);
    }

    // Handle cancel
    if (updateData.status === 'CANCELLED' && !updateData.cancellationReason) {
      return apiError(ERROR_CODES.CANCELLATION_REASON_REQUIRED, 'Cancellation reason required', 400);
    }

    const data: Record<string, unknown> = {};
    if (updateData.status) data.status = updateData.status;
    if (updateData.cancellationReason) data.cancellationReason = updateData.cancellationReason;
    if (updateData.scheduledAt) data.scheduledAt = new Date(updateData.scheduledAt);

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: updateData.status === 'CANCELLED' ? AUDIT_ACTIONS.DELETE : AUDIT_ACTIONS.UPDATE,
      entityType: 'Appointment',
      entityId: id,
      oldValue: { status: existing.status, scheduledAt: existing.scheduledAt },
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ appointment });
  } catch (err) {
    console.error('[Admin Appointments PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update appointment', 500);
  }
}
