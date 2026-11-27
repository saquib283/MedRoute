import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { generateVerificationCode } from '@/lib/legal/crypto-proof';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    let hospitalId = authUser!.hospitalId;
    if (authUser!.role === 'ADMIN' && !hospitalId) {
      const firstHosp = await prisma.hospital.findFirst();
      hospitalId = firstHosp?.id || null;
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned to this account', 400);
    }

    const visaLetters = await prisma.visaAssistance.findMany({
      where: { hospitalId },
      include: {
        case: {
          include: {
            patient: { select: { nationality: true, user: { select: { fullName: true, email: true, phone: true } } } },
          },
        },
        hospital: { select: { name: true, city: true, accreditation: true, contactEmail: true, contactPhone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ visaLetters });
  } catch (err) {
    console.error('Failed to list hospital visa letters:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch visa invitation letters', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    const body = await request.json();
    const {
      caseId,
      patientPassportNo,
      attendantName,
      attendantPassportNo,
      embassyLocation,
      doctorName,
      procedureName,
      estimatedDurationDays = 21,
    } = body;

    if (!caseId || !patientPassportNo || !embassyLocation || !procedureName) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing mandatory Visa Invitation Letter details', 400);
    }

    let hospitalId = authUser!.hospitalId;
    if (authUser!.role === 'ADMIN' && body.hospitalId) {
      hospitalId = body.hospitalId;
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned', 400);
    }
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: { patient: { include: { user: true } } },
    });
    if (!caseRecord || !caseRecord.patient) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Case or patient record not found', 404);
    }

    const verificationCode = generateVerificationCode('MR-VIL');

    const visaRecord = await prisma.visaAssistance.create({
      data: {
        caseId,
        hospitalId,
        status: 'GENERATED',
        patientFullName: caseRecord.patient.user.fullName,
        nationality: caseRecord.patient.nationality,
        passportNumber: patientPassportNo,
        treatmentDescription: procedureName,
        invitationLetterUrl: `/visa-letters/VIL-${verificationCode}.pdf`,
        attendantCount: attendantName ? 1 : 0,
        attendantDetails: attendantName ? [{ name: attendantName, passport: attendantPassportNo || '' }] : undefined,
        generatedAt: new Date(),
      },
      include: {
        case: { include: { patient: { select: { user: { select: { fullName: true } } } } } },
        hospital: { select: { name: true, city: true } },
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'HOSPITAL_VIL_ISSUED',
      entityType: 'VisaAssistance',
      entityId: visaRecord.id,
      newValue: {
        verificationCode,
        hospitalId,
        caseId,
        procedureName,
        doctorName,
      },
      route: '/api/v1/hospital/visa',
    });

    return apiSuccess({ visaRecord, verificationCode }, undefined, 201);
  } catch (err) {
    console.error('Failed to issue Hospital VIL:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to issue Visa Invitation Letter', 500);
  }
}
