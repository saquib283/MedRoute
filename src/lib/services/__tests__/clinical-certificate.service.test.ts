import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/auth/crypto';
import {
  validateUploadBuffer,
  removeStoredFile,
} from '@/lib/services/document-storage.service';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clinicalStep: {
      updateMany: jest.fn(),
    },
    fitToFlyClearance: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  generateClinicalCertificatePdf,
  verifyPatientDocument,
  listCaseDocuments,
  issueCaseDocument,
  getCaseFitToFly,
  upsertCaseFitToFly,
} from '@/lib/services/clinical-certificate.service';
import { PATCH as verifyDocRoute } from '@/app/api/v1/documents/[id]/verify/route';
import {
  GET as listCaseDocsRoute,
  POST as issueCaseDocRoute,
} from '@/app/api/v1/cases/[id]/documents/route';
import {
  GET as getFitToFlyRoute,
  PUT as putFitToFlyRoute,
} from '@/app/api/v1/cases/[id]/fit-to-fly/route';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  document: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  fitToFlyClearance: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

const activeCase = {
  id: 'case-1',
  patientId: 'pat-1',
  managerId: 'mgr-1',
  status: 'OUTPATIENT_RECUPERATION',
  patient: {
    id: 'pat-1',
    userId: 'pat-u-1',
    assignedManagerId: 'mgr-1',
    nationality: 'Oman',
    passportNo: null,
    user: { fullName: 'Tariq Al-Said', email: 'tariq@example.com', phone: null },
    medicalProfile: null,
  },
  clinicalSteps: [],
  fitToFlyClearance: null,
};

