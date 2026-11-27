import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createVisaSchema = z.object({
  caseId: z.string(),
  hospitalId: z.string().optional(),
  patientFullName: z.string().min(1),
  passportNumber: z.string().optional(),
  nationality: z.string().min(1),
  treatmentDescription: z.string().optional(),
  estimatedArrival: z.string().optional(),
  estimatedDeparture: z.string().optional(),
  attendantCount: z.number().int().min(0).default(0),
  attendantDetails: z.array(z.object({
    name: z.string(),
    passport: z.string().optional(),
    relation: z.string(),
  })).optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (userRole === 'MANAGER') where.case = { managerId: userId };

    const records = await prisma.visaAssistance.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true, city: true } },
        case: {
          select: {
            id: true,
            patient: {
              select: {
                id: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { visaAssistances: records } });
  } catch (err) {
    console.error('Failed to load visa assistance records:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createVisaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, hospitalId, patientFullName, passportNumber, nationality, treatmentDescription, estimatedArrival, estimatedDeparture, attendantCount, attendantDetails, notes } = parsed.data;

    // Verify case access
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (userRole === 'MANAGER' && caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if stay > 180 days for FRRO requirement
    let frroRequired = false;
    if (estimatedArrival && estimatedDeparture) {
      const days = Math.ceil((new Date(estimatedDeparture).getTime() - new Date(estimatedArrival).getTime()) / (1000 * 60 * 60 * 24));
      frroRequired = days > 180;
    }

    const record = await prisma.visaAssistance.create({
      data: {
        caseId,
        hospitalId,
        patientFullName,
        passportNumber,
        nationality,
        treatmentDescription,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        estimatedDeparture: estimatedDeparture ? new Date(estimatedDeparture) : undefined,
        frroRequired,
        attendantCount,
        attendantDetails: attendantDetails || [],
        notes,
      },
      include: {
        hospital: { select: { id: true, name: true } },
      },
    });

    // Update case arrival/departure dates
    await prisma.case.update({
      where: { id: caseId },
      data: {
        arrivalDate: estimatedArrival ? new Date(estimatedArrival) : undefined,
        departureDate: estimatedDeparture ? new Date(estimatedDeparture) : undefined,
      },
    });

    return NextResponse.json({ success: true, data: { visaAssistance: record } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create visa assistance:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
