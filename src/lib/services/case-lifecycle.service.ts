/**
 * Afzal Healthcare — Unified MVT Case Lifecycle & Stage-Gate Service
 * Re-exports client-safe lifecycle schemas & pure helpers alongside server-side case lifecycle orchestration.
 */

import type { CaseStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/auth/crypto';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { ERROR_CODES } from '@/lib/api/errors';
import { FOLLOW_UP_MILESTONE_LABELS } from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import {
  formatPatientForViewer,
  formatTravelLogisticsForViewer,
  maskPassportNumber,
} from '@/lib/services/phi.service';
import {
  authorizeCaseClinicalAccess,
  type ClinicalCaseRecord,
  type ServiceResult,
} from '@/lib/services/clinical-pathway.service';
import {
  medicalAttendantSchema,
  treatmentPlanSchema,
  travelLogisticsSchema,
  fitToFlyChecklistSchema,
  followUpMilestoneSchema,
  assignClinicalTeamMutationSchema,
  publishTreatmentPlanMutationSchema,
  acceptTreatmentPlanMutationSchema,
  updateTravelLogisticsMutationSchema,
  recordFormCMutationSchema,
  submitFollowUpMutationSchema,
  lifecycleMutationSchema,
  CLEAN_PRESET_TEMPLATES,
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  computeFormCSlaStatus,
  validateFitToFlySafetyChecklist,
  canShowRoadmapCertificateDownload,
  derivePatientNextActions,
  type MedicalAttendantRecord,
  type TreatmentPlanPayload,
  type TravelLogisticsPayload,
  type FitToFlyChecklistPayload,
  type FollowUpMilestone,
  type LifecycleMutationInput,
  type PresetStageStep,
  type PathwayPresetTemplate,
  type ValidateCaseStatusTransitionParams,
  type FormCSlaStatus,
  type PatientDocumentSummary,
  type PatientNextActionContext,
  type PatientNextActionKey,
  type PatientNextActionItem,
} from '@/lib/validation/lifecycle-schemas';

export {
  medicalAttendantSchema,
  treatmentPlanSchema,
  travelLogisticsSchema,
  fitToFlyChecklistSchema,
  followUpMilestoneSchema,
  assignClinicalTeamMutationSchema,
  publishTreatmentPlanMutationSchema,
  acceptTreatmentPlanMutationSchema,
  updateTravelLogisticsMutationSchema,
  recordFormCMutationSchema,
  submitFollowUpMutationSchema,
  lifecycleMutationSchema,
  CLEAN_PRESET_TEMPLATES,
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  computeFormCSlaStatus,
  validateFitToFlySafetyChecklist,
  canShowRoadmapCertificateDownload,
  derivePatientNextActions,
  formatTravelLogisticsForViewer,
  type MedicalAttendantRecord,
  type TreatmentPlanPayload,
  type TravelLogisticsPayload,
  type FitToFlyChecklistPayload,
  type FollowUpMilestone,
  type LifecycleMutationInput,
  type PresetStageStep,
  type PathwayPresetTemplate,
  type ValidateCaseStatusTransitionParams,
  type FormCSlaStatus,
  type PatientDocumentSummary,
  type PatientNextActionContext,
  type PatientNextActionKey,
  type PatientNextActionItem,
};

export interface LifecycleActor {
  userId: string;
  role: string;
  ipAddress?: string;
}

export interface CaseLifecycleSnapshot {
  case: unknown;
  hospital: unknown | null;
  primaryDoctor: unknown | null;
  treatmentPlan: TreatmentPlanPayload | null;
  travelLogistics: TravelLogisticsPayload | null;
  postReturnFollowUps: FollowUpMilestone[];
  formCSlaStatus: FormCSlaStatus;
  unpaidBillCount: number;
  documents: unknown[];
  medicalBills: unknown[];
  hotelBookings: unknown[];
  availableHospitals?: unknown[];
  availableDoctors?: unknown[];
  nextActions: PatientNextActionItem[];
}

const HEX_SEGMENT_RE = /^[0-9a-fA-F]+$/;

function isEncryptedCiphertext(val: string): boolean {
  const parts = val.split(':');
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, cipherHex] = parts;
  return (
    ivHex.length === 24 &&
    authTagHex.length === 32 &&
    HEX_SEGMENT_RE.test(ivHex) &&
    HEX_SEGMENT_RE.test(authTagHex) &&
    cipherHex.length > 0 &&
    HEX_SEGMENT_RE.test(cipherHex)
  );
}

function isMaskedPassportValue(val: string): boolean {
  const trimmed = val.trim();
  return trimmed === '—' || /^\*+[A-Za-z0-9]{0,4}$/.test(trimmed);
}

function parseStoredTreatmentPlan(raw: unknown): TreatmentPlanPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as TreatmentPlanPayload;
}

function parseStoredTravelLogistics(raw: unknown): TravelLogisticsPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as TravelLogisticsPayload;
}

function parseStoredFollowUps(raw: unknown): FollowUpMilestone[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is FollowUpMilestone =>
      Boolean(entry) && typeof entry === 'object' && 'milestone' in entry
  );
}

function buildDefaultFollowUpMilestones(anchorDate: Date = new Date()): FollowUpMilestone[] {
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    {
      milestone: 'DAY_7',
      dueAt: new Date(anchorDate.getTime() + 7 * dayMs).toISOString(),
      status: 'PENDING',
    },
    {
      milestone: 'DAY_30',
      dueAt: new Date(anchorDate.getTime() + 30 * dayMs).toISOString(),
      status: 'PENDING',
    },
    {
      milestone: 'DAY_90',
      dueAt: new Date(anchorDate.getTime() + 90 * dayMs).toISOString(),
      status: 'PENDING',
    },
  ];
}

