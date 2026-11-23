/**
 * Afzal Healthcare — Clinical Certificate PDF Generator, Document Verification,
 * Hospital Certificate Issuance & Fit-to-Fly Clearance Service
 */

import { z } from 'zod';
import type { DocumentCategory } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import {
  authorizeCaseClinicalAccess,
  type ServiceResult,
} from '@/lib/services/clinical-pathway.service';
import {
  removeStoredFile,
  saveGeneratedBuffer,
  saveValidatedUpload,
} from '@/lib/services/document-storage.service';

export const MANAGER_ISSUE_CATEGORIES = [
  'VISA_INVITATION_LETTER',
  'PROFORMA_INVOICE',
  'MEDICAL_OPINION',
  'FRRO_REGISTRATION',
] as const;

export const DOCTOR_ISSUE_CATEGORIES = [
  'FIT_TO_FLY_CERTIFICATE',
  'MEDICAL_OPINION',
  'PRESCRIPTION',
  'MEDICAL_REPORT',
] as const;

export const ALL_ISSUE_CATEGORIES = [
  'VISA_INVITATION_LETTER',
  'PROFORMA_INVOICE',
  'MEDICAL_OPINION',
  'FRRO_REGISTRATION',
  'FIT_TO_FLY_CERTIFICATE',
  'PRESCRIPTION',
  'MEDICAL_REPORT',
] as const;

type IssuableCategory = (typeof ALL_ISSUE_CATEGORIES)[number];

const CATEGORY_STEP_ACTION_MAP: Partial<Record<IssuableCategory, string>> = {
  VISA_INVITATION_LETTER: 'ISSUE_VIL',
  PROFORMA_INVOICE: 'ISSUE_PROFORMA',
  FIT_TO_FLY_CERTIFICATE: 'SIGN_FIT_TO_FLY',
};

const verifyDocumentSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  verificationNotes: z.string().max(1000).nullable().optional(),
});

const upsertFitToFlySchema = z.object({
  isCleared: z.boolean(),
  restrictions: z.string().max(2000).nullable().optional(),
  reEvalDate: z.string().nullable().optional(),
});

export interface CertificatePdfInput {
  title: string;
  category: string;
  patientName: string;
  nationality?: string | null;
  caseId: string;
  issuedByName: string;
  issuedByRole: string;
  issuedAt?: Date;
  bodyLines: string[];
}

export interface VerifyDocumentParams {
  documentId: string;
  verificationStatus: unknown;
  verificationNotes?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface IssueCaseDocumentParams {
  caseId: string;
  category: unknown;
  file?: File | null;
  notes?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface UpsertFitToFlyParams {
  caseId: string;
  isCleared: unknown;
  restrictions?: unknown;
  reEvalDate?: unknown;
  file?: File | null;
  actor: { userId: string; role: string; ipAddress?: string };
}

/**
 * Normalize text to printable ASCII and escape PDF string literals.
 */
export function escapePdfText(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, '?');
  return ascii
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars: number = 82): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [''];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build a deterministic, dependency-free 5-object %PDF-1.4 A4 clinical certificate buffer.
 */
export function generateClinicalCertificatePdf(input: CertificatePdfInput): Buffer {
  const issuedAt = (input.issuedAt ?? new Date()).toISOString();
  const wrappedBody = input.bodyLines.flatMap((line) => wrapLine(line, 80));

  const streamOps: string[] = [
    'BT',
    '/F1 14 Tf',
    '50 785 Td',
    `(${escapePdfText('AFZAL HEALTHCARE - OFFICIAL CLINICAL CERTIFICATE')}) Tj`,
    '0 -22 Td',
    '/F1 12 Tf',
    `(${escapePdfText(input.title)}) Tj`,
    '0 -20 Td',
    '/F1 10 Tf',
    `(${escapePdfText(`Category: ${input.category}`)}) Tj`,
    '0 -16 Td',
    `(${escapePdfText(`Case ID: ${input.caseId}`)}) Tj`,
    '0 -16 Td',
    `(${escapePdfText(`Patient Name: ${input.patientName}`)}) Tj`,
    '0 -16 Td',
    `(${escapePdfText(`Nationality: ${input.nationality || 'International'}`)}) Tj`,
    '0 -16 Td',
    `(${escapePdfText(`Issued By: ${input.issuedByName} (${input.issuedByRole})`)}) Tj`,
    '0 -16 Td',
    `(${escapePdfText(`Issuance Date (UTC): ${issuedAt}`)}) Tj`,
    '0 -24 Td',
    `(${escapePdfText('--------------------------------------------------------------------------')}) Tj`,
  ];

  for (const bodyLine of wrappedBody.slice(0, 32)) {
    streamOps.push('0 -15 Td');
    streamOps.push(`(${escapePdfText(bodyLine)}) Tj`);
  }

  streamOps.push('0 -28 Td');
  streamOps.push(
    `(${escapePdfText('Verified by Afzal Healthcare Clinical Operations Portal')}) Tj`
  );
  streamOps.push('ET');

  const streamContent = streamOps.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'ascii');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  const header = '%PDF-1.4\n';
  const chunks: string[] = [header];
  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, 'ascii');

  for (const obj of objects) {
    offsets.push(currentOffset);
    chunks.push(obj);
    currentOffset += Buffer.byteLength(obj, 'ascii');
  }

  const xrefOffset = currentOffset;
  const xrefLines = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
  ];
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  chunks.push(...xrefLines, trailer);
  return Buffer.from(chunks.join(''), 'ascii');
}

