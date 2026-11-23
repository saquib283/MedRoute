import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/jwt', () => ({
  signAccessToken: jest.fn(async (payload: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  ),
  verifyAccessToken: jest.fn(async (token: string) =>
    JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
  ),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    patient: {
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    hospital: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    hotel: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  clearSystemSettingsCache,
  getSystemSettings,
  updateSystemSettings,
  checkMaintenanceActive,
  assertManagerCapacity,
} from '@/lib/services/system-settings.service';
import { assignPatientCoordinator } from '@/lib/services/case-assignment.service';
import { POST as postHospital } from '@/app/api/v1/admin/hospitals/route';
import { POST as postAccommodation } from '@/app/api/v1/accommodations/route';
import proxy from '@/proxy';
import { signAccessToken } from '@/lib/auth/jwt';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>> & {
  $transaction: jest.Mock;
};

describe('Task 1: SystemConfig Governance Service & Runtime Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSystemSettingsCache();
    mockedPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(mockedPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('reads and updates SystemConfig rows in DB and invalidates cache immediately', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValueOnce([
      { key: 'maxPatientsPerManager', value: '12' },
      { key: 'defaultCommissionRate', value: '14.5' },
      { key: 'maintenanceMode', value: 'false' },
      { key: 'sessionTimeoutMinutes', value: '30' },
      { key: 'maintenanceStart', value: '""' },
      { key: 'maintenanceEnd', value: '""' },
      { key: 'alertBannerText', value: '"Sunday Window"' },
    ]);

    const initial = await getSystemSettings();
    expect(initial.maxPatientsPerManager).toBe(12);
    expect(initial.defaultCommissionRate).toBe(14.5);
    expect(initial.sessionTimeoutMinutes).toBe(30);
    expect(initial.alertBannerText).toBe('Sunday Window');

    mockedPrisma.systemConfig.upsert.mockResolvedValue({});
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const res = await updateSystemSettings(
      {
        maxPatientsPerManager: 8,
        defaultCommissionRate: 16,
        maintenanceMode: true,
        sessionTimeoutMinutes: 20,
        maintenanceStart: '',
        maintenanceEnd: '',
        alertBannerText: 'Maintenance Active',
      },
      { userId: 'adm-1', ipAddress: '127.0.0.1' }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.maxPatientsPerManager).toBe(8);
      expect(res.data.maintenanceMode).toBe(true);
    }
    expect(mockedPrisma.systemConfig.upsert).toHaveBeenCalledTimes(7);
  });

  it('rejects updateSystemSettings when maintenanceEnd is not after maintenanceStart', async () => {
    const res = await updateSystemSettings(
      {
        maxPatientsPerManager: 25,
        defaultCommissionRate: 10,
        maintenanceMode: false,
        sessionTimeoutMinutes: 15,
        maintenanceStart: '2026-11-23T12:00:00.000Z',
        maintenanceEnd: '2026-11-23T10:00:00.000Z',
        alertBannerText: '',
      },
      { userId: 'adm-1' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
    }
    expect(mockedPrisma.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it('enforces checkMaintenanceActive for manual toggle and scheduled window while bypassing ADMIN', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maintenanceMode', value: 'false' },
      { key: 'maintenanceStart', value: '"2026-11-23T10:00:00.000Z"' },
      { key: 'maintenanceEnd', value: '"2026-11-23T12:00:00.000Z"' },
    ]);

    const duringWindow = new Date('2026-11-23T11:00:00.000Z');
    expect(await checkMaintenanceActive('PATIENT', duringWindow)).toBe(true);
    expect(await checkMaintenanceActive('MANAGER', duringWindow)).toBe(true);
    expect(await checkMaintenanceActive('ADMIN', duringWindow)).toBe(false);

    const outsideWindow = new Date('2026-11-23T14:00:00.000Z');
    expect(await checkMaintenanceActive('PATIENT', outsideWindow)).toBe(false);
  });

  it('blocks non-Admin mutating API calls in proxy.ts with 503 MAINTENANCE_MODE and redirects page navigations when maintenance is active', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maintenanceMode', value: 'true' },
    ]);

    const patToken = await signAccessToken({
      userId: 'u-pat-1',
      email: 'p@example.com',
      role: 'PATIENT',
    });

    const writeReq = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: { authorization: `Bearer ${patToken}` },
    });
    const writeRes = await proxy(writeReq);
    expect(writeRes.status).toBe(503);
    const writeJson = await writeRes.json();
    expect(writeJson.error.code).toBe('MAINTENANCE_MODE');

    const pageReq = new NextRequest('http://localhost/patient/dashboard', {
      method: 'GET',
      headers: { authorization: `Bearer ${patToken}` },
    });
    const pageRes = await proxy(pageReq);
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get('location')).toContain('/login?reason=maintenance');

    // Admin write still passes
    const admToken = await signAccessToken({
      userId: 'u-adm-1',
      email: 'a@example.com',
      role: 'ADMIN',
    });
    const admReq = new NextRequest('http://localhost/api/v1/admin/settings', {
      method: 'PUT',
      headers: { authorization: `Bearer ${admToken}` },
    });
    const admRes = await proxy(admReq);
    expect(admRes.status).toBe(200);
  });

  it('enforces maxPatientsPerManager in assignPatientCoordinator and assertManagerCapacity', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maxPatientsPerManager', value: '2' },
    ]);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      fullName: 'Coord One',
      role: 'MANAGER',
      isActive: true,
    });
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: 'pat-3',
      userId: 'u-pat-3',
      assignedManagerId: null,
    });
    mockedPrisma.patient.count.mockResolvedValue(2); // Already at cap of 2!

    const capCheck = await assertManagerCapacity(mockedPrisma as never, 'mgr-1', 1, ['pat-3']);
    expect(capCheck.ok).toBe(false);

    const noopCheck = await assertManagerCapacity(mockedPrisma as never, 'mgr-1', 0, ['pat-3']);
    expect(noopCheck.ok).toBe(true);

    const reassignRes = await assignPatientCoordinator({
      patientId: 'pat-3',
      managerId: 'mgr-1',
      actorId: 'adm-1',
    });
    expect(reassignRes.ok).toBe(false);
    if (!reassignRes.ok) {
      expect(reassignRes.status).toBe(400);
      expect(reassignRes.message).toMatch(/maximum capacity/i);
    }
  });

  it('rejects mixed-batch bulk caseIds reassignment at maxPatientsPerManager cap while allowing idempotent batch', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maxPatientsPerManager', value: '2' },
    ]);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      fullName: 'Coord One',
      role: 'MANAGER',
      isActive: true,
    });

    const currentlyAssignedToMgr1 = ['pat-1', 'pat-other'];
    mockedPrisma.patient.count.mockImplementation(
      async (args: { where: { assignedManagerId: string; id?: { notIn?: string[] } } }) => {
        const excluded = new Set(args?.where?.id?.notIn ?? []);
        return currentlyAssignedToMgr1.filter((id) => !excluded.has(id)).length;
      }
    );

    // Mixed batch: c-1 belongs to already-assigned pat-1, c-2 belongs to unassigned pat-2
    mockedPrisma.case.findMany.mockResolvedValueOnce([
      { id: 'c-1', patientId: 'pat-1', managerId: 'mgr-1', status: 'UNDER_REVIEW' },
      { id: 'c-2', patientId: 'pat-2', managerId: null, status: 'INQUIRY_RECEIVED' },
    ]);
    mockedPrisma.patient.findUnique
      .mockResolvedValueOnce({ id: 'pat-1', userId: 'u-pat-1', assignedManagerId: 'mgr-1' })
      .mockResolvedValueOnce({ id: 'pat-2', userId: 'u-pat-2', assignedManagerId: null });

    const mixedRes = await assignPatientCoordinator({
      caseIds: ['c-1', 'c-2'],
      managerId: 'mgr-1',
      actorId: 'adm-1',
    });
    expect(mixedRes.ok).toBe(false);
    if (!mixedRes.ok) {
      expect(mixedRes.status).toBe(400);
      expect(mixedRes.message).toMatch(/maximum capacity/i);
    }
    expect(mockedPrisma.patient.count).toHaveBeenCalledWith({
      where: {
        assignedManagerId: 'mgr-1',
        id: { notIn: ['pat-2'] },
      },
    });
    expect(mockedPrisma.case.updateMany).not.toHaveBeenCalled();

    // Idempotent batch: only c-1 belonging to already-assigned pat-1
    mockedPrisma.case.findMany.mockResolvedValueOnce([
      { id: 'c-1', patientId: 'pat-1', managerId: 'mgr-1', status: 'UNDER_REVIEW' },
    ]);
    mockedPrisma.patient.findUnique.mockResolvedValueOnce({
      id: 'pat-1',
      userId: 'u-pat-1',
      assignedManagerId: 'mgr-1',
    });
    mockedPrisma.case.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.patient.update.mockResolvedValue({});
    mockedPrisma.auditLog.create.mockResolvedValue({});
    mockedPrisma.notification.createMany.mockResolvedValue({});

    const idempotentRes = await assignPatientCoordinator({
      caseIds: ['c-1'],
      managerId: 'mgr-1',
      actorId: 'adm-1',
    });
    expect(idempotentRes.ok).toBe(true);
  });

  it('applies defaultCommissionRate on POST /api/v1/admin/hospitals and POST /api/v1/accommodations when omitted', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'defaultCommissionRate', value: '17.5' },
    ]);
    mockedPrisma.hospital.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'hosp-new',
      ...data,
    }));
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const hospReq = new NextRequest('http://localhost/api/v1/admin/hospitals', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Fortis Care',
        city: 'Delhi',
        address: 'Okhla Road',
      }),
    });
    const hospRes = await postHospital(hospReq);
    const hospJson = await hospRes.json();
    expect(hospRes.status).toBe(201);
    expect(hospJson.data.hospital.commissionRate).toBe(17.5);

    mockedPrisma.hotel.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'hotel-new',
      ...data,
    }));

    const hotelReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Oberoi Recovery',
        city: 'Delhi',
        address: 'Dr Zakir Hussain Marg',
        nightlyRateUsd: 160,
      }),
    });
    const hotelRes = await postAccommodation(hotelReq);
    const hotelJson = await hotelRes.json();
    expect(hotelRes.status).toBe(201);
    expect(hotelJson.data.hotel.commissionPercent).toBe(17.5);
  });
});
