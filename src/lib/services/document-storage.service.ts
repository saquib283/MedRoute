/**
 * Afzal Healthcare — Document Storage & Unified Streaming Service
 * Handles magic-byte upload hardening, decoupled storage keys,
 * multi-role object-level authorization, and HIPAA-audited streaming downloads.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  SYSTEM_LIMITS,
} from '@/lib/constants';
import type { AuthUser } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';

const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const LEGACY_PUBLIC_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SAFE_STREAM_MIME_TYPES = new Set<string>(ALLOWED_MIME_TYPES);

export type ValidateUploadResult =
  | { valid: true; canonicalMime: string; ext: string }
  | { valid: false; message: string };

export type SaveValidatedUploadResult =
  | { ok: true; storageKey: string; canonicalMime: string; fileSize: number }
  | { ok: false; message: string };

export interface PatientDocumentAccessContext {
  patientUserId: string;
  assignedManagerId: string | null;
  caseManagerIds: string[];
  doctorUserIds: string[];
}

/**
 * Validates an uploaded buffer by size, extension, declared MIME type, and binary magic bytes.
 */
export function validateUploadBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): ValidateUploadResult {
  if (buffer.length === 0) {
    return { valid: false, message: 'Uploaded file is empty' };
  }

  if (buffer.length > SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES) {
    return { valid: false, message: 'File size exceeds 25MB limit' };
  }

  const ext = path.extname(fileName || '').toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      valid: false,
      message: 'Unsupported file extension. Allowed: .jpg, .jpeg, .png, .pdf',
    };
  }

  const normalizedMime = (mimeType || '').toLowerCase().trim();
  if (
    !normalizedMime ||
    !(ALLOWED_MIME_TYPES as readonly string[]).includes(normalizedMime)
  ) {
    return {
      valid: false,
      message: 'Unsupported MIME type. Allowed: image/jpeg, image/png, application/pdf',
    };
  }

  let canonicalMime: string | null = null;

  if (ext === '.pdf') {
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      canonicalMime = 'application/pdf';
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      canonicalMime = 'image/jpeg';
    }
  } else if (ext === '.png') {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      canonicalMime = 'image/png';
    }
  }

  if (!canonicalMime) {
    return {
      valid: false,
      message: 'File content does not match its declared extension',
    };
  }

  if (normalizedMime && normalizedMime !== canonicalMime) {
    return {
      valid: false,
      message: 'Declared MIME type does not match file content',
    };
  }

  return { valid: true, canonicalMime, ext };
}

/**
 * Validates and persists an uploaded File to private storage using an opaque UUID storageKey.
 */
export async function saveValidatedUpload(
  file: File,
  prefix: 'doc' | 'bill' | 'cert'
): Promise<SaveValidatedUploadResult> {
  if (!file || file.size <= 0) {
    return { ok: false, message: 'Uploaded file is empty' };
  }

  if (file.size > SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: 'File size exceeds 25MB limit' };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const validation = validateUploadBuffer(buffer, file.name, file.type);
  if (!validation.valid) {
    return { ok: false, message: validation.message };
  }

  const storageKey = `${prefix}_${crypto.randomUUID()}${validation.ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, storageKey), buffer);

  return {
    ok: true,
    storageKey,
    canonicalMime: validation.canonicalMime,
    fileSize: buffer.length,
  };
}

/**
 * Persists a server-generated PDF buffer to private storage using an opaque UUID storageKey.
 */
export async function saveGeneratedBuffer(
  buffer: Buffer,
  prefix: string,
  extension: '.pdf' = '.pdf'
): Promise<{ storageKey: string; fileSize: number }> {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'cert';
  const storageKey = `${safePrefix}_${crypto.randomUUID()}${extension}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, storageKey), buffer);
  return { storageKey, fileSize: buffer.length };
}

/**
 * Safely deletes a stored file by storageKey, or legacy fileUrl when storageKey is absent.
 */
export async function removeStoredFile(
  storageKey: string | null | undefined,
  legacyFileUrl?: string | null
): Promise<void> {
  if (storageKey) {
    const safeName = path.basename(storageKey);
    if (!safeName || safeName === '.' || safeName === '..') return;
    await fs.unlink(path.join(UPLOAD_DIR, safeName)).catch(() => {});
    return;
  }

  if (legacyFileUrl && !legacyFileUrl.includes('?')) {
    const legacyName = path.basename(legacyFileUrl);
    if (!legacyName || legacyName === '.' || legacyName === '..') return;
    await fs
      .unlink(path.join(UPLOAD_DIR, legacyName))
      .catch(() => fs.unlink(path.join(LEGACY_PUBLIC_UPLOAD_DIR, legacyName)).catch(() => {}));
  }
}

/**
 * Enforces strict multi-role object-level access control for patient documents.
 */
export function canUserAccessPatientDocument(
  authUser: AuthUser,
  ctx: PatientDocumentAccessContext
): boolean {
  switch (authUser.role) {
    case 'ADMIN':
      return true;
    case 'PATIENT':
      return ctx.patientUserId === authUser.userId;
    case 'MANAGER':
      return (
        ctx.assignedManagerId === authUser.userId ||
        ctx.caseManagerIds.includes(authUser.userId)
      );
    case 'DOCTOR':
      return ctx.doctorUserIds.includes(authUser.userId);
    default:
      return false;
  }
}