function getDefaultBodyLines(
  category: IssuableCategory,
  patientName: string,
  nationality: string | null | undefined,
  notes: string | null
): string[] {
  const originLabel = nationality ? ` (${nationality})` : '';
  const defaults: Record<IssuableCategory, string[]> = {
    VISA_INVITATION_LETTER: [
      `This official Visa Invitation Letter (VIL) confirms medical travel sponsorship for ${patientName}${originLabel}.`,
      'The patient is scheduled for specialized clinical evaluation and treatment under Afzal Healthcare partner hospital supervision.',
    ],
    PROFORMA_INVOICE: [
      `Official Pro-Forma Treatment Cost Estimate issued for ${patientName}${originLabel}.`,
      'Covers estimated procedural, inpatient accommodation, and clinical coordinator support.',
    ],
    MEDICAL_OPINION: [
      `Official Hospital Medical Opinion summary issued for ${patientName}${originLabel}.`,
      'Prepared following clinical record review by the assigned specialist team.',
    ],
    FRRO_REGISTRATION: [
      `FRRO Medical Visa Registration & Extension Support Certificate for ${patientName}${originLabel}.`,
      'Confirms ongoing inpatient/outpatient clinical care in India.',
    ],
    FIT_TO_FLY_CERTIFICATE: [
      `Medical Fit-to-Fly Clearance Certificate for ${patientName}${originLabel}.`,
      'Clinical examination confirms the patient meets fitness criteria for commercial air travel subject to listed restrictions.',
    ],
    PRESCRIPTION: [
      `Official Outpatient Discharge & Medication Prescription for ${patientName}${originLabel}.`,
    ],
    MEDICAL_REPORT: [
      `Official Clinical Diagnostic & Procedure Report for ${patientName}${originLabel}.`,
    ],
  };

  const lines = [...defaults[category]];
  if (notes) {
    lines.push(`Clinical / Coordinator Notes: ${notes}`);
  }
  return lines;
}

/**
 * Verify or reject a patient-uploaded document (ADMIN or assigned MANAGER only).
 */
