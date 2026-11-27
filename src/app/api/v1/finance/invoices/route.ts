import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { generateVerificationCode } from '@/lib/legal/crypto-proof';
import { calculateSplitBreakdown, createPartnerSettlements } from '@/lib/finance/commission-engine';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;

    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      where.case = { patientId: patient.id };
    } else if (authUser!.role === 'HOSPITAL' && authUser!.hospitalId) {
      where.hospitalId = authUser!.hospitalId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          include: {
            patient: { select: { nationality: true, user: { select: { fullName: true, email: true } } } },
          },
        },
        hospital: { select: { id: true, name: true, city: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: true,
        settlements: true,
      },
    });

    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
    const totalCommission = invoices.reduce((sum, inv) => sum + Number(inv.commissionAmount || 0), 0);

    return apiSuccess({
      invoices,
      summary: {
        totalInvoices: invoices.length,
        totalBilled,
        totalPaid,
        totalOutstanding,
        totalCommission,
      },
    });
  } catch (err) {
    console.error('Failed to list master invoices:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch invoices', 500);
  }
}

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
      invoiceType = 'TREATMENT',
      currency = 'USD',
      lineItems = [],
      notes,
      dueDate,
      milestoneName,
    } = body;

    if (!caseId || lineItems.length === 0) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'caseId and at least one line item are required', 400);
    }

    const subtotal = lineItems.reduce(
      (sum: number, item: { unitPrice: number; quantity: number }) => sum + Number(item.unitPrice) * (item.quantity || 1),
      0
    );

    // Run dynamic commission engine calculation
    const breakdown = await calculateSplitBreakdown(lineItems, hospitalId, hostelId, currency);

    const invoiceNumber = generateVerificationCode('MR-INV');
    const now = new Date();

    const invoice = await prisma.invoice.create({
      data: {
        caseId,
        hospitalId: hospitalId || null,
        invoiceNumber,
        invoiceType,
        status: 'SENT',
        subtotal,
        totalAmount: subtotal,
        paidAmount: 0,
        balanceDue: subtotal,
        currency,
        milestoneName: milestoneName || null,
        commissionRate: breakdown.hospitalShare.commissionRate,
        commissionAmount: breakdown.hospitalShare.commissionAmount,
        hotelCommissionRate: breakdown.hotelShare.commissionRate,
        hotelCommissionAmount: breakdown.hotelShare.commissionAmount,
        facilitationFeeAmount: breakdown.facilitationFee,
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        issuedAt: now,
        createdBy: authUser!.userId,
        lineItems: {
          create: lineItems.map((item: { description: string; quantity: number; unitPrice: number; category: string }, idx: number) => ({
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            totalPrice: Number(item.unitPrice) * (item.quantity || 1),
            category: item.category || 'PROCEDURE',
            sortOrder: idx,
          })),
        },
      },
      include: {
        lineItems: true,
        hospital: { select: { name: true } },
      },
    });

    // Create partner settlement vouchers
    const settlements = await createPartnerSettlements(invoice.id, breakdown);

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'MASTER_INVOICE_GENERATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      newValue: {
        invoiceNumber,
        totalAmount: subtotal,
        currency,
        hospitalCommission: breakdown.hospitalShare.commissionAmount,
        hotelCommission: breakdown.hotelShare.commissionAmount,
      },
      route: '/api/v1/finance/invoices',
    });

    return apiSuccess({ invoice, breakdown, settlements }, undefined, 201);
  } catch (err) {
    console.error('Failed to create master invoice:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create invoice', 500);
  }
}
