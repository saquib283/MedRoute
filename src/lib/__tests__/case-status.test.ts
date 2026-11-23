const mockCaseFindMany = jest.fn();
const mockCaseCount = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockCaseUpdate = jest.fn();
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
import { GET as getAdminEscalations, PUT as putAdminEscalations } from '@/app/api/v1/admin/escalations/route';
import { PUT as putAdminCases } from '@/app/api/v1/admin/cases/route';

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
