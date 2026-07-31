/**
 * Afzal Healthcare — /api/v1/admin/email-campaigns
 * Campaign management: list, create & send. Admin only.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';
import type { UserRole } from '@prisma/client';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().min(1),
  targetRole: z.enum(['ALL', 'PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']),
  scheduledAt: z.string().optional().nullable(),
});

async function processQueuedCampaigns() {
  try {
    const now = new Date();
    const queued = await prisma.emailCampaign.findMany({
      where: {
        status: 'QUEUED',
        scheduledAt: { lte: now },
      },
      include: { template: true },
    });

    for (const camp of queued) {
      // Find target users
      const userWhere: Record<string, unknown> = { isActive: true };
      if (camp.targetRole !== 'ALL') {
        userWhere.role = camp.targetRole as UserRole;
      }
      const targetUsers = await prisma.user.findMany({
        where: userWhere,
        select: { id: true, fullName: true, email: true },
      });

      if (targetUsers.length > 0) {
        // Create notifications
        const notifications = targetUsers.map((u) => ({
          userId: u.id,
          channel: 'EMAIL' as const,
          title: camp.template.subject,
          body: camp.template.body
            .replace(/\{\{fullName\}\}/g, u.fullName)
            .replace(/\{\{email\}\}/g, u.email),
          triggerEvent: `CAMPAIGN:${camp.id}`,
        }));
        await prisma.notification.createMany({ data: notifications });
      }

      // Mark as SENT
      await prisma.emailCampaign.update({
        where: { id: camp.id },
        data: {
          status: 'SENT',
          sentCount: targetUsers.length,
          sentAt: now,
        },
      });

      console.log(`[Scheduled Email Campaign] Campaign "${camp.name}" processed and sent to ${targetUsers.length} users.`);
    }
  } catch (err) {
    console.error('[processQueuedCampaigns Error]', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    // Process any overdue scheduled campaigns on request
    await processQueuedCampaigns();

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

    // Find target users
    const userWhere: Record<string, unknown> = { isActive: true };
    if (targetRole !== 'ALL') {
      userWhere.role = targetRole as UserRole;
    }

    const targetUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, fullName: true, email: true },
    });

    if (targetUsers.length === 0) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No active users found for this audience', 400);
    }

    // If campaign is scheduled for the future
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Scheduled date must be in the future', 400);
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

    // Create immediate campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        templateId,
        targetRole,
        status: 'QUEUED',
        createdBy: authUser!.userId,
      },
    });

    // Create EMAIL notifications for all target users
    const notificationData = targetUsers.map((u) => ({
      userId: u.id,
      channel: 'EMAIL' as const,
      title: template.subject,
      body: template.body
        .replace(/\{\{fullName\}\}/g, u.fullName)
        .replace(/\{\{email\}\}/g, u.email),
      triggerEvent: `CAMPAIGN:${campaign.id}`,
    }));

    await prisma.notification.createMany({ data: notificationData });

    // Stub: Log the email send (real SMTP integration would go here)
    console.log(
      `[Email Campaign] Campaign "${campaign.name}" (ID: ${campaign.id}) ` +
      `dispatched to ${targetUsers.length} ${targetRole} users. ` +
      `Template: "${template.name}". SMTP send stubbed — ready for provider integration.`
    );

    // Update campaign status to SENT
    const updatedCampaign = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENT',
        sentCount: targetUsers.length,
        sentAt: new Date(),
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
        sentCount: targetUsers.length,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ campaign: updatedCampaign }, undefined, 201);
  } catch (err) {
    console.error('[Email Campaigns POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create campaign', 500);
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

