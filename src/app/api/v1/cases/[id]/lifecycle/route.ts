/**
 * Afzal Healthcare — Unified Multi-Role Case Lifecycle API
 * GET /api/v1/cases/[id]/lifecycle — Fetch case lifecycle state, masked ePHI logistics, and dynamic nextActions
 * PUT /api/v1/cases/[id]/lifecycle — Execute role-scoped, audited lifecycle mutations
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  executeCaseLifecycleMutation,
  getCaseLifecycle,
} from '@/lib/services/case-lifecycle.service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await context.params;
    const result = await getCaseLifecycle(caseId, {
      userId: authUser.userId,
      role: authUser.role,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Case Lifecycle GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch case lifecycle', 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await executeCaseLifecycleMutation({
      caseId,
      body,
      actor: {
        userId: authUser.userId,
        role: authUser.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Case Lifecycle PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update case lifecycle', 500);
  }
}
