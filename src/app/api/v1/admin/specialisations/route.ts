/**
 * Afzal Healthcare — /api/v1/admin/specialisations
 * CRUD for medical specialisations with audit logging.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const specSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const specialisations = await prisma.specialisation.findMany({
      include: { _count: { select: { doctors: true } } },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({ specialisations });
  } catch (err) {
    console.error('[Admin Specialisations GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch specialisations', 500);
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
    const result = specSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const spec = await prisma.specialisation.create({ data: result.data });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Specialisation',
      entityId: spec.id,
      newValue: { name: spec.name },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ specialisation: spec }, undefined, 201);
  } catch (err) {
    console.error('[Admin Specialisations POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create specialisation', 500);
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
    const { id, ...data } = body;
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Specialisation ID required', 400);

    const existing = await prisma.specialisation.findUnique({
      where: { id },
      select: { name: true, isActive: true },
    });

    const result = specSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const spec = await prisma.specialisation.update({ where: { id }, data: result.data });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Specialisation',
      entityId: id,
      oldValue: existing,
      newValue: result.data,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ specialisation: spec });
  } catch (err) {
    console.error('[Admin Specialisations PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update specialisation', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Specialisation ID required', 400);

    const doctorCount = await prisma.doctor.count({
      where: { specialisationId: id, isActive: true },
    });

    if (doctorCount > 0) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Cannot deactivate specialisation with active associated doctors',
        400
      );
    }

    const existing = await prisma.specialisation.findUnique({
      where: { id },
      select: { name: true },
    });

    await prisma.specialisation.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DEACTIVATE,
      entityType: 'Specialisation',
      entityId: id,
      oldValue: existing,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Specialisation deactivated' });
  } catch (err) {
    console.error('[Admin Specialisations DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate specialisation', 500);
  }
}
