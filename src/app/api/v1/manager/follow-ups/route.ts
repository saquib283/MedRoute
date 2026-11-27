import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createFollowUpSchema = z.object({
  caseId: z.string(),
  doctorId: z.string().optional(),
  followUpType: z.enum(['IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL']),
  scheduledAt: z.string(),
  meetingLink: z.string().optional(),
  notes: z.string().optional(),
});

const updateFollowUpSchema = z.object({
  id: z.string(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  vitalSigns: z.object({
    bp: z.string().optional(),
    heartRate: z.string().optional(),
    temp: z.string().optional(),
    weight: z.string().optional(),
  }).optional(),
  patientFeedback: z.string().optional(),
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
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;
    if (userRole === 'MANAGER') where.case = { managerId: userId };

    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        doctor: { select: { id: true, fullName: true, specialisation: { select: { name: true } } } },
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

    return NextResponse.json({ success: true, data: { followUps } });
  } catch (err) {
    console.error('Failed to load follow-ups:', err);
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
    const parsed = createFollowUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, doctorId, followUpType, scheduledAt, meetingLink, notes } = parsed.data;

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (userRole === 'MANAGER' && caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const followUp = await prisma.followUp.create({
      data: {
        caseId,
        doctorId,
        followUpType: followUpType as 'IN_PERSON' | 'VIDEO_CALL' | 'PHONE_CALL',
        scheduledAt: new Date(scheduledAt),
        meetingLink,
        notes,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ success: true, data: { followUp } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create follow-up:', err);
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

    const body = await request.json();
    const parsed = updateFollowUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.vitalSigns !== undefined) updateData.vitalSigns = parsed.data.vitalSigns;
    if (parsed.data.patientFeedback !== undefined) updateData.patientFeedback = parsed.data.patientFeedback;

    const updated = await prisma.followUp.update({
      where: { id: parsed.data.id },
      data: updateData,
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ success: true, data: { followUp: updated } });
  } catch (err) {
    console.error('Failed to update follow-up:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
