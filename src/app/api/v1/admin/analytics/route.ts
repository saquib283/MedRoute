/**
 * Afzal Healthcare — /api/v1/admin/analytics
 * Advanced analytics endpoint for Admin dashboard.
 * Provides deep platform insights: nationality distribution, trends,
 * hospital utilization, doctor volume, case lifecycle, and financial/commission metrics.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { computePlatformAnalytics } from '@/lib/services/analytics.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const analytics = await computePlatformAnalytics();
    return apiSuccess(analytics);
  } catch (err) {
    console.error('[Admin Analytics Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load analytics', 500);
  }
}
