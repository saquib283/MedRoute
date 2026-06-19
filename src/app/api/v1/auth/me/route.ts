/**
 * MediRoute India — GET /api/v1/auth/me
 * Returns the authenticated user's profile information.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: authUser!.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        totpEnabled: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            nationality: true,
            dob: true,
            bloodGroup: true,
            medicalCondition: true,
            urgencyLevel: true,
            primaryLanguage: true,
            assignedManagerId: true,
            medicalProfile: true,
          },
        },
      },
    });

    if (!user) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
    }

    return apiSuccess({ user });
  } catch (error) {
    console.error('[Get Me Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch profile', 500);
  }
}
