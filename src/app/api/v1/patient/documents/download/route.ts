/**
 * Afzal Healthcare — Authenticated Document Download Endpoint
 * GET /api/v1/patient/documents/download?id=...
 * Enforces HIPAA authentication and authorization checks before serving ePHI documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Document ID is required', 400);
    }

    // Fetch document details including patient user association
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!document) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Document not found', 404);
    }

    // Access control:
    // 1. Patient can access only their own documents
    // 2. Assigned Manager, Admins, and Doctors can access
    if (authUser!.role === 'PATIENT' && document.patient.userId !== authUser!.userId) {
      return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
    }

    // Resolve physical file location (check storage/uploads first, fallback to public/uploads)
    const filename = path.basename(document.fileUrl);
    let filePath = path.join(process.cwd(), 'storage', 'uploads', filename);

    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      // Fallback check in public/uploads for legacy uploads
      const legacyPath = path.join(process.cwd(), 'public', 'uploads', filename);
      const legacyExists = await fs
        .access(legacyPath)
        .then(() => true)
        .catch(() => false);

      if (legacyExists) {
        filePath = legacyPath;
      } else {
        return apiError(ERROR_CODES.NOT_FOUND, 'Physical file not found', 404);
      }
    }

    const fileBuffer = await fs.readFile(filePath);

    // Create Audit Log entry for ePHI document access (HIPAA § 164.312(b))
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'DOWNLOAD_DOCUMENT',
      entityType: 'Document',
      entityId: document.id,
      newValue: { fileName: document.fileName, category: document.category },
    });

    const headers = new Headers();
    headers.set('Content-Type', document.mimeType || 'application/octet-stream');
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(document.fileName)}"`
    );
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[Document Download GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to download document', 500);
  }
}
