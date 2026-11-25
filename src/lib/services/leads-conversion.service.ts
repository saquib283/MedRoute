/**
 * Afzal Healthcare — Atomic Lead → Patient + Case Conversion & Funnel Analytics Service
 * Handles transactional conversion of qualified Leads into either a new Patient + Case
 * or a new Case under an existing returning Patient, plus CRM funnel & B2B ROI telemetry.
 */

import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/auth/crypto';
import { hashPassword } from '@/lib/auth/password';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { assertManagerCapacity } from '@/lib/services/system-settings.service';
import { buildStandardMvtPathwaySteps } from '@/lib/validation/lifecycle-schemas';
import {
  computeLeadSlaState,
  convertLeadSchema,
  LEAD_STATUSES,
} from '@/lib/validation/leads-crm-schemas';

export type ConversionServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number; details?: unknown };

export interface ConvertedLeadPayload {
  leadId: string;
  patientId: string;
  caseId: string;
  userId: string;
  mode: 'NEW_PATIENT' | 'EXISTING_PATIENT';
  generatedTemporaryPassword?: string;
}

export interface LeadsFunnelAnalyticsPayload {
  totalLeads: number;
  activeLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRatePercent: number;
  avgFirstResponseMinutes: number;
  slaBreachCount: number;
  slaCompliancePercent: number;
  stageCounts: Array<{ status: string; count: number }>;
  sourceBreakdown: Array<{ source: string; count: number; convertedCount: number }>;
  lostReasonBreakdown: Array<{ reason: string; count: number }>;
  partnerPerformance: Array<{
    id: string;
    name: string;
    code: string;
    partnerType: string;
    country: string;
    commissionPercent: number;
    totalLeads: number;
    convertedLeads: number;
    conversionRatePercent: number;
    attributedCases: number;
    attributedRevenueUsd: number;
    estimatedPartnerCommissionUsd: number;
  }>;
}

const UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT_CHARS = '23456789';
const SPECIAL_CHARS = '!@#$%^&*';
const ALL_PASSWORD_CHARS = `${UPPER_CHARS}${LOWER_CHARS}${DIGIT_CHARS}${SPECIAL_CHARS}`;