async function resolveFreshClinicalSteps(
  caseId: string,
  fallbackSteps: unknown[]
): Promise<unknown[]> {
  if (prisma.clinicalStep?.findMany) {
    const queried = await prisma.clinicalStep.findMany({
      where: { caseId },
      orderBy: [
        { stageOrder: 'asc' },
        { stepOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    if (Array.isArray(queried)) {
      return queried;
    }
  }
  return fallbackSteps;
}

async function fetchCaseSupportingContext(caseId: string, patientId: string): Promise<{
  documents: Array<PatientDocumentSummary & Record<string, unknown>>;
  unpaidBillCount: number;
  medicalBills: unknown[];
  hotelBookings: unknown[];
}> {
  const [documents, unpaidBillCount, medicalBills, hotelBookings] = await Promise.all([
    prisma.document?.findMany
      ? prisma.document.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.medicalBill?.count
      ? prisma.medicalBill.count({
          where: {
            caseId,
            status: { notIn: ['PAID', 'CANCELLED'] },
          },
        })
      : Promise.resolve(0),
    prisma.medicalBill?.findMany
      ? prisma.medicalBill.findMany({
          where: { caseId },
          include: {
            hospital: { select: { id: true, name: true, city: true } },
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.hotelBooking?.findMany
      ? prisma.hotelBooking.findMany({
          where: {
            OR: [{ caseId }, { patientId }],
          },
          include: {
            hotel: {
              select: {
                id: true,
                name: true,
                city: true,
                distanceKm: true,
                starRating: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  return {
    documents: Array.isArray(documents)
      ? (documents as unknown as Array<PatientDocumentSummary & Record<string, unknown>>)
      : [],
    unpaidBillCount: typeof unpaidBillCount === 'number' ? unpaidBillCount : 0,
    medicalBills: Array.isArray(medicalBills) ? medicalBills : [],
    hotelBookings: Array.isArray(hotelBookings) ? hotelBookings : [],
  };
}

async function fetchStaffClinicalDirectory(): Promise<{
  availableHospitals: unknown[];
  availableDoctors: unknown[];
}> {
  const [hospitals, doctors] = await Promise.all([
    prisma.hospital?.findMany
      ? prisma.hospital.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            city: true,
            accreditation: true,
          },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    prisma.doctor?.findMany
      ? prisma.doctor.findMany({
          where: { isActive: true },
          select: {
            id: true,
            fullName: true,
            hospitalId: true,
            qualification: true,
            specialisation: { select: { id: true, name: true } },
          },
          orderBy: { fullName: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return {
    availableHospitals: Array.isArray(hospitals) ? hospitals : [],
    availableDoctors: Array.isArray(doctors) ? doctors : [],
  };
}

async function buildLifecycleSnapshotFromCase(
  targetCase: ClinicalCaseRecord,
  overrides?: {
    status?: string;
    hospitalId?: string | null;
    primaryDoctorId?: string | null;
    notes?: string | null;
    hospital?: unknown | null;
    primaryDoctor?: unknown | null;
    clinicalSteps?: unknown[];
    treatmentPlan?: TreatmentPlanPayload | null;
    rawTravelLogistics?: TravelLogisticsPayload | null;
    postReturnFollowUps?: FollowUpMilestone[];
    passportExpiry?: Date | null;
    availableHospitals?: unknown[];
    availableDoctors?: unknown[];
  }
): Promise<CaseLifecycleSnapshot> {
  const { documents, unpaidBillCount, medicalBills, hotelBookings } =
    await fetchCaseSupportingContext(targetCase.id, targetCase.patientId);

  const effectiveStatus = overrides?.status ?? targetCase.status;
  const effectiveHospital =
    overrides?.hospital !== undefined ? overrides.hospital : (targetCase.hospital ?? null);
  const effectivePrimaryDoctor =
    overrides?.primaryDoctor !== undefined
      ? overrides.primaryDoctor
      : (targetCase.primaryDoctor ?? null);
  const effectiveClinicalSteps =
    overrides?.clinicalSteps !== undefined
      ? overrides.clinicalSteps
      : targetCase.clinicalSteps;
  const effectiveTreatmentPlan =
    overrides?.treatmentPlan !== undefined
      ? overrides.treatmentPlan
      : parseStoredTreatmentPlan(targetCase.treatmentPlan);
  const rawLogistics =
    overrides?.rawTravelLogistics !== undefined
      ? overrides.rawTravelLogistics
      : parseStoredTravelLogistics(targetCase.travelLogistics);
  const viewerTravelLogistics = formatTravelLogisticsForViewer(rawLogistics, {
    maskPassport: true,
  });
  const effectiveFollowUps =
    overrides?.postReturnFollowUps !== undefined
      ? overrides.postReturnFollowUps
      : parseStoredFollowUps(targetCase.postReturnFollowUps);
  const effectivePassportExpiry =
    overrides?.passportExpiry !== undefined
      ? overrides.passportExpiry
      : targetCase.patient.passportExpiry;

  const formCSlaStatus = computeFormCSlaStatus(
    rawLogistics?.arrivalAt ?? null,
    rawLogistics?.formCSubmittedAt ?? null
  );

  const nextActions = derivePatientNextActions({
    caseStatus: effectiveStatus,
    documents,
    treatmentPlan: effectiveTreatmentPlan,
    travelLogistics: viewerTravelLogistics,
    unpaidBillCount,
    postReturnFollowUps: effectiveFollowUps,
    passportExpiry: effectivePassportExpiry,
  });

  const formattedPatient = formatPatientForViewer(
    {
      ...targetCase.patient,
      passportExpiry: effectivePassportExpiry,
    },
    { maskPassport: true }
  );

  const formattedCase = {
    ...targetCase,
    status: effectiveStatus,
    ...(overrides?.hospitalId !== undefined ? { hospitalId: overrides.hospitalId } : {}),
    ...(overrides?.primaryDoctorId !== undefined
      ? { primaryDoctorId: overrides.primaryDoctorId }
      : {}),
    ...(overrides?.notes !== undefined ? { notes: overrides.notes } : {}),
    patient: formattedPatient,
    hospital: effectiveHospital,
    primaryDoctor: effectivePrimaryDoctor,
    clinicalSteps: effectiveClinicalSteps,
    treatmentPlan: effectiveTreatmentPlan,
    travelLogistics: viewerTravelLogistics,
    postReturnFollowUps: effectiveFollowUps,
  };

  return {
    case: formattedCase,
    hospital: effectiveHospital,
    primaryDoctor: effectivePrimaryDoctor,
    treatmentPlan: effectiveTreatmentPlan,
    travelLogistics: viewerTravelLogistics,
    postReturnFollowUps: effectiveFollowUps,
    formCSlaStatus,
    unpaidBillCount,
    documents,
    medicalBills,
    hotelBookings,
    ...(overrides?.availableHospitals !== undefined
      ? { availableHospitals: overrides.availableHospitals }
      : {}),
    ...(overrides?.availableDoctors !== undefined
      ? { availableDoctors: overrides.availableDoctors }
      : {}),
    nextActions,
  };
}

async function dispatchLifecycleNotifications(
  notifications: Array<{
    userId: string;
    channel: 'IN_APP';
    title: string;
    body: string;
    triggerEvent: string;
  }>
): Promise<void> {
  if (notifications.length === 0) return;
  try {
    if (prisma.notification?.createMany) {
      await prisma.notification.createMany({ data: notifications });
    }
  } catch (err) {
    console.error('[CaseLifecycle] Notification dispatch failed:', err);
  }
}

/**
 * Retrieve the unified MVT lifecycle snapshot for an authorized viewer (patient & attendant passports masked).
 */
export async function getCaseLifecycle(
  caseId: string,
  actor: LifecycleActor
): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  const access = await authorizeCaseClinicalAccess(caseId, actor);
  if (!access.ok) return access;

  const staffDir =
    actor.role === 'MANAGER' || actor.role === 'ADMIN'
      ? await fetchStaffClinicalDirectory()
      : undefined;

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, staffDir);
  return { ok: true, data: snapshot };
}

/**
 * Stage 1 -> Stage 2: Assign partner Hospital & Primary Attending Specialist (`MANAGER` | `ADMIN`).
 */
export async function assignCaseClinicalTeam(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (params.actor.role !== 'MANAGER' && params.actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only case coordinators or administrators can assign the clinical team',
      status: 403,
    };
  }

  const parsed = assignClinicalTeamMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid clinical team assignment payload',
      status: 400,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot modify clinical team on a closed case',
      status: 400,
    };
  }

  const [hospital, doctor] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: parsed.data.hospitalId } }),
    prisma.doctor.findUnique({
      where: { id: parsed.data.primaryDoctorId },
      include: { specialisation: { select: { id: true, name: true } } },
    }),
  ]);

  if (!hospital) {
    return {
      ok: false,
      code: ERROR_CODES.HOSPITAL_NOT_FOUND,
      message: 'Partner hospital not found',
      status: 404,
    };
  }
  if (!hospital.isActive) {
    return {
      ok: false,
      code: ERROR_CODES.HOSPITAL_INACTIVE,
      message: 'Selected partner hospital is inactive',
      status: 400,
    };
  }

  if (!doctor) {
    return {
      ok: false,
      code: ERROR_CODES.DOCTOR_NOT_FOUND,
      message: 'Primary attending specialist not found',
      status: 404,
    };
  }
  if (!doctor.isActive) {
    return {
      ok: false,
      code: ERROR_CODES.DOCTOR_INACTIVE,
      message: 'Selected attending specialist is inactive',
      status: 400,
    };
  }
  if (doctor.hospitalId && doctor.hospitalId !== hospital.id) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Selected specialist does not belong to the chosen partner hospital',
      status: 400,
    };
  }

  const nextStatus: CaseStatus =
    access.targetCase.status === 'INQUIRY_RECEIVED'
      ? 'UNDER_REVIEW'
      : access.targetCase.status;
  const updatedNotes =
    parsed.data.notes !== undefined
      ? parsed.data.notes.trim() || null
      : access.targetCase.notes;

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      hospitalId: hospital.id,
      primaryDoctorId: doctor.id,
      status: nextStatus,
      ...(parsed.data.notes !== undefined ? { notes: updatedNotes } : {}),
    },
  });

  let fallbackSteps: unknown[] = access.targetCase.clinicalSteps;

  if (
    parsed.data.specialtyId &&
    access.targetCase.clinicalSteps.every((s) => s.status !== 'COMPLETED')
  ) {
    const presetSteps = buildStandardMvtPathwaySteps(parsed.data.specialtyId);
    const stepRows = presetSteps.map((step) => ({
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
    }));

    await prisma.$transaction(async (tx) => {
      await tx.clinicalStep.deleteMany({ where: { caseId: params.caseId } });
      await tx.clinicalStep.createMany({ data: stepRows });
    });

    fallbackSteps = stepRows;
  } else if (prisma.clinicalStep?.updateMany) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'VOTE_MDT',
        status: 'PENDING',
      },
      data: { status: 'IN_PROGRESS' },
    });

    fallbackSteps = access.targetCase.clinicalSteps.map((step) =>
      step.actionType === 'VOTE_MDT' && step.status === 'PENDING'
        ? { ...step, status: 'IN_PROGRESS' }
        : step
    );
  }

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: {
      hospitalId: access.targetCase.hospitalId,
      primaryDoctorId: access.targetCase.primaryDoctorId,
      status: access.targetCase.status,
    },
    newValue: {
      lifecycleAction: 'ASSIGN_CLINICAL_TEAM',
      hospitalId: hospital.id,
      primaryDoctorId: doctor.id,
      status: nextStatus,
    },
    ipAddress: params.actor.ipAddress,
  });

  const doctorDisplay = formatDoctorDisplayName(doctor.fullName);
  const notifications: Array<{
    userId: string;
    channel: 'IN_APP';
    title: string;
    body: string;
    triggerEvent: string;
  }> = [];

  if (doctor.userId) {
    notifications.push({
      userId: doctor.userId,
      channel: 'IN_APP',
      title: 'Pre-Travel Clinical Review Assigned',
      body: `You have been assigned as primary specialist for ${access.targetCase.patient.user?.fullName || 'an international patient'} at ${hospital.name}.`,
      triggerEvent: 'CASE_STATUS_CHANGE',
    });
  }
  if (access.targetCase.patient.userId) {
    notifications.push({
      userId: access.targetCase.patient.userId,
      channel: 'IN_APP',
      title: 'Hospital & Attending Specialist Assigned',
      body: `${doctorDisplay} at ${hospital.name} is now reviewing your clinical case.`,
      triggerEvent: 'CASE_STATUS_CHANGE',
    });
  }
  await dispatchLifecycleNotifications(notifications);

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    status: nextStatus,
    hospitalId: hospital.id,
    primaryDoctorId: doctor.id,
    notes: updatedNotes,
    clinicalSteps: freshClinicalSteps,
    hospital: {
      id: hospital.id,
      name: hospital.name,
      city: hospital.city,
      address: hospital.address,
      accreditation: hospital.accreditation,
    },
    primaryDoctor: {
      id: doctor.id,
      userId: doctor.userId,
      fullName: doctor.fullName,
      qualification: doctor.qualification,
      specialisation: doctor.specialisation ?? null,
    },
  });

  return { ok: true, data: snapshot };
}

