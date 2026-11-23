import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patient: { groupBy: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn() },
    appointment: { groupBy: jest.fn(), count: jest.fn() },
    hospital: { findMany: jest.fn(), count: jest.fn() },
    doctor: { findMany: jest.fn(), count: jest.fn() },
    case: { count: jest.fn(), findMany: jest.fn() },
    emailCampaign: { count: jest.fn() },
    emailTemplate: { count: jest.fn() },
    medicalBill: { findMany: jest.fn() },
    commissionOverride: { findMany: jest.fn() },
    hotelBooking: { findMany: jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import {
  buildLast12MonthBuckets,
  resolveHospitalCommissionRate,
} from '@/lib/services/analytics.service';
import { GET as getAdminAnalytics } from '@/app/api/v1/admin/analytics/route';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>>;

function setupBaselineMocks() {
  mockedPrisma.patient.groupBy.mockResolvedValue([{ nationality: 'Oman', _count: { id: 2 } }]);
  mockedPrisma.user.findMany.mockResolvedValue([]);
  mockedPrisma.appointment.groupBy.mockResolvedValue([]);
  mockedPrisma.hospital.findMany.mockResolvedValue([
    {
      id: 'hosp-1',
      name: 'Apollo Hospital',
      city: 'New Delhi',
      commissionRate: 10,
      _count: { appointments: 4, doctors: 2 },
    },
  ]);
  mockedPrisma.doctor.findMany.mockResolvedValue([]);
  mockedPrisma.case.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
  mockedPrisma.case.findMany.mockResolvedValue([]);
  mockedPrisma.appointment.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
  mockedPrisma.user.count.mockResolvedValue(10);
  mockedPrisma.patient.count.mockResolvedValue(4);
  mockedPrisma.hospital.count.mockResolvedValue(1);
  mockedPrisma.doctor.count.mockResolvedValue(2);
  mockedPrisma.emailCampaign.count.mockResolvedValue(1);
  mockedPrisma.emailTemplate.count.mockResolvedValue(2);
  mockedPrisma.commissionOverride.findMany.mockResolvedValue([]);
  mockedPrisma.medicalBill.findMany.mockResolvedValue([]);
  mockedPrisma.hotelBooking.findMany.mockResolvedValue([]);
}

describe('Task 4: Financial Analytics & CommissionOverride Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds 12 unique contiguous YYYY-MM buckets without skipping February on the 31st of a month', () => {
    const march31 = new Date('2026-03-31T23:59:59.000Z');
    const { startDate, monthKeys } = buildLast12MonthBuckets(march31);
    expect(monthKeys).toHaveLength(12);
    expect(new Set(monthKeys).size).toBe(12);
    expect(monthKeys).toContain('2026-02');
    expect(monthKeys[0]).toBe('2025-04');
    expect(monthKeys[11]).toBe('2026-03');
    expect(startDate.toISOString()).toBe('2025-04-01T00:00:00.000Z');

    const may31 = new Date('2026-05-31T12:00:00.000Z');
    const mayBuckets = buildLast12MonthBuckets(may31);
    expect(mayBuckets.monthKeys).toHaveLength(12);
    expect(new Set(mayBuckets.monthKeys).size).toBe(12);
    expect(mayBuckets.monthKeys).toContain('2026-04');
    expect(mayBuckets.monthKeys).toContain('2026-02');
    expect(mayBuckets.monthKeys[11]).toBe('2026-05');
  });

  it('resolves active date-bound CommissionOverride rates and falls back to base hospital rate outside window', () => {
    const overrides = [
      {
        rate: 22.5,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.000Z'),
        createdAt: new Date('2026-10-25T00:00:00.000Z'),
      },
      {
        rate: 25,
        startDate: new Date('2026-11-10T00:00:00.000Z'),
        endDate: new Date('2026-11-20T23:59:59.000Z'),
        createdAt: new Date('2026-11-02T00:00:00.000Z'),
      },
    ];

    // Matches latest overlapping override by createdAt desc
    const insideBoth = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-11-15T10:00:00.000Z')
    );
    expect(insideBoth).toEqual({ rate: 25, hasActiveOverride: true });

    // Matches the wider override only
    const insideFirstOnly = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-11-05T10:00:00.000Z')
    );
    expect(insideFirstOnly).toEqual({ rate: 22.5, hasActiveOverride: true });

    // Boundary inclusive check
    const onStartBoundary = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-11-01T00:00:00.000Z')
    );
    expect(onStartBoundary).toEqual({ rate: 22.5, hasActiveOverride: true });

    // Outside all override windows
    const outside = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-12-05T10:00:00.000Z')
    );
    expect(outside).toEqual({ rate: 12, hasActiveOverride: false });
  });

  it('aggregates MedicalBill, CommissionOverride, and non-cancelled HotelBooking revenue in GET /api/v1/admin/analytics', async () => {
    setupBaselineMocks();

    // Override active during bill-1 (20% instead of 10%), expired override for historical bill-2
    mockedPrisma.commissionOverride.findMany.mockResolvedValue([
      {
        id: 'ov-1',
        hospitalId: 'hosp-1',
        rate: 20,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    ]);
    mockedPrisma.medicalBill.findMany.mockResolvedValue([
      {
        id: 'bill-1',
        hospitalId: 'hosp-1',
        totalAmount: 5000,
        paidAmount: 3000,
        status: 'PARTIALLY_PAID',
        createdAt: new Date('2026-11-20T10:00:00.000Z'),
      },
    ]);
    mockedPrisma.hotelBooking.findMany.mockResolvedValue([
      { id: 'bk-1', totalAmountUsd: 800, commissionAmountUsd: 120, status: 'CONFIRMED' },
    ]);

    const req = new NextRequest('http://localhost/api/v1/admin/analytics', {
      headers: { 'x-user-id': 'adm-1', 'x-user-email': 'a@example.com', 'x-user-role': 'ADMIN' },
    });
    const res = await getAdminAnalytics(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revenueEstimates.medicalBilling).toEqual({
      totalInvoiced: 5000,
      totalCollected: 3000,
      totalOutstanding: 2000,
      estimatedHospitalCommission: 1000, // 20% override of 5000
    });
    expect(json.data.revenueEstimates.accommodations).toEqual({
      activeBookings: 1,
      grossRevenueUsd: 800,
      partnerCommissionUsd: 120,
    });
    expect(json.data.monthlyRegistrations).toHaveLength(12);
    expect(json.data.hospitalUtilization[0]).toMatchObject({
      id: 'hosp-1',
      commissionRate: 10,
    });
  });

  it('excludes CANCELLED bills/bookings, applies date-bound vs base rates per bill, and computes active override status', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T10:00:00.000Z'));

    try {
      setupBaselineMocks();
      mockedPrisma.user.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-15T12:00:00.000Z'), role: 'PATIENT' },
        { createdAt: new Date('2026-11-23T00:15:00.000Z'), role: 'DOCTOR' },
      ]);
      mockedPrisma.commissionOverride.findMany.mockResolvedValue([
        {
          id: 'ov-active',
          hospitalId: 'hosp-1',
          rate: 18,
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-30T23:59:59.000Z'),
          createdAt: new Date('2026-11-01T00:00:00.000Z'),
        },
        {
          id: 'ov-past',
          hospitalId: 'hosp-1',
          rate: 25,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-30T23:59:59.000Z'),
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      ]);
      mockedPrisma.medicalBill.findMany.mockResolvedValue([
        {
          id: 'bill-active-ov',
          hospitalId: 'hosp-1',
          totalAmount: 1000.5,
          paidAmount: 400.25,
          status: 'PARTIALLY_PAID',
          createdAt: new Date('2026-11-10T10:00:00.000Z'), // 18% = 180.09
        },
        {
          id: 'bill-base-rate',
          hospitalId: 'hosp-1',
          totalAmount: 2000,
          paidAmount: 2500, // overpayment clamp check for outstanding
          status: 'PAID',
          createdAt: new Date('2026-10-10T10:00:00.000Z'), // 10% base = 200
        },
        {
          id: 'bill-cancelled',
          hospitalId: 'hosp-1',
          totalAmount: 9999,
          paidAmount: 9999,
          status: 'CANCELLED',
          createdAt: new Date('2026-11-12T10:00:00.000Z'),
        },
      ]);
      mockedPrisma.hotelBooking.findMany.mockResolvedValue([
        { id: 'bk-1', totalAmountUsd: 500.25, commissionAmountUsd: 75.04, status: 'CHECKED_IN' },
        { id: 'bk-2', totalAmountUsd: 900, commissionAmountUsd: 135, status: 'CANCELLED' },
      ]);

      const req = new NextRequest('http://localhost/api/v1/admin/analytics', {
        headers: { 'x-user-id': 'adm-1', 'x-user-email': 'a@example.com', 'x-user-role': 'ADMIN' },
      });
      const res = await getAdminAnalytics(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.revenueEstimates.activeCommissionOverrides).toBe(1);
      expect(json.data.revenueEstimates.medicalBilling).toEqual({
        totalInvoiced: 3000.5,
        totalCollected: 2900.25,
        totalOutstanding: 600.25,
        estimatedHospitalCommission: 380.09,
      });
      expect(json.data.revenueEstimates.accommodations).toEqual({
        activeBookings: 1,
        grossRevenueUsd: 500.25,
        partnerCommissionUsd: 75.04,
      });
      expect(json.data.hospitalUtilization[0]).toMatchObject({
        id: 'hosp-1',
        commissionRate: 10,
        effectiveCommissionRate: 18,
        hasActiveOverride: true,
      });
      const febBucket = json.data.monthlyRegistrations.find(
        (m: { month: string }) => m.month === '2026-02'
      );
      const novBucket = json.data.monthlyRegistrations.find(
        (m: { month: string }) => m.month === '2026-11'
      );
      expect(febBucket?.patients).toBe(1);
      expect(novBucket?.doctors).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns 403 FORBIDDEN for non-ADMIN callers', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/analytics', {
      headers: { 'x-user-id': 'mgr-1', 'x-user-email': 'm@example.com', 'x-user-role': 'MANAGER' },
    });
    const res = await getAdminAnalytics(req);
    expect(res.status).toBe(403);
  });
});
