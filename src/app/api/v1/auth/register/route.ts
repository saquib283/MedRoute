/**
 * MediRoute India — POST /api/v1/auth/register
 * Patient self-registration (FR-PAT-01).
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { registerSchema } from '@/lib/validation/schemas';
import { apiSuccess, apiError, validationError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { setAuthCookies } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return validationError(result.error.flatten().fieldErrors);
    }

    const {
      email,
      password,
      fullName,
      phone,
      nationality,
      passportNo,
      dob,
      primaryLanguage,
    } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError(
        ERROR_CODES.USER_ALREADY_EXISTS,
        'An account with this email already exists',
        409
      );
    }

    // Hash password (bcrypt, 12 rounds)
    const passwordHash = await hashPassword(password);

    // Create user + patient + medical profile in a transaction
    const createdUser = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'PATIENT',
          fullName,
          phone: phone || null,
        },
      });

      const newPatient = await tx.patient.create({
        data: {
          userId: newUser.id,
          nationality,
          passportNo, // TODO: encrypt with AES-256 before storage in production
          dob: new Date(dob),
          primaryLanguage: primaryLanguage || null,
        },
      });

      // Create empty medical profile for the patient
      await tx.patientMedicalProfile.create({
        data: {
          patientId: newPatient.id,
        },
      });

      return newUser;
    });

    // Generate refresh token record for rotation tracking
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: createdUser.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        userId: createdUser.id,
        role: createdUser.role,
        email: createdUser.email,
      }),
      signRefreshToken({
        userId: createdUser.id,
        tokenId: refreshTokenRecord.id,
      }),
    ]);

    await setAuthCookies(accessToken, refreshToken);

    return apiSuccess(
      {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          fullName: createdUser.fullName,
          role: createdUser.role,
        },
        accessToken,
        refreshToken,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error('[Register Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Registration failed', 500);
  }
}
