/**
 * Afzal Healthcare — Audit Logger
 * Server-side utility for creating audit log entries on admin mutations.
 */

import prisma from '@/lib/prisma';

interface AuditLogParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

/**
 * Create an audit log entry.
 * Fire-and-forget — errors are logged but don't break the caller.
 */
export async function createAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  ipAddress,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging break the main operation
    console.error('[AuditLog] Failed to create audit entry:', err);
  }
}

/**
 * Common audit action names for consistency.
 */
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  DEACTIVATE: 'DEACTIVATE',
  ACTIVATE: 'ACTIVATE',
  RESET_PASSWORD: 'RESET_PASSWORD',
  STATUS_CHANGE: 'STATUS_CHANGE',
  REASSIGN: 'REASSIGN',
  RESOLVE_ESCALATION: 'RESOLVE_ESCALATION',
  EXPORT: 'EXPORT',
  BROADCAST_NOTIFICATION: 'BROADCAST_NOTIFICATION',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  CAMPAIGN_SEND: 'CAMPAIGN_SEND',
  TEMPLATE_CREATE: 'TEMPLATE_CREATE',
  TEMPLATE_UPDATE: 'TEMPLATE_UPDATE',
  TEMPLATE_DELETE: 'TEMPLATE_DELETE',

  // HIPAA ePHI Read & Export Audit Events (§ 164.312(b))
  VIEW_PATIENT: 'VIEW_PATIENT',
  VIEW_PATIENT_PROFILE: 'VIEW_PATIENT_PROFILE',
  VIEW_CLINICAL_NOTES: 'VIEW_CLINICAL_NOTES',
  DOWNLOAD_DOCUMENT: 'DOWNLOAD_DOCUMENT',
  EXPORT_PATIENTS: 'EXPORT_PATIENTS',
  EXPORT_CASES: 'EXPORT_CASES',
  EXPORT_APPOINTMENTS: 'EXPORT_APPOINTMENTS',

  // Sub-Project 2: Clinical Pathway & Clearances
  CONFIGURE_PATHWAY: 'CONFIGURE_PATHWAY',
  UPDATE_PATHWAY_STEP: 'UPDATE_PATHWAY_STEP',
  VERIFY_DOCUMENT: 'VERIFY_DOCUMENT',
  ISSUE_DOCUMENT: 'ISSUE_DOCUMENT',
  SIGN_FIT_TO_FLY: 'SIGN_FIT_TO_FLY',
} as const;

