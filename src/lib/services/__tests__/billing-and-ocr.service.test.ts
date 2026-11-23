import zlib from 'zlib';
import { NextRequest } from 'next/server';
import { generateClinicalCertificatePdf } from '@/lib/services/clinical-certificate.service';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    hospital: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    medicalBill: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    clinicalStep: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  deriveBillStatus,
  getManagerBillingMetadata,
  updateMedicalBill,
  payPatientMedicalBill,
} from '@/lib/services/billing.service';
import {
  extractTextFromPdfBuffer,
  parseMultiPageMedicalBillOcr,
} from '@/lib/services/billing-ocr.service';
import {
  GET as managerBillingGet,
  POST as managerBillingPost,
  PATCH as managerBillingPatch,
} from '@/app/api/v1/manager/billing/route';
import { POST as managerBillingOcrPost } from '@/app/api/v1/manager/billing/ocr/route';
import { POST as patientBillingPayPost } from '@/app/api/v1/patient/billing/pay/route';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  hospital: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  medicalBill: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

function makeAuthHeaders(userId: string, role: string, email = 'user@example.com') {
  return {
    'x-user-id': userId,
    'x-user-role': role,
    'x-user-email': email,
  };
}

function buildFlatePdf(streamContent: string): Buffer {
  const compressed = zlib.deflateSync(Buffer.from(streamContent, 'latin1'));
  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>\nendobj\n';
  const obj4Prefix = `4 0 obj\n<< /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`;
  const obj4Suffix = '\nendstream\nendobj\n';
  return Buffer.concat([
    Buffer.from(header + obj1 + obj2 + obj3 + obj4Prefix, 'latin1'),
    compressed,
    Buffer.from(obj4Suffix + '%%EOF', 'latin1'),
  ]);
}

