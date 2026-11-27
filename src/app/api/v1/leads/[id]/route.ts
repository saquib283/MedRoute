/**
 * Afzal Healthcare — /api/v1/leads/[id]
 * GET: Fetch Lead dossier with activities, SLA state, score breakdown, WhatsApp link, and duplicate checks.
 * PATCH: Claim unassigned lead, update fields, advance status with guardrails, or ADMIN reassign.
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getLeadDossierForActor, updateLeadForActor } from '@/lib/services/leads-crm.service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await context.params;
    const result = await getLeadDossierForActor(id, {
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
    console.error('[Lead Dossier GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load lead dossier', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await updateLeadForActor(id, body, {
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
    console.error('[Lead PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update lead', 500);
  }
}
