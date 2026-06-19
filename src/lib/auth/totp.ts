/**
 * MediRoute India — TOTP Two-Factor Authentication
 * Mandatory for Manager and Admin roles per PRD FR-AUTH-01.
 * Uses the `otpauth` library for TOTP generation and verification.
 */

import { TOTP, Secret } from 'otpauth';

const ISSUER = 'MediRoute India';
const ALGORITHM = 'SHA1';
const DIGITS = 6;
const PERIOD = 30; // seconds

/**
 * Generate a new TOTP secret and provisioning URI for QR code display.
 */
export function generateTOTPSecret(userEmail: string): {
  secret: string;
  uri: string;
} {
  const secret = new Secret({ size: 20 });

  const totp = new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret,
  });

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Verify a TOTP code against a stored secret.
 * Allows a 1-period window (±30s) for clock drift.
 */
export function verifyTOTP(token: string, secretBase32: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });

  // delta = 0 means exact match, ±1 allows one period drift
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
