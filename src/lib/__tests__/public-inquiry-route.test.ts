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
import { publicInquirySchema } from '@/lib/validation/leads-crm-schemas';

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

  it('attributes B2B ?ref= partner code, UTM tags, and preferredTravelWindow on submission', async () => {
    mockedPrisma.referralPartner.findUnique.mockResolvedValueOnce({
      id: 'partner-om-01',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/v1/public/inquiries', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.88',
      },
      body: JSON.stringify({
        ...validPayload,
        email: '',
        preferredTravelWindow: 'WITHIN_30D',
        hasDiagnosticReports: true,
        passportReady: true,
        referralCode: 'oman-care-01',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'cardiac-2026',
      }),
    });

    const res = await submitPublicInquiry(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(mockedPrisma.referralPartner.findUnique).toHaveBeenCalledWith({
      where: { code: 'OMAN-CARE-01' },
      select: { id: true, isActive: true },
    });
    expect(mockedPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          source: 'B2B_PARTNER',
          referralPartnerId: 'partner-om-01',
          preferredTravelWindow: 'WITHIN_30D',
          hasDiagnosticReports: true,
          passportReady: true,
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'cardiac-2026',
        }),
      })
    );
  });
});

describe('publicInquirySchema validation & normalization', () => {
  it('normalizes empty optional strings to null while preserving valid attribution and travel window', () => {
    const parsed = publicInquirySchema.safeParse({
      fullName: '  Ahmed Al-Harthy  ',
      email: '   ',
      phone: '+96891234567',
      whatsappNumber: '',
      nationality: 'Oman',
      countryOfResidence: '',
      preferredLanguage: '   ',
      medicalCondition: 'Seeking orthopedic consultation for total knee replacement',
      specialtyInterest: '',
      urgencyLevel: 'ROUTINE',
      hasDiagnosticReports: false,
      passportReady: false,
      preferredTravelWindow: '',
      estimatedBudgetUsd: '',
      referralCode: 'PARTNER-GCC',
      utmSource: 'meta',
      utmMedium: '',
      utmCampaign: 'ortho_q4',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.fullName).toBe('Ahmed Al-Harthy');
    expect(parsed.data.email).toBeNull();
    expect(parsed.data.whatsappNumber).toBeNull();
    expect(parsed.data.countryOfResidence).toBeNull();
    expect(parsed.data.preferredLanguage).toBeNull();
    expect(parsed.data.specialtyInterest).toBeNull();
    expect(parsed.data.preferredTravelWindow).toBeNull();
    expect(parsed.data.estimatedBudgetUsd).toBeNull();
    expect(parsed.data.referralCode).toBe('PARTNER-GCC');
    expect(parsed.data.utmSource).toBe('meta');
    expect(parsed.data.utmMedium).toBeNull();
    expect(parsed.data.utmCampaign).toBe('ortho_q4');
  });

  it('accepts all valid PREFERRED_TRAVEL_WINDOWS and enforces minimum medical description clarity', () => {
    const tooShort = publicInquirySchema.safeParse({
      fullName: 'Sara Ali',
      email: 'sara@example.com',
      nationality: 'Kenya',
      medicalCondition: 'pain',
      preferredTravelWindow: 'IMMEDIATE_7D',
    });

    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      expect(tooShort.error.flatten().fieldErrors.medicalCondition).toBeDefined();
    }

    const validWindow = publicInquirySchema.safeParse({
      fullName: 'Sara Ali',
      email: 'sara@example.com',
      nationality: 'Kenya',
      medicalCondition: 'Chronic lumbar disc herniation requiring spine opinion',
      preferredTravelWindow: 'IMMEDIATE_7D',
    });

    expect(validWindow.success).toBe(true);
    if (validWindow.success) {
      expect(validWindow.data.preferredTravelWindow).toBe('IMMEDIATE_7D');
    }
  });
});
