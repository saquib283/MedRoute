/**
 * Afzal Healthcare — Multi-Page PDF Stream OCR Medical Bill Extraction API
 * POST /api/v1/manager/billing/ocr — Validate uploaded invoices/scans and extract itemized lines.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { validateUploadBuffer } from '@/lib/services/document-storage.service';
import {
  parseMultiPageMedicalBillOcr,
  type OcrInputFile,
} from '@/lib/services/billing-ocr.service';

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser!.role !== 'MANAGER' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Manager or Admin access required', 403);
    }

    const formData = await request.formData();
    const rawFiles = formData.getAll('files');
    const singleFile = formData.get('file');

    const filesToProcess: File[] = [];
    for (const entry of rawFiles) {
      if (entry instanceof File && entry.size > 0) {
        filesToProcess.push(entry);
      }
    }
    if (filesToProcess.length === 0 && singleFile instanceof File && singleFile.size > 0) {
      filesToProcess.push(singleFile);
    }

    if (filesToProcess.length === 0) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Please upload one or more valid medical bill page files to scan',
        400
      );
    }

    const preparedFiles: OcrInputFile[] = [];
    for (const file of filesToProcess) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = validateUploadBuffer(buffer, file.name, file.type);
      if (!validation.valid) {
        return apiError(ERROR_CODES.BAD_REQUEST, validation.message, 400);
      }
      preparedFiles.push({
        name: file.name,
        type: validation.canonicalMime,
        buffer,
      });
    }

    const result = parseMultiPageMedicalBillOcr(preparedFiles);

    return apiSuccess({ ocr: result });
  } catch (err) {
    console.error('[Multi-Page OCR Billing Route Error]', err);
    return apiError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to process multi-page document with OCR engine',
      500
    );
  }
}
