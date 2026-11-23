/**
 * Afzal Healthcare — /api/v1/admin/patients
 * Paginated patient list with search and filters for admin oversight.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { formatPatientForViewer } from '@/lib/services/phi.service';
import { z } from 'zod';

const updatePatientSchema = z.object({
  id: z.string().min(1),
  assignedManagerId: z.string().nullable().optional(),
  urgencyLevel: z.enum(['ROUTINE', 'SEMI_URGENT', 'URGENT']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const urgency = searchParams.get('urgency') || '';
    const managerId = searchParams.get('managerId') || '';
    const hasActiveCase = searchParams.get('hasActiveCase');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { user: { fullName: { contains: search } } },
        { user: { email: { contains: search } } },
        { nationality: { contains: search } },
      ];
    }
    if (urgency) {
      where.urgencyLevel = urgency;
    }
    if (managerId) {
      where.assignedManagerId = managerId;
    }
    if (hasActiveCase === 'true') {
      where.cases = { some: { status: { notIn: ['CLOSED'] } } };
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          user: { select: { fullName: true, email: true, phone: true, isActive: true, createdAt: true } },
          assignedManager: { select: { id: true, fullName: true, email: true } },
          _count: { select: { cases: true, documents: true, appointments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    const formattedPatients = patients.map((p) =>
      formatPatientForViewer(p, { maskPassport: true })
    );

    void createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.VIEW_PATIENT,
      entityType: 'Patient',
      entityId: 'admin-cohort',
      newValue: { count: formattedPatients.length, page, limit },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ patients: formattedPatients, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Admin Patients GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch patients', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = updatePatientSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, ...updateData } = result.data;

    const existing = await prisma.patient.findUnique({
      where: { id },
      select: { assignedManagerId: true, urgencyLevel: true },
    });
    if (!existing) {
      return apiError(ERROR_CODES.PATIENT_NOT_FOUND, 'Patient not found', 404);
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
      include: { user: { select: { fullName: true } } },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Patient',
      entityId: id,
      oldValue: existing,
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ patient });
  } catch (err) {
    console.error('[Admin Patients PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update patient', 500);
  }
}
