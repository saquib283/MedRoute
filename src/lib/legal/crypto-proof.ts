/**
 * MediRoute India — Cryptographic Legal Proof & E-Signature Engine
 * Implements SHA-256 document hashing, unique proof receipt codes, and verification digests.
 */

import crypto from 'crypto';

/**
 * Computes a standardized SHA-256 hash of a string, object, or buffer.
 */
export function computeSha256(data: unknown): string {
  if (data === null || data === undefined) return '';

  let normalized: string | Buffer;
  if (Buffer.isBuffer(data)) {
    normalized = data;
  } else if (typeof data === 'string') {
    normalized = data;
  } else {
    // Sort keys for deterministic JSON hashing
    normalized = JSON.stringify(data, Object.keys(data as object).sort());
  }

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generates a verifiable proof receipt code
 * Format: MR-PROOF-YYYY-XXXXX (e.g. MR-PROOF-2026-K9X4M)
 */
export function generateVerificationCode(prefix = 'MR-PROOF'): string {
  const year = new Date().getFullYear();
  const randomChars = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
  return `${prefix}-${year}-${randomChars}`;
}

/**
 * Formats a legal consent statement for treatment plan acceptance
 */
export function generateTreatmentPlanConsentStatement(params: {
  signerFullName: string;
  planTitle: string;
  totalEstimatedCost: number | string;
  currency: string;
  hospitalName?: string;
}): string {
  const dateStr = new Date().toUTCString();
  return (
    `I, ${params.signerFullName}, hereby formally accept and confirm Treatment Plan "${params.planTitle}" ` +
    `with an estimated cost of ${params.currency} ${params.totalEstimatedCost}${params.hospitalName ? ` at ${params.hospitalName}` : ''}. ` +
    `I acknowledge that this estimate is based on preliminary medical evaluation and may be updated following comprehensive ` +
    `in-person hospital diagnostic evaluation. I authorize MediRoute India to coordinate and transmit my medical records ` +
    `to the designated hospital medical board for clinical facilitation. Signed on: ${dateStr}.`
  );
}

/**
 * Formats a medical travel and facilitation agreement statement
 */
export function generateMedicalTravelConsentStatement(params: {
  signerFullName: string;
  passportNumber?: string;
  nationality: string;
}): string {
  const dateStr = new Date().toUTCString();
  return (
    `I, ${params.signerFullName} (Nationality: ${params.nationality}${params.passportNumber ? `, Passport: ${params.passportNumber}` : ''}), ` +
    `hereby consent to medical tourism travel to India coordinated by MediRoute India Pvt. Ltd. I acknowledge that ` +
    `MediRoute India acts strictly as a healthcare facilitator and travel concierge, and not as a treating hospital or doctor. ` +
    `All medical procedures, surgical outcomes, and clinical responsibilities rest solely with the licensed Indian partner hospital. ` +
    `Signed electronically on: ${dateStr}.`
  );
}
