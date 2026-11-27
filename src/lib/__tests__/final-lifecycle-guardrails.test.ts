import { NextRequest } from 'next/server';

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
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    medicalBill: {
      count: jest.fn(),
    },
    fitToFlyClearance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    clinicalStep: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/services/document-storage.service', () => ({
  saveGeneratedBuffer: jest.fn().mockResolvedValue({
    storageKey: 'cert_test_mock.pdf',
    fileSize: 1024,
  }),
  saveValidatedUpload: jest.fn(),
  removeStoredFile: jest.fn(),
}));

import prisma from '@/lib/prisma';
import {
  CLEAN_PRESET_TEMPLATES,
  STANDARD_MVT_STEPS,
  resolveRoadmapStepActionState,
} from '@/lib/validation/lifecycle-schemas';
import {
  issueCaseDocument,
  upsertCaseFitToFly,
} from '@/lib/services/clinical-certificate.service';
import { replaceCasePathway } from '@/lib/services/clinical-pathway.service';
import { PUT as putFitToFlyRoute } from '@/app/api/v1/cases/[id]/fit-to-fly/route';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  document: Record<string, jest.Mock>;
  medicalBill: Record<string, jest.Mock>;
  fitToFlyClearance: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

const baseCase = {
  id: 'case-reg-1',
  patientId: 'pat-1',
  managerId: 'mgr-1',
  primaryDoctorId: 'doc-1',
  status: 'INQUIRY_RECEIVED',
  treatmentPlan: null,
  travelLogistics: null,
  postReturnFollowUps: null,
  patient: {
    id: 'pat-1',
    userId: 'pat-u-1',
    assignedManagerId: 'mgr-1',
    nationality: 'Oman',
    passportNo: null,
    passportExpiry: null,
    user: { fullName: 'Tariq Al-Said', email: 'tariq@example.com', phone: '+96891234567' },
    medicalProfile: null,
  },
  hospital: {
    id: 'hosp-1',
    name: 'Fortis Escorts Heart Institute',
    city: 'New Delhi',
    address: 'Okhla Road',
    accreditation: 'NABH, JCI',
  },
  primaryDoctor: {
    id: 'doc-1',
    userId: 'doc-u-1',
    fullName: 'Dr. Ashok Seth',
    qualification: 'MBBS, MD',
    specialisation: { id: 'spec-1', name: 'Cardiology' },
  },
  clinicalSteps: [],
  fitToFlyClearance: null,
};

