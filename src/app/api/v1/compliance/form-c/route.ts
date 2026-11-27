import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { FormCStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status as FormCStatus;

    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      where.patientId = patient.id;
    }

    const records = await prisma.formCRegistration.findMany({
      where,
      orderBy: { deadline: 'asc' },
      include: {
        case: { select: { id: true, status: true } },
        patient: { select: { id: true, nationality: true, user: { select: { fullName: true, email: true } } } },
        booking: { select: { id: true, checkIn: true, checkOut: true, hostel: { select: { name: true, city: true } } } },
      },
    });

    const now = new Date().getTime();

    // Augment with statutory countdown metrics (24h BoI requirement)
    const augmented = records.map((r) => {
      const deadlineTime = new Date(r.deadline).getTime();
      const remainingMs = deadlineTime - now;
      const remainingHours = Math.round(remainingMs / (1000 * 60 * 60) * 10) / 10;
      const isOverdue = remainingMs < 0 && r.status === 'PENDING_SUBMISSION';

      return {
        ...r,
        remainingHours,
        isOverdue,
        urgency: isOverdue
          ? 'OVERDUE'
          : remainingHours <= 6 && r.status === 'PENDING_SUBMISSION'
          ? 'CRITICAL_URGENT'
          : remainingHours <= 12 && r.status === 'PENDING_SUBMISSION'
          ? 'WARNING'
          : 'NORMAL',
      };
    });

    return apiSuccess({ formCRecords: augmented });
  } catch (err) {
    console.error('Failed to list Form C records:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch Form C compliance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Coordinator or Admin access required', 403);
    }

    const body = await request.json();
    const {
      caseId,
      bookingId,
      hostelName,
      guestFullName,
      nationality,
      passportNumber,
      visaNumber,
      visaType = 'MEDICAL',
      arrivalDate,
      departureDate,
      notes,
    } = body;

    if (!caseId || !hostelName || !guestFullName || !nationality || !passportNumber || !visaNumber || !arrivalDate) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing required Form C guest fields', 400);
    }

    const patientCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, patientId: true },
    });

    if (!patientCase) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Case not found', 404);
    }

    const arrival = new Date(arrivalDate);
    // Statutory BoI rule: Must be filed within 24 hours of arrival
    const deadline = new Date(arrival.getTime() + 24 * 60 * 60 * 1000);

    const record = await prisma.formCRegistration.create({
      data: {
        caseId,
        patientId: patientCase.patientId,
        bookingId: bookingId || null,
        hostelName,
        guestFullName,
        nationality,
        passportNumber,
        visaNumber,
        visaType,
        arrivalDate: arrival,
        departureDate: departureDate ? new Date(departureDate) : null,
        deadline,
        status: 'PENDING_SUBMISSION',
        notes: notes || null,
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'FORM_C_CREATED',
      entityType: 'FormCRegistration',
      entityId: record.id,
      newValue: {
        guestFullName,
        hostelName,
        deadline: deadline.toISOString(),
      },
      route: '/api/v1/compliance/form-c',
    });

    return apiSuccess({ formCRecord: record }, undefined, 201);
  } catch (err) {
    console.error('Failed to create Form C record:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create Form C record', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Coordinator or Admin access required', 403);
    }

    const body = await request.json();
    const { id, status, formCApplicationNumber, acknowledgementDocUrl, notes } = body;

    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Form C record id is required', 400);
    }

    const existing = await prisma.formCRegistration.findUnique({ where: { id } });
    if (!existing) return apiError(ERROR_CODES.NOT_FOUND, 'Form C record not found', 404);

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (formCApplicationNumber) updateData.formCApplicationNumber = formCApplicationNumber;
    if (acknowledgementDocUrl) updateData.acknowledgementDocUrl = acknowledgementDocUrl;
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'SUBMITTED_TO_BOI' || status === 'ACKNOWLEDGED') {
      updateData.submittedAt = existing.submittedAt || new Date();
      updateData.submittedBy = authUser!.email;
    }

    const updated = await prisma.formCRegistration.update({
      where: { id },
      data: updateData,
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'FORM_C_UPDATED',
      entityType: 'FormCRegistration',
      entityId: updated.id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, formCAppNo: updated.formCApplicationNumber },
      route: '/api/v1/compliance/form-c',
    });

    return apiSuccess({ formCRecord: updated });
  } catch (err) {
    console.error('Failed to update Form C record:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update Form C record', 500);
  }
}
