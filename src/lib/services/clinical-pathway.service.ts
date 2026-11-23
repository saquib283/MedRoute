/**
 * Afzal Healthcare — Multi-Role Clinical Pathway & Authorization Service
 * Centralizes object-level case clinical access across ADMIN, assigned MANAGER,
 * treating DOCTOR, and owning PATIENT, plus pathway template presets and step mutations.
 */

import { z } from 'zod';
import type { CaseStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { CASE_STATUS_ORDER } from '@/lib/constants';
import { formatPatientForViewer } from '@/lib/services/phi.service';

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

export const PRESET_TEMPLATES: PathwayPresetTemplate[] = [
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
        status: 'COMPLETED',
        doctorNotes: 'Pre-op Angiography DICOM scans reviewed.',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance',
        stageOrder: 1,
        stepOrder: 2,
        title: 'Multi-Disciplinary Team (MDT) Board Clearance',
        category: 'PRE_OP',
        status: 'COMPLETED',
        decisionBranch: 'APPROVED_FOR_SURGERY',
        doctorNotes: 'MDT board approved surgical intervention.',
        actionType: 'VOTE_MDT',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 2: MDT Board & Pro-Forma Invoice',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Pro-Forma Treatment Cost Estimate Generation',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ISSUE_PROFORMA',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 2: MDT Board & Pro-Forma Invoice',
        stageOrder: 2,
        stepOrder: 2,
        title: 'Hospital Bed & Cath Lab Reservation',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'RESERVE_BED',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Official Hospital Visa Invitation Letter (VIL) Issuance',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
        stageOrder: 3,
        stepOrder: 2,
        title: 'Flight Itinerary & Airport Transfer Confirmation',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ARRANGE_LOGISTICS',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Hospital Admission & Pre-Anesthesia (PAC)',
        stageOrder: 4,
        stepOrder: 1,
        title: 'Pre-Anesthesia Evaluation (PAC) & Cardiac Assessment',
        category: 'PRE_OP',
        status: 'COMPLETED',
        decisionBranch: 'FIT_FOR_ANESTHESIA',
        doctorNotes: 'PAC clearance granted.',
        actionType: 'SIGN_PAC',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 5: Active Procedural / Surgical Intervention',
        stageOrder: 5,
        stepOrder: 1,
        title: 'Percutaneous Coronary Intervention & Stent Placement',
        category: 'TREATMENT',
        status: 'IN_PROGRESS',
        decisionBranch: 'UNCOMPLICATED_PROCEDURE',
        doctorNotes: 'Catheterization lab intervention scheduled.',
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
        decisionBranch: 'STABLE_STEARN_HEMODYNAMICS',
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
        decisionBranch: 'NORMAL_RECOVERY_TRACK',
      },
      {
        stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
        stageOrder: 7,
        stepOrder: 1,
        title: 'Fit-to-Fly Medical Travel Clearance Certificate',
        category: 'DISCHARGE',
        status: 'PENDING',
        decisionBranch: 'FIT_TO_FLY_GRANTED',
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
        status: 'COMPLETED',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 2: MDT Tumor Board & Treatment Protocol',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Multi-Specialty Tumor Board Surgical Consensus',
        category: 'PRE_OP',
        status: 'COMPLETED',
        decisionBranch: 'APPROVED_FOR_SURGERY',
        actionType: 'VOTE_MDT',
        requiredRole: 'DOCTOR',
      },
      {
        stageName: 'Stage 3: Visa Invitation Letter & Consulate Clearance',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Official Emergency Medical Visa Invitation Letter',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Hospital Admission & Pre-Op PAC',
        stageOrder: 4,
        stepOrder: 1,
        title: 'In-Patient Admission & Pre-Anesthesia Fitness',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
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
        stageName: 'Stage 6: Chemotherapy / Radiation Cycle',
        stageOrder: 6,
        stepOrder: 1,
        title: 'Post-Op Targeted Chemotherapy Infusion Cycle',
        category: 'POST_OP',
        status: 'PENDING',
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
        status: 'COMPLETED',
        actionType: 'UPLOAD_DOCS',
        requiredRole: 'PATIENT',
      },
      {
        stageName: 'Stage 2: Ortho Board & Prosthetic Selection',
        stageOrder: 2,
        stepOrder: 1,
        title: 'Implant Prosthetic Selection & Cost Estimate',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ISSUE_PROFORMA',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 3: Medical Visa (VIL) & Flight Booking',
        stageOrder: 3,
        stepOrder: 1,
        title: 'Hospital Visa Invitation Letter (VIL)',
        category: 'PRE_OP',
        status: 'COMPLETED',
        actionType: 'ISSUE_VIL',
        requiredRole: 'MANAGER',
      },
      {
        stageName: 'Stage 4: Admission & PAC Anesthesia Fitness',
        stageOrder: 4,
        stepOrder: 1,
        title: 'Pre-Anesthesia PAC Assessment',
        category: 'PRE_OP',
        status: 'IN_PROGRESS',
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
        stageName: 'Stage 7: Fit-to-Fly Certificate & Discharge',
        stageOrder: 7,
        stepOrder: 1,
        title: 'Fit-to-Fly Medical Travel Certification',
        category: 'DISCHARGE',
        status: 'PENDING',
        actionType: 'SIGN_FIT_TO_FLY',
        requiredRole: 'DOCTOR',
      },
    ],
  },
];

