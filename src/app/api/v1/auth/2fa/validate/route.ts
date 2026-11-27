/**
 * Afzal Healthcare — POST /api/v1/auth/2fa/validate
 * Validates TOTP code during login flow and issues tokens.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyTOTP, decrypt, DecryptionTamperError } from '@/lib/auth';
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

    // Find the temporary 2FA session (supports both regular 2FA and first-time 2FA setup)
    const tempSession = await prisma.refreshToken.findFirst({
      where: {
        token: { in: [`2fa_${tempSessionId}`, `2fa_setup_${tempSessionId}`] },
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

    let decryptedSecret: string;
    try {
      decryptedSecret = decrypt(tempSession.user.totpSecret);
    } catch (err) {
      if (err instanceof DecryptionTamperError) {
        console.error('[2FA Validate Error] Tampered TOTP secret detected for user', tempSession.userId);
        return apiError(ERROR_CODES.INTERNAL_ERROR, '2FA configuration integrity check failed', 500);
      }
      throw err;
    }

    const isValid = verifyTOTP(result.data.code, decryptedSecret);
    if (!isValid) {
      return apiError(ERROR_CODES.TOTP_INVALID, 'Invalid authentication code', 401);
    }

    // Atomically revoke the temp session, enable 2FA, and issue a 7-day refresh token
    const refreshTokenRecord = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: tempSession.id },
        data: { revokedAt: new Date() },
      });

      await tx.user.update({
        where: { id: tempSession.userId },
        data: { totpEnabled: true },
      });

      return tx.refreshToken.create({
        data: {
          userId: tempSession.userId,
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
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
