/**
 * Afzal Healthcare — Admin Clinical Pathway Specialty Templates API (Wrapper)
 * GET /api/v1/admin/pathway-templates — Retrieve specialty pathway preset templates for ADMIN
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, forbidden } from '@/lib/api/response';
import { PRESET_TEMPLATES } from '@/lib/services/clinical-pathway.service';

export async function GET(request: NextRequest) {
  const { user: authUser, error } = requireAuth(request);
  if (error) return error;

  if (authUser.role !== 'ADMIN') {
    return forbidden();
  }

  return apiSuccess({ templates: PRESET_TEMPLATES });
}
