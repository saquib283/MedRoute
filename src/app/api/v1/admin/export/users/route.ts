/**
 * MediRoute India — GET /api/v1/admin/export/users
 * CSV export of users. Admin only.
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
    const role = searchParams.get('role') || '';

    const where: Record<string, unknown> = {};
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = ['ID', 'Email', 'Full Name', 'Role', 'Phone', 'Is Active', 'Created At'];
    const rows = users.map((u) => [
      u.id,
      u.email,
      u.fullName,
      u.role,
      u.phone || '',
      u.isActive,
      u.createdAt.toISOString(),
    ]);

    const csv = generateCSV(headers, rows);

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.EXPORT,
      entityType: 'User',
      entityId: 'all',
      newValue: { roleFilter: role, count: users.length },
      ipAddress: getClientIP(request),
    });

    return csvResponse(csv, `users-export-${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) {
    console.error('[Users Export Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to export users', 500);
  }
}
