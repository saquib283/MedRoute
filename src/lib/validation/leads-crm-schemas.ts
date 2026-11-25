/**
 * Afzal Healthcare — Client-Safe Advanced Leads CRM Schemas, Scoring & SLA Engine
 * IMPORTANT: Zero Prisma / Node-only imports so `'use client'` components can safely import from this module.
 */

import { z } from 'zod';

// ─── Domain Constants & Literal Unions ──────────────────────────────

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'MEDICAL_RECORDS_REQUESTED',
  'CLINICAL_REVIEW',
  'QUOTE_SHARED',
  'NURTURING',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  'WEBSITE_INQUIRY',
  'WHATSAPP',
  'PHONE_CALL',
  'B2B_PARTNER',
  'DOCTOR_REFERRAL',
  'EMBASSY_SPONSOR',
  'META_GOOGLE_ADS',
  'EMAIL_CAMPAIGN',
  'WALK_IN',
] as const;

export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

export const LEAD_TEMPERATURES = ['HOT', 'WARM', 'COLD'] as const;

export type LeadTemperatureValue = (typeof LEAD_TEMPERATURES)[number];

export const LEAD_ACTIVITY_TYPES = [
  'NOTE',
  'WHATSAPP',
  'PHONE_CALL',
  'EMAIL',
  'QUOTE_ESTIMATE',
  'STATUS_CHANGE',
  'FOLLOW_UP_SCHEDULED',
  'CONVERSION',
] as const;

export type LeadActivityTypeValue = (typeof LEAD_ACTIVITY_TYPES)[number];

export const LEAD_LOST_REASONS = [
  'PRICE_TOO_HIGH',
  'CHOSE_COMPETITOR',
  'VISA_DENIED_OR_PASSPORT',
  'MEDICAL_UNFIT',
  'NO_RESPONSE',
  'DUPLICATE',
  'TIMELINE_POSTPONED',
  'OTHER',
] as const;

export type LeadLostReasonValue = (typeof LEAD_LOST_REASONS)[number];

export const REFERRAL_PARTNER_TYPES = [
  'FACILITATOR_AGENCY',
  'REFERRING_PHYSICIAN',
  'EMBASSY_MINISTRY',
  'CORPORATE_INSURER',
] as const;

export type ReferralPartnerTypeValue = (typeof REFERRAL_PARTNER_TYPES)[number];

export const PREFERRED_TRAVEL_WINDOWS = [
  'IMMEDIATE_7D',
  'WITHIN_30D',
  'WITHIN_90D',
  'EXPLORING',
] as const;

export type PreferredTravelWindowValue = (typeof PREFERRED_TRAVEL_WINDOWS)[number];

export const LEAD_URGENCY_LEVELS = ['ROUTINE', 'SEMI_URGENT', 'URGENT'] as const;

export type LeadUrgencyLevelValue = (typeof LEAD_URGENCY_LEVELS)[number];

// ─── Shared Zod Helpers ─────────────────────────────────────────────

const PHONE_REGEX = /^\+?[0-9\s\-()]{6,20}$/;

function optionalTrimmedString(maxLen: number) {
  return z
    .string()
    .max(maxLen)
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    });
}

const optionalEmailSchema = z
  .string()
  .max(191)
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((val) => !val || z.string().email().safeParse(val).success, {
    message: 'Invalid email address',
  });

const optionalPhoneSchema = z
  .string()
  .max(32)
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((val) => !val || PHONE_REGEX.test(val), {
    message: 'Invalid phone number format',
  });

function optionalParseableDateString(fieldLabel: string) {
  return z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: `Invalid ${fieldLabel}`,
    });
}

const optionalTravelWindowSchema = z
  .union([z.enum(PREFERRED_TRAVEL_WINDOWS), z.literal('')])
  .nullable()
  .optional()
  .transform((val) => (val === '' ? null : val));

const optionalPositiveOrZeroNumberSchema = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return parsed;
    }
    return val;
  })
  .refine((val) => val === undefined || val === null || (!Number.isNaN(val) && val >= 0 && val <= 10_000_000), {
    message: 'Amount must be a valid non-negative number',
  });

// ─── Validation Schemas ─────────────────────────────────────────────

