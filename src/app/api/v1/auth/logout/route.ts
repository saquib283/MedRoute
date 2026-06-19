/**
 * MediRoute India — POST /api/v1/auth/logout
 * Revokes the refresh token to end the session.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRefreshToken } from '@/lib/auth/jwt';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { clearAuthCookies } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Refresh token is required', 400);
    }

    try {
      const payload = await verifyRefreshToken(refreshToken);

      // Revoke the refresh token
      await prisma.refreshToken.update({
        where: { id: payload.tokenId },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Even if the token is invalid, consider logout successful
    }

    await clearAuthCookies();

    return apiSuccess({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Logout failed', 500);
  }
}
