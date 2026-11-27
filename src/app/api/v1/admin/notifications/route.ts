/**
 * Afzal Healthcare — /api/v1/admin/notifications
 * Global notifications management and broadcast channel.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

const broadcastSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  channel: z.enum(['IN_APP', 'EMAIL', 'SMS']).default('IN_APP'),
  targetRole: z.enum(['ALL', 'PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const targetUserId = searchParams.get('userId') || '';

    const where: Record<string, unknown> = {};
    if (targetUserId) {
      where.userId = targetUserId;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { user: { select: { fullName: true, role: true, email: true } } },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return apiSuccess({ notifications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Notifications GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch notifications', 500);
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
    const result = broadcastSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { title, body: msgBody, channel, targetRole } = result.data;

    // Find target users
    const whereClause: Record<string, unknown> = { isActive: true };
    if (targetRole !== 'ALL') {
      whereClause.role = targetRole as UserRole;
    }

    const targetUsers = await prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (targetUsers.length === 0) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No active target users found for this role', 400);
    }

    // Create notifications for all targets
    const notificationData = targetUsers.map((u) => ({
      userId: u.id,
      channel,
      title,
      body: msgBody,
      triggerEvent: 'BROADCAST',
    }));

    await prisma.notification.createMany({
      data: notificationData,
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.BROADCAST_NOTIFICATION,
      entityType: 'Notification',
      entityId: 'broadcast',
      newValue: { targetRole, title, channel, count: targetUsers.length },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ sentCount: targetUsers.length });
  } catch (err) {
    console.error('[Admin Notifications POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to send broadcast', 500);
  }
}
