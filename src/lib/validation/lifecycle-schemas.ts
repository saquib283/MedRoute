/**
 * Afzal Healthcare — Client-Safe MVT Lifecycle Schemas, Pathway Templates & Stage-Gate Helpers
 * IMPORTANT: Zero Prisma / Node-only imports so `'use client'` components can safely import from this module.
 */

import { z } from 'zod';
import {
  CASE_STATUS_ORDER,
  DOCUMENT_CATEGORY_LABELS,
  FOLLOW_UP_MILESTONES,
  FOLLOW_UP_MILESTONE_LABELS,
  SSR_ASSISTANCE_CODES,
} from '@/lib/constants';

// ─── Structured Lifecycle Types & Zod Schemas ───────────────────────

export const medicalAttendantSchema = z.object({
  fullName: z.string().trim().min(2, 'Attendant full passport name is required').max(150),
  passportNo: z.string().trim().min(4, 'Attendant passport number is required').max(120),
  relation: z.string().trim().min(2, 'Relationship to patient is required').max(80),
});

export type MedicalAttendantRecord = z.infer<typeof medicalAttendantSchema>;

export interface TreatmentPlanPayload {
  diagnosis: string;
  procedureName: string;
  specialty?: string | null;
  hospitalLosDays: number;
  recoveryStayDays: number;
  estimatedCostUsd: number;
  depositRequiredUsd?: number | null;
  currency: string;
  inclusions?: string[];
  exclusions?: string[];
  doctorOpinionNotes?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  consentAcceptedAt?: string | null;
  consentAcceptedBy?: string | null;
}

export const treatmentPlanSchema = z.object({
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(500),
  procedureName: z.string().trim().min(2, 'Proposed procedure is required').max(500),
  specialty: z.string().trim().max(120).nullable().optional(),
  hospitalLosDays: z.coerce.number().int().min(0).max(365),
  recoveryStayDays: z.coerce.number().int().min(0).max(365),
  estimatedCostUsd: z.coerce.number().min(0),
  depositRequiredUsd: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(8).default('USD'),
  inclusions: z.array(z.string().trim().min(1)).optional(),
  exclusions: z.array(z.string().trim().min(1)).optional(),
  doctorOpinionNotes: z.string().max(4000).nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  publishedBy: z.string().nullable().optional(),
  consentAcceptedAt: z.string().nullable().optional(),
  consentAcceptedBy: z.string().nullable().optional(),
});

export interface TravelLogisticsPayload {
  attendants?: MedicalAttendantRecord[];
  arrivalAirline?: string | null;
  arrivalFlightNo?: string | null;
  arrivalAt?: string | null;
  arrivalAirport?: string | null;
  airportPickupRequired?: boolean;
  pickupConfirmed?: boolean;
  pickupDriverNotes?: string | null;
  wheelchairSsrCode?: (typeof SSR_ASSISTANCE_CODES)[number] | string | null;
  dietaryPreferences?: string | null;
  departureAirline?: string | null;
  departureFlightNo?: string | null;
  departureAt?: string | null;
  visaNumber?: string | null;
  visaExpiryDate?: string | null;
  formCSubmittedAt?: string | null;
  frroNumber?: string | null;
  updatedAt?: string | null;
}

