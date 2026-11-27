import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createDischargeSchema = z.object({
  caseId: z.string(),
  admissionDate: z.string(),
  dischargeDate: z.string(),
  diagnosis: z.string().min(1),
  procedurePerformed: z.string().optional(),
  findings: z.string().optional(),
  conditionAtDischarge: z.enum(['STABLE', 'IMPROVED', 'CRITICAL', 'UNCHANGED']),
  dischargeMedications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    duration: z.string(),
  })).optional(),
  dietaryInstructions: z.string().optional(),
  activityRestrictions: z.string().optional(),
  woundCareInstructions: z.string().optional(),
  warningSignsToWatch: z.array(z.string()).optional(),
  nextReviewDate: z.string().optional(),
  followUpInstructions: z.string().optional(),
  fitToTravel: z.boolean().default(false),
  fitToTravelDate: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || userRole !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const where: Record<string, unknown> = { doctorId: doctor.id };
    if (caseId) where.caseId = caseId;

    const summaries = await prisma.dischargeSummary.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            status: true,
            patient: {
              select: {
                id: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { dischargeDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: { dischargeSummaries: summaries } });
  } catch (err) {
    console.error('Failed to load discharge summaries:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'DOCTOR' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createDischargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    let doctorId: string;
    if (userRole === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      doctorId = doctor.id;
    } else {
      // Admin can specify doctorId via query
      const { searchParams } = new URL(request.url);
      doctorId = searchParams.get('doctorId') || '';
      if (!doctorId) return NextResponse.json({ error: 'doctorId required for admin' }, { status: 400 });
    }

    const d = parsed.data;
    const summary = await prisma.dischargeSummary.create({
      data: {
        caseId: d.caseId,
        doctorId,
        admissionDate: new Date(d.admissionDate),
        dischargeDate: new Date(d.dischargeDate),
        diagnosis: d.diagnosis,
        procedurePerformed: d.procedurePerformed,
        findings: d.findings,
        conditionAtDischarge: d.conditionAtDischarge,
        dischargeMedications: d.dischargeMedications || [],
        dietaryInstructions: d.dietaryInstructions,
        activityRestrictions: d.activityRestrictions,
        woundCareInstructions: d.woundCareInstructions,
        warningSignsToWatch: d.warningSignsToWatch || [],
        nextReviewDate: d.nextReviewDate ? new Date(d.nextReviewDate) : undefined,
        followUpInstructions: d.followUpInstructions,
        fitToTravel: d.fitToTravel,
        fitToTravelDate: d.fitToTravelDate ? new Date(d.fitToTravelDate) : undefined,
      },
    });

    // Update case to POST_TREATMENT if currently IN_TREATMENT
    const caseRecord = await prisma.case.findUnique({ where: { id: d.caseId } });
    if (caseRecord && caseRecord.status === 'IN_TREATMENT') {
      await prisma.case.update({
        where: { id: d.caseId },
        data: { status: 'POST_TREATMENT' },
      });
    }

    return NextResponse.json({ success: true, data: { dischargeSummary: summary } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create discharge summary:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
