/**
 * Afzal Healthcare — /api/v1/admin/cases/reassign
 * Bulk case load reassignment endpoint. Admin only.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const reassignSchema = z.object({
  caseIds: z.array(z.string().min(1)).min(1),
  targetManagerId: z.string().min(1).nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = reassignSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const { caseIds, targetManagerId } = result.data;

    // Verify manager exists if not null
    let targetManagerName = 'Unassigned';
    if (targetManagerId) {
      const managerUser = await prisma.user.findUnique({
        where: { id: targetManagerId, role: 'MANAGER', isActive: true },
      });
      if (!managerUser) {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Target manager not found or inactive', 400);
      }
      targetManagerName = managerUser.fullName;
    }

    // Execute reassignment inside transaction
    const results = await prisma.$transaction(async (tx) => {
      const updatedCases = [];

      for (const caseId of caseIds) {
        const existing = await tx.case.findUnique({
          where: { id: caseId },
          include: { patient: true },
        });

        if (!existing) continue;

        // Update case
        const updated = await tx.case.update({
          where: { id: caseId },
          data: { managerId: targetManagerId },
        });

        updatedCases.push(updated);

        // Audit Log
        await createAuditLog({
          actorId: authUser!.userId,
          action: AUDIT_ACTIONS.REASSIGN,
          entityType: 'Case',
          entityId: caseId,
          oldValue: { managerId: existing.managerId },
          newValue: { managerId: targetManagerId },
          ipAddress: getClientIP(request),
        });

        // Notifications
        const notificationsToCreate = [];

        // Alert target manager
        if (targetManagerId) {
          notificationsToCreate.push({
            userId: targetManagerId,
            channel: 'IN_APP' as const,
            title: 'New Case Assigned',
            body: `You have been assigned Case #${caseId.substring(0, 8)} by the Admin.`,
            triggerEvent: 'CASE_REASSIGNED',
          });
        }

        // Alert patient
        if (existing.patient?.userId) {
          notificationsToCreate.push({
            userId: existing.patient.userId,
            channel: 'IN_APP' as const,
            title: 'Case Coordinator Updated',
            body: `Your case coordinator has been updated to ${targetManagerName}.`,
            triggerEvent: 'CASE_COORDINATOR_UPDATED',
          });
        }

        if (notificationsToCreate.length > 0) {
          await tx.notification.createMany({
            data: notificationsToCreate,
          });
        }
      }

      return updatedCases;
    });

    return apiSuccess({ reassignedCount: results.length });
  } catch (err) {
    console.error('[Bulk Reassign Cases POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to reassign cases', 500);
  }
}