export const publicInquirySchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(120, 'Full name must be at most 120 characters'),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    whatsappNumber: optionalPhoneSchema,
    nationality: z.string().trim().min(2, 'Nationality is required').max(100),
    countryOfResidence: optionalTrimmedString(100),
    preferredLanguage: optionalTrimmedString(60),
    medicalCondition: z
      .string()
      .trim()
      .min(5, 'Please briefly describe the medical condition')
      .max(4000, 'Medical condition summary is too long'),
    specialtyInterest: optionalTrimmedString(80),
    urgencyLevel: z.enum(LEAD_URGENCY_LEVELS).optional().default('ROUTINE'),
    hasDiagnosticReports: z.boolean().optional().default(false),
    passportReady: z.boolean().optional().default(false),
    preferredTravelWindow: optionalTravelWindowSchema,
    estimatedBudgetUsd: optionalPositiveOrZeroNumberSchema,
    referralCode: optionalTrimmedString(64),
    utmSource: optionalTrimmedString(120),
    utmMedium: optionalTrimmedString(120),
    utmCampaign: optionalTrimmedString(120),
    websiteUrl: z.string().max(200).optional(), // Silent honeypot field
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone && !data.whatsappNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide at least a phone number, WhatsApp number, or email address',
        path: ['phone'],
      });
    }
  });

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const createLeadSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(120, 'Full name must be at most 120 characters'),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    whatsappNumber: optionalPhoneSchema,
    nationality: z.string().trim().min(2, 'Nationality is required').max(100),
    countryOfResidence: optionalTrimmedString(100),
    preferredLanguage: optionalTrimmedString(60),
    medicalCondition: z
      .string()
      .trim()
      .min(3, 'Medical condition description is required')
      .max(4000),
    specialtyInterest: optionalTrimmedString(80),
    urgencyLevel: z.enum(LEAD_URGENCY_LEVELS).optional().default('ROUTINE'),
    hasDiagnosticReports: z.boolean().optional().default(false),
    passportReady: z.boolean().optional().default(false),
    preferredTravelWindow: optionalTravelWindowSchema,
    estimatedBudgetUsd: optionalPositiveOrZeroNumberSchema,
    preliminaryQuoteUsd: optionalPositiveOrZeroNumberSchema,
    preliminaryQuoteNotes: optionalTrimmedString(2000),
    targetHospitalId: optionalTrimmedString(191),
    targetDoctorId: optionalTrimmedString(191),
    source: z.enum(LEAD_SOURCES).optional().default('PHONE_CALL'),
    assignedManagerId: optionalTrimmedString(191),
    referralPartnerId: optionalTrimmedString(191),
    utmSource: optionalTrimmedString(120),
    utmMedium: optionalTrimmedString(120),
    utmCampaign: optionalTrimmedString(120),
    nextFollowUpAt: optionalParseableDateString('next follow-up date'),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone && !data.whatsappNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide at least a phone number, WhatsApp number, or email address',
        path: ['phone'],
      });
    }
  });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  whatsappNumber: optionalPhoneSchema,
  nationality: z.string().trim().min(2).max(100).optional(),
  countryOfResidence: optionalTrimmedString(100),
  preferredLanguage: optionalTrimmedString(60),
  medicalCondition: z.string().trim().min(3).max(4000).optional(),
  specialtyInterest: optionalTrimmedString(80),
  urgencyLevel: z.enum(LEAD_URGENCY_LEVELS).optional(),
  hasDiagnosticReports: z.boolean().optional(),
  passportReady: z.boolean().optional(),
  preferredTravelWindow: optionalTravelWindowSchema,
  estimatedBudgetUsd: optionalPositiveOrZeroNumberSchema,
  preliminaryQuoteUsd: optionalPositiveOrZeroNumberSchema,
  preliminaryQuoteNotes: optionalTrimmedString(2000),
  targetHospitalId: optionalTrimmedString(191),
  targetDoctorId: optionalTrimmedString(191),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedManagerId: optionalTrimmedString(191),
  referralPartnerId: optionalTrimmedString(191),
  nextFollowUpAt: optionalParseableDateString('next follow-up date'),
  lostReason: z
    .union([z.enum(LEAD_LOST_REASONS), z.literal('')])
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
  lostNotes: optionalTrimmedString(2000),
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const logLeadActivitySchema = z.object({
  activityType: z.enum(LEAD_ACTIVITY_TYPES),
  summary: z.string().trim().min(2, 'Activity summary is required').max(191),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
  dueAt: optionalParseableDateString('due date'),
  completedAt: optionalParseableDateString('completed timestamp'),
  markResponded: z.boolean().optional(),
  nextFollowUpAt: optionalParseableDateString('next follow-up date'),
});

export type LogLeadActivityInput = z.infer<typeof logLeadActivitySchema>;