export async function verifyPatientDocument(
  params: VerifyDocumentParams
): Promise<ServiceResult<{ document: unknown }>> {
  if (params.actor.role !== 'ADMIN' && params.actor.role !== 'MANAGER') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only admins or assigned managers can verify patient documents',
      status: 403,
    };
  }

  const parsed = verifyDocumentSchema.safeParse({
    verificationStatus: params.verificationStatus,
    verificationNotes: params.verificationNotes,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid verification payload',
      status: 400,
    };
  }

  const trimmedNotes = parsed.data.verificationNotes?.trim() || null;
  if (parsed.data.verificationStatus === 'REJECTED' && !trimmedNotes) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Verification notes are required when rejecting a document',
      status: 400,
    };
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: {
      patient: {
        select: {
          id: true,
          assignedManagerId: true,
          cases: { select: { managerId: true } },
        },
      },
    },
  });

  if (!doc) {
    return {
      ok: false,
      code: ERROR_CODES.DOCUMENT_NOT_FOUND,
      message: 'Document not found',
      status: 404,
    };
  }

  if (params.actor.role === 'MANAGER') {
    const isAssigned =
      doc.patient.assignedManagerId === params.actor.userId ||
      doc.patient.cases.some((c) => c.managerId === params.actor.userId);
    if (!isAssigned) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied: manager is not assigned to this patient',
        status: 403,
      };
    }
  }

  if (doc.verificationStatus === 'ISSUED_BY_HOSPITAL') {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Hospital-issued certificates cannot be modified via verification',
      status: 400,
    };
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      verificationStatus: parsed.data.verificationStatus,
      verificationNotes: trimmedNotes,
      verifiedBy: params.actor.userId,
      verifiedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.VERIFY_DOCUMENT,
    entityType: 'Document',
    entityId: doc.id,
    oldValue: {
      verificationStatus: doc.verificationStatus,
      verificationNotes: doc.verificationNotes,
    },
    newValue: {
      verificationStatus: updated.verificationStatus,
      verificationNotes: updated.verificationNotes,
    },
    ipAddress: params.actor.ipAddress,
  });

  return { ok: true, data: { document: updated } };
}

/**
 * List all patient documents associated with a clinical case (staff viewers only).
 */
export async function listCaseDocuments(
  caseId: string,
  actor: { userId: string; role: string }
): Promise<ServiceResult<{ documents: unknown[] }>> {
  if (!['ADMIN', 'MANAGER', 'DOCTOR'].includes(actor.role)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Patients must use /api/v1/patient/documents to view documents',
      status: 403,
    };
  }

  const access = await authorizeCaseClinicalAccess(caseId, actor);
  if (!access.ok) return access;

  const documents = await prisma.document.findMany({
    where: { patientId: access.targetCase.patientId },
    orderBy: { createdAt: 'desc' },
  });

  return { ok: true, data: { documents } };
}

/**
 * Issue an official hospital/clinical document for a case, either storing a validated upload
 * or deterministically generating a valid %PDF-1.4 certificate in private storage.
 */
