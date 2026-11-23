/**
 * Afzal Healthcare — In-App Notification Reader & Mark-Read Service
 * Enforces strict tenant isolation (always scoped to authenticated userId).
 */

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import type { ServiceResult } from '@/lib/services/clinical-pathway.service';

export interface NotificationItem {
  id: string;
  userId: string;
  channel: string;
  title: string;
  body: string;
  isRead: boolean;
  sentAt: Date;
  triggerEvent: string | null;
}

export interface ListNotificationsInput {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
}

export interface MarkNotificationsReadInput {
  userId: string;
  notificationId?: unknown;
  markAllRead?: unknown;
}

const markReadSchema = z.object({
  notificationId: z.string().trim().min(1).optional(),
  markAllRead: z.boolean().optional(),
});

function clampLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 20;
  }
  return Math.min(50, Math.max(1, Math.trunc(limit)));
}

/**
 * List recent notifications strictly scoped to the authenticated user,
 * together with their total unread notification count.
 */
export async function listUserNotifications({
  userId,
  limit,
  unreadOnly = false,
}: ListNotificationsInput): Promise<
  ServiceResult<{ notifications: NotificationItem[]; unreadCount: number }>
> {
  const safeLimit = clampLimit(limit);
  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: safeLimit,
    }),
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
  ]);

  return {
    ok: true,
    data: {
      notifications,
      unreadCount,
    },
  };
}

/**
 * Mark a single owned notification as read (with strict 404/403 IDOR checks)
 * or mark all unread notifications for the authenticated user as read.
 */
export async function markUserNotificationsRead(
  input: MarkNotificationsReadInput
): Promise<ServiceResult<{ unreadCount: number }>> {
  const parsed = markReadSchema.safeParse({
    notificationId: input.notificationId,
    markAllRead: input.markAllRead,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Invalid notification update payload',
      status: 400,
    };
  }

  const { notificationId, markAllRead } = parsed.data;

  if (markAllRead !== true && !notificationId) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Either notificationId or markAllRead: true is required',
      status: 400,
    };
  }

  if (markAllRead === true) {
    await prisma.notification.updateMany({
      where: { userId: input.userId, isRead: false },
      data: { isRead: true },
    });
  } else if (notificationId) {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, isRead: true },
    });

    if (!existing) {
      return {
        ok: false,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Notification not found',
        status: 404,
      };
    }

    if (existing.userId !== input.userId) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to update this notification',
        status: 403,
      };
    }

    if (!existing.isRead) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, isRead: false },
  });

  return {
    ok: true,
    data: { unreadCount },
  };
}
