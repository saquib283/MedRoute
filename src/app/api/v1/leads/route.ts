/**
 * Afzal Healthcare — /api/v1/leads
 * GET: List leads & KPIs scoped by role (ADMIN sees all; MANAGER sees own + unclaimed intake pool).
 * POST: Create a single staff lead OR perform bulk CSV row import ({ mode: 'BULK_IMPORT', rows }).
 */

import { NextRequest } from 'next/server';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { ERROR_CODES } from '@/lib/api/errors';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
  createStaffLead,
  importLeadsFromCsvRows,
  listLeadsForActor,
} from '@/lib/services/leads-crm.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pageRaw = searchParams.get('page');
    const limitRaw = searchParams.get('limit');

    const result = await listLeadsForActor(
      {
        status: searchParams.get('status') || undefined,
        source: searchParams.get('source') || undefined,
        temperature: searchParams.get('temperature') || undefined,
        specialtyInterest: searchParams.get('specialtyInterest') || undefined,
        assignedManagerId: searchParams.get('assignedManagerId') || undefined,
        referralPartnerId: searchParams.get('referralPartnerId') || undefined,
        slaState: searchParams.get('slaState') || undefined,
        followUpsDue: searchParams.get('followUpsDue') === 'true',
        search: searchParams.get('search') || undefined,
        page: pageRaw ? Number(pageRaw) : undefined,
        limit: limitRaw ? Number(limitRaw) : undefined,
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

    return apiSuccess(
      {
        leads: result.data.leads,
        kpis: result.data.kpis,
      },
      result.data.meta
    );
  } catch (err) {
    console.error('[Leads GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load leads', 500);
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

    const actor = {
      userId: authUser!.userId,
      role: authUser!.role,
      email: authUser!.email,
      ipAddress: getClientIP(request),
    };

    if ((body as Record<string, unknown>).mode === 'BULK_IMPORT') {
      const rows = (body as Record<string, unknown>).rows;
      const bulkResult = await importLeadsFromCsvRows(Array.isArray(rows) ? rows : [], actor);
      if (!bulkResult.ok) {
        return apiError(
          bulkResult.code,
          bulkResult.message,
          bulkResult.status,
          bulkResult.details
        );
      }
      return apiSuccess(bulkResult.data, undefined, 200);
    }

    const result = await createStaffLead(body, actor);
    if (!result.ok) {
      return apiError(result.code, result.message, result.status, result.details);
    }

    return apiSuccess(result.data, undefined, 201);
  } catch (err) {
    console.error('[Leads POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create lead', 500);
  }
}
