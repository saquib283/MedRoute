/**
 * Afzal Healthcare — Advanced Leads CRM, Auto-Routing, Deduplication & B2B Referral Partners Service
 */

import crypto from 'node:crypto';
import type { LeadSource, LeadStatus, LeadTemperature, Prisma, UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { generateCSV } from '@/lib/api/csv-helper';
import {
  buildWhatsAppFollowUpUrl,
  computeLeadFirstResponseDueAt,
  computeLeadScoreAndTemperature,
  computeLeadSlaState,
  createLeadSchema,
  getLeadSlaMinutes,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
  logLeadActivitySchema,
  publicInquirySchema,
  referralPartnerSchema,
  updateLeadSchema,
  updateReferralPartnerSchema,
  validateLeadStatusTransition,
  type LeadSlaState,
} from '@/lib/validation/leads-crm-schemas';

export type LeadServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number; details?: unknown };

export interface LeadActor {
  userId: string;
  role: UserRole | string;
  email?: string;
  ipAddress?: string;
}

export interface LeadListQuery {
  status?: string;
  source?: string;
  temperature?: string;
  assignedManagerId?: string;
  referralPartnerId?: string;
  slaState?: string;
  followUpsDue?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DuplicateMatchSummary {
  kind: 'LEAD' | 'PATIENT';
  id: string;
  referenceNo?: string;
  fullName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  status: string;
  matchedBy: ('EMAIL' | 'PHONE')[];
  createdAt: Date | string;
}

export interface PublicInquiryResponse {
  referenceNo: string;
  slaMinutes: number;
  temperature: LeadTemperature;
}

const PUBLIC_INQUIRY_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_INQUIRY_MAX_PER_WINDOW = 5;
const publicInquiryIpHits = new Map<string, number[]>();

const OUTBOUND_ACTIVITY_TYPES = new Set<string>([
  'WHATSAPP',
  'PHONE_CALL',
  'EMAIL',
  'QUOTE_ESTIMATE',
]);

/**
 * Reset the in-memory sliding-window public inquiry rate limiter (for unit tests).
 */
export function resetPublicInquiryRateLimitForTests(): void {
  publicInquiryIpHits.clear();
}

function checkAndRecordPublicInquiryRateLimit(ipAddress: string, nowMs: number = Date.now()): boolean {
  const key = ipAddress.trim() || 'unknown';
  const windowStart = nowMs - PUBLIC_INQUIRY_WINDOW_MS;
  const recent = (publicInquiryIpHits.get(key) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= PUBLIC_INQUIRY_MAX_PER_WINDOW) {
    publicInquiryIpHits.set(key, recent);
    return false;
  }

  recent.push(nowMs);
  publicInquiryIpHits.set(key, recent);
  return true;
}

function validateLeadEnumFilters(query: {
  status?: string;
  source?: string;
  temperature?: string;
}): { ok: true } | { ok: false; code: string; message: string; status: number } {
  if (query.status && !(LEAD_STATUSES as readonly string[]).includes(query.status)) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Invalid lead status filter: ${query.status}`,
      status: 400,
    };
  }
  if (query.source && !(LEAD_SOURCES as readonly string[]).includes(query.source)) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Invalid lead source filter: ${query.source}`,
      status: 400,
    };
  }
  if (
    query.temperature &&
    !(LEAD_TEMPERATURES as readonly string[]).includes(query.temperature)
  ) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Invalid lead temperature filter: ${query.temperature}`,
      status: 400,
    };
  }
  return { ok: true };
}

async function assertReferralPartnerExists(
  referralPartnerId: string
): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  if (typeof prisma?.referralPartner?.findUnique !== 'function') {
    return { ok: true };
  }
  const partner = await prisma.referralPartner.findUnique({
    where: { id: referralPartnerId },
    select: { id: true },
  });
  if (!partner) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Referral partner not found',
      status: 400,
    };
  }
  return { ok: true };
}

function isStaffActor(actor: LeadActor): boolean {
  return actor.role === 'ADMIN' || actor.role === 'MANAGER';
}

function generateLeadReferenceNo(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LD-${year}-${suffix}`;
}

