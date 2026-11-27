import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Verification code is required', 400);
    }

    const consent = await prisma.legalConsent.findUnique({
      where: { verificationCode: code.toUpperCase() },
      include: {
        patient: {
          select: {
            id: true,
            nationality: true,
            user: { select: { fullName: true } },
          },
        },
        case: {
          select: {
            id: true,
            status: true,
            arrivalDate: true,
            departureDate: true,
          },
        },
      },
    });

    if (!consent) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Certificate of Proof not found. Invalid verification code.', 404);
    }

    // Mask PII for public verification seal
    const maskedEmail = consent.signerEmail
      ? consent.signerEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(b.length, 3))}${c}`)
      : '—';

    const maskedIp = consent.ipAddress
      ? consent.ipAddress.replace(/\.\d+$/, '.***')
      : '—';

    return apiSuccess({
      verification: {
        verificationCode: consent.verificationCode,
        isValid: true,
        status: 'VERIFIED_AUTHENTIC',
        consentType: consent.consentType,
        signerFullName: consent.signerFullName,
        signerEmailMasked: maskedEmail,
        signerRole: consent.signerRole,
        statement: consent.statement,
        documentHash: consent.documentHash,
        entityType: consent.entityType,
        entityId: consent.entityId,
        metadata: consent.metadata,
        ipAddressMasked: maskedIp,
        geoCountry: consent.geoCountry || 'IN',
        signedAt: consent.signedAt.toISOString(),
        verifiedAt: new Date().toISOString(),
        issuer: {
          organization: 'MediRoute India Pvt. Ltd.',
          jurisdiction: 'Republic of India',
          complianceStandard: 'Information Technology Act § 10A & HIPAA Technical Safeguards',
          registryUrl: 'https://mediroute.in/verify',
        },
      },
    });
  } catch (err) {
    console.error('Verification query failed:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to verify certificate', 500);
  }
}
