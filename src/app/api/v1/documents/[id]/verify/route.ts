/**
 * Afzal Healthcare — Document Verification API
 * PATCH /api/v1/documents/[id]/verify — Verify or reject a patient-uploaded document (ADMIN or assigned MANAGER)
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import { verifyPatientDocument } from '@/lib/services/clinical-certificate.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: documentId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await verifyPatientDocument({
      documentId,
      verificationStatus: body.verificationStatus,
      verificationNotes: body.verificationNotes,
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
    console.error('[Document Verify PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to verify document', 500);
  }
}
