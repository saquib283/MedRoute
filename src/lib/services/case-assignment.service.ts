/**
 * Afzal Healthcare — Atomic Coordinator Reassignment Service
 * Keeps Patient.assignedManagerId and open Case.managerId synchronized in a single transaction.
 */

import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS } from '@/lib/api/audit-logger';

export interface AssignPatientCoordinatorInput {
  patientId?: string;
  caseIds?: string[];
  managerId: string | null;
  actorId: string;
  ipAddress?: string;
}

/**
 * Atomically reassign a coordinator across a Patient and all non-CLOSED Cases,
 * or across specific Case IDs along with their owning Patient records.
 */
export async function assignPatientCoordinator({
  patientId,
  caseIds,
  managerId,
  actorId,
  ipAddress,
}: AssignPatientCoordinatorInput) {
  if (!patientId && (!caseIds || caseIds.length === 0)) {
    return {
      ok: false as const,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'patientId or caseIds is required',
      status: 400,
    };
  }

  let targetManagerName = 'Unassigned';
  if (managerId) {
    const managerUser = await prisma.user.findUnique({
      where: { id: managerId, role: 'MANAGER', isActive: true },
    });
    if (!managerUser || managerUser.role !== 'MANAGER' || !managerUser.isActive) {
      return {
        ok: false as const,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Target manager not found or inactive',
        status: 400,
      };
    }
    targetManagerName = managerUser.fullName;
  }

  return prisma.$transaction(async (tx) => {
    if (patientId) {
      const patient = await tx.patient.findUnique({
        where: { id: patientId },
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

      const openCases = await tx.case.findMany({
        where: { patientId, status: { not: 'CLOSED' } },
        select: { id: true, managerId: true },
      });

      await tx.patient.update({
        where: { id: patientId },
        data: { assignedManagerId: managerId },
      });

      await tx.case.updateMany({
        where: { patientId, status: { not: 'CLOSED' } },
        data: { managerId },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: AUDIT_ACTIONS.REASSIGN,
          entityType: 'Patient',
          entityId: patientId,
          oldValue: {
            assignedManagerId: patient.assignedManagerId,
            openCaseIds: openCases.map((c) => c.id),
          },
          newValue: {
            assignedManagerId: managerId,
          },
          ipAddress: ipAddress ?? null,
        },
      });

      const notifications: Array<{
        userId: string;
        channel: 'IN_APP';
        title: string;
        body: string;
        triggerEvent: string;
      }> = [];

      if (managerId) {
        notifications.push({
          userId: managerId,
          channel: 'IN_APP',
          title: 'Patient Coordinator Assigned',
          body: `You have been assigned as coordinator for patient ${patientId} (${openCases.length} open case(s)).`,
          triggerEvent: 'CASE_REASSIGNED',
        });
      }

      if (patient.userId) {
        notifications.push({
          userId: patient.userId,
          channel: 'IN_APP',
          title: 'Case Coordinator Updated',
          body: `Your case coordinator has been updated to ${targetManagerName}.`,
          triggerEvent: 'CASE_COORDINATOR_UPDATED',
        });
      }

      if (notifications.length > 0) {
        await tx.notification.createMany({ data: notifications });
      }

      return {
        ok: true as const,
        reassignedCount: openCases.length,
        affectedPatientIds: [patientId],
      };
    }

    const targetCaseIds = caseIds!;
    const cases = await tx.case.findMany({
      where: { id: { in: targetCaseIds } },
      select: { id: true, patientId: true, managerId: true, status: true },
    });

    if (cases.length === 0) {
      return {
        ok: false as const,
        code: ERROR_CODES.CASE_NOT_FOUND,
        message: 'Case not found',
        status: 404,
      };
    }

    const foundCaseIds = cases.map((c) => c.id);

    await tx.case.updateMany({
      where: { id: { in: foundCaseIds } },
      data: { managerId },
    });

    const uniquePatientIds = Array.from(new Set(cases.map((c) => c.patientId)));
    const notifications: Array<{
      userId: string;
      channel: 'IN_APP';
      title: string;
      body: string;
      triggerEvent: string;
    }> = [];

    for (const pid of uniquePatientIds) {
      const patient = await tx.patient.findUnique({
        where: { id: pid },
        select: { id: true, userId: true, assignedManagerId: true },
      });

      await tx.patient.update({
        where: { id: pid },
        data: { assignedManagerId: managerId },
      });

      if (patient?.userId) {
        notifications.push({
          userId: patient.userId,
          channel: 'IN_APP',
          title: 'Case Coordinator Updated',
          body: `Your case coordinator has been updated to ${targetManagerName}.`,
          triggerEvent: 'CASE_COORDINATOR_UPDATED',
        });
      }
    }

    if (managerId) {
      notifications.push({
        userId: managerId,
        channel: 'IN_APP',
        title: 'New Case Assigned',
        body:
          foundCaseIds.length === 1
            ? `You have been assigned Case #${foundCaseIds[0].substring(0, 8)} by the Admin.`
            : `You have been assigned ${foundCaseIds.length} cases by the Admin.`,
        triggerEvent: 'CASE_REASSIGNED',
      });
    }

    for (const c of cases) {
      await tx.auditLog.create({
        data: {
          actorId,
          action: AUDIT_ACTIONS.REASSIGN,
          entityType: 'Case',
          entityId: c.id,
          oldValue: { managerId: c.managerId },
          newValue: { managerId },
          ipAddress: ipAddress ?? null,
        },
      });
    }

    if (notifications.length > 0) {
      await tx.notification.createMany({ data: notifications });
    }

    return {
      ok: true as const,
      reassignedCount: foundCaseIds.length,
      affectedPatientIds: uniquePatientIds,
    };
  });
}
