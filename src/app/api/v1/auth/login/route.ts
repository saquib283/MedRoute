/**
 * MediRoute India — POST /api/v1/auth/login
 * Email + password login with 2FA enforcement for Manager/Admin (FR-AUTH-01).
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { loginSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, validationError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { setAuthCookies } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return validationError(result.error.flatten().fieldErrors);
    }

    const { email, password } = result.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return apiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password',
        401
      );
    }

    // Check if account is active
    if (!user.isActive) {
      return apiError(
        ERROR_CODES.ACCOUNT_DISABLED,
        'Account is disabled. Contact support.',
        403
      );
    }

    // Disable Doctor login
    if (user.role === 'DOCTOR') {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        'Doctor portal login has been disabled.',
        403
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return apiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password',
        401
      );
    }

    // Check System Maintenance Mode
    const { checkMaintenanceActive } = await import('@/lib/api/settings-helper');
    const isMaintenance = await checkMaintenanceActive(user.role);
    if (isMaintenance) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        'System is currently undergoing scheduled maintenance. Please try again later.',
        403
      );
    }

    // Check if 2FA is required (Manager/Admin roles) per HIPAA § 164.312(d)
    // Disabled in development for ease of testing
    const requires2FA =
      process.env.NODE_ENV === 'production' &&
      (user.role === 'ADMIN' ||
       user.role === 'MANAGER');


    if (requires2FA && user.totpEnabled) {
      // Don't issue tokens yet — require TOTP verification
      // Return a temporary session ID for the 2FA flow
      const tempSession = crypto.randomUUID();

      // Store temp session in a short-lived record (we'll use the token field)
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: `2fa_${tempSession}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });

      return apiSuccess({
        requires2FA: true,
        tempSessionId: tempSession,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    }

    // If 2FA is required but not set up yet, force setup
    if (requires2FA && !user.totpEnabled) {
      const tempSession = crypto.randomUUID();

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: `2fa_setup_${tempSession}`,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      return apiSuccess({
        requires2FASetup: true,
        tempSessionId: tempSession,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    }

    // No 2FA required (Patient role) — issue tokens directly
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

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Login Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Login failed', 500);
  }
}