function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'object' && val !== null && 'toNumber' in val && typeof (val as { toNumber: () => number }).toNumber === 'function') {
    const n = (val as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneLast9(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

function maskEmail(email?: string | null): string | null {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  const [local, domain] = norm.split('@');
  if (!domain) return '***';
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

function sanitizePartnerForActor<T extends Record<string, unknown>>(
  partner: T | null | undefined,
  actor: LeadActor
): T | Omit<T, 'commissionPercent'> | null {
  if (!partner) return null;
  if (actor.role === 'ADMIN') {
    return partner;
  }
  const copy = { ...partner };
  delete copy.commissionPercent;
  return copy;
}

async function loadManagerLanguageMap(): Promise<Record<string, string[]>> {
  if (typeof prisma?.systemConfig?.findUnique !== 'function') {
    return {};
  }
  try {
    const cfg = await prisma.systemConfig.findUnique({ where: { key: 'manager_languages' } });
    if (!cfg?.value) return {};
    const parsed = JSON.parse(cfg.value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) {
        out[k] = v.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Route a new inquiry to the active MANAGER with matching preferredLanguage affinity first,
 * breaking ties by least open workload (active leads + assigned patients).
 */
async function resolveAssignedCoordinatorId(preferredLanguage?: string | null): Promise<string | null> {
  if (typeof prisma?.user?.findMany !== 'function') {
    return null;
  }

  const [managers, configuredLanguages] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'MANAGER', isActive: true },
      select: {
        id: true,
        fullName: true,
        _count: {
          select: {
            managedLeads: { where: { status: { notIn: ['CONVERTED', 'LOST'] } } },
            managedPatients: true,
          },
        },
        managedPatients: {
          where: { primaryLanguage: { not: null } },
          select: { primaryLanguage: true },
          take: 25,
        },
        managedLeads: {
          where: { preferredLanguage: { not: null } },
          select: { preferredLanguage: true },
          take: 25,
        },
      },
    }),
    loadManagerLanguageMap(),
  ]);

  if (!Array.isArray(managers) || managers.length === 0) {
    return null;
  }

  const targetLang = preferredLanguage?.trim().toLowerCase() || null;

  const ranked = managers.map((mgr) => {
    const extLanguages = (mgr as unknown as { languages?: unknown }).languages;
    const managerLangSet = new Set<string>(configuredLanguages[mgr.id] ?? []);

    if (Array.isArray(extLanguages)) {
      for (const lang of extLanguages) {
        if (typeof lang === 'string' && lang.trim()) {
          managerLangSet.add(lang.trim().toLowerCase());
        }
      }
    }

    for (const pat of mgr.managedPatients ?? []) {
      if (pat.primaryLanguage?.trim()) {
        managerLangSet.add(pat.primaryLanguage.trim().toLowerCase());
      }
    }

    for (const lead of mgr.managedLeads ?? []) {
      if (lead.preferredLanguage?.trim()) {
        managerLangSet.add(lead.preferredLanguage.trim().toLowerCase());
      }
    }

    const hasLanguageAffinity = Boolean(targetLang && managerLangSet.has(targetLang));
    const openWorkload = (mgr._count?.managedLeads ?? 0) + (mgr._count?.managedPatients ?? 0);

    return {
      id: mgr.id,
      fullName: mgr.fullName ?? '',
      hasLanguageAffinity,
      openWorkload,
    };
  });

  ranked.sort((a, b) => {
    if (a.hasLanguageAffinity !== b.hasLanguageAffinity) {
      return a.hasLanguageAffinity ? -1 : 1;
    }
    if (a.openWorkload !== b.openWorkload) {
      return a.openWorkload - b.openWorkload;
    }
    return a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
  });

  return ranked[0]?.id ?? null;
}

function enrichLeadForStaff<T extends Record<string, unknown>>(lead: T, actor: LeadActor) {
  const firstResponseDueAt = lead.firstResponseDueAt as Date | string;
  const firstRespondedAt = (lead.firstRespondedAt as Date | string | null | undefined) ?? null;
  const status = String(lead.status ?? 'NEW');
  const assignedManager = lead.assignedManager as { fullName?: string } | null | undefined;
  const referralPartner = lead.referralPartner as Record<string, unknown> | null | undefined;

  const slaState: LeadSlaState = computeLeadSlaState({
    firstResponseDueAt,
    firstRespondedAt,
    status,
  });

  const whatsappUrl = buildWhatsAppFollowUpUrl({
    phone: (lead.whatsappNumber as string | null) ?? (lead.phone as string | null),
    fullName: String(lead.fullName ?? ''),
    referenceNo: String(lead.referenceNo ?? ''),
    coordinatorName: assignedManager?.fullName,
    specialty: (lead.specialtyInterest as string | null) ?? null,
  });

  const scoreResult = computeLeadScoreAndTemperature({
    urgencyLevel: lead.urgencyLevel as string | null,
    hasDiagnosticReports: lead.hasDiagnosticReports as boolean | null,
    medicalCondition: lead.medicalCondition as string | null,
    specialtyInterest: lead.specialtyInterest as string | null,
    passportReady: lead.passportReady as boolean | null,
    preferredTravelWindow: lead.preferredTravelWindow as string | null,
    estimatedBudgetUsd: toNumberOrNull(lead.estimatedBudgetUsd),
    source: lead.source as string | null,
    email: lead.email as string | null,
    phone: lead.phone as string | null,
    whatsappNumber: lead.whatsappNumber as string | null,
  });

  return {
    ...lead,
    referralPartner: referralPartner ? sanitizePartnerForActor(referralPartner, actor) : null,
    slaState,
    scoreBreakdown: scoreResult.breakdown,
    whatsappUrl,
  };
}

/**
 * Public unauthenticated intake with per-IP sliding-window rate limiting,
 * silent honeypot filtering, B2B ?ref= attribution, language-aware routing,
 * deterministic scoring, and SLA due-time calculation.
 */
export async function capturePublicInquiry(
  input: unknown,
  meta: { ipAddress: string }
): Promise<LeadServiceResult<PublicInquiryResponse> & { isHoneypotDrop?: boolean }> {
  const allowed = checkAndRecordPublicInquiryRateLimit(meta.ipAddress);
  if (!allowed) {
    return {
      ok: false,
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many inquiry submissions. Please try again in 15 minutes.',
      status: 429,
    };
  }

  const parsed = publicInquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid inquiry submission',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Silent honeypot drop — return convincing 200 without persisting anything
  if (data.websiteUrl && data.websiteUrl.trim().length > 0) {
    return {
      ok: true,
      isHoneypotDrop: true,
      data: {
        referenceNo: generateLeadReferenceNo(),
        slaMinutes: 60,
        temperature: 'WARM',
      },
    };
  }

  let referralPartnerId: string | null = null;
  let source: LeadSource = 'WEBSITE_INQUIRY';

  if (data.referralCode && typeof prisma?.referralPartner?.findUnique === 'function') {
    const partner = await prisma.referralPartner.findUnique({
      where: { code: data.referralCode.trim().toUpperCase() },
      select: { id: true, isActive: true },
    });
    if (partner && partner.isActive) {
      referralPartnerId = partner.id;
      source = 'B2B_PARTNER';
    }
  }

  const now = new Date();
  const scoreResult = computeLeadScoreAndTemperature({
    urgencyLevel: data.urgencyLevel,
    hasDiagnosticReports: data.hasDiagnosticReports,
    medicalCondition: data.medicalCondition,
    specialtyInterest: data.specialtyInterest ?? null,
    passportReady: data.passportReady,
    preferredTravelWindow: data.preferredTravelWindow ?? null,
    estimatedBudgetUsd: data.estimatedBudgetUsd ?? null,
    source,
    email: data.email ?? null,
    phone: data.phone ?? null,
    whatsappNumber: data.whatsappNumber ?? null,
  });

  const firstResponseDueAt = computeLeadFirstResponseDueAt(
    data.urgencyLevel,
    scoreResult.temperature,
    now
  );
  const slaMinutes = getLeadSlaMinutes(data.urgencyLevel, scoreResult.temperature);
  const assignedManagerId = await resolveAssignedCoordinatorId(data.preferredLanguage);
  const referenceNo = generateLeadReferenceNo(now);

  const lead = await prisma.lead.create({
    data: {
      referenceNo,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      whatsappNumber: data.whatsappNumber ?? null,
      nationality: data.nationality,
      countryOfResidence: data.countryOfResidence ?? null,
      preferredLanguage: data.preferredLanguage ?? null,
      medicalCondition: data.medicalCondition,
      specialtyInterest: data.specialtyInterest ?? null,
      urgencyLevel: data.urgencyLevel,
      hasDiagnosticReports: data.hasDiagnosticReports,
      passportReady: data.passportReady,
      preferredTravelWindow: data.preferredTravelWindow ?? null,
      estimatedBudgetUsd: data.estimatedBudgetUsd ?? null,
      status: 'NEW',
      source,
      leadScore: scoreResult.score,
      temperature: scoreResult.temperature,
      assignedManagerId,
      referralPartnerId,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      firstResponseDueAt,
    },
  });

  if (typeof prisma?.leadActivity?.create === 'function') {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        actorId: null,
        activityType: 'NOTE',
        summary: `Public web inquiry captured (${source})`,
        details: {
          score: scoreResult.score,
          temperature: scoreResult.temperature,
          slaMinutes,
          referralCode: data.referralCode ?? null,
        },
      },
    });
  }

  if (assignedManagerId && typeof prisma?.notification?.create === 'function') {
    try {
      await prisma.notification.create({
        data: {
          userId: assignedManagerId,
          channel: 'IN_APP',
          title: `New ${scoreResult.temperature} Lead Assigned (${lead.referenceNo})`,
          body: `${data.fullName} (${data.nationality}) — SLA target ${slaMinutes}m.`,
          triggerEvent: 'LEAD_ASSIGNED',
        },
      });
    } catch {
      // Non-fatal: notification failure must not block public intake
    }
  }

  return {
    ok: true,
    data: {
      referenceNo: lead.referenceNo,
      slaMinutes,
      temperature: scoreResult.temperature,
    },
  };
}

