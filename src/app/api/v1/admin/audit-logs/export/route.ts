/**
 * MediRoute India — GET /api/v1/admin/audit-logs/export
 * CSV export of audit logs. Admin only.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { generateCSV, csvResponse } from '@/lib/api/csv-helper';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') || '';
    const action = searchParams.get('action') || '';

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action };

    const logs = await prisma.auditLog.findMany({
      where,
      include: { actor: { select: { fullName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = ['Date', 'Actor', 'Actor Email', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'IP Address'];
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.actor.fullName,
      log.actor.email,
      log.actor.role,
      log.action,
      log.entityType,
      log.entityId,
      log.ipAddress,
    ]);

    const csv = generateCSV(headers, rows);
    return csvResponse(csv, `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) {
    console.error('[Audit Export Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to export', 500);
  }
}
