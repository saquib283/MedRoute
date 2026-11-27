/**
 * Afzal Healthcare — POST /api/v1/public/inquiries
 * Public unauthenticated international patient inquiry intake with rate limiting & honeypot filtering.
 */

import { NextRequest } from 'next/server';
import { getClientIP } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import { capturePublicInquiry } from '@/lib/services/leads-crm.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await capturePublicInquiry(body, {
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data, undefined, result.isHoneypotDrop ? 200 : 201);
  } catch (err) {
    console.error('[Public Inquiry POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to submit inquiry', 500);
  }
}