export const travelLogisticsSchema = z.object({
  attendants: z
    .array(medicalAttendantSchema)
    .max(2, 'Indian MHA rules allow at most 2 MED-X medical attendants')
    .optional(),
  arrivalAirline: z.string().max(120).nullable().optional(),
  arrivalFlightNo: z.string().max(64).nullable().optional(),
  arrivalAt: z.string().nullable().optional(),
  arrivalAirport: z.string().max(120).nullable().optional(),
  airportPickupRequired: z.boolean().optional(),
  pickupConfirmed: z.boolean().optional(),
  pickupDriverNotes: z.string().max(1000).nullable().optional(),
  wheelchairSsrCode: z.enum(SSR_ASSISTANCE_CODES).nullable().optional(),
  dietaryPreferences: z.string().max(500).nullable().optional(),
  departureAirline: z.string().max(120).nullable().optional(),
  departureFlightNo: z.string().max(64).nullable().optional(),
  departureAt: z.string().nullable().optional(),
  visaNumber: z.string().max(100).nullable().optional(),
  visaExpiryDate: z.string().nullable().optional(),
  formCSubmittedAt: z.string().nullable().optional(),
  frroNumber: z.string().max(120).nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const fitToFlyChecklistSchema = z.object({
  woundStable: z.boolean(),
  noTrappedGasRisk: z.boolean(),
  cardioRespiratoryStable: z.boolean(),
  hemoglobinCleared: z.boolean(),
  dvtProphylaxisPlan: z.boolean(),
});

export type FitToFlyChecklistPayload = z.infer<typeof fitToFlyChecklistSchema>;

export const followUpMilestoneSchema = z.object({
  milestone: z.enum(FOLLOW_UP_MILESTONES),
  dueAt: z.string(),
  status: z.enum(['PENDING', 'SUBMITTED', 'REVIEWED']),
  painScore: z.coerce.number().int().min(0).max(10).optional(),
  woundStatus: z.string().max(200).optional(),
  patientNotes: z.string().max(2000).optional(),
  doctorFeedback: z.string().max(2000).optional(),
  updatedAt: z.string().optional(),
});

export type FollowUpMilestone = z.infer<typeof followUpMilestoneSchema>;

// ─── Discriminated Lifecycle Mutation Schema ────────────────────────

export const assignClinicalTeamMutationSchema = z.object({
  action: z.literal('ASSIGN_CLINICAL_TEAM'),
  hospitalId: z.string().trim().min(1, 'Hospital ID is required'),
  primaryDoctorId: z.string().trim().min(1, 'Primary doctor ID is required'),
  specialtyId: z.string().trim().optional(),
  notes: z.string().max(2000).optional(),
});

export const publishTreatmentPlanMutationSchema = z.object({
  action: z.literal('PUBLISH_TREATMENT_PLAN'),
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(500),
  procedureName: z.string().trim().min(2, 'Proposed procedure is required').max(500),
  specialty: z.string().trim().max(120).nullable().optional(),
  hospitalLosDays: z.coerce.number().int().min(0).max(365),
  recoveryStayDays: z.coerce.number().int().min(0).max(365),
  estimatedCostUsd: z.coerce.number().min(0),
  depositRequiredUsd: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(8).default('USD'),
  inclusions: z.array(z.string().trim().min(1)).optional(),
  exclusions: z.array(z.string().trim().min(1)).optional(),
  doctorOpinionNotes: z.string().max(4000).nullable().optional(),
});

export const acceptTreatmentPlanMutationSchema = z.object({
  action: z.literal('ACCEPT_TREATMENT_PLAN'),
  informedConsentAccepted: z
    .boolean()
    .optional()
    .default(true)
    .refine((val) => val === true, {
      message: 'Informed pre-travel treatment plan consent must be confirmed',
    }),
  patientNotes: z.string().max(1000).optional(),
});

export const updateTravelLogisticsMutationSchema = z.object({
  action: z.literal('UPDATE_TRAVEL_LOGISTICS'),
  passportExpiry: z.string().nullable().optional(),
  attendants: z
    .array(medicalAttendantSchema)
    .max(2, 'Indian MHA rules allow at most 2 MED-X medical attendants')
    .optional(),
  arrivalAirline: z.string().max(120).nullable().optional(),
  arrivalFlightNo: z.string().max(64).nullable().optional(),
  arrivalAt: z.string().nullable().optional(),
  arrivalAirport: z.string().max(120).nullable().optional(),
  airportPickupRequired: z.boolean().optional(),
  pickupConfirmed: z.boolean().optional(),
  pickupDriverNotes: z.string().max(1000).nullable().optional(),
  wheelchairSsrCode: z.enum(SSR_ASSISTANCE_CODES).nullable().optional(),
  dietaryPreferences: z.string().max(500).nullable().optional(),
  departureAirline: z.string().max(120).nullable().optional(),
  departureFlightNo: z.string().max(64).nullable().optional(),
  departureAt: z.string().nullable().optional(),
  visaNumber: z.string().max(100).nullable().optional(),
  visaExpiryDate: z.string().nullable().optional(),
});

export const recordFormCMutationSchema = z.object({
  action: z.literal('RECORD_FORM_C'),
  formCSubmittedAt: z.string().optional(),
  frroNumber: z.string().trim().max(120).nullable().optional(),
  visaExpiryDate: z.string().nullable().optional(),
});

export const submitFollowUpMutationSchema = z.object({
  action: z.literal('SUBMIT_FOLLOW_UP'),
  milestone: z.enum(FOLLOW_UP_MILESTONES),
  painScore: z.coerce.number().int().min(0).max(10).optional(),
  woundStatus: z.string().max(200).optional(),
  patientNotes: z.string().max(2000).optional(),
  doctorFeedback: z.string().max(2000).optional(),
});

export const lifecycleMutationSchema = z.discriminatedUnion('action', [
  assignClinicalTeamMutationSchema,
  publishTreatmentPlanMutationSchema,
  acceptTreatmentPlanMutationSchema,
  updateTravelLogisticsMutationSchema,
  recordFormCMutationSchema,
  submitFollowUpMutationSchema,
]);

export type LifecycleMutationInput = z.infer<typeof lifecycleMutationSchema>;

// ─── Clean 7-Stage MVT Pathway Presets & Generator ──────────────────

export interface PresetStageStep {
  stageName: string;
  stageOrder: number;
  stepOrder: number;
  title: string;
  category: string;
  status: string;
  decisionBranch?: string;
  actionType?: string;
  requiredRole?: string;
  actionUrl?: string;
  doctorNotes?: string;
}

export interface PathwayPresetTemplate {
  id: string;
  specialtyName: string;
  description: string;
  icon: string;
  steps: PresetStageStep[];
}

const STANDARD_MVT_STEPS: PresetStageStep[] = [
  {
    stageName: 'Stage 1: Digital Intake & Clinical Triage',
    stageOrder: 1,
    stepOrder: 1,
    title: 'Passport & Diagnostic Medical Records Intake',
    category: 'PRE_OP',
    status: 'IN_PROGRESS',
    actionType: 'UPLOAD_DOCS',
    requiredRole: 'PATIENT',
  },
  {
    stageName: 'Stage 1: Digital Intake & Clinical Triage',
    stageOrder: 1,
    stepOrder: 2,
    title: 'Specialist Triage & Multi-Disciplinary Case Review',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'VOTE_MDT',
    requiredRole: 'DOCTOR',
  },
  {
    stageName: 'Stage 2: Specialist Evaluation, All-In Quote & Consent',
    stageOrder: 2,
    stepOrder: 1,
    title: 'Structured Treatment Plan & All-In Cost Estimate',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'ISSUE_PROFORMA',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 2: Specialist Evaluation, All-In Quote & Consent',
    stageOrder: 2,
    stepOrder: 2,
    title: 'Informed Plan Acceptance & Hospital Slot Reservation',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'RESERVE_BED',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 3: Visa Sponsorship (VIL), MED-X & Travel Concierge',
    stageOrder: 3,
    stepOrder: 1,
    title: 'Official Hospital Visa Invitation Letter (VIL) Issuance',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'ISSUE_VIL',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 3: Visa Sponsorship (VIL), MED-X & Travel Concierge',
    stageOrder: 3,
    stepOrder: 2,
    title: 'Flight Itinerary & Airport Concierge Transfer Confirmation',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'ARRANGE_LOGISTICS',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 4: Arrival, Statutory Form C (24h FRRO) & PAC Clearance',
    stageOrder: 4,
    stepOrder: 1,
    title: 'Hospital Check-In & Statutory 24-Hour FRRO Form C Filing',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'RECORD_FORM_C',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 4: Arrival, Statutory Form C (24h FRRO) & PAC Clearance',
    stageOrder: 4,
    stepOrder: 2,
    title: 'In-Person Specialist Consult & Pre-Anesthesia Checkup (PAC)',
    category: 'PRE_OP',
    status: 'PENDING',
    actionType: 'SIGN_PAC',
    requiredRole: 'DOCTOR',
  },
  {
    stageName: 'Stage 5: Active Procedural / Surgical Intervention',
    stageOrder: 5,
    stepOrder: 1,
    title: 'Primary Surgical / Clinical Intervention & Operative Summary',
    category: 'TREATMENT',
    status: 'PENDING',
    actionType: 'OPERATIVE_SUMMARY',
    requiredRole: 'DOCTOR',
  },
  {
    stageName: 'Stage 6: Inpatient Recovery, Discharge Summary & Billing',
    stageOrder: 6,
    stepOrder: 1,
    title: 'Inpatient Ward Recovery & Hemodynamic Stabilization',
    category: 'POST_OP',
    status: 'PENDING',
    actionType: 'HEMODYNAMICS_CLEARANCE',
    requiredRole: 'DOCTOR',
  },
  {
    stageName: 'Stage 6: Inpatient Recovery, Discharge Summary & Billing',
    stageOrder: 6,
    stepOrder: 2,
    title: 'Official Hospital Discharge Summary & Final Bill Settlement',
    category: 'DISCHARGE',
    status: 'PENDING',
    actionType: 'SETTLE_BILL',
    requiredRole: 'MANAGER',
  },
  {
    stageName: 'Stage 7: IATA Fit-to-Fly Clearance & Remote Continuum',
    stageOrder: 7,
    stepOrder: 1,
    title: 'Fit-to-Fly & IATA MEDIF Travel Clearance Certificate',
    category: 'DISCHARGE',
    status: 'PENDING',
    actionType: 'SIGN_FIT_TO_FLY',
    requiredRole: 'DOCTOR',
  },
  {
    stageName: 'Stage 7: IATA Fit-to-Fly Clearance & Remote Continuum',
    stageOrder: 7,
    stepOrder: 2,
    title: 'Day-7, Day-30 & Day-90 Post-Return Tele-Rehab Follow-Up',
    category: 'REHAB',
    status: 'PENDING',
    actionType: 'SCHEDULE_TELE_REHAB',
    requiredRole: 'DOCTOR',
  },
];

export const CLEAN_PRESET_TEMPLATES: PathwayPresetTemplate[] = [
  {
    id: 'CARDIOLOGY',
    specialtyName: 'Interventional Cardiology & Cardiac Surgery Pathway',
    description:
      'Comprehensive 7-stage cardiac catheterization, stent placement, CCU telemetry, and Fit-to-Fly protocol.',
    icon: 'HeartPulse',
    steps: [
      {
        stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance',
        stageOrder: 1,
        stepOrder: 1,
        title: 'Inquiry & Initial Medical DICOM Review',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance',
        stageOrder: 1,
        stepOrder: 2,
        title: 'Multi-Disciplinary Team (MDT) Board Clearance',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'VOTE_MDT',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 2: MDT Board & Pro-Forma Invoice',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Pro-Forma Treatment Cost Estimate Generation',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_PROFORMA',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 2: MDT Board & Pro-Forma Invoice',
        stageOrder: 2,
        stepOrder: 2,
        title: 'Hospital Bed & Cath Lab Reservation',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'RESERVE_BED',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Official Hospital Visa Invitation Letter (VIL) Issuance',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
        stageOrder: 3,
        stepOrder: 2,
        title: 'Flight Itinerary & Airport Transfer Confirmation',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ARRANGE_LOGISTICS',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Hospital Admission & Pre-Anesthesia (PAC)',
        stageOrder: 4,
        stepOrder: 1,
        title: 'Pre-Anesthesia Evaluation (PAC) & Cardiac Assessment',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'SIGN_PAC',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 5: Active Procedural / Surgical Intervention',
        stageOrder: 5,
        stepOrder: 1,
        title: 'Percutaneous Coronary Intervention & Stent Placement',
        category: 'TREATMENT',
        status: 'PENDING',
        actionType: 'OPERATIVE_SUMMARY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery',
        stageOrder: 6,
        stepOrder: 1,
        title: 'Post-Op Coronary Care Unit (CCU) Telemetry Monitoring',
        category: 'POST_OP',
        status: 'PENDING',
        actionType: 'HEMODYNAMICS_CLEARANCE',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery',
        stageOrder: 6,
        stepOrder: 2,
        title: 'In-Patient Ward Recovery & Mobilization Protocol',
        category: 'POST_OP',
        status: 'PENDING',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
        stageOrder: 7,
        stepOrder: 1,
        title: 'Fit-to-Fly Medical Travel Clearance Certificate',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SIGN_FIT_TO_FLY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
        stageOrder: 7,
        stepOrder: 2,
        title: 'Hospital Discharge Summary & Final Bill Settlement',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SETTLE_BILL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
        stageOrder: 7,
        stepOrder: 3,
        title: 'Outpatient Tele-Rehabilitation & Follow-Up Consult',
        category: 'REHAB',
        status: 'PENDING',
        actionType: 'SCHEDULE_TELE_REHAB',
        requiredRole: 'DOCTOR',
      },
    ],
  },
  {
    id: 'ONCOLOGY',
    specialtyName: 'Oncology Surgical & Chemotherapy Pathway',
    description:
      'Specialized 7-stage tumor board evaluation, surgical resection, chemotherapy infusion, and fit-to-fly clearance.',
    icon: 'Stethoscope',
    steps: [
      {
        stageName: 'Stage 1: Pre-Travel Tumor Board Triage',
        stageOrder: 1,
        stepOrder: 1,
        title: 'Histopathology & Biopsy Report Evaluation',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 1: Pre-Travel Tumor Board Triage',
        stageOrder: 1,
        stepOrder: 2,
        title: 'Multi-Specialty Tumor Board Surgical Consensus',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'VOTE_MDT',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 2: Oncology Treatment Protocol & Cost Estimate',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Staged Oncology Treatment Plan & Pro-Forma Quote',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_PROFORMA',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation Letter & Consulate Clearance',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Official Emergency Medical Visa Invitation Letter',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation Letter & Consulate Clearance',
        stageOrder: 3,
        stepOrder: 2,
        title: 'Flight Itinerary & Airport Concierge Confirmation',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ARRANGE_LOGISTICS',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Hospital Admission & Pre-Op PAC',
        stageOrder: 4,
        stepOrder: 1,
        title: 'In-Patient Admission & Pre-Anesthesia Fitness',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'SIGN_PAC',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 5: Surgical Tumor Resection OT Procedure',
        stageOrder: 5,
        stepOrder: 1,
        title: 'Oncology Operating Suite Resection Procedure',
        category: 'TREATMENT',
        status: 'PENDING',
        actionType: 'OPERATIVE_SUMMARY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 6: Chemotherapy / Ward Stabilization & Discharge',
        stageOrder: 6,
        stepOrder: 1,
        title: 'Post-Op Targeted Chemotherapy / Inpatient Stabilization',
        category: 'POST_OP',
        status: 'PENDING',
      },
      {
        stageName: 'Stage 6: Chemotherapy / Ward Stabilization & Discharge',
        stageOrder: 6,
        stepOrder: 2,
        title: 'Oncology Discharge Summary & Final Bill Settlement',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SETTLE_BILL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification & Tele-Oncology',
        stageOrder: 7,
        stepOrder: 1,
        title: 'Fit-to-Fly Travel Certification',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SIGN_FIT_TO_FLY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification & Tele-Oncology',
        stageOrder: 7,
        stepOrder: 2,
        title: 'Day-7, Day-30 & Day-90 Tele-Oncology Follow-Up',
        category: 'REHAB',
        status: 'PENDING',
        actionType: 'SCHEDULE_TELE_REHAB',
        requiredRole: 'DOCTOR',
      },
    ],
  },
  {
    id: 'ORTHOPEDICS',
    specialtyName: 'Orthopedic Total Joint Replacement Pathway',
    description:
      '7-stage total knee/hip arthroplasty, navigation OT, ward physiotherapy, and post-op rehabilitation.',
    icon: 'Activity',
    steps: [
      {
        stageName: 'Stage 1: Pre-Op Joint X-Ray & MRI Triage',
        stageOrder: 1,
        stepOrder: 1,
        title: 'Joint Radiology & Mobility Assessment',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 1: Pre-Op Joint X-Ray & MRI Triage',
        stageOrder: 1,
        stepOrder: 2,
        title: 'Orthopedic Surgeon Pre-Travel Case Clearance',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'VOTE_MDT',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 2: Ortho Board & Prosthetic Selection',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Implant Prosthetic Selection & Cost Estimate',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_PROFORMA',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Medical Visa (VIL) & Flight Booking',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Hospital Visa Invitation Letter (VIL)',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Medical Visa (VIL) & Flight Booking',
        stageOrder: 3,
        stepOrder: 2,
        title: 'Wheelchair-Assisted Airport Pickup & Transfer',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'ARRANGE_LOGISTICS',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Admission & PAC Anesthesia Fitness',
        stageOrder: 4,
        stepOrder: 1,
        title: 'Pre-Anesthesia PAC Assessment',
        category: 'PRE_OP',
        status: 'PENDING',
        actionType: 'SIGN_PAC',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 5: Computer-Navigated Arthroplasty Procedure',
        stageOrder: 5,
        stepOrder: 1,
        title: 'Total Joint Arthroplasty OT Surgery',
        category: 'TREATMENT',
        status: 'PENDING',
        actionType: 'OPERATIVE_SUMMARY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 6: Ward Physiotherapy & Gait Rehabilitation',
        stageOrder: 6,
        stepOrder: 1,
        title: 'Post-Op Physical Therapy & Mobility Protocol',
        category: 'POST_OP',
        status: 'PENDING',
      },
      {
        stageName: 'Stage 6: Ward Physiotherapy & Gait Rehabilitation',
        stageOrder: 6,
        stepOrder: 2,
        title: 'Discharge Summary & Final Hospital Settlement',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SETTLE_BILL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certificate & Discharge',
        stageOrder: 7,
        stepOrder: 1,
        title: 'Fit-to-Fly Medical Travel Certification',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SIGN_FIT_TO_FLY',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certificate & Discharge',
        stageOrder: 7,
        stepOrder: 2,
        title: 'Remote Physiotherapy & Day-7/30/90 Follow-Up',
        category: 'REHAB',
        status: 'PENDING',
        actionType: 'SCHEDULE_TELE_REHAB',
        requiredRole: 'DOCTOR',
      },
    ],
  },
];

export function buildStandardMvtPathwaySteps(specialtyId?: string): PresetStageStep[] {
  const normalized = specialtyId?.trim().toUpperCase();
  const matchedPreset = normalized
    ? CLEAN_PRESET_TEMPLATES.find((tpl) => tpl.id === normalized)
    : undefined;
  const sourceSteps = matchedPreset ? matchedPreset.steps : STANDARD_MVT_STEPS;

  return sourceSteps.map((step, index) => ({
    stageName: step.stageName,
    stageOrder: step.stageOrder,
    stepOrder: step.stepOrder,
    title: step.title,
    category: step.category,
    status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
    ...(step.actionType ? { actionType: step.actionType } : {}),
    ...(step.requiredRole ? { requiredRole: step.requiredRole } : {}),
    ...(step.actionUrl ? { actionUrl: step.actionUrl } : {}),
  }));
}

// ─── Stage-Gate Guardrails & SLA Pure Helpers ───────────────────────

export interface ValidateCaseStatusTransitionParams {
  currentStatus: string;
  nextStatus: string;
  hasVerifiedPassport: boolean;
  hasClearedFitToFly: boolean;
  unpaidBillCount: number;
  overrideReason?: string | null;
}

const VALID_CASE_STATUSES = new Set<string>(CASE_STATUS_ORDER);
const INPATIENT_SURGICAL_STATUSES = new Set<string>([
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
]);

export function validateCaseStatusTransition(
  params: ValidateCaseStatusTransitionParams
): { ok: true } | { ok: false; message: string } {
  if (!VALID_CASE_STATUSES.has(params.nextStatus)) {
    return { ok: false, message: 'Invalid target case status' };
  }

  if (params.currentStatus === params.nextStatus) {
    return { ok: true };
  }

  const hasOverride = Boolean(
    params.overrideReason && params.overrideReason.trim().length > 0
  );

  if (params.currentStatus === 'CLOSED' && !hasOverride) {
    return {
      ok: false,
      message: 'Cannot reopen a closed case without an explicit administrative override reason',
    };
  }

  if (params.nextStatus === 'FIT_TO_FLY_CLEARED' && !params.hasClearedFitToFly) {
    return {
      ok: false,
      message:
        'Cannot transition to Fit-to-Fly Cleared without a signed Fit-to-Fly medical clearance',
    };
  }

  if (params.nextStatus === 'REMOTE_REHAB' && !params.hasClearedFitToFly && !hasOverride) {
    return {
      ok: false,
      message:
        'Cannot transition to Remote Tele-Rehab before Fit-to-Fly medical clearance is certified',
    };
  }

  if (
    params.currentStatus === 'INQUIRY_RECEIVED' &&
    params.nextStatus === 'IN_TREATMENT' &&
    !params.hasVerifiedPassport &&
    !hasOverride
  ) {
    return {
      ok: false,
      message:
        'Cannot jump directly from Inquiry Received to active Hospital Treatment without passport verification or override reason',
    };
  }

  if (params.nextStatus === 'CLOSED') {
    if (params.unpaidBillCount > 0 && !hasOverride) {
      return {
        ok: false,
        message:
          'Cannot close case while unpaid hospital bills remain unsettled without an explicit override reason',
      };
    }

    if (
      INPATIENT_SURGICAL_STATUSES.has(params.currentStatus) &&
      !params.hasClearedFitToFly &&
      !hasOverride
    ) {
      return {
        ok: false,
        message:
          'Cannot close an inpatient case before Fit-to-Fly clearance is granted without an explicit override reason',
      };
    }
  }

  return { ok: true };
}

export type FormCSlaStatus =
  | 'NOT_ARRIVED'
  | 'SUBMITTED_ON_TIME'
  | 'DUE_WITHIN_24H'
  | 'OVERDUE_STATUTORY';

export function computeFormCSlaStatus(
  arrivalAt?: string | Date | null,
  formCSubmittedAt?: string | Date | null,
  referenceNow: Date = new Date()
): FormCSlaStatus {
  if (!arrivalAt) return 'NOT_ARRIVED';
  const arrivalDate = arrivalAt instanceof Date ? arrivalAt : new Date(arrivalAt);
  if (Number.isNaN(arrivalDate.getTime())) return 'NOT_ARRIVED';

  if (formCSubmittedAt) {
    const submittedDate =
      formCSubmittedAt instanceof Date ? formCSubmittedAt : new Date(formCSubmittedAt);
    if (!Number.isNaN(submittedDate.getTime())) {
      return 'SUBMITTED_ON_TIME';
    }
  }

  if (referenceNow.getTime() < arrivalDate.getTime()) {
    return 'NOT_ARRIVED';
  }

  const elapsedMs = referenceNow.getTime() - arrivalDate.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  return elapsedMs > twentyFourHoursMs ? 'OVERDUE_STATUTORY' : 'DUE_WITHIN_24H';
}

export function validateFitToFlySafetyChecklist(
  isCleared: boolean,
  checklist?: FitToFlyChecklistPayload | null
): { ok: true } | { ok: false; message: string } {
  if (!isCleared || !checklist) {
    return { ok: true };
  }

  const allPassed =
    checklist.woundStable === true &&
    checklist.noTrappedGasRisk === true &&
    checklist.cardioRespiratoryStable === true &&
    checklist.hemoglobinCleared === true &&
    checklist.dvtProphylaxisPlan === true;

  if (!allPassed) {
    return {
      ok: false,
      message:
        'All physiological safety criteria must be confirmed to certify Fit-to-Fly clearance',
    };
  }

  return { ok: true };
}

// ─── Patient Roadmap & Dynamic Next-Action Engine ───────────────────

const CERTIFICATE_ACTION_TO_CATEGORY: Record<string, string> = {
  ISSUE_VIL: 'VISA_INVITATION_LETTER',
  SIGN_FIT_TO_FLY: 'FIT_TO_FLY_CERTIFICATE',
  DISCHARGE_SUMMARY: 'DISCHARGE_SUMMARY',
};

export function canShowRoadmapCertificateDownload(
  step: { actionType?: string | null; status?: string | null },
  issuedDocCategories?: ReadonlySet<string> | readonly string[] | null
): boolean {
  if (!step.actionType) return false;
  const requiredCategory = CERTIFICATE_ACTION_TO_CATEGORY[step.actionType];
  if (!requiredCategory) return true;
  if (!issuedDocCategories) return false;

  if (issuedDocCategories instanceof Set) {
    return issuedDocCategories.has(requiredCategory);
  }
  if (Array.isArray(issuedDocCategories)) {
    return issuedDocCategories.includes(requiredCategory);
  }
  return (issuedDocCategories as ReadonlySet<string>).has(requiredCategory);
}

export interface PatientDocumentSummary {
  category: string;
  verificationStatus: string;
  verificationNotes?: string | null;
}

export interface PatientNextActionContext {
  caseStatus: string;
  documents: PatientDocumentSummary[];
  treatmentPlan?: TreatmentPlanPayload | null;
  travelLogistics?: TravelLogisticsPayload | null;
  unpaidBillCount: number;
  postReturnFollowUps?: FollowUpMilestone[] | null;
  passportExpiry?: string | Date | null;
}

export type PatientNextActionKey =
  | 'REUPLOAD_REJECTED_DOC'
  | 'ACCEPT_TREATMENT_PLAN'
  | 'UPLOAD_DIAGNOSTICS'
  | 'UPLOAD_PASSPORT'
  | 'UPLOAD_APPROVED_VISA'
  | 'SUBMIT_FLIGHT_DETAILS'
  | 'SETTLE_HOSPITAL_BILLS'
  | 'COMPLETE_FOLLOW_UP_CHECKIN';

export interface PatientNextActionItem {
  key: PatientNextActionKey;
  title: string;
  description: string;
  ctaLabel: string;
  href?: string;
  modalAction?: 'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL';
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  meta?: Record<string, unknown>;
}

export function derivePatientNextActions(
  input: PatientNextActionContext
): PatientNextActionItem[] {
  if (input.caseStatus === 'CLOSED') {
    return [];
  }

  const actions: PatientNextActionItem[] = [];
  const docs = input.documents || [];

  const hasValidCategoryDoc = (category: string) =>
    docs.some(
      (d) =>
        d.category === category &&
        d.verificationStatus !== 'REJECTED'
    );

  // 1. Highest priority: any REJECTED document that has not been replaced yet
  const unresolvedRejectedDocs = docs.filter(
    (d) =>
      d.verificationStatus === 'REJECTED' && !hasValidCategoryDoc(d.category)
  );
  for (const rejected of unresolvedRejectedDocs) {
    const categoryLabel =
      DOCUMENT_CATEGORY_LABELS[rejected.category] || rejected.category;
    actions.push({
      key: 'REUPLOAD_REJECTED_DOC',
      title: `Replace Rejected ${categoryLabel}`,
      description: rejected.verificationNotes
        ? `Coordinator note: ${rejected.verificationNotes}`
        : `Your uploaded ${categoryLabel.toLowerCase()} requires a clearer replacement copy.`,
      ctaLabel: 'Replace Document',
      href: '/patient/documents',
      priority: 'CRITICAL',
      meta: {
        category: rejected.category,
        verificationNotes: rejected.verificationNotes ?? null,
      },
    });
  }

  // 2. Published Treatment Plan awaiting Patient Informed Consent
  if (
    input.treatmentPlan &&
    (input.treatmentPlan.publishedAt || input.treatmentPlan.procedureName) &&
    !input.treatmentPlan.consentAcceptedAt
  ) {
    const currency = input.treatmentPlan.currency || 'USD';
    actions.push({
      key: 'ACCEPT_TREATMENT_PLAN',
      title: 'Review & Accept Hospital Treatment Plan',
      description: `${input.treatmentPlan.procedureName} — All-in estimate ${currency} ${Number(
        input.treatmentPlan.estimatedCostUsd || 0
      ).toLocaleString()} (${input.treatmentPlan.hospitalLosDays}d hospital + ${
        input.treatmentPlan.recoveryStayDays
      }d recovery stay).`,
      ctaLabel: 'Review Treatment Plan',
      href: '/patient/dashboard#treatment-plan',
      modalAction: 'TREATMENT_PLAN_MODAL',
      priority: 'HIGH',
    });
  }

  // 3. Stage 1 / 2 Pre-Travel Intake: Diagnostic reports & Passport
  if (
    input.caseStatus === 'INQUIRY_RECEIVED' ||
    input.caseStatus === 'UNDER_REVIEW'
  ) {
    if (!hasValidCategoryDoc('MEDICAL_REPORT')) {
      actions.push({
        key: 'UPLOAD_DIAGNOSTICS',
        title: 'Upload Diagnostic Reports & Scans',
        description:
          'Share recent MRI/CT summaries, lab reports, or cardiology evaluations so your assigned specialist can issue a treatment plan.',
        ctaLabel: 'Upload Medical Records',
        href: '/patient/documents',
        priority: 'HIGH',
      });
    }

    const passportAlreadyFlagged = unresolvedRejectedDocs.some(
      (d) => d.category === 'PASSPORT'
    );
    if (!hasValidCategoryDoc('PASSPORT') && !passportAlreadyFlagged) {
      actions.push({
        key: 'UPLOAD_PASSPORT',
        title: 'Upload Passport Bio-Page',
        description:
          'Required with at least 6 months validity to sponsor your official Hospital Visa Invitation Letter (VIL).',
        ctaLabel: 'Upload Passport',
        href: '/patient/documents',
        priority: 'NORMAL',
      });
    }
  }

  // 4. Stage 3 Visa Sponsorship & Flight Concierge
  const hasIssuedVil = docs.some(
    (d) =>
      d.category === 'VISA_INVITATION_LETTER' &&
      d.verificationStatus !== 'REJECTED'
  );
  if (
    input.caseStatus === 'PRE_OP_CLEARANCE' ||
    input.caseStatus === 'PLAN_CONFIRMED' ||
    hasIssuedVil
  ) {
    if (!hasValidCategoryDoc('VISA') && (hasIssuedVil || input.caseStatus === 'PLAN_CONFIRMED')) {
      actions.push({
        key: 'UPLOAD_APPROVED_VISA',
        title: 'Upload Approved e-Medical Visa (MED)',
        description:
          'Upload your approved Indian Medical Visa once issued so our coordinator can finalize admission & FRRO compliance.',
        ctaLabel: 'Upload Visa',
        href: '/patient/documents',
        priority: 'HIGH',
      });
    }

    if (
      !input.travelLogistics?.arrivalFlightNo ||
      !input.travelLogistics?.arrivalAt
    ) {
      actions.push({
        key: 'SUBMIT_FLIGHT_DETAILS',
        title: 'Submit Flight Itinerary & MED-X Companion Details',
        description:
          'Share your inbound flight schedule and any accompanying medical attendants for airport reception.',
        ctaLabel: 'Add Travel Details',
        href: '/patient/documents#travel-concierge',
        priority: 'HIGH',
      });
    }
  }

  // 5. Unpaid Hospital Invoices
  if (input.unpaidBillCount > 0) {
    actions.push({
      key: 'SETTLE_HOSPITAL_BILLS',
      title: `Review & Settle ${input.unpaidBillCount} Pending Hospital Invoice${
        input.unpaidBillCount === 1 ? '' : 's'
      }`,
      description:
        'Hospital billing clearance is required prior to final discharge and return flight sign-off.',
      ctaLabel: 'Review Billing',
      href: '/patient/billing',
      priority: 'HIGH',
    });
  }

  // 6. Stage 7 Post-Return Recovery Check-Ins (Day 7 / Day 30 / Day 90)
  if (
    input.caseStatus === 'FIT_TO_FLY_CLEARED' ||
    input.caseStatus === 'REMOTE_REHAB' ||
    input.caseStatus === 'OUTPATIENT_RECUPERATION'
  ) {
    const pendingFollowUp = (input.postReturnFollowUps || []).find(
      (m) => m.status === 'PENDING'
    );
    if (pendingFollowUp) {
      const label =
        FOLLOW_UP_MILESTONE_LABELS[pendingFollowUp.milestone] ||
        pendingFollowUp.milestone;
      actions.push({
        key: 'COMPLETE_FOLLOW_UP_CHECKIN',
        title: `Complete ${label}`,
        description:
          'Log your current pain level, surgical site healing status, and recovery notes for your treating specialist.',
        ctaLabel: 'Submit Recovery Check-In',
        modalAction: 'FOLLOW_UP_MODAL',
        priority: 'HIGH',
        meta: {
          milestone: pendingFollowUp.milestone,
          dueAt: pendingFollowUp.dueAt,
        },
      });
    }
  }

  return actions;
}

