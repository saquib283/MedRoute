/**
 * Afzal Healthcare — /api/v1/admin/analytics
 * Advanced analytics endpoint for Admin dashboard.
 * Provides deep platform insights: nationality distribution, trends,
 * hospital utilization, doctor volume, case lifecycle metrics.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

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

    // ─── Monthly User Registrations (Last 12 Months) ───────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const allUsers = await prisma.user.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, role: true },
    });

    const monthlyMap = new Map<string, { patients: number; managers: number; doctors: number; admins: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, { patients: 0, managers: 0, doctors: 0, admins: 0 });
    }

    for (const u of allUsers) {
      const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        if (u.role === 'PATIENT') entry.patients++;
        else if (u.role === 'MANAGER') entry.managers++;
        else if (u.role === 'DOCTOR') entry.doctors++;
        else entry.admins++;
      }
    }

    const monthlyRegistrations = Array.from(monthlyMap.entries()).map(([month, counts]) => ({
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

    const hospitalUtilization = hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      appointments: h._count.appointments,
      doctors: h._count.doctors,
      commissionRate: h.commissionRate ? Number(h.commissionRate) : 0,
    }));

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

    // Average case duration (from INQUIRY_RECEIVED to CLOSED)
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

    // ─── Revenue Estimates ─────────────────────────────────────────
    // Estimated commission revenue from completed appointments at hospitals with commission rates
    const completedAppointments = await prisma.appointment.count({ where: { status: 'COMPLETED' } });
    const avgCommission = hospitals.length > 0
      ? hospitals.reduce((s, h) => s + (h.commissionRate ? Number(h.commissionRate) : 0), 0) / hospitals.length
      : 0;

    // ─── Platform Totals ───────────────────────────────────────────
    const [totalUsers, totalPatients, totalHospitals, totalDoctors, totalAppointments] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.patient.count(),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.appointment.count(),
    ]);

    // ─── Campaign Stats ────────────────────────────────────────────
    const [totalCampaigns, totalTemplates] = await Promise.all([
      prisma.emailCampaign.count(),
      prisma.emailTemplate.count({ where: { isActive: true } }),
    ]);

    return apiSuccess({
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
        avgCommissionRate: Math.round(avgCommission * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[Admin Analytics Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load analytics', 500);
  }
}