/**
 * Find potential duplicate Leads and Patients by normalized email and last-9 phone digits.
 * Never exposes raw email, raw phone, or passport numbers.
 */
export async function findPotentialDuplicates(params: {
  email?: string | null;
  phone?: string | null;
  excludeLeadId?: string;
}): Promise<DuplicateMatchSummary[]> {
  const normEmail = normalizeEmail(params.email);
  const last9 = normalizePhoneLast9(params.phone);

  if (!normEmail && !last9) {
    return [];
  }

  const last4 = last9 ? last9.slice(-4) : null;
  const leadOrConditions: Prisma.LeadWhereInput[] = [];
  if (normEmail) {
    leadOrConditions.push({ email: normEmail });
  }
  if (last4) {
    leadOrConditions.push({ phone: { contains: last4 } });
    leadOrConditions.push({ whatsappNumber: { contains: last4 } });
  }

  const patientOrConditions: Prisma.UserWhereInput[] = [];
  if (normEmail) {
    patientOrConditions.push({ email: normEmail });
  }
  if (last4) {
    patientOrConditions.push({ phone: { contains: last4 } });
  }

  const [leadCandidates, patientCandidates] = await Promise.all([
    typeof prisma?.lead?.findMany === 'function'
      ? prisma.lead.findMany({
          where: {
            ...(params.excludeLeadId ? { id: { not: params.excludeLeadId } } : {}),
            OR: leadOrConditions,
          },
          select: {
            id: true,
            referenceNo: true,
            fullName: true,
            email: true,
            phone: true,
            whatsappNumber: true,
            status: true,
            createdAt: true,
          },
          take: 50,
        })
      : Promise.resolve([]),
    typeof prisma?.patient?.findMany === 'function'
      ? prisma.patient.findMany({
          where: {
            user: { OR: patientOrConditions },
          },
          select: {
            id: true,
            nationality: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            cases: {
              select: { id: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const results: DuplicateMatchSummary[] = [];

  for (const lead of leadCandidates) {
    if (params.excludeLeadId && lead.id === params.excludeLeadId) continue;

    const matchedBy: ('EMAIL' | 'PHONE')[] = [];
    if (normEmail && normalizeEmail(lead.email) === normEmail) {
      matchedBy.push('EMAIL');
    }
    if (
      last9 &&
      (normalizePhoneLast9(lead.phone) === last9 ||
        normalizePhoneLast9(lead.whatsappNumber) === last9)
    ) {
      matchedBy.push('PHONE');
    }

    if (matchedBy.length > 0) {
      results.push({
        kind: 'LEAD',
        id: lead.id,
        referenceNo: lead.referenceNo,
        fullName: lead.fullName,
        maskedEmail: maskEmail(lead.email),
        maskedPhone: maskPhone(lead.phone ?? lead.whatsappNumber),
        status: lead.status,
        matchedBy,
        createdAt: lead.createdAt,
      });
    }
  }

  for (const patient of patientCandidates) {
    const matchedBy: ('EMAIL' | 'PHONE')[] = [];
    if (normEmail && normalizeEmail(patient.user?.email) === normEmail) {
      matchedBy.push('EMAIL');
    }
    if (last9 && normalizePhoneLast9(patient.user?.phone) === last9) {
      matchedBy.push('PHONE');
    }

    if (matchedBy.length > 0) {
      results.push({
        kind: 'PATIENT',
        id: patient.id,
        fullName: patient.user?.fullName ?? 'Existing Patient',
        maskedEmail: maskEmail(patient.user?.email),
        maskedPhone: maskPhone(patient.user?.phone),
        status: patient.cases?.[0]?.status ?? 'ACTIVE_PATIENT',
        matchedBy,
        createdAt: patient.createdAt,
      });
    }
  }

  return results;
}

/**
 * Staff creation of a new Lead (Phone, WhatsApp, Walk-In, Referral, etc.).
 */
export async function createStaffLead(
  input: unknown,
  actor: LeadActor
): Promise<LeadServiceResult<{ lead: ReturnType<typeof enrichLeadForStaff>; potentialDuplicates: DuplicateMatchSummary[] }>> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can create leads',
      status: 403,
    };
  }

  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid lead payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  let assignedManagerId: string | null = null;

  if (actor.role === 'MANAGER') {
    if (data.assignedManagerId && data.assignedManagerId !== actor.userId) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Managers cannot assign leads to other coordinators',
        status: 403,
      };
    }
    assignedManagerId = data.assignedManagerId === null ? null : actor.userId;
  } else {
    if (data.assignedManagerId === null) {
      assignedManagerId = null;
    } else if (typeof data.assignedManagerId === 'string' && data.assignedManagerId.trim()) {
      const targetMgr = await prisma.user.findUnique({
        where: { id: data.assignedManagerId.trim(), role: 'MANAGER', isActive: true },
        select: { id: true, role: true, isActive: true },
      });
      if (!targetMgr || targetMgr.role !== 'MANAGER' || !targetMgr.isActive) {
        return {
          ok: false,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Target coordinator not found or inactive',
          status: 400,
        };
      }
      assignedManagerId = targetMgr.id;
    } else {
      assignedManagerId = await resolveAssignedCoordinatorId(data.preferredLanguage);
    }
  }

  if (data.referralPartnerId) {
    const partnerCheck = await assertReferralPartnerExists(data.referralPartnerId);
    if (!partnerCheck.ok) {
      return partnerCheck;
    }
  }

  const now = new Date();
  const scoreResult = computeLeadScoreAndTemperature({
    urgencyLevel: data.urgencyLevel,
    hasDiagnosticReports: data.hasDiagnosticReports,
    medicalCondition: data.medicalCondition,
    specialtyInterest: data.specialtyInterest ?? null,
    passportReady: data.passportReady,
    preferredTravelWindow: data.preferredTravelWindow ?? null,
    estimatedBudgetUsd: data.estimatedBudgetUsd ?? null,
    source: data.source,
    email: data.email ?? null,
    phone: data.phone ?? null,
    whatsappNumber: data.whatsappNumber ?? null,
  });

  const firstResponseDueAt = computeLeadFirstResponseDueAt(
    data.urgencyLevel,
    scoreResult.temperature,
    now
  );
  const referenceNo = generateLeadReferenceNo(now);

  const created = await prisma.lead.create({
    data: {
      referenceNo,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      whatsappNumber: data.whatsappNumber ?? null,
      nationality: data.nationality,
      countryOfResidence: data.countryOfResidence ?? null,
      preferredLanguage: data.preferredLanguage ?? null,
      medicalCondition: data.medicalCondition,
      specialtyInterest: data.specialtyInterest ?? null,
      urgencyLevel: data.urgencyLevel,
      hasDiagnosticReports: data.hasDiagnosticReports,
      passportReady: data.passportReady,
      preferredTravelWindow: data.preferredTravelWindow ?? null,
      estimatedBudgetUsd: data.estimatedBudgetUsd ?? null,
      preliminaryQuoteUsd: data.preliminaryQuoteUsd ?? null,
      preliminaryQuoteNotes: data.preliminaryQuoteNotes ?? null,
      targetHospitalId: data.targetHospitalId ?? null,
      targetDoctorId: data.targetDoctorId ?? null,
      status: 'NEW',
      source: data.source,
      leadScore: scoreResult.score,
      temperature: scoreResult.temperature,
      assignedManagerId,
      referralPartnerId: data.referralPartnerId ?? null,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      firstResponseDueAt,
      nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
    },
    include: {
      assignedManager: { select: { id: true, fullName: true, email: true } },
      referralPartner: {
        select: {
          id: true,
          name: true,
          code: true,
          partnerType: true,
          country: true,
          ...(actor.role === 'ADMIN' ? { commissionPercent: true } : {}),
        },
      },
    },
  });

  if (typeof prisma?.leadActivity?.create === 'function') {
    await prisma.leadActivity.create({
      data: {
        leadId: created.id,
        actorId: actor.userId,
        activityType: 'NOTE',
        summary: `Lead logged by staff (${data.source})`,
      },
    });
  }

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.CREATE_LEAD,
    entityType: 'Lead',
    entityId: created.id,
    newValue: {
      referenceNo: created.referenceNo,
      source: created.source,
      assignedManagerId: created.assignedManagerId,
    },
    ipAddress: actor.ipAddress,
  });

  const potentialDuplicates = await findPotentialDuplicates({
    email: created.email,
    phone: created.phone ?? created.whatsappNumber,
    excludeLeadId: created.id,
  });

  return {
    ok: true,
    data: {
      lead: enrichLeadForStaff(created as unknown as Record<string, unknown>, actor),
      potentialDuplicates,
    },
  };
}