describe('Task 1: Billing Service, Dual Settlement & Real PDF Stream OCR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives consistent bill statuses from totalAmount, paidAmount, and requestedStatus', () => {
    expect(deriveBillStatus(2000, 0)).toBe('PENDING');
    expect(deriveBillStatus(2000, 500)).toBe('PARTIALLY_PAID');
    expect(deriveBillStatus(2000, 500, 'OVERDUE')).toBe('OVERDUE');
    expect(deriveBillStatus(2000, 2000)).toBe('PAID');
    expect(deriveBillStatus(2000, 0, 'CANCELLED')).toBe('CANCELLED');
  });

  it('scopes getManagerBillingMetadata cases to assigned manager while giving ADMIN all open cases', async () => {
    mockedPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        patientId: 'pat-1',
        status: 'IN_TREATMENT',
        patient: { id: 'pat-1', user: { fullName: 'Tariq Al-Said', email: 't@example.com' } },
      },
    ]);
    mockedPrisma.hospital.findMany.mockResolvedValue([
      { id: 'hosp-1', name: 'Apollo Hospital', city: 'New Delhi' },
    ]);

    const mgrMeta = await getManagerBillingMetadata({ userId: 'mgr-1', role: 'MANAGER' });
    expect(mockedPrisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' }, managerId: 'mgr-1' },
      })
    );
    expect(mgrMeta.hospitals).toHaveLength(1);

    await getManagerBillingMetadata({ userId: 'adm-1', role: 'ADMIN' });
    expect(mockedPrisma.case.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' } },
      })
    );
  });

  it('enforces manager ownership and overpayment bounds inside $transaction on updateMedicalBill, preserves undefined on omitted nullable fields, and auto-completes SETTLE_BILL steps when fully paid', async () => {
    const baseBill = {
      id: 'bill-1',
      caseId: 'case-1',
      patientId: 'pat-1',
      totalAmount: 3000,
      paidAmount: 1000,
      status: 'PARTIALLY_PAID',
      notes: 'Existing note',
      dueDate: new Date('2026-12-01T00:00:00Z'),
      hospitalId: 'hosp-1',
      case: { id: 'case-1', managerId: 'mgr-1' },
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
    };

    const txUpdateMock = jest.fn().mockResolvedValue({
      ...baseBill,
      paidAmount: 3000,
      status: 'PAID',
    });
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue(baseBill),
          update: txUpdateMock,
          count: jest
            .fn()
            .mockResolvedValueOnce(0) // unpaid non-cancelled count
            .mockResolvedValueOnce(1), // paid count
        },
        clinicalStep: {
          updateMany: stepUpdateMany,
        },
      })
    );

    // Wrong manager -> 403
    const wrongMgr = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 500,
      actor: { userId: 'mgr-other', role: 'MANAGER' },
    });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);
    expect(txUpdateMock).not.toHaveBeenCalled();

    // Overpayment -> 400
    const overpay = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 2500,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(overpay.ok).toBe(false);
    if (!overpay.ok) expect(overpay.status).toBe(400);
    expect(txUpdateMock).not.toHaveBeenCalled();

    // Settling remaining 2000 -> PAID + completes SETTLE_BILL step, and omits dueDate/notes/hospitalId
    const paidRes = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 2000,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(paidRes.ok).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 3000,
          status: 'PAID',
        }),
      })
    );
    const updatePayload = txUpdateMock.mock.calls[0][0].data;
    expect(updatePayload.dueDate).toBeUndefined();
    expect(updatePayload.notes).toBeUndefined();
    expect(updatePayload.hospitalId).toBeUndefined();

    expect(stepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', actionType: 'SETTLE_BILL' }),
      })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SETTLE_BILL' }),
      })
    );
  });

  it('protects CANCELLED and OVERDUE bills on partial updates and rejects invalid hospitalId with 400', async () => {
    const cancelledBill = {
      id: 'bill-cancelled',
      caseId: 'case-1',
      patientId: 'pat-1',
      totalAmount: 2000,
      paidAmount: 0,
      status: 'CANCELLED',
      notes: null,
      dueDate: null,
      hospitalId: null,
      case: { id: 'case-1', managerId: 'mgr-1' },
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
    };

    const txUpdateMock = jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...cancelledBill,
      ...data,
    }));

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue(cancelledBill),
          update: txUpdateMock,
          count: jest.fn().mockResolvedValue(0),
        },
        clinicalStep: { updateMany: jest.fn() },
      })
    );

    // Rejects paymentAmount on a CANCELLED bill -> 400
    const payCancelled = await updateMedicalBill({
      billId: 'bill-cancelled',
      paymentAmount: 500,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(payCancelled.ok).toBe(false);
    if (!payCancelled.ok) expect(payCancelled.status).toBe(400);
    expect(txUpdateMock).not.toHaveBeenCalled();

    // Preserves CANCELLED status when patching notes without status
    const noteUpdate = await updateMedicalBill({
      billId: 'bill-cancelled',
      notes: 'Cancelled due to duplicate invoice',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(noteUpdate.ok).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          notes: 'Cancelled due to duplicate invoice',
        }),
      })
    );

    // Invalid hospitalId -> 400 BAD_REQUEST before writing
    mockedPrisma.hospital.findUnique.mockResolvedValueOnce(null);
    const invalidHospitalRes = await updateMedicalBill({
      billId: 'bill-cancelled',
      hospitalId: 'non-existent-hosp',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(invalidHospitalRes.ok).toBe(false);
    if (!invalidHospitalRes.ok) expect(invalidHospitalRes.status).toBe(400);
  });

  it('completes pending SETTLE_BILL steps when cancelling the last remaining unpaid bill on a case with an existing PAID bill', async () => {
    const unpaidBill = {
      id: 'bill-unpaid',
      caseId: 'case-1',
      patientId: 'pat-1',
      totalAmount: 1200,
      paidAmount: 0,
      status: 'PENDING',
      notes: null,
      dueDate: null,
      hospitalId: null,
      case: { id: 'case-1', managerId: 'mgr-1' },
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
    };

    const txUpdateMock = jest.fn().mockResolvedValue({
      ...unpaidBill,
      status: 'CANCELLED',
    });
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue(unpaidBill),
          update: txUpdateMock,
          count: jest
            .fn()
            .mockResolvedValueOnce(0) // remaining unpaid non-cancelled count
            .mockResolvedValueOnce(1), // existing PAID bill count
        },
        clinicalStep: { updateMany: stepUpdateMany },
      })
    );

    const cancelRes = await updateMedicalBill({
      billId: 'bill-unpaid',
      status: 'CANCELLED',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(cancelRes.ok).toBe(true);
    expect(stepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caseId: 'case-1',
          actionType: 'SETTLE_BILL',
          status: { not: 'COMPLETED' },
        }),
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });

  it('allows owning PATIENT to pay partial or full balance via payPatientMedicalBill inside $transaction and blocks other patients', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });

    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'bill-other',
            caseId: 'case-2',
            patientId: 'pat-other',
            totalAmount: 1000,
            paidAmount: 0,
            status: 'PENDING',
            notes: null,
          }),
          update: jest.fn(),
          count: jest.fn(),
        },
        clinicalStep: { updateMany: jest.fn() },
      })
    );

    const forbidden = await payPatientMedicalBill({
      billId: 'bill-other',
      amount: 500,
      paymentMethod: 'CARD',
      actor: { userId: 'u-pat-1', role: 'PATIENT' },
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    const txUpdate = jest.fn().mockResolvedValue({
      id: 'bill-1',
      totalAmount: 1500,
      paidAmount: 1500,
      status: 'PAID',
    });
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'bill-1',
            caseId: 'case-1',
            patientId: 'pat-1',
            totalAmount: 1500,
            paidAmount: 500,
            currency: 'USD',
            status: 'PARTIALLY_PAID',
            notes: null,
          }),
          update: txUpdate,
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: stepUpdateMany },
      })
    );

    const payRes = await payPatientMedicalBill({
      billId: 'bill-1',
      amount: 1000,
      paymentMethod: 'WIRE_TRANSFER',
      referenceNo: 'SWIFT-9988',
      actor: { userId: 'u-pat-1', role: 'PATIENT' },
    });
    expect(payRes.ok).toBe(true);
    expect(txUpdate.mock.calls[0][0].data.notes).toContain('WIRE_TRANSFER');
    expect(txUpdate.mock.calls[0][0].data.notes).toContain('SWIFT-9988');
    expect(stepUpdateMany).toHaveBeenCalled();
  });

  it('extracts real itemized charges from uncompressed & FlateDecode PDF streams (PDF_TEXT) and falls back honestly on PNG scans (SCANNED_FALLBACK)', () => {
    const invoicePdf = generateClinicalCertificatePdf({
      title: 'Apollo Hospital Tax Invoice INV-2026-4412',
      category: 'PROFORMA_INVOICE',
      patientName: 'Tariq Al-Said',
      nationality: 'Oman',
      caseId: 'case-1',
      issuedByName: 'Billing Desk',
      issuedByRole: 'Finance',
      bodyLines: [
        'Apollo Multi-Specialty Hospital New Delhi',
        'Currency: USD',
        'Cardiac Catheterization OT Suite | 1 | 2200.00 | 2200.00',
        'Coronary Care Unit Bed Rent | 2 | 400.00 | 800.00',
        'Drug Eluting Stent Pharmacy | 1 | 1200.00 | 1200.00',
      ],
    });

    const lines = extractTextFromPdfBuffer(invoicePdf);
    expect(lines.some((l) => l.includes('INV-2026-4412'))).toBe(true);

    const parsedPdf = parseMultiPageMedicalBillOcr([
      { name: 'apollo-invoice.pdf', type: 'application/pdf', buffer: invoicePdf },
    ]);
    expect(parsedPdf.extractionMode).toBe('PDF_TEXT');
    expect(parsedPdf.invoiceNumber).toBe('INV-2026-4412');
    expect(parsedPdf.items.length).toBeGreaterThanOrEqual(3);
    expect(parsedPdf.totalAmount).toBe(4200);

    // Compressed /FlateDecode stream test
    const flateStream = [
      'BT',
      '/F1 12 Tf',
      '50 750 Td',
      '(Fortis Memorial Hospital) Tj',
      '0 -20 Td',
      '(Invoice: BILL-2026-7788) Tj',
      '0 -20 Td',
      '(Currency: INR) Tj',
      '0 -20 Td',
      '[(MRI Brain Diagnostics) -20 (2 x 500.00 = 1000.00)] TJ',
      'ET',
    ].join('\n');
    const flatePdf = buildFlatePdf(flateStream);
    const flateParsed = parseMultiPageMedicalBillOcr([
      { name: 'fortis-flate.pdf', type: 'application/pdf', buffer: flatePdf },
    ]);
    expect(flateParsed.extractionMode).toBe('PDF_TEXT');
    expect(flateParsed.invoiceNumber).toBe('BILL-2026-7788');
    expect(flateParsed.currency).toBe('INR');
    expect(flateParsed.totalAmount).toBe(1000);

    // Minimal valid PNG header with no text layer -> SCANNED_FALLBACK
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const parsedPng = parseMultiPageMedicalBillOcr([
      { name: 'scan-page1.png', type: 'image/png', buffer: pngHeader },
    ]);
    expect(parsedPng.extractionMode).toBe('SCANNED_FALLBACK');
    expect(parsedPng.confidenceScore).toBeLessThan(0.8);
  });

  it('handles HTTP route handlers for manager billing metadata, hospitalId/overpayment validation, atomic PAID creation, patient payment, and OCR security checks', async () => {
    // 1. GET /api/v1/manager/billing?meta=true
    mockedPrisma.medicalBill.findMany.mockResolvedValue([]);
    mockedPrisma.case.findMany.mockResolvedValue([]);
    mockedPrisma.hospital.findMany.mockResolvedValue([]);
    const getRes = await managerBillingGet(
      new NextRequest('http://localhost/api/v1/manager/billing?meta=true', {
        headers: makeAuthHeaders('mgr-1', 'MANAGER'),
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.metadata).toEqual({ cases: [], hospitals: [] });

    // 2. POST /api/v1/manager/billing rejects paidAmount > calculatedTotal
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      patientId: 'pat-1',
      managerId: 'mgr-1',
    });
    const postInvalid = await managerBillingPost(
      new NextRequest('http://localhost/api/v1/manager/billing', {
        method: 'POST',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          caseId: 'case-1',
          patientId: 'pat-1',
          title: 'Surgery Invoice',
          paidAmount: 5000,
          items: [{ description: 'OT', quantity: 1, unitPrice: 1000 }],
        }),
      })
    );
    expect(postInvalid.status).toBe(400);

    // 3. POST /api/v1/manager/billing rejects invalid hospitalId with 400
    mockedPrisma.hospital.findUnique.mockResolvedValueOnce(null);
    const postInvalidHospital = await managerBillingPost(
      new NextRequest('http://localhost/api/v1/manager/billing', {
        method: 'POST',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          caseId: 'case-1',
          patientId: 'pat-1',
          hospitalId: 'missing-hosp',
          title: 'Surgery Invoice',
          paidAmount: 0,
          items: [{ description: 'OT', quantity: 1, unitPrice: 1000 }],
        }),
      })
    );
    expect(postInvalidHospital.status).toBe(400);

    // 4. POST /api/v1/manager/billing creates PAID bill and syncs SETTLE_BILL atomically inside $transaction
    const postStepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          create: jest.fn().mockResolvedValue({
            id: 'bill-created',
            totalAmount: 1000,
            paidAmount: 1000,
            status: 'PAID',
          }),
          update: jest.fn(),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: postStepUpdateMany },
      })
    );
    const postPaidOk = await managerBillingPost(
      new NextRequest('http://localhost/api/v1/manager/billing', {
        method: 'POST',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          caseId: 'case-1',
          patientId: 'pat-1',
          title: 'Pre-Paid Surgery Invoice',
          paidAmount: 1000,
          items: [{ description: 'OT', quantity: 1, unitPrice: 1000 }],
        }),
      })
    );
    expect(postPaidOk.status).toBe(200);
    expect(postStepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', actionType: 'SETTLE_BILL' }),
      })
    );

    // 5. PATCH /api/v1/manager/billing
    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'bill-1',
            caseId: 'case-1',
            patientId: 'pat-1',
            totalAmount: 1000,
            paidAmount: 0,
            status: 'PENDING',
            notes: null,
            dueDate: null,
            hospitalId: null,
            case: { id: 'case-1', managerId: 'mgr-1' },
            patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
          }),
          update: jest.fn().mockResolvedValue({ id: 'bill-1', paidAmount: 1000, status: 'PAID' }),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      })
    );
    const patchRes = await managerBillingPatch(
      new NextRequest('http://localhost/api/v1/manager/billing', {
        method: 'PATCH',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ billId: 'bill-1', paymentAmount: 1000 }),
      })
    );
    expect(patchRes.status).toBe(200);

    // 6. POST /api/v1/patient/billing/pay rejects MANAGER role with 403
    const patRoleFail = await patientBillingPayPost(
      new NextRequest('http://localhost/api/v1/patient/billing/pay', {
        method: 'POST',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ billId: 'bill-1', amount: 100, paymentMethod: 'CARD' }),
      })
    );
    expect(patRoleFail.status).toBe(403);

    // 7. POST /api/v1/manager/billing/ocr rejects PATIENT role with 403
    const ocrRoleFail = await managerBillingOcrPost(
      new NextRequest('http://localhost/api/v1/manager/billing/ocr', {
        method: 'POST',
        headers: makeAuthHeaders('pat-u-1', 'PATIENT'),
      })
    );
    expect(ocrRoleFail.status).toBe(403);

    // 8. POST /api/v1/manager/billing/ocr rejects spoofed magic bytes with 400
    const spoofedForm = new FormData();
    spoofedForm.append(
      'files',
      new File([Buffer.from('not-a-pdf-payload')], 'fake.pdf', { type: 'application/pdf' })
    );
    const ocrSpoofFail = await managerBillingOcrPost(
      new NextRequest('http://localhost/api/v1/manager/billing/ocr', {
        method: 'POST',
        headers: makeAuthHeaders('mgr-1', 'MANAGER'),
        body: spoofedForm,
      })
    );
    expect(ocrSpoofFail.status).toBe(400);
  });

  it('returns populated metadata on GET ?meta=true, returns updated bill on PATCH, handles OCR 200 PDF/fallback, and settles patient bill to PAID (200) on POST /patient/billing/pay', async () => {
    // 1. GET /api/v1/manager/billing?meta=true with populated cases & hospitals
    mockedPrisma.medicalBill.findMany.mockResolvedValueOnce([
      {
        id: 'bill-10',
        billNumber: 'INV-2026-1010',
        title: 'Cardiac Care Invoice',
        totalAmount: 2500,
        paidAmount: 500,
        status: 'PARTIALLY_PAID',
      },
    ]);
    mockedPrisma.case.findMany.mockResolvedValueOnce([
      {
        id: 'case-10',
        patientId: 'pat-10',
        status: 'IN_TREATMENT',
        createdAt: new Date('2026-11-01T00:00:00Z'),
        patient: {
          id: 'pat-10',
          user: { fullName: 'Tariq Al-Said', email: 'tariq@example.com' },
        },
      },
    ]);
    mockedPrisma.hospital.findMany.mockResolvedValueOnce([
      { id: 'hosp-10', name: 'Apollo Hospital', city: 'New Delhi' },
    ]);

    const metaRes = await managerBillingGet(
      new NextRequest('http://localhost/api/v1/manager/billing?meta=true', {
        headers: makeAuthHeaders('mgr-1', 'MANAGER'),
      })
    );
    expect(metaRes.status).toBe(200);
    const metaBody = await metaRes.json();
    expect(metaBody.success).toBe(true);
    expect(metaBody.data.bills).toHaveLength(1);
    expect(metaBody.data.metadata.cases).toHaveLength(1);
    expect(metaBody.data.metadata.cases[0]).toMatchObject({
      id: 'case-10',
      patientId: 'pat-10',
      status: 'IN_TREATMENT',
    });
    expect(metaBody.data.metadata.hospitals).toEqual([
      { id: 'hosp-10', name: 'Apollo Hospital', city: 'New Delhi' },
    ]);

    // 2. PATCH /api/v1/manager/billing updates bill status, notes, and paidAmount
    const updatedManagerBill = {
      id: 'bill-10',
      caseId: 'case-10',
      patientId: 'pat-10',
      totalAmount: 2500,
      paidAmount: 2500,
      status: 'PAID',
      notes: 'Settled at desk',
      items: [],
      patient: { id: 'pat-10', user: { fullName: 'Tariq Al-Said', email: 'tariq@example.com' } },
      hospital: { id: 'hosp-10', name: 'Apollo Hospital', city: 'New Delhi' },
    };
    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'bill-10',
            caseId: 'case-10',
            patientId: 'pat-10',
            totalAmount: 2500,
            paidAmount: 500,
            status: 'PARTIALLY_PAID',
            notes: null,
            dueDate: null,
            hospitalId: 'hosp-10',
            case: { id: 'case-10', managerId: 'mgr-1' },
            patient: { id: 'pat-10', assignedManagerId: 'mgr-1' },
          }),
          update: jest.fn().mockResolvedValue(updatedManagerBill),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      })
    );
    const patchRes = await managerBillingPatch(
      new NextRequest('http://localhost/api/v1/manager/billing', {
        method: 'PATCH',
        headers: {
          ...makeAuthHeaders('mgr-1', 'MANAGER'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          billId: 'bill-10',
          paidAmount: 2500,
          status: 'PAID',
          notes: 'Settled at desk',
        }),
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.bill).toMatchObject({
      id: 'bill-10',
      paidAmount: 2500,
      status: 'PAID',
      notes: 'Settled at desk',
    });

    // 3. POST /api/v1/manager/billing/ocr returns 200 with PDF_TEXT for valid PDF
    const validPdf = buildFlatePdf(
      'BT\n/F1 12 Tf\n50 750 Td\n(Apollo Hospital) Tj\n0 -20 Td\n(Invoice: INV-2026-5500) Tj\n0 -20 Td\n(ICU Bed Rent | 2 | 450.00 | 900.00) Tj\nET'
    );
    const ocrForm = new FormData();
    ocrForm.append(
      'files',
      new File([new Uint8Array(validPdf)], 'apollo.pdf', { type: 'application/pdf' })
    );
    const ocrOkRes = await managerBillingOcrPost(
      new NextRequest('http://localhost/api/v1/manager/billing/ocr', {
        method: 'POST',
        headers: makeAuthHeaders('mgr-1', 'MANAGER'),
        body: ocrForm,
      })
    );
    expect(ocrOkRes.status).toBe(200);
    const ocrOkBody = await ocrOkRes.json();
    expect(ocrOkBody.data.ocr.extractionMode).toBe('PDF_TEXT');
    expect(ocrOkBody.data.ocr.totalAmount).toBe(900);

    // 4. POST /api/v1/patient/billing/pay returns 200 with PAID bill for owning patient
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({ id: 'pat-10', userId: 'u-pat-10' });
    const patStepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    mockedPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'bill-10',
            caseId: 'case-10',
            patientId: 'pat-10',
            totalAmount: 2500,
            paidAmount: 500,
            currency: 'USD',
            status: 'PARTIALLY_PAID',
            notes: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'bill-10',
            caseId: 'case-10',
            patientId: 'pat-10',
            totalAmount: 2500,
            paidAmount: 2500,
            currency: 'USD',
            status: 'PAID',
            items: [],
            hospital: { id: 'hosp-10', name: 'Apollo Hospital', city: 'New Delhi' },
          }),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: patStepUpdateMany },
      })
    );

    const patPayOk = await patientBillingPayPost(
      new NextRequest('http://localhost/api/v1/patient/billing/pay', {
        method: 'POST',
        headers: {
          ...makeAuthHeaders('u-pat-10', 'PATIENT'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          billId: 'bill-10',
          amount: 2000,
          paymentMethod: 'CARD',
          referenceNo: 'VISA-4242',
        }),
      })
    );
    expect(patPayOk.status).toBe(200);
    const patPayBody = await patPayOk.json();
    expect(patPayBody.success).toBe(true);
    expect(patPayBody.data.bill.status).toBe('PAID');
    expect(patPayBody.data.bill.paidAmount).toBe(2500);
    expect(patStepUpdateMany).toHaveBeenCalled();
  });
});
