import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Finance or Admin access required', 403);
    }

    const remittances = await prisma.femaRemittance.findMany({
      orderBy: { realizedAt: 'desc' },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
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

    const totalRealizedInr = remittances.reduce((sum, r) => sum + Number(r.inrRealizedAmount), 0);
    const fircCount = remittances.filter((r) => !!r.fircNumber).length;

    return apiSuccess({
      remittances,
      summary: {
        totalRemittances: remittances.length,
        totalRealizedInr,
        fircIssuedCount: fircCount,
        fircPendingCount: remittances.length - fircCount,
      },
    });
  } catch (err) {
    console.error('Failed to list FEMA remittances:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch FEMA remittance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin or Finance access required', 403);
    }

    const body = await request.json();
    const {
      invoiceId,
      fircNumber,
      swiftReference,
      remittingBank,
      remittingCountry,
      foreignCurrency,
      foreignAmount,
      inrRealizedAmount,
      exchangeRateApplied,
      fircCertificateUrl,
      realizedAt,
    } = body;

    if (
      !invoiceId ||
      !swiftReference ||
      !remittingBank ||
      !remittingCountry ||
      !foreignCurrency ||
      !foreignAmount ||
      !inrRealizedAmount
    ) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing mandatory FEMA remittance fields', 400);
    }

    const remittance = await prisma.femaRemittance.create({
      data: {
        invoiceId,
        fircNumber: fircNumber || null,
        swiftReference,
        remittingBank,
        remittingCountry,
        foreignCurrency,
        foreignAmount: parseFloat(foreignAmount),
        inrRealizedAmount: parseFloat(inrRealizedAmount),
        exchangeRateApplied: exchangeRateApplied ? parseFloat(exchangeRateApplied) : 1,
        isLutExportCovered: true,
        fircCertificateUrl: fircCertificateUrl || null,
        realizedAt: realizedAt ? new Date(realizedAt) : new Date(),
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'FEMA_REMITTANCE_RECORDED',
      entityType: 'FemaRemittance',
      entityId: remittance.id,
      newValue: {
        swiftReference,
        fircNumber,
        foreignAmount,
        foreignCurrency,
        inrRealizedAmount,
      },
      route: '/api/v1/compliance/fema',
    });

    return apiSuccess({ remittance }, undefined, 201);
  } catch (err) {
    console.error('Failed to record FEMA remittance:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save FEMA remittance record', 500);
  }
}
