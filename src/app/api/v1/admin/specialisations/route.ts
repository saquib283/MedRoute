/**
 * MediRoute India — /api/v1/admin/specialisations
 * CRUD for medical specialisations.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
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
    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'SUPER_ADMIN') {
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
    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'SUPER_ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = specSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const spec = await prisma.specialisation.create({ data: result.data });
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
    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'SUPER_ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Specialisation ID required', 400);

    const result = specSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const spec = await prisma.specialisation.update({ where: { id }, data: result.data });
    return apiSuccess({ specialisation: spec });
  } catch (err) {
    console.error('[Admin Specialisations PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update specialisation', 500);
  }
}
