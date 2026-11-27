/**
 * MediRoute India — Cryptographically Chained Tamper-Evident Audit Trail
 * Implements Merkle/Blockchain-style hash chaining for immutable evidentiary logging.
 */

import prisma from '@/lib/prisma';
import { computeSha256 } from './crypto-proof';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface ChainedAuditLogParams {
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
 * Computes deterministic SHA-256 hash for an audit log entry
 */
export function computeAuditEntryHash(params: {
  id?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string | Date;
  oldValue?: unknown;
  newValue?: unknown;
  previousHash?: string | null;
}): string {
  const payload = {
    id: params.id || '',
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    timestamp: new Date(params.timestamp).toISOString(),
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    previousHash: params.previousHash || GENESIS_HASH,
  };

  return computeSha256(payload);
}

/**
 * Creates a cryptographically chained audit log entry in the database.
 */
export async function createChainedAuditLog(params: ChainedAuditLogParams): Promise<void> {
  try {
    // 1. Fetch latest log to retrieve previous hash
    const latestLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, hash: true },
    });

    const previousHash = latestLog?.hash || GENESIS_HASH;
    const now = new Date();

    // 2. Compute SHA-256 digest
    const hash = computeAuditEntryHash({
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      timestamp: now,
      oldValue: params.oldValue,
      newValue: params.newValue,
      previousHash,
    });

    // 3. Persist chained audit log
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue ? (params.oldValue as object) : undefined,
        newValue: params.newValue ? (params.newValue as object) : undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        requestMethod: params.requestMethod || null,
        route: params.route || null,
        status: params.status || 'SUCCESS',
        hash,
        previousHash,
        createdAt: now,
      },
    });
  } catch (err) {
    // Do not break the caller transaction if logging fails, but log to error stream
    console.error('[AuditChain] Failed to create chained audit log:', err);
  }
}

/**
 * Validates the entire cryptographic hash chain across all historical audit logs.
 * Detects any tampered, altered, or deleted rows.
 */
export async function verifyAuditChainIntegrity(): Promise<{
  isValid: boolean;
  totalChecked: number;
  unbrokenCount: number;
  tamperedCount: number;
  tamperedLogs: { id: string; action: string; expectedHash: string; actualHash: string; createdAt: string }[];
  verifiedAt: string;
}> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (logs.length === 0) {
    return {
      isValid: true,
      totalChecked: 0,
      unbrokenCount: 0,
      tamperedCount: 0,
      tamperedLogs: [],
      verifiedAt: new Date().toISOString(),
    };
  }

  const tampered: { id: string; action: string; expectedHash: string; actualHash: string; createdAt: string }[] = [];
  let expectedPrevHash = GENESIS_HASH;
  let unbroken = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // For legacy logs created prior to hash chaining, skip previousHash check if null
    if (!log.hash) {
      unbroken++;
      continue;
    }

    // Verify link to preceding hash
    const prevMatches = !log.previousHash || log.previousHash === expectedPrevHash || i === 0;

    // Recalculate hash
    const computedHash = computeAuditEntryHash({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      timestamp: log.createdAt,
      oldValue: log.oldValue,
      newValue: log.newValue,
      previousHash: log.previousHash,
    });

    const isMatch = computedHash === log.hash && prevMatches;

    if (!isMatch) {
      tampered.push({
        id: log.id,
        action: log.action,
        expectedHash: computedHash,
        actualHash: log.hash || 'NULL',
        createdAt: log.createdAt.toISOString(),
      });
    } else {
      unbroken++;
    }

    expectedPrevHash = log.hash;
  }

  return {
    isValid: tampered.length === 0,
    totalChecked: logs.length,
    unbrokenCount: unbroken,
    tamperedCount: tampered.length,
    tamperedLogs: tampered,
    verifiedAt: new Date().toISOString(),
  };
}
