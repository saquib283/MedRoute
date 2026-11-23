/**
 * Afzal Healthcare — Case Clinical Documents API
 * GET  /api/v1/cases/[id]/documents — List patient documents for a case (ADMIN, assigned MANAGER, treating DOCTOR)
 * POST /api/v1/cases/[id]/documents — Issue official hospital/clinical document (uploaded file or generated PDF)
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  issueCaseDocument,
  listCaseDocuments,
} from '@/lib/services/clinical-certificate.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;
    const result = await listCaseDocuments(caseId, {
      userId: authUser.userId,
      role: authUser.role,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Case Documents GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to list case documents', 500);
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
    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    let category: unknown;
    let notes: unknown;
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawFile = formData.get('file');
      file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
      const rawCategory = formData.get('category');
      category = typeof rawCategory === 'string' ? rawCategory : undefined;
      const rawNotes = formData.get('notes');
      notes = typeof rawNotes === 'string' ? rawNotes : undefined;
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid request body', 400);
      }
      category = body.category;
      notes = body.notes;
    }

    const result = await issueCaseDocument({
      caseId,
      category,
      file,
      notes,
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
    console.error('[Case Documents POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to issue case document', 500);
  }
}
