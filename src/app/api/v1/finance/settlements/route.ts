import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { SettlementStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER' && authUser!.role !== 'HOSPITAL') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized', 403);
    }

    const { searchParams } = new URL(request.url);
    const partnerType = searchParams.get('partnerType');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (partnerType) where.partnerType = partnerType;
    if (status) where.status = status as SettlementStatus;

    if (authUser!.role === 'HOSPITAL' && authUser!.hospitalId) {
      where.partnerId = authUser!.hospitalId;
    }

    const settlements = await prisma.partnerSettlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
            case: {
              select: {
                id: true,
                patient: { select: { nationality: true, user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    });

    const totalGross = settlements.reduce((sum, s) => sum + Number(s.grossAmount), 0);
    const totalCommission = settlements.reduce((sum, s) => sum + Number(s.commissionAmount), 0);
    const totalNetPayable = settlements.reduce((sum, s) => sum + Number(s.netPayable), 0);

    return apiSuccess({
      settlements,
      summary: {
        totalSettlements: settlements.length,
        totalGross,
        totalCommission,
        totalNetPayable,
        pendingCount: settlements.filter((s) => s.status === 'PENDING').length,
        processedCount: settlements.filter((s) => s.status === 'PROCESSED').length,
      },
    });
  } catch (err) {
    console.error('Failed to list partner settlements:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch settlement records', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin or Finance access required', 403);
    }

    const body = await request.json();
    const { id, status, paymentReference, notes } = body;

    if (!id || !status) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Settlement id and status are required', 400);
    }

    const existing = await prisma.partnerSettlement.findUnique({ where: { id } });
    if (!existing) return apiError(ERROR_CODES.NOT_FOUND, 'Settlement record not found', 404);

    const updateData: Record<string, unknown> = {
      status,
    };
    if (paymentReference) updateData.paymentReference = paymentReference;
    if (notes !== undefined) updateData.notes = notes;
    if (status === 'PROCESSED') {
      updateData.paidAt = new Date();
      updateData.processedBy = authUser!.email;
    }

    const updated = await prisma.partnerSettlement.update({
      where: { id },
      data: updateData,
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'PARTNER_SETTLEMENT_PROCESSED',
      entityType: 'PartnerSettlement',
      entityId: updated.id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, paymentReference: updated.paymentReference },
      route: '/api/v1/finance/settlements',
    });

    return apiSuccess({ settlement: updated });
  } catch (err) {
    console.error('Failed to update partner settlement:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update settlement record', 500);
  }
}
