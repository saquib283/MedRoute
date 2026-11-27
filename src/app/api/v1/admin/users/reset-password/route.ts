/**
 * Afzal Healthcare — POST /api/v1/admin/users/reset-password
 * Reset a user's password (generates temporary password).
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import bcrypt from 'bcryptjs';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + '!';
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const userId = body.userId;
    if (!userId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'userId is required', 400);
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.RESET_PASSWORD,
      entityType: 'User',
      entityId: userId,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ temporaryPassword: tempPassword });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to reset password', 500);
  }
}
