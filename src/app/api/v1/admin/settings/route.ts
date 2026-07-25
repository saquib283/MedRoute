/**
 * MediRoute India — /api/v1/admin/settings
 * Platform configuration settings. Admin only.
 */

import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth, getClientIP } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { z } from 'zod';

const settingsSchema = z.object({
  maxPatientsPerManager: z.number().int().min(1).max(500),
  defaultCommissionRate: z.number().min(0).max(100),
  maintenanceMode: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440),
  maintenanceStart: z.string().optional().or(z.literal('')),
  maintenanceEnd: z.string().optional().or(z.literal('')),
  alertBannerText: z.string().optional().or(z.literal('')),
});

const SETTINGS_DIR = path.join(process.cwd(), 'src', 'data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  maxPatientsPerManager: 25,
  defaultCommissionRate: 10.0,
  maintenanceMode: false,
  sessionTimeoutMinutes: 60,
  maintenanceStart: '',
  maintenanceEnd: '',
  alertBannerText: '',
};

async function readSettings() {
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    // If file doesn't exist, create it with defaults
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return DEFAULT_SETTINGS;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const settings = await readSettings();
    return apiSuccess({ settings });
  } catch (err) {
    console.error('[Admin Settings GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch settings', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;
    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const body = await request.json();
    const result = settingsSchema.safeParse(body);
    if (!result.success) {
      return apiError(ERROR_CODES.BAD_REQUEST, result.error.issues[0].message, 400);
    }

    const oldSettings = await readSettings();
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(result.data, null, 2));

    await createAuditLog({
      actorId: authUser!.userId,
      action: AUDIT_ACTIONS.SETTINGS_UPDATE,
      entityType: 'SystemSettings',
      entityId: 'global',
      oldValue: oldSettings,
      newValue: result.data,
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ settings: result.data });
  } catch (err) {
    console.error('[Admin Settings PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save settings', 500);
  }
}