function normalizeCsvBoolean(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') return true;
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'no' || trimmed === '') return false;
  }
  return undefined;
}

/**
 * Bulk CSV row import for staff (`ADMIN` or `MANAGER`) with per-row Zod validation.
 */
export async function importLeadsFromCsvRows(
  rows: unknown[],
  actor: LeadActor
): Promise<
  LeadServiceResult<{
    createdCount: number;
    skippedCount: number;
    createdIds: string[];
    errors: Array<{ row: number; error: string }>;
  }>
> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can import leads',
      status: 403,
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Provide at least one row for bulk import',
      status: 400,
    };
  }

  if (rows.length > 500) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Bulk import is limited to 500 rows per batch',
      status: 400,
    };
  }

  let createdCount = 0;
  let skippedCount = 0;
  const createdIds: string[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rawRow = rows[i];
    const rowNumber = i + 1;

    if (!rawRow || typeof rawRow !== 'object') {
      skippedCount += 1;
      errors.push({ row: rowNumber, error: 'Row must be an object' });
      continue;
    }

    const rowObj = { ...(rawRow as Record<string, unknown>) };
    const diagBool = normalizeCsvBoolean(rowObj.hasDiagnosticReports);
    if (diagBool !== undefined) rowObj.hasDiagnosticReports = diagBool;
    const passBool = normalizeCsvBoolean(rowObj.passportReady);
    if (passBool !== undefined) rowObj.passportReady = passBool;

    const res = await createStaffLead(rowObj, actor);
    if (!res.ok) {
      skippedCount += 1;
      errors.push({ row: rowNumber, error: res.message });
    } else {
      createdCount += 1;
      createdIds.push(String((res.data.lead as { id?: string }).id ?? ''));
    }
  }

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.CREATE_LEAD,
    entityType: 'Lead',
    entityId: 'bulk-import',
    newValue: { createdCount, skippedCount },
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      createdCount,
      skippedCount,
      createdIds: createdIds.filter(Boolean),
      errors,
    },
  };
}

/**
 * List Leads & pipeline KPIs scoped to actor role:
 * - ADMIN sees all leads
 * - MANAGER sees leads assigned to self OR unassigned (assignedManagerId: null)
 */
export async function listLeadsForActor(
  query: LeadListQuery,
  actor: LeadActor
): Promise<
  LeadServiceResult<{
    leads: ReturnType<typeof enrichLeadForStaff>[];
    kpis: {
      newUnclaimed: number;
      slaAttention: number;
      followUpsDue: number;
      hotCount: number;
      quoteSharedCount: number;
      convertedCount: number;
    };
    meta: { page: number; limit: number; total: number };
  }>
> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can view leads',
      status: 403,
    };
  }

  const filterCheck = validateLeadEnumFilters(query);
  if (!filterCheck.ok) {
    return filterCheck;
  }

  const page = Math.max(1, Number.isFinite(query.page) ? Number(query.page) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(query.limit) ? Number(query.limit) : 20));
  const now = new Date();
  const soonCutoff = new Date(now.getTime() + 15 * 60 * 1000);

  const scopeWhere: Prisma.LeadWhereInput =
    actor.role === 'MANAGER'
      ? {
          OR: [{ assignedManagerId: actor.userId }, { assignedManagerId: null }],
        }
      : {};

  const andClauses: Prisma.LeadWhereInput[] = [];
  if (Object.keys(scopeWhere).length > 0) {
    andClauses.push(scopeWhere);
  }

  if (query.status) {
    andClauses.push({ status: query.status as LeadStatus });
  }
  if (query.source) {
    andClauses.push({ source: query.source as LeadSource });
  }
  if (query.temperature) {
    andClauses.push({ temperature: query.temperature as LeadTemperature });
  }
  if (query.referralPartnerId) {
    andClauses.push({ referralPartnerId: query.referralPartnerId });
  }
  if (query.assignedManagerId) {
    if (query.assignedManagerId === 'UNASSIGNED') {
      andClauses.push({ assignedManagerId: null });
    } else {
      andClauses.push({ assignedManagerId: query.assignedManagerId });
    }
  }
  if (query.followUpsDue) {
    andClauses.push({
      nextFollowUpAt: { lte: now },
      status: { notIn: ['CONVERTED', 'LOST'] },
    });
  }
  if (query.slaState === 'BREACHED') {
    andClauses.push({
      firstRespondedAt: null,
      firstResponseDueAt: { lt: now },
      status: { notIn: ['CONVERTED', 'LOST'] },
    });
  } else if (query.slaState === 'DUE_SOON') {
    andClauses.push({
      firstRespondedAt: null,
      firstResponseDueAt: { gte: now, lte: soonCutoff },
      status: { notIn: ['CONVERTED', 'LOST'] },
    });
  } else if (query.slaState === 'ATTENTION') {
    andClauses.push({
      firstRespondedAt: null,
      firstResponseDueAt: { lte: soonCutoff },
      status: { notIn: ['CONVERTED', 'LOST'] },
    });
  }
  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    andClauses.push({
      OR: [
        { referenceNo: { contains: s } },
        { fullName: { contains: s } },
        { email: { contains: s } },
        { phone: { contains: s } },
        { nationality: { contains: s } },
        { medicalCondition: { contains: s } },
      ],
    });
  }

  const where: Prisma.LeadWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const [
    rows,
    total,
    newUnclaimed,
    slaAttention,
    followUpsDue,
    hotCount,
    quoteSharedCount,
    convertedCount,
  ] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedManager: { select: { id: true, fullName: true, email: true } },
        referralPartner: {
          select: {
            id: true,
            name: true,
            code: true,
            partnerType: true,
            country: true,
            ...(actor.role === 'ADMIN' ? { commissionPercent: true } : {}),
          },
        },
        _count: { select: { activities: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.count({
      where: { AND: [scopeWhere, { status: 'NEW', assignedManagerId: null }] },
    }),
    prisma.lead.count({
      where: {
        AND: [
          scopeWhere,
          {
            firstRespondedAt: null,
            firstResponseDueAt: { lte: soonCutoff },
            status: { notIn: ['CONVERTED', 'LOST'] },
          },
        ],
      },
    }),
    prisma.lead.count({
      where: {
        AND: [
          scopeWhere,
          {
            nextFollowUpAt: { lte: now },
            status: { notIn: ['CONVERTED', 'LOST'] },
          },
        ],
      },
    }),
    prisma.lead.count({
      where: {
        AND: [
          scopeWhere,
          { temperature: 'HOT', status: { notIn: ['CONVERTED', 'LOST'] } },
        ],
      },
    }),
    prisma.lead.count({
      where: { AND: [scopeWhere, { status: 'QUOTE_SHARED' }] },
    }),
    prisma.lead.count({
      where: { AND: [scopeWhere, { status: 'CONVERTED' }] },
    }),
  ]);

  return {
    ok: true,
    data: {
      leads: rows.map((row) => enrichLeadForStaff(row as unknown as Record<string, unknown>, actor)),
      kpis: {
        newUnclaimed,
        slaAttention,
        followUpsDue,
        hotCount,
        quoteSharedCount,
        convertedCount,
      },
      meta: { page, limit, total },
    },
  };
}

/**
 * Fetch a full Lead dossier (activity timeline, score breakdown, SLA, WhatsApp link, potential duplicates).
 */
export async function getLeadDossierForActor(
  leadId: string,
  actor: LeadActor
): Promise<
  LeadServiceResult<{
    lead: ReturnType<typeof enrichLeadForStaff>;
    potentialDuplicates: DuplicateMatchSummary[];
  }>
> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can inspect leads',
      status: 403,
    };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignedManager: { select: { id: true, fullName: true, email: true } },
      referralPartner: {
        select: {
          id: true,
          name: true,
          code: true,
          partnerType: true,
          country: true,
          ...(actor.role === 'ADMIN' ? { commissionPercent: true } : {}),
        },
      },
      activities: {
        include: { actor: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
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
    lead.assignedManagerId !== null &&
    lead.assignedManagerId !== actor.userId
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have permission to access this lead',
      status: 403,
    };
  }

  const potentialDuplicates = await findPotentialDuplicates({
    email: lead.email,
    phone: lead.phone ?? lead.whatsappNumber,
    excludeLeadId: lead.id,
  });

  return {
    ok: true,
    data: {
      lead: enrichLeadForStaff(lead as unknown as Record<string, unknown>, actor),
      potentialDuplicates,
    },
  };
}

/**
 * Update a Lead (claim unassigned lead, edit qualification/quote, advance status with guardrails, or ADMIN reassign).
 */
