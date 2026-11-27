/**
 * Afzal Healthcare — Patient Document Download Endpoint (Legacy Wrapper)
 * GET /api/v1/patient/documents/download?id=...
 * Delegates to the unified streaming document service.
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { streamDocumentById } from '@/lib/services/document-storage.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Document ID is required', 400);
    }

    return await streamDocumentById(id, authUser!, getClientIP(request));
  } catch (err) {
    console.error('[Document Download GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to download document', 500);
  }
}