const newPatientConversionSchema = z.object({
  mode: z.literal('NEW_PATIENT'),
  email: z.string().trim().email('Valid email address is required for patient portal account'),
  passportNo: z.string().trim().min(5, 'Passport number must be at least 5 characters').max(64),
  dob: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'Valid date of birth is required',
  }),
  passportExpiry: optionalParseableDateString('passport expiry date'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
    .optional(),
  phone: optionalPhoneSchema,
  bloodGroup: z
    .union([z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']), z.literal('')])
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
  hospitalId: optionalTrimmedString(191),
  primaryDoctorId: optionalTrimmedString(191),
  specialtyId: optionalTrimmedString(191),
  notes: optionalTrimmedString(4000),
});

const existingPatientConversionSchema = z.object({
  mode: z.literal('EXISTING_PATIENT'),
  existingPatientId: z.string().trim().min(1, 'Existing patient ID is required'),
  hospitalId: optionalTrimmedString(191),
  primaryDoctorId: optionalTrimmedString(191),
  specialtyId: optionalTrimmedString(191),
  notes: optionalTrimmedString(4000),
});

export const convertLeadSchema = z.discriminatedUnion('mode', [
  newPatientConversionSchema,
  existingPatientConversionSchema,
]);

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export const referralPartnerSchema = z.object({
  name: z.string().trim().min(2, 'Partner name is required').max(160),
  code: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .pipe(
      z
        .string()
        .min(3, 'Partner code must be at least 3 characters')
        .max(40, 'Partner code must be at most 40 characters')
        .regex(/^[A-Z0-9_-]+$/, 'Code must contain only A-Z, 0-9, hyphens, or underscores')
    ),
  partnerType: z.enum(REFERRAL_PARTNER_TYPES),
  country: z.string().trim().min(2, 'Country is required').max(100),
  contactName: optionalTrimmedString(120),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalPhoneSchema,
  commissionPercent: z.coerce.number().min(0).max(50).optional().default(10),
  isActive: z.boolean().optional().default(true),
  notes: optionalTrimmedString(2000),
});

export type ReferralPartnerInput = z.infer<typeof referralPartnerSchema>;

// ─── Pure Deterministic Scoring, SLA & Guardrail Engine ─────────────

export interface LeadScoringInput {
  urgencyLevel?: LeadUrgencyLevelValue | string | null;
  hasDiagnosticReports?: boolean | null;
  medicalCondition?: string | null;
  specialtyInterest?: string | null;
  passportReady?: boolean | null;
  preferredTravelWindow?: PreferredTravelWindowValue | string | null;
  estimatedBudgetUsd?: number | null;
  source?: LeadSourceValue | string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
}

export interface LeadScoreResult {
  score: number;
  temperature: LeadTemperatureValue;
  breakdown: string[];
}

const HIGH_INTENT_SOURCES = new Set<string>(['B2B_PARTNER', 'DOCTOR_REFERRAL', 'EMBASSY_SPONSOR']);
const DIRECT_SOURCES = new Set<string>(['WHATSAPP', 'WEBSITE_INQUIRY', 'PHONE_CALL']);

export function computeLeadScoreAndTemperature(input: LeadScoringInput): LeadScoreResult {
  let score = 0;
  const breakdown: string[] = [];

  if (input.urgencyLevel === 'URGENT') {
    score += 25;
    breakdown.push('Urgent clinical timeline (+25)');
  } else if (input.urgencyLevel === 'SEMI_URGENT') {
    score += 15;
    breakdown.push('Semi-urgent clinical timeline (+15)');
  } else if (input.urgencyLevel === 'ROUTINE') {
    score += 5;
    breakdown.push('Routine clinical timeline (+5)');
  }

  if (input.hasDiagnosticReports === true) {
    score += 20;
    breakdown.push('Diagnostic reports ready (+20)');
  }

  if (typeof input.medicalCondition === 'string' && input.medicalCondition.trim().length >= 30) {
    score += 12;
    breakdown.push('Detailed clinical description (+12)');
  }

  if (typeof input.specialtyInterest === 'string' && input.specialtyInterest.trim().length > 0) {
    score += 8;
    breakdown.push('Target specialty specified (+8)');
  }

  if (input.passportReady === true) {
    score += 12;
    breakdown.push('Valid passport ready (+12)');
  }

  if (input.preferredTravelWindow === 'IMMEDIATE_7D') {
    score += 10;
    breakdown.push('Immediate 7-day travel window (+10)');
  } else if (input.preferredTravelWindow === 'WITHIN_30D') {
    score += 8;
    breakdown.push('Travel within 30 days (+8)');
  } else if (input.preferredTravelWindow === 'WITHIN_90D') {
    score += 4;
    breakdown.push('Travel within 90 days (+4)');
  }

  if (typeof input.estimatedBudgetUsd === 'number' && input.estimatedBudgetUsd > 0) {
    score += 8;
    breakdown.push('Treatment budget declared (+8)');
  }

  if (input.source && HIGH_INTENT_SOURCES.has(input.source)) {
    score += 10;
    breakdown.push('Verified partner / physician / embassy channel (+10)');
  } else if (input.source && DIRECT_SOURCES.has(input.source)) {
    score += 5;
    breakdown.push('Direct patient inquiry channel (+5)');
  }

  const hasEmail = typeof input.email === 'string' && input.email.trim().length > 0;
  const hasPhoneOrWa =
    (typeof input.phone === 'string' && input.phone.trim().length > 0) ||
    (typeof input.whatsappNumber === 'string' && input.whatsappNumber.trim().length > 0);
  if (hasEmail && hasPhoneOrWa) {
    score += 5;
    breakdown.push('Multi-channel contactability (email + phone/WhatsApp) (+5)');
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const temperature: LeadTemperatureValue =
    clampedScore >= 70 ? 'HOT' : clampedScore >= 40 ? 'WARM' : 'COLD';

  return {
    score: clampedScore,
    temperature,
    breakdown,
  };
}

export function getLeadSlaMinutes(
  urgencyLevel: LeadUrgencyLevelValue,
  temperature: LeadTemperatureValue
): number {
  if (urgencyLevel === 'URGENT') return 15;
  if (urgencyLevel === 'SEMI_URGENT' || temperature === 'HOT') return 60;
  return 240;
}

export function computeLeadFirstResponseDueAt(
  urgencyLevel: LeadUrgencyLevelValue,
  temperature: LeadTemperatureValue,
  createdAt: Date = new Date()
): Date {
  const minutes = getLeadSlaMinutes(urgencyLevel, temperature);
  return new Date(createdAt.getTime() + minutes * 60 * 1000);
}

export type LeadSlaState =
  | 'RESPONDED_ON_TIME'
  | 'RESPONDED_LATE'
  | 'DUE_SOON'
  | 'ACTIVE_WINDOW'
  | 'BREACHED';

export function computeLeadSlaState(params: {
  firstResponseDueAt: Date | string;
  firstRespondedAt?: Date | string | null;
  status: string;
  now?: Date;
}): LeadSlaState {
  const dueMs = new Date(params.firstResponseDueAt).getTime();

  if (params.firstRespondedAt) {
    const respondedMs = new Date(params.firstRespondedAt).getTime();
    return respondedMs <= dueMs ? 'RESPONDED_ON_TIME' : 'RESPONDED_LATE';
  }

  const nowMs = (params.now ?? new Date()).getTime();
  if (nowMs > dueMs) {
    return 'BREACHED';
  }

  const remainingMs = dueMs - nowMs;
  if (remainingMs <= 15 * 60 * 1000) {
    return 'DUE_SOON';
  }

  return 'ACTIVE_WINDOW';
}

export function validateLeadStatusTransition(params: {
  currentStatus: string;
  nextStatus: string;
  lostReason?: string | null;
  preliminaryQuoteUsd?: number | null;
  targetHospitalId?: string | null;
  viaConversionService?: boolean;
}): { allowed: true } | { allowed: false; reason: string } {
  const {
    currentStatus,
    nextStatus,
    lostReason,
    preliminaryQuoteUsd,
    targetHospitalId,
    viaConversionService,
  } = params;

  if (currentStatus === 'CONVERTED' && nextStatus !== 'CONVERTED') {
    return {
      allowed: false,
      reason: 'Converted leads cannot be moved back into the pre-conversion pipeline.',
    };
  }

  if (nextStatus === 'CONVERTED' && currentStatus !== 'CONVERTED' && !viaConversionService) {
    return {
      allowed: false,
      reason: 'Leads can only transition to CONVERTED through the Patient & Case conversion workflow.',
    };
  }

  if (nextStatus === 'LOST') {
    const isValidLostReason =
      typeof lostReason === 'string' &&
      (LEAD_LOST_REASONS as readonly string[]).includes(lostReason);
    if (!isValidLostReason) {
      return {
        allowed: false,
        reason: 'A valid lostReason is required when marking a lead as LOST.',
      };
    }
  }

  if (nextStatus === 'QUOTE_SHARED') {
    const hasQuote = typeof preliminaryQuoteUsd === 'number' && preliminaryQuoteUsd > 0;
    const hasHospital = typeof targetHospitalId === 'string' && targetHospitalId.trim().length > 0;
    if (!hasQuote && !hasHospital) {
      return {
        allowed: false,
        reason: 'Provide a preliminary quote estimate (USD) or target hospital before marking QUOTE_SHARED.',
      };
    }
  }

  return { allowed: true };
}

export function buildWhatsAppFollowUpUrl(params: {
  phone?: string | null;
  fullName: string;
  referenceNo: string;
  coordinatorName?: string;
  specialty?: string | null;
}): string | null {
  const digits = (params.phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) {
    return null;
  }

  const coordinator = params.coordinatorName?.trim() || 'your International Patient Coordinator';
  const specialtyClause = params.specialty?.trim()
    ? ` regarding your ${params.specialty.trim()} inquiry`
    : '';
  const text = `Hello ${params.fullName.trim()}, this is ${coordinator} from Afzal Healthcare${specialtyClause}. Your inquiry reference is ${params.referenceNo}. Please share any recent medical reports or questions so we can prepare your specialist evaluation.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
