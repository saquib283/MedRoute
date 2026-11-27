/**
 * MediRoute India — Patient Billing API Endpoint
 * GET  /api/v1/patient/billing — Retrieve invoices, summary, and itemized medical bills
 * POST /api/v1/patient/billing — Record international wire payment against an invoice
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { generateVerificationCode, computeSha256 } from '@/lib/legal/crypto-proof';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const patient = await prisma.patient.findUnique({
      where: { userId: authUser!.userId },
      include: {
        cases: {
          include: {
            invoices: {
              include: {
                hospital: { select: { name: true, city: true } },
                lineItems: { orderBy: { sortOrder: 'asc' } },
                payments: { orderBy: { paidAt: 'desc' } },
              },
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        medicalBills: {
          include: {
            hospital: { select: { id: true, name: true, city: true } },
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Patient record not found', 404);
    }

    const allInvoices = patient.cases.flatMap((c) => c.invoices);
    const totalBilled = allInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalBalanceDue = allInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    const paidMilestonesCount = allInvoices.filter((inv) => inv.status === 'PAID').length;
    const totalMilestonesCount = allInvoices.length;

    return apiSuccess({
      invoices: allInvoices,
      bills: patient.medicalBills,
      summary: {
        totalBilled,
        totalPaid,
        totalBalanceDue,
        currency: allInvoices[0]?.currency || 'USD',
        paidMilestonesCount,
        totalMilestonesCount,
        progressPercent: totalMilestonesCount > 0 ? Math.round((paidMilestonesCount / totalMilestonesCount) * 100) : 0,
      },
    });
  } catch (err) {
    console.error('Failed to fetch patient billing ledger:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch billing data', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { invoiceId, amount, paymentMethod = 'INTERNATIONAL_WIRE', notes } = body;

    if (!invoiceId || !amount) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'invoiceId and amount are required', 400);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { case: { select: { id: true, patientId: true } } },
    });

    if (!invoice) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Invoice not found', 404);
    }

    const paidAmountNumber = parseFloat(amount);
    const newPaidTotal = Number(invoice.paidAmount) + paidAmountNumber;
    const newBalanceDue = Math.max(0, Number(invoice.totalAmount) - newPaidTotal);
    const newStatus = newBalanceDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const transactionRef = generateVerificationCode('TXN');

    const [payment, updatedInvoice] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId,
          amount: paidAmountNumber,
          paymentMethod,
          referenceNo: transactionRef,
          paidAt: new Date(),
          notes: notes || 'Online international patient settlement',
          recordedBy: authUser!.userId,
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidTotal,
          balanceDue: newBalanceDue,
          status: newStatus,
        },
      }),
    ]);

    // If invoice is fully paid, update linked partner settlements to APPROVED
    if (newStatus === 'PAID') {
      await prisma.partnerSettlement.updateMany({
        where: { invoiceId },
        data: { status: 'APPROVED' },
      });
    }

    // Generate cryptographic payment proof receipt
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const geoCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || null;

    const statement = `Payment of ${invoice.currency} ${paidAmountNumber} settled for invoice ${invoice.invoiceNumber}. Milestone: ${invoice.milestoneName || 'Full Payment'}. Reference: ${transactionRef}.`;
    const documentHash = computeSha256({
      invoiceNumber: invoice.invoiceNumber,
      transactionRef,
      amountPaid: paidAmountNumber,
      currency: invoice.currency,
      timestamp: new Date().toISOString(),
      signerEmail: authUser!.email,
    });
    const verificationCode = generateVerificationCode('MR-RCPT');

    const proofReceipt = await prisma.legalConsent.create({
      data: {
        verificationCode,
        consentType: 'FINANCIAL_TERMS_AGREEMENT',
        caseId: invoice.caseId,
        patientId: invoice.case.patientId,
        entityType: 'Invoice',
        entityId: invoice.id,
        documentHash,
        signerFullName: authUser!.fullName || 'International Patient',
        signerEmail: authUser!.email,
        signerRole: authUser!.role,
        statement,
        ipAddress,
        userAgent,
        geoCountry,
        signedAt: new Date(),
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'PATIENT_PAYMENT_PROCESSED',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: {
        invoiceNumber: invoice.invoiceNumber,
        amount: paidAmountNumber,
        currency: invoice.currency,
        newStatus,
        proofCode: proofReceipt.verificationCode,
      },
      route: '/api/v1/patient/billing',
    });

    return apiSuccess({
      payment,
      invoice: updatedInvoice,
      proofReceipt,
    }, undefined, 201);
  } catch (err) {
    console.error('Failed to process patient payment:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process payment', 500);
  }
}