function generateStrongTemporaryPassword(length: number = 16): string {
  const chars: string[] = [
    UPPER_CHARS[crypto.randomInt(UPPER_CHARS.length)],
    LOWER_CHARS[crypto.randomInt(LOWER_CHARS.length)],
    DIGIT_CHARS[crypto.randomInt(DIGIT_CHARS.length)],
    SPECIAL_CHARS[crypto.randomInt(SPECIAL_CHARS.length)],
  ];

  while (chars.length < length) {
    chars.push(ALL_PASSWORD_CHARS[crypto.randomInt(ALL_PASSWORD_CHARS.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function toNumericAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    const num = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(num) ? num : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildConversionCaseNotes(params: {
  referenceNo: string;
  source: string;
  medicalCondition: string;
  preliminaryQuoteUsd?: unknown;
  preliminaryQuoteNotes?: string | null;
  preferredTravelWindow?: string | null;
  conversionNotes?: string | null;
}): string {
  const parts: string[] = [
    `Converted from Lead ${params.referenceNo} (${params.source})`,
    `Clinical Inquiry: ${params.medicalCondition.trim()}`,
  ];

  const quoteUsd = toNumericAmount(params.preliminaryQuoteUsd);
  if (quoteUsd > 0 || params.preliminaryQuoteNotes?.trim()) {
    const quoteAmountText = quoteUsd > 0 ? `$${quoteUsd.toLocaleString('en-US')} USD` : '';
    const quoteNotesText = params.preliminaryQuoteNotes?.trim() || '';
    const combinedQuote = [quoteAmountText, quoteNotesText].filter(Boolean).join(' — ');
    parts.push(`Preliminary Estimate: ${combinedQuote}`);
  }

  if (params.preferredTravelWindow) {
    parts.push(`Preferred Travel Window: ${params.preferredTravelWindow}`);
  }

  if (params.conversionNotes?.trim()) {
    parts.push(`Conversion Notes: ${params.conversionNotes.trim()}`);
  }

  return parts.join('\n\n');
}

/**
 * Atomically convert a qualified Lead into a Patient + Case (NEW_PATIENT)
 * or a new Case linked to an existing Patient (EXISTING_PATIENT), seeding
 * the 7-stage MVT ClinicalStep pathway, LeadActivity, AuditLog, and notifications.
 */
export async function convertLeadToPatientCase(
  leadId: string,
  input: unknown,
  actor: { userId: string; role: string; ipAddress?: string }
): Promise<ConversionServiceResult<ConvertedLeadPayload>> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can convert leads',
      status: 403,
    };
  }

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid conversion payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return {
        ok: false,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Lead not found',
        status: 404,
      };
    }

    if (
      actor.role === 'MANAGER' &&
      lead.assignedManagerId &&
      lead.assignedManagerId !== actor.userId
    ) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Lead is assigned to another coordinator',
        status: 403,
      };
    }

    if (lead.status === 'CONVERTED' || Boolean(lead.convertedCaseId)) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Lead has already been converted',
        status: 409,
      };
    }

    if (lead.status === 'LOST') {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Cannot convert a LOST lead. Reopen the lead first.',
        status: 400,
      };
    }

    const hospitalId =
      data.hospitalId !== undefined ? data.hospitalId : (lead.targetHospitalId ?? null);
    const primaryDoctorId =
      data.primaryDoctorId !== undefined ? data.primaryDoctorId : (lead.targetDoctorId ?? null);
    const specialtyId = data.specialtyId ?? lead.specialtyInterest ?? undefined;

    if (hospitalId && typeof tx.hospital?.findUnique === 'function') {
      const hospital = await tx.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, isActive: true },
      });
      if (!hospital || !hospital.isActive) {
        return {
          ok: false,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Target hospital not found or inactive',
          status: 400,
        };
      }
    }

    let doctorUserId: string | null = null;
    if (primaryDoctorId && typeof tx.doctor?.findUnique === 'function') {
      const doctor = await tx.doctor.findUnique({
        where: { id: primaryDoctorId },
        select: { id: true, userId: true, hospitalId: true, isActive: true },
      });
      if (!doctor || !doctor.isActive) {
        return {
          ok: false,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Primary doctor not found or inactive',
          status: 400,
        };
      }
      if (hospitalId && doctor.hospitalId !== hospitalId) {
        return {
          ok: false,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Primary doctor does not belong to the selected hospital',
          status: 400,
        };
      }
      doctorUserId = doctor.userId ?? null;
    }

    const baseManagerId =
      lead.assignedManagerId ?? (actor.role === 'MANAGER' ? actor.userId : null);
    const caseStatus = hospitalId && primaryDoctorId ? 'UNDER_REVIEW' : 'INQUIRY_RECEIVED';
    const richNotes = buildConversionCaseNotes({
      referenceNo: lead.referenceNo,
      source: lead.source,
      medicalCondition: lead.medicalCondition,
      preliminaryQuoteUsd: lead.preliminaryQuoteUsd,
      preliminaryQuoteNotes: lead.preliminaryQuoteNotes,
      preferredTravelWindow: lead.preferredTravelWindow,
      conversionNotes: data.notes ?? null,
    });

    let targetPatientId: string;
    let targetUserId: string;
    let finalManagerId: string | null = baseManagerId;
    let generatedTemporaryPassword: string | undefined;

    if (data.mode === 'NEW_PATIENT') {
      const normalizedEmail = data.email.trim().toLowerCase();
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        return {
          ok: false,
          code: ERROR_CODES.USER_ALREADY_EXISTS,
          message:
            'A user with this email already exists. Use EXISTING_PATIENT mode to link a new case.',
          status: 409,
        };
      }

      if (finalManagerId) {
        const capCheck = await assertManagerCapacity(tx, finalManagerId, 1);
        if (!capCheck.ok) {
          return capCheck;
        }
      }

      const rawPassword = data.password ?? generateStrongTemporaryPassword(16);
      if (!data.password) {
        generatedTemporaryPassword = rawPassword;
      }
      const passwordHash = await hashPassword(rawPassword);
      const encryptedPassport = encrypt(data.passportNo.trim());
      const resolvedPhone = (data.phone ?? lead.phone ?? lead.whatsappNumber)?.trim() || null;

      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: lead.fullName.trim(),
          phone: resolvedPhone,
          role: 'PATIENT',
          isActive: true,
        },
        select: { id: true, email: true, fullName: true, role: true },
      });

      const createdPatient = await tx.patient.create({
        data: {
          userId: createdUser.id,
          nationality: lead.nationality.trim(),
          passportNo: encryptedPassport,
          ...(data.passportExpiry ? { passportExpiry: new Date(data.passportExpiry) } : {}),
          dob: new Date(data.dob),
          bloodGroup: data.bloodGroup ?? null,
          primaryLanguage: lead.preferredLanguage?.trim() || null,
          medicalCondition: lead.medicalCondition.trim(),
          urgencyLevel: lead.urgencyLevel,
          assignedManagerId: finalManagerId,
        },
      });

      await tx.patientMedicalProfile.create({
        data: {
          patientId: createdPatient.id,
          ...(lead.specialtyInterest
            ? { specialisationsRequired: [lead.specialtyInterest] }
            : {}),
        },
      });

      targetPatientId = createdPatient.id;
      targetUserId = createdUser.id;
    } else {
      const existingPatient = await tx.patient.findUnique({
        where: { id: data.existingPatientId },
        select: { id: true, userId: true, assignedManagerId: true },
      });

      if (!existingPatient) {
        return {
          ok: false,
          code: ERROR_CODES.PATIENT_NOT_FOUND,
          message: 'Existing patient not found',
          status: 404,
        };
      }

      if (
        actor.role === 'MANAGER' &&
        existingPatient.assignedManagerId &&
        existingPatient.assignedManagerId !== actor.userId
      ) {
        return {
          ok: false,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Existing patient is assigned to another coordinator',
          status: 403,
        };
      }

      finalManagerId = existingPatient.assignedManagerId ?? baseManagerId ?? null;
      if (!existingPatient.assignedManagerId && finalManagerId) {
        const capCheck = await assertManagerCapacity(tx, finalManagerId, 1, [existingPatient.id]);
        if (!capCheck.ok) {
          return capCheck;
        }
        await tx.patient.update({
          where: { id: existingPatient.id },
          data: { assignedManagerId: finalManagerId },
        });
      }

      targetPatientId = existingPatient.id;
      targetUserId = existingPatient.userId;
    }

    const createdCase = await tx.case.create({
      data: {
        patientId: targetPatientId,
        managerId: finalManagerId,
        hospitalId: hospitalId ?? null,
        primaryDoctorId: primaryDoctorId ?? null,
        referralPartnerId: lead.referralPartnerId ?? null,
        status: caseStatus,
        isUrgent: lead.urgencyLevel === 'URGENT',
        notes: richNotes,
      },
    });

    const pathwaySteps = buildStandardMvtPathwaySteps(specialtyId);
    await tx.clinicalStep.createMany({
      data: pathwaySteps.map((step) => ({
        caseId: createdCase.id,
        stageName: step.stageName,
        stageOrder: step.stageOrder,
        stepOrder: step.stepOrder,
        title: step.title,
        category: step.category,
        status: step.status,
        decisionBranch: step.decisionBranch ?? null,
        doctorNotes: step.doctorNotes ?? null,
        actionType: step.actionType ?? null,
        requiredRole: step.requiredRole ?? null,
        actionUrl: step.actionUrl ?? null,
      })),
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: 'CONVERTED',
        convertedPatientId: targetPatientId,
        convertedCaseId: createdCase.id,
        convertedAt: now,
        ...(lead.firstRespondedAt ? {} : { firstRespondedAt: now }),
        ...(!lead.assignedManagerId && finalManagerId
          ? { assignedManagerId: finalManagerId }
          : {}),
      },
    });

    if (typeof tx.leadActivity?.create === 'function') {
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          actorId: actor.userId,
          activityType: 'CONVERSION',
          summary: `Converted to ${data.mode === 'NEW_PATIENT' ? 'new' : 'existing'} Patient & Case #${createdCase.id.slice(0, 8)}`,
          details: {
            mode: data.mode,
            patientId: targetPatientId,
            caseId: createdCase.id,
            caseStatus,
            hospitalId: hospitalId ?? null,
            primaryDoctorId: primaryDoctorId ?? null,
            referralPartnerId: lead.referralPartnerId ?? null,
          } as Prisma.InputJsonValue,
          completedAt: now,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: AUDIT_ACTIONS.CONVERT_LEAD,
        entityType: 'Lead',
        entityId: lead.id,
        oldValue: { status: lead.status },
        newValue: {
          status: 'CONVERTED',
          mode: data.mode,
          patientId: targetPatientId,
          caseId: createdCase.id,
          userId: targetUserId,
          referralPartnerId: lead.referralPartnerId ?? null,
        },
        ipAddress: actor.ipAddress ?? null,
      },
    });

    const notifications: Array<{
      userId: string;
      channel: 'IN_APP';
      title: string;
      body: string;
      triggerEvent: string;
    }> = [];

    if (finalManagerId) {
      notifications.push({
        userId: finalManagerId,
        channel: 'IN_APP',
        title: `Lead Converted (${lead.referenceNo})`,
        body: `${lead.fullName} converted to Case #${createdCase.id.slice(0, 8)} (${caseStatus}).`,
        triggerEvent: 'LEAD_CONVERTED',
      });
    }

    if (doctorUserId && doctorUserId !== finalManagerId) {
      notifications.push({
        userId: doctorUserId,
        channel: 'IN_APP',
        title: 'New Case Assigned for Review',
        body: `${lead.fullName} (${lead.nationality}) has been assigned to your clinical queue.`,
        triggerEvent: 'CASE_ASSIGNED',
      });
    }

    if (notifications.length > 0 && typeof tx.notification?.createMany === 'function') {
      await tx.notification.createMany({ data: notifications });
    }

    return {
      ok: true as const,
      data: {
        leadId: lead.id,
        patientId: targetPatientId,
        caseId: createdCase.id,
        userId: targetUserId,
        mode: data.mode,
        ...(generatedTemporaryPassword ? { generatedTemporaryPassword } : {}),
      },
    };
  });
}

