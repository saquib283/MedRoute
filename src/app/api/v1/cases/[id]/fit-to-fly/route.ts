/**
 * Afzal Healthcare — Case Fit-to-Fly Clearance API
 * GET /api/v1/cases/[id]/fit-to-fly — Fetch FitToFlyClearance and certificate document
 * PUT /api/v1/cases/[id]/fit-to-fly — Certify or update Fit-to-Fly clearance (treating DOCTOR or ADMIN)
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  getCaseFitToFly,
  upsertCaseFitToFly,
} from '@/lib/services/clinical-certificate.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;
    const result = await getCaseFitToFly(caseId, {
      userId: authUser.userId,
      role: authUser.role,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Case Fit-to-Fly GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch Fit-to-Fly clearance', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;
    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    let isCleared: unknown;
    let restrictions: unknown;
    let reEvalDate: unknown;
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawCleared = formData.get('isCleared');
      if (rawCleared === 'true') isCleared = true;
      else if (rawCleared === 'false') isCleared = false;
      else isCleared = rawCleared;

      const rawRestrictions = formData.get('restrictions');
      restrictions = typeof rawRestrictions === 'string' ? rawRestrictions : undefined;

      const rawReEval = formData.get('reEvalDate');
      reEvalDate = typeof rawReEval === 'string' && rawReEval.trim() ? rawReEval : null;

      const rawFile = formData.get('file');
      file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid request body', 400);
      }
      isCleared = body.isCleared;
      restrictions = body.restrictions;
      reEvalDate = body.reEvalDate;
    }

    const result = await upsertCaseFitToFly({
      caseId,
      isCleared,
      restrictions,
      reEvalDate,
      file,
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
    console.error('[Case Fit-to-Fly PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update Fit-to-Fly clearance', 500);
  }
}
