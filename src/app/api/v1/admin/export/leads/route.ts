/**
 * Afzal Healthcare — GET /api/v1/admin/export/leads
 * ADMIN-only OWASP formula-injection-safe CSV export of Leads with audit logging.
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { csvResponse } from '@/lib/api/csv-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError } from '@/lib/api/response';
import { exportLeadsCsvForAdmin } from '@/lib/services/leads-crm.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const result = await exportLeadsCsvForAdmin(
      {
        status: searchParams.get('status') || undefined,
        source: searchParams.get('source') || undefined,
        temperature: searchParams.get('temperature') || undefined,
        referralPartnerId: searchParams.get('referralPartnerId') || undefined,
      },
      {
        userId: authUser!.userId,
        role: authUser!.role,
        email: authUser!.email,
        ipAddress: getClientIP(request),
      }
    );

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return csvResponse(result.data.csv, `leads-export-${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) {
    console.error('[Leads Export Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to export leads', 500);
  }
}
