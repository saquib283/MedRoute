const mockCaseFindMany = jest.fn();
const mockCaseCount = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockCaseUpdate = jest.fn();
const mockDocumentCount = jest.fn();
const mockMedicalBillCount = jest.fn();
const mockFitToFlyFindUnique = jest.fn();
const mockCreateAuditLog = jest.fn();
const mockAssignPatientCoordinator = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findMany: (...args: unknown[]) => mockCaseFindMany(...args),
      count: (...args: unknown[]) => mockCaseCount(...args),
      findUnique: (...args: unknown[]) => mockCaseFindUnique(...args),
      update: (...args: unknown[]) => mockCaseUpdate(...args),
    },
    document: {
      count: (...args: unknown[]) => mockDocumentCount(...args),
    },
    medicalBill: {
      count: (...args: unknown[]) => mockMedicalBillCount(...args),
    },
    fitToFlyClearance: {
      findUnique: (...args: unknown[]) => mockFitToFlyFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/api/audit-logger', () => ({
  ...jest.requireActual('@/lib/api/audit-logger'),
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

jest.mock('@/lib/services/case-assignment.service', () => ({
  assignPatientCoordinator: (...args: unknown[]) => mockAssignPatientCoordinator(...args),
}));

import { NextRequest } from 'next/server';
import { CASE_STATUS_ORDER, CASE_STATUS_LABELS, CASE_PHASE_GROUPS, getCasePhaseIndex } from '../constants';
import { updateCaseStatusSchema } from '../validation/schemas';
import { computeFormCSlaStatus } from '../validation/lifecycle-schemas';
import { encrypt } from '../auth/crypto';
import { GET as getAdminEscalations, PUT as putAdminEscalations } from '@/app/api/v1/admin/escalations/route';
import { GET as getAdminCases, PUT as putAdminCases } from '@/app/api/v1/admin/cases/route';
import { GET as getManagerCases, PUT as putManagerCases } from '@/app/api/v1/manager/cases/route';

const ALL_12 = [
  'INQUIRY_RECEIVED',
  'UNDER_REVIEW',
  'PRE_OP_CLEARANCE',
  'PLAN_CONFIRMED',
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED',
];

describe('12-Stage CaseStatus Alignment', () => {
  it('orders and labels all 12 Prisma CaseStatus values', () => {
    expect([...CASE_STATUS_ORDER]).toEqual(ALL_12);
    for (const s of ALL_12) {
      expect(CASE_STATUS_LABELS[s]).toBeTruthy();
      expect(updateCaseStatusSchema.safeParse({ status: s }).success).toBe(true);
    }
  });

  it('maps WARD_RECOVERY to Phase 4 (index 3: Recovery) instead of defaulting to Phase 1', () => {
    expect(CASE_PHASE_GROUPS).toHaveLength(6);
    expect(getCasePhaseIndex('WARD_RECOVERY')).toBe(3);
    expect(getCasePhaseIndex('FIT_TO_FLY_CLEARED')).toBe(4);
    expect(getCasePhaseIndex('CLOSED')).toBe(5);
  });
});

describe('Admin Escalations & Case Normalization Routes', () => {
  const adminHeaders = {
    'x-user-id': 'admin-1',
    'x-user-role': 'ADMIN',
    'x-user-email': 'admin@medroute.test',
    'content-type': 'application/json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/admin/escalations excludes both null and empty-string escalationNote and CLOSED cases', async () => {
    mockCaseFindMany.mockResolvedValue([]);
    mockCaseCount.mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/v1/admin/escalations', {
      method: 'GET',
      headers: adminHeaders,
    });

    const res = await getAdminEscalations(req);
    expect(res.status).toBe(200);
    expect(mockCaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ escalationNote: { not: null } }, { escalationNote: { not: '' } }],
          status: { notIn: ['CLOSED'] },
        },
      })
    );
    expect(mockCaseCount).toHaveBeenCalledWith({
      where: {
        AND: [{ escalationNote: { not: null } }, { escalationNote: { not: '' } }],
        status: { notIn: ['CLOSED'] },
      },
    });
  });

  it('PUT /api/v1/admin/escalations delegates managerId updates to assignPatientCoordinator', async () => {
    mockCaseFindUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        managerId: 'mgr-1',
        escalationNote: 'Needs coordinator change',
        status: 'UNDER_REVIEW',
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        managerId: 'mgr-2',
        escalationNote: null,
        status: 'UNDER_REVIEW',
      });
    mockAssignPatientCoordinator.mockResolvedValue({
      ok: true,
      reassignedCount: 1,
      affectedPatientIds: ['pat-1'],
    });
    mockCaseUpdate.mockResolvedValue({
      id: 'case-1',
      managerId: 'mgr-2',
      escalationNote: null,
    });

    const req = new NextRequest('http://localhost/api/v1/admin/escalations', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: 'case-1',
        managerId: 'mgr-2',
        clearEscalation: true,
      }),
    });

    const res = await putAdminEscalations(req);
    expect(res.status).toBe(200);
    expect(mockAssignPatientCoordinator).toHaveBeenCalledWith(
      expect.objectContaining({
        caseIds: ['case-1'],
        managerId: 'mgr-2',
        actorId: 'admin-1',
      })
    );
    expect(mockCaseUpdate).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { escalationNote: null },
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESOLVE_ESCALATION',
        entityId: 'case-1',
        newValue: { escalationNote: null, managerId: 'mgr-2' },
      })
    );
  });

  it('PUT /api/v1/admin/cases normalizes whitespace-only escalationNote to null', async () => {
    mockCaseFindUnique
      .mockResolvedValueOnce({
        id: 'case-2',
        status: 'UNDER_REVIEW',
        managerId: 'mgr-1',
      })
      .mockResolvedValueOnce({
        id: 'case-2',
        status: 'UNDER_REVIEW',
        managerId: 'mgr-1',
        escalationNote: null,
      });
    mockCaseUpdate.mockResolvedValue({ id: 'case-2', escalationNote: null });

    const req = new NextRequest('http://localhost/api/v1/admin/cases', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: 'case-2',
        escalationNote: '   ',
      }),
    });

    const res = await putAdminCases(req);
    expect(res.status).toBe(200);
    expect(mockCaseUpdate).toHaveBeenCalledWith({
      where: { id: 'case-2' },
      data: { escalationNote: null },
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { escalationNote: null },
      })
    );
  });
});

