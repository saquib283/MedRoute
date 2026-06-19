/**
 * MediRoute India — POST /api/v1/auth/2fa/validate
 * Validates TOTP code during login flow and issues tokens.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyTOTP } from '@/lib/auth/totp';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { totpVerifySchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, validationError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { setAuthCookies } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { tempSessionId, code } = body;

    if (!tempSessionId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Temp session ID is required', 400);
    }

    const result = totpVerifySchema.safeParse({ code });
    if (!result.success) {
      return validationError(result.error.flatten().fieldErrors);
    }

    // Find the temporary 2FA session
    const tempSession = await prisma.refreshToken.findFirst({
      where: {
        token: `2fa_${tempSessionId}`,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tempSession) {
      return apiError(ERROR_CODES.TOKEN_EXPIRED, '2FA session expired. Please login again.', 401);
    }

    // Verify TOTP code
    if (!tempSession.user.totpSecret) {
      return apiError(ERROR_CODES.TOTP_INVALID, '2FA is not configured', 400);
    }

    const isValid = verifyTOTP(result.data.code, tempSession.user.totpSecret);
    if (!isValid) {
      return apiError(ERROR_CODES.TOTP_INVALID, 'Invalid authentication code', 401);
    }

    // Revoke the temp session
    await prisma.refreshToken.update({
      where: { id: tempSession.id },
      data: { revokedAt: new Date() },
    });

    // Issue real tokens
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: tempSession.userId,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        userId: tempSession.user.id,
        role: tempSession.user.role,
        email: tempSession.user.email,
      }),
      signRefreshToken({
        userId: tempSession.userId,
        tokenId: refreshTokenRecord.id,
      }),
    ]);

    await setAuthCookies(accessToken, refreshToken);

    return apiSuccess({
      user: {
        id: tempSession.user.id,
        email: tempSession.user.email,
        fullName: tempSession.user.fullName,
        role: tempSession.user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[2FA Validate Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, '2FA validation failed', 500);
  }
}
