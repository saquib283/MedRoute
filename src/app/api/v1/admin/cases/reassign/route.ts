/**
 * Afzal Healthcare — /api/v1/admin/cases/reassign
 * Bulk case load reassignment endpoint. Admin only.
 */

import { NextRequest } from 'next/server';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { assignPatientCoordinator } from '@/lib/services/case-assignment.service';
import { z } from 'zod';

const reassignSchema = z.object({
  caseIds: z.array(z.string().min(1)).min(1),
  targetManagerId: z.string().min(1).nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = reassignSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { caseIds, targetManagerId } = result.data;

    const assignRes = await assignPatientCoordinator({
      caseIds,
      managerId: targetManagerId,
      actorId: authUser!.userId,
      ipAddress: getClientIP(request),
    });

    if (!assignRes.ok) {
      return apiError(assignRes.code, assignRes.message, assignRes.status);
    }

    return apiSuccess({ reassignedCount: assignRes.reassignedCount });
  } catch (err) {
    console.error('[Bulk Reassign Cases POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to reassign cases', 500);
  }
}
