/**
 * MediRoute India — Zod Validation Schemas
 * Input validation for all API endpoints per PRD Section 6.4.
 */

import { z } from 'zod';

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
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date of birth',
  }),
  primaryLanguage: z.string().optional(),
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
      name: z.string().min(2),
      phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
      relation: z.string().min(2),
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
  patientId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
});

export const updateCaseStatusSchema = z.object({
  status: z.enum([
    'INQUIRY_RECEIVED',
    'UNDER_REVIEW',
    'PLAN_CONFIRMED',
    'IN_TREATMENT',
    'POST_TREATMENT',
    'CLOSED',
  ]),
  notes: z.string().max(5000).optional(),
});

// ─── Appointment Schemas ────────────────────────────────────────────

export const bookAppointmentSchema = z.object({
  caseId: z.string().cuid(),
  patientId: z.string().cuid(),
  hospitalId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentType: z.enum([
    'CONSULTATION',
    'PRE_OP_ASSESSMENT',
    'SURGERY',
    'POST_OP_REVIEW',
  ]),
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
  hospitalId: z.string().cuid(),
  fullName: z.string().min(2).max(200),
  specialisationId: z.string().cuid(),
  qualification: z.string().optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().min(0).optional(),
  availableDays: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .optional(),
});

// ─── Hostel Schemas ─────────────────────────────────────────────────

export const hostelSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  address: z.string().min(5).max(500),
  capacity: z.number().int().min(1),
  pricingPerNight: z.number().min(0),
  roomTypes: z
    .array(z.enum(['SINGLE', 'DOUBLE', 'SUITE', 'DORMITORY']))
    .optional(),
});

// ─── Accommodation Booking Schemas ──────────────────────────────────

export const accommodationBookingSchema = z.object({
  caseId: z.string().cuid(),
  hostelId: z.string().cuid(),
  checkIn: z.string().refine((val) => !isNaN(Date.parse(val))),
  checkOut: z.string().refine((val) => !isNaN(Date.parse(val))),
  roomType: z.enum(['SINGLE', 'DOUBLE', 'SUITE', 'DORMITORY']),
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
  receiverId: z.string().cuid(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});