describe('Case Status Stage-Gate Guardrails, PHI Masking & Form C 24h SLA', () => {
  const adminHeaders = {
    'x-user-id': 'admin-1',
    'x-user-role': 'ADMIN',
    'x-user-email': 'admin@medroute.test',
    'content-type': 'application/json',
  };

  const managerHeaders = {
    'x-user-id': 'mgr-1',
    'x-user-role': 'MANAGER',
    'x-user-email': 'mgr@medroute.test',
    'content-type': 'application/json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentCount.mockResolvedValue(1);
    mockMedicalBillCount.mockResolvedValue(0);
    mockFitToFlyFindUnique.mockResolvedValue(null);
  });

  it('computeFormCSlaStatus flags OVERDUE_STATUTORY when >24h elapsed since arrival without Form C', () => {
    const arrival = new Date('2026-11-22T08:00:00Z').toISOString();
    const now = new Date('2026-11-24T10:00:00Z');
    expect(computeFormCSlaStatus(null, null, now)).toBe('NOT_ARRIVED');
    expect(computeFormCSlaStatus(arrival, null, new Date('2026-11-22T20:00:00Z'))).toBe('DUE_WITHIN_24H');
    expect(computeFormCSlaStatus(arrival, null, now)).toBe('OVERDUE_STATUTORY');
    expect(computeFormCSlaStatus(arrival, '2026-11-22T18:00:00Z', now)).toBe('SUBMITTED_ON_TIME');
    expect(computeFormCSlaStatus(arrival, '2026-11-23T12:00:00Z', now)).toBe('SUBMITTED_LATE');
  });

  it('PUT /api/v1/admin/cases rejects FIT_TO_FLY_CLEARED when fitToFlyClearance?.isCleared !== true', async () => {
    mockCaseFindUnique.mockResolvedValueOnce({
      id: 'case-ftf-1',
      patientId: 'pat-1',
      status: 'WARD_RECOVERY',
      managerId: 'mgr-1',
      fitToFlyClearance: { isCleared: false },
    });

    const req = new NextRequest('http://localhost/api/v1/admin/cases', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: 'case-ftf-1',
        status: 'FIT_TO_FLY_CLEARED',
      }),
    });

    const res = await putAdminCases(req);
    expect(res.status).toBe(400);
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/admin/cases rejects CLOSED when unpaid non-cancelled bills exist without escalationNote or overrideReason', async () => {
    mockCaseFindUnique.mockResolvedValueOnce({
      id: 'case-bill-1',
      patientId: 'pat-1',
      status: 'FIT_TO_FLY_CLEARED',
      managerId: 'mgr-1',
      fitToFlyClearance: { isCleared: true },
    });
    mockMedicalBillCount.mockResolvedValueOnce(2);

    const blockedReq = new NextRequest('http://localhost/api/v1/admin/cases', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: 'case-bill-1',
        status: 'CLOSED',
      }),
    });

    const blockedRes = await putAdminCases(blockedReq);
    expect(blockedRes.status).toBe(400);
    expect(mockCaseUpdate).not.toHaveBeenCalled();

    // Allowed when explicit overrideReason / escalationNote is provided
    mockCaseFindUnique
      .mockResolvedValueOnce({
        id: 'case-bill-1',
        patientId: 'pat-1',
        status: 'FIT_TO_FLY_CLEARED',
        managerId: 'mgr-1',
        fitToFlyClearance: { isCleared: true },
      })
      .mockResolvedValueOnce({
        id: 'case-bill-1',
        patientId: 'pat-1',
        status: 'CLOSED',
        managerId: 'mgr-1',
        escalationNote: 'Approved financial settlement plan on file',
      });
    mockMedicalBillCount.mockResolvedValueOnce(2);
    mockCaseUpdate.mockResolvedValueOnce({ id: 'case-bill-1', status: 'CLOSED' });

    const overrideReq = new NextRequest('http://localhost/api/v1/admin/cases', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: 'case-bill-1',
        status: 'CLOSED',
        escalationNote: 'Approved financial settlement plan on file',
      }),
    });

    const overrideRes = await putAdminCases(overrideReq);
    expect(overrideRes.status).toBe(200);
    expect(mockCaseUpdate).toHaveBeenCalled();
  });

  it('PUT /api/v1/manager/cases rejects IN_TREATMENT without verified PASSPORT, FIT_TO_FLY_CLEARED without clearance, and CLOSED with unpaid bills', async () => {
    // 1. Entering IN_TREATMENT without verified PASSPORT and no overrideReason
    mockCaseFindUnique.mockResolvedValueOnce({
      id: 'case-mgr-1',
      patientId: 'pat-1',
      status: 'PLAN_CONFIRMED',
      managerId: 'mgr-1',
      fitToFlyClearance: null,
    });
    mockDocumentCount.mockResolvedValueOnce(0);

    const noPassportReq = new NextRequest('http://localhost/api/v1/manager/cases', {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({
        caseId: 'case-mgr-1',
        status: 'IN_TREATMENT',
      }),
    });
    const noPassportRes = await putManagerCases(noPassportReq);
    expect(noPassportRes.status).toBe(400);
    expect(mockCaseUpdate).not.toHaveBeenCalled();

    // 2. Jumping to FIT_TO_FLY_CLEARED without signed Fit-to-Fly clearance
    mockCaseFindUnique.mockResolvedValueOnce({
      id: 'case-mgr-1',
      patientId: 'pat-1',
      status: 'WARD_RECOVERY',
      managerId: 'mgr-1',
      fitToFlyClearance: { isCleared: false },
    });
    const noFtfReq = new NextRequest('http://localhost/api/v1/manager/cases', {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({
        caseId: 'case-mgr-1',
        status: 'FIT_TO_FLY_CLEARED',
      }),
    });
    const noFtfRes = await putManagerCases(noFtfReq);
    expect(noFtfRes.status).toBe(400);
    expect(mockCaseUpdate).not.toHaveBeenCalled();

    // 3. Closing with unpaid bills and no override/escalationNote
    mockCaseFindUnique.mockResolvedValueOnce({
      id: 'case-mgr-1',
      patientId: 'pat-1',
      status: 'FIT_TO_FLY_CLEARED',
      managerId: 'mgr-1',
      fitToFlyClearance: { isCleared: true },
    });
    mockMedicalBillCount.mockResolvedValueOnce(1);
    const unpaidCloseReq = new NextRequest('http://localhost/api/v1/manager/cases', {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({
        caseId: 'case-mgr-1',
        status: 'CLOSED',
      }),
    });
    const unpaidCloseRes = await putManagerCases(unpaidCloseReq);
    expect(unpaidCloseRes.status).toBe(400);
    expect(mockCaseUpdate).not.toHaveBeenCalled();
  });

  it('GET /api/v1/manager/cases and GET /api/v1/admin/cases mask patient passportNo and travelLogistics attendant passports', async () => {
    const patCipher = encrypt('P98765432');
    const attCipher = encrypt('A11223344');

    mockCaseFindMany.mockResolvedValueOnce([
      {
        id: 'case-phi-1',
        patientId: 'pat-1',
        managerId: 'mgr-1',
        status: 'PLAN_CONFIRMED',
        travelLogistics: {
          attendants: [{ fullName: 'Sara Ali', passportNo: attCipher, relation: 'Sister' }],
        },
        patient: {
          id: 'pat-1',
          passportNo: patCipher,
          user: { fullName: 'Tariq Ali', email: 'tariq@example.com', phone: '+96890001111' },
        },
      },
    ]);

    const mgrRes = await getManagerCases(
      new NextRequest('http://localhost/api/v1/manager/cases', {
        method: 'GET',
        headers: managerHeaders,
      })
    );
    expect(mgrRes.status).toBe(200);
    const mgrJson = await mgrRes.json();
    expect(mgrJson.cases[0].patient.passportNo).toBe('*****5432');
    expect(mgrJson.cases[0].travelLogistics.attendants[0].passportNo).toBe('*****3344');

    mockCaseFindMany.mockResolvedValueOnce([
      {
        id: 'case-phi-1',
        patientId: 'pat-1',
        managerId: 'mgr-1',
        status: 'PLAN_CONFIRMED',
        travelLogistics: {
          attendants: [{ fullName: 'Sara Ali', passportNo: attCipher, relation: 'Sister' }],
        },
        patient: {
          id: 'pat-1',
          passportNo: patCipher,
          user: { fullName: 'Tariq Ali', email: 'tariq@example.com' },
        },
        manager: { id: 'mgr-1', fullName: 'Coordinator 1' },
        _count: { appointments: 1 },
      },
    ]);
    mockCaseCount.mockResolvedValueOnce(1);

    const adminRes = await getAdminCases(
      new NextRequest('http://localhost/api/v1/admin/cases', {
        method: 'GET',
        headers: adminHeaders,
      })
    );
    expect(adminRes.status).toBe(200);
    const adminJson = await adminRes.json();
    expect(adminJson.data.cases[0].patient.passportNo).toBe('*****5432');
    expect(adminJson.data.cases[0].travelLogistics.attendants[0].passportNo).toBe('*****3344');
  });
});
