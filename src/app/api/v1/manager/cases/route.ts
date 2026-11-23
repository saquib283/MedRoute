import { NextRequest, NextResponse } from 'next/server';
import { CaseStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getClientIP } from '@/lib/api/auth-helper';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const updateCaseSchema = z.object({
  caseId: z.string(),
  status: z.nativeEnum(CaseStatus).optional(),
  notes: z.string().optional(),
  isUrgent: z.boolean().optional(),
  escalationNote: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
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

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
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

    if (caseRecord.status === 'CLOSED' && status && status !== 'CLOSED') {
      return NextResponse.json({ error: 'Cannot reopen a closed case' }, { status: 400 });
    }

    const normalizedEscalation =
      escalationNote !== undefined
        ? escalationNote?.trim()
          ? escalationNote.trim()
          : null
        : undefined;

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(isUrgent !== undefined && { isUrgent }),
        ...(normalizedEscalation !== undefined && { escalationNote: normalizedEscalation }),
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

    await createAuditLog({
      actorId: userId,
      action: status ? AUDIT_ACTIONS.STATUS_CHANGE : AUDIT_ACTIONS.UPDATE,
      entityType: 'Case',
      entityId: caseId,
      oldValue: {
        status: caseRecord.status,
        isUrgent: caseRecord.isUrgent,
        escalationNote: caseRecord.escalationNote,
      },
      newValue: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(isUrgent !== undefined && { isUrgent }),
        ...(normalizedEscalation !== undefined && { escalationNote: normalizedEscalation }),
      },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (err) {
    console.error('Failed to update case file:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
