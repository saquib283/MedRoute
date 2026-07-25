/**
 * MediRoute India — GET /api/v1/admin/export/cases
 * CSV export of cases.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { generateCSV, csvResponse } from '@/lib/api/csv-helper';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const cases = await prisma.case.findMany({
      where,
      include: {
        patient: { include: { user: { select: { fullName: true, email: true } } } },
        manager: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = ['Case ID', 'Patient Name', 'Patient Email', 'Assigned Manager', 'Status', 'Urgent', 'Created At'];
    const rows = cases.map((c) => [
      c.id,
      c.patient.user.fullName,
      c.patient.user.email,
      c.manager?.fullName || 'Unassigned',
      c.status,
      c.isUrgent,
      c.createdAt.toISOString(),
    ]);

    const csv = generateCSV(headers, rows);

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.EXPORT,
      entityType: 'Case',
      entityId: 'all',
      newValue: { statusFilter: status, count: cases.length },
      ipAddress: getClientIP(request),
    });

    return csvResponse(csv, `cases-export-${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) {
    console.error('[Cases Export Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to export cases', 500);
  }
}
