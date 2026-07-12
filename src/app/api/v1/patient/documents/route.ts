/**
 * MediRoute India — Patient Documents API Endpoint
 * GET /api/v1/patient/documents — List all documents
 * POST /api/v1/patient/documents — Upload new document (saves to public/uploads)
 * DELETE /api/v1/patient/documents?id=... — Delete a document
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { promises as fs } from 'fs';
import path from 'path';
import type { DocumentCategory } from '@prisma/client';

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
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as DocumentCategory | null;

    if (!file || !category) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'File and category are required', 400);
    }

    // Validate file size (e.g. 25MB limit)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'File size exceeds 25MB limit', 400);
    }

    // Write file to local disk under public/uploads
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize and create safe filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${safeName}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;

    // Create database document record
    const document = await prisma.document.create({
      data: {
        patientId: patient.id,
        uploadedBy: authUser!.userId,
        category,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      },
    });

    return apiSuccess({ document });
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

    // Check ownership (only the patient who owns the file, or their assigned manager/admin can delete)
    if (document.patient.userId !== authUser!.userId && authUser!.role === 'PATIENT') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Unauthorized access to document', 403);
    }

    // Delete physical file on disk
    try {
      const filename = path.basename(document.fileUrl);
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
      await fs.unlink(filePath);
    } catch (err) {
      console.warn('Physical file not found or failed to delete', err);
    }

    // Delete database record
    await prisma.document.delete({
      where: { id },
    });

    return apiSuccess({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('[Patient Documents DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to delete document', 500);
  }
}
