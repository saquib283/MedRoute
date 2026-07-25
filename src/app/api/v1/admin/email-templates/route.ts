/**
 * MediRoute India — /api/v1/admin/email-templates
 * Full CRUD for email templates. Admin only.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  category: z.string().min(1).default('general'),
  placeholders: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  placeholders: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
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
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    return apiSuccess({
      templates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Email Templates GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch templates', 500);
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
    const result = createTemplateSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    // Check unique name
    const existing = await prisma.emailTemplate.findUnique({ where: { name: result.data.name } });
    if (existing) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'A template with this name already exists', 409);
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: result.data.name,
        subject: result.data.subject,
        body: result.data.body,
        category: result.data.category,
        placeholders: result.data.placeholders || [],
        createdBy: authUser!.userId,
      },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.TEMPLATE_CREATE,
      entityType: 'EmailTemplate',
      entityId: template.id,
      newValue: { name: template.name, subject: template.subject, category: template.category },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ template }, undefined, 201);
  } catch (err) {
    console.error('[Email Templates POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create template', 500);
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
    const result = updateTemplateSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { id, ...updateData } = result.data;

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Template not found', 404);
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.TEMPLATE_UPDATE,
      entityType: 'EmailTemplate',
      entityId: id,
      oldValue: { name: existing.name, subject: existing.subject },
      newValue: updateData,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ template });
  } catch (err) {
    console.error('[Email Templates PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update template', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Template ID required', 400);
    }

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Template not found', 404);
    }

    // Soft delete
    await prisma.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.TEMPLATE_DELETE,
      entityType: 'EmailTemplate',
      entityId: id,
      oldValue: { name: existing.name },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Template deleted' });
  } catch (err) {
    console.error('[Email Templates DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to delete template', 500);
  }
}
