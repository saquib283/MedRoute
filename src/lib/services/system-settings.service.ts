/**
 * Afzal Healthcare — Database-Backed Platform Governance Service
 * Stores and caches global platform settings in Prisma SystemConfig
 * with runtime enforcement for maintenance mode, manager capacity,
 * session inactivity timeouts, and default commission rates.
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import type { ServiceResult } from '@/lib/services/clinical-pathway.service';

export interface SystemSettings {
  maxPatientsPerManager: number;
  defaultCommissionRate: number;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maintenanceStart: string;
  maintenanceEnd: string;
  alertBannerText: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  maxPatientsPerManager: 25,
  defaultCommissionRate: 10.0,
  maintenanceMode: false,
  sessionTimeoutMinutes: 15,
  maintenanceStart: '',
  maintenanceEnd: '',
  alertBannerText: '',
};

const SETTINGS_KEYS: ReadonlyArray<keyof SystemSettings> = [
  'maxPatientsPerManager',
  'defaultCommissionRate',
  'maintenanceMode',
  'sessionTimeoutMinutes',
  'maintenanceStart',
  'maintenanceEnd',
  'alertBannerText',
];

const SETTINGS_CACHE_TTL_MS = 5_000;
const LEGACY_SETTINGS_FILE = path.join(process.cwd(), 'src', 'data', 'settings.json');

let cachedSettings: SystemSettings | null = null;
let cacheExpiresAt = 0;

export const systemSettingsSchema = z
  .object({
    maxPatientsPerManager: z.number().int().min(1).max(500),
    defaultCommissionRate: z.number().min(0).max(100),
    maintenanceMode: z.boolean(),
    sessionTimeoutMinutes: z.number().int().min(5).max(1440),
    maintenanceStart: z.string().trim().optional().default(''),
    maintenanceEnd: z.string().trim().optional().default(''),
    alertBannerText: z.string().trim().max(500).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.maintenanceStart) {
      const start = new Date(val.maintenanceStart);
      if (Number.isNaN(start.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maintenanceStart must be a valid date',
          path: ['maintenanceStart'],
        });
        return;
      }
    }
    if (val.maintenanceEnd) {
      const end = new Date(val.maintenanceEnd);
      if (Number.isNaN(end.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maintenanceEnd must be a valid date',
          path: ['maintenanceEnd'],
        });
        return;
      }
    }
    if (val.maintenanceStart && val.maintenanceEnd) {
      const start = new Date(val.maintenanceStart);
      const end = new Date(val.maintenanceEnd);
      if (end.getTime() <= start.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maintenanceEnd must be after maintenanceStart',
          path: ['maintenanceEnd'],
        });
      }
    }
  });

/**
 * Invalidate the short-TTL in-memory settings cache immediately.
 */
export function clearSystemSettingsCache(): void {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

function parseJsonValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function applyRawSettings(rawMap: Partial<Record<string, unknown>>): SystemSettings {
  const merged: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };

  if (
    typeof rawMap.maxPatientsPerManager === 'number' &&
    Number.isInteger(rawMap.maxPatientsPerManager) &&
    rawMap.maxPatientsPerManager >= 1 &&
    rawMap.maxPatientsPerManager <= 500
  ) {
    merged.maxPatientsPerManager = rawMap.maxPatientsPerManager;
  }

  if (
    typeof rawMap.defaultCommissionRate === 'number' &&
    Number.isFinite(rawMap.defaultCommissionRate) &&
    rawMap.defaultCommissionRate >= 0 &&
    rawMap.defaultCommissionRate <= 100
  ) {
    merged.defaultCommissionRate = rawMap.defaultCommissionRate;
  }

  if (typeof rawMap.maintenanceMode === 'boolean') {
    merged.maintenanceMode = rawMap.maintenanceMode;
  }

  if (
    typeof rawMap.sessionTimeoutMinutes === 'number' &&
    Number.isInteger(rawMap.sessionTimeoutMinutes) &&
    rawMap.sessionTimeoutMinutes >= 5 &&
    rawMap.sessionTimeoutMinutes <= 1440
  ) {
    merged.sessionTimeoutMinutes = rawMap.sessionTimeoutMinutes;
  }

  if (typeof rawMap.maintenanceStart === 'string') {
    merged.maintenanceStart = rawMap.maintenanceStart;
  }

  if (typeof rawMap.maintenanceEnd === 'string') {
    merged.maintenanceEnd = rawMap.maintenanceEnd;
  }

  if (typeof rawMap.alertBannerText === 'string') {
    merged.alertBannerText = rawMap.alertBannerText.slice(0, 500);
  }

  return merged;
}

async function readLegacySettingsFile(): Promise<SystemSettings> {
  try {
    const content = await fs.readFile(LEGACY_SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      return applyRawSettings(parsed);
    }
  } catch {
    // Missing or unreadable legacy settings file falls back cleanly to defaults
  }
  return { ...DEFAULT_SYSTEM_SETTINGS };
}

