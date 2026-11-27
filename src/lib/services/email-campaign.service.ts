/**
 * Afzal Healthcare — Email Campaign Service
 * Handles recipient resolution, XSS-safe template interpolation,
 * immediate campaign dispatch, and scheduled queue processing.
 */

import prisma from '@/lib/prisma';
import type { UserRole } from '@prisma/client';
import {
  sanitizeEmailHtml,
  interpolateCampaignTemplate,
  type CampaignRecipientContext,
} from '@/lib/validation/email-sanitizer';

const LIGHTWEIGHT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RECIPIENT_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  patient: {
    select: {
      nationality: true,
      cases: {
        select: { status: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
} as const;

export interface CampaignRecipientRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  patient?: {
    nationality?: string | null;
    cases?: Array<{ status: string }>;
  } | null;
}

export async function findCampaignRecipients(
  targetRole: string
): Promise<CampaignRecipientRow[]> {
  if (targetRole === 'LEADS_ACTIVE') {
    if (typeof prisma?.lead?.findMany !== 'function') {
      return [];
    }

    const activeLeads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['CONVERTED', 'LOST'] },
        email: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        nationality: true,
        status: true,
      },
    });

    const seenEmails = new Set<string>();
    const recipients: CampaignRecipientRow[] = [];

    for (const lead of activeLeads) {
      const normalizedEmail = lead.email?.trim().toLowerCase();
      if (
        !normalizedEmail ||
        !LIGHTWEIGHT_EMAIL_REGEX.test(normalizedEmail) ||
        seenEmails.has(normalizedEmail)
      ) {
        continue;
      }
      seenEmails.add(normalizedEmail);
      recipients.push({
        id: lead.id,
        fullName: lead.fullName,
        email: normalizedEmail,
        role: 'LEAD',
        patient: {
          nationality: lead.nationality,
          cases: [{ status: lead.status }],
        },
      });
    }

    return recipients;
  }

  const userWhere: Record<string, unknown> = { isActive: true };
  if (targetRole !== 'ALL') {
    userWhere.role = targetRole as UserRole;
  }

  return prisma.user.findMany({
    where: userWhere,
    select: RECIPIENT_USER_SELECT,
  });
}

function toRecipientContext(user: CampaignRecipientRow): CampaignRecipientContext {
  return {
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    nationality: user.patient?.nationality ?? null,
    caseStatus: user.patient?.cases?.[0]?.status ?? null,
  };
}

function buildNotifications(
  campaignId: string,
  template: { subject: string; body: string },
  recipients: CampaignRecipientRow[]
) {
  const cleanBody = sanitizeEmailHtml(template.body);
  return recipients.map((user) => {
    const ctx = toRecipientContext(user);
    return {
      userId: user.id,
      channel: 'EMAIL' as const,
      title: interpolateCampaignTemplate(template.subject, ctx, { escapeHtml: false }),
      body: interpolateCampaignTemplate(cleanBody, ctx, { escapeHtml: true }),
      triggerEvent: `CAMPAIGN:${campaignId}`,
    };
  });
}

/**
 * Dispatch a campaign to a pre-resolved or queried set of active target users,
 * persisting EMAIL notifications and marking the campaign SENT.
 */