export async function issueCaseDocument(
  params: IssueCaseDocumentParams
): Promise<ServiceResult<{ document: unknown }>> {
  if (!['ADMIN', 'MANAGER', 'DOCTOR'].includes(params.actor.role)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only clinical staff or admins can issue case documents',
      status: 403,
    };
  }

  if (
    typeof params.category !== 'string' ||
    !(ALL_ISSUE_CATEGORIES as readonly string[]).includes(params.category)
  ) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Invalid document issuance category',
      status: 400,
    };
  }

  const category = params.category as IssuableCategory;

  const allowedForRole: readonly string[] =
    params.actor.role === 'MANAGER'
      ? MANAGER_ISSUE_CATEGORIES
      : params.actor.role === 'DOCTOR'
        ? DOCTOR_ISSUE_CATEGORIES
        : ALL_ISSUE_CATEGORIES;

  if (!allowedForRole.includes(category)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: `${params.actor.role} role is not permitted to issue ${category}`,
      status: 403,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot issue documents for a closed case',
      status: 400,
    };
  }

  const cleanNotes =
    typeof params.notes === 'string' && params.notes.trim()
      ? params.notes.trim().slice(0, 2000)
      : null;

  let issuedByName = 'Afzal Clinical Staff';
  let issuedByRole = 'Coordinator';
  if (params.actor.role === 'DOCTOR') {
    issuedByName = formatDoctorDisplayName(access.doctorProfile?.fullName || '');
    issuedByRole = 'Treating Physician';
  } else {
    const actorUser = await prisma.user.findUnique({
      where: { id: params.actor.userId },
      select: { fullName: true },
    });
    issuedByName =
      actorUser?.fullName ||
      (params.actor.role === 'ADMIN' ? 'Hospital Administrator' : 'Case Manager');
    issuedByRole = params.actor.role === 'ADMIN' ? 'Hospital Administrator' : 'Case Manager';
  }

  let storageKey: string;
  let fileSize: number;
  let fileName: string;
  let mimeType: string;

  if (params.file) {
    const saved = await saveValidatedUpload(params.file, 'cert');
    if (!saved.ok) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: saved.message,
        status: 400,
      };
    }
    storageKey = saved.storageKey;
    fileSize = saved.fileSize;
    fileName = params.file.name;
    mimeType = saved.canonicalMime;
  } else {
    const title = DOCUMENT_CATEGORY_LABELS[category] || category;
    const patientName = access.targetCase.patient.user?.fullName || 'Patient';
    const pdfBuffer = generateClinicalCertificatePdf({
      title,
      category,
      patientName,
      nationality: access.targetCase.patient.nationality,
      caseId: params.caseId,
      issuedByName,
      issuedByRole,
      bodyLines: getDefaultBodyLines(
        category,
        patientName,
        access.targetCase.patient.nationality,
        cleanNotes
      ),
    });
    const savedPdf = await saveGeneratedBuffer(pdfBuffer, 'cert', '.pdf');
    storageKey = savedPdf.storageKey;
    fileSize = savedPdf.fileSize;
    fileName = `${category.toLowerCase()}_${params.caseId}.pdf`;
    mimeType = 'application/pdf';
  }

  let createdDoc: { id: string };
  try {
    createdDoc = await prisma.document.create({
      data: {
        patientId: access.targetCase.patientId,
        uploadedBy: params.actor.userId,
        category: category as DocumentCategory,
        fileUrl: '',
        storageKey,
        fileName,
        fileSize,
        mimeType,
        verificationStatus: 'ISSUED_BY_HOSPITAL',
        verifiedBy: params.actor.userId,
        verificationNotes: cleanNotes,
        verifiedAt: new Date(),
      },
    });
  } catch (err) {
    await removeStoredFile(storageKey);
    throw err;
  }

  const updatedDoc = await prisma.document.update({
    where: { id: createdDoc.id },
    data: { fileUrl: `/api/v1/documents/${createdDoc.id}/download` },
  });

  const stepActionType = CATEGORY_STEP_ACTION_MAP[category];
  if (stepActionType) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: stepActionType,
        status: { not: 'COMPLETED' },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.ISSUE_DOCUMENT,
    entityType: 'Document',
    entityId: updatedDoc.id,
    newValue: {
      caseId: params.caseId,
      category,
      fileName,
      generatedPdf: !params.file,
    },
    ipAddress: params.actor.ipAddress,
  });

  return { ok: true, data: { document: updatedDoc } };
}

/**
 * Retrieve FitToFlyClearance and the latest issued FIT_TO_FLY_CERTIFICATE document for a case.
 */
