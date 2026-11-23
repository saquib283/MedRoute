/**
 * Afzal Healthcare — /api/v1/admin/email-campaigns
 * Campaign management: list, create & send, process due queue, and cancel. Admin only.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import {
  dispatchImmediateCampaign,
  findCampaignRecipients,
  processQueuedCampaigns,
} from '@/lib/services/email-campaign.service';
import { z } from 'zod';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().min(1),
  targetRole: z.enum(['ALL', 'PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']),
  scheduledAt: z.string().optional().nullable(),
});

const patchCampaignSchema = z.object({
  action: z.literal('PROCESS_QUEUED'),
});

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    // Process any overdue scheduled campaigns on request without failing the list query
    try {
      await processQueuedCampaigns();
    } catch (procErr) {
      console.error('[processQueuedCampaigns Error]', procErr);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        include: {
          template: { select: { name: true, subject: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    return apiSuccess({
      campaigns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Email Campaigns GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch campaigns', 500);
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
    const result = createCampaignSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { name, templateId, targetRole, scheduledAt } = result.data;

    // Verify template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId, isActive: true },
    });
    if (!template) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Email template not found or inactive', 404);
    }

    // If campaign is scheduled for the future
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Scheduled date must be in the future', 400);
      }

      const targetUsers = await findCampaignRecipients(targetRole);
      if (targetUsers.length === 0) {
        return apiError(ERROR_CODES.BAD_REQUEST, 'No active users found for this audience', 400);
      }

      const campaign = await prisma.emailCampaign.create({
        data: {
          name,
          templateId,
          targetRole,
          status: 'QUEUED',
          scheduledAt: scheduledDate,
          createdBy: authUser!.userId,
        },
        include: { template: { select: { name: true, subject: true } } },
      });

      await createAuditLog({
        actorId: authUser!.userId,
        action: AUDIT_ACTIONS.CAMPAIGN_SEND,
        entityType: 'EmailCampaign',
        entityId: campaign.id,
        newValue: {
          name: campaign.name,
          templateName: template.name,
          targetRole,
          scheduledAt: scheduledDate,
          status: 'QUEUED',
        },
        ipAddress: getClientIP(request),
      });

      return apiSuccess({ campaign }, undefined, 201);
    }

    const dispatchResult = await dispatchImmediateCampaign({
      name,
      templateId,
      template,
      targetRole,
      createdBy: authUser!.userId,
    });

    if (!dispatchResult.ok) {
      return apiError(ERROR_CODES.BAD_REQUEST, dispatchResult.error, 400);
    }

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.CAMPAIGN_SEND,
      entityType: 'EmailCampaign',
      entityId: dispatchResult.campaign.id,
      newValue: {
        name: dispatchResult.campaign.name,
        templateName: template.name,
        targetRole,
        sentCount: dispatchResult.notificationsCreated,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ campaign: dispatchResult.campaign }, undefined, 201);
  } catch (err) {
    console.error('[Email Campaigns POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create campaign', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = patchCampaignSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const summary = await processQueuedCampaigns();

    if (summary.processedCampaigns > 0) {
      await createAuditLog({
        actorId: authUser!.userId,
        action: AUDIT_ACTIONS.CAMPAIGN_SEND,
        entityType: 'EmailCampaign',
        entityId: 'queued-batch',
        newValue: summary,
        ipAddress: getClientIP(request),
      });
    }

    return apiSuccess(summary);
  } catch (err) {
    console.error('[Email Campaigns PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process queued campaigns', 500);
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
      return apiError(ERROR_CODES.BAD_REQUEST, 'Campaign ID required', 400);
    }

    const existing = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Campaign not found', 404);
    }

    if (existing.status !== 'QUEUED') {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Only queued campaigns can be cancelled', 400);
    }

    await prisma.emailCampaign.delete({ where: { id } });

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'EmailCampaign',
      entityId: id,
      oldValue: { name: existing.name },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ message: 'Campaign cancelled and deleted successfully' });
  } catch (err) {
    console.error('[Email Campaigns DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel campaign', 500);
  }
}
