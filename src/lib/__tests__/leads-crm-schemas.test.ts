import {
  computeLeadScoreAndTemperature,
  computeLeadFirstResponseDueAt,
  computeLeadSlaState,
  validateLeadStatusTransition,
  buildWhatsAppFollowUpUrl,
  publicInquirySchema,
} from '@/lib/validation/leads-crm-schemas';

describe('Leads CRM Pure Scoring, SLA & Guardrail Engine', () => {
  test('computeLeadScoreAndTemperature scores high-intent urgent B2B cardiac inquiry as HOT (>= 70)', () => {
    const res = computeLeadScoreAndTemperature({
      urgencyLevel: 'URGENT',
      hasDiagnosticReports: true,
      medicalCondition: 'Severe triple vessel coronary artery disease requiring CABG evaluation',
      specialtyInterest: 'CARDIOLOGY',
      passportReady: true,
      preferredTravelWindow: 'IMMEDIATE_7D',
      estimatedBudgetUsd: 12000,
      source: 'B2B_PARTNER',
      email: 'patient@example.com',
      phone: '+96891234567',
    });
    expect(res.score).toBeGreaterThanOrEqual(85);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.temperature).toBe('HOT');
    expect(res.breakdown.length).toBeGreaterThanOrEqual(5);
  });

  test('computeLeadScoreAndTemperature classifies minimal browsing inquiry as COLD (< 40)', () => {
    const res = computeLeadScoreAndTemperature({
      urgencyLevel: 'ROUTINE',
      hasDiagnosticReports: false,
      medicalCondition: 'Knee pain',
      passportReady: false,
      preferredTravelWindow: 'EXPLORING',
      source: 'META_GOOGLE_ADS',
      phone: '+971501112233',
    });
    expect(res.score).toBeLessThan(40);
    expect(res.temperature).toBe('COLD');
  });

  test('computeLeadFirstResponseDueAt assigns 15m for URGENT, 60m for HOT/SEMI_URGENT, and 240m for ROUTINE', () => {
    const base = new Date('2026-11-25T10:00:00.000Z');
    expect(computeLeadFirstResponseDueAt('URGENT', 'WARM', base).toISOString()).toBe(
      '2026-11-25T10:15:00.000Z'
    );
    expect(computeLeadFirstResponseDueAt('ROUTINE', 'HOT', base).toISOString()).toBe(
      '2026-11-25T11:00:00.000Z'
    );
    expect(computeLeadFirstResponseDueAt('ROUTINE', 'COLD', base).toISOString()).toBe(
      '2026-11-25T14:00:00.000Z'
    );
  });

  test('computeLeadSlaState transitions across ACTIVE_WINDOW, DUE_SOON, BREACHED, RESPONDED_ON_TIME, and RESPONDED_LATE', () => {
    const due = new Date('2026-11-25T10:30:00.000Z');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:05:00.000Z'),
      })
    ).toBe('ACTIVE_WINDOW');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:20:00.000Z'),
      })
    ).toBe('DUE_SOON');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:31:00.000Z'),
      })
    ).toBe('BREACHED');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        firstRespondedAt: new Date('2026-11-25T10:12:00.000Z'),
        status: 'CONTACTED',
      })
    ).toBe('RESPONDED_ON_TIME');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        firstRespondedAt: new Date('2026-11-25T10:45:00.000Z'),
        status: 'CONTACTED',
      })
    ).toBe('RESPONDED_LATE');
  });

  test('validateLeadStatusTransition blocks LOST without lostReason, QUOTE_SHARED without quote/hospital, and manual CONVERTED', () => {
    expect(
      validateLeadStatusTransition({ currentStatus: 'NEW', nextStatus: 'LOST' }).allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'NEW',
        nextStatus: 'LOST',
        lostReason: 'PRICE_TOO_HIGH',
      }).allowed
    ).toBe(true);
    expect(
      validateLeadStatusTransition({ currentStatus: 'CLINICAL_REVIEW', nextStatus: 'QUOTE_SHARED' })
        .allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'CLINICAL_REVIEW',
        nextStatus: 'QUOTE_SHARED',
        preliminaryQuoteUsd: 6500,
      }).allowed
    ).toBe(true);
    expect(
      validateLeadStatusTransition({ currentStatus: 'QUALIFIED', nextStatus: 'CONVERTED' }).allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'QUALIFIED',
        nextStatus: 'CONVERTED',
        viaConversionService: true,
      }).allowed
    ).toBe(true);
  });

  test('buildWhatsAppFollowUpUrl strips non-digits and encodes greeting safely', () => {
    const url = buildWhatsAppFollowUpUrl({
      phone: '+968 9123-4567',
      fullName: 'Tariq Al-Said',
      referenceNo: 'LD-2026-00102',
      coordinatorName: 'Priya Nair',
      specialty: 'CARDIOLOGY',
    });
    expect(url).toContain('https://wa.me/96891234567?text=');
    expect(url).toContain('LD-2026-00102');
  });

  test('publicInquirySchema requires phone or email and validates bounds', () => {
    const invalid = publicInquirySchema.safeParse({
      fullName: 'Tariq',
      nationality: 'Oman',
      medicalCondition: 'Need cardiac consult in New Delhi',
    });
    expect(invalid.success).toBe(false);

    const valid = publicInquirySchema.safeParse({
      fullName: 'Tariq Al-Said',
      phone: '+96891234567',
      nationality: 'Oman',
      medicalCondition: 'Need cardiac bypass second opinion and cost estimate',
      urgencyLevel: 'SEMI_URGENT',
    });
    expect(valid.success).toBe(true);
  });
});
