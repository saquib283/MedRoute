import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { generateVerificationCode } from '@/lib/legal/crypto-proof';
import { GrievanceCategory, GrievanceSeverity, GrievanceStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (status) where.status = status as GrievanceStatus;
    if (category) where.category = category as GrievanceCategory;

    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      where.patientId = patient.id;
    }

    const grievances = await prisma.grievanceRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, nationality: true, user: { select: { fullName: true, email: true, phone: true } } } },
        case: { select: { id: true, status: true } },
      },
    });

    const now = new Date().getTime();

    // Augment with NABH statutory SLA metrics (48h acknowledge / 7d resolution)
    const augmented = grievances.map((g) => {
      const ackDeadlineTime = new Date(g.slaAcknowledgeDeadline).getTime();
      const resDeadlineTime = new Date(g.slaResolutionDeadline).getTime();

      const ackRemainingHours = Math.round((ackDeadlineTime - now) / (1000 * 60 * 60) * 10) / 10;
      const resRemainingHours = Math.round((resDeadlineTime - now) / (1000 * 60 * 60) * 10) / 10;

      const isAckBreached = !g.acknowledgedAt && now > ackDeadlineTime;
      const isResBreached = g.status !== 'RESOLVED' && now > resDeadlineTime;

      return {
        ...g,
        ackRemainingHours,
        resRemainingHours,
        isAckBreached,
        isResBreached,
        slaStatus: isResBreached
          ? 'SLA_BREACHED'
          : isAckBreached
          ? 'ACK_OVERDUE'
          : g.status === 'RESOLVED'
          ? 'SLA_MET'
          : 'ON_TRACK',
      };
    });

    return apiSuccess({ grievances: augmented });
  } catch (err) {
    console.error('Failed to list grievances:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch grievance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { caseId, category, severity = 'MEDIUM', subject, description } = body;

    if (!category || !subject || !description) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'category, subject, and description are required', 400);
    }

    let patientId = body.patientId;
    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      patientId = patient.id;
    }

    if (!patientId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'patientId is required', 400);
    }

    const ticketNumber = generateVerificationCode('MR-GRV');
    const now = new Date();
    // NABH Statutory SLA: 48 Hours for acknowledgement, 7 Days for full resolution
    const slaAcknowledgeDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const slaResolutionDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const grievance = await prisma.grievanceRecord.create({
      data: {
        ticketNumber,
        patientId,
        caseId: caseId || null,
        category: category as GrievanceCategory,
        severity: severity as GrievanceSeverity,
        subject,
        description,
        status: 'SUBMITTED',
        slaAcknowledgeDeadline,
        slaResolutionDeadline,
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'GRIEVANCE_SUBMITTED',
      entityType: 'GrievanceRecord',
      entityId: grievance.id,
      newValue: {
        ticketNumber,
        category,
        severity,
        subject,
      },
      route: '/api/v1/compliance/grievances',
    });

    return apiSuccess({ grievance }, undefined, 201);
  } catch (err) {
    console.error('Failed to submit grievance:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to register grievance', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin or Coordinator access required', 403);
    }

    const body = await request.json();
    const { id, status, resolutionNotes, actionType } = body;

    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Grievance record id is required', 400);
    }

    const existing = await prisma.grievanceRecord.findUnique({ where: { id } });
    if (!existing) return apiError(ERROR_CODES.NOT_FOUND, 'Grievance record not found', 404);

    const updateData: Record<string, unknown> = {};

    // Acknowledge Action (within 48h SLA)
    if (actionType === 'ACKNOWLEDGE' || (!existing.acknowledgedAt && status === 'UNDER_INVESTIGATION')) {
      updateData.acknowledgedAt = new Date();
      updateData.acknowledgedBy = authUser!.email;
      updateData.status = 'UNDER_INVESTIGATION';
    }

    // Resolve Action (within 7-day SLA)
    if (status === 'RESOLVED') {
      updateData.status = 'RESOLVED';
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = authUser!.email;
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    } else if (status) {
      updateData.status = status;
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    }

    const updated = await prisma.grievanceRecord.update({
      where: { id },
      data: updateData,
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'GRIEVANCE_UPDATED',
      entityType: 'GrievanceRecord',
      entityId: updated.id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, resolutionNotes: updated.resolutionNotes },
      route: '/api/v1/compliance/grievances',
    });

    return apiSuccess({ grievance: updated });
  } catch (err) {
    console.error('Failed to update grievance:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update grievance record', 500);
  }
}
