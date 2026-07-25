/**
 * MediRoute India — Constants & Enum Definitions
 * Single source of truth for all application constants.
 */

// ─── User Roles ──────────────────────────────────────────────────────

export const USER_ROLES = {
  PATIENT: 'PATIENT',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
} as const;

export type UserRoleType = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// ─── Case Statuses ───────────────────────────────────────────────────

export const CASE_STATUSES = {
  INQUIRY_RECEIVED: 'INQUIRY_RECEIVED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PLAN_CONFIRMED: 'PLAN_CONFIRMED',
  IN_TREATMENT: 'IN_TREATMENT',
  POST_TREATMENT: 'POST_TREATMENT',
  CLOSED: 'CLOSED',
} as const;

export const CASE_STATUS_ORDER = [
  CASE_STATUSES.INQUIRY_RECEIVED,
  CASE_STATUSES.UNDER_REVIEW,
  CASE_STATUSES.PLAN_CONFIRMED,
  CASE_STATUSES.IN_TREATMENT,
  CASE_STATUSES.POST_TREATMENT,
  CASE_STATUSES.CLOSED,
] as const;

export const CASE_STATUS_LABELS: Record<string, string> = {
  INQUIRY_RECEIVED: 'Inquiry Received',
  UNDER_REVIEW: 'Under Review',
  PLAN_CONFIRMED: 'Plan Confirmed',
  IN_TREATMENT: 'In Treatment',
  POST_TREATMENT: 'Post-Treatment',
  CLOSED: 'Closed',
};

// ─── Appointment Types ──────────────────────────────────────────────

export const APPOINTMENT_TYPES = {
  CONSULTATION: 'CONSULTATION',
  PRE_OP_ASSESSMENT: 'PRE_OP_ASSESSMENT',
  SURGERY: 'SURGERY',
  POST_OP_REVIEW: 'POST_OP_REVIEW',
} as const;

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PRE_OP_ASSESSMENT: 'Pre-op Assessment',
  SURGERY: 'Surgery',
  POST_OP_REVIEW: 'Post-op Review',
};

// ─── Appointment Statuses ───────────────────────────────────────────

export const APPOINTMENT_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
};

// ─── Document Categories ────────────────────────────────────────────

export const DOCUMENT_CATEGORIES = {
  PASSPORT: 'PASSPORT',
  MEDICAL_REPORT: 'MEDICAL_REPORT',
  INSURANCE: 'INSURANCE',
  VISA: 'VISA',
  PRESCRIPTION: 'PRESCRIPTION',
} as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  PASSPORT: 'Passport',
  MEDICAL_REPORT: 'Medical Report',
  INSURANCE: 'Insurance',
  VISA: 'Visa',
  PRESCRIPTION: 'Prescription',
};

// ─── Urgency Levels ─────────────────────────────────────────────────

export const URGENCY_LEVELS = {
  ROUTINE: 'ROUTINE',
  SEMI_URGENT: 'SEMI_URGENT',
  URGENT: 'URGENT',
} as const;

export const URGENCY_LEVEL_LABELS: Record<string, string> = {
  ROUTINE: 'Routine',
  SEMI_URGENT: 'Semi-Urgent',
  URGENT: 'Urgent',
};

// ─── Notification Triggers ──────────────────────────────────────────

export const NOTIFICATION_TRIGGERS = {
  CASE_CREATED: 'CASE_CREATED',
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  APPOINTMENT_REMINDER_24H: 'APPOINTMENT_REMINDER_24H',
  APPOINTMENT_REMINDER_2H: 'APPOINTMENT_REMINDER_2H',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  CASE_STATUS_CHANGE: 'CASE_STATUS_CHANGE',
  DOCUMENT_REQUIRED: 'DOCUMENT_REQUIRED',
  ESCALATION_RAISED: 'ESCALATION_RAISED',
} as const;

// ─── System Limits ──────────────────────────────────────────────────

export const SYSTEM_LIMITS = {
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB per PRD
  MAX_PATIENTS_PER_MANAGER: 25,
  RATE_LIMIT_GENERAL: 100, // requests per minute
  RATE_LIMIT_AUTH: 20, // requests per minute
  MIN_BCRYPT_ROUNDS: 12,
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY_DAYS: 7,
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 300,
  MIN_TOUCH_TARGET_PX: 44,
} as const;

// ─── Allowed File Types ─────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'] as const;

// ─── Days of Week ───────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
] as const;
