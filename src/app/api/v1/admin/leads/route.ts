/**
 * MediRoute India — /api/v1/admin/leads
 * Lead Query management for admin: list, update status/notes, onboard as patient.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import bcrypt from 'bcryptjs';

// ── GET: Fetch leads with filters & pagination ──────────────────────
export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const search = searchParams.get('search') || '';

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { medicalCondition: { contains: search } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;

    const [leads, total] = await Promise.all([
      db.leadQuery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.leadQuery.count({ where }),
    ]);

    return apiSuccess({
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Admin Leads GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch leads', 500);
  }
}

// ── PUT: Update lead status / admin notes ───────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const { leadId, status, adminNotes } = body;

    if (!leadId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'leadId is required', 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const existing = await db.leadQuery.findUnique({ where: { id: leadId } });
    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Lead not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const updated = await db.leadQuery.update({
      where: { id: leadId },
      data: updateData,
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entityType: 'LeadQuery',
      entityId: leadId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, adminNotes: updated.adminNotes },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ lead: updated });
  } catch (err) {
    console.error('[Admin Leads PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update lead', 500);
  }
}

// ── POST: Onboard lead as patient ───────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const { leadId, password, nationality, passportNo, dob, assignedManagerId } = body;

    if (!leadId || !password || !passportNo || !dob) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'leadId, password, passportNo, and dob are required',
        400
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const lead = await db.leadQuery.findUnique({ where: { id: leadId } });
    if (!lead) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Lead not found', 404);
    }
    if (lead.status === 'CONVERTED') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'This lead has already been converted', 400);
    }

    // Check if email already exists as a user
    const existingUser = await prisma.user.findUnique({ where: { email: lead.email } });
    if (existingUser) {
      return apiError(
        ERROR_CODES.USER_ALREADY_EXISTS,
        'A user with this email already exists',
        409
      );
    }

    // Create user + patient in a transaction
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txDb = tx as any;
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: lead.email,
          passwordHash,
          fullName: lead.fullName,
          role: 'PATIENT',
          phone: lead.phone,
        },
      });

      // 2. Create Patient record
      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          nationality: nationality || lead.nationality,
          passportNo,
          dob: new Date(dob),
          medicalCondition: lead.medicalCondition,
          assignedManagerId: assignedManagerId || null,
        },
      });

      // 3. Mark lead as converted
      await txDb.leadQuery.update({
        where: { id: leadId },
        data: { status: 'CONVERTED', convertedUserId: user.id },
      });

      return { user, patient };
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'LeadOnboard',
      entityId: result.user.id,
      newValue: {
        leadId,
        email: lead.email,
        fullName: lead.fullName,
        patientId: result.patient.id,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
        },
        patient: { id: result.patient.id },
        generatedPassword: password,
      },
      undefined,
      201
    );
  } catch (err) {
    console.error('[Admin Leads POST Onboard Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to onboard patient', 500);
  }
}
