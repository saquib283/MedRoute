/**
 * Afzal Healthcare — /api/v1/admin/doctors
 * CRUD for doctor management with portal account provisioning/linking and audit logging.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const doctorSchema = z.object({
  hospitalId: z.string().min(1),
  fullName: z.string().min(1),
  specialisationId: z.string().min(1),
  qualification: z.string().optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().min(0).optional(),
  availableDays: z.array(z.string()).optional(),
  userId: z.string().nullable().optional(),
  createAccount: z.boolean().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
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
    const includeMeta = searchParams.get('meta') === 'true';

    const doctors = await prisma.doctor.findMany({
      include: {
        hospital: { select: { id: true, name: true, city: true } },
        specialisation: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, fullName: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    if (includeMeta) {
      const unlinkedDoctorUsers = await prisma.user.findMany({
        where: { role: 'DOCTOR', isActive: true, doctorProfile: null },
        select: { id: true, email: true, fullName: true },
        orderBy: { fullName: 'asc' },
      });
      return apiSuccess({ doctors, unlinkedDoctorUsers });
    }

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
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = doctorSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const {
      createAccount,
      email,
      password,
      userId,
      hospitalId,
      fullName,
      specialisationId,
      qualification,
      languages,
      consultationFee,
      availableDays,
      isActive,
    } = result.data;

    let doctor;

    if (createAccount) {
      if (!email || !password) {
        return apiError(
          ERROR_CODES.BAD_REQUEST,
          'Email and password (min 8 chars) are required when creating a portal account',
          400
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser) {
        return apiError(ERROR_CODES.USER_ALREADY_EXISTS, 'An account with this email already exists', 409);
      }

      const passwordHash = await hashPassword(password);
      doctor = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            role: 'DOCTOR',
            fullName: fullName.trim(),
            isActive: true,
          },
        });

        return tx.doctor.create({
          data: {
            hospitalId,
            fullName,
            specialisationId,
            qualification,
            languages: languages || [],
            consultationFee,
            availableDays: availableDays || [],
            userId: newUser.id,
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });
      });
    } else {
      let resolvedUserId: string | null = null;
      if (userId && userId.trim()) {
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true },
        });
        if (!targetUser || targetUser.role !== 'DOCTOR') {
          return apiError(ERROR_CODES.BAD_REQUEST, 'Selected user must have DOCTOR role', 400);
        }

        const existingLink = await prisma.doctor.findFirst({
          where: { userId },
          select: { id: true },
        });
        if (existingLink) {
          return apiError(ERROR_CODES.USER_ALREADY_EXISTS, 'This user account is already linked to a doctor', 409);
        }
        resolvedUserId = userId;
      }

      doctor = await prisma.doctor.create({
        data: {
          hospitalId,
          fullName,
          specialisationId,
          qualification,
          languages: languages || [],
          consultationFee,
          availableDays: availableDays || [],
          userId: resolvedUserId,
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
    }

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Doctor',
      entityId: doctor.id,
      newValue: { fullName: doctor.fullName, hospitalId: doctor.hospitalId, userId: doctor.userId },
      ipAddress: getClientIP(request),
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
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Doctor ID required', 400);

    const existing = await prisma.doctor.findUnique({
      where: { id },
      select: { id: true, fullName: true, hospitalId: true, specialisationId: true, userId: true, isActive: true },
    });
    if (!existing) {
      return apiError(ERROR_CODES.DOCTOR_NOT_FOUND, 'Doctor not found', 404);
    }

    const result = doctorSchema.partial().safeParse(data);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { createAccount, email, password, userId, ...doctorFields } = result.data;

    let doctor;

    if (createAccount) {
      if (!email || !password) {
        return apiError(
          ERROR_CODES.BAD_REQUEST,
          'Email and password (min 8 chars) are required when creating a portal account',
          400
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser) {
        return apiError(ERROR_CODES.USER_ALREADY_EXISTS, 'An account with this email already exists', 409);
      }

      const passwordHash = await hashPassword(password);
      doctor = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            role: 'DOCTOR',
            fullName: (doctorFields.fullName || existing.fullName).trim(),
            isActive: true,
          },
        });

        return tx.doctor.update({
          where: { id },
          data: {
            ...doctorFields,
            userId: newUser.id,
          },
        });
      });
    } else {
      const updateData: Record<string, unknown> = { ...doctorFields };

      if (userId !== undefined) {
        if (userId && userId.trim()) {
          const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
          });
          if (!targetUser || targetUser.role !== 'DOCTOR') {
            return apiError(ERROR_CODES.BAD_REQUEST, 'Selected user must have DOCTOR role', 400);
          }

          const existingLink = await prisma.doctor.findFirst({
            where: { userId, id: { not: id } },
            select: { id: true },
          });
          if (existingLink) {
            return apiError(ERROR_CODES.USER_ALREADY_EXISTS, 'This user account is already linked to another doctor', 409);
          }
          updateData.userId = userId;
        } else {
          updateData.userId = null;
        }
      }

      doctor = await prisma.doctor.update({
        where: { id },
        data: updateData,
      });
    }

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Doctor',
      entityId: id,
      oldValue: existing,
      newValue: { ...doctorFields, userId: doctor.userId },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ doctor });
  } catch (err) {
    console.error('[Admin Doctors PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update doctor', 500);
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
    if (!id) return apiError(ERROR_CODES.BAD_REQUEST, 'Doctor ID required', 400);

    const existing = await prisma.doctor.findUnique({
      where: { id },
      select: { fullName: true },
    });

    await prisma.doctor.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DEACTIVATE,
      entityType: 'Doctor',
      entityId: id,
      oldValue: existing,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Doctor deactivated' });
  } catch (err) {
    console.error('[Admin Doctors DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate doctor', 500);
  }
}
