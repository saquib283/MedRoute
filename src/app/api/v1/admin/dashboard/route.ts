/**
 * MediRoute India — GET /api/v1/admin/dashboard
 * Platform-wide KPI aggregation for the admin dashboard.
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
    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'SUPER_ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalUsers,
      totalPatients,
      totalManagers,
      totalDoctors,
      activeCases,
      appointmentsThisWeek,
      pendingEscalations,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'PATIENT', isActive: true } }),
      prisma.user.count({ where: { role: 'MANAGER', isActive: true } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.case.count({ where: { status: { notIn: ['CLOSED'] } } }),
      prisma.appointment.count({ where: { scheduledAt: { gte: weekAgo } } }),
      prisma.case.count({ where: { escalationNote: { not: null }, status: { notIn: ['CLOSED'] } } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true, role: true } } },
      }),
    ]);

    return apiSuccess({
      metrics: {
        totalUsers,
        totalPatients,
        totalManagers,
        totalDoctors,
        activeCases,
        appointmentsThisWeek,
        pendingEscalations,
      },
      recentActivity: recentAuditLogs,
    });
  } catch (err) {
    console.error('[Admin Dashboard Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to load dashboard', 500);
  }
}