/**
 * Stage 2: Publish Structured Treatment Plan & All-In Financial Quote (`MANAGER` | `DOCTOR` | `ADMIN`).
 */
export async function publishCaseTreatmentPlan(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (!['MANAGER', 'DOCTOR', 'ADMIN'].includes(params.actor.role)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only clinical staff or administrators can publish a treatment plan',
      status: 403,
    };
  }

  const parsed = publishTreatmentPlanMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid treatment plan payload',
      status: 400,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot publish a treatment plan on a closed case',
      status: 400,
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const treatmentPlan: TreatmentPlanPayload = {
    diagnosis: parsed.data.diagnosis,
    procedureName: parsed.data.procedureName,
    specialty: parsed.data.specialty ?? null,
    hospitalLosDays: parsed.data.hospitalLosDays,
    recoveryStayDays: parsed.data.recoveryStayDays,
    estimatedCostUsd: parsed.data.estimatedCostUsd,
    depositRequiredUsd: parsed.data.depositRequiredUsd ?? null,
    currency: parsed.data.currency || 'USD',
    inclusions: parsed.data.inclusions ?? [],
    exclusions: parsed.data.exclusions ?? [],
    doctorOpinionNotes: parsed.data.doctorOpinionNotes ?? null,
    publishedAt: nowIso,
    publishedBy: params.actor.userId,
    consentAcceptedAt: null,
    consentAcceptedBy: null,
  };

  // Publishing or revising a treatment plan resets consentAcceptedAt to null,
  // so a previously PLAN_CONFIRMED pre-arrival case reverts to UNDER_REVIEW until re-accepted.
  const nextStatus: CaseStatus =
    access.targetCase.status === 'INQUIRY_RECEIVED' ||
    access.targetCase.status === 'PLAN_CONFIRMED'
      ? 'UNDER_REVIEW'
      : access.targetCase.status;

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      treatmentPlan: treatmentPlan as unknown as Prisma.InputJsonValue,
      status: nextStatus,
    },
  });

  const completeMdt = Boolean(
    params.actor.role === 'DOCTOR' || parsed.data.doctorOpinionNotes
  );

  if (prisma.clinicalStep?.updateMany) {
    if (completeMdt) {
      await prisma.clinicalStep.updateMany({
        where: {
          caseId: params.caseId,
          actionType: 'VOTE_MDT',
          status: { not: 'COMPLETED' },
        },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          ...(parsed.data.doctorOpinionNotes
            ? { doctorNotes: parsed.data.doctorOpinionNotes }
            : {}),
        },
      });
    }

    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'ISSUE_PROFORMA',
      },
      data: {
        status: 'ACTION_REQUIRED',
        completedAt: null,
      },
    });
  }

  const fallbackSteps = access.targetCase.clinicalSteps.map((step) => {
    if (completeMdt && step.actionType === 'VOTE_MDT' && step.status !== 'COMPLETED') {
      return {
        ...step,
        status: 'COMPLETED',
        completedAt: now,
        ...(parsed.data.doctorOpinionNotes
          ? { doctorNotes: parsed.data.doctorOpinionNotes }
          : {}),
      };
    }
    if (step.actionType === 'ISSUE_PROFORMA') {
      return {
        ...step,
        status: 'ACTION_REQUIRED',
        completedAt: null,
      };
    }
    return step;
  });

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: {
      status: access.targetCase.status,
      treatmentPlan: access.targetCase.treatmentPlan,
    },
    newValue: {
      lifecycleAction: 'PUBLISH_TREATMENT_PLAN',
      status: nextStatus,
      diagnosis: treatmentPlan.diagnosis,
      procedureName: treatmentPlan.procedureName,
      estimatedCostUsd: treatmentPlan.estimatedCostUsd,
      currency: treatmentPlan.currency,
    },
    ipAddress: params.actor.ipAddress,
  });

  if (access.targetCase.patient.userId) {
    await dispatchLifecycleNotifications([
      {
        userId: access.targetCase.patient.userId,
        channel: 'IN_APP',
        title: 'Treatment Plan & Cost Estimate Ready',
        body: `Your hospital treatment plan (${treatmentPlan.procedureName}) and all-in quote (${treatmentPlan.currency} ${treatmentPlan.estimatedCostUsd.toLocaleString()}) are ready for your review and consent.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      },
    ]);
  }

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    status: nextStatus,
    clinicalSteps: freshClinicalSteps,
    treatmentPlan,
  });

  return { ok: true, data: snapshot };
}

/**
 * Stage 2 -> Stage 3: Patient Accepts Informed Pre-Travel Treatment Plan & Cost Estimate (`PATIENT`).
 */
export async function acceptCaseTreatmentPlan(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (params.actor.role !== 'PATIENT') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the patient can provide informed consent for a treatment plan',
      status: 403,
    };
  }

  const parsed = acceptTreatmentPlanMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid treatment plan consent payload',
      status: 400,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot accept treatment plan on a closed case',
      status: 400,
    };
  }

  const existingPlan = parseStoredTreatmentPlan(access.targetCase.treatmentPlan);
  if (!existingPlan || !existingPlan.procedureName) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'No published treatment plan is available for acceptance on this case',
      status: 400,
    };
  }

  const now = new Date();
  const consentAcceptedAt = now.toISOString();
  const updatedPlan: TreatmentPlanPayload = {
    ...existingPlan,
    consentAcceptedAt,
    consentAcceptedBy: params.actor.userId,
  };

  const preConfirmStatuses = new Set<string>([
    'INQUIRY_RECEIVED',
    'UNDER_REVIEW',
    'PRE_OP_CLEARANCE',
  ]);
  const nextStatus: CaseStatus = preConfirmStatuses.has(access.targetCase.status)
    ? 'PLAN_CONFIRMED'
    : access.targetCase.status;

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      treatmentPlan: updatedPlan as unknown as Prisma.InputJsonValue,
      status: nextStatus,
    },
  });

  if (prisma.clinicalStep?.updateMany) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'ISSUE_PROFORMA',
        status: { not: 'COMPLETED' },
      },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
    });
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'ISSUE_VIL',
        status: 'PENDING',
      },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  const fallbackSteps = access.targetCase.clinicalSteps.map((step) => {
    if (step.actionType === 'ISSUE_PROFORMA' && step.status !== 'COMPLETED') {
      return { ...step, status: 'COMPLETED', completedAt: now };
    }
    if (step.actionType === 'ISSUE_VIL' && step.status === 'PENDING') {
      return { ...step, status: 'IN_PROGRESS' };
    }
    return step;
  });

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: {
      status: access.targetCase.status,
      consentAcceptedAt: existingPlan.consentAcceptedAt ?? null,
    },
    newValue: {
      lifecycleAction: 'ACCEPT_TREATMENT_PLAN',
      status: nextStatus,
      consentAcceptedAt,
      patientNotes: parsed.data.patientNotes?.trim() || null,
    },
    ipAddress: params.actor.ipAddress,
  });

  const notifications: Array<{
    userId: string;
    channel: 'IN_APP';
    title: string;
    body: string;
    triggerEvent: string;
  }> = [];

  const patientName = access.targetCase.patient.user?.fullName || 'Patient';
  if (access.targetCase.managerId) {
    notifications.push({
      userId: access.targetCase.managerId,
      channel: 'IN_APP',
      title: 'Patient Accepted Treatment Plan',
      body: `${patientName} accepted the treatment plan (${updatedPlan.procedureName}). Please proceed with Visa Invitation Letter (VIL) sponsorship.`,
      triggerEvent: 'CASE_STATUS_CHANGE',
    });
  }
  if (access.targetCase.primaryDoctor?.userId) {
    notifications.push({
      userId: access.targetCase.primaryDoctor.userId,
      channel: 'IN_APP',
      title: 'Pre-Travel Treatment Plan Consented',
      body: `${patientName} confirmed informed consent for ${updatedPlan.procedureName}.`,
      triggerEvent: 'CASE_STATUS_CHANGE',
    });
  }
  await dispatchLifecycleNotifications(notifications);

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    status: nextStatus,
    clinicalSteps: freshClinicalSteps,
    treatmentPlan: updatedPlan,
  });

  return { ok: true, data: snapshot };
}

/**
 * Stage 3: Update `MED-X` Medical Attendants (encrypted at rest) & Flight/Airport Concierge Logistics
 * (`PATIENT` | `MANAGER` | `ADMIN`).
 */
export async function updateCaseTravelLogistics(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (!['PATIENT', 'MANAGER', 'ADMIN'].includes(params.actor.role)) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the patient, coordinator, or admin can update travel logistics',
      status: 403,
    };
  }

  const parsed = updateTravelLogisticsMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid travel logistics payload',
      status: 400,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot update travel logistics on a closed case',
      status: 400,
    };
  }

  const existingLogistics = parseStoredTravelLogistics(access.targetCase.travelLogistics) ?? {};
  const existingAttendants = Array.isArray(existingLogistics.attendants)
    ? existingLogistics.attendants
    : [];

  let encryptedAttendants: MedicalAttendantRecord[] | undefined = undefined;
  if (parsed.data.attendants !== undefined) {
    encryptedAttendants = [];
    for (let i = 0; i < parsed.data.attendants.length; i += 1) {
      const incoming = parsed.data.attendants[i];
      const rawPassport = incoming.passportNo.trim();

      let storedPassport: string;
      if (rawPassport.includes(':') || isEncryptedCiphertext(rawPassport)) {
        const belongsToCurrentCase =
          isEncryptedCiphertext(rawPassport) &&
          existingAttendants.some((ex) => ex.passportNo === rawPassport);
        if (!belongsToCurrentCase) {
          return {
            ok: false,
            code: ERROR_CODES.BAD_REQUEST,
            message: 'Invalid attendant passport number',
            status: 400,
          };
        }
        storedPassport = rawPassport;
      } else if (isMaskedPassportValue(rawPassport)) {
        const matchedExisting =
          existingAttendants.find(
            (ex) =>
              ex.fullName.trim().toLowerCase() === incoming.fullName.trim().toLowerCase() &&
              maskPassportNumber(ex.passportNo) === rawPassport
          ) ||
          (existingAttendants[i] &&
          maskPassportNumber(existingAttendants[i].passportNo) === rawPassport
            ? existingAttendants[i]
            : undefined);

        if (!matchedExisting) {
          return {
            ok: false,
            code: ERROR_CODES.BAD_REQUEST,
            message:
              'Please enter the full unmasked passport number when adding or changing a MED-X attendant',
            status: 400,
          };
        }
        storedPassport = matchedExisting.passportNo;
      } else {
        storedPassport = encrypt(rawPassport);
      }

      encryptedAttendants.push({
        fullName: incoming.fullName.trim(),
        passportNo: storedPassport,
        relation: incoming.relation.trim(),
      });
    }
  }

  let updatedPassportExpiry: Date | null | undefined = undefined;
  if (parsed.data.passportExpiry !== undefined) {
    updatedPassportExpiry = parsed.data.passportExpiry
      ? new Date(parsed.data.passportExpiry)
      : null;
    if (prisma.patient?.update) {
      await prisma.patient.update({
        where: { id: access.targetCase.patientId },
        data: { passportExpiry: updatedPassportExpiry },
      });
    }
  }

  const isStaff = params.actor.role === 'MANAGER' || params.actor.role === 'ADMIN';
  const now = new Date();

  const mergedLogistics: TravelLogisticsPayload = {
    ...existingLogistics,
    ...(encryptedAttendants !== undefined ? { attendants: encryptedAttendants } : {}),
    ...(parsed.data.arrivalAirline !== undefined
      ? { arrivalAirline: parsed.data.arrivalAirline?.trim() || null }
      : {}),
    ...(parsed.data.arrivalFlightNo !== undefined
      ? { arrivalFlightNo: parsed.data.arrivalFlightNo?.trim() || null }
      : {}),
    ...(parsed.data.arrivalAt !== undefined ? { arrivalAt: parsed.data.arrivalAt } : {}),
    ...(parsed.data.arrivalAirport !== undefined
      ? { arrivalAirport: parsed.data.arrivalAirport?.trim() || null }
      : {}),
    ...(parsed.data.airportPickupRequired !== undefined
      ? { airportPickupRequired: parsed.data.airportPickupRequired }
      : {}),
    ...(isStaff && parsed.data.pickupConfirmed !== undefined
      ? { pickupConfirmed: parsed.data.pickupConfirmed }
      : {}),
    ...(isStaff && parsed.data.pickupDriverNotes !== undefined
      ? { pickupDriverNotes: parsed.data.pickupDriverNotes?.trim() || null }
      : {}),
    ...(parsed.data.wheelchairSsrCode !== undefined
      ? { wheelchairSsrCode: parsed.data.wheelchairSsrCode }
      : {}),
    ...(parsed.data.dietaryPreferences !== undefined
      ? { dietaryPreferences: parsed.data.dietaryPreferences?.trim() || null }
      : {}),
    ...(parsed.data.departureAirline !== undefined
      ? { departureAirline: parsed.data.departureAirline?.trim() || null }
      : {}),
    ...(parsed.data.departureFlightNo !== undefined
      ? { departureFlightNo: parsed.data.departureFlightNo?.trim() || null }
      : {}),
    ...(parsed.data.departureAt !== undefined ? { departureAt: parsed.data.departureAt } : {}),
    ...(parsed.data.visaNumber !== undefined
      ? { visaNumber: parsed.data.visaNumber?.trim() || null }
      : {}),
    ...(parsed.data.visaExpiryDate !== undefined
      ? { visaExpiryDate: parsed.data.visaExpiryDate }
      : {}),
    updatedAt: now.toISOString(),
  };

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      travelLogistics: mergedLogistics as unknown as Prisma.InputJsonValue,
    },
  });

  if (prisma.clinicalStep?.updateMany) {
    if (mergedLogistics.pickupConfirmed === true) {
      await prisma.clinicalStep.updateMany({
        where: {
          caseId: params.caseId,
          actionType: 'ARRANGE_LOGISTICS',
          status: { not: 'COMPLETED' },
        },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      });
    } else if (mergedLogistics.arrivalFlightNo && mergedLogistics.arrivalAt) {
      await prisma.clinicalStep.updateMany({
        where: {
          caseId: params.caseId,
          actionType: 'ARRANGE_LOGISTICS',
          status: 'PENDING',
        },
        data: {
          status: 'IN_PROGRESS',
        },
      });
    }
  }

  const fallbackSteps = access.targetCase.clinicalSteps.map((step) => {
    if (step.actionType !== 'ARRANGE_LOGISTICS') return step;
    if (mergedLogistics.pickupConfirmed === true && step.status !== 'COMPLETED') {
      return { ...step, status: 'COMPLETED', completedAt: now };
    }
    if (
      mergedLogistics.arrivalFlightNo &&
      mergedLogistics.arrivalAt &&
      step.status === 'PENDING'
    ) {
      return { ...step, status: 'IN_PROGRESS' };
    }
    return step;
  });

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: formatTravelLogisticsForViewer(existingLogistics, { maskPassport: true }),
    newValue: {
      lifecycleAction: 'UPDATE_TRAVEL_LOGISTICS',
      travelLogistics: formatTravelLogisticsForViewer(mergedLogistics, { maskPassport: true }),
    },
    ipAddress: params.actor.ipAddress,
  });

  if (params.actor.role === 'PATIENT' && access.targetCase.managerId) {
    await dispatchLifecycleNotifications([
      {
        userId: access.targetCase.managerId,
        channel: 'IN_APP',
        title: 'Patient Travel & MED-X Details Updated',
        body: `${access.targetCase.patient.user?.fullName || 'Patient'} updated their flight itinerary and MED-X companion details.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      },
    ]);
  } else if (
    isStaff &&
    parsed.data.pickupConfirmed === true &&
    existingLogistics.pickupConfirmed !== true &&
    access.targetCase.patient.userId
  ) {
    await dispatchLifecycleNotifications([
      {
        userId: access.targetCase.patient.userId,
        channel: 'IN_APP',
        title: 'Airport Concierge Pickup Confirmed',
        body: `Your hospital airport transfer has been confirmed${mergedLogistics.arrivalFlightNo ? ` for flight ${mergedLogistics.arrivalFlightNo}` : ''}.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      },
    ]);
  }

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    clinicalSteps: freshClinicalSteps,
    rawTravelLogistics: mergedLogistics,
    ...(updatedPassportExpiry !== undefined ? { passportExpiry: updatedPassportExpiry } : {}),
  });

  return { ok: true, data: snapshot };
}

/**
 * Stage 4: Record Statutory 24-Hour Bureau of Immigration / FRRO Form C Submission (`MANAGER` | `ADMIN`).
 */
export async function recordCaseFormC(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (params.actor.role !== 'MANAGER' && params.actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only case coordinators or administrators can record statutory Form C filings',
      status: 403,
    };
  }

  const parsed = recordFormCMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid Form C compliance payload',
      status: 400,
    };
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot record Form C on a closed case',
      status: 400,
    };
  }

  const now = new Date();
  const existingLogistics = parseStoredTravelLogistics(access.targetCase.travelLogistics) ?? {};
  const submittedIso = parsed.data.formCSubmittedAt
    ? new Date(parsed.data.formCSubmittedAt).toISOString()
    : now.toISOString();

  const mergedLogistics: TravelLogisticsPayload = {
    ...existingLogistics,
    formCSubmittedAt: submittedIso,
    ...(parsed.data.frroNumber !== undefined
      ? { frroNumber: parsed.data.frroNumber || null }
      : {}),
    ...(parsed.data.visaExpiryDate !== undefined
      ? { visaExpiryDate: parsed.data.visaExpiryDate }
      : {}),
    updatedAt: now.toISOString(),
  };

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      travelLogistics: mergedLogistics as unknown as Prisma.InputJsonValue,
    },
  });

  if (prisma.clinicalStep?.updateMany) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'RECORD_FORM_C',
        status: { not: 'COMPLETED' },
      },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
    });
  }

  const fallbackSteps = access.targetCase.clinicalSteps.map((step) =>
    step.actionType === 'RECORD_FORM_C' && step.status !== 'COMPLETED'
      ? { ...step, status: 'COMPLETED', completedAt: now }
      : step
  );

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  const formCSlaStatus = computeFormCSlaStatus(
    mergedLogistics.arrivalAt ?? null,
    submittedIso
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: {
      formCSubmittedAt: existingLogistics.formCSubmittedAt ?? null,
      frroNumber: existingLogistics.frroNumber ?? null,
    },
    newValue: {
      lifecycleAction: 'RECORD_FORM_C',
      formCSubmittedAt: submittedIso,
      frroNumber: mergedLogistics.frroNumber ?? null,
      visaExpiryDate: mergedLogistics.visaExpiryDate ?? null,
      formCSlaStatus,
    },
    ipAddress: params.actor.ipAddress,
  });

  if (access.targetCase.patient.userId) {
    await dispatchLifecycleNotifications([
      {
        userId: access.targetCase.patient.userId,
        channel: 'IN_APP',
        title: 'FRRO Form C Compliance Recorded',
        body: `Your statutory arrival Form C registration${mergedLogistics.frroNumber ? ` (Ref: ${mergedLogistics.frroNumber})` : ''} has been logged.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      },
    ]);
  }

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    clinicalSteps: freshClinicalSteps,
    rawTravelLogistics: mergedLogistics,
  });

  return { ok: true, data: snapshot };
}

