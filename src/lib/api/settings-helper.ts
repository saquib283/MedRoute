import path from 'path';
import fs from 'fs/promises';

const SETTINGS_FILE = path.join(process.cwd(), 'src', 'data', 'settings.json');

export interface SystemSettings {
  maxPatientsPerManager: number;
  defaultCommissionRate: number;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maintenanceStart?: string;
  maintenanceEnd?: string;
  alertBannerText?: string;
}

export async function readSettings(): Promise<SystemSettings | null> {
  try {
    const fileExists = await fs.access(SETTINGS_FILE).then(() => true).catch(() => false);
    if (!fileExists) return null;
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function checkMaintenanceActive(role?: string): Promise<boolean> {
  // Admins bypass maintenance mode
  if (role === 'ADMIN') {
    return false;
  }

  const settings = await readSettings();
  if (!settings) return false;

  const now = new Date();

  // 1. Manual/Hard Toggle
  if (settings.maintenanceMode) {
    return true;
  }

  // 2. Scheduled Window
  if (settings.maintenanceStart && settings.maintenanceEnd) {
    const start = new Date(settings.maintenanceStart);
    const end = new Date(settings.maintenanceEnd);
    if (now >= start && now <= end) {
      return true;
    }
  }

  return false;
}
