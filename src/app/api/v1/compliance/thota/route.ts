import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { TransplantApprovalStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;

    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      where.patientId = patient.id;
    }

    const records = await prisma.transplantCompliance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        case: { select: { id: true, status: true, patient: { select: { nationality: true, user: { select: { fullName: true } } } } } },
      },
    });

    return apiSuccess({ transplantRecords: records });
  } catch (err) {
    console.error('Failed to list THOTA transplant records:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch THOTA compliance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const {
      caseId,
      organType,
      donorFullName,
      donorNationality,
      donorPassport,
      donorRelation,
      donorAge,
      form21EmbassyNocUrl,
      form11JointApplicationUrl,
      dnaTissueTypingReportUrl,
      notarizedAffidavitUrl,
    } = body;

    if (!caseId || !organType || !donorFullName || !donorNationality || !donorPassport || !donorRelation) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing mandatory THOTA statutory donor fields', 400);
    }

    const patientCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, patientId: true },
    });

    if (!patientCase) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Case not found', 404);
    }

    // Determine initial status based on Form 21 Embassy NOC availability
    let approvalStatus: TransplantApprovalStatus = 'DOCS_PENDING';
    if (form21EmbassyNocUrl) {
      approvalStatus = 'EMBASSY_VERIFIED';
    }

    const record = await prisma.transplantCompliance.upsert({
      where: { caseId },
      update: {
        organType,
        donorFullName,
        donorNationality,
        donorPassport,
        donorRelation,
        donorAge: donorAge ? parseInt(donorAge, 10) : null,
        form21EmbassyNocUrl: form21EmbassyNocUrl || undefined,
        form11JointApplicationUrl: form11JointApplicationUrl || undefined,
        dnaTissueTypingReportUrl: dnaTissueTypingReportUrl || undefined,
        notarizedAffidavitUrl: notarizedAffidavitUrl || undefined,
        approvalStatus,
      },
      create: {
        caseId,
        patientId: patientCase.patientId,
        organType,
        donorFullName,
        donorNationality,
        donorPassport,
        donorRelation,
        donorAge: donorAge ? parseInt(donorAge, 10) : null,
        form21EmbassyNocUrl: form21EmbassyNocUrl || null,
        form11JointApplicationUrl: form11JointApplicationUrl || null,
        dnaTissueTypingReportUrl: dnaTissueTypingReportUrl || null,
        notarizedAffidavitUrl: notarizedAffidavitUrl || null,
        approvalStatus,
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'THOTA_COMPLIANCE_RECORDED',
      entityType: 'TransplantCompliance',
      entityId: record.id,
      newValue: {
        organType,
        donorFullName,
        donorRelation,
        hasEmbassyForm21: !!form21EmbassyNocUrl,
        approvalStatus,
      },
      route: '/api/v1/compliance/thota',
    });

    return apiSuccess({ transplantRecord: record }, undefined, 201);
  } catch (err) {
    console.error('Failed to record THOTA compliance:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save THOTA compliance record', 500);
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
    const {
      id,
      approvalStatus,
      committeeMeetingDate,
      committeeNocNumber,
      committeeDecisionNotes,
    } = body;

    if (!id || !approvalStatus) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Record id and approvalStatus are required', 400);
    }

    const updated = await prisma.transplantCompliance.update({
      where: { id },
      data: {
        approvalStatus,
        committeeMeetingDate: committeeMeetingDate ? new Date(committeeMeetingDate) : undefined,
        committeeNocNumber: committeeNocNumber || undefined,
        committeeDecisionNotes: committeeDecisionNotes || undefined,
        verifiedAt: new Date(),
        verifiedBy: authUser!.email,
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'THOTA_APPROVAL_STATUS_UPDATE',
      entityType: 'TransplantCompliance',
      entityId: updated.id,
      newValue: {
        approvalStatus,
        committeeNocNumber,
      },
      route: '/api/v1/compliance/thota',
    });

    return apiSuccess({ transplantRecord: updated });
  } catch (err) {
    console.error('Failed to update THOTA approval:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update THOTA compliance status', 500);
  }
}
