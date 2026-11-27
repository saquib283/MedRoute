import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // 'month' | 'year' | 'all'

    const now = new Date();
    let dateFilter: Date | undefined;
    if (period === 'month') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      dateFilter = new Date(now.getFullYear(), 0, 1);
    }

    const invoiceWhere: Record<string, unknown> = { status: { not: 'CANCELLED' } };
    if (dateFilter) invoiceWhere.createdAt = { gte: dateFilter };

    // Fetch all non-cancelled invoices
    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        hospital: { select: { id: true, name: true } },
        case: {
          select: {
            accommodationBookings: {
              select: { hostel: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Aggregate totals
    let totalRevenue = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let hospitalCommission = 0;
    let hotelCommission = 0;
    let facilitationRevenue = 0;
    let logisticsRevenue = 0;

    const revenueByHospital: Record<string, { name: string; commission: number; billed: number }> = {};

    for (const inv of invoices) {
      totalBilled += Number(inv.totalAmount);
      totalPaid += Number(inv.paidAmount);
      totalOutstanding += Number(inv.balanceDue);
      const commission = Number(inv.commissionAmount) || 0;
      totalRevenue += commission;

      if (inv.invoiceType === 'TREATMENT') {
        hospitalCommission += commission;
        const hName = inv.hospital?.name || 'Unknown';
        const hId = inv.hospitalId || 'unknown';
        if (!revenueByHospital[hId]) {
          revenueByHospital[hId] = { name: hName, commission: 0, billed: 0 };
        }
        revenueByHospital[hId].commission += commission;
        revenueByHospital[hId].billed += Number(inv.totalAmount);
      } else if (inv.invoiceType === 'ACCOMMODATION') {
        hotelCommission += commission;
      } else if (inv.invoiceType === 'FACILITATION_FEE') {
        facilitationRevenue += Number(inv.totalAmount);
      } else if (inv.invoiceType === 'LOGISTICS') {
        logisticsRevenue += Number(inv.totalAmount);
      }
    }

    // Case stats
    const totalCases = await prisma.case.count(dateFilter ? { where: { createdAt: { gte: dateFilter } } } : undefined);
    const activeCases = await prisma.case.count({ where: { status: { notIn: ['CLOSED'] } } });

    // Invoice status distribution
    const statusCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true,
      where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalBilled,
          totalPaid,
          totalOutstanding,
          hospitalCommission,
          hotelCommission,
          facilitationRevenue,
          logisticsRevenue,
        },
        cases: { total: totalCases, active: activeCases },
        revenueByHospital: Object.values(revenueByHospital).sort((a, b) => b.commission - a.commission),
        invoiceStatusDistribution: statusCounts.map(s => ({ status: s.status, count: s._count })),
        period,
      },
    });
  } catch (err) {
    console.error('Failed to load revenue data:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
