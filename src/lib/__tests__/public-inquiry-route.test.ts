import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    referralPartner: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
    },
    lead: {
      create: jest.fn(),
    },
    leadActivity: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { POST as submitPublicInquiry } from '@/app/api/v1/public/inquiries/route';
import { resetPublicInquiryRateLimitForTests } from '@/lib/services/leads-crm.service';

const mockedPrisma = prisma as unknown as {
  referralPartner: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  systemConfig: Record<string, jest.Mock>;
  lead: Record<string, jest.Mock>;
  leadActivity: Record<string, jest.Mock>;
  notification: Record<string, jest.Mock>;
};

describe('POST /api/v1/public/inquiries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPublicInquiryRateLimitForTests();
    mockedPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockedPrisma.referralPartner.findUnique.mockResolvedValue(null);
    mockedPrisma.user.findMany.mockResolvedValue([]);
    mockedPrisma.leadActivity.create.mockResolvedValue({ id: 'act-1' });
    mockedPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockedPrisma.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'internal-secret-lead-id',
      createdAt: new Date('2026-11-25T10:00:00.000Z'),
      ...data,
    }));
  });

  const validPayload = {
    fullName: 'Fatima Al-Balushi',
    phone: '+96891234567',
    nationality: 'Oman',
    preferredLanguage: 'Arabic',
    medicalCondition: 'Need second opinion for mitral valve repair in New Delhi',
    specialtyInterest: 'CARDIOLOGY',
    urgencyLevel: 'SEMI_URGENT',
  };

  it('creates an inquiry and returns only { referenceNo, slaMinutes, temperature } without leaking internal IDs', async () => {
    const req = new NextRequest('http://localhost/api/v1/public/inquiries', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.24',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await submitPublicInquiry(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.referenceNo).toMatch(/^LD-\d{4}-[A-Z0-9]{6}$/);
    expect(json.data.slaMinutes).toBe(60);
    expect(['HOT', 'WARM', 'COLD']).toContain(json.data.temperature);
    expect(json.data.id).toBeUndefined();
    expect(mockedPrisma.lead.create).toHaveBeenCalledTimes(1);
  });

  it('silently drops honeypot-filled spam (websiteUrl non-empty) with a fake 200 and zero DB writes', async () => {
    const req = new NextRequest('http://localhost/api/v1/public/inquiries', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.50',
      },
      body: JSON.stringify({
        ...validPayload,
        websiteUrl: 'https://spam-bot.example.com',
      }),
    });

    const res = await submitPublicInquiry(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.referenceNo).toMatch(/^LD-\d{4}-[A-Z0-9]{6}$/);
    expect(json.data.slaMinutes).toBe(60);
    expect(json.data.temperature).toBe('WARM');
    expect(mockedPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('blocks the 6th submission from the same IP within 15 minutes with 429 RATE_LIMIT_EXCEEDED', async () => {
    const ip = '198.51.100.99';

    for (let i = 0; i < 5; i += 1) {
      const req = new NextRequest('http://localhost/api/v1/public/inquiries', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify(validPayload),
      });
      const res = await submitPublicInquiry(req);
      expect(res.status).toBe(201);
    }

    const sixthReq = new NextRequest('http://localhost/api/v1/public/inquiries', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify(validPayload),
    });
    const sixthRes = await submitPublicInquiry(sixthReq);
    const sixthJson = await sixthRes.json();

    expect(sixthRes.status).toBe(429);
    expect(sixthJson.success).toBe(false);
    expect(sixthJson.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(mockedPrisma.lead.create).toHaveBeenCalledTimes(5);
  });

  it('returns 422 VALIDATION_ERROR when phone and email are both missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/public/inquiries', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.77',
      },
      body: JSON.stringify({
        fullName: 'Test User',
        nationality: 'UAE',
        medicalCondition: 'Need cardiac consultation',
      }),
    });

    const res = await submitPublicInquiry(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
