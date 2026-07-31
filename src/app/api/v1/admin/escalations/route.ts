/**
 * Afzal Healthcare — /api/v1/admin/escalations
 * Escalated cases queue with resolve capability.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

import { CaseStatus } from '@prisma/client';

const resolveSchema = z.object({
  id: z.string().min(1),
  clearEscalation: z.boolean().optional(),
  managerId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where = {
      escalationNote: { not: null },
      status: { notIn: ['CLOSED'] as CaseStatus[] },
    };

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          patient: { include: { user: { select: { fullName: true, email: true } } } },
          manager: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.case.count({ where }),
    ]);

    return apiSuccess({ escalations: cases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Escalations GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch escalations', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = resolveSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, clearEscalation, managerId } = result.data;

    const existing = await prisma.case.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.CASE_NOT_FOUND, 'Case not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (clearEscalation) updateData.escalationNote = null;
    if (managerId !== undefined) updateData.managerId = managerId;

    const updated = await prisma.case.update({ where: { id }, data: updateData });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.RESOLVE_ESCALATION,
      entityType: 'Case',
      entityId: id,
      oldValue: { escalationNote: existing.escalationNote, managerId: existing.managerId },
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ case: updated });
  } catch (err) {
    console.error('[Admin Escalations PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to resolve escalation', 500);
  }
}
