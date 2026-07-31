/**
 * Afzal Healthcare — Patient Cases API Endpoint
 * GET /api/v1/patient/cases — Query case status and coordinator contact
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

    // Find the patient record
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    // Retrieve active and historical cases for the patient
    const cases = await prisma.case.findMany({
      where: { patientId: patient.id },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        clinicalSteps: {
          orderBy: { createdAt: 'asc' },
        },
        fitToFlyClearance: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ cases });
  } catch (err) {
    console.error('[Patient Cases GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch patient cases', 500);
  }
}
