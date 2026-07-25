/**
 * MediRoute India — ePHI Field-Level Encryption Utilities
 * Application-level AES-256-GCM encryption for clinical fields per HIPAA § 164.312(a)(2)(iv).
 */

import { encrypt, decrypt } from '@/lib/auth/crypto';

/**
 * Encrypt a field value if it exists and is a string or JSON object.
 * Returns the encrypted string representation.
 */
export function encryptField(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const textToEncrypt =
    typeof value === 'string' ? value : JSON.stringify(value);

  if (!textToEncrypt || textToEncrypt === '""' || textToEncrypt === '[]') {
    return textToEncrypt;
  }

  return encrypt(textToEncrypt);
}

export function decryptField<T = unknown>(ciphertext: unknown): T | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;

  if (typeof ciphertext !== 'string') {
    // If it is already parsed as an object/array by Prisma (unencrypted legacy data), return it directly!
    return ciphertext as T;
  }

  const decrypted = decrypt(ciphertext);
  if (!decrypted) return null;

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
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
    allergies: profileData.allergies ? encryptField(profileData.allergies) : undefined,
    medications: profileData.medications ? encryptField(profileData.medications) : undefined,
    surgeries: profileData.surgeries ? encryptField(profileData.surgeries) : undefined,
    chronicConditions: profileData.chronicConditions ? encryptField(profileData.chronicConditions) : undefined,
  };
}

/**
 * Decrypt medical profile JSON fields before returning to client.
 */
export function decryptMedicalProfile<T extends Record<string, unknown>>(profile: T | null): T | null {
  if (!profile) return null;

  return {
    ...profile,
    allergies: profile.allergies ? decryptField(profile.allergies) : [],
    medications: profile.medications ? decryptField(profile.medications) : [],
    surgeries: profile.surgeries ? decryptField(profile.surgeries) : [],
    chronicConditions: profile.chronicConditions ? decryptField(profile.chronicConditions) : [],
  };
}
