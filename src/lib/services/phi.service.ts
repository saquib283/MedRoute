/**
 * Afzal Healthcare — Shared ePHI Projection & Safe Decryption Service
 * Normalizes decrypted passport numbers and clinical medicalProfile payloads across portal APIs.
 */

import { decrypt, DecryptionTamperError } from '@/lib/auth/crypto';
import { decryptMedicalProfile } from '@/lib/api/phi-encryption';
import type { TravelLogisticsPayload } from '@/lib/validation/lifecycle-schemas';

/**
 * Safely decrypt an encrypted string field, returning '[DECRYPTION_ERROR]' on GCM tamper failure.
 */
export function safeDecryptString(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return decrypt(val);
  } catch (err) {
    if (err instanceof DecryptionTamperError) {
      console.error('[ePHI Tamper Alert] Failed to decrypt string field');
      return '[DECRYPTION_ERROR]';
    }
    return '';
  }
}

/**
 * Decrypt (if encrypted) and mask a passport number for oversight/list views, revealing at most the last 4 characters.
 */
export function maskPassportNumber(rawOrEncrypted: string | null | undefined): string {
  const plain = safeDecryptString(rawOrEncrypted);
  if (!plain || plain === '[DECRYPTION_ERROR]') return '—';
  if (plain.length <= 4) return '****';
  return `${'*'.repeat(plain.length - 4)}${plain.slice(-4)}`;
}

/**
 * Format a patient record for API responses by decrypting (or masking) passportNo and decrypting medicalProfile arrays.
 */
export function formatPatientForViewer<T extends Record<string, unknown>>(
  patient: T,
  options: { maskPassport?: boolean } = {}
): T {
  const result: Record<string, unknown> = { ...patient };
  if ('passportNo' in result && typeof result.passportNo === 'string') {
    result.passportNo = options.maskPassport
      ? maskPassportNumber(result.passportNo)
      : safeDecryptString(result.passportNo);
  }
  if ('medicalProfile' in result && result.medicalProfile) {
    result.medicalProfile = decryptMedicalProfile(
      result.medicalProfile as Parameters<typeof decryptMedicalProfile>[0]
    );
  }
  return result as T;
}

/**
 * Format Case.travelLogistics for JSON API responses by masking all MED-X attendant passport numbers.
 */
export function formatTravelLogisticsForViewer(
  raw: unknown,
  options: { maskPassport?: boolean } = { maskPassport: true }
): TravelLogisticsPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const parsed = raw as TravelLogisticsPayload;
  const mask = options.maskPassport ?? true;
  if (!Array.isArray(parsed.attendants)) {
    return { ...parsed };
  }

  return {
    ...parsed,
    attendants: parsed.attendants.map((att) => ({
      fullName: att.fullName,
      passportNo: mask ? maskPassportNumber(att.passportNo) : safeDecryptString(att.passportNo),
      relation: att.relation,
    })),
  };
}
