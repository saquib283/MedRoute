/**
 * Afzal Healthcare — /api/v1/admin/cases
 * Platform-wide case listing with enhanced filters, status transitions, and manager reassignment.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { CASE_STATUS_ORDER } from '@/lib/constants';
import { createCaseForPatient } from '@/lib/services/onboarding.service';
import { assignPatientCoordinator } from '@/lib/services/case-assignment.service';
import {
  formatPatientForViewer,
  formatTravelLogisticsForViewer,
} from '@/lib/services/phi.service';
import { validateCaseStatusTransition } from '@/lib/validation/lifecycle-schemas';
import { z } from 'zod';

const VALID_STATUSES = CASE_STATUS_ORDER;

const createCaseAdminSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().max(5000).optional(),
  isUrgent: z.boolean().optional(),
  managerId: z.string().nullable().optional(),
});

const updateCaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(VALID_STATUSES).optional(),
  managerId: z.string().nullable().optional(),
  notes: z.string().optional(),
  isUrgent: z.boolean().optional(),
  escalationNote: z.string().nullable().optional(),
  overrideReason: z.string().max(1000).nullable().optional(),
});

function maskCaseForViewer<T extends Record<string, unknown>>(c: T | null): T | null {
  if (!c) return null;
  return {
    ...c,
    ...(c.patient && typeof c.patient === 'object'
      ? { patient: formatPatientForViewer(c.patient as Record<string, unknown>, { maskPassport: true }) }
      : {}),
    ...('travelLogistics' in c
      ? { travelLogistics: formatTravelLogisticsForViewer(c.travelLogistics, { maskPassport: true }) }
      : {}),
  };
}

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

    const maskedCases = cases.map((c) => maskCaseForViewer(c as unknown as Record<string, unknown>));
    return apiSuccess({ cases: maskedCases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Cases GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch cases', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = createCaseAdminSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const caseRes = await createCaseForPatient({
      ...result.data,
      actorId: authUser!.userId,
      ipAddress: getClientIP(request),
    });

    if (!caseRes.ok) {
      return apiError(caseRes.code, caseRes.message, caseRes.status);
    }

    return apiSuccess(
      { case: maskCaseForViewer(caseRes.case as unknown as Record<string, unknown>) },
      undefined,
      201
    );
  } catch (err) {
    console.error('[Admin Cases POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create case', 500);
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

    const { id, managerId, overrideReason, ...restUpdateData } = result.data;

    const existing = await prisma.case.findUnique({
      where: { id },
      include: { fitToFlyClearance: { select: { isCleared: true } } },
    });
    if (!existing) {
      return apiError(ERROR_CODES.CASE_NOT_FOUND, 'Case not found', 404);
    }

    const normalizedEscalation =
      restUpdateData.escalationNote !== undefined
        ? restUpdateData.escalationNote?.trim()
          ? restUpdateData.escalationNote.trim()
          : null
        : undefined;

    const normalizedOverrideReason =
      overrideReason?.trim() ||
      (normalizedEscalation !== undefined ? normalizedEscalation : null) ||
      null;

    if (restUpdateData.status !== undefined && restUpdateData.status !== existing.status) {
      const [verifiedPassportCount, unpaidBillCount, ftfFallback] = await Promise.all([
        prisma.document?.count
          ? prisma.document.count({
              where: {
                patientId: existing.patientId,
                category: 'PASSPORT',
                verificationStatus: 'VERIFIED',
              },
            })
          : Promise.resolve(0),
        prisma.medicalBill?.count
          ? prisma.medicalBill.count({
              where: {
                caseId: id,
                status: { notIn: ['PAID', 'CANCELLED'] },
              },
            })
          : Promise.resolve(0),
        existing.fitToFlyClearance === undefined && prisma.fitToFlyClearance?.findUnique
          ? prisma.fitToFlyClearance.findUnique({
              where: { caseId: id },
              select: { isCleared: true },
            })
          : Promise.resolve(null),
      ]);

      const hasClearedFitToFly = Boolean(
        existing.fitToFlyClearance?.isCleared === true || ftfFallback?.isCleared === true
      );

      const transitionCheck = validateCaseStatusTransition({
        currentStatus: existing.status,
        nextStatus: restUpdateData.status,
        hasVerifiedPassport: verifiedPassportCount > 0,
        hasClearedFitToFly,
        unpaidBillCount,
        overrideReason: normalizedOverrideReason,
      });

      if (!transitionCheck.ok) {
        return apiError(
          existing.status === 'CLOSED'
            ? ERROR_CODES.CASE_ALREADY_CLOSED
            : ERROR_CODES.INVALID_STATUS_TRANSITION,
          transitionCheck.message,
          400
        );
      }
    }

    if (managerId !== undefined) {
      const assignRes = await assignPatientCoordinator({
        caseIds: [id],
        managerId,
        actorId: authUser!.userId,
        ipAddress: getClientIP(request),
      });
      if (!assignRes.ok) {
        return apiError(assignRes.code, assignRes.message, assignRes.status);
      }
    }

    const hasOtherUpdates =
      restUpdateData.status !== undefined ||
      restUpdateData.notes !== undefined ||
      restUpdateData.isUrgent !== undefined ||
      normalizedEscalation !== undefined;

    if (hasOtherUpdates) {
      const caseUpdateData = {
        ...(restUpdateData.status !== undefined && { status: restUpdateData.status }),
        ...(restUpdateData.notes !== undefined && { notes: restUpdateData.notes }),
        ...(restUpdateData.isUrgent !== undefined && { isUrgent: restUpdateData.isUrgent }),
        ...(normalizedEscalation !== undefined && { escalationNote: normalizedEscalation }),
      };

      await prisma.case.update({
        where: { id },
        data: caseUpdateData,
      });

      const action =
        restUpdateData.status && restUpdateData.status !== existing.status
          ? AUDIT_ACTIONS.STATUS_CHANGE
          : AUDIT_ACTIONS.UPDATE;

      await createAuditLog({
        actorId: authUser!.userId,
        action,
        entityType: 'Case',
        entityId: id,
        oldValue: { status: existing.status, managerId: existing.managerId },
        newValue: {
          ...caseUpdateData,
          ...(overrideReason?.trim() ? { overrideReason: overrideReason.trim() } : {}),
        },
        ipAddress: getClientIP(request),
      });
    }

    const updatedCase = await prisma.case.findUnique({
      where: { id },
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
        manager: { select: { fullName: true } },
      },
    });

    return apiSuccess({
      case: maskCaseForViewer(updatedCase as unknown as Record<string, unknown>),
    });
  } catch (err) {
    console.error('[Admin Cases PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update case', 500);
  }
}
