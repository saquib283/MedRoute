/**
 * Afzal Healthcare — /api/v1/admin/settings
 * Platform configuration settings backed by Prisma SystemConfig. Admin only.
 */

import { NextRequest } from 'next/server';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import {
  getSystemSettings,
  updateSystemSettings,
} from '@/lib/services/system-settings.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const settings = await getSystemSettings();
    return apiSuccess({ settings });
  } catch (err) {
    console.error('[Admin Settings GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch settings', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON body', 400);
    }

    const result = await updateSystemSettings(body, {
      userId: authUser!.userId,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess({ settings: result.data });
  } catch (err) {
    console.error('[Admin Settings PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save settings', 500);
  }
}
