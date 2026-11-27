import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Patient reads their complete journey data in one call */
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    // Get latest active case with all journey data
    const cases = await prisma.case.findMany({
      where: { patientId: patient.id },
      include: {
        manager: { select: { fullName: true, email: true, phone: true } },
        treatmentPlans: {
          include: {
            items: {
              include: {
                hospital: { select: { name: true, city: true } },
                doctor: { select: { fullName: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        visaAssistances: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { hospital: { select: { name: true } } },
        },
        transferBookings: { orderBy: { scheduledAt: 'asc' } },
        accommodationBookings: {
          include: { hostel: { select: { name: true, city: true, address: true } } },
          orderBy: { checkIn: 'asc' },
        },
        appointments: {
          include: {
            hospital: { select: { name: true, city: true } },
            doctor: { select: { fullName: true, specialisation: { select: { name: true } } } },
          },
          orderBy: { scheduledAt: 'asc' },
        },
        dischargeSummaries: {
          include: { doctor: { select: { fullName: true } } },
          orderBy: { dischargeDate: 'desc' },
          take: 1,
        },
        followUps: {
          include: { doctor: { select: { fullName: true } } },
          orderBy: { scheduledAt: 'asc' },
        },
        invoices: {
          where: { status: { not: 'DRAFT' } },
          include: { payments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { cases } });
  } catch (err) {
    console.error('Failed to load patient journey:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
