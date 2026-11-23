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
    clinicalStep: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  authorizeCaseClinicalAccess,
  getCasePathwayForViewer,
  replaceCasePathway,
  updateSinglePathwayStep,
  PRESET_TEMPLATES,
} from '@/lib/services/clinical-pathway.service';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

const baseCase = {
  id: 'case-1',
  patientId: 'pat-1',
  managerId: 'mgr-1',
  status: 'PLAN_CONFIRMED',
  patient: {
    id: 'pat-1',
    userId: 'pat-user-1',
    nationality: 'Oman',
    assignedManagerId: 'mgr-1',
    passportNo: null,
    user: { fullName: 'Ali Hassan', email: 'ali@example.com', phone: '+96891234567' },
    medicalProfile: null,
  },
  clinicalSteps: [],
  fitToFlyClearance: null,
};

describe('Task 2: Clinical Pathway Service & Multi-Role Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes 3 specialty preset templates with actionType and requiredRole metadata', () => {
    expect(PRESET_TEMPLATES.map((t) => t.id)).toEqual([
      'CARDIOLOGY',
      'ONCOLOGY',
      'ORTHOPEDICS',
    ]);
    expect(PRESET_TEMPLATES[0].steps.some((s) => s.actionType === 'ISSUE_VIL')).toBe(true);
    expect(PRESET_TEMPLATES[0].steps.some((s) => s.requiredRole === 'DOCTOR')).toBe(true);
  });

  it('enforces object-level case access across ADMIN, assigned MANAGER, treating DOCTOR, and PATIENT', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCase);

    const adminRes = await authorizeCaseClinicalAccess('case-1', { userId: 'adm-1', role: 'ADMIN' });
    expect(adminRes.ok).toBe(true);

    const assignedMgr = await authorizeCaseClinicalAccess('case-1', { userId: 'mgr-1', role: 'MANAGER' });
    expect(assignedMgr.ok).toBe(true);

    const wrongMgr = await authorizeCaseClinicalAccess('case-1', { userId: 'mgr-2', role: 'MANAGER' });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);

    const ownPatient = await authorizeCaseClinicalAccess('case-1', { userId: 'pat-user-1', role: 'PATIENT' });
    expect(ownPatient.ok).toBe(true);

    const otherPatient = await authorizeCaseClinicalAccess('case-1', { userId: 'pat-user-2', role: 'PATIENT' });
    expect(otherPatient.ok).toBe(false);
    if (!otherPatient.ok) expect(otherPatient.status).toBe(403);

    // Doctor with active appointment vs doctor without appointment
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-user-1',
      fullName: 'Dr. Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({ id: 'appt-1' });
    const treatingDoc = await authorizeCaseClinicalAccess('case-1', {
      userId: 'doc-user-1',
      role: 'DOCTOR',
    });
    expect(treatingDoc.ok).toBe(true);

    mockedPrisma.appointment.findFirst.mockResolvedValueOnce(null);
    const unrelatedDoc = await authorizeCaseClinicalAccess('case-1', {
      userId: 'doc-user-1',
      role: 'DOCTOR',
    });
    expect(unrelatedDoc.ok).toBe(false);
    if (!unrelatedDoc.ok) expect(unrelatedDoc.status).toBe(403);
  });

  it('returns 404 when case is missing in getCasePathwayForViewer and formats patient for authorized viewer', async () => {
    mockedPrisma.case.findUnique.mockResolvedValueOnce(null);
    const missingRes = await getCasePathwayForViewer('missing-case', { userId: 'adm-1', role: 'ADMIN' });
    expect(missingRes.ok).toBe(false);
    if (!missingRes.ok) {
      expect(missingRes.status).toBe(404);
      expect(missingRes.code).toBe('CASE_NOT_FOUND');
    }

    mockedPrisma.case.findUnique.mockResolvedValueOnce(baseCase);
    const okRes = await getCasePathwayForViewer('case-1', { userId: 'mgr-1', role: 'MANAGER' });
    expect(okRes.ok).toBe(true);
  });

  it('persists actionType, requiredRole, and actionUrl in replaceCasePathway and blocks CLOSED cases', async () => {
    mockedPrisma.case.findUnique.mockResolvedValueOnce({ ...baseCase, status: 'CLOSED' });
    const closedRes = await replaceCasePathway({
      caseId: 'case-1',
      steps: [
        {
          stageName: 'Stage 1',
          stageOrder: 1,
          stepOrder: 1,
          title: 'VIL Step',
          category: 'PRE_OP',
          status: 'PENDING',
        },
      ],
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(closedRes.ok).toBe(false);
    if (!closedRes.ok) expect(closedRes.code).toBe('CASE_ALREADY_CLOSED');

    const createdPayloads: unknown[] = [];
    mockedPrisma.case.findUnique
      .mockResolvedValueOnce(baseCase)
      .mockResolvedValueOnce({ ...baseCase, clinicalSteps: [] });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        clinicalStep: {
          deleteMany: jest.fn(),
          create: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => {
            createdPayloads.push(data);
            return data;
          }),
        },
        case: { update: jest.fn() },
      })
    );

    const saveRes = await replaceCasePathway({
      caseId: 'case-1',
      steps: [
        {
          stageName: 'Stage 3: VIL',
          stageOrder: 3,
          stepOrder: 1,
          title: 'Issue VIL',
          category: 'PRE_OP',
          status: 'PENDING',
          actionType: 'ISSUE_VIL',
          requiredRole: 'MANAGER',
          actionUrl: '/patient/documents',
        },
      ],
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(saveRes.ok).toBe(true);
    expect(createdPayloads[0]).toMatchObject({
      actionType: 'ISSUE_VIL',
      requiredRole: 'MANAGER',
      actionUrl: '/patient/documents',
    });
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('enforces DOCTOR vs MANAGER requiredRole boundaries in updateSinglePathwayStep', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCase);
    mockedPrisma.clinicalStep.findUnique.mockResolvedValue({
      id: 'step-doc',
      caseId: 'case-1',
      title: 'Sign PAC',
      status: 'PENDING',
      requiredRole: 'DOCTOR',
    });

    // Manager blocked from completing DOCTOR-required step
    const mgrAttempt = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-doc',
      status: 'COMPLETED',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(mgrAttempt.ok).toBe(false);
    if (!mgrAttempt.ok) expect(mgrAttempt.status).toBe(403);

    // Treating doctor succeeds on DOCTOR step
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-user-1',
      fullName: 'Dr. Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });
    mockedPrisma.clinicalStep.update.mockResolvedValue({
      id: 'step-doc',
      caseId: 'case-1',
      status: 'COMPLETED',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
    });

    const docAttempt = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-doc',
      status: 'COMPLETED',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
      doctorNotes: 'PAC cleared.',
      actor: { userId: 'doc-user-1', role: 'DOCTOR' },
    });
    expect(docAttempt.ok).toBe(true);

    // Treating doctor blocked from completing MANAGER-required step
    mockedPrisma.clinicalStep.findUnique.mockResolvedValueOnce({
      id: 'step-mgr',
      caseId: 'case-1',
      title: 'Issue VIL',
      status: 'PENDING',
      requiredRole: 'MANAGER',
    });
    const docOnMgrStep = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-mgr',
      status: 'COMPLETED',
      actor: { userId: 'doc-user-1', role: 'DOCTOR' },
    });
    expect(docOnMgrStep.ok).toBe(false);
    if (!docOnMgrStep.ok) expect(docOnMgrStep.status).toBe(403);

    // Treating doctor blocked from completing ADMIN-required step
    mockedPrisma.clinicalStep.findUnique.mockResolvedValueOnce({
      id: 'step-admin',
      caseId: 'case-1',
      title: 'Admin Governance Sign-Off',
      status: 'PENDING',
      requiredRole: 'ADMIN',
    });
    const docOnAdminStep = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-admin',
      status: 'COMPLETED',
      actor: { userId: 'doc-user-1', role: 'DOCTOR' },
    });
    expect(docOnAdminStep.ok).toBe(false);
    if (!docOnAdminStep.ok) expect(docOnAdminStep.status).toBe(403);
  });

  it('rejects invalid completedAt date strings with 400 in replaceCasePathway', async () => {
    mockedPrisma.case.findUnique.mockResolvedValueOnce(baseCase);

    const invalidRes = await replaceCasePathway({
      caseId: 'case-1',
      steps: [
        {
          stageName: 'Stage 1',
          stageOrder: 1,
          stepOrder: 1,
          title: 'Step with invalid date',
          category: 'PRE_OP',
          status: 'COMPLETED',
          completedAt: 'not-a-valid-date',
        },
      ],
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.code).toBe('BAD_REQUEST');
    }
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('preserves omitted decisionBranch/doctorNotes on partial step PATCH and rejects empty updates', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCase);
    mockedPrisma.clinicalStep.findUnique.mockResolvedValue({
      id: 'step-1',
      caseId: 'case-1',
      title: 'Step 1',
      status: 'IN_PROGRESS',
      requiredRole: 'MANAGER',
      decisionBranch: 'APPROVED_FOR_SURGERY',
      doctorNotes: 'Existing note',
    });
    mockedPrisma.clinicalStep.update.mockResolvedValue({
      id: 'step-1',
      caseId: 'case-1',
      status: 'COMPLETED',
      decisionBranch: 'APPROVED_FOR_SURGERY',
      doctorNotes: 'Existing note',
    });

    const partialRes = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-1',
      status: 'COMPLETED',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(partialRes.ok).toBe(true);
    const updateArg = mockedPrisma.clinicalStep.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data).toHaveProperty('status', 'COMPLETED');
    expect(updateArg.data).not.toHaveProperty('decisionBranch');
    expect(updateArg.data).not.toHaveProperty('doctorNotes');

    const emptyRes = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-1',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(emptyRes.ok).toBe(false);
    if (!emptyRes.ok) {
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.code).toBe('BAD_REQUEST');
    }
  });
});
