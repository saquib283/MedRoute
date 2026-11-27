import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { generate3StageMilestoneInvoices } from '@/lib/finance/milestone-generator';

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin or Coordinator access required', 403);
    }

    const body = await request.json();
    const {
      caseId,
      hospitalId,
      hostelId,
      totalPackageCost,
      currency = 'USD',
      procedureTitle = 'Comprehensive Surgical Package',
    } = body;

    if (!caseId || !totalPackageCost) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'caseId and totalPackageCost are required', 400);
    }

    const patientCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, patientId: true },
    });

    if (!patientCase) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Case not found', 404);
    }

    const invoices = await generate3StageMilestoneInvoices({
      caseId,
      hospitalId: hospitalId || null,
      hostelId: hostelId || null,
      totalPackageCost: parseFloat(totalPackageCost),
      currency,
      procedureTitle,
      createdById: authUser!.userId,
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'MILESTONE_INVOICES_GENERATED',
      entityType: 'Case',
      entityId: caseId,
      newValue: {
        totalPackageCost,
        currency,
        invoicesCount: invoices.length,
        procedureTitle,
      },
      route: '/api/v1/finance/invoices/milestones',
    });

    return apiSuccess({ invoices }, undefined, 201);
  } catch (err) {
    console.error('Failed to generate milestone invoices:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to generate milestone invoices', 500);
  }
}
