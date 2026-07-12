/**
 * MediRoute India — /api/v1/admin/doctors
 * CRUD for doctor management.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { z } from 'zod';

const doctorSchema = z.object({
  hospitalId: z.string().min(1),
  fullName: z.string().min(1),
  specialisationId: z.string().min(1),
  qualification: z.string().optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().min(0).optional(),
  availableDays: z.array(z.string()).optional(),
  userId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'SUPER_ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const doctors = await prisma.doctor.findMany({
      include: {
        hospital: { select: { name: true, city: true } },
        specialisation: { select: { name: true } },
        user: { select: { email: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return apiSuccess({ doctors });
  } catch (err) {
    console.error('[Admin Doctors GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch doctors', 500);
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
    const result = doctorSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const doctor = await prisma.doctor.create({
      data: {
        hospitalId: result.data.hospitalId,
        fullName: result.data.fullName,
        specialisationId: result.data.specialisationId,
        qualification: result.data.qualification,
        languages: result.data.languages || [],
        consultationFee: result.data.consultationFee,
        availableDays: result.data.availableDays || [],
        userId: result.data.userId || null,
      },
    });

    return apiSuccess({ doctor }, undefined, 201);
  } catch (err) {
    console.error('[Admin Doctors POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create doctor', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Doctor ID required', 400);

    const result = doctorSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: result.data,
    });

    return apiSuccess({ doctor });
  } catch (err) {
    console.error('[Admin Doctors PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update doctor', 500);
  }
}
