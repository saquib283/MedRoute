/**
 * Afzal Healthcare — Neutral Specialty Clinical Pathway Templates API
 * GET /api/v1/pathway-templates — Retrieve specialty pathway preset templates for ADMIN, MANAGER, DOCTOR
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, forbidden } from '@/lib/api/response';
import { PRESET_TEMPLATES } from '@/lib/services/clinical-pathway.service';

export async function GET(request: NextRequest) {
  const { user: authUser, error } = requireAuth(request);
  if (error) return error;

  if (!['ADMIN', 'MANAGER', 'DOCTOR'].includes(authUser.role)) {
    return forbidden();
  }

  return apiSuccess({ templates: PRESET_TEMPLATES });
}
