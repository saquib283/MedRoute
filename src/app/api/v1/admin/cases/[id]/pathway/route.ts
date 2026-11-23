/**
 * Afzal Healthcare — Admin Configurable Patient Pathway API (Wrapper)
 * GET  /api/v1/admin/cases/[id]/pathway — Fetch patient's clinical pathway
 * POST /api/v1/admin/cases/[id]/pathway — Replace patient's clinical pathway
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess, forbidden } from '@/lib/api/response';
import {
  getCasePathwayForViewer,
  replaceCasePathway,
} from '@/lib/services/clinical-pathway.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser.role !== 'ADMIN') {
      return forbidden();
    }

    const { id: caseId } = await params;
    const result = await getCasePathwayForViewer(caseId, {
      userId: authUser.userId,
      role: authUser.role,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Admin Pathway GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch clinical pathway configuration', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser.role !== 'ADMIN') {
      return forbidden();
    }

    const { id: caseId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await replaceCasePathway({
      caseId,
      steps: body.steps,
      caseStatus: body.caseStatus,
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
    console.error('[Admin Pathway POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save patient clinical pathway', 500);
  }
}