export async function dispatchCampaignToRecipients(
  campaignId: string,
  template: { subject: string; body: string },
  targetRole: string,
  now: Date = new Date(),
  preloadedRecipients?: CampaignRecipientRow[]
) {
  const targetUsers =
    preloadedRecipients ?? (await findCampaignRecipients(targetRole));

  if (targetUsers.length > 0) {
    if (targetRole === 'LEADS_ACTIVE') {
      const cleanBody = sanitizeEmailHtml(template.body);
      const leadActivities = targetUsers.map((leadRecipient) => {
        const ctx = toRecipientContext(leadRecipient);
        const interpolatedSubject = interpolateCampaignTemplate(template.subject, ctx, {
          escapeHtml: false,
        });
        const interpolatedBody = interpolateCampaignTemplate(cleanBody, ctx, {
          escapeHtml: true,
        });

        return {
          leadId: leadRecipient.id,
          actorId: null,
          activityType: 'EMAIL' as const,
          summary: `Campaign: ${interpolatedSubject}`.slice(0, 191),
          details: {
            campaignId,
            subject: interpolatedSubject,
            bodyLength: interpolatedBody.length,
          },
        };
      });

      if (typeof prisma?.leadActivity?.createMany === 'function') {
        await prisma.leadActivity.createMany({ data: leadActivities });
      }

      console.log(
        `[Lead Nurture Campaign] Campaign (ID: ${campaignId}) dispatched sanitized HTML email ` +
          `to ${targetUsers.length} active leads. SMTP send stubbed — ready for provider integration.`
      );
    } else {
      const notifications = buildNotifications(campaignId, template, targetUsers);
      await prisma.notification.createMany({ data: notifications });
    }
  }

  const updatedCampaign = await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENT',
      sentCount: targetUsers.length,
      sentAt: now,
    },
    include: { template: { select: { name: true, subject: true } } },
  });

  return {
    campaign: updatedCampaign,
    notificationsCreated: targetUsers.length,
  };
}

/**
 * Create and immediately dispatch a campaign if active recipients exist.
 */
export async function dispatchImmediateCampaign(
  input: {
    name: string;
    templateId: string;
    template: { name: string; subject: string; body: string };
    targetRole: string;
    createdBy: string;
  },
  now: Date = new Date()
) {
  const targetUsers = await findCampaignRecipients(input.targetRole);
  if (targetUsers.length === 0) {
    return {
      ok: false as const,
      error: 'No active recipients found for this audience',
    };
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: input.name,
      templateId: input.templateId,
      targetRole: input.targetRole,
      status: 'QUEUED',
      createdBy: input.createdBy,
    },
  });

  const dispatched = await dispatchCampaignToRecipients(
    campaign.id,
    input.template,
    input.targetRole,
    now,
    targetUsers
  );

  console.log(
    `[Email Campaign] Campaign "${input.name}" (ID: ${campaign.id}) ` +
      `dispatched to ${dispatched.notificationsCreated} ${input.targetRole} users. ` +
      `Template: "${input.template.name}". SMTP send stubbed — ready for provider integration.`
  );

  return {
    ok: true as const,
    campaign: dispatched.campaign,
    notificationsCreated: dispatched.notificationsCreated,
  };
}

/**
 * Process all queued campaigns whose scheduledAt <= now.
 */
export async function processQueuedCampaigns(
  now: Date = new Date()
): Promise<{ processedCampaigns: number; notificationsCreated: number }> {
  const queued = await prisma.emailCampaign.findMany({
    where: {
      status: 'QUEUED',
      scheduledAt: { lte: now },
    },
    include: { template: true },
  });

  let processedCampaigns = 0;
  let notificationsCreated = 0;

  for (const camp of queued) {
    const claimed = await prisma.emailCampaign.updateMany({
      where: { id: camp.id, status: 'QUEUED' },
      data: { status: 'SENT', sentAt: now },
    });
    if (claimed.count === 0) continue;

    try {
      const dispatched = await dispatchCampaignToRecipients(
        camp.id,
        camp.template,
        camp.targetRole,
        now
      );
      processedCampaigns += 1;
      notificationsCreated += dispatched.notificationsCreated;
      console.log(
        `[Scheduled Email Campaign] Campaign "${camp.name}" processed and sent to ${dispatched.notificationsCreated} users.`
      );
    } catch (err) {
      try {
        await prisma.emailCampaign.update({
          where: { id: camp.id },
          data: { status: 'FAILED' },
        });
      } catch {
        // Preserve original dispatch error if rollback fails
      }
      throw err;
    }
  }

  return {
    processedCampaigns,
    notificationsCreated,
  };
}