/**
 * Stage 7: Submit or Review Post-Return Day-7 / Day-30 / Day-90 Recovery Check-Ins (`PATIENT` | `DOCTOR`).
 */
export async function submitCaseFollowUpCheckIn(params: {
  caseId: string;
  payload: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (params.actor.role !== 'PATIENT' && params.actor.role !== 'DOCTOR') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only the patient or treating specialist can submit or review recovery follow-ups',
      status: 403,
    };
  }

  const parsed = submitFollowUpMutationSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid follow-up check-in payload',
      status: 400,
    };
  }

  if (params.actor.role === 'PATIENT') {
    const hasPatientInput =
      parsed.data.painScore !== undefined ||
      Boolean(parsed.data.woundStatus?.trim()) ||
      Boolean(parsed.data.patientNotes?.trim());
    if (!hasPatientInput) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Please provide pain score, wound status, or recovery notes',
        status: 400,
      };
    }
  } else {
    if (!parsed.data.doctorFeedback || !parsed.data.doctorFeedback.trim()) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Clinical specialist feedback is required when reviewing a follow-up check-in',
        status: 400,
      };
    }
  }

  const access = await authorizeCaseClinicalAccess(params.caseId, params.actor);
  if (!access.ok) return access;

  if (access.targetCase.status === 'CLOSED') {
    return {
      ok: false,
      code: ERROR_CODES.CASE_ALREADY_CLOSED,
      message: 'Cannot submit follow-up check-ins on a closed case',
      status: 400,
    };
  }

  const existingList = parseStoredFollowUps(access.targetCase.postReturnFollowUps);
  const milestones: FollowUpMilestone[] =
    existingList.length > 0 ? [...existingList] : buildDefaultFollowUpMilestones();

  const now = new Date();
  const nowIso = now.toISOString();
  const targetIdx = milestones.findIndex((m) => m.milestone === parsed.data.milestone);
  const previousEntry: FollowUpMilestone =
    targetIdx >= 0
      ? milestones[targetIdx]
      : {
          milestone: parsed.data.milestone,
          dueAt: nowIso,
          status: 'PENDING',
        };

  const updatedEntry: FollowUpMilestone =
    params.actor.role === 'PATIENT'
      ? {
          ...previousEntry,
          status: 'SUBMITTED',
          ...(parsed.data.painScore !== undefined ? { painScore: parsed.data.painScore } : {}),
          ...(parsed.data.woundStatus !== undefined
            ? { woundStatus: parsed.data.woundStatus.trim() }
            : {}),
          ...(parsed.data.patientNotes !== undefined
            ? { patientNotes: parsed.data.patientNotes.trim() }
            : {}),
          updatedAt: nowIso,
        }
      : {
          ...previousEntry,
          status: 'REVIEWED',
          doctorFeedback: parsed.data.doctorFeedback!.trim(),
          updatedAt: nowIso,
        };

  if (targetIdx >= 0) {
    milestones[targetIdx] = updatedEntry;
  } else {
    milestones.push(updatedEntry);
  }

  const nextStatus: CaseStatus =
    params.actor.role === 'PATIENT' && access.targetCase.status === 'FIT_TO_FLY_CLEARED'
      ? 'REMOTE_REHAB'
      : access.targetCase.status;

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      postReturnFollowUps: milestones as unknown as Prisma.InputJsonValue,
      ...(nextStatus !== access.targetCase.status ? { status: nextStatus } : {}),
    },
  });

  const allReviewed =
    milestones.length >= 3 && milestones.every((m) => m.status === 'REVIEWED');

  if (prisma.clinicalStep?.updateMany) {
    await prisma.clinicalStep.updateMany({
      where: {
        caseId: params.caseId,
        actionType: 'SCHEDULE_TELE_REHAB',
        status: { not: 'COMPLETED' },
      },
      data: {
        status: allReviewed ? 'COMPLETED' : 'IN_PROGRESS',
        ...(allReviewed ? { completedAt: now } : {}),
      },
    });
  }

  const fallbackSteps = access.targetCase.clinicalSteps.map((step) =>
    step.actionType === 'SCHEDULE_TELE_REHAB' && step.status !== 'COMPLETED'
      ? {
          ...step,
          status: allReviewed ? 'COMPLETED' : 'IN_PROGRESS',
          ...(allReviewed ? { completedAt: now } : {}),
        }
      : step
  );

  const freshClinicalSteps = await resolveFreshClinicalSteps(
    params.caseId,
    fallbackSteps
  );

  await createAuditLog({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Case',
    entityId: params.caseId,
    oldValue: previousEntry,
    newValue: {
      lifecycleAction: 'SUBMIT_FOLLOW_UP',
      milestone: updatedEntry.milestone,
      status: updatedEntry.status,
      caseStatus: nextStatus,
    },
    ipAddress: params.actor.ipAddress,
  });

  const milestoneLabel =
    FOLLOW_UP_MILESTONE_LABELS[parsed.data.milestone] || parsed.data.milestone;
  if (params.actor.role === 'PATIENT') {
    const recipients: Array<{
      userId: string;
      channel: 'IN_APP';
      title: string;
      body: string;
      triggerEvent: string;
    }> = [];
    const patientName = access.targetCase.patient.user?.fullName || 'Patient';
    if (access.targetCase.primaryDoctor?.userId) {
      recipients.push({
        userId: access.targetCase.primaryDoctor.userId,
        channel: 'IN_APP',
        title: `${milestoneLabel} Submitted`,
        body: `${patientName} submitted their ${milestoneLabel} recovery update for clinical review.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      });
    }
    if (access.targetCase.managerId) {
      recipients.push({
        userId: access.targetCase.managerId,
        channel: 'IN_APP',
        title: `${milestoneLabel} Logged`,
        body: `${patientName} completed their ${milestoneLabel}.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      });
    }
    await dispatchLifecycleNotifications(recipients);
  } else if (access.targetCase.patient.userId) {
    await dispatchLifecycleNotifications([
      {
        userId: access.targetCase.patient.userId,
        channel: 'IN_APP',
        title: `Specialist Reviewed ${milestoneLabel}`,
        body: `Your treating specialist added clinical guidance to your ${milestoneLabel}.`,
        triggerEvent: 'CASE_STATUS_CHANGE',
      },
    ]);
  }

  const snapshot = await buildLifecycleSnapshotFromCase(access.targetCase, {
    status: nextStatus,
    clinicalSteps: freshClinicalSteps,
    postReturnFollowUps: milestones,
  });

  return { ok: true, data: snapshot };
}

