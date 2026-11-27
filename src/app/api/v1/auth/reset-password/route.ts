/**
 * Afzal Healthcare — POST /api/v1/auth/reset-password
 * Verifies OTP, updates password hash, revokes refresh tokens, and records an audit log entry.
 */

import { NextRequest } from 'next/server';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, badRequest } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { getClientIP } from '@/lib/api/auth-helper';
import { completePasswordReset } from '@/lib/services/password-reset.service';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        result.error.issues[0]?.message ?? 'Invalid reset request',
        400
      );
    }

    const outcome = await completePasswordReset({
      ...result.data,
      ipAddress: getClientIP(request),
    });

    if (!outcome.ok) {
      return apiError(outcome.code, outcome.message, outcome.status);
    }

    return apiSuccess({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('[Reset Password Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to reset password', 500);
  }
}
