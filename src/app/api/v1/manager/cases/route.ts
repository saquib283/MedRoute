import { NextRequest, NextResponse } from 'next/server';
import { CaseStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getClientIP } from '@/lib/api/auth-helper';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { ERROR_CODES } from '@/lib/api/errors';
import { createCaseForPatient } from '@/lib/services/onboarding.service';
import {
  formatPatientForViewer,
  formatTravelLogisticsForViewer,
} from '@/lib/services/phi.service';
import { validateCaseStatusTransition } from '@/lib/validation/lifecycle-schemas';
import { z } from 'zod';

const createCaseManagerSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().max(5000).optional(),
  isUrgent: z.boolean().optional(),
  managerId: z.string().nullable().optional(),
});

const updateCaseSchema = z.object({
  caseId: z.string(),
  status: z.nativeEnum(CaseStatus).optional(),
  notes: z.string().optional(),
  isUrgent: z.boolean().optional(),
  escalationNote: z.string().nullable().optional(),
  overrideReason: z.string().max(1000).nullable().optional(),
});

function maskCaseForViewer<T extends Record<string, unknown>>(c: T | null): T | null {
  if (!c) return null;
  return {
    ...c,
    ...(c.patient && typeof c.patient === 'object'
      ? { patient: formatPatientForViewer(c.patient as Record<string, unknown>, { maskPassport: true }) }
      : {}),
    ...('travelLogistics' in c
      ? { travelLogistics: formatTravelLogisticsForViewer(c.travelLogistics, { maskPassport: true }) }
      : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const cases = await prisma.case.findMany({
      where: userRole === 'ADMIN' ? {} : { managerId: userId },
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

    const maskedCases = cases.map((c) => maskCaseForViewer(c as unknown as Record<string, unknown>));
    return NextResponse.json({ cases: maskedCases });
  } catch (err) {
    console.error('Failed to load manager cases:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCaseManagerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const caseRes = await createCaseForPatient({
      patientId: parsed.data.patientId,
      notes: parsed.data.notes,
      isUrgent: parsed.data.isUrgent,
      managerId: userRole === 'MANAGER' ? userId : parsed.data.managerId,
      actorId: userId,
      callerRole: userRole,
      ipAddress: getClientIP(request),
    });

    if (!caseRes.ok) {
      return NextResponse.json({ error: caseRes.message, code: caseRes.code }, { status: caseRes.status });
    }

    return NextResponse.json(
      { success: true, case: maskCaseForViewer(caseRes.case as unknown as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (err) {
    console.error('Failed to create manager case:', err);
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

    const { caseId, status, notes, isUrgent, escalationNote, overrideReason } = parsed.data;

    // Verify the case belongs to this manager (or caller is ADMIN)
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        patient: { select: { assignedManagerId: true } },
        fitToFlyClearance: { select: { isCleared: true } },
      },
    });

    const isAuthorized =
      Boolean(caseRecord) &&
      (userRole === 'ADMIN' ||
        caseRecord!.managerId === userId ||
        caseRecord!.patient?.assignedManagerId === userId);

    if (!caseRecord || !isAuthorized) {
      return NextResponse.json({ error: 'Case not found or unauthorized' }, { status: 404 });
    }

    const normalizedEscalation =
      escalationNote !== undefined
        ? escalationNote?.trim()
          ? escalationNote.trim()
          : null
        : undefined;

    const normalizedOverrideReason =
      overrideReason?.trim() ||
      (normalizedEscalation !== undefined ? normalizedEscalation : null) ||
      null;

    if (status !== undefined && status !== caseRecord.status) {
      if (caseRecord.status === 'CLOSED' && userRole !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Cannot reopen a closed case', code: ERROR_CODES.CASE_ALREADY_CLOSED },
          { status: 400 }
        );
      }

      const [verifiedPassportCount, unpaidBillCount, ftfFallback] = await Promise.all([
        prisma.document?.count
          ? prisma.document.count({
              where: {
                patientId: caseRecord.patientId,
                category: 'PASSPORT',
                verificationStatus: 'VERIFIED',
              },
            })
          : Promise.resolve(0),
        prisma.medicalBill?.count
          ? prisma.medicalBill.count({
              where: {
                caseId,
                status: { notIn: ['PAID', 'CANCELLED'] },
              },
            })
          : Promise.resolve(0),
        caseRecord.fitToFlyClearance === undefined && prisma.fitToFlyClearance?.findUnique
          ? prisma.fitToFlyClearance.findUnique({
              where: { caseId },
              select: { isCleared: true },
            })
          : Promise.resolve(null),
      ]);

      const hasClearedFitToFly = Boolean(
        caseRecord.fitToFlyClearance?.isCleared === true || ftfFallback?.isCleared === true
      );

      const transitionCheck = validateCaseStatusTransition({
        currentStatus: caseRecord.status,
        nextStatus: status,
        hasVerifiedPassport: verifiedPassportCount > 0,
        hasClearedFitToFly,
        unpaidBillCount,
        overrideReason: normalizedOverrideReason,
      });

      if (!transitionCheck.ok) {
        return NextResponse.json(
          {
            error: transitionCheck.message,
            code:
              caseRecord.status === 'CLOSED'
                ? ERROR_CODES.CASE_ALREADY_CLOSED
                : ERROR_CODES.INVALID_STATUS_TRANSITION,
          },
          { status: 400 }
        );
      }
    }

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
      action: status && status !== caseRecord.status ? AUDIT_ACTIONS.STATUS_CHANGE : AUDIT_ACTIONS.UPDATE,
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
        ...(overrideReason?.trim() ? { overrideReason: overrideReason.trim() } : {}),
      },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({
      success: true,
      case: maskCaseForViewer(updatedCase as unknown as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Failed to update case file:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