const STEP_CATEGORIES = ['PRE_OP', 'TREATMENT', 'POST_OP', 'DISCHARGE', 'REHAB'] as const;
const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ACTION_REQUIRED'] as const;
const REQUIRED_ROLES = ['PATIENT', 'DOCTOR', 'MANAGER', 'ADMIN'] as const;

const optionalNullableString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

const optionalRequiredRole = z
  .union([z.enum(REQUIRED_ROLES), z.literal('')])
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

const clinicalStepInputSchema = z.object({
  stageName: z.string().trim().min(1, 'stageName is required'),
  stageOrder: z.coerce.number().int().min(1),
  stepOrder: z.coerce.number().int().min(1),
  title: z.string().trim().min(1, 'Step title is required'),
  category: z.enum(STEP_CATEGORIES),
  status: z.enum(STEP_STATUSES),
  decisionBranch: optionalNullableString,
  doctorNotes: optionalNullableString,
  actionType: optionalNullableString,
  requiredRole: optionalRequiredRole,
  actionUrl: optionalNullableString,
  completedAt: z.union([z.string(), z.date()]).nullable().optional(),
});

const replacePathwaySchema = z.object({
  steps: z.array(clinicalStepInputSchema).min(1, 'At least one clinical pathway step is required'),
  caseStatus: z.enum(CASE_STATUS_ORDER).optional(),
});

