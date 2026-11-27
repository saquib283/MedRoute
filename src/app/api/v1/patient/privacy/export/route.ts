import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { computeSha256 } from '@/lib/legal/crypto-proof';
import { createAuditLog } from '@/lib/api/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const patient = await prisma.patient.findUnique({
      where: { userId: authUser!.userId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        medicalProfile: true,
        cases: {
          include: {
            treatmentPlans: { include: { items: true } },
            invoices: { include: { lineItems: true, payments: true } },
            appointments: true,
            visaAssistances: true,
            transferBookings: true,
            dischargeSummaries: true,
            followUps: true,
          },
        },
        documents: {
          select: {
            id: true,
            category: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            sha256Hash: true,
            createdAt: true,
          },
        },
        legalConsents: true,
        grievanceRecords: true,
      },
    });

    if (!patient) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Patient record not found', 404);
    }

    // Fetch accounting of disclosures (HIPAA § 164.528 / DPDP audit logs for this patient)
    const auditDisclosures = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Patient', entityId: patient.id },
          { entityType: 'Document', entityId: { in: patient.documents.map((d) => d.id) } },
        ],
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        ipAddress: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const exportPacket = {
      exportMetadata: {
        exportTitle: 'Official Data Subject Access Request (DSAR) Evidentiary Packet',
        exportType: 'DPDP Act 2023 / HIPAA § 164.524 / GDPR Article 15 Compliance Export',
        patientId: patient.id,
        patientFullName: patient.user.fullName,
        generatedAt: new Date().toISOString(),
        issuer: 'MediRoute India Pvt. Ltd. (Data Fiduciary)',
      },
      patientIdentity: {
        id: patient.id,
        fullName: patient.user.fullName,
        email: patient.user.email,
        phone: patient.user.phone,
        nationality: patient.nationality,
        bloodGroup: patient.bloodGroup,
        primaryLanguage: patient.primaryLanguage,
        memberSince: patient.user.createdAt,
      },
      medicalProfile: patient.medicalProfile,
      casesAndClinicalJourney: patient.cases,
      documentVaultSignatures: patient.documents,
      signedLegalConsentsAndProofs: patient.legalConsents,
      statutoryGrievances: patient.grievanceRecords,
      accountingOfDisclosures: auditDisclosures,
    };

    // Calculate whole-packet cryptographic SHA-256 seal
    const exportPacketHash = computeSha256(exportPacket);

    const finalPacket = {
      ...exportPacket,
      cryptographicIntegritySeal: {
        algorithm: 'SHA-256',
        digest: exportPacketHash,
        verifiedAt: new Date().toISOString(),
      },
    };

    // Audit the export action (Accounting of Disclosures)
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'PATIENT_DSAR_EXPORT_GENERATED',
      entityType: 'Patient',
      entityId: patient.id,
      newValue: {
        packetHash: exportPacketHash,
        consentsCount: patient.legalConsents.length,
        documentsCount: patient.documents.length,
      },
      route: '/api/v1/patient/privacy/export',
    });

    return new NextResponse(JSON.stringify(finalPacket, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="MediRoute-DSAR-Export-${patient.id}.json"`,
        'Cache-Control': 'private, no-cache, no-store',
      },
    });
  } catch (err) {
    console.error('Failed to generate DSAR export packet:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to generate privacy export', 500);
  }
}
