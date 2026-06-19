/**
 * MediRoute India — Password Hashing Utilities
 * bcrypt with minimum 12 salt rounds per PRD Section 5.3
 */

import bcrypt from 'bcryptjs';
import { SYSTEM_LIMITS } from '@/lib/constants';

/**
 * Hash a plaintext password using bcrypt with ≥12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SYSTEM_LIMITS.MIN_BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