const updateStepSchema = z
  .object({
    stepId: z.string().trim().min(1, 'stepId is required'),
    status: z.enum(STEP_STATUSES).optional(),
    decisionBranch: optionalNullableString,
    doctorNotes: optionalNullableString,
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.decisionBranch !== undefined ||
      data.doctorNotes !== undefined,
    { message: 'At least one field (status, decisionBranch, or doctorNotes) must be provided' }
  );

async function fetchClinicalCase(caseId: string) {
  return prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: {
        include: {
          user: { select: { fullName: true, email: true, phone: true } },
          medicalProfile: true,
        },
      },
      clinicalSteps: {
        orderBy: [
          { stageOrder: 'asc' },
          { stepOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      fitToFlyClearance: true,
    },
  });
}

export type ClinicalCaseRecord = NonNullable<Awaited<ReturnType<typeof fetchClinicalCase>>>;
export type DoctorProfileRecord = NonNullable<Awaited<ReturnType<typeof prisma.doctor.findUnique>>>;

export type CaseAccessResult =
  | { ok: true; targetCase: ClinicalCaseRecord; doctorProfile: DoctorProfileRecord | null }
  | { ok: false; code: string; message: string; status: number };

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

export interface ReplacePathwayParams {
  caseId: string;
  steps: unknown;
  caseStatus?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface UpdateStepParams {
  caseId: string;
  stepId: string;
  status?: unknown;
  decisionBranch?: unknown;
  doctorNotes?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

/**
 * Authorize object-level clinical access to a Case across ADMIN, assigned MANAGER,
 * treating DOCTOR (via non-cancelled Appointment), and owning PATIENT.
 */
export async function authorizeCaseClinicalAccess(
  caseId: string,
  actor: { userId: string; role: string }
): Promise<CaseAccessResult> {
  const targetCase = await fetchClinicalCase(caseId);
  if (!targetCase) {
    return {
      ok: false,
      code: ERROR_CODES.CASE_NOT_FOUND,
      message: 'Case not found',
      status: 404,
    };
  }

  if (actor.role === 'ADMIN') {
    return { ok: true, targetCase, doctorProfile: null };
  }

  if (actor.role === 'MANAGER') {
    const isAssigned =
      targetCase.managerId === actor.userId ||
      targetCase.patient.assignedManagerId === actor.userId;
    if (!isAssigned) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied for this clinical case',
        status: 403,
      };
    }
    return { ok: true, targetCase, doctorProfile: null };
  }

  if (actor.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: actor.userId },
    });
    if (!doctor || !doctor.isActive) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Active doctor profile required for clinical access',
        status: 403,
      };
    }

    const activeAppointment = await prisma.appointment.findFirst({
      where: {
        caseId,
        doctorId: doctor.id,
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    });
    if (!activeAppointment) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied: doctor has no active appointment for this case',
        status: 403,
      };
    }

    return { ok: true, targetCase, doctorProfile: doctor };
  }

  if (actor.role === 'PATIENT') {
    if (targetCase.patient.userId !== actor.userId) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied for this clinical case',
        status: 403,
      };
    }
    return { ok: true, targetCase, doctorProfile: null };
  }

  return {
    ok: false,
    code: ERROR_CODES.FORBIDDEN,
    message: 'Access denied for this clinical case',
    status: 403,
  };
}

/**
 * Retrieve a case's clinical pathway with ePHI-safe patient formatting for authorized viewers.
 */
export async function getCasePathwayForViewer(
  caseId: string,
  actor: { userId: string; role: string }
): Promise<ServiceResult<{ case: unknown }>> {
  const auth = await authorizeCaseClinicalAccess(caseId, actor);
  if (!auth.ok) return auth;

  const formattedCase = {
    ...auth.targetCase,
    patient: formatPatientForViewer(auth.targetCase.patient, { maskPassport: true }),
  };

  return { ok: true, data: { case: formattedCase } };
}

/**
 * Atomically replace all clinical pathway steps for an open case (ADMIN or assigned MANAGER only),
 * preserving actionType, requiredRole, and actionUrl metadata and recording an audit entry.
 */
