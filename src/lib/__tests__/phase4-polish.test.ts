import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { patientProfileSchema } from '@/lib/validation/schemas';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patientMedicalProfile: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import { PUT as putPatientProfile } from '@/app/api/v1/patient/profile/route';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>> & {
  $transaction: jest.Mock;
};

describe('Task 4: Profile Country Code, Seed Idempotency & Dependency Hygiene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockedPrisma)
    );
    mockedPrisma.auditLog.create.mockResolvedValue({});
  });

  it('persists emergencyContact.countryCode in patientProfileSchema and PUT /api/v1/patient/profile', async () => {
    const parsed = patientProfileSchema.safeParse({
      bloodGroup: 'O+',
      emergencyContact: {
        name: 'Fatima Al-Mansoor',
        countryCode: '+968',
        phone: '91 234 567',
        relation: 'Spouse',
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.emergencyContact?.countryCode).toBe('+968');
    }

    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', passportNo: '' });
    mockedPrisma.patient.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pat-1',
      passportNo: '',
      ...data,
    }));
    mockedPrisma.patient.findUnique.mockImplementation(async () => ({
      id: 'pat-1',
      passportNo: '',
      bloodGroup: 'O+',
      primaryLanguage: 'Arabic',
      emergencyContact: {
        name: 'Fatima Al-Mansoor',
        countryCode: '+968',
        phone: '91234567',
        relation: 'Spouse',
      },
      medicalProfile: null,
    }));
    mockedPrisma.patientMedicalProfile.upsert.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        bloodGroup: 'O+',
        primaryLanguage: 'Arabic',
        emergencyContact: {
          name: 'Fatima Al-Mansoor',
          countryCode: '+968',
          phone: '91234567',
          relation: 'Spouse',
        },
        allergies: ['Penicillin'],
      }),
    });
    const res = await putPatientProfile(req);
    expect(res.status).toBe(200);
    expect(mockedPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emergencyContact: {
            name: 'Fatima Al-Mansoor',
            countryCode: '+968',
            phone: '91234567',
            relation: 'Spouse',
          },
        }),
      })
    );
  });

  it('handles empty emergencyContact gracefully and rejects invalid partial emergencyContact in PUT /api/v1/patient/profile', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1', passportNo: '' });
    mockedPrisma.patient.update.mockResolvedValue({ id: 'pat-1', passportNo: '' });
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: 'pat-1',
      passportNo: '',
      bloodGroup: 'A+',
      medicalProfile: null,
    });
    mockedPrisma.patientMedicalProfile.upsert.mockResolvedValue({});

    const emptyEcReq = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        bloodGroup: 'A+',
        emergencyContact: {
          name: '',
          countryCode: '+971',
          phone: '',
          relation: '',
        },
        allergies: ['Latex'],
      }),
    });
    const emptyRes = await putPatientProfile(emptyEcReq);
    expect(emptyRes.status).toBe(200);

    const invalidEcReq = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        emergencyContact: {
          name: 'A',
          countryCode: 'invalid',
          phone: '12',
          relation: 'Spouse',
        },
      }),
    });
    const invalidRes = await putPatientProfile(invalidEcReq);
    expect(invalidRes.status).toBe(400);
  });

  it('removes unused runtime shelfware from package.json and keeps seed.ts idempotent', () => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    expect(pkgJson.dependencies.bullmq).toBeUndefined();
    expect(pkgJson.dependencies.ioredis).toBeUndefined();
    expect(pkgJson.dependencies.jsonwebtoken).toBeUndefined();
    expect(pkgJson.dependencies.cookie).toBeUndefined();

    const seedSource = fs.readFileSync(
      path.join(process.cwd(), 'prisma', 'seed.ts'),
      'utf8'
    );
    expect(seedSource).toContain('prisma.clinicalStep.deleteMany');
    expect(seedSource).toContain('prisma.systemConfig.upsert');
  });
});