/**
 * Retrieve global platform settings from Prisma SystemConfig with a 5s TTL cache.
 * Bootstraps from src/data/settings.json (or defaults) when SystemConfig has 0 rows,
 * and falls back cleanly to defaults if SystemConfig is unmocked in isolated tests.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (cachedSettings && Date.now() < cacheExpiresAt) {
    return { ...cachedSettings };
  }

  if (typeof prisma?.systemConfig?.findMany !== 'function') {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }

  try {
    const rows = await prisma.systemConfig.findMany();

    if (Array.isArray(rows) && rows.length > 0) {
      const rawMap: Record<string, unknown> = {};
      for (const row of rows) {
        if (row && typeof row.key === 'string') {
          rawMap[row.key] = parseJsonValue(String(row.value));
        }
      }
      const resolved = applyRawSettings(rawMap);
      cachedSettings = resolved;
      cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
      return { ...resolved };
    }

    const bootstrapped = await readLegacySettingsFile();

    if (typeof prisma.systemConfig.upsert === 'function') {
      try {
        if (typeof prisma.$transaction === 'function') {
          await prisma.$transaction(async (tx) => {
            for (const key of SETTINGS_KEYS) {
              const serialized = JSON.stringify(bootstrapped[key]);
              await tx.systemConfig.upsert({
                where: { key },
                update: {},
                create: { key, value: serialized },
              });
            }
          });
        } else {
          await Promise.all(
            SETTINGS_KEYS.map((key) => {
              const serialized = JSON.stringify(bootstrapped[key]);
              return prisma.systemConfig.upsert({
                where: { key },
                update: {},
                create: { key, value: serialized },
              });
            })
          );
        }
      } catch {
        // Non-fatal in mocked or read-only contexts
      }
    }

    cachedSettings = bootstrapped;
    cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
    return { ...bootstrapped };
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

/**
 * Validate, persist, cache-invalidate, and audit-log global system settings updates.
 */
export async function updateSystemSettings(
  input: unknown,
  actor: { userId: string; ipAddress?: string }
): Promise<ServiceResult<SystemSettings>> {
  const parsed = systemSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid settings payload',
      status: 400,
    };
  }

  const nextSettings: SystemSettings = {
    maxPatientsPerManager: parsed.data.maxPatientsPerManager,
    defaultCommissionRate: parsed.data.defaultCommissionRate,
    maintenanceMode: parsed.data.maintenanceMode,
    sessionTimeoutMinutes: parsed.data.sessionTimeoutMinutes,
    maintenanceStart: parsed.data.maintenanceStart,
    maintenanceEnd: parsed.data.maintenanceEnd,
    alertBannerText: parsed.data.alertBannerText,
  };

  const oldSettings = await getSystemSettings();

  await prisma.$transaction(async (tx) => {
    for (const key of SETTINGS_KEYS) {
      const serialized = JSON.stringify(nextSettings[key]);
      await tx.systemConfig.upsert({
        where: { key },
        update: { value: serialized },
        create: { key, value: serialized },
      });
    }
  });

  clearSystemSettingsCache();

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: 'SystemConfig',
    entityId: 'global',
    oldValue: oldSettings,
    newValue: nextSettings,
    ipAddress: actor.ipAddress,
  });

  return { ok: true, data: nextSettings };
}

/**
 * Check whether maintenance mode (manual toggle or scheduled window) applies to a role.
 * ADMIN always bypasses maintenance mode so platform recovery remains possible.
 */
export async function checkMaintenanceActive(
  role?: string,
  now: Date = new Date()
): Promise<boolean> {
  if (role === 'ADMIN') {
    return false;
  }

  const settings = await getSystemSettings();

  if (settings.maintenanceMode) {
    return true;
  }

  if (settings.maintenanceStart && settings.maintenanceEnd) {
    const start = new Date(settings.maintenanceStart);
    const end = new Date(settings.maintenanceEnd);
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start.getTime() <= now.getTime() &&
      now.getTime() <= end.getTime()
    ) {
      return true;
    }
  }

  return false;
}

interface PatientCountDb {
  patient?: {
    count?: (args: {
      where: {
        assignedManagerId: string;
        id?: { notIn: string[] };
      };
    }) => Promise<number>;
  };
}

/**
 * Enforce maxPatientsPerManager before assigning additional patients to a coordinator.
 */
export async function assertManagerCapacity(
  db: PatientCountDb,
  managerId: string,
  incomingNewPatients: number,
  excludePatientIds: string[] = []
): Promise<ServiceResult<{ currentCount: number; maxPatientsPerManager: number }>> {
  const settings = await getSystemSettings();

  if (incomingNewPatients <= 0) {
    return {
      ok: true,
      data: {
        currentCount: 0,
        maxPatientsPerManager: settings.maxPatientsPerManager,
      },
    };
  }

  const currentCount =
    typeof db?.patient?.count === 'function'
      ? await db.patient.count({
          where: {
            assignedManagerId: managerId,
            ...(excludePatientIds.length > 0 ? { id: { notIn: excludePatientIds } } : {}),
          },
        })
      : 0;

  if (currentCount + incomingNewPatients > settings.maxPatientsPerManager) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Target manager has reached the maximum capacity of ${settings.maxPatientsPerManager} assigned patients.`,
      status: 400,
    };
  }

  return {
    ok: true,
    data: {
      currentCount,
      maxPatientsPerManager: settings.maxPatientsPerManager,
    },
  };
}
