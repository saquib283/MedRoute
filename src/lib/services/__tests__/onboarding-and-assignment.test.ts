const mockTxUserCreate = jest.fn();
const mockTxPatientCreate = jest.fn();
const mockTxPatientUpdate = jest.fn();
const mockTxPatientFindUnique = jest.fn();
const mockTxMedicalProfileCreate = jest.fn();
const mockTxCaseCreate = jest.fn();
const mockTxCaseUpdateMany = jest.fn();
const mockTxCaseFindMany = jest.fn();
const mockTxAuditCreate = jest.fn();
const mockTxNotificationCreateMany = jest.fn();

const mockUserFindUnique = jest.fn();
const mockUserFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    $transaction: async <T>(fn: (tx: Record<string, unknown>) => Promise<T>) =>
      fn({
        user: { create: mockTxUserCreate },
        patient: {
          create: mockTxPatientCreate,
          update: mockTxPatientUpdate,
          findUnique: mockTxPatientFindUnique,
        },
        patientMedicalProfile: { create: mockTxMedicalProfileCreate },
        case: {
          create: mockTxCaseCreate,
          updateMany: mockTxCaseUpdateMany,
          findMany: mockTxCaseFindMany,
        },
        auditLog: { create: mockTxAuditCreate },
        notification: { createMany: mockTxNotificationCreateMany },
      }),
  },
}));

import { onboardPatient, createCaseForPatient } from '../onboarding.service';
import { assignPatientCoordinator } from '../case-assignment.service';

