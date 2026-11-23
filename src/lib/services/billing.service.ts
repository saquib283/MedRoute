/**
 * Afzal Healthcare — Medical Billing & Dual Settlement Service
 * Handles manager billing metadata, status derivation, manager/admin invoice updates,
 * patient balance payments, and automatic SETTLE_BILL clinical pathway completion.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import type { ServiceResult } from '@/lib/services/clinical-pathway.service';

export const BILL_STATUSES = [
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;

export const PATIENT_PAYMENT_METHODS = [
  'CARD',
  'WIRE_TRANSFER',
  'INSURANCE_DIRECT',
] as const;

export interface UpdateMedicalBillParams {
  billId: unknown;
  paymentAmount?: unknown;
  paidAmount?: unknown;
  status?: unknown;
  dueDate?: unknown;
  notes?: unknown;
  hospitalId?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface PayPatientBillParams {
  billId: unknown;
  amount: unknown;
  paymentMethod: unknown;
  referenceNo?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

interface BillingTxClient {
  medicalBill: {
    count: (args: Prisma.MedicalBillCountArgs) => Promise<number>;
  };
  clinicalStep: {
    updateMany: (args: Prisma.ClinicalStepUpdateManyArgs) => Promise<unknown>;
  };
}

const optionalNullableString = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return val.length > 0 ? val : null;
  });

const optionalNullableId = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return val.length > 0 ? val : null;
  });

const optionalNullableDate = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (val instanceof Date) {
      if (Number.isNaN(val.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid dueDate' });
        return z.NEVER;
      }
      return val;
    }
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid dueDate' });
      return z.NEVER;
    }
    return parsed;
  });

const updateMedicalBillSchema = z.object({
  billId: z.string().trim().min(1, 'billId is required'),
  paymentAmount: z.number().positive().optional(),
  paidAmount: z.number().min(0).optional(),
  status: z.enum(BILL_STATUSES).optional(),
  dueDate: optionalNullableDate,
  notes: optionalNullableString,
  hospitalId: optionalNullableId,
});

const payPatientBillSchema = z.object({
  billId: z.string().trim().min(1, 'billId is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(PATIENT_PAYMENT_METHODS),
  referenceNo: z.string().trim().max(120).optional(),
});

/**
 * Derive consistent MedicalBill status from totalAmount, paidAmount, and optional requestedStatus.
 */
export function deriveBillStatus(
  totalAmount: number,
  paidAmount: number,
  requestedStatus?: string
): string {
  if (requestedStatus === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 'PAID';
  }
  if (paidAmount > 0 && paidAmount < totalAmount) {
    return requestedStatus === 'OVERDUE' ? 'OVERDUE' : 'PARTIALLY_PAID';
  }
  return requestedStatus === 'OVERDUE' ? 'OVERDUE' : 'PENDING';
}

/**
 * Auto-complete pending SETTLE_BILL clinical pathway steps when all non-cancelled bills on a case are PAID.
 */