describe('Task 3: Clinical Certificate PDF Generator, Document Verification & Fit-to-Fly', () => {
  const createdStorageKeys: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.document.create.mockImplementation(async ({ data }: { data: { storageKey?: string } }) => {
      if (data?.storageKey) {
        createdStorageKeys.push(data.storageKey);
      }
      return { id: 'doc-generated-1', ...data };
    });
  });

  afterEach(async () => {
    while (createdStorageKeys.length > 0) {
      const key = createdStorageKeys.pop();
      if (key) {
        await removeStoredFile(key);
      }
    }
  });

  it('generates a valid %PDF-1.4 buffer passing magic-byte validation', () => {
    const pdfBuf = generateClinicalCertificatePdf({
      title: 'Official Visa Invitation Letter (VIL)',
      category: 'VISA_INVITATION_LETTER',
      patientName: 'Tariq Al-Said (Oman) \\ Ref #1',
      nationality: 'Oman',
      caseId: 'case-1',
      issuedByName: 'Priya Coordinator',
      issuedByRole: 'Case Manager',
      bodyLines: [
        'Approved for Interventional Cardiology evaluation at Apollo Hospital — Delhi.',
        'Second line with extra detail to ensure proper PDF line wrapping and escaping (test).',
      ],
    });

    const pdfText = pdfBuf.toString('ascii');
    expect(pdfBuf.subarray(0, 8).toString('ascii')).toContain('%PDF-1.4');
    expect(pdfText).toContain('xref');
    expect(pdfText).toContain('startxref');
    expect(pdfText).toContain('%%EOF');

    const check = validateUploadBuffer(pdfBuf, 'vil.pdf', 'application/pdf');
    expect(check.valid).toBe(true);
  });

  it('verifies and rejects patient documents with assigned-manager RBAC, hospital-issued guard, and note requirements', async () => {
    mockedPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      patientId: 'pat-1',
      verificationStatus: 'PENDING',
      patient: {
        id: 'pat-1',
        assignedManagerId: 'mgr-1',
        cases: [{ managerId: 'mgr-1' }],
      },
    });

    // Reject without notes -> 400
    const missingNotes = await verifyPatientDocument({
      documentId: 'doc-1',
      verificationStatus: 'REJECTED',
      verificationNotes: '   ',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(missingNotes.ok).toBe(false);
    if (!missingNotes.ok) expect(missingNotes.status).toBe(400);

    // Doctor blocked from verifying patient uploads -> 403
    const doctorAttempt = await verifyPatientDocument({
      documentId: 'doc-1',
      verificationStatus: 'VERIFIED',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });
    expect(doctorAttempt.ok).toBe(false);
    if (!doctorAttempt.ok) expect(doctorAttempt.status).toBe(403);

    // Unassigned manager -> 403
    const wrongMgr = await verifyPatientDocument({
      documentId: 'doc-1',
      verificationStatus: 'VERIFIED',
      actor: { userId: 'mgr-other', role: 'MANAGER' },
    });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);

    // Hospital-issued document cannot be modified -> 400
    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      id: 'doc-issued',
      patientId: 'pat-1',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      patient: {
        id: 'pat-1',
        assignedManagerId: 'mgr-1',
        cases: [{ managerId: 'mgr-1' }],
      },
    });
    const issuedGuard = await verifyPatientDocument({
      documentId: 'doc-issued',
      verificationStatus: 'REJECTED',
      verificationNotes: 'Cannot reject',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(issuedGuard.ok).toBe(false);
    if (!issuedGuard.ok) expect(issuedGuard.status).toBe(400);

    // Assigned manager via route PATCH -> 200
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-1',
      verificationStatus: 'VERIFIED',
      verificationNotes: 'Passport bio-page verified.',
    });
    const req = new NextRequest('http://localhost/api/v1/documents/doc-1/verify', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'mgr@afzalhealthcare.in',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({
        verificationStatus: 'VERIFIED',
        verificationNotes: 'Passport bio-page verified.',
      }),
    });
    const res = await verifyDocRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    expect(res.status).toBe(200);
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VERIFY_DOCUMENT',
          entityType: 'Document',
          entityId: 'doc-1',
        }),
      })
    );
  });

  it('lists case documents for staff and auto-generates an official VIL PDF completing ISSUE_VIL steps', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(activeCase);
    mockedPrisma.user.findUnique.mockResolvedValue({ fullName: 'Priya Sharma' });
    mockedPrisma.document.create.mockImplementation(async ({ data }: { data: { storageKey?: string } }) => {
      if (data?.storageKey) createdStorageKeys.push(data.storageKey);
      return { id: 'doc-vil-1', ...data };
    });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-vil-1',
      category: 'VISA_INVITATION_LETTER',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-vil-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });

    // Patient blocked from staff case documents endpoint -> 403
    const patientList = await listCaseDocuments('case-1', { userId: 'pat-u-1', role: 'PATIENT' });
    expect(patientList.ok).toBe(false);
    if (!patientList.ok) expect(patientList.status).toBe(403);

    // Manager lists case documents -> 200
    mockedPrisma.document.findMany.mockResolvedValue([{ id: 'doc-1', category: 'PASSPORT' }]);
    const listReq = new NextRequest('http://localhost/api/v1/cases/case-1/documents', {
      method: 'GET',
      headers: {
        'x-user-id': 'mgr-1',
        'x-user-email': 'mgr@afzalhealthcare.in',
        'x-user-role': 'MANAGER',
      },
    });
    const listRes = await listCaseDocsRoute(listReq, { params: Promise.resolve({ id: 'case-1' }) });
    expect(listRes.status).toBe(200);

    // Manager blocked from issuing FIT_TO_FLY_CERTIFICATE
    const forbiddenCert = await issueCaseDocument({
      caseId: 'case-1',
      category: 'FIT_TO_FLY_CERTIFICATE',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(forbiddenCert.ok).toBe(false);
    if (!forbiddenCert.ok) expect(forbiddenCert.status).toBe(403);

    // Manager issues VIL without uploading a file via route POST (JSON) -> auto-generates PDF
    const postReq = new NextRequest('http://localhost/api/v1/cases/case-1/documents', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'mgr@afzalhealthcare.in',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({
        category: 'VISA_INVITATION_LETTER',
        notes: 'M-Visa invitation issued for New Delhi arrival.',
      }),
    });
    const postRes = await issueCaseDocRoute(postReq, { params: Promise.resolve({ id: 'case-1' }) });
    expect(postRes.status).toBe(200);

    expect(createdStorageKeys.length).toBe(1);
    expect(createdStorageKeys[0]).toMatch(/^cert_.*\.pdf$/);
    expect(mockedPrisma.clinicalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', actionType: 'ISSUE_VIL' }),
      })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ISSUE_DOCUMENT',
          entityType: 'Document',
          entityId: 'doc-vil-1',
        }),
      })
    );
  });

  it('allows treating DOCTOR (not MANAGER) to certify FitToFlyClearance, generating certificate & advancing case status', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(activeCase);

    const mgrAttempt = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(mgrAttempt.ok).toBe(false);
    if (!mgrAttempt.ok) expect(mgrAttempt.status).toBe(403);

    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValue({
      id: 'ftf-1',
      caseId: 'case-1',
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth',
    });
    mockedPrisma.document.create.mockImplementation(async ({ data }: { data: { storageKey?: string } }) => {
      if (data?.storageKey) createdStorageKeys.push(data.storageKey);
      return { id: 'doc-ftf-1', ...data };
    });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-ftf-1',
      category: 'FIT_TO_FLY_CERTIFICATE',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-ftf-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.case.update.mockResolvedValue({
      ...activeCase,
      status: 'FIT_TO_FLY_CLEARED',
    });

    const docRes = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      restrictions: 'Wheelchair assistance at airport; cabin pressurization standard.',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });
    expect(docRes.ok).toBe(true);
    if (docRes.ok) {
      expect(docRes.data.caseStatus).toBe('FIT_TO_FLY_CLEARED');
      expect(docRes.data.certificateDocument).toBeTruthy();
    }
    expect(mockedPrisma.fitToFlyClearance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clearedBy: 'Dr. Ashok Seth', isCleared: true }),
        update: expect.objectContaining({ clearedBy: 'Dr. Ashok Seth', isCleared: true }),
      })
    );
    expect(mockedPrisma.case.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { status: 'FIT_TO_FLY_CLEARED' },
    });
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SIGN_FIT_TO_FLY',
          entityType: 'Case',
          entityId: 'case-1',
        }),
      })
    );

    // Owning patient can GET fit-to-fly via route
    mockedPrisma.case.findUnique.mockResolvedValueOnce({
      ...activeCase,
      fitToFlyClearance: { id: 'ftf-1', isCleared: true, clearedBy: 'Dr. Ashok Seth' },
    });
    mockedPrisma.document.findFirst.mockResolvedValueOnce({
      id: 'doc-ftf-1',
      category: 'FIT_TO_FLY_CERTIFICATE',
    });
    const getReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
      method: 'GET',
      headers: {
        'x-user-id': 'pat-u-1',
        'x-user-email': 'tariq@example.com',
        'x-user-role': 'PATIENT',
      },
    });
    const getRes = await getFitToFlyRoute(getReq, { params: Promise.resolve({ id: 'case-1' }) });
    expect(getRes.status).toBe(200);

    // Doctor can PUT fit-to-fly via route (JSON) with isCleared: false on REMOTE_REHAB without downgrading status
    mockedPrisma.case.findUnique.mockResolvedValue({
      ...activeCase,
      status: 'REMOTE_REHAB',
    });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValueOnce({
      id: 'ftf-1',
      caseId: 'case-1',
      isCleared: false,
      clearedBy: 'Dr. Ashok Seth',
    });
    const putReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'doc-u-1',
        'x-user-email': 'doc@afzalhealthcare.in',
        'x-user-role': 'DOCTOR',
      },
      body: JSON.stringify({
        isCleared: false,
        restrictions: 'Hold travel until re-evaluation.',
        reEvalDate: '2026-12-01',
      }),
    });
    const putRes = await putFitToFlyRoute(putReq, { params: Promise.resolve({ id: 'case-1' }) });
    expect(putRes.status).toBe(200);
    const putJson = await putRes.json();
    expect(putJson.data.caseStatus).toBe('REMOTE_REHAB');

    // Verify getCaseFitToFly direct call works too
    mockedPrisma.case.findUnique.mockResolvedValueOnce(activeCase);
    mockedPrisma.document.findFirst.mockResolvedValueOnce(null);
    const directGet = await getCaseFitToFly('case-1', { userId: 'pat-u-1', role: 'PATIENT' });
    expect(directGet.ok).toBe(true);
  });

  it('does not mutate FitToFlyClearance when uploaded certificate file fails validation', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(activeCase);
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });

    const spoofedFile = new File(['not-a-pdf'], 'fake.pdf', { type: 'application/pdf' });
    const res = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      file: spoofedFile,
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
    expect(mockedPrisma.fitToFlyClearance.upsert).not.toHaveBeenCalled();
    expect(mockedPrisma.clinicalStep.updateMany).not.toHaveBeenCalled();
    expect(mockedPrisma.case.update).not.toHaveBeenCalled();
    expect(mockedPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reverts FIT_TO_FLY_CLEARED case to OUTPATIENT_RECUPERATION, marks SIGN_FIT_TO_FLY ACTION_REQUIRED, and omits certificateDocument when isCleared=false', async () => {
    const clearedCase = {
      ...activeCase,
      status: 'FIT_TO_FLY_CLEARED',
      fitToFlyClearance: {
        id: 'ftf-1',
        caseId: 'case-1',
        isCleared: true,
        clearedBy: 'Dr. Ashok Seth',
      },
    };
    mockedPrisma.case.findUnique.mockResolvedValueOnce(clearedCase);
    mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({ id: 'appt-1' });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValueOnce({
      id: 'ftf-1',
      caseId: 'case-1',
      isCleared: false,
      clearedBy: 'Dr. Ashok Seth',
      clearanceDate: null,
      restrictions: 'Post-op fever; hold travel.',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.case.update.mockResolvedValueOnce({
      ...clearedCase,
      status: 'OUTPATIENT_RECUPERATION',
    });

    const holdRes = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: false,
      restrictions: 'Post-op fever; hold travel.',
      reEvalDate: '2026-12-05',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });

    expect(holdRes.ok).toBe(true);
    if (holdRes.ok) {
      expect(holdRes.data.caseStatus).toBe('OUTPATIENT_RECUPERATION');
      expect(holdRes.data.certificateDocument).toBeNull();
    }
    expect(mockedPrisma.clinicalStep.updateMany).toHaveBeenCalledWith({
      where: {
        caseId: 'case-1',
        actionType: 'SIGN_FIT_TO_FLY',
      },
      data: {
        status: 'ACTION_REQUIRED',
        decisionBranch: null,
        completedAt: null,
      },
    });
    expect(mockedPrisma.case.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { status: 'OUTPATIENT_RECUPERATION' },
    });

    // getCaseFitToFly must return certificateDocument: null when isCleared === false
    mockedPrisma.case.findUnique.mockResolvedValueOnce({
      ...activeCase,
      status: 'OUTPATIENT_RECUPERATION',
      fitToFlyClearance: {
        id: 'ftf-1',
        caseId: 'case-1',
        isCleared: false,
        clearedBy: 'Dr. Ashok Seth',
      },
    });
    const getHoldRes = await getCaseFitToFly('case-1', { userId: 'pat-u-1', role: 'PATIENT' });
    expect(getHoldRes.ok).toBe(true);
    if (getHoldRes.ok) {
      expect(getHoldRes.data.certificateDocument).toBeNull();
    }
    expect(mockedPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it('embeds Hospital accreditation, decrypted Patient Passport + Expiry, MED-X attendants, Specialist, and Procedure in generated VIL and FRRO PDFs', async () => {
    const encryptedPatientPassport = encrypt('A12345678');
    const encryptedAttendantPassport = encrypt('U99887766');

    mockedPrisma.case.findUnique.mockResolvedValue({
      ...activeCase,
      status: 'PLAN_CONFIRMED',
      hospital: {
        id: 'hosp-1',
        name: 'Fortis Escorts Heart Institute',
        city: 'New Delhi',
        address: 'Okhla Road, New Delhi',
        accreditation: 'NABH, JCI',
      },
      primaryDoctor: {
        id: 'doc-1',
        userId: 'doc-u-1',
        fullName: 'Ashok Seth',
        qualification: 'MD, DM',
        specialisation: { id: 'spec-1', name: 'Cardiology' },
      },
      patient: {
        ...activeCase.patient,
        nationality: 'UAE',
        passportNo: encryptedPatientPassport,
        passportExpiry: new Date('2030-05-15T00:00:00.000Z'),
        user: { fullName: 'Ranya Al-Hassan', email: 'ranya@example.com', phone: null },
      },
      treatmentPlan: {
        diagnosis: 'Multi-vessel Coronary Artery Disease',
        procedureName: 'Percutaneous Coronary Intervention (PCI)',
        hospitalLosDays: 3,
        recoveryStayDays: 5,
        estimatedCostUsd: 5200,
        currency: 'USD',
      },
      travelLogistics: {
        attendants: [
          {
            fullName: 'Ahmed Al-Hassan',
            passportNo: encryptedAttendantPassport,
            relation: 'Husband',
          },
        ],
        frroNumber: 'FRRO-DEL-2026-991',
        formCSubmittedAt: '2026-11-24T09:00:00.000Z',
      },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ fullName: 'Priya Sharma' });
    mockedPrisma.document.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      ...data,
    }));
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });

    const vilRes = await issueCaseDocument({
      caseId: 'case-1',
      category: 'VISA_INVITATION_LETTER',
      notes: 'Embassy of India Abu Dhabi priority medical sponsorship.',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(vilRes.ok).toBe(true);
    expect(createdStorageKeys.length).toBeGreaterThanOrEqual(1);
    const vilKey = createdStorageKeys[createdStorageKeys.length - 1];
    const vilPdfText = fs
      .readFileSync(path.join(process.cwd(), 'storage', 'uploads', vilKey))
      .toString('ascii');

    expect(vilPdfText).toContain('Fortis Escorts Heart Institute');
    expect(vilPdfText).toContain('NABH, JCI');
    expect(vilPdfText).toContain('A12345678');
    expect(vilPdfText).toContain('2030-05-15');
    expect(vilPdfText).toContain('Ahmed Al-Hassan');
    expect(vilPdfText).toContain('U99887766');
    expect(vilPdfText).toContain('Husband');
    expect(vilPdfText).toContain('Dr. Ashok Seth');
    expect(vilPdfText).toContain('Percutaneous Coronary Intervention');
    expect(vilPdfText).not.toContain(encryptedPatientPassport);
    expect(vilPdfText).not.toContain(encryptedAttendantPassport);

    const frroRes = await issueCaseDocument({
      caseId: 'case-1',
      category: 'FRRO_REGISTRATION',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(frroRes.ok).toBe(true);
    const frroKey = createdStorageKeys[createdStorageKeys.length - 1];
    const frroPdfText = fs
      .readFileSync(path.join(process.cwd(), 'storage', 'uploads', frroKey))
      .toString('ascii');
    expect(frroPdfText).toContain('A12345678');
    expect(frroPdfText).toContain('FRRO-DEL-2026-991');
  });

  it('allows DOCTOR (not MANAGER) to issue DISCHARGE_SUMMARY with medication, wound-care, and red-flag instructions', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue({
      ...activeCase,
      primaryDoctorId: 'doc-1',
      treatmentPlan: {
        diagnosis: 'Severe Aortic Stenosis',
        procedureName: 'Transcatheter Aortic Valve Implantation (TAVI)',
        hospitalLosDays: 4,
        recoveryStayDays: 6,
        estimatedCostUsd: 18500,
        currency: 'USD',
      },
    });
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-generated-1',
      category: 'DISCHARGE_SUMMARY',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-generated-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });

    const mgrBlocked = await issueCaseDocument({
      caseId: 'case-1',
      category: 'DISCHARGE_SUMMARY',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(mgrBlocked.ok).toBe(false);
    if (!mgrBlocked.ok) expect(mgrBlocked.status).toBe(403);

    const docIssued = await issueCaseDocument({
      caseId: 'case-1',
      category: 'DISCHARGE_SUMMARY',
      notes: 'Dual antiplatelet therapy for 6 months; suture check on Day 5.',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });
    expect(docIssued.ok).toBe(true);
    const dsKey = createdStorageKeys[createdStorageKeys.length - 1];
    const dsPdfText = fs
      .readFileSync(path.join(process.cwd(), 'storage', 'uploads', dsKey))
      .toString('ascii');
    expect(dsPdfText).toContain('Discharge Medications');
    expect(dsPdfText).toContain('Wound Care');
    expect(dsPdfText).toContain('Red-Flag');
    expect(mockedPrisma.clinicalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caseId: 'case-1',
        }),
      })
    );
  });

  it('enforces IATA 5-point safety checklist when provided, persists MEDIF/SSR fields, and seeds DAY_7/DAY_30/DAY_90 follow-up milestones', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue({
      ...activeCase,
      primaryDoctorId: 'doc-1',
      postReturnFollowUps: null,
    });
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });

    // Unsafe checklist -> 400 BAD_REQUEST
    const unsafeRes = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      checklist: {
        woundStable: true,
        noTrappedGasRisk: false,
        cardioRespiratoryStable: true,
        hemoglobinCleared: true,
        dvtProphylaxisPlan: true,
      },
      ssrCode: 'WCHR',
      requiresMedif: true,
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });
    expect(unsafeRes.ok).toBe(false);
    if (!unsafeRes.ok) {
      expect(unsafeRes.status).toBe(400);
      expect(unsafeRes.message).toContain('All physiological safety criteria');
    }
    expect(mockedPrisma.fitToFlyClearance.upsert).not.toHaveBeenCalled();

    // Valid IATA checklist via PUT route -> 200, persists checklist/ssrCode/requiresMedif/flightNumber/departureDate and seeds 3 milestones
    const validChecklist = {
      woundStable: true,
      noTrappedGasRisk: true,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    };
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-ftf-medif',
      category: 'FIT_TO_FLY_CERTIFICATE',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-ftf-medif/download',
    });
    mockedPrisma.fitToFlyClearance.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: 'ftf-medif-1',
      ...create,
    }));
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.case.update.mockResolvedValue({
      ...activeCase,
      status: 'FIT_TO_FLY_CLEARED',
    });

    const putReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'doc-u-1',
        'x-user-email': 'doc@afzalhealthcare.in',
        'x-user-role': 'DOCTOR',
      },
      body: JSON.stringify({
        isCleared: true,
        restrictions: 'Aisle seat; compression stockings.',
        checklist: validChecklist,
        ssrCode: 'WCHR',
        requiresMedif: true,
        flightNumber: 'EK-511',
        departureDate: '2026-12-10T04:30:00.000Z',
      }),
    });

    const putRes = await putFitToFlyRoute(putReq, { params: Promise.resolve({ id: 'case-1' }) });
    expect(putRes.status).toBe(200);

    expect(mockedPrisma.fitToFlyClearance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isCleared: true,
          checklist: validChecklist,
          ssrCode: 'WCHR',
          requiresMedif: true,
          flightNumber: 'EK-511',
          departureDate: new Date('2026-12-10T04:30:00.000Z'),
        }),
        update: expect.objectContaining({
          isCleared: true,
          checklist: validChecklist,
          ssrCode: 'WCHR',
          requiresMedif: true,
          flightNumber: 'EK-511',
          departureDate: new Date('2026-12-10T04:30:00.000Z'),
        }),
      })
    );

    const ftfPdfKey = createdStorageKeys[createdStorageKeys.length - 1];
    const ftfPdfText = fs
      .readFileSync(path.join(process.cwd(), 'storage', 'uploads', ftfPdfKey))
      .toString('ascii');
    expect(ftfPdfText).toContain('WCHR');
    expect(ftfPdfText).toContain('EK-511');
    expect(ftfPdfText).toContain('MEDIF');

    expect(mockedPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          postReturnFollowUps: expect.arrayContaining([
            expect.objectContaining({ milestone: 'DAY_7', status: 'PENDING' }),
            expect.objectContaining({ milestone: 'DAY_30', status: 'PENDING' }),
            expect.objectContaining({ milestone: 'DAY_90', status: 'PENDING' }),
          ]),
        }),
      })
    );
  });
});
