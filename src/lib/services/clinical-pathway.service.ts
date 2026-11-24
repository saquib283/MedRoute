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
import {
  formatPatientForViewer,
  formatTravelLogisticsForViewer,
} from '@/lib/services/phi.service';
import {
  CLEAN_PRESET_TEMPLATES,
  type PathwayPresetTemplate,
  type PresetStageStep,
} from '@/lib/validation/lifecycle-schemas';

export type { PresetStageStep, PathwayPresetTemplate };

export const PRESET_TEMPLATES: PathwayPresetTemplate[] = CLEAN_PRESET_TEMPLATES;

const STEP_CATEGORIES = ['PRE_OP', 'TREATMENT', 'POST_OP', 'DISCHARGE', 'REHAB'] as const;
const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ACTION_REQUIRED'] as const;
const REQUIRED_ROLES = ['PATIENT', 'DOCTOR', 'MANAGER', 'ADMIN'] as const;

const optionalNullableString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    return val && val.length > 0 ? val : null;
  });

const optionalRequiredRole = z
  .union([z.enum(REQUIRED_ROLES), z.literal('')])
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

const optionalCompletedAt = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (val instanceof Date) {
      if (Number.isNaN(val.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid completedAt date',
        });
        return z.NEVER;
      }
      return val;
    }
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsedDate = new Date(trimmed);
    if (Number.isNaN(parsedDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid completedAt date',
      });
      return z.NEVER;
    }
    return parsedDate;
  });

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
  completedAt: optionalCompletedAt,
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
      hospital: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          accreditation: true,
        },
      },
      primaryDoctor: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          qualification: true,
          specialisation: { select: { id: true, name: true } },
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

    const isPrimarySpecialist =
      'primaryDoctorId' in targetCase && targetCase.primaryDoctorId === doctor.id;

    if (!isPrimarySpecialist) {
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
          message:
            'Access denied: doctor is neither assigned primary specialist nor scheduled on this case',
          status: 403,
        };
      }
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
    ...(auth.targetCase.travelLogistics !== undefined
      ? {
          travelLogistics: formatTravelLogisticsForViewer(
            auth.targetCase.travelLogistics,
            { maskPassport: true }
          ),
        }
      : {}),
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
        ...(updatedCase.travelLogistics !== undefined
          ? {
              travelLogistics: formatTravelLogisticsForViewer(
                updatedCase.travelLogistics,
                { maskPassport: true }
              ),
            }
          : {}),
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

  if (params.actor.role === 'DOCTOR' && step.requiredRole && step.requiredRole !== 'DOCTOR') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: `Doctors cannot sign off milestones assigned to ${step.requiredRole}`,
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
