/**
 * Afzal Healthcare — /api/v1/admin/users
 * Full CRUD for user management with audit logging and Admin guards.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']).optional(),
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
    const role = searchParams.get('role') || '';
    const isActiveParam = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (isActiveParam !== null && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return apiSuccess({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Users GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch users', 500);
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
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const existing = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (existing) {
      return apiError(ERROR_CODES.USER_ALREADY_EXISTS, 'Email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: result.data.email,
        passwordHash,
        fullName: result.data.fullName,
        role: result.data.role,
        phone: result.data.phone,
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: user.role, fullName: user.fullName },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ user }, undefined, 201);
  } catch (err) {
    console.error('[Admin Users POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create user', 500);
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
    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, ...updateData } = result.data;

    // Fetch existing user
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
    }

    // If deactivating, revoke all refresh tokens
    if (updateData.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'User',
      entityId: id,
      oldValue: { email: existingUser.email, role: existingUser.role, fullName: existingUser.fullName, isActive: existingUser.isActive },
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ user });
  } catch (err) {
    console.error('[Admin Users PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update user', 500);
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
    const userId = searchParams.get('id');
    if (!userId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'User ID required', 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, fullName: true },
    });

    // Soft delete
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DEACTIVATE,
      entityType: 'User',
      entityId: userId,
      oldValue: existingUser,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'User deactivated' });
  } catch (err) {
    console.error('[Admin Users DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to delete user', 500);
  }
}
