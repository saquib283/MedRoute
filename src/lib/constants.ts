/**
 * Afzal Healthcare — Constants & Enum Definitions
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
  PRE_OP_CLEARANCE: 'PRE_OP_CLEARANCE',
  PLAN_CONFIRMED: 'PLAN_CONFIRMED',
  IN_TREATMENT: 'IN_TREATMENT',
  ICU_RECOVERY: 'ICU_RECOVERY',
  WARD_RECOVERY: 'WARD_RECOVERY',
  POST_TREATMENT: 'POST_TREATMENT',
  OUTPATIENT_RECUPERATION: 'OUTPATIENT_RECUPERATION',
  FIT_TO_FLY_CLEARED: 'FIT_TO_FLY_CLEARED',
  REMOTE_REHAB: 'REMOTE_REHAB',
  CLOSED: 'CLOSED',
} as const;

export const CASE_STATUS_ORDER = [
  CASE_STATUSES.INQUIRY_RECEIVED,
  CASE_STATUSES.UNDER_REVIEW,
  CASE_STATUSES.PRE_OP_CLEARANCE,
  CASE_STATUSES.PLAN_CONFIRMED,
  CASE_STATUSES.IN_TREATMENT,
  CASE_STATUSES.ICU_RECOVERY,
  CASE_STATUSES.WARD_RECOVERY,
  CASE_STATUSES.POST_TREATMENT,
  CASE_STATUSES.OUTPATIENT_RECUPERATION,
  CASE_STATUSES.FIT_TO_FLY_CLEARED,
  CASE_STATUSES.REMOTE_REHAB,
  CASE_STATUSES.CLOSED,
] as const;

export const CASE_STATUS_LABELS: Record<string, string> = {
  INQUIRY_RECEIVED: 'Inquiry Received',
  UNDER_REVIEW: 'Under Review',
  PRE_OP_CLEARANCE: 'Pre-Op Clearance',
  PLAN_CONFIRMED: 'Plan Confirmed',
  IN_TREATMENT: 'In Treatment',
  ICU_RECOVERY: 'ICU / CCU Recovery',
  WARD_RECOVERY: 'Ward Recovery',
  POST_TREATMENT: 'Post-Treatment',
  OUTPATIENT_RECUPERATION: 'Outpatient Recuperation',
  FIT_TO_FLY_CLEARED: 'Fit-to-Fly Cleared',
  REMOTE_REHAB: 'Remote Tele-Rehab',
  CLOSED: 'Closed',
};

export const CASE_PHASE_GROUPS = [
  { key: 'INQUIRY', label: 'Inquiry & Triage', desc: 'Medical inquiry & coordinator assessment', statuses: ['INQUIRY_RECEIVED', 'UNDER_REVIEW'] },
  { key: 'PRE_OP', label: 'Pre-Op & Plan', desc: 'MDT clearance & confirmed treatment plan', statuses: ['PRE_OP_CLEARANCE', 'PLAN_CONFIRMED'] },
  { key: 'TREATMENT', label: 'In Treatment', desc: 'Active surgical or clinical intervention', statuses: ['IN_TREATMENT'] },
  { key: 'RECOVERY', label: 'Hospital Recovery', desc: 'ICU, inpatient ward & post-op monitoring', statuses: ['ICU_RECOVERY', 'WARD_RECOVERY', 'POST_TREATMENT'] },
  { key: 'DISCHARGE', label: 'Discharge & Rehab', desc: 'Outpatient care, Fit-to-Fly & tele-rehab', statuses: ['OUTPATIENT_RECUPERATION', 'FIT_TO_FLY_CLEARED', 'REMOTE_REHAB'] },
  { key: 'CLOSED', label: 'Closed', desc: 'Medical journey concluded', statuses: ['CLOSED'] },
] as const;

export function getCasePhaseIndex(status: string): number {
  const idx = CASE_PHASE_GROUPS.findIndex((g) => (g.statuses as readonly string[]).includes(status));
  return idx >= 0 ? idx : 0;
}

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

// ─── Appointment Modes ──────────────────────────────────────────────

export const APPOINTMENT_MODES = {
  TELECONSULTATION: 'TELECONSULTATION',
  IN_PERSON: 'IN_PERSON',
} as const;

export type AppointmentModeType = (typeof APPOINTMENT_MODES)[keyof typeof APPOINTMENT_MODES];

export const APPOINTMENT_MODE_LABELS: Record<string, string> = {
  TELECONSULTATION: 'Video Teleconsultation',
  IN_PERSON: 'In-Person Hospital Visit',
};

// ─── Airline SSR Assistance & Post-Return Follow-Ups ────────────────

export const SSR_ASSISTANCE_CODES = [
  'NONE',
  'WCHR',
  'WCHS',
  'WCHC',
  'MEDA',
] as const;

export type SsrAssistanceCode = (typeof SSR_ASSISTANCE_CODES)[number];

export const SSR_ASSISTANCE_LABELS: Record<SsrAssistanceCode, string> = {
  NONE: 'No Special Airport Assistance',
  WCHR: 'WCHR — Wheelchair (Ramp / Long Distance)',
  WCHS: 'WCHS — Wheelchair (Steps / Cannot Climb Stairs)',
  WCHC: 'WCHC — Wheelchair (Cabin Seat / Immobile)',
  MEDA: 'MEDA — Medical Clearance / Oxygen Support',
};

export const FOLLOW_UP_MILESTONES = [
  'DAY_7',
  'DAY_30',
  'DAY_90',
] as const;

export type FollowUpMilestoneCode = (typeof FOLLOW_UP_MILESTONES)[number];

export const FOLLOW_UP_MILESTONE_LABELS: Record<FollowUpMilestoneCode, string> = {
  DAY_7: 'Day 7 Post-Return Check-In',
  DAY_30: 'Day 30 Recovery Review',
  DAY_90: 'Day 90 Long-Term Outcome Check-In',
};

// ─── Document Categories ────────────────────────────────────────────

export const DOCUMENT_CATEGORIES = {
  PASSPORT: 'PASSPORT',
  VISA: 'VISA',
  VISA_INVITATION_LETTER: 'VISA_INVITATION_LETTER',
  PROFORMA_INVOICE: 'PROFORMA_INVOICE',
  MEDICAL_OPINION: 'MEDICAL_OPINION',
  MEDICAL_REPORT: 'MEDICAL_REPORT',
  PRESCRIPTION: 'PRESCRIPTION',
  FIT_TO_FLY_CERTIFICATE: 'FIT_TO_FLY_CERTIFICATE',
  FRRO_REGISTRATION: 'FRRO_REGISTRATION',
  INSURANCE: 'INSURANCE',
  DISCHARGE_SUMMARY: 'DISCHARGE_SUMMARY',
} as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  PASSPORT: 'Passport',
  VISA: 'Travel Visa',
  VISA_INVITATION_LETTER: 'Visa Invitation Letter (VIL)',
  PROFORMA_INVOICE: 'Pro-Forma Cost Estimate',
  MEDICAL_OPINION: 'Hospital Medical Opinion',
  MEDICAL_REPORT: 'Medical Diagnostic Report',
  PRESCRIPTION: 'Prescription',
  FIT_TO_FLY_CERTIFICATE: 'Fit-to-Fly Certificate',
  FRRO_REGISTRATION: 'FRRO Registration',
  INSURANCE: 'Medical Insurance',
  DISCHARGE_SUMMARY: 'Hospital Discharge Summary',
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

// ─── Leads CRM & B2B Referral Partners ──────────────────────────────

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'New Inquiry',
  CONTACTED: 'Contacted',
  MEDICAL_RECORDS_REQUESTED: 'Records Requested',
  CLINICAL_REVIEW: 'Clinical Review',
  QUOTE_SHARED: 'Quote Shared',
  NURTURING: 'Nurturing',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  LOST: 'Lost',
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WEBSITE_INQUIRY: 'Website Inquiry',
  WHATSAPP: 'WhatsApp',
  PHONE_CALL: 'Phone Call',
  B2B_PARTNER: 'B2B Partner',
  DOCTOR_REFERRAL: 'Doctor Referral',
  EMBASSY_SPONSOR: 'Embassy / Ministry',
  META_GOOGLE_ADS: 'Meta / Google Ads',
  EMAIL_CAMPAIGN: 'Email Campaign',
  WALK_IN: 'Walk-In',
};

export const LEAD_LOST_REASON_LABELS: Record<string, string> = {
  PRICE_TOO_HIGH: 'Treatment / Travel Cost Too High',
  CHOSE_COMPETITOR: 'Chose Another Hospital / Country',
  VISA_DENIED_OR_PASSPORT: 'Visa Denied or Passport Unavailable',
  MEDICAL_UNFIT: 'Medically Unfit for Travel / Surgery',
  NO_RESPONSE: 'Unresponsive After Follow-Ups',
  DUPLICATE: 'Duplicate Inquiry',
  TIMELINE_POSTPONED: 'Treatment Postponed Indefinitely',
  OTHER: 'Other',
};

export const MVT_SPECIALTY_OPTIONS = [
  { value: 'CARDIOLOGY', label: 'Cardiology & Cardiac Surgery' },
  { value: 'ONCOLOGY', label: 'Oncology & Surgical Oncology' },
  { value: 'ORTHOPEDICS', label: 'Orthopedics & Joint Replacement' },
  { value: 'NEUROSURGERY', label: 'Neurosurgery & Spine' },
  { value: 'TRANSPLANT', label: 'Organ & Bone Marrow Transplant' },
  { value: 'IVF', label: 'IVF & Reproductive Medicine' },
  { value: 'GENERAL', label: 'General Surgery & Multi-Specialty' },
] as const;

export const COMMON_LANGUAGES = [
  'English',
  'Arabic',
  'French',
  'Hindi',
  'Urdu',
  'Bengali',
  'Swahili',
  'Russian',
  'Somali',
  'Amharic',
  'Portuguese',
  'Spanish',
] as const;
