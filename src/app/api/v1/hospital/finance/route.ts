import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    let hospitalId = authUser!.hospitalId;
    if (authUser!.role === 'ADMIN' && !hospitalId) {
      const firstHosp = await prisma.hospital.findFirst();
      hospitalId = firstHosp?.id || null;
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned', 400);
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, city: true, commissionRate: true, bankDetails: true },
    });

    const invoices = await prisma.invoice.findMany({
      where: { hospitalId },
      include: {
        case: {
          include: {
            patient: { select: { nationality: true, user: { select: { fullName: true } } } },
          },
        },
        lineItems: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const commissionRate = Number(hospital?.commissionRate || 10);

    const ledger = invoices.map((inv) => {
      const grossAmount = Number(inv.totalAmount);
      const commissionAmount = grossAmount * (commissionRate / 100);
      const netPayableToHospital = grossAmount - commissionAmount;
      const isPaid = inv.status === 'PAID';

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.case?.patient?.user?.fullName || 'International Patient',
        patientNationality: inv.case?.patient?.nationality || 'International',
        grossAmount,
        currency: inv.currency,
        commissionRate,
        commissionAmount,
        netPayableToHospital,
        status: inv.status,
        issuedAt: inv.issuedAt,
        paidAt: inv.payments?.[0]?.paidAt || null,
        settlementStatus: isPaid ? 'SETTLED' : 'PENDING_COLLECTION',
      };
    });

    const totalGross = ledger.reduce((sum, item) => sum + item.grossAmount, 0);
    const totalCommission = ledger.reduce((sum, item) => sum + item.commissionAmount, 0);
    const totalNetHospital = ledger.reduce((sum, item) => sum + item.netPayableToHospital, 0);

    return apiSuccess({
      hospital,
      summary: {
        totalInvoices: ledger.length,
        totalGross,
        totalCommission,
        totalNetHospital,
        commissionRate,
      },
      ledger,
    });
  } catch (err) {
    console.error('Failed to fetch hospital finance ledger:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch finance records', 500);
  }
}
