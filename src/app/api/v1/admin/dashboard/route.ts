/**
 * Afzal Healthcare — GET /api/v1/admin/dashboard
 * Platform-wide KPI aggregation with date-range, trends, and distribution data.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

function getPeriodDates(period: string): { current: Date; previous: Date } {
  const now = new Date();
  let daysBack = 7;
  if (period === '30d') daysBack = 30;
  else if (period === '90d') daysBack = 90;
  else if (period === 'all') daysBack = 3650;

  const current = new Date(now);
  current.setDate(current.getDate() - daysBack);

  const previous = new Date(current);
  previous.setDate(previous.getDate() - daysBack);

  return { current, previous };
}

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const { current: periodStart, previous: prevStart } = getPeriodDates(period);

    // ─── Core Metrics ──────────────────────────────────────────────
    const now = new Date();
    const canQueryLeads = typeof prisma?.lead?.count === 'function';

    const [
      totalUsers,
      totalPatients,
      totalManagers,
      totalDoctors,
      activeCases,
      appointmentsThisPeriod,
      appointmentsPrevPeriod,
      pendingEscalations,
      casesThisPeriod,
      casesPrevPeriod,
      recentAuditLogs,
      openLeads,
      slaBreachedLeads,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'PATIENT', isActive: true } }),
      prisma.user.count({ where: { role: 'MANAGER', isActive: true } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.case.count({ where: { status: { notIn: ['CLOSED'] } } }),
      prisma.appointment.count({ where: { scheduledAt: { gte: periodStart } } }),
      prisma.appointment.count({ where: { scheduledAt: { gte: prevStart, lt: periodStart } } }),
      prisma.case.count({
        where: {
          AND: [{ escalationNote: { not: null } }, { escalationNote: { not: '' } }],
          status: { notIn: ['CLOSED'] },
        },
      }),
      prisma.case.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.case.count({ where: { createdAt: { gte: prevStart, lt: periodStart } } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true, role: true } } },
      }),
      canQueryLeads
        ? prisma.lead.count({
            where: { status: { notIn: ['CONVERTED', 'LOST'] } },
          })
        : Promise.resolve(0),
      canQueryLeads
        ? prisma.lead.count({
            where: {
              status: { notIn: ['CONVERTED', 'LOST'] },
              firstRespondedAt: null,
              firstResponseDueAt: { lt: now },
            },
          })
        : Promise.resolve(0),
    ]);

    // ─── Case Status Distribution ──────────────────────────────────
    const caseStatusDist = await prisma.case.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusDistribution = caseStatusDist.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // ─── Manager Workload ──────────────────────────────────────────
    const managerWorkload = await prisma.case.groupBy({
      by: ['managerId'],
      where: { managerId: { not: null }, status: { notIn: ['CLOSED'] } },
      _count: { id: true },
    });

    const managerIds = managerWorkload
      .map((m) => m.managerId)
      .filter((id): id is string => id !== null);

    const managerUsers = managerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, fullName: true },
        })
      : [];

    const managerMap = new Map(managerUsers.map((u) => [u.id, u.fullName]));

    const workloadData = managerWorkload.map((m) => ({
      managerId: m.managerId,
      managerName: managerMap.get(m.managerId!) || 'Unknown',
      activeCases: m._count.id,
    })).sort((a, b) => b.activeCases - a.activeCases);

    // ─── Top Hospitals ─────────────────────────────────────────────
    const topHospitals = await prisma.hospital.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        _count: { select: { appointments: true, doctors: true } },
      },
      orderBy: { appointments: { _count: 'desc' } },
      take: 5,
    });

    // ─── Trend Calculations ────────────────────────────────────────
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return apiSuccess({
      metrics: {
        totalUsers,
        totalPatients,
        totalManagers,
        totalDoctors,
        activeCases,
        appointmentsThisPeriod,
        pendingEscalations,
        openLeads,
        slaBreachedLeads,
      },
      trends: {
        appointments: calcTrend(appointmentsThisPeriod, appointmentsPrevPeriod),
        cases: calcTrend(casesThisPeriod, casesPrevPeriod),
      },
      statusDistribution,
      managerWorkload: workloadData,
      topHospitals: topHospitals.map((h) => ({
        id: h.id,
        name: h.name,
        city: h.city,
        appointments: h._count.appointments,
        doctors: h._count.doctors,
      })),
      recentActivity: recentAuditLogs,
      period,
    });
  } catch (err) {
    console.error('[Admin Dashboard Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load dashboard', 500);
  }
}
