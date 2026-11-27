import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const invoices = await prisma.invoice.findMany({
      where: { case: { patientId: patient.id }, status: { not: 'DRAFT' } },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        hospital: { select: { id: true, name: true, city: true } },
        case: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { invoices } });
  } catch (err) {
    console.error('Failed to load patient invoices:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
