/**
 * MediRoute India — /api/v1/admin/cases
 * Platform-wide case listing with enhanced filters, status transitions, and manager reassignment.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const VALID_STATUSES = ['INQUIRY_RECEIVED', 'UNDER_REVIEW', 'PLAN_CONFIRMED', 'IN_TREATMENT', 'POST_TREATMENT', 'CLOSED'] as const;

const updateCaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(VALID_STATUSES).optional(),
  managerId: z.string().nullable().optional(),
  notes: z.string().optional(),
  escalationNote: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const urgent = searchParams.get('urgent') || '';
    const search = searchParams.get('search') || '';
    const managerId = searchParams.get('managerId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (urgent === 'true') where.isUrgent = true;
    if (managerId) where.managerId = managerId;
    if (search) {
      where.patient = { user: { OR: [{ fullName: { contains: search } }, { email: { contains: search } }] } };
    }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          patient: { include: { user: { select: { fullName: true, email: true } } } },
          manager: { select: { id: true, fullName: true } },
          _count: { select: { appointments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.case.count({ where }),
    ]);

    return apiSuccess({ cases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Cases GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch cases', 500);
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
    const result = updateCaseSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, ...updateData } = result.data;

    const existing = await prisma.case.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.CASE_NOT_FOUND, 'Case not found', 404);
    }

    if (existing.status === 'CLOSED' && updateData.status && updateData.status !== 'CLOSED') {
      return apiError(ERROR_CODES.CASE_ALREADY_CLOSED, 'Cannot reopen a closed case', 400);
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: updateData,
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
        manager: { select: { fullName: true } },
      },
    });

    const action = updateData.status
      ? AUDIT_ACTIONS.STATUS_CHANGE
      : updateData.managerId !== undefined
        ? AUDIT_ACTIONS.REASSIGN
        : AUDIT_ACTIONS.UPDATE;

    await createAuditLog({
      actorId: authUser!.userId,
      action,
      entityType: 'Case',
      entityId: id,
      oldValue: { status: existing.status, managerId: existing.managerId },
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ case: updatedCase });
  } catch (err) {
    console.error('[Admin Cases PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update case', 500);
  }
}
