/**
 * Afzal Healthcare — Neutral Multi-Role Case Clinical Pathway API
 * GET   /api/v1/cases/[id]/pathway — Fetch case pathway (ADMIN, assigned MANAGER, treating DOCTOR, owning PATIENT)
 * POST  /api/v1/cases/[id]/pathway — Replace full case pathway (ADMIN, assigned MANAGER)
 * PATCH /api/v1/cases/[id]/pathway — Update single pathway step (ADMIN, assigned MANAGER, treating DOCTOR)
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  getCasePathwayForViewer,
  replaceCasePathway,
  updateSinglePathwayStep,
} from '@/lib/services/clinical-pathway.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

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
    console.error('[Case Pathway GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch clinical pathway', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

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
    console.error('[Case Pathway POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save clinical pathway', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await updateSinglePathwayStep({
      caseId,
      stepId: body.stepId,
      status: body.status,
      decisionBranch: body.decisionBranch,
      doctorNotes: body.doctorNotes,
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
    console.error('[Case Pathway PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update clinical pathway step', 500);
  }
}