export async function updateLeadForActor(
  leadId: string,
  input: unknown,
  actor: LeadActor
): Promise<LeadServiceResult<{ lead: ReturnType<typeof enrichLeadForStaff> }>> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can update leads',
      status: 403,
    };
  }

  const existing = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!existing) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Lead not found',
      status: 404,
    };
  }

  if (
    actor.role === 'MANAGER' &&
    existing.assignedManagerId !== null &&
    existing.assignedManagerId !== actor.userId
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have permission to modify this lead',
      status: 403,
    };
  }

  const isClaimAction =
    Boolean(input) &&
    typeof input === 'object' &&
    (input as Record<string, unknown>).action === 'CLAIM';

  if (isClaimAction) {
    if (
      existing.assignedManagerId !== null &&
      existing.assignedManagerId !== actor.userId &&
      actor.role !== 'ADMIN'
    ) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Lead is already assigned to another coordinator',
        status: 403,
      };
    }

    const claimed = await prisma.lead.update({
      where: { id: leadId },
      data: { assignedManagerId: actor.userId },
      include: {
        assignedManager: { select: { id: true, fullName: true, email: true } },
        referralPartner: {
          select: {
            id: true,
            name: true,
            code: true,
            partnerType: true,
            country: true,
            ...(actor.role === 'ADMIN' ? { commissionPercent: true } : {}),
          },
        },
      },
    });

    if (typeof prisma?.leadActivity?.create === 'function') {
      await prisma.leadActivity.create({
        data: {
          leadId,
          actorId: actor.userId,
          activityType: 'NOTE',
          summary: 'Lead claimed from intake pool',
        },
      });
    }

    await createAuditLog({
      actorId: actor.userId,
      action: AUDIT_ACTIONS.UPDATE_LEAD,
      entityType: 'Lead',
      entityId: leadId,
      oldValue: { assignedManagerId: existing.assignedManagerId },
      newValue: { assignedManagerId: actor.userId },
      ipAddress: actor.ipAddress,
    });

    return {
      ok: true,
      data: {
        lead: enrichLeadForStaff(claimed as unknown as Record<string, unknown>, actor),
      },
    };
  }

  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid lead update payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Enforce coordinator assignment RBAC
  if (
    data.assignedManagerId !== undefined &&
    data.assignedManagerId !== existing.assignedManagerId
  ) {
    if (actor.role === 'MANAGER') {
      const isSelfClaim = existing.assignedManagerId === null && data.assignedManagerId === actor.userId;
      if (!isSelfClaim) {
        return {
          ok: false,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Only administrators can reassign leads to other coordinators',
          status: 403,
        };
      }
    } else if (data.assignedManagerId !== null) {
      const targetMgr = await prisma.user.findUnique({
        where: { id: data.assignedManagerId, role: 'MANAGER', isActive: true },
        select: { id: true, role: true, isActive: true },
      });
      if (!targetMgr || targetMgr.role !== 'MANAGER' || !targetMgr.isActive) {
        return {
          ok: false,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Target coordinator not found or inactive',
          status: 400,
        };
      }
    }
  }

  const nextStatus = data.status ?? existing.status;
  if (data.status !== undefined && data.status !== existing.status) {
    const transition = validateLeadStatusTransition({
      currentStatus: existing.status,
      nextStatus: data.status,
      lostReason: data.lostReason !== undefined ? data.lostReason : existing.lostReason,
      preliminaryQuoteUsd:
        data.preliminaryQuoteUsd !== undefined
          ? data.preliminaryQuoteUsd
          : toNumberOrNull(existing.preliminaryQuoteUsd),
      targetHospitalId:
        data.targetHospitalId !== undefined ? data.targetHospitalId : existing.targetHospitalId,
    });
    if (!transition.allowed) {
      return {
        ok: false,
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: transition.reason,
        status: 400,
      };
    }
  }

  if (typeof data.referralPartnerId === 'string') {
    const partnerCheck = await assertReferralPartnerExists(data.referralPartnerId);
    if (!partnerCheck.ok) {
      return partnerCheck;
    }
  }

  const scoreResult = computeLeadScoreAndTemperature({
    urgencyLevel: data.urgencyLevel ?? existing.urgencyLevel,
    hasDiagnosticReports: data.hasDiagnosticReports ?? existing.hasDiagnosticReports,
    medicalCondition: data.medicalCondition ?? existing.medicalCondition,
    specialtyInterest:
      data.specialtyInterest !== undefined ? data.specialtyInterest : existing.specialtyInterest,
    passportReady: data.passportReady ?? existing.passportReady,
    preferredTravelWindow:
      data.preferredTravelWindow !== undefined
        ? data.preferredTravelWindow
        : existing.preferredTravelWindow,
    estimatedBudgetUsd:
      data.estimatedBudgetUsd !== undefined
        ? data.estimatedBudgetUsd
        : toNumberOrNull(existing.estimatedBudgetUsd),
    source: data.source ?? existing.source,
    email: data.email !== undefined ? data.email : existing.email,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    whatsappNumber:
      data.whatsappNumber !== undefined ? data.whatsappNumber : existing.whatsappNumber,
  });

  const now = new Date();
  const shouldStampFirstResponse =
    existing.status === 'NEW' && nextStatus !== 'NEW' && !existing.firstRespondedAt;

  const updateData: Prisma.LeadUncheckedUpdateInput = {
    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
    ...(data.email !== undefined ? { email: data.email } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.whatsappNumber !== undefined ? { whatsappNumber: data.whatsappNumber } : {}),
    ...(data.nationality !== undefined ? { nationality: data.nationality } : {}),
    ...(data.countryOfResidence !== undefined ? { countryOfResidence: data.countryOfResidence } : {}),
    ...(data.preferredLanguage !== undefined ? { preferredLanguage: data.preferredLanguage } : {}),
    ...(data.medicalCondition !== undefined ? { medicalCondition: data.medicalCondition } : {}),
    ...(data.specialtyInterest !== undefined ? { specialtyInterest: data.specialtyInterest } : {}),
    ...(data.urgencyLevel !== undefined ? { urgencyLevel: data.urgencyLevel } : {}),
    ...(data.hasDiagnosticReports !== undefined
      ? { hasDiagnosticReports: data.hasDiagnosticReports }
      : {}),
    ...(data.passportReady !== undefined ? { passportReady: data.passportReady } : {}),
    ...(data.preferredTravelWindow !== undefined
      ? { preferredTravelWindow: data.preferredTravelWindow }
      : {}),
    ...(data.estimatedBudgetUsd !== undefined ? { estimatedBudgetUsd: data.estimatedBudgetUsd } : {}),
    ...(data.preliminaryQuoteUsd !== undefined
      ? { preliminaryQuoteUsd: data.preliminaryQuoteUsd }
      : {}),
    ...(data.preliminaryQuoteNotes !== undefined
      ? { preliminaryQuoteNotes: data.preliminaryQuoteNotes }
      : {}),
    ...(data.targetHospitalId !== undefined ? { targetHospitalId: data.targetHospitalId } : {}),
    ...(data.targetDoctorId !== undefined ? { targetDoctorId: data.targetDoctorId } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.source !== undefined ? { source: data.source } : {}),
    ...(data.assignedManagerId !== undefined ? { assignedManagerId: data.assignedManagerId } : {}),
    ...(data.referralPartnerId !== undefined ? { referralPartnerId: data.referralPartnerId } : {}),
    ...(data.nextFollowUpAt !== undefined
      ? { nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null }
      : {}),
    ...(data.lostReason !== undefined ? { lostReason: data.lostReason } : {}),
    ...(data.lostNotes !== undefined ? { lostNotes: data.lostNotes } : {}),
    leadScore: scoreResult.score,
    temperature: scoreResult.temperature,
    ...(shouldStampFirstResponse
      ? {
          firstRespondedAt: now,
          lastContactedAt: existing.lastContactedAt ?? now,
        }
      : {}),
  };

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
    include: {
      assignedManager: { select: { id: true, fullName: true, email: true } },
      referralPartner: {
        select: {
          id: true,
          name: true,
          code: true,
          partnerType: true,
          country: true,
          ...(actor.role === 'ADMIN' ? { commissionPercent: true } : {}),
        },
      },
    },
  });

  if (
    data.status !== undefined &&
    data.status !== existing.status &&
    typeof prisma?.leadActivity?.create === 'function'
  ) {
    await prisma.leadActivity.create({
      data: {
        leadId,
        actorId: actor.userId,
        activityType: 'STATUS_CHANGE',
        summary: `Status updated from ${existing.status} to ${data.status}`,
        details: { from: existing.status, to: data.status },
      },
    });
  }

  if (
    data.assignedManagerId &&
    data.assignedManagerId !== existing.assignedManagerId &&
    data.assignedManagerId !== actor.userId &&
    typeof prisma?.notification?.create === 'function'
  ) {
    try {
      await prisma.notification.create({
        data: {
          userId: data.assignedManagerId,
          channel: 'IN_APP',
          title: `Lead Assigned (${existing.referenceNo})`,
          body: `${existing.fullName} has been assigned to your pipeline.`,
          triggerEvent: 'LEAD_ASSIGNED',
        },
      });
    } catch {
      // Non-fatal
    }
  }

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.UPDATE_LEAD,
    entityType: 'Lead',
    entityId: leadId,
    oldValue: { status: existing.status, assignedManagerId: existing.assignedManagerId },
    newValue: { status: updated.status, assignedManagerId: updated.assignedManagerId },
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      lead: enrichLeadForStaff(updated as unknown as Record<string, unknown>, actor),
    },
  };
}

