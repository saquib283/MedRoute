/**
 * MediRoute India — POST /api/v1/auth/2fa/setup
 * Generates a TOTP secret and QR URI for Manager/Admin 2FA setup.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { generateTOTPSecret } from '@/lib/auth/totp';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempSessionId } = body;

    if (!tempSessionId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Temp session ID is required', 400);
    }

    // Find the temporary 2FA setup session
    const tempSession = await prisma.refreshToken.findFirst({
      where: {
        token: `2fa_setup_${tempSessionId}`,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tempSession) {
      return apiError(ERROR_CODES.TOKEN_EXPIRED, 'Setup session expired. Please login again.', 401);
    }

    // Check if 2FA is already enabled
    if (tempSession.user.totpEnabled) {
      return apiError(ERROR_CODES.TOTP_ALREADY_ENABLED, '2FA is already enabled', 400);
    }

    // Generate TOTP secret
    const { secret, uri } = generateTOTPSecret(tempSession.user.email);

    // Store the secret (but don't enable yet — user must verify first)
    await prisma.user.update({
      where: { id: tempSession.userId },
      data: { totpSecret: secret }, // TODO: Encrypt with AES-256 in production
    });

    return apiSuccess({
      totpUri: uri, // For QR code generation on the frontend
      secret,       // Manual entry fallback
    });
  } catch (error) {
    console.error('[2FA Setup Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, '2FA setup failed', 500);
  }
}
