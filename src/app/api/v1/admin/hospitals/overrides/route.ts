/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Afzal Healthcare — /api/v1/admin/hospitals/overrides
 * CRUD for managing specific date-bound commission overrides.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const overrideSchema = z.object({
  hospitalId: z.string().min(1),
  rate: z.number().min(0).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get('hospitalId') || '';

    const where: Record<string, unknown> = {};
    if (hospitalId) where.hospitalId = hospitalId;

    const overrides = await prisma.commissionOverride.findMany({
      where,
      include: {
        hospital: { select: { name: true, city: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const mappedOverrides = overrides.map((o) => ({
      id: o.id,
      hospitalId: o.hospitalId,
      rate: o.rate,
      startDate: o.startDate,
      endDate: o.endDate,
      notes: o.description,
      createdAt: o.createdAt,
      hospital: o.hospital,
    }));

    return apiSuccess({ overrides: mappedOverrides });
  } catch (err) {
    console.error('[Admin Overrides GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch commission overrides', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = overrideSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { hospitalId, rate, startDate, endDate, notes } = result.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Start date must be before end date', 400);
    }

    const override = (await prisma.commissionOverride.create({
      data: {
        hospitalId,
        rate,
        startDate: start,
        endDate: end,
        description: notes,
      },
      include: { hospital: { select: { name: true } } },
    })) as any;

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'CommissionOverride',
      entityId: override.id,
      newValue: {
        hospitalName: override.hospital.name,
        rate,
        startDate: start,
        endDate: end,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ override }, undefined, 201);
  } catch (err) {
    console.error('[Admin Overrides POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create override', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Override ID required', 400);
    }

    const existing = (await prisma.commissionOverride.findUnique({
      where: { id },
      include: { hospital: { select: { name: true } } },
    })) as any;

    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Override not found', 404);
    }
    

    await prisma.commissionOverride.delete({ where: { id } });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'CommissionOverride',
      entityId: id,
      oldValue: {
        hospitalName: existing.hospital.name,
        rate: existing.rate,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Override deleted successfully' });
  } catch (err) {
    console.error('[Admin Overrides DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to delete override', 500);
  }
}
