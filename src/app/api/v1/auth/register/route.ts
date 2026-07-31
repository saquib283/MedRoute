/**
 * Afzal Healthcare — POST /api/v1/auth/register
 * Patient self-registration is disabled. All accounts are created by platform administrators.
 */

import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  return apiError(
    ERROR_CODES.FORBIDDEN,
    'Self-registration is disabled. All accounts are created by platform administrators.',
    403
  );
}
