const mockPatientFindFirst = jest.fn();
const mockDocumentFindUnique = jest.fn();
const mockAuditLogCreate = jest.fn().mockResolvedValue({});

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patient: {
      findFirst: (...args: unknown[]) => mockPatientFindFirst(...args),
    },
    document: {
      findUnique: (...args: unknown[]) => mockDocumentFindUnique(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

import { NextRequest } from 'next/server';
import {
  validateUploadBuffer,
  canUserAccessPatientDocument,
  saveGeneratedBuffer,
  removeStoredFile,
  streamDocumentById,
} from '../document-storage.service';
import { SYSTEM_LIMITS } from '@/lib/constants';
import { POST as postPatientDocument } from '@/app/api/v1/patient/documents/route';

describe('document-storage.service', () => {
  it('accepts genuine PDF, JPEG, and PNG binary headers', () => {
    const pdfBuf = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj');
    const pdfRes = validateUploadBuffer(pdfBuf, 'report.pdf', 'application/pdf');
    expect(pdfRes.valid).toBe(true);
    if (pdfRes.valid) {
      expect(pdfRes.canonicalMime).toBe('application/pdf');
      expect(pdfRes.ext).toBe('.pdf');
    }

    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngRes = validateUploadBuffer(pngBuf, 'scan.png', 'image/png');
    expect(pngRes.valid).toBe(true);
    if (pngRes.valid) {
      expect(pngRes.canonicalMime).toBe('image/png');
      expect(pngRes.ext).toBe('.png');
    }

    const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpgRes = validateUploadBuffer(jpgBuf, 'photo.jpg', 'image/jpeg');
    expect(jpgRes.valid).toBe(true);
    if (jpgRes.valid) {
      expect(jpgRes.canonicalMime).toBe('image/jpeg');
      expect(jpgRes.ext).toBe('.jpg');
    }

    const jpegRes = validateUploadBuffer(jpgBuf, 'photo.JPEG', 'image/jpeg');
    expect(jpegRes.valid).toBe(true);
    if (jpegRes.valid) {
      expect(jpegRes.canonicalMime).toBe('image/jpeg');
      expect(jpegRes.ext).toBe('.jpeg');
    }
  });

  it('rejects HTML/SVG XSS payloads even when renamed to .pdf or .png', () => {
    const xssBuf = Buffer.from('<script>alert(document.cookie)</script>');
    expect(validateUploadBuffer(xssBuf, 'evil.pdf', 'application/pdf').valid).toBe(false);
    expect(validateUploadBuffer(xssBuf, 'evil.png', 'image/png').valid).toBe(false);
    expect(validateUploadBuffer(xssBuf, 'evil.svg', 'image/svg+xml').valid).toBe(false);
    expect(validateUploadBuffer(xssBuf, 'evil.html', 'text/html').valid).toBe(false);
  });

  it('rejects empty buffers, oversized files, and mismatched MIME types', () => {
    expect(validateUploadBuffer(Buffer.alloc(0), 'empty.pdf', 'application/pdf').valid).toBe(false);

    const oversized = Buffer.alloc(SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES + 1);
    oversized.write('%PDF-1.7', 0, 'ascii');
    expect(validateUploadBuffer(oversized, 'huge.pdf', 'application/pdf').valid).toBe(false);

    const pdfBuf = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj');
    expect(validateUploadBuffer(pdfBuf, 'report.pdf', '').valid).toBe(false);
    expect(validateUploadBuffer(pdfBuf, 'report.pdf', 'text/html').valid).toBe(false);
    expect(validateUploadBuffer(pdfBuf, 'report.jpg', 'image/jpeg').valid).toBe(false);
  });

  it('enforces strict patient/manager/doctor/admin object-level ownership', () => {
    const docContext = {
      patientUserId: 'pat-u1',
      assignedManagerId: 'mgr-1',
      caseManagerIds: ['mgr-1', 'mgr-case'],
      doctorUserIds: ['doc-u1'],
    };
    expect(canUserAccessPatientDocument({ userId: 'pat-u1', role: 'PATIENT', email: 'a@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'pat-u2', role: 'PATIENT', email: 'x@b.c' }, docContext)).toBe(false);
    expect(canUserAccessPatientDocument({ userId: 'mgr-1', role: 'MANAGER', email: 'm@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'mgr-case', role: 'MANAGER', email: 'mc@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'mgr-2', role: 'MANAGER', email: 'm2@b.c' }, docContext)).toBe(false);
    expect(canUserAccessPatientDocument({ userId: 'doc-u1', role: 'DOCTOR', email: 'd@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'doc-u2', role: 'DOCTOR', email: 'd2@b.c' }, docContext)).toBe(false);
    expect(canUserAccessPatientDocument({ userId: 'adm-1', role: 'ADMIN', email: 'ad@b.c' }, docContext)).toBe(true);
  });

  it('POST /api/v1/patient/documents rejects non-File string "file" multipart field with 400 BAD_REQUEST', async () => {
    mockPatientFindFirst.mockResolvedValue({ id: 'pat-1', userId: 'pat-u1' });

    const formData = new FormData();
    formData.append('file', 'not-a-file-string');
    formData.append('category', 'MEDICAL_REPORT');

    const req = new NextRequest('http://localhost/api/v1/patient/documents', {
      method: 'POST',
      headers: {
        'x-user-id': 'pat-u1',
        'x-user-role': 'PATIENT',
        'x-user-email': 'pat@medroute.test',
      },
      body: formData,
    });

    const res = await postPatientDocument(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BAD_REQUEST');
  });

  it('streamDocumentById permits active primaryDoctor (200) and rejects deactivated primaryDoctor (403)', async () => {
    const pdfBuf = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj');
    const saved = await saveGeneratedBuffer(pdfBuf, 'test_phi');

    try {
      mockDocumentFindUnique.mockResolvedValueOnce({
        id: 'doc-phi-1',
        fileName: 'cardiac-scan.pdf',
        mimeType: 'application/pdf',
        storageKey: saved.storageKey,
        fileUrl: '/api/v1/documents/doc-phi-1/download',
        category: 'MEDICAL_REPORT',
        patient: {
          userId: 'pat-u1',
          assignedManagerId: 'mgr-1',
          cases: [
            {
              managerId: 'mgr-1',
              primaryDoctor: { userId: 'doc-active-u1', isActive: true },
            },
          ],
          appointments: [],
        },
      });

      const allowedRes = await streamDocumentById(
        'doc-phi-1',
        { userId: 'doc-active-u1', role: 'DOCTOR', email: 'active@hospital.in' },
        '127.0.0.1'
      );
      expect(allowedRes.status).toBe(200);

      mockDocumentFindUnique.mockResolvedValueOnce({
        id: 'doc-phi-1',
        fileName: 'cardiac-scan.pdf',
        mimeType: 'application/pdf',
        storageKey: saved.storageKey,
        fileUrl: '/api/v1/documents/doc-phi-1/download',
        category: 'MEDICAL_REPORT',
        patient: {
          userId: 'pat-u1',
          assignedManagerId: 'mgr-1',
          cases: [
            {
              managerId: 'mgr-1',
              primaryDoctor: { userId: 'doc-inactive-u1', isActive: false },
            },
          ],
          appointments: [
            {
              doctor: { userId: 'doc-inactive-u1', isActive: false },
            },
          ],
        },
      });

      const deniedRes = await streamDocumentById(
        'doc-phi-1',
        { userId: 'doc-inactive-u1', role: 'DOCTOR', email: 'inactive@hospital.in' },
        '127.0.0.1'
      );
      expect(deniedRes.status).toBe(403);
    } finally {
      await removeStoredFile(saved.storageKey);
    }
  });
});