export async function syncCaseSettleBillSteps(
  tx: BillingTxClient,
  caseId: string
): Promise<void> {
  const unpaidCount = await tx.medicalBill.count({
    where: {
      caseId,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  });

  if (unpaidCount !== 0) {
    return;
  }

  const paidCount = await tx.medicalBill.count({
    where: {
      caseId,
      status: 'PAID',
    },
  });

  if (paidCount > 0) {
    await tx.clinicalStep.updateMany({
      where: {
        caseId,
        actionType: 'SETTLE_BILL',
        status: { not: 'COMPLETED' },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Fetch open patient cases (scoped for MANAGER, all for ADMIN) and active partner hospitals.
 */
export async function getManagerBillingMetadata(actor: {
  userId: string;
  role: string;
}): Promise<{ cases: unknown[]; hospitals: unknown[] }> {
  const caseWhere: Prisma.CaseWhereInput =
    actor.role === 'MANAGER'
      ? { status: { not: 'CLOSED' }, managerId: actor.userId }
      : { status: { not: 'CLOSED' } };

  const [cases, hospitals] = await Promise.all([
    prisma.case.findMany({
      where: caseWhere,
      select: {
        id: true,
        patientId: true,
        status: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.hospital.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { cases, hospitals };
}

/**
 * Update a medical bill (record payment increment, explicit paidAmount, status, dueDate, notes, or hospitalId).
 * Restricted to assigned MANAGER or ADMIN. Reads and validates balance/status atomically inside $transaction.
 */
export async function updateMedicalBill(
  params: UpdateMedicalBillParams
): Promise<ServiceResult<{ bill: unknown }>> {
  const { actor } = params;

  if (actor.role !== 'MANAGER' && actor.role !== 'ADMIN') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Manager or Admin access required',
      status: 403,
    };
  }

  const parsed = updateMedicalBillSchema.safeParse({
    billId: params.billId,
    paymentAmount: params.paymentAmount,
    paidAmount: params.paidAmount,
    status: params.status,
    dueDate: params.dueDate,
    notes: params.notes,
    hospitalId: params.hospitalId,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid bill update payload',
      status: 400,
    };
  }

  const data = parsed.data;

  if (data.hospitalId !== undefined && data.hospitalId !== null) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: data.hospitalId },
      select: { id: true },
    });
    if (!hospital) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Hospital not found',
        status: 400,
      };
    }
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const bill = await tx.medicalBill.findUnique({
      where: { id: data.billId },
      include: {
        case: { select: { id: true, managerId: true } },
        patient: { select: { id: true, assignedManagerId: true } },
      },
    });

    if (!bill) {
      return {
        ok: false as const,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Medical bill not found',
        status: 404,
      };
    }

    const isAuthorized =
      actor.role === 'ADMIN' ||
      bill.case.managerId === actor.userId ||
      bill.patient.assignedManagerId === actor.userId;

    if (!isAuthorized) {
      return {
        ok: false as const,
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to update this medical bill',
        status: 403,
      };
    }

    const totalAmount = Number(bill.totalAmount);
    const currentPaid = Number(bill.paidAmount);

    const isCancelledWithoutReactivation =
      bill.status === 'CANCELLED' &&
      (data.status === undefined || data.status === 'CANCELLED');

    if (
      isCancelledWithoutReactivation &&
      (data.paymentAmount !== undefined ||
        (data.paidAmount !== undefined && Math.abs(data.paidAmount - currentPaid) > 0.005))
    ) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Cannot record payment on a cancelled bill',
        status: 400,
      };
    }

    const rawNextPaid =
      data.paymentAmount !== undefined
        ? currentPaid + data.paymentAmount
        : data.paidAmount !== undefined
        ? data.paidAmount
        : currentPaid;

    if (rawNextPaid < 0 || rawNextPaid > totalAmount + 0.005) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Paid amount cannot exceed total invoice amount',
        status: 400,
      };
    }

    const nextPaid = Math.min(totalAmount, Math.round(rawNextPaid * 100) / 100);
    const effectiveRequestedStatus =
      data.status ??
      (bill.status === 'CANCELLED' || bill.status === 'OVERDUE'
        ? bill.status
        : undefined);
    const nextStatus = deriveBillStatus(totalAmount, nextPaid, effectiveRequestedStatus);

    const updatePayload: Prisma.MedicalBillUncheckedUpdateInput = {
      paidAmount: nextPaid,
      status: nextStatus,
    };

    if (data.dueDate !== undefined) {
      updatePayload.dueDate = data.dueDate;
    }
    if (data.notes !== undefined) {
      updatePayload.notes = data.notes;
    }
    if (data.hospitalId !== undefined) {
      updatePayload.hospitalId = data.hospitalId;
    }

    const updated = await tx.medicalBill.update({
      where: { id: bill.id },
      data: updatePayload,
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        hospital: {
          select: { id: true, name: true, city: true },
        },
        items: true,
      },
    });

    if (nextStatus === 'PAID') {
      await syncCaseSettleBillSteps(tx, bill.caseId);
    }

    return {
      ok: true as const,
      billId: bill.id,
      updated,
      currentPaid,
      nextPaid,
      previousStatus: bill.status,
      nextStatus,
      previousDueDate: bill.dueDate,
      previousHospitalId: bill.hospitalId,
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  await createAuditLog({
    actorId: actor.userId,
    action:
      txResult.nextPaid > txResult.currentPaid || txResult.nextStatus === 'PAID'
        ? AUDIT_ACTIONS.SETTLE_BILL
        : AUDIT_ACTIONS.UPDATE_BILL,
    entityType: 'MedicalBill',
    entityId: txResult.billId,
    oldValue: {
      paidAmount: txResult.currentPaid,
      status: txResult.previousStatus,
      dueDate: txResult.previousDueDate,
      hospitalId: txResult.previousHospitalId,
    },
    newValue: {
      paidAmount: txResult.nextPaid,
      status: txResult.nextStatus,
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.hospitalId !== undefined ? { hospitalId: data.hospitalId } : {}),
    },
    ipAddress: actor.ipAddress,
  });

  return { ok: true, data: { bill: txResult.updated } };
}

