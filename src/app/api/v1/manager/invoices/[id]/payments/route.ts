import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'INTERNATIONAL_WIRE']),
  referenceNo: z.string().optional(),
  paidAt: z.string(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const body = await request.json();
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { amount, paymentMethod, referenceNo, paidAt, notes } = parsed.data;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        paymentMethod: paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'UPI' | 'INTERNATIONAL_WIRE',
        referenceNo,
        paidAt: new Date(paidAt),
        notes,
        recordedBy: userId,
      },
    });

    // Update invoice amounts
    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balanceDue: Math.max(0, newBalanceDue),
        status: newStatus,
      },
    });

    // Update case totals
    const allInvoices = await prisma.invoice.findMany({
      where: { caseId: invoice.caseId, status: { not: 'CANCELLED' } },
    });
    const totalBilled = allInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0) + amount;

    await prisma.case.update({
      where: { id: invoice.caseId },
      data: {
        totalBilledAmount: totalBilled,
        totalPaidAmount: totalPaid,
      },
    });

    return NextResponse.json({ success: true, data: { payment } }, { status: 201 });
  } catch (err) {
    console.error('Failed to record payment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