/**
 * Log an omnichannel activity (WhatsApp, Phone Call, Email, Quote Estimate, Note, Follow-up).
 * First outbound touchpoint automatically stamps firstRespondedAt, lastContactedAt, and advances NEW -> CONTACTED.
 */
export async function logLeadActivityForActor(
  leadId: string,
  input: unknown,
  actor: LeadActor
): Promise<LeadServiceResult<{ activity: Record<string, unknown>; lead: Record<string, unknown> }>> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can log lead activities',
      status: 403,
    };
  }

  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Lead not found',
      status: 404,
    };
  }

  if (
    actor.role === 'MANAGER' &&
    existing.assignedManagerId !== null &&
    existing.assignedManagerId !== actor.userId
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have permission to log activities on this lead',
      status: 403,
    };
  }

  const parsed = logLeadActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid activity payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const now = new Date();

  const activity = await prisma.leadActivity.create({
    data: {
      leadId,
      actorId: actor.userId,
      activityType: data.activityType,
      summary: data.summary,
      details: (data.details as Prisma.InputJsonValue | undefined) ?? undefined,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
    },
  });

  const isOutboundTouchpoint =
    OUTBOUND_ACTIVITY_TYPES.has(data.activityType) || data.markResponded === true;
  const leadUpdateData: Prisma.LeadUncheckedUpdateInput = {};

  if (isOutboundTouchpoint) {
    leadUpdateData.lastContactedAt = now;
    if (!existing.firstRespondedAt) {
      leadUpdateData.firstRespondedAt = now;
    }
    if (existing.status === 'NEW') {
      leadUpdateData.status = 'CONTACTED';
    }
  }

  if (data.nextFollowUpAt !== undefined) {
    leadUpdateData.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
  } else if (data.activityType === 'FOLLOW_UP_SCHEDULED' && data.dueAt) {
    leadUpdateData.nextFollowUpAt = new Date(data.dueAt);
  }

  let updatedLead: Record<string, unknown> = existing as unknown as Record<string, unknown>;
  if (Object.keys(leadUpdateData).length > 0) {
    updatedLead = (await prisma.lead.update({
      where: { id: leadId },
      data: leadUpdateData,
    })) as unknown as Record<string, unknown>;
  }

  return {
    ok: true,
    data: {
      activity: activity as unknown as Record<string, unknown>,
      lead: updatedLead,
    },
  };
}

/**
 * Mark a scheduled follow-up LeadActivity completed and recalculate Lead.nextFollowUpAt.
 */
export async function completeLeadFollowUpTask(
  leadId: string,
  activityId: string,
  actor: LeadActor
): Promise<LeadServiceResult<{ activity: Record<string, unknown>; nextFollowUpAt: Date | null }>> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can complete follow-up tasks',
      status: 403,
    };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
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
    lead.assignedManagerId !== null &&
    lead.assignedManagerId !== actor.userId
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have permission to update follow-ups on this lead',
      status: 403,
    };
  }

  const activity = await prisma.leadActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.leadId !== leadId) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Follow-up activity not found',
      status: 404,
    };
  }

  const updatedActivity = await prisma.leadActivity.update({
    where: { id: activityId },
    data: { completedAt: activity.completedAt ?? new Date() },
  });

  const nextPending = await prisma.leadActivity.findFirst({
    where: {
      leadId,
      id: { not: activityId },
      dueAt: { not: null },
      completedAt: null,
    },
    orderBy: { dueAt: 'asc' },
    select: { dueAt: true },
  });

  const nextFollowUpAt = nextPending?.dueAt ?? null;
  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt },
  });

  return {
    ok: true,
    data: {
      activity: updatedActivity as unknown as Record<string, unknown>,
      nextFollowUpAt,
    },
  };
}

