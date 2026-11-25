/**
 * Afzal Healthcare — /api/v1/referral-partners
 * GET: List B2B referral partners (ADMIN sees commissionPercent; MANAGER receives read-only list without commissionPercent).
 * POST/PATCH: ADMIN-only CRUD for B2B referral partners.
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  createReferralPartner,
  listReferralPartners,
  updateReferralPartner,
} from '@/lib/services/leads-crm.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const result = await listReferralPartners(
      {
        userId: authUser!.userId,
        role: authUser!.role,
        email: authUser!.email,
        ipAddress: getClientIP(request),
      },
      { activeOnly }
    );

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Referral Partners GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch referral partners', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await createReferralPartner(body, {
      userId: authUser!.userId,
      role: authUser!.role,
      email: authUser!.email,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data, undefined, 201);
  } catch (err) {
    console.error('[Referral Partners POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create referral partner', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const { id, ...rest } = body as Record<string, unknown>;
    if (typeof id !== 'string' || !id.trim()) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Referral partner id is required', 400);
    }

    const result = await updateReferralPartner(id.trim(), rest, {
      userId: authUser!.userId,
      role: authUser!.role,
      email: authUser!.email,
      ipAddress: getClientIP(request),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Referral Partners PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update referral partner', 500);
  }
}
