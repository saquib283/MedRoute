/**
 * MediRoute India — /api/v1/admin/hostels
 * CRUD for hostel/accommodation partner management with audit logging.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const hostelSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  pricingPerNight: z.number().min(0),
  roomTypes: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  distanceToHospital: z.string().optional(),
  rating: z.number().optional(),
  contactPhone: z.string().optional(),
  rules: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const hostels = await prisma.hostel.findMany({
      include: { _count: { select: { accommodationBookings: true } } },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({ hostels });
  } catch (err) {
    console.error('[Admin Hostels GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch hostels', 500);
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
    const result = hostelSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const hostel = await prisma.hostel.create({
      data: {
        name: result.data.name,
        city: result.data.city,
        address: result.data.address,
        description: result.data.description || null,
        capacity: result.data.capacity,
        pricingPerNight: result.data.pricingPerNight,
        roomTypes: result.data.roomTypes || [],
        amenities: result.data.amenities || [],
        images: result.data.images || [],
        distanceToHospital: result.data.distanceToHospital || null,
        rating: result.data.rating || 4.8,
        contactPhone: result.data.contactPhone || null,
        rules: result.data.rules || null,
      },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Hostel',
      entityId: hostel.id,
      newValue: { name: hostel.name, city: hostel.city },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ hostel }, undefined, 201);
  } catch (err) {
    console.error('[Admin Hostels POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create hostel', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Hostel ID required', 400);

    const existing = await prisma.hostel.findUnique({
      where: { id },
      select: { name: true, city: true, isActive: true },
    });

    const result = hostelSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const hostel = await prisma.hostel.update({
      where: { id },
      data: result.data,
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Hostel',
      entityId: id,
      oldValue: existing,
      newValue: result.data,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ hostel });
  } catch (err) {
    console.error('[Admin Hostels PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update hostel', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Hostel ID required', 400);

    const existing = await prisma.hostel.findUnique({
      where: { id },
      select: { name: true },
    });

    await prisma.hostel.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DEACTIVATE,
      entityType: 'Hostel',
      entityId: id,
      oldValue: existing,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Hostel deactivated' });
  } catch (err) {
    console.error('[Admin Hostels DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate hostel', 500);
  }
}
