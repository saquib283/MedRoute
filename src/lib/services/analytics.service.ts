/**
 * Afzal Healthcare — Financial & Platform Analytics Service
 * Computes platform operational totals, UTC-safe 12-month registration buckets,
 * date-bound hospital CommissionOverride rates, and MedicalBill / HotelBooking revenue metrics.
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  computeLeadsCrmAnalytics,
  type LeadsFunnelAnalyticsPayload,
} from '@/lib/services/leads-conversion.service';

export interface CommissionOverrideWindow {
  rate: number | Prisma.Decimal;
  startDate: Date | string;
  endDate: Date | string;
  createdAt?: Date | string;
}

export interface MonthlyRegistrationBucket {
  month: string;
  patients: number;
  managers: number;
  doctors: number;
  admins: number;
  total: number;
}

export interface HospitalUtilizationItem {
  id: string;
  name: string;
  city: string;
  appointments: number;
  doctors: number;
  commissionRate: number;
  effectiveCommissionRate: number;
  hasActiveOverride: boolean;
}

export interface PlatformAnalyticsPayload {
  platformTotals: {
    totalUsers: number;
    totalPatients: number;
    totalHospitals: number;
    totalDoctors: number;
    totalAppointments: number;
    totalCases: number;
    totalCampaigns: number;
    totalTemplates: number;
  };
  nationalityDistribution: { nationality: string; count: number }[];
  monthlyRegistrations: MonthlyRegistrationBucket[];
  appointmentTypeBreakdown: { type: string; count: number }[];
  hospitalUtilization: HospitalUtilizationItem[];
  doctorLeaderboard: {
    id: string;
    name: string;
    specialisation: string;
    hospital: string;
    appointments: number;
  }[];
  caseLifecycle: {
    totalCases: number;
    closedCases: number;
    completionRate: number;
    avgDurationDays: number;
  };
  revenueEstimates: {
    completedAppointments: number;
    avgCommissionRate: number;
    activeCommissionOverrides: number;
    medicalBilling: {
      totalInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
      estimatedHospitalCommission: number;
    };
    accommodations: {
      activeBookings: number;
      grossRevenueUsd: number;
      partnerCommissionUsd: number;
    };
  };
  leadsFunnel: LeadsFunnelAnalyticsPayload;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatUtcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Builds 12 contiguous UTC YYYY-MM buckets anchored to day 1 in UTC so
 * month-end timestamps (29th-31st) never roll over and skip shorter months.
 */
export function buildLast12MonthBuckets(now: Date = new Date()): {
  startDate: Date;
  monthKeys: string[];
} {
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth();
  const monthKeys: string[] = [];

  for (let i = 11; i >= 0; i--) {
    const bucketDate = new Date(Date.UTC(baseYear, baseMonth - i, 1));
    monthKeys.push(formatUtcMonthKey(bucketDate));
  }

  const startDate = new Date(Date.UTC(baseYear, baseMonth - 11, 1));
  return { startDate, monthKeys };
}

/**
 * Resolves the effective hospital commission rate at a given timestamp,
 * picking the most recently created matching CommissionOverride window
 * or falling back to the hospital's base rate.
 */
export function resolveHospitalCommissionRate(
  baseRate: number,
  overrides: CommissionOverrideWindow[],
  atDate: Date
): { rate: number; hasActiveOverride: boolean } {
  const atMs = atDate.getTime();
  if (Number.isNaN(atMs) || overrides.length === 0) {
    return { rate: baseRate, hasActiveOverride: false };
  }

  const matching = overrides.filter((ov) => {
    const startMs = new Date(ov.startDate).getTime();
    const endMs = new Date(ov.endDate).getTime();
    return startMs <= atMs && atMs <= endMs;
  });

  if (matching.length === 0) {
    return { rate: baseRate, hasActiveOverride: false };
  }

  matching.sort((a, b) => {
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bCreated !== aCreated) return bCreated - aCreated;

    const aStart = new Date(a.startDate).getTime();
    const bStart = new Date(b.startDate).getTime();
    return bStart - aStart;
  });

  return {
    rate: Number(matching[0].rate),
    hasActiveOverride: true,
  };
}

/**
 * Aggregates operational, medical billing, partner accommodation, and
 * date-bound commission override analytics for the Admin Analytics dashboard.
 */
