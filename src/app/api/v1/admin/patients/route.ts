/**
 * Afzal Healthcare — /api/v1/admin/patients
 * Paginated patient list, admin patient onboarding, and atomic coordinator reassignment.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { formatPatientForViewer } from '@/lib/services/phi.service';
import { onboardPatient } from '@/lib/services/onboarding.service';
import { assignPatientCoordinator } from '@/lib/services/case-assignment.service';
import { z } from 'zod';

const onboardPatientAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required').max(100),
  phone: z.string().optional(),
  nationality: z.string().min(2, 'Nationality is required'),
  passportNo: z.string().min(5, 'Passport number is required'),
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date of birth',
  }),
  primaryLanguage: z.string().optional(),
  medicalCondition: z.string().max(2000).optional(),
  urgencyLevel: z.enum(['ROUTINE', 'SEMI_URGENT', 'URGENT']).optional(),
  assignedManagerId: z.string().nullable().optional(),
  initialCaseNotes: z.string().max(5000).optional(),
});

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

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = onboardPatientAdminSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const onboardRes = await onboardPatient(result.data, {
      actorId: authUser!.userId,
      ipAddress: getClientIP(request),
    });

    if (!onboardRes.ok) {
      return apiError(onboardRes.code, onboardRes.message, onboardRes.status);
    }

    return apiSuccess(
      {
        user: onboardRes.user,
        patient: formatPatientForViewer(onboardRes.patient, { maskPassport: true }),
        initialCase: onboardRes.initialCase,
      },
      undefined,
      201
    );
  } catch (err) {
    console.error('[Admin Patients POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to onboard patient', 500);
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

    const { id, assignedManagerId, urgencyLevel } = result.data;

    const existing = await prisma.patient.findUnique({
      where: { id },
      select: { assignedManagerId: true, urgencyLevel: true },
    });
    if (!existing) {
      return apiError(ERROR_CODES.PATIENT_NOT_FOUND, 'Patient not found', 404);
    }

    if (assignedManagerId !== undefined) {
      const assignRes = await assignPatientCoordinator({
        patientId: id,
        managerId: assignedManagerId,
        actorId: authUser!.userId,
        ipAddress: getClientIP(request),
      });
      if (!assignRes.ok) {
        return apiError(assignRes.code, assignRes.message, assignRes.status);
      }
    }

    if (urgencyLevel !== undefined) {
      await prisma.patient.update({
        where: { id },
        data: { urgencyLevel },
      });

      await createAuditLog({
        actorId: authUser!.userId,
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'Patient',
        entityId: id,
        oldValue: { urgencyLevel: existing.urgencyLevel },
        newValue: { urgencyLevel },
        ipAddress: getClientIP(request),
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
        assignedManager: { select: { id: true, fullName: true, email: true } },
      },
    });

    return apiSuccess({
      patient: patient ? formatPatientForViewer(patient, { maskPassport: true }) : null,
    });
  } catch (err) {
    console.error('[Admin Patients PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update patient', 500);
  }
}