function resolveDiskFilename(
  storageKey: string | null | undefined,
  legacyFileUrl: string | null | undefined
): string | null {
  if (storageKey) {
    const name = path.basename(storageKey);
    return name && name !== '.' && name !== '..' ? name : null;
  }

  if (!legacyFileUrl) return null;

  const queryIndex = legacyFileUrl.indexOf('?');
  if (queryIndex !== -1) {
    const params = new URLSearchParams(legacyFileUrl.slice(queryIndex + 1));
    const fileParam = params.get('file');
    if (!fileParam) return null;
    const name = path.basename(fileParam);
    return name && name !== '.' && name !== '..' ? name : null;
  }

  const name = path.basename(legacyFileUrl);
  return name && name !== '.' && name !== '..' ? name : null;
}

async function readStoredFileBuffer(
  filename: string,
  allowLegacyPublicFallback: boolean
): Promise<Buffer | null> {
  const primaryPath = path.join(UPLOAD_DIR, filename);
  try {
    return await fs.readFile(primaryPath);
  } catch {
    if (!allowLegacyPublicFallback) return null;
    try {
      return await fs.readFile(path.join(LEGACY_PUBLIC_UPLOAD_DIR, filename));
    } catch {
      return null;
    }
  }
}

function getSafeContentType(mimeType: string | null | undefined): string {
  if (mimeType && SAFE_STREAM_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }
  return 'application/octet-stream';
}

function inferSafeMimeFromFilename(filename: string | null | undefined): string {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function buildDownloadResponse(
  fileBuffer: Buffer,
  contentType: string,
  fileName: string
): NextResponse {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fileName)}"`
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers,
  });
}

/**
 * Authorizes, reads from private storage, audit-logs, and streams a patient Document.
 */
export async function streamDocumentById(
  docId: string,
  authUser: AuthUser,
  ipAddress?: string
): Promise<NextResponse> {
  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      patient: {
        include: {
          cases: { select: { managerId: true } },
          appointments: {
            where: { status: { not: 'CANCELLED' } },
            include: { doctor: { select: { userId: true } } },
          },
        },
      },
    },
  });

  if (!document) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Document not found', 404);
  }

  const caseManagerIds = document.patient.cases
    .map((c) => c.managerId)
    .filter((id): id is string => Boolean(id));
  const doctorUserIds = document.patient.appointments
    .map((a) => a.doctor.userId)
    .filter((id): id is string => Boolean(id));

  const authorized = canUserAccessPatientDocument(authUser, {
    patientUserId: document.patient.userId,
    assignedManagerId: document.patient.assignedManagerId,
    caseManagerIds,
    doctorUserIds,
  });

  if (!authorized) {
    return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
  }

  const diskFilename = resolveDiskFilename(document.storageKey, document.fileUrl);
  if (!diskFilename) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Physical file not found', 404);
  }

  const fileBuffer = await readStoredFileBuffer(diskFilename, !document.storageKey);
  if (!fileBuffer) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Physical file not found', 404);
  }

  void createAuditLog({
    actorId: authUser.userId,
    action: AUDIT_ACTIONS.DOWNLOAD_DOCUMENT,
    entityType: 'Document',
    entityId: document.id,
    newValue: { fileName: document.fileName, category: document.category },
    ipAddress,
  });

  return buildDownloadResponse(
    fileBuffer,
    getSafeContentType(document.mimeType),
    document.fileName
  );
}

/**
 * Authorizes, reads from private storage, audit-logs, and streams a MedicalBill invoice.
 */
export async function streamBillInvoiceById(
  billId: string,
  authUser: AuthUser,
  ipAddress?: string
): Promise<NextResponse> {
  const bill = await prisma.medicalBill.findUnique({
    where: { id: billId },
    include: {
      patient: true,
      case: true,
    },
  });

  if (!bill) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Medical bill not found', 404);
  }

  let authorized = false;
  if (authUser.role === 'ADMIN') {
    authorized = true;
  } else if (authUser.role === 'PATIENT') {
    authorized = bill.patient.userId === authUser.userId;
  } else if (authUser.role === 'MANAGER') {
    authorized =
      bill.case.managerId === authUser.userId ||
      bill.patient.assignedManagerId === authUser.userId;
  }

  if (!authorized) {
    return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to medical bill', 403);
  }

  const diskFilename = resolveDiskFilename(bill.storageKey, bill.fileUrl);
  if (!diskFilename) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Physical file not found', 404);
  }

  const fileBuffer = await readStoredFileBuffer(diskFilename, !bill.storageKey);
  if (!fileBuffer) {
    return apiError(ERROR_CODES.NOT_FOUND, 'Physical file not found', 404);
  }

  const displayName = bill.fileName || `${bill.billNumber}${path.extname(diskFilename) || '.pdf'}`;

  void createAuditLog({
    actorId: authUser.userId,
    action: AUDIT_ACTIONS.DOWNLOAD_DOCUMENT,
    entityType: 'MedicalBill',
    entityId: bill.id,
    newValue: { fileName: displayName, billNumber: bill.billNumber },
    ipAddress,
  });

  return buildDownloadResponse(
    fileBuffer,
    inferSafeMimeFromFilename(diskFilename),
    displayName
  );
}

