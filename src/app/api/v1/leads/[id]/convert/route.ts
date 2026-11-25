/**
 * Afzal Healthcare — POST /api/v1/leads/[id]/convert
 * Atomic 1-click conversion of a Lead into a Patient + Case (NEW_PATIENT or EXISTING_PATIENT).
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import { convertLeadToPatientCase } from '@/lib/services/leads-conversion.service';

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

    const result = await convertLeadToPatientCase(id, body, {
      userId: authUser!.userId,
      role: authUser!.role,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data, undefined, 201);
  } catch (err) {
    console.error('[Lead Convert POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to convert lead', 500);
  }
}