describe('Onboarding & Atomic Coordinator Assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
  });

  it('onboardPatient creates User + Patient (encrypted passportNo) + MedicalProfile + initial Case with synced manager', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserFindMany.mockResolvedValue([{ id: 'mgr-1', _count: { managedCases: 2 } }]);
    mockTxUserCreate.mockResolvedValue({ id: 'u-pat-1', email: 'new@pat.com', fullName: 'Sara Ali', role: 'PATIENT', isActive: true });
    mockTxPatientCreate.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', assignedManagerId: 'mgr-1' });
    mockTxMedicalProfileCreate.mockResolvedValue({ id: 'mp-1', patientId: 'pat-1' });
    mockTxCaseCreate.mockResolvedValue({ id: 'case-1', patientId: 'pat-1', managerId: 'mgr-1', status: 'INQUIRY_RECEIVED' });

    const res = await onboardPatient({
      email: 'new@pat.com',
      password: 'Password@123',
      fullName: 'Sara Ali',
      nationality: 'Oman',
      passportNo: 'OM998877',
      dob: '1990-05-10',
      medicalCondition: 'Knee replacement inquiry',
    });

    expect(res.ok).toBe(true);
    const createdPatientData = mockTxPatientCreate.mock.calls[0][0].data;
    expect(createdPatientData.passportNo).not.toBe('OM998877');
    expect(createdPatientData.passportNo.split(':')).toHaveLength(3);
    expect(createdPatientData.assignedManagerId).toBe('mgr-1');
    expect(mockTxCaseCreate.mock.calls[0][0].data.managerId).toBe('mgr-1');
    expect(mockTxMedicalProfileCreate).toHaveBeenCalledWith({
      data: { patientId: 'pat-1' },
    });
    expect(mockTxAuditCreate).toHaveBeenCalledTimes(1);
  });

  it('onboardPatient rejects duplicate normalized email with 409 USER_ALREADY_EXISTS', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'existing-1', email: 'new@pat.com' });

    const res = await onboardPatient({
      email: '  NEW@Pat.Com ',
      password: 'Password@123',
      fullName: 'Sara Ali',
      nationality: 'Oman',
      passportNo: 'OM998877',
      dob: '1990-05-10',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.code).toBe('USER_ALREADY_EXISTS');
    }
    expect(mockTxUserCreate).not.toHaveBeenCalled();
  });

  it('createCaseForPatient creates INQUIRY_RECEIVED case and syncs unset Patient.assignedManagerId', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'mgr-1', fullName: 'Coord One', role: 'MANAGER', isActive: true });
    mockTxPatientFindUnique.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', assignedManagerId: null });
    mockTxCaseCreate.mockResolvedValue({ id: 'case-2', patientId: 'pat-1', managerId: 'mgr-1', status: 'INQUIRY_RECEIVED' });

    const res = await createCaseForPatient({
      patientId: 'pat-1',
      managerId: 'mgr-1',
      notes: 'Follow-up cardiology evaluation',
      isUrgent: true,
      actorId: 'mgr-1',
    });

    expect(res.ok).toBe(true);
    expect(mockTxCaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'pat-1',
          managerId: 'mgr-1',
          status: 'INQUIRY_RECEIVED',
          isUrgent: true,
        }),
      })
    );
    expect(mockTxPatientUpdate).toHaveBeenCalledWith({
      where: { id: 'pat-1' },
      data: { assignedManagerId: 'mgr-1' },
    });
    expect(mockTxCaseUpdateMany).toHaveBeenCalledWith({
      where: { patientId: 'pat-1', status: { not: 'CLOSED' } },
      data: { managerId: 'mgr-1' },
    });
    expect(mockTxAuditCreate).toHaveBeenCalledTimes(1);
  });

  it('createCaseForPatient blocks MANAGER from creating a case for a patient assigned to another coordinator', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'mgr-1', fullName: 'Coord One', role: 'MANAGER', isActive: true });
    mockTxPatientFindUnique.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', assignedManagerId: 'mgr-other' });

    const res = await createCaseForPatient({
      patientId: 'pat-1',
      managerId: 'mgr-1',
      actorId: 'mgr-1',
      callerRole: 'MANAGER',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.code).toBe('FORBIDDEN');
    }
    expect(mockTxCaseCreate).not.toHaveBeenCalled();
    expect(mockTxPatientUpdate).not.toHaveBeenCalled();
  });

  it('assignPatientCoordinator updates BOTH Patient.assignedManagerId and open Case.managerId', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'mgr-2', fullName: 'New Coord', role: 'MANAGER', isActive: true });
    mockTxPatientFindUnique.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', assignedManagerId: 'mgr-1' });
    mockTxCaseFindMany.mockResolvedValue([{ id: 'case-1', patientId: 'pat-1', managerId: 'mgr-1', status: 'UNDER_REVIEW' }]);

    const res = await assignPatientCoordinator({
      patientId: 'pat-1',
      managerId: 'mgr-2',
      actorId: 'admin-1',
    });

    expect(res.ok).toBe(true);
    expect(mockTxPatientUpdate).toHaveBeenCalledWith({
      where: { id: 'pat-1' },
      data: { assignedManagerId: 'mgr-2' },
    });
    expect(mockTxCaseUpdateMany).toHaveBeenCalledWith({
      where: { patientId: 'pat-1', status: { not: 'CLOSED' } },
      data: { managerId: 'mgr-2' },
    });
    expect(mockTxAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockTxNotificationCreateMany).toHaveBeenCalledTimes(1);
  });

  it('assignPatientCoordinator with caseIds updates sibling non-CLOSED cases AND syncs affected Patient.assignedManagerId', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'mgr-3', fullName: 'Coord Three', role: 'MANAGER', isActive: true });
    mockTxCaseFindMany.mockResolvedValue([
      { id: 'case-10', patientId: 'pat-10', managerId: 'mgr-1', status: 'INQUIRY_RECEIVED' },
      { id: 'case-11', patientId: 'pat-11', managerId: 'mgr-1', status: 'PLAN_CONFIRMED' },
    ]);
    mockTxPatientFindUnique
      .mockResolvedValueOnce({ id: 'pat-10', userId: 'u-pat-10', assignedManagerId: 'mgr-1' })
      .mockResolvedValueOnce({ id: 'pat-11', userId: 'u-pat-11', assignedManagerId: 'mgr-1' });

    const res = await assignPatientCoordinator({
      caseIds: ['case-10', 'case-11'],
      managerId: 'mgr-3',
      actorId: 'admin-1',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reassignedCount).toBe(2);
    }
    expect(mockTxCaseUpdateMany).toHaveBeenCalledWith({
      where: { patientId: { in: ['pat-10', 'pat-11'] }, status: { not: 'CLOSED' } },
      data: { managerId: 'mgr-3' },
    });
    expect(mockTxPatientUpdate).toHaveBeenCalledWith({
      where: { id: 'pat-10' },
      data: { assignedManagerId: 'mgr-3' },
    });
    expect(mockTxPatientUpdate).toHaveBeenCalledWith({
      where: { id: 'pat-11' },
      data: { assignedManagerId: 'mgr-3' },
    });
  });

  it('assignPatientCoordinator with caseIds rejects when all target cases are CLOSED or missing', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'mgr-3', fullName: 'Coord Three', role: 'MANAGER', isActive: true });
    mockTxCaseFindMany.mockResolvedValue([
      { id: 'case-closed', patientId: 'pat-10', managerId: 'mgr-1', status: 'CLOSED' },
    ]);

    const res = await assignPatientCoordinator({
      caseIds: ['case-closed'],
      managerId: 'mgr-3',
      actorId: 'admin-1',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.code).toBe('CASE_ALREADY_CLOSED');
    }
    expect(mockTxCaseUpdateMany).not.toHaveBeenCalled();
    expect(mockTxPatientUpdate).not.toHaveBeenCalled();
  });

  it('assignPatientCoordinator rejects inactive or missing target manager', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await assignPatientCoordinator({
      patientId: 'pat-1',
      managerId: 'mgr-missing',
      actorId: 'admin-1',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
    }
    expect(mockTxPatientUpdate).not.toHaveBeenCalled();
  });
});

