/**
 * Afzal Healthcare — ePHI Field-Level Encryption Utilities
 * Application-level AES-256-GCM encryption for clinical fields per HIPAA § 164.312(a)(2)(iv).
 */

import { encrypt, decrypt, DecryptionTamperError } from '@/lib/auth/crypto';

/**
 * Encrypt a field value if it exists and is a string or JSON object.
 * Returns the encrypted string representation.
 */
export function encryptField(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const textToEncrypt =
    typeof value === 'string' ? value : JSON.stringify(value);

  if (!textToEncrypt || textToEncrypt === '""') {
    return '';
  }

  return encrypt(textToEncrypt);
}

export function decryptField<T = unknown>(ciphertext: unknown): T | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;

  if (typeof ciphertext !== 'string') {
    // If it is already parsed as an object/array by Prisma (unencrypted legacy data), return it directly!
    return ciphertext as T;
  }

  try {
    const decrypted = decrypt(ciphertext);
    if (!decrypted) return null;

    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  } catch (err) {
    if (err instanceof DecryptionTamperError) {
      console.error('[ePHI Tamper Alert] Refusing to return tampered ciphertext');
      return null;
    }
    throw err;
  }
}

/**
 * Encrypt medical profile JSON arrays before saving to database.
 */
export function encryptMedicalProfile(profileData: {
  allergies?: unknown;
  medications?: unknown;
  surgeries?: unknown;
  chronicConditions?: unknown;
  specialisationsRequired?: unknown;
}) {
  return {
    ...profileData,
    allergies: profileData.allergies !== undefined ? encryptField(profileData.allergies) : undefined,
    medications: profileData.medications !== undefined ? encryptField(profileData.medications) : undefined,
    surgeries: profileData.surgeries !== undefined ? encryptField(profileData.surgeries) : undefined,
    chronicConditions: profileData.chronicConditions !== undefined ? encryptField(profileData.chronicConditions) : undefined,
  };
}

/**
 * Decrypt medical profile JSON fields before returning to client.
 */
export function decryptMedicalProfile<T extends Record<string, unknown>>(profile: T | null | undefined): T | null {
  if (!profile) return null;

  const allergies = decryptField(profile.allergies);
  const medications = decryptField(profile.medications);
  const surgeries = decryptField(profile.surgeries);
  const chronicConditions = decryptField(profile.chronicConditions);

  return {
    ...profile,
    allergies: Array.isArray(allergies) ? allergies : [],
    medications: Array.isArray(medications) ? medications : [],
    surgeries: Array.isArray(surgeries) ? surgeries : [],
    chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [],
  };
}
