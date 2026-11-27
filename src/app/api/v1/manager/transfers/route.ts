import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTransferSchema = z.object({
  caseId: z.string(),
  transferType: z.enum(['AIRPORT_PICKUP', 'AIRPORT_DROP', 'HOSPITAL_TRANSFER', 'HOTEL_TRANSFER']),
  scheduledAt: z.string(),
  pickupLocation: z.string().min(1),
  dropLocation: z.string().min(1),
  vehicleType: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  estimatedCost: z.number().optional(),
  passengerCount: z.number().int().positive().default(1),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
});

const updateTransferSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  actualCost: z.number().optional(),
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

    const transfers = await prisma.transferBooking.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            patient: {
              select: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: { transfers } });
  } catch (err) {
    console.error('Failed to load transfers:', err);
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
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId } = parsed.data;
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (userRole === 'MANAGER' && caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const transfer = await prisma.transferBooking.create({
      data: {
        caseId: parsed.data.caseId,
        transferType: parsed.data.transferType as 'AIRPORT_PICKUP' | 'AIRPORT_DROP' | 'HOSPITAL_TRANSFER' | 'HOTEL_TRANSFER',
        scheduledAt: new Date(parsed.data.scheduledAt),
        pickupLocation: parsed.data.pickupLocation,
        dropLocation: parsed.data.dropLocation,
        vehicleType: parsed.data.vehicleType,
        driverName: parsed.data.driverName,
        driverPhone: parsed.data.driverPhone,
        estimatedCost: parsed.data.estimatedCost,
        passengerCount: parsed.data.passengerCount,
        specialRequests: parsed.data.specialRequests,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json({ success: true, data: { transfer } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create transfer:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Transfer ID required' }, { status: 400 });

    const body = await request.json();
    const parsed = updateTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (parsed.data.driverName !== undefined) updateData.driverName = parsed.data.driverName;
    if (parsed.data.driverPhone !== undefined) updateData.driverPhone = parsed.data.driverPhone;
    if (parsed.data.actualCost !== undefined) updateData.actualCost = parsed.data.actualCost;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const updated = await prisma.transferBooking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: { transfer: updated } });
  } catch (err) {
    console.error('Failed to update transfer:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
