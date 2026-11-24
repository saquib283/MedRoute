/**
 * Afzal Healthcare — Zod Validation Schemas
 * Input validation for all API endpoints per PRD Section 6.4.
 */

import { z } from 'zod';
import {
  APPOINTMENT_MODES,
  CASE_STATUS_ORDER,
  DOCUMENT_CATEGORIES,
  FOLLOW_UP_MILESTONES,
  SSR_ASSISTANCE_CODES,
} from '@/lib/constants';

// ─── Auth Schemas ───────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
    .optional(),
  // Patient-specific fields for self-registration
  nationality: z.string().min(2, 'Nationality is required'),
  passportNo: z.string().min(5, 'Passport number is required'),
  passportExpiry: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return undefined;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: 'Invalid passport expiry date',
    }),
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date of birth',
  }),
  primaryLanguage: z.string().optional(),
  medicalCondition: z.string().max(2000).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const otpRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const otpVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const totpVerifySchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
});

// ─── Patient Profile Schemas ────────────────────────────────────────

export const patientProfileSchema = z.object({
  nationality: z.string().min(2).optional(),
  passportNo: z.string().min(5).optional(),
  passportExpiry: z
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
      message: 'Invalid passport expiry date',
    }),
  dob: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date of birth',
    })
    .optional(),
  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .optional(),
  medicalCondition: z.string().max(2000).optional(),
  urgencyLevel: z.enum(['ROUTINE', 'SEMI_URGENT', 'URGENT']).optional(),
  primaryLanguage: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().min(2),
      countryCode: z.string().regex(/^\+\d{1,4}$/).optional(),
      phone: z.string().trim().regex(/^\+?[0-9\s-]{6,16}$/),
      relation: z.string().trim().min(2),
    })
    .optional(),
});

export const medicalProfileSchema = z.object({
  allergies: z.array(z.string()).optional(),
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().optional(),
        frequency: z.string().optional(),
      })
    )
    .optional(),
  surgeries: z
    .array(
      z.object({
        name: z.string(),
        date: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  chronicConditions: z.array(z.string()).optional(),
  specialisationsRequired: z.array(z.string()).optional(),
});

// ─── Case Schemas ───────────────────────────────────────────────────

export const createCaseSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().max(5000).optional(),
});

export const updateCaseStatusSchema = z.object({
  status: z.enum(CASE_STATUS_ORDER),
  notes: z.string().max(5000).optional(),
  overrideReason: z.string().max(2000).nullable().optional(),
});

// ─── Appointment Schemas ────────────────────────────────────────────

export const appointmentModeSchema = z.enum([
  APPOINTMENT_MODES.TELECONSULTATION,
  APPOINTMENT_MODES.IN_PERSON,
]);

export const documentCategorySchema = z.enum(
  Object.values(DOCUMENT_CATEGORIES) as [string, ...string[]]
);

export const ssrAssistanceCodeSchema = z.enum(SSR_ASSISTANCE_CODES);

export const followUpMilestoneCodeSchema = z.enum(FOLLOW_UP_MILESTONES);

export const bookAppointmentSchema = z.object({
  caseId: z.string().min(1),
  patientId: z.string().min(1),
  hospitalId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentType: z.enum([
    'CONSULTATION',
    'PRE_OP_ASSESSMENT',
    'SURGERY',
    'POST_OP_REVIEW',
  ]),
  mode: appointmentModeSchema.optional(),
  meetingUrl: z
    .union([z.string().url('Invalid meeting URL').max(500), z.literal('')])
    .nullable()
    .optional(),
  interpreterLanguage: z.string().max(100).nullable().optional(),
  scheduledAt: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && date > new Date();
  }, 'Scheduled date must be in the future'),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z
    .string()
    .min(10, 'Cancellation reason must be at least 10 characters'),
});

// ─── Booking Request Schema (Patient-side) ──────────────────────────

export const bookingRequestSchema = z.object({
  specialisation: z.string().min(2),
  preferredDateStart: z.string().refine((val) => !isNaN(Date.parse(val))),
  preferredDateEnd: z.string().refine((val) => !isNaN(Date.parse(val))),
  budgetRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
});

// ─── Hospital Schemas ───────────────────────────────────────────────

export const hospitalSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  address: z.string().min(5).max(500),
  accreditation: z.string().optional(),
  contactPerson: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  departments: z.array(z.string()).optional(),
});

// ─── Doctor Schemas ─────────────────────────────────────────────────

export const doctorSchema = z.object({
  hospitalId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  specialisationId: z.string().min(1),
  qualification: z.string().optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().min(0).optional(),
  availableDays: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .optional(),
});


// ─── Pagination Schemas ─────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Message Schemas ────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  receiverId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});