export async function getCaseFitToFly(
  caseId: string,
  actor: { userId: string; role: string }
): Promise<ServiceResult<{ fitToFlyClearance: unknown; certificateDocument: unknown | null }>> {
  const access = await authorizeCaseClinicalAccess(caseId, actor);
  if (!access.ok) return access;

  const fitToFlyClearance = access.targetCase.fitToFlyClearance ?? null;
  const certificateDocument = fitToFlyClearance?.isCleared
    ? await prisma.document.findFirst({
        where: {
          patientId: access.targetCase.patientId,
          category: 'FIT_TO_FLY_CERTIFICATE',
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  return {
    ok: true,
    data: {
      fitToFlyClearance,
      certificateDocument: certificateDocument ?? null,
    },
  };
}

/**
 * Certify or update Fit-to-Fly clearance (treating DOCTOR or ADMIN only),
 * issuing a downloadable PDF certificate and advancing Case status when cleared.
 */
export async function upsertCaseFitToFly(
  params: UpsertFitToFlyParams
): Promise<
  ServiceResult<{
    fitToFlyClearance: unknown;
    certificateDocument: unknown | null;
    caseStatus: string;
  }>
> {
  if (params.actor.role !== 'DOCTOR' && params.actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the treating doctor or admin can certify Fit-to-Fly clearance',
      status: 403,
    };
  }

  const parsed = upsertFitToFlySchema.safeParse({
    isCleared: params.isCleared,
    restrictions: params.restrictions,
    reEvalDate: params.reEvalDate,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid Fit-to-Fly clearance payload',
      status: 400,
    };
  }

  let parsedReEvalDate: Date | null = null;
  if (parsed.data.reEvalDate) {
    const dt = new Date(parsed.data.reEvalDate);
    if (Number.isNaN(dt.getTime())) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Invalid re-evaluation date',
        status: 400,
      };
    }
    parsedReEvalDate = dt;
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot modify Fit-to-Fly clearance on a closed case',
      status: 400,
    };
  }

  let clearedBy: string;
  if (params.actor.role === 'DOCTOR') {
    clearedBy = formatDoctorDisplayName(access.doctorProfile?.fullName || '');
  } else {
    const adminUser = await prisma.user.findUnique({
      where: { id: params.actor.userId },
      select: { fullName: true },
    });
    clearedBy = adminUser?.fullName || 'Hospital Administrator';
  }

  const cleanRestrictions = parsed.data.restrictions?.trim() || null;
  const clearanceDate = parsed.data.isCleared ? new Date() : null;

  let certificateDocument: unknown | null = null;
  let caseStatus: string = access.targetCase.status;

  if (parsed.data.isCleared) {
    const issued = await issueCaseDocument({
      caseId: params.caseId,
      category: 'FIT_TO_FLY_CERTIFICATE',
      file: params.file,
      notes: cleanRestrictions,
      actor: params.actor,
    });
    if (!issued.ok) return issued;
    certificateDocument = issued.data.document;
  }

  const fitToFlyClearance = await prisma.fitToFlyClearance.upsert({
    where: { caseId: params.caseId },
    create: {
      caseId: params.caseId,
      isCleared: parsed.data.isCleared,
      clearedBy,
      clearanceDate,
      restrictions: cleanRestrictions,
      reEvalDate: parsedReEvalDate,
    },
    update: {
      isCleared: parsed.data.isCleared,
      clearedBy,
      clearanceDate,
      restrictions: cleanRestrictions,
      reEvalDate: parsedReEvalDate,
    },
  });

  if (parsed.data.isCleared) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'SIGN_FIT_TO_FLY',
      },
      data: {
        status: 'COMPLETED',
        decisionBranch: 'FIT_TO_FLY_GRANTED',
        completedAt: new Date(),
      },
    });

    if (access.targetCase.status !== 'REMOTE_REHAB') {
      const updatedCase = await prisma.case.update({
        where: { id: params.caseId },
        data: { status: 'FIT_TO_FLY_CLEARED' },
      });
      caseStatus = updatedCase.status;
    }
  } else {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'SIGN_FIT_TO_FLY',
      },
      data: {
        status: 'ACTION_REQUIRED',
        decisionBranch: null,
        completedAt: null,
      },
    });

    if (access.targetCase.status === 'FIT_TO_FLY_CLEARED') {
      const updatedCase = await prisma.case.update({
        where: { id: params.caseId },
        data: { status: 'OUTPATIENT_RECUPERATION' },
      });
      caseStatus = updatedCase.status;
    }
  }

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.SIGN_FIT_TO_FLY,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: access.targetCase.fitToFlyClearance,
    newValue: {
      isCleared: parsed.data.isCleared,
      clearedBy,
      restrictions: cleanRestrictions,
      caseStatus,
    },
    ipAddress: params.actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      fitToFlyClearance,
      certificateDocument,
      caseStatus,
    },
  };
}
