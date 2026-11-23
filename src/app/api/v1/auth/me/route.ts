/**
 * Afzal Healthcare — GET /api/v1/auth/me
 * Returns the authenticated user's profile information.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { decryptMedicalProfile } from '@/lib/api/phi-encryption';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    // Check System Maintenance Mode
    const { checkMaintenanceActive, readSettings } = await import('@/lib/api/settings-helper');
    const isMaintenance = await checkMaintenanceActive(authUser!.role);
    if (isMaintenance) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        'System is currently undergoing scheduled maintenance. Please try again later.',
        403
      );
    }

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
        doctorProfile: {
          select: {
            id: true,
            hospitalId: true,
            specialisationId: true,
          }
        }
      },
    });

    if (!user) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
    }

    // Load global settings for alert banner text
    const settings = await readSettings();
    const alertBannerText = settings?.alertBannerText || '';

    const formattedUser = user.patient?.medicalProfile
      ? {
          ...user,
          patient: {
            ...user.patient,
            medicalProfile: decryptMedicalProfile(
              user.patient.medicalProfile as Record<string, unknown>
            ),
          },
        }
      : user;

    return apiSuccess({ user: formattedUser, alertBannerText });
  } catch (error) {
    console.error('[Get Me Error]', error);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch profile', 500);
  }
}