describe('Final Lifecycle Review Fix Pass Regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    mockedPrisma.document.count.mockResolvedValue(0);
    mockedPrisma.medicalBill.count.mockResolvedValue(0);
    mockedPrisma.fitToFlyClearance.findUnique.mockResolvedValue(null);
  });

  it('includes a Stage 6 DISCHARGE_SUMMARY step across STANDARD_MVT_STEPS and all CLEAN_PRESET_TEMPLATES and completes only DISCHARGE_SUMMARY on issuance', async () => {
    const checkTemplate = (steps: typeof STANDARD_MVT_STEPS) => {
      const stage6Steps = steps.filter((s) => s.stageOrder === 6);
      expect(stage6Steps.some((s) => s.actionType === 'DISCHARGE_SUMMARY')).toBe(true);
      expect(stage6Steps.map((s) => s.stepOrder)).toEqual(
        stage6Steps.map((_, idx) => idx + 1)
      );
    };

    checkTemplate(STANDARD_MVT_STEPS);
    for (const template of CLEAN_PRESET_TEMPLATES) {
      checkTemplate(template.steps);
    }

    mockedPrisma.case.findUnique.mockResolvedValue({
      ...baseCase,
      status: 'WARD_RECOVERY',
    });
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.document.create.mockResolvedValue({ id: 'doc-ds-1' });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-ds-1',
      category: 'DISCHARGE_SUMMARY',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-ds-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });

    const res = await issueCaseDocument({
      caseId: 'case-reg-1',
      category: 'DISCHARGE_SUMMARY',
      notes: 'Medication and wound-care instructions included.',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });

    expect(res.ok).toBe(true);
    expect(mockedPrisma.clinicalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caseId: 'case-reg-1',
          actionType: 'DISCHARGE_SUMMARY',
        }),
      })
    );
    const whereClause = mockedPrisma.clinicalStep.updateMany.mock.calls[0][0].where;
    expect(whereClause.actionType).not.toEqual({ in: ['DISCHARGE_SUMMARY', 'OPERATIVE_SUMMARY'] });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'DISCHARGE_SUMMARY', status: 'COMPLETED' },
        issuedDocCategories: new Set(['DISCHARGE_SUMMARY']),
      })
    ).toEqual({
      kind: 'CERTIFICATE_DOWNLOAD',
      label: 'Discharge Summary',
      href: '/patient/documents',
    });
  });

  it('replaceCasePathway enforces validateCaseStatusTransition and blocks MANAGER from reopening CLOSED cases', async () => {
    const sampleSteps = [
      {
        stageName: 'Stage 1',
        stageOrder: 1,
        stepOrder: 1,
        title: 'Intake',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
      },
    ];

    // 1. INQUIRY_RECEIVED -> IN_TREATMENT without verified passport -> 400
    mockedPrisma.case.findUnique.mockResolvedValueOnce({
      ...baseCase,
      status: 'INQUIRY_RECEIVED',
    });
    mockedPrisma.document.count.mockResolvedValueOnce(0);

    const invalidTransition = await replaceCasePathway({
      caseId: 'case-reg-1',
      steps: sampleSteps,
      caseStatus: 'IN_TREATMENT',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(invalidTransition.ok).toBe(false);
    if (!invalidTransition.ok) {
      expect(invalidTransition.status).toBe(400);
      expect(invalidTransition.message).toContain('passport verification');
    }
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();

    // 2. CLOSED -> WARD_RECOVERY by MANAGER -> 400 Cannot reopen a closed case
    mockedPrisma.case.findUnique.mockResolvedValueOnce({
      ...baseCase,
      status: 'CLOSED',
    });
    const managerReopen = await replaceCasePathway({
      caseId: 'case-reg-1',
      steps: sampleSteps,
      caseStatus: 'WARD_RECOVERY',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(managerReopen.ok).toBe(false);
    if (!managerReopen.ok) {
      expect(managerReopen.status).toBe(400);
      expect(managerReopen.message).toBe('Cannot reopen a closed case');
    }
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();

    // 3. INQUIRY_RECEIVED -> IN_TREATMENT WITH verified passport -> 200
    mockedPrisma.case.findUnique
      .mockResolvedValueOnce({ ...baseCase, status: 'INQUIRY_RECEIVED' })
      .mockResolvedValueOnce({ ...baseCase, status: 'IN_TREATMENT' });
    mockedPrisma.document.count.mockResolvedValueOnce(1);
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        clinicalStep: { deleteMany: jest.fn(), create: jest.fn() },
        case: { update: jest.fn() },
      })
    );

    const allowedTransition = await replaceCasePathway({
      caseId: 'case-reg-1',
      steps: sampleSteps,
      caseStatus: 'IN_TREATMENT',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(allowedTransition.ok).toBe(true);
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('resolveRoadmapStepActionState returns WAITING_ON_HOSPITAL on ISSUE_PROFORMA when no plan and no unpaid bills exist before completion', () => {
    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_PROFORMA', status: 'PENDING' },
        hasTreatmentPlan: false,
        unpaidBillCount: 0,
      })
    ).toEqual({
      kind: 'WAITING_ON_HOSPITAL',
      label: 'Waiting on Hospital',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_PROFORMA', status: 'ACTION_REQUIRED' },
        hasTreatmentPlan: false,
        unpaidBillCount: 0,
      })
    ).toEqual({
      kind: 'WAITING_ON_HOSPITAL',
      label: 'Waiting on Hospital',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_PROFORMA', status: 'COMPLETED' },
        hasTreatmentPlan: false,
        unpaidBillCount: 0,
      })
    ).toEqual({
      kind: 'LINK',
      label: 'Review Invoice',
      href: '/patient/billing',
    });
  });

  it('PUT /api/v1/cases/[id]/fit-to-fly rejects multipart requiresMedif="invalid" with 400 and falls back follow-up anchor to stored travelLogistics.departureAt', async () => {
    const invalidForm = new FormData();
    invalidForm.append('isCleared', 'false');
    invalidForm.append('requiresMedif', 'invalid');

    const invalidReq = new NextRequest('http://localhost/api/v1/cases/case-reg-1/fit-to-fly', {
      method: 'PUT',
      headers: {
        'x-user-id': 'doc-u-1',
        'x-user-email': 'doctor@afzalhealthcare.in',
        'x-user-role': 'DOCTOR',
      },
      body: invalidForm,
    });

    const invalidRes = await putFitToFlyRoute(invalidReq, {
      params: Promise.resolve({ id: 'case-reg-1' }),
    });
    expect(invalidRes.status).toBe(400);
    expect(mockedPrisma.fitToFlyClearance.upsert).not.toHaveBeenCalled();

    // Stored travelLogistics.departureAt anchor fallback + single merged case.update call
    mockedPrisma.case.findUnique.mockResolvedValueOnce({
      ...baseCase,
      status: 'WARD_RECOVERY',
      postReturnFollowUps: null,
      travelLogistics: {
        departureAt: '2026-12-20T00:00:00.000Z',
      },
    });
    mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Ashok Seth',
      isActive: true,
    });
    mockedPrisma.document.create.mockResolvedValueOnce({ id: 'doc-ftf-1' });
    mockedPrisma.document.update.mockResolvedValueOnce({
      id: 'doc-ftf-1',
      fileUrl: '/api/v1/documents/doc-ftf-1/download',
    });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValueOnce({
      id: 'ftf-1',
      caseId: 'case-reg-1',
      isCleared: true,
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.case.update.mockResolvedValueOnce({
      ...baseCase,
      status: 'FIT_TO_FLY_CLEARED',
    });

    const anchorRes = await upsertCaseFitToFly({
      caseId: 'case-reg-1',
      isCleared: true,
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });

    expect(anchorRes.ok).toBe(true);
    expect(mockedPrisma.case.update).toHaveBeenCalledTimes(1);
    const updateData = mockedPrisma.case.update.mock.calls[0][0].data as {
      status: string;
      postReturnFollowUps: Array<{ milestone: string; dueAt: string }>;
    };
    expect(updateData.status).toBe('FIT_TO_FLY_CLEARED');
    expect(updateData.postReturnFollowUps[0]).toMatchObject({
      milestone: 'DAY_7',
      dueAt: '2026-12-27T00:00:00.000Z',
    });
  });
});

