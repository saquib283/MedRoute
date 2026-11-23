/**
 * Afzal Healthcare — POST /api/v1/auth/register
 * Patient self-registration via transactional onboarding service.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { registerSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, badRequest, validationError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { getClientIP, setAuthCookies } from '@/lib/api/auth-helper';
import { onboardPatient } from '@/lib/services/onboarding.service';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return validationError(result.error.flatten().fieldErrors);
    }

    const onboardRes = await onboardPatient(result.data, {
      ipAddress: getClientIP(request),
    });

    if (!onboardRes.ok) {
      return apiError(onboardRes.code, onboardRes.message, onboardRes.status);
    }

    const { user } = onboardRes;

    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        userId: user.id,
        role: user.role,
        email: user.email,
      }),
      signRefreshToken({
        userId: user.id,
        tokenId: refreshTokenRecord.id,
      }),
    ]);

    await setAuthCookies(accessToken, refreshToken);

    return apiSuccess(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
      undefined,
      201
    );
  } catch (err) {
    console.error('[Register Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Registration failed', 500);
  }
}
