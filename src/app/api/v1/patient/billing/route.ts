/**
 * Afzal Healthcare — Patient Billing API Endpoint
 * GET /api/v1/patient/billing — Retrieve patient bills, itemized cost breakdowns, and receipts
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

    // Locate patient
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    const bills = await prisma.medicalBill.findMany({
      where: { patientId: patient.id },
      include: {
        hospital: {
          select: { id: true, name: true, city: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ bills });
  } catch (err) {
    console.error('[Patient Billing GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch billing receipts', 500);
  }
}
