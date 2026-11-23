/**
 * Afzal Healthcare — Dual Patient & Case Onboarding Service
 * Transactional patient account + profile + initial case creation with ePHI encryption.
 */

import type { UrgencyLevel, UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/auth/crypto';
import { hashPassword } from '@/lib/auth/password';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS } from '@/lib/api/audit-logger';

export interface OnboardPatientInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  nationality: string;
  passportNo: string;
  dob: string;
  primaryLanguage?: string;
  medicalCondition?: string;
  urgencyLevel?: UrgencyLevel;
  assignedManagerId?: string | null;
  initialCaseNotes?: string;
}

export interface OnboardPatientMeta {
  actorId?: string;
  ipAddress?: string;
}

async function findActiveManager(managerId: string) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId, role: 'MANAGER', isActive: true },
    select: { id: true, fullName: true, role: true, isActive: true },
  });
  if (!manager || manager.role !== 'MANAGER' || !manager.isActive) {
    return null;
  }
  return manager;
}

async function resolveLeastLoadedManagerId(): Promise<string | null> {
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    select: {
      id: true,
      _count: {
        select: {
          managedCases: { where: { status: { not: 'CLOSED' } } },
        },
      },
    },
  });

  if (managers.length === 0) return null;

  const sorted = [...managers].sort(
    (a, b) => (a._count?.managedCases ?? 0) - (b._count?.managedCases ?? 0)
  );
  return sorted[0].id;
}

/**
 * Atomically create a PATIENT User, Patient record (with AES-256-GCM encrypted passportNo),
 * PatientMedicalProfile, initial Case (INQUIRY_RECEIVED), and AuditLog entry.
 */
export async function onboardPatient(
  input: OnboardPatientInput,
  meta?: OnboardPatientMeta
) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return {
      ok: false as const,
      code: ERROR_CODES.USER_ALREADY_EXISTS,
      message: 'Email already exists',
      status: 409,
    };
  }

  let resolvedManagerId: string | null = null;
  if (input.assignedManagerId === null) {
    resolvedManagerId = null;
  } else if (
    typeof input.assignedManagerId === 'string' &&
    input.assignedManagerId.trim() !== ''
  ) {
    const manager = await findActiveManager(input.assignedManagerId.trim());
    if (!manager) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Target manager not found or inactive',
        status: 400,
      };
    }
    resolvedManagerId = manager.id;
  } else {
    resolvedManagerId = await resolveLeastLoadedManagerId();
  }

  const passwordHash = await hashPassword(input.password);
  const encryptedPassport = encrypt(input.passportNo.trim());
  const urgencyLevel: UrgencyLevel = input.urgencyLevel || 'ROUTINE';
  const dobDate = new Date(input.dob);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        role: 'PATIENT',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    const patient = await tx.patient.create({
      data: {
        userId: user.id,
        nationality: input.nationality.trim(),
        passportNo: encryptedPassport,
        dob: dobDate,
        primaryLanguage: input.primaryLanguage?.trim() || null,
        medicalCondition: input.medicalCondition?.trim() || null,
        urgencyLevel,
        assignedManagerId: resolvedManagerId,
      },
    });

    const medicalProfile = await tx.patientMedicalProfile.create({
      data: {
        patientId: patient.id,
      },
    });

    const initialCase = await tx.case.create({
      data: {
        patientId: patient.id,
        managerId: resolvedManagerId,
        status: 'INQUIRY_RECEIVED',
        isUrgent: urgencyLevel === 'URGENT',
        notes:
          input.initialCaseNotes?.trim() ||
          input.medicalCondition?.trim() ||
          null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: meta?.actorId || user.id,
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'Patient',
        entityId: patient.id,
        newValue: {
          userId: user.id,
          email: user.email,
          assignedManagerId: resolvedManagerId,
          initialCaseId: initialCase.id,
        },
        ipAddress: meta?.ipAddress ?? null,
      },
    });

    if (resolvedManagerId) {
      await tx.notification.createMany({
        data: [
          {
            userId: resolvedManagerId,
            channel: 'IN_APP',
            title: 'New Patient Assigned',
            body: `${user.fullName} has been onboarded and assigned to you (Case #${initialCase.id.substring(0, 8)}).`,
            triggerEvent: 'CASE_CREATED',
          },
        ],
      });
    }

    return {
      ok: true as const,
      user,
      patient,
      medicalProfile,
      initialCase,
    };
  });
}

export interface CreateCaseForPatientInput {
  patientId: string;
  notes?: string;
  isUrgent?: boolean;
  managerId?: string | null;
  actorId: string;
  callerRole?: UserRole;
  ipAddress?: string;
}

/**
 * Create a new INQUIRY_RECEIVED Case for an existing Patient, keeping Patient.assignedManagerId
 * and all non-CLOSED Case.managerId fields strictly synchronized.
 */
export async function createCaseForPatient(input: CreateCaseForPatientInput) {
  let explicitManagerId: string | null | undefined = input.managerId;
  if (typeof input.managerId === 'string' && input.managerId.trim() !== '') {
    const manager = await findActiveManager(input.managerId.trim());
    if (!manager) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Target manager not found or inactive',
        status: 400,
      };
    }
    explicitManagerId = manager.id;
  } else if (input.managerId === '') {
    explicitManagerId = null;
  }

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true, userId: true, assignedManagerId: true },
    });

    if (!patient) {
      return {
        ok: false as const,
        code: ERROR_CODES.PATIENT_NOT_FOUND,
        message: 'Patient not found',
        status: 404,
      };
    }

    if (
      input.callerRole === 'MANAGER' &&
      patient.assignedManagerId &&
      patient.assignedManagerId !== input.actorId
    ) {
      return {
        ok: false as const,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Patient is assigned to another coordinator',
        status: 403,
      };
    }

    const resolvedManagerId =
      explicitManagerId !== undefined
        ? explicitManagerId
        : patient.assignedManagerId;

    if (resolvedManagerId !== patient.assignedManagerId) {
      await tx.patient.update({
        where: { id: patient.id },
        data: { assignedManagerId: resolvedManagerId ?? null },
      });

      await tx.case.updateMany({
        where: { patientId: patient.id, status: { not: 'CLOSED' } },
        data: { managerId: resolvedManagerId ?? null },
      });
    }

    const createdCase = await tx.case.create({
      data: {
        patientId: patient.id,
        managerId: resolvedManagerId ?? null,
        status: 'INQUIRY_RECEIVED',
        isUrgent: Boolean(input.isUrgent),
        notes: input.notes?.trim() || null,
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
        manager: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: AUDIT_ACTIONS.CREATE,
        entityType: 'Case',
        entityId: createdCase.id,
        newValue: {
          patientId: patient.id,
          managerId: resolvedManagerId ?? null,
          status: 'INQUIRY_RECEIVED',
          isUrgent: Boolean(input.isUrgent),
        },
        ipAddress: input.ipAddress ?? null,
      },
    });

    return {
      ok: true as const,
      case: createdCase,
    };
  });
}