/**
 * Allow an owning PATIENT to pay a partial or full remaining balance on a medical bill.
 * Reads and validates bill status/balance atomically inside $transaction.
 */
export async function payPatientMedicalBill(
  params: PayPatientBillParams
): Promise<ServiceResult<{ bill: unknown }>> {
  const { actor } = params;

  if (actor.role !== 'PATIENT') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Patient access required',
      status: 403,
    };
  }

  const parsed = payPatientBillSchema.safeParse({
    billId: params.billId,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    referenceNo: params.referenceNo,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid payment payload',
      status: 400,
    };
  }

  const data = parsed.data;
  const patient = await prisma.patient.findFirst({
    where: { userId: actor.userId },
  });

  if (!patient) {
    return {
      ok: false,
      code: ERROR_CODES.PATIENT_NOT_FOUND,
      message: 'Patient profile not found',
      status: 404,
    };
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const bill = await tx.medicalBill.findUnique({
      where: { id: data.billId },
    });

    if (!bill) {
      return {
        ok: false as const,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Medical bill not found',
        status: 404,
      };
    }

    if (bill.patientId !== patient.id) {
      return {
        ok: false as const,
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to pay this medical bill',
        status: 403,
      };
    }

    if (bill.status === 'CANCELLED' || bill.status === 'PAID') {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: `Cannot pay a bill with status ${bill.status}`,
        status: 400,
      };
    }

    const totalAmount = Number(bill.totalAmount);
    const currentPaid = Number(bill.paidAmount);
    const remainingBalance = Math.max(0, Math.round((totalAmount - currentPaid) * 100) / 100);

    if (data.amount > remainingBalance + 0.005) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Payment amount exceeds remaining balance',
        status: 400,
      };
    }

    const nextPaid = Math.min(totalAmount, Math.round((currentPaid + data.amount) * 100) / 100);
    const nextStatus = deriveBillStatus(totalAmount, nextPaid);
    const currency = bill.currency || 'USD';
    const refSegment = data.referenceNo ? ` Ref: ${data.referenceNo}` : '';
    const receiptNote = `[Paid ${currency} ${data.amount.toFixed(2)} via ${data.paymentMethod}${refSegment} at ${new Date().toISOString()}]`;
    const nextNotes = bill.notes ? `${bill.notes}\n${receiptNote}` : receiptNote;

    const updated = await tx.medicalBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: nextPaid,
        status: nextStatus,
        notes: nextNotes,
      },
      include: {
        hospital: {
          select: { id: true, name: true, city: true },
        },
        items: true,
      },
    });

    if (nextStatus === 'PAID') {
      await syncCaseSettleBillSteps(tx, bill.caseId);
    }

    return {
      ok: true as const,
      billId: bill.id,
      updated,
      currentPaid,
      nextPaid,
      previousStatus: bill.status,
      nextStatus,
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.SETTLE_BILL,
    entityType: 'MedicalBill',
    entityId: txResult.billId,
    oldValue: { paidAmount: txResult.currentPaid, status: txResult.previousStatus },
    newValue: {
      paidAmount: txResult.nextPaid,
      status: txResult.nextStatus,
      paymentMethod: data.paymentMethod,
      ...(data.referenceNo ? { referenceNo: data.referenceNo } : {}),
    },
    ipAddress: actor.ipAddress,
  });

  return { ok: true, data: { bill: txResult.updated } };
}
