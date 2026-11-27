/**
 * Afzal Healthcare — POST /api/v1/auth/forgot-password
 * Issues a DB-backed 6-digit password reset OTP with rate limiting.
 */

import { NextRequest } from 'next/server';
import { otpRequestSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, badRequest, validationError, tooManyRequests } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { requestPasswordResetOtp } from '@/lib/services/password-reset.service';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const result = otpRequestSchema.safeParse(body);
    if (!result.success) {
      return validationError(result.error.flatten().fieldErrors);
    }

    const { rateLimited } = await requestPasswordResetOtp(result.data.email);
    if (rateLimited) {
      return tooManyRequests('Too many reset requests. Please try again in 15 minutes.');
    }

    return apiSuccess({
      message: 'If an account exists with that email, a verification code has been sent.',
    });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process password reset request', 500);
  }
}
