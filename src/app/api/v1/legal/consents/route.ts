import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { generateVerificationCode, computeSha256 } from '@/lib/legal/crypto-proof';
import { createAuditLog } from '@/lib/api/audit-logger';
import { LegalConsentType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const where: Record<string, unknown> = {};

    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      where.patientId = patient.id;
    } else if (caseId) {
      where.caseId = caseId;
    }

    const consents = await prisma.legalConsent.findMany({
      where,
      orderBy: { signedAt: 'desc' },
      include: {
        case: { select: { id: true, status: true } },
        patient: { select: { id: true, nationality: true, user: { select: { fullName: true, email: true } } } },
      },
    });

    return apiSuccess({ consents });
  } catch (err) {
    console.error('Failed to list legal consents:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch legal consents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const {
      consentType,
      caseId,
      entityType,
      entityId,
      statement,
      signerFullName,
      metadata,
    } = body;

    if (!consentType || !statement || !signerFullName) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'consentType, statement, and signerFullName are required', 400);
    }

    // Get patient record
    let patientId = body.patientId;
    if (authUser!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: authUser!.userId } });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient not found', 404);
      patientId = patient.id;
    }

    if (!patientId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'patientId is required', 400);
    }

    // Extract request network metadata for legal attribution
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const geoCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || null;

    // Compute cryptographic SHA-256 hash of the exact terms/metadata agreed upon
    const documentHash = computeSha256({
      statement,
      metadata: metadata || {},
      entityType,
      entityId,
      signerFullName,
      signedAt: new Date().toISOString(),
    });

    const verificationCode = generateVerificationCode('MR-PROOF');

    const consent = await prisma.legalConsent.create({
      data: {
        verificationCode,
        consentType: consentType as LegalConsentType,
        caseId: caseId || null,
        patientId,
        entityType: entityType || null,
        entityId: entityId || null,
        documentHash,
        signerFullName,
        signerEmail: authUser!.email,
        signerRole: authUser!.role,
        statement,
        metadata: metadata ? (metadata as object) : undefined,
        ipAddress,
        userAgent,
        geoCountry,
        signedAt: new Date(),
      },
    });

    // Record in cryptographically chained audit log
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'LEGAL_CONSENT_SIGNED',
      entityType: 'LegalConsent',
      entityId: consent.id,
      newValue: {
        verificationCode,
        consentType,
        documentHash,
        signerFullName,
      },
      ipAddress,
      userAgent,
      route: '/api/v1/legal/consents',
      status: 'SUCCESS',
    });

    return apiSuccess({
      consent,
      verificationUrl: `/verify/${verificationCode}`,
    }, undefined, 201);
  } catch (err) {
    console.error('Failed to record legal consent:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to record legal consent', 500);
  }
}
