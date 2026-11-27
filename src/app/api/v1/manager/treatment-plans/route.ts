import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createPlanSchema = z.object({
  caseId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  estimatedDuration: z.string().optional(),
  estimatedHospitalStay: z.string().optional(),
  estimatedRecovery: z.string().optional(),
  items: z.array(z.object({
    hospitalId: z.string().optional(),
    doctorId: z.string().optional(),
    itemType: z.enum(['PROCEDURE', 'CONSULTATION', 'TEST', 'MEDICATION', 'ROOM_CHARGE', 'OTHER']),
    description: z.string().min(1),
    quantity: z.number().int().positive().default(1),
    unitCost: z.number().positive(),
    notes: z.string().optional(),
  })).min(1),
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
    if (caseId) {
      where.caseId = caseId;
    }
    // Manager can only see plans for their cases
    if (userRole === 'MANAGER') {
      where.case = { managerId: userId };
    }

    const plans = await prisma.treatmentPlan.findMany({
      where,
      include: {
        items: {
          include: {
            hospital: { select: { id: true, name: true, city: true } },
            doctor: { select: { id: true, fullName: true, specialisation: { select: { name: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
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
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { treatmentPlans: plans } });
  } catch (err) {
    console.error('Failed to load treatment plans:', err);
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
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, title, description, estimatedDuration, estimatedHospitalStay, estimatedRecovery, items } = parsed.data;

    // Verify manager owns the case
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (userRole === 'MANAGER' && caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 });
    }

    // Calculate totals
    const planItems = items.map((item, idx) => ({
      ...item,
      unitCost: item.unitCost,
      totalCost: item.unitCost * item.quantity,
      sortOrder: idx,
    }));
    const totalEstimatedCost = planItems.reduce((sum, item) => sum + item.totalCost, 0);

    const plan = await prisma.treatmentPlan.create({
      data: {
        caseId,
        title,
        description,
        estimatedDuration,
        estimatedHospitalStay,
        estimatedRecovery,
        totalEstimatedCost,
        createdBy: userId,
        items: {
          create: planItems.map(item => ({
            hospitalId: item.hospitalId,
            doctorId: item.doctorId,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            notes: item.notes,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: {
          include: {
            hospital: { select: { id: true, name: true } },
            doctor: { select: { id: true, fullName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Update case estimated cost
    await prisma.case.update({
      where: { id: caseId },
      data: { totalEstimatedCost },
    });

    return NextResponse.json({ success: true, data: { treatmentPlan: plan } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create treatment plan:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
