/**
 * Afzal Healthcare — Unified Multi-Role Medical Bill Invoice Download Endpoint
 * GET /api/v1/documents/bill/[id]/download
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { streamBillInvoiceById } from '@/lib/services/document-storage.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Bill ID is required', 400);
    }

    return await streamBillInvoiceById(id, authUser!, getClientIP(request));
  } catch (err) {
    console.error('[Bill Invoice Download GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to download medical bill', 500);
  }
}
