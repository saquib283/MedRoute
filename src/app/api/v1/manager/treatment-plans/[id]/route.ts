import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updatePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  estimatedDuration: z.string().optional(),
  estimatedHospitalStay: z.string().optional(),
  estimatedRecovery: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT_TO_PATIENT', 'REVISED']).optional(),
  items: z.array(z.object({
    id: z.string().optional(), // existing item ID for update
    hospitalId: z.string().optional(),
    doctorId: z.string().optional(),
    itemType: z.enum(['PROCEDURE', 'CONSULTATION', 'TEST', 'MEDICATION', 'ROOM_CHARGE', 'OTHER']),
    description: z.string().min(1),
    quantity: z.number().int().positive().default(1),
    unitCost: z.number().positive(),
    notes: z.string().optional(),
  })).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
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
                nationality: true,
                user: { select: { fullName: true, email: true, phone: true } },
              },
            },
            manager: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 });
    }

    if (userRole === 'MANAGER' && plan.case.manager?.email !== request.headers.get('x-user-email')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: { treatmentPlan: plan } });
  } catch (err) {
    console.error('Failed to get treatment plan:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { case: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 });
    }
    if (userRole === 'MANAGER' && existing.case.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { title, description, estimatedDuration, estimatedHospitalStay, estimatedRecovery, status, items } = parsed.data;

    // If items provided, delete old items and create new
    if (items) {
      await prisma.treatmentPlanItem.deleteMany({ where: { treatmentPlanId: id } });

      const planItems = items.map((item, idx) => ({
        treatmentPlanId: id,
        hospitalId: item.hospitalId,
        doctorId: item.doctorId,
        itemType: item.itemType,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.unitCost * item.quantity,
        notes: item.notes,
        sortOrder: idx,
      }));

      await prisma.treatmentPlanItem.createMany({ data: planItems });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
    if (estimatedHospitalStay !== undefined) updateData.estimatedHospitalStay = estimatedHospitalStay;
    if (estimatedRecovery !== undefined) updateData.estimatedRecovery = estimatedRecovery;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'SENT_TO_PATIENT') updateData.sentAt = new Date();
    }

    // Recalculate total
    if (items) {
      const total = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      updateData.totalEstimatedCost = total;
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ success: true, data: { treatmentPlan: updated } });
  } catch (err) {
    console.error('Failed to update treatment plan:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
