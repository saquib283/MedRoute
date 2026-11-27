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
  DISCHARGE_SUMMARY: 'DISCHARGE_SUMMARY',
  TREATMENT_PLAN: 'TREATMENT_PLAN',
  INVOICE: 'INVOICE',
  VISA_LETTER: 'VISA_LETTER',
} as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  PASSPORT: 'Passport',
  MEDICAL_REPORT: 'Medical Report',
  INSURANCE: 'Insurance',
  VISA: 'Visa',
  PRESCRIPTION: 'Prescription',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  TREATMENT_PLAN: 'Treatment Plan',
  INVOICE: 'Invoice',
  VISA_LETTER: 'Visa Letter',
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

// ─── Treatment Plan Statuses ────────────────────────────────────────

export const TREATMENT_PLAN_STATUSES = {
  DRAFT: 'DRAFT',
  SENT_TO_PATIENT: 'SENT_TO_PATIENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  REVISED: 'REVISED',
} as const;

export const TREATMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT_TO_PATIENT: 'Sent to Patient',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  REVISED: 'Revised',
};

export const TREATMENT_PLAN_ITEM_TYPES = {
  PROCEDURE: 'PROCEDURE',
  CONSULTATION: 'CONSULTATION',
  TEST: 'TEST',
  MEDICATION: 'MEDICATION',
  ROOM_CHARGE: 'ROOM_CHARGE',
  OTHER: 'OTHER',
} as const;

export const TREATMENT_PLAN_ITEM_TYPE_LABELS: Record<string, string> = {
  PROCEDURE: 'Procedure',
  CONSULTATION: 'Consultation',
  TEST: 'Test / Diagnostic',
  MEDICATION: 'Medication',
  ROOM_CHARGE: 'Room Charge',
  OTHER: 'Other',
};

// ─── Invoice Statuses & Types ───────────────────────────────────────

export const INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export const INVOICE_TYPES = {
  TREATMENT: 'TREATMENT',
  ACCOMMODATION: 'ACCOMMODATION',
  LOGISTICS: 'LOGISTICS',
  FACILITATION_FEE: 'FACILITATION_FEE',
} as const;

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  TREATMENT: 'Treatment',
  ACCOMMODATION: 'Accommodation',
  LOGISTICS: 'Logistics & Transport',
  FACILITATION_FEE: 'Facilitation Fee',
};

// ─── Payment Methods ────────────────────────────────────────────────

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  UPI: 'UPI',
  INTERNATIONAL_WIRE: 'INTERNATIONAL_WIRE',
} as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer (NEFT/RTGS)',
  CARD: 'Credit / Debit Card',
  UPI: 'UPI',
  INTERNATIONAL_WIRE: 'International Wire Transfer',
};

// ─── Transfer Types & Statuses ──────────────────────────────────────

export const TRANSFER_TYPES = {
  AIRPORT_PICKUP: 'AIRPORT_PICKUP',
  AIRPORT_DROP: 'AIRPORT_DROP',
  HOSPITAL_TRANSFER: 'HOSPITAL_TRANSFER',
  HOTEL_TRANSFER: 'HOTEL_TRANSFER',
} as const;

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  AIRPORT_PICKUP: 'Airport Pickup',
  AIRPORT_DROP: 'Airport Drop',
  HOSPITAL_TRANSFER: 'Hospital Transfer',
  HOTEL_TRANSFER: 'Hotel Transfer',
};

export const TRANSFER_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const VEHICLE_TYPES = ['SEDAN', 'SUV', 'AMBULANCE', 'VAN', 'MINIBUS'] as const;

// ─── Visa Letter Statuses ───────────────────────────────────────────

export const VISA_LETTER_STATUSES = {
  REQUESTED: 'REQUESTED',
  GENERATED: 'GENERATED',
  SENT: 'SENT',
  EXPIRED: 'EXPIRED',
} as const;

export const VISA_LETTER_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  GENERATED: 'Generated',
  SENT: 'Sent to Patient',
  EXPIRED: 'Expired',
};

// ─── Follow-Up Types & Statuses ─────────────────────────────────────

export const FOLLOW_UP_TYPES = {
  IN_PERSON: 'IN_PERSON',
  VIDEO_CALL: 'VIDEO_CALL',
  PHONE_CALL: 'PHONE_CALL',
} as const;

export const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  IN_PERSON: 'In-Person Visit',
  VIDEO_CALL: 'Video Consultation',
  PHONE_CALL: 'Phone Call',
};

export const FOLLOW_UP_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
} as const;

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
};

// ─── Discharge Condition ────────────────────────────────────────────

export const DISCHARGE_CONDITIONS = ['STABLE', 'IMPROVED', 'CRITICAL', 'UNCHANGED'] as const;

export const DISCHARGE_CONDITION_LABELS: Record<string, string> = {
  STABLE: 'Stable',
  IMPROVED: 'Improved',
  CRITICAL: 'Critical',
  UNCHANGED: 'Unchanged',
};

// ─── Accommodation Partner Types ────────────────────────────────────

export const PARTNER_TYPES = {
  HOTEL: 'HOTEL',
  HOSTEL: 'HOSTEL',
  GUEST_HOUSE: 'GUEST_HOUSE',
  SERVICED_APARTMENT: 'SERVICED_APARTMENT',
} as const;

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  HOTEL: 'Hotel',
  HOSTEL: 'Hostel',
  GUEST_HOUSE: 'Guest House',
  SERVICED_APARTMENT: 'Serviced Apartment',
};

// ─── Currency Formatting ────────────────────────────────────────────

export function formatCurrency(amount: number | string, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// ─── Invoice Number Generator ───────────────────────────────────────

export function generateInvoiceNumber(prefix: string, sequenceNum: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceNum).padStart(5, '0');
  return `${prefix}-${year}-${padded}`;
}