/**
 * Unified discriminated dispatcher for `PUT /api/v1/cases/[id]/lifecycle`.
 */
export async function executeCaseLifecycleMutation(params: {
  caseId: string;
  body: unknown;
  actor: LifecycleActor;
}): Promise<ServiceResult<CaseLifecycleSnapshot>> {
  if (!params.body || typeof params.body !== 'object' || Array.isArray(params.body)) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Invalid lifecycle mutation payload',
      status: 400,
    };
  }

  const action = (params.body as { action?: unknown }).action;

  switch (action) {
    case 'ASSIGN_CLINICAL_TEAM':
      return assignCaseClinicalTeam({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    case 'PUBLISH_TREATMENT_PLAN':
      return publishCaseTreatmentPlan({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    case 'ACCEPT_TREATMENT_PLAN':
      return acceptCaseTreatmentPlan({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    case 'UPDATE_TRAVEL_LOGISTICS':
      return updateCaseTravelLogistics({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    case 'RECORD_FORM_C':
      return recordCaseFormC({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    case 'SUBMIT_FOLLOW_UP':
      return submitCaseFollowUpCheckIn({
        caseId: params.caseId,
        payload: params.body,
        actor: params.actor,
      });
    default: {
      const parsed = lifecycleMutationSchema.safeParse(params.body);
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: parsed.success
          ? 'Unsupported lifecycle action'
          : parsed.error.issues[0]?.message || 'Invalid lifecycle mutation action',
        status: 400,
      };
    }
  }
}
