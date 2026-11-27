/**
 * Afzal Healthcare — Patient Medical Bill Payment API Endpoint
 * POST /api/v1/patient/billing/pay — Settle full or partial balance on own invoice
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { payPatientMedicalBill } from '@/lib/services/billing.service';

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await payPatientMedicalBill({
      billId: body.billId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      referenceNo: body.referenceNo,
      actor: {
        userId: authUser!.userId,
        role: authUser!.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Patient Billing Pay POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process bill payment', 500);
  }
}