function emptyLeadsFunnelAnalytics(): LeadsFunnelAnalyticsPayload {
  return {
    totalLeads: 0,
    activeLeads: 0,
    convertedLeads: 0,
    lostLeads: 0,
    conversionRatePercent: 0,
    avgFirstResponseMinutes: 0,
    slaBreachCount: 0,
    slaCompliancePercent: 100,
    stageCounts: LEAD_STATUSES.map((status) => ({ status, count: 0 })),
    sourceBreakdown: [],
    lostReasonBreakdown: [],
    partnerPerformance: [],
  };
}

/**
 * Aggregate CRM funnel stages, speed-to-lead SLAs, lost-reason diagnostics,
 * and B2B ReferralPartner attributed MedicalBill revenue.
 */
export async function computeLeadsCrmAnalytics(
  now: Date = new Date()
): Promise<LeadsFunnelAnalyticsPayload> {
  if (typeof prisma?.lead?.findMany !== 'function') {
    return emptyLeadsFunnelAnalytics();
  }

  const [leads, partners, attributedCases, attributedBills] = await Promise.all([
    prisma.lead.findMany({
      select: {
        id: true,
        status: true,
        source: true,
        lostReason: true,
        referralPartnerId: true,
        convertedCaseId: true,
        firstResponseDueAt: true,
        firstRespondedAt: true,
        createdAt: true,
      },
    }),
    typeof prisma?.referralPartner?.findMany === 'function'
      ? prisma.referralPartner.findMany({
          select: {
            id: true,
            name: true,
            code: true,
            partnerType: true,
            country: true,
            commissionPercent: true,
          },
        })
      : Promise.resolve([]),
    typeof prisma?.case?.findMany === 'function'
      ? prisma.case.findMany({
          where: { referralPartnerId: { not: null } },
          select: { id: true, referralPartnerId: true },
        })
      : Promise.resolve([]),
    typeof prisma?.medicalBill?.findMany === 'function'
      ? prisma.medicalBill.findMany({
          where: {
            status: { not: 'CANCELLED' },
            case: { referralPartnerId: { not: null } },
          },
          select: {
            totalAmount: true,
            caseId: true,
            case: { select: { referralPartnerId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const stageMap = new Map<string, number>();
  for (const status of LEAD_STATUSES) {
    stageMap.set(status, 0);
  }

  const sourceMap = new Map<string, { count: number; convertedCount: number }>();
  const lostReasonMap = new Map<string, number>();

  let activeLeads = 0;
  let convertedLeads = 0;
  let lostLeads = 0;
  let respondedCount = 0;
  let totalResponseMinutes = 0;
  let slaBreachCount = 0;
  let slaOnTimeCount = 0;

  for (const lead of leads) {
    stageMap.set(lead.status, (stageMap.get(lead.status) ?? 0) + 1);

    if (lead.status === 'CONVERTED') {
      convertedLeads += 1;
    } else if (lead.status === 'LOST') {
      lostLeads += 1;
      const reason = lead.lostReason || 'OTHER';
      lostReasonMap.set(reason, (lostReasonMap.get(reason) ?? 0) + 1);
    } else {
      activeLeads += 1;
    }

    const srcStats = sourceMap.get(lead.source) ?? { count: 0, convertedCount: 0 };
    srcStats.count += 1;
    if (lead.status === 'CONVERTED') {
      srcStats.convertedCount += 1;
    }
    sourceMap.set(lead.source, srcStats);

    if (lead.firstRespondedAt) {
      const diffMs = Math.max(
        0,
        new Date(lead.firstRespondedAt).getTime() - new Date(lead.createdAt).getTime()
      );
      totalResponseMinutes += diffMs / 60_000;
      respondedCount += 1;
    }

    const slaState = computeLeadSlaState({
      firstResponseDueAt: lead.firstResponseDueAt,
      firstRespondedAt: lead.firstRespondedAt,
      status: lead.status,
      now,
    });
    if (slaState === 'BREACHED' || slaState === 'RESPONDED_LATE') {
      slaBreachCount += 1;
    } else if (slaState === 'RESPONDED_ON_TIME') {
      slaOnTimeCount += 1;
    }
  }

  const totalLeads = leads.length;
  const conversionRatePercent =
    totalLeads > 0 ? roundOneDecimal((convertedLeads / totalLeads) * 100) : 0;
  const avgFirstResponseMinutes =
    respondedCount > 0 ? roundOneDecimal(totalResponseMinutes / respondedCount) : 0;
  const evaluatedSlaCount = slaOnTimeCount + slaBreachCount;
  const slaCompliancePercent =
    evaluatedSlaCount > 0 ? roundOneDecimal((slaOnTimeCount / evaluatedSlaCount) * 100) : 100;

  const casePartnerById = new Map<string, string>();
  const caseCountByPartner = new Map<string, number>();
  for (const c of attributedCases) {
    if (c.referralPartnerId) {
      casePartnerById.set(c.id, c.referralPartnerId);
      caseCountByPartner.set(
        c.referralPartnerId,
        (caseCountByPartner.get(c.referralPartnerId) ?? 0) + 1
      );
    }
  }

  const revenueByPartner = new Map<string, number>();
  for (const bill of attributedBills) {
    const partnerId =
      (bill as { case?: { referralPartnerId?: string | null } }).case?.referralPartnerId ??
      casePartnerById.get(bill.caseId);
    if (!partnerId) continue;
    revenueByPartner.set(
      partnerId,
      (revenueByPartner.get(partnerId) ?? 0) + toNumericAmount(bill.totalAmount)
    );
  }

  const leadsByPartner = new Map<string, { total: number; converted: number }>();
  for (const lead of leads) {
    if (!lead.referralPartnerId) continue;
    const entry = leadsByPartner.get(lead.referralPartnerId) ?? { total: 0, converted: 0 };
    entry.total += 1;
    if (lead.status === 'CONVERTED') {
      entry.converted += 1;
    }
    leadsByPartner.set(lead.referralPartnerId, entry);
  }

  const partnerPerformance = partners
    .map((partner) => {
      const leadStats = leadsByPartner.get(partner.id) ?? { total: 0, converted: 0 };
      const commissionPercent = toNumericAmount(partner.commissionPercent);
      const attributedRevenueUsd = roundCurrency(revenueByPartner.get(partner.id) ?? 0);
      const estimatedPartnerCommissionUsd = roundCurrency(
        attributedRevenueUsd * (commissionPercent / 100)
      );

      return {
        id: partner.id,
        name: partner.name,
        code: partner.code,
        partnerType: partner.partnerType,
        country: partner.country,
        commissionPercent,
        totalLeads: leadStats.total,
        convertedLeads: leadStats.converted,
        conversionRatePercent:
          leadStats.total > 0 ? roundOneDecimal((leadStats.converted / leadStats.total) * 100) : 0,
        attributedCases: caseCountByPartner.get(partner.id) ?? 0,
        attributedRevenueUsd,
        estimatedPartnerCommissionUsd,
      };
    })
    .sort((a, b) => {
      if (b.attributedRevenueUsd !== a.attributedRevenueUsd) {
        return b.attributedRevenueUsd - a.attributedRevenueUsd;
      }
      return b.totalLeads - a.totalLeads;
    });

  return {
    totalLeads,
    activeLeads,
    convertedLeads,
    lostLeads,
    conversionRatePercent,
    avgFirstResponseMinutes,
    slaBreachCount,
    slaCompliancePercent,
    stageCounts: Array.from(stageMap.entries()).map(([status, count]) => ({ status, count })),
    sourceBreakdown: Array.from(sourceMap.entries())
      .map(([source, stats]) => ({ source, ...stats }))
      .sort((a, b) => b.count - a.count),
    lostReasonBreakdown: Array.from(lostReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    partnerPerformance,
  };
}
