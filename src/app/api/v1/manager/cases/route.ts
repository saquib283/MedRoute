import { NextResponse } from 'next/server';
import { PrismaClient, CaseStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const updateCaseSchema = z.object({
  caseId: z.string(),
  status: z.nativeEnum(CaseStatus).optional(),
  notes: z.string().optional(),
  isUrgent: z.boolean().optional(),
  escalationNote: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const cases = await prisma.case.findMany({
      where: {
        managerId: userId,
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        lastUpdatedAt: 'desc',
      },
    });

    return NextResponse.json({ cases });
  } catch (err) {
    console.error('Failed to load manager cases:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateCaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, status, notes, isUrgent, escalationNote } = parsed.data;

    // Verify the case belongs to this manager
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord || caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Case not found or unauthorized' }, { status: 404 });
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(isUrgent !== undefined && { isUrgent }),
        ...(escalationNote !== undefined && { escalationNote }),
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (err) {
    console.error('Failed to update case file:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
