/**
 * Afzal Healthcare — POST /api/v1/auth/logout
 * Revokes the refresh token to end the session.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRefreshToken } from '@/lib/auth/jwt';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { clearAuthCookies, extractRefreshTokenFromRequest } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = await extractRefreshTokenFromRequest(request);

    if (refreshToken) {
      try {
        const payload = await verifyRefreshToken(refreshToken);

        // Revoke the refresh token if not already revoked
        await prisma.refreshToken.updateMany({
          where: { id: payload.tokenId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Even if the token is invalid, consider logout successful
      }
    }

    await clearAuthCookies();

    return apiSuccess({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Logout failed', 500);
  }
}
