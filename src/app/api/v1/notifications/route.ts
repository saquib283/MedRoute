/**
 * Afzal Healthcare — /api/v1/notifications
 * Authenticated in-app notification reader and mark-read endpoints for all 4 roles.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import {
  listUserNotifications,
  markUserNotificationsRead,
} from '@/lib/services/notifications.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const rawLimit = request.nextUrl.searchParams.get('limit');
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : undefined;
    const limit =
      parsedLimit !== undefined && !Number.isNaN(parsedLimit) ? parsedLimit : undefined;
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true';

    const result = await listUserNotifications({
      userId: authUser.userId,
      limit,
      unreadOnly,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Notifications GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch notifications', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON body', 400);
    }

    const payload =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const result = await markUserNotificationsRead({
      userId: authUser.userId,
      notificationId: payload.notificationId,
      markAllRead: payload.markAllRead,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Notifications PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update notifications', 500);
  }
}
