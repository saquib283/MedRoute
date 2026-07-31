/**
 * Afzal Healthcare — /api/v1/admin/hospitals
 * CRUD for hospital partner management with audit logging.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const hospitalSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  accreditation: z.string().optional(),
  contactPerson: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  departments: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const city = searchParams.get('city') || '';

    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    if (city) where.city = { contains: city };

    const hospitals = await prisma.hospital.findMany({
      where,
      include: { _count: { select: { doctors: true, appointments: true } } },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({ hospitals });
  } catch (err) {
    console.error('[Admin Hospitals GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch hospitals', 500);
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
    const result = hospitalSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const hospital = await prisma.hospital.create({
      data: {
        name: result.data.name, city: result.data.city, address: result.data.address,
        accreditation: result.data.accreditation, contactPerson: result.data.contactPerson,
        commissionRate: result.data.commissionRate, departments: result.data.departments || [],
      },
    });

    await createAuditLog({
      actorId: authUser!.userId, action: AUDIT_ACTIONS.CREATE, entityType: 'Hospital',
      entityId: hospital.id, newValue: { name: hospital.name, city: hospital.city },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ hospital }, undefined, 201);
  } catch (err) {
    console.error('[Admin Hospitals POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create hospital', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Hospital ID required', 400);

    const existing = await prisma.hospital.findUnique({ where: { id }, select: { name: true, city: true, isActive: true } });
    const result = hospitalSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const hospital = await prisma.hospital.update({ where: { id }, data: result.data });

    await createAuditLog({
      actorId: authUser!.userId, action: AUDIT_ACTIONS.UPDATE, entityType: 'Hospital',
      entityId: id, oldValue: existing, newValue: result.data, ipAddress: getClientIP(request),
    });

    return apiSuccess({ hospital });
  } catch (err) {
    console.error('[Admin Hospitals PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update hospital', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Hospital ID required', 400);

    const existing = await prisma.hospital.findUnique({ where: { id }, select: { name: true } });
    await prisma.hospital.update({ where: { id }, data: { isActive: false } });

    await createAuditLog({
      actorId: authUser!.userId, action: AUDIT_ACTIONS.DEACTIVATE, entityType: 'Hospital',
      entityId: id, oldValue: existing, ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Hospital deactivated' });
  } catch (err) {
    console.error('[Admin Hospitals DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate hospital', 500);
  }
}