export async function replaceCasePathway(
  params: ReplacePathwayParams
): Promise<ServiceResult<{ case: unknown }>> {
  if (params.actor.role !== 'ADMIN' && params.actor.role !== 'MANAGER') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only admins or assigned managers can configure a clinical pathway',
      status: 403,
    };
  }

  const auth = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!auth.ok) return auth;

  if (auth.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot modify pathway of a closed case',
      status: 400,
    };
  }

  const parsed = replacePathwaySchema.safeParse({
    steps: params.steps,
    caseStatus: params.caseStatus === '' ? undefined : params.caseStatus,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid pathway configuration',
      status: 400,
    };
  }

  const { steps: validatedSteps, caseStatus: validatedCaseStatus } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.clinicalStep.deleteMany({
      where: { caseId: params.caseId },
    });

    for (const step of validatedSteps) {
      await tx.clinicalStep.create({
        data: {
          caseId: params.caseId,
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
          completedAt:
            step.status === 'COMPLETED'
              ? step.completedAt
                ? new Date(step.completedAt)
                : new Date()
              : null,
        },
      });
    }

    if (validatedCaseStatus) {
      await tx.case.update({
        where: { id: params.caseId },
        data: { status: validatedCaseStatus as CaseStatus },
      });
    }
  });

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.CONFIGURE_PATHWAY,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: {
      stepCount: auth.targetCase.clinicalSteps.length,
      status: auth.targetCase.status,
    },
    newValue: {
      stepCount: validatedSteps.length,
      caseStatus: validatedCaseStatus ?? auth.targetCase.status,
    },
    ipAddress: params.actor.ipAddress,
  });

  const updatedCase = await fetchClinicalCase(params.caseId);
  const formattedCase = updatedCase
    ? {
        ...updatedCase,
        patient: updatedCase.patient
          ? formatPatientForViewer(updatedCase.patient, { maskPassport: true })
          : updatedCase.patient,
      }
    : null;

  return { ok: true, data: { case: formattedCase } };
}

/**
 * Update a single clinical pathway step without replacing sibling steps,
 * enforcing role boundaries between treating DOCTOR and assigned MANAGER.
 */
export async function updateSinglePathwayStep(
  params: UpdateStepParams
): Promise<ServiceResult<{ step: unknown }>> {
  if (!['ADMIN', 'MANAGER', 'DOCTOR'].includes(params.actor.role)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only clinical staff or admins can update pathway milestones',
      status: 403,
    };
  }

  const auth = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!auth.ok) return auth;

  if (auth.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot update pathway steps on a closed case',
      status: 400,
    };
  }

  const parsed = updateStepSchema.safeParse({
    stepId: params.stepId,
    status: params.status,
    decisionBranch: params.decisionBranch,
    doctorNotes: params.doctorNotes,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid step update payload',
      status: 400,
    };
  }

  const step = await prisma.clinicalStep.findUnique({
    where: { id: parsed.data.stepId },
  });
  if (!step || step.caseId !== params.caseId) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Clinical pathway step not found for this case',
      status: 404,
    };
  }

  if (params.actor.role === 'MANAGER' && step.requiredRole === 'DOCTOR') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the treating doctor or admin can sign off a doctor-required milestone',
      status: 403,
    };
  }

  if (
    params.actor.role === 'DOCTOR' &&
    (step.requiredRole === 'MANAGER' || step.requiredRole === 'PATIENT')
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Doctors cannot sign off coordinator or patient milestones',
      status: 403,
    };
  }

  const updateData: {
    status?: string;
    completedAt?: Date | null;
    decisionBranch?: string | null;
    doctorNotes?: string | null;
  } = {};

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    updateData.completedAt = parsed.data.status === 'COMPLETED' ? new Date() : null;
  }
  if (parsed.data.decisionBranch !== undefined) {
    updateData.decisionBranch = parsed.data.decisionBranch;
  }
  if (parsed.data.doctorNotes !== undefined) {
    updateData.doctorNotes = parsed.data.doctorNotes;
  }

  const updatedStep = await prisma.clinicalStep.update({
    where: { id: step.id },
    data: updateData,
  });

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE_PATHWAY_STEP,
    entityType: 'ClinicalStep',
    entityId: step.id,
    oldValue: {
      status: step.status,
      decisionBranch: step.decisionBranch,
      doctorNotes: step.doctorNotes,
    },
    newValue: {
      status: updatedStep.status,
      decisionBranch: updatedStep.decisionBranch,
      doctorNotes: updatedStep.doctorNotes,
    },
    ipAddress: params.actor.ipAddress,
  });

  return { ok: true, data: { step: updatedStep } };
}
