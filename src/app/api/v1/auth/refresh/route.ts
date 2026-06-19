/**
 * MediRoute India — POST /api/v1/auth/refresh
 * JWT refresh token rotation per PRD FR-AUTH-01.
 * Old refresh token is revoked, new pair (access + refresh) is issued.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { setAuthCookies } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken: incomingToken } = body;

    if (!incomingToken) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Refresh token is required', 400);
    }

    // Verify the JWT refresh token
    let payload;
    try {
      payload = await verifyRefreshToken(incomingToken);
    } catch {
      return apiError(ERROR_CODES.REFRESH_TOKEN_EXPIRED, 'Refresh token expired', 401);
    }

    // Look up the refresh token record in the database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    });

    if (!storedToken) {
      return apiError(ERROR_CODES.TOKEN_INVALID, 'Invalid refresh token', 401);
    }

    // Check if token has been revoked (reuse detection)
    if (storedToken.revokedAt) {
      // Token reuse detected — revoke ALL tokens for this user (security measure)
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      console.warn(
        `[Security] Refresh token reuse detected for user ${storedToken.userId}`
      );
      return apiError(
        ERROR_CODES.REFRESH_TOKEN_REUSED,
        'Token reuse detected. All sessions revoked.',
        401
      );
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      return apiError(ERROR_CODES.REFRESH_TOKEN_EXPIRED, 'Refresh token expired', 401);
    }

    // Check if user is still active
    if (!storedToken.user.isActive) {
      return apiError(ERROR_CODES.ACCOUNT_DISABLED, 'Account is disabled', 403);
    }

    // Revoke the old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token pair
    const newRefreshRecord = await prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        userId: storedToken.user.id,
        role: storedToken.user.role,
        email: storedToken.user.email,
      }),
      signRefreshToken({
        userId: storedToken.userId,
        tokenId: newRefreshRecord.id,
      }),
    ]);

    await setAuthCookies(accessToken, refreshToken);

    return apiSuccess({ accessToken, refreshToken });
  } catch (error) {
    console.error('[Refresh Token Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Token refresh failed', 500);
  }
}
