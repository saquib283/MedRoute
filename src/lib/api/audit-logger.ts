/**
 * MediRoute India — Audit Logger
 * Server-side utility for creating audit log entries on admin mutations.
 */

import prisma from '@/lib/prisma';
import { createChainedAuditLog, ChainedAuditLogParams } from '@/lib/legal/audit-chain';

export interface AuditLogParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestMethod?: string | null;
  route?: string | null;
  status?: string;
}

/**
 * Create an audit log entry with cryptographic hash chaining.
 * Fire-and-forget — errors are logged but don't break the caller.
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  await createChainedAuditLog(params);
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
} as const;

