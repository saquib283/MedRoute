/**
 * Afzal Healthcare — Patient Documents API Endpoint
 * GET /api/v1/patient/documents — List all documents
 * POST /api/v1/patient/documents — Upload new document (validated & stored privately)
 * DELETE /api/v1/patient/documents?id=... — Delete a document
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import {
  removeStoredFile,
  saveValidatedUpload,
} from '@/lib/services/document-storage.service';
import type { DocumentCategory } from '@prisma/client';

const PATIENT_UPLOAD_CATEGORIES = [
  'PASSPORT',
  'VISA',
  'MEDICAL_REPORT',
  'PRESCRIPTION',
  'INSURANCE',
  'FRRO_REGISTRATION',
] as const;

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    // Locate patient
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    const documents = await prisma.document.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ documents });
  } catch (err) {
    console.error('[Patient Documents GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch documents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    // Locate patient
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    // Parse form data
    const formData = await request.formData();
    const rawFile = formData.get('file');
    const file = rawFile instanceof File ? rawFile : null;
    const rawCategory = formData.get('category');
    const categoryRaw = typeof rawCategory === 'string' ? rawCategory : null;

    if (!file || !categoryRaw) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'File and category are required', 400);
    }

    if (
      !(PATIENT_UPLOAD_CATEGORIES as readonly string[]).includes(categoryRaw)
    ) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid document category', 400);
    }

    const category = categoryRaw as DocumentCategory;

    const saved = await saveValidatedUpload(file, 'doc');
    if (!saved.ok) {
      return apiError(ERROR_CODES.BAD_REQUEST, saved.message, 400);
    }

    // Create database document record preserving storageKey
    let document;
    try {
      document = await prisma.document.create({
        data: {
          patientId: patient.id,
          uploadedBy: authUser!.userId,
          category,
          fileUrl: '',
          storageKey: saved.storageKey,
          fileName: file.name,
          fileSize: saved.fileSize,
          mimeType: saved.canonicalMime,
        },
      });
    } catch (dbErr) {
      await removeStoredFile(saved.storageKey);
      throw dbErr;
    }

    // Update fileUrl to point to unified authenticated download API
    const downloadUrl = `/api/v1/documents/${document.id}/download`;
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: { fileUrl: downloadUrl },
    });

    return apiSuccess({ document: updatedDocument });
  } catch (err) {
    console.error('[Patient Documents POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to upload document', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Document ID is required', 400);
    }

    // Fetch document details
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!document) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Document not found', 404);
    }

    // Enforce strict role & ownership checks
    if (authUser!.role === 'PATIENT') {
      if (document.patient.userId !== authUser!.userId) {
        return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
      }
      if (
        document.verificationStatus === 'VERIFIED' ||
        document.verificationStatus === 'ISSUED_BY_HOSPITAL'
      ) {
        return apiError(
          ERROR_CODES.FORBIDDEN,
          'Verified or hospital-issued documents cannot be deleted',
          403
        );
      }
    } else if (authUser!.role === 'MANAGER') {
      if (document.patient.assignedManagerId !== authUser!.userId) {
        return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
      }
    } else if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
    }

    // Delete physical file on disk
    await removeStoredFile(document.storageKey, document.fileUrl);

    // Delete database record
    await prisma.document.delete({
      where: { id },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'Document',
      entityId: document.id,
      oldValue: {
        fileName: document.fileName,
        category: document.category,
        verificationStatus: document.verificationStatus,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('[Patient Documents DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to delete document', 500);
  }
}