export async function computePlatformAnalytics(
  now: Date = new Date()
): Promise<PlatformAnalyticsPayload> {
  // ─── Patient Nationality Distribution ──────────────────────────
  const nationalityData = await prisma.patient.groupBy({
    by: ['nationality'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const nationalityDistribution = nationalityData.map((n) => ({
    nationality: n.nationality,
    count: n._count.id,
  }));

  // ─── Monthly User Registrations (Last 12 Months, UTC-Safe) ─────
  const { startDate, monthKeys } = buildLast12MonthBuckets(now);

  const allUsers = await prisma.user.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true, role: true },
  });

  const monthlyMap = new Map<
    string,
    { patients: number; managers: number; doctors: number; admins: number }
  >();
  for (const key of monthKeys) {
    monthlyMap.set(key, { patients: 0, managers: 0, doctors: 0, admins: 0 });
  }

  for (const u of allUsers) {
    const key = formatUtcMonthKey(new Date(u.createdAt));
    const entry = monthlyMap.get(key);
    if (entry) {
      if (u.role === 'PATIENT') entry.patients++;
      else if (u.role === 'MANAGER') entry.managers++;
      else if (u.role === 'DOCTOR') entry.doctors++;
      else entry.admins++;
    }
  }

  const monthlyRegistrations: MonthlyRegistrationBucket[] = Array.from(
    monthlyMap.entries()
  ).map(([month, counts]) => ({
    month,
    ...counts,
    total: counts.patients + counts.managers + counts.doctors + counts.admins,
  }));

  // ─── Appointment Type Breakdown ────────────────────────────────
  const appointmentTypes = await prisma.appointment.groupBy({
    by: ['appointmentType'],
    _count: { id: true },
  });

  const appointmentTypeBreakdown = appointmentTypes.map((a) => ({
    type: a.appointmentType,
    count: a._count.id,
  }));

  // ─── Hospital Utilization (top 10 by appointments) ─────────────
  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      city: true,
      commissionRate: true,
      _count: { select: { appointments: true, doctors: true } },
    },
    orderBy: { appointments: { _count: 'desc' } },
    take: 10,
  });

  // ─── Doctor Consultation Volume (top 10) ───────────────────────
  const doctorVolume = await prisma.doctor.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      specialisation: { select: { name: true } },
      hospital: { select: { name: true } },
      _count: { select: { appointments: true } },
    },
    orderBy: { appointments: { _count: 'desc' } },
    take: 10,
  });

  const doctorLeaderboard = doctorVolume.map((d) => ({
    id: d.id,
    name: d.fullName,
    specialisation: d.specialisation.name,
    hospital: d.hospital.name,
    appointments: d._count.appointments,
  }));

  // ─── Case Lifecycle Metrics ────────────────────────────────────
  const totalCases = await prisma.case.count();
  const closedCases = await prisma.case.count({ where: { status: 'CLOSED' } });
  const completionRate = totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0;

  const closedCasesData = await prisma.case.findMany({
    where: { status: 'CLOSED' },
    select: { createdAt: true, lastUpdatedAt: true },
    take: 100,
    orderBy: { lastUpdatedAt: 'desc' },
  });

  let avgDurationDays = 0;
  if (closedCasesData.length > 0) {
    const totalDays = closedCasesData.reduce((sum, c) => {
      const diffMs = c.lastUpdatedAt.getTime() - c.createdAt.getTime();
      return sum + diffMs / (1000 * 60 * 60 * 24);
    }, 0);
    avgDurationDays = Math.round(totalDays / closedCasesData.length);
  }

  // ─── Revenue, Billing, Overrides & Accommodations ──────────────
  const completedAppointments = await prisma.appointment.count({
    where: { status: 'COMPLETED' },
  });

  const [
    totalUsers,
    totalPatients,
    totalHospitals,
    totalDoctors,
    totalAppointments,
    totalCampaigns,
    totalTemplates,
    medicalBills,
    commissionOverrides,
    hotelBookings,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.patient.count(),
    prisma.hospital.count({ where: { isActive: true } }),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.appointment.count(),
    prisma.emailCampaign.count(),
    prisma.emailTemplate.count({ where: { isActive: true } }),
    prisma.medicalBill.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: {
        id: true,
        hospitalId: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.commissionOverride.findMany({
      select: {
        id: true,
        hospitalId: true,
        rate: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    }),
    prisma.hotelBooking.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: {
        id: true,
        totalAmountUsd: true,
        commissionAmountUsd: true,
        status: true,
      },
    }),
  ]);

  const overridesByHospital = new Map<string, CommissionOverrideWindow[]>();
  const nowMs = now.getTime();
  let activeCommissionOverrides = 0;

  for (const ov of commissionOverrides) {
    const list = overridesByHospital.get(ov.hospitalId) ?? [];
    list.push(ov);
    overridesByHospital.set(ov.hospitalId, list);

    const startMs = new Date(ov.startDate).getTime();
    const endMs = new Date(ov.endDate).getTime();
    if (startMs <= nowMs && nowMs <= endMs) {
      activeCommissionOverrides++;
    }
  }

  const hospitalBaseRateById = new Map<string, number>();
  for (const h of hospitals) {
    hospitalBaseRateById.set(h.id, h.commissionRate ? Number(h.commissionRate) : 0);
  }

  // Resolve any billed hospitals outside the top 10 utilization slice
  const missingHospitalIds = Array.from(
    new Set(
      medicalBills
        .filter((b) => b.status !== 'CANCELLED' && b.hospitalId && !hospitalBaseRateById.has(b.hospitalId))
        .map((b) => b.hospitalId as string)
    )
  );
  if (missingHospitalIds.length > 0) {
    const extraHospitals = await prisma.hospital.findMany({
      where: { id: { in: missingHospitalIds } },
      select: { id: true, commissionRate: true },
    });
    for (const h of extraHospitals) {
      hospitalBaseRateById.set(h.id, h.commissionRate ? Number(h.commissionRate) : 0);
    }
  }

  const hospitalUtilization: HospitalUtilizationItem[] = hospitals.map((h) => {
    const baseRate = h.commissionRate ? Number(h.commissionRate) : 0;
    const resolved = resolveHospitalCommissionRate(
      baseRate,
      overridesByHospital.get(h.id) ?? [],
      now
    );
    return {
      id: h.id,
      name: h.name,
      city: h.city,
      appointments: h._count.appointments,
      doctors: h._count.doctors,
      commissionRate: baseRate,
      effectiveCommissionRate: resolved.rate,
      hasActiveOverride: resolved.hasActiveOverride,
    };
  });

  const avgCommission =
    hospitals.length > 0
      ? hospitals.reduce((s, h) => s + (h.commissionRate ? Number(h.commissionRate) : 0), 0) /
        hospitals.length
      : 0;

  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let estimatedHospitalCommission = 0;

  for (const bill of medicalBills) {
    if (bill.status === 'CANCELLED') continue;
    const total = Number(bill.totalAmount);
    const paid = Number(bill.paidAmount);
    totalInvoiced += total;
    totalCollected += paid;
    totalOutstanding += Math.max(0, total - paid);

    if (bill.hospitalId && hospitalBaseRateById.has(bill.hospitalId)) {
      const baseRate = hospitalBaseRateById.get(bill.hospitalId) ?? 0;
      const { rate } = resolveHospitalCommissionRate(
        baseRate,
        overridesByHospital.get(bill.hospitalId) ?? [],
        new Date(bill.createdAt)
      );
      estimatedHospitalCommission += total * (rate / 100);
    }
  }

  const activeHotelBookings = hotelBookings.filter((b) => b.status !== 'CANCELLED');
  let grossRevenueUsd = 0;
  let partnerCommissionUsd = 0;
  for (const booking of activeHotelBookings) {
    grossRevenueUsd += Number(booking.totalAmountUsd);
    partnerCommissionUsd += Number(booking.commissionAmountUsd);
  }

  const leadsFunnel = await computeLeadsCrmAnalytics(now);

  return {
    platformTotals: {
      totalUsers,
      totalPatients,
      totalHospitals,
      totalDoctors,
      totalAppointments,
      totalCases,
      totalCampaigns,
      totalTemplates,
    },
    nationalityDistribution,
    monthlyRegistrations,
    appointmentTypeBreakdown,
    hospitalUtilization,
    doctorLeaderboard,
    caseLifecycle: {
      totalCases,
      closedCases,
      completionRate,
      avgDurationDays,
    },
    revenueEstimates: {
      completedAppointments,
      avgCommissionRate: roundCurrency(avgCommission),
      activeCommissionOverrides,
      medicalBilling: {
        totalInvoiced: roundCurrency(totalInvoiced),
        totalCollected: roundCurrency(totalCollected),
        totalOutstanding: roundCurrency(totalOutstanding),
        estimatedHospitalCommission: roundCurrency(estimatedHospitalCommission),
      },
      accommodations: {
        activeBookings: activeHotelBookings.length,
        grossRevenueUsd: roundCurrency(grossRevenueUsd),
        partnerCommissionUsd: roundCurrency(partnerCommissionUsd),
      },
    },
    leadsFunnel,
  };
}