/**
 * List B2B Referral Partners.
 * Ruling 2: ADMIN sees commissionPercent; MANAGER receives read-only partner list with commissionPercent stripped.
 */
export async function listReferralPartners(
  actor: LeadActor,
  options?: { activeOnly?: boolean }
): Promise<LeadServiceResult<{ partners: Array<Record<string, unknown>> }>> {
  if (!isStaffActor(actor)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only coordinators and administrators can view referral partners',
      status: 403,
    };
  }

  const partners = await prisma.referralPartner.findMany({
    where: options?.activeOnly ? { isActive: true } : {},
    include: {
      _count: { select: { leads: true, cases: true } },
    },
    orderBy: { name: 'asc' },
  });

  return {
    ok: true,
    data: {
      partners: partners.map((p) =>
        sanitizePartnerForActor(p as unknown as Record<string, unknown>, actor) as Record<
          string,
          unknown
        >
      ),
    },
  };
}

/**
 * Create a B2B Referral Partner (ADMIN only).
 */
export async function createReferralPartner(
  input: unknown,
  actor: LeadActor
): Promise<LeadServiceResult<{ partner: Record<string, unknown> }>> {
  if (actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only administrators can create referral partners',
      status: 403,
    };
  }

  const parsed = referralPartnerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid referral partner payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const existing = await prisma.referralPartner.findUnique({ where: { code: data.code } });
  if (existing) {
    return {
      ok: false,
      code: 'PARTNER_CODE_EXISTS',
      message: `Referral partner code ${data.code} already exists`,
      status: 409,
    };
  }

  const partner = await prisma.referralPartner.create({
    data: {
      name: data.name,
      code: data.code,
      partnerType: data.partnerType,
      country: data.country,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      commissionPercent: data.commissionPercent,
      isActive: data.isActive,
      notes: data.notes ?? null,
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'ReferralPartner',
    entityId: partner.id,
    newValue: { name: partner.name, code: partner.code, partnerType: partner.partnerType },
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      partner: partner as unknown as Record<string, unknown>,
    },
  };
}

/**
 * Update a B2B Referral Partner (ADMIN only).
 */
export async function updateReferralPartner(
  partnerId: string,
  input: unknown,
  actor: LeadActor
): Promise<LeadServiceResult<{ partner: Record<string, unknown> }>> {
  if (actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only administrators can update referral partners',
      status: 403,
    };
  }

  if (!partnerId || typeof partnerId !== 'string') {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Referral partner ID is required',
      status: 400,
    };
  }

  const existing = await prisma.referralPartner.findUnique({ where: { id: partnerId } });
  if (!existing) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Referral partner not found',
      status: 404,
    };
  }

  const parsed = updateReferralPartnerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message || 'Invalid referral partner update payload',
      status: 422,
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  if (data.code && data.code !== existing.code) {
    const codeCollision = await prisma.referralPartner.findUnique({ where: { code: data.code } });
    if (codeCollision) {
      return {
        ok: false,
        code: 'PARTNER_CODE_EXISTS',
        message: `Referral partner code ${data.code} already exists`,
        status: 409,
      };
    }
  }

  const updated = await prisma.referralPartner.update({
    where: { id: partnerId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.partnerType !== undefined ? { partnerType: data.partnerType } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
      ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
      ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
      ...(data.commissionPercent !== undefined ? { commissionPercent: data.commissionPercent } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'ReferralPartner',
    entityId: partnerId,
    oldValue: { code: existing.code, isActive: existing.isActive },
    newValue: { code: updated.code, isActive: updated.isActive },
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      partner: updated as unknown as Record<string, unknown>,
    },
  };
}

/**
 * Generate an OWASP formula-injection-safe CSV export of leads (ADMIN only).
 */
export async function exportLeadsCsvForAdmin(
  query: {
    status?: string;
    source?: string;
    temperature?: string;
    referralPartnerId?: string;
  },
  actor: LeadActor
): Promise<LeadServiceResult<{ csv: string; count: number }>> {
  if (actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Admin access required',
      status: 403,
    };
  }

  const filterCheck = validateLeadEnumFilters(query);
  if (!filterCheck.ok) {
    return filterCheck;
  }

  const where: Prisma.LeadWhereInput = {
    ...(query.status ? { status: query.status as LeadStatus } : {}),
    ...(query.source ? { source: query.source as LeadSource } : {}),
    ...(query.temperature ? { temperature: query.temperature as LeadTemperature } : {}),
    ...(query.referralPartnerId ? { referralPartnerId: query.referralPartnerId } : {}),
  };

  const leads = await prisma.lead.findMany({
    where,
    include: {
      assignedManager: { select: { fullName: true } },
      referralPartner: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const headers = [
    'Reference No',
    'Full Name',
    'Email',
    'Phone',
    'Nationality',
    'Preferred Language',
    'Specialty',
    'Status',
    'Source',
    'Score',
    'Temperature',
    'Preliminary Quote (USD)',
    'Assigned Coordinator',
    'Partner Code',
    'SLA State',
    'Created At',
  ];

  const rows = leads.map((l) => [
    l.referenceNo,
    l.fullName,
    l.email ?? '',
    l.phone ?? l.whatsappNumber ?? '',
    l.nationality,
    l.preferredLanguage ?? '',
    l.specialtyInterest ?? '',
    l.status,
    l.source,
    l.leadScore,
    l.temperature,
    toNumberOrNull(l.preliminaryQuoteUsd) ?? '',
    l.assignedManager?.fullName ?? 'Unassigned',
    l.referralPartner?.code ?? '',
    computeLeadSlaState({
      firstResponseDueAt: l.firstResponseDueAt,
      firstRespondedAt: l.firstRespondedAt,
      status: l.status,
    }),
    l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
  ]);

  const csv = generateCSV(headers, rows);

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.EXPORT_LEADS,
    entityType: 'Lead',
    entityId: 'all',
    newValue: { filters: query, count: leads.length },
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: { csv, count: leads.length },
  };
}
