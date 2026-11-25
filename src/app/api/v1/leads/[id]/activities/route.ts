/**
 * Afzal Healthcare — /api/v1/leads/[id]/activities
 * POST: Log omnichannel touchpoint / note / quote / follow-up schedule on a Lead.
 * PATCH: Mark a scheduled follow-up task as completed.
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  completeLeadFollowUpTask,
  logLeadActivityForActor,
} from '@/lib/services/leads-crm.service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await logLeadActivityForActor(id, body, {
      userId: authUser!.userId,
      role: authUser!.role,
      email: authUser!.email,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data, undefined, 201);
  } catch (err) {
    console.error('[Lead Activity POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to log lead activity', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const activityId =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).activityId === 'string'
        ? ((body as Record<string, unknown>).activityId as string)
        : '';

    if (!activityId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'activityId is required', 400);
    }

    const result = await completeLeadFollowUpTask(id, activityId, {
      userId: authUser!.userId,
      role: authUser!.role,
      email: authUser!.email,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Lead Activity PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to complete follow-up task', 500);
  }
}
