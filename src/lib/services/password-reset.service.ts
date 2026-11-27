/**
 * Afzal Healthcare — Password Reset Service
 * DB-backed OTP password recovery with uniform rate limiting and atomic token consumption.
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { ERROR_CODES } from '@/lib/api/errors';

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

const rateLimitStore = new Map<string, number[]>();

/**
 * Clear the in-memory rate-limit store (for unit tests only).
 */
export function resetRateLimitStoreForTests(): void {
  rateLimitStore.clear();
}

/**
 * Dispatch a password reset OTP via configured webhook, or log safely per environment.
 */
async function sendPasswordResetEmail(email: string, otp: string): Promise<void> {
  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, otp, purpose: 'PASSWORD_RESET' }),
    });
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.info(`[DEV OTP] Password reset code for ${email}: ${otp}`);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[PasswordReset] No PASSWORD_RESET_WEBHOOK_URL configured; OTP email not dispatched');
  }
}

/**
 * Compute a user-salted SHA-256 hex digest for a password reset OTP.
 */
export function hashResetOtp(userId: string, otp: string): string {
  return crypto.createHash('sha256').update(`${userId}:${otp}`).digest('hex');
}

/**
 * Verify a candidate OTP against a stored hash in constant time.
 */
export function verifyResetOtpHash(userId: string, otp: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashResetOtp(userId, otp), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Issue a 6-digit password reset OTP with uniform sliding-window rate limiting across all emails.
 */
export async function requestPasswordResetOtp(email: string): Promise<{ rateLimited: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  const recentTimestamps = (rateLimitStore.get(normalizedEmail) ?? []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitStore.set(normalizedEmail, recentTimestamps);
    return { rateLimited: true };
  }

  recentTimestamps.push(now);
  rateLimitStore.set(normalizedEmail, recentTimestamps);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive) {
    return { rateLimited: false };
  }

  const recentCount = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(windowStart) },
    },
  });

  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { rateLimited: true };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = hashResetOtp(user.id, otp);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    }),
  ]);

  await sendPasswordResetEmail(user.email, otp);

  return { rateLimited: false };
}

/**
 * Verify a password reset OTP atomically, update the password hash, revoke refresh tokens, and log the audit event.
 */
export async function completePasswordReset(input: {
  email: string;
  otp: string;
  newPassword: string;
  ipAddress?: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return { ok: false, code: ERROR_CODES.OTP_INVALID, message: 'Invalid or expired verification code', status: 401 };
  }

  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!tokenRecord) {
    return { ok: false, code: ERROR_CODES.OTP_EXPIRED, message: 'Verification code expired or not found', status: 401 };
  }

  if (tokenRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.passwordResetToken.updateMany({
      where: { id: tokenRecord.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return { ok: false, code: ERROR_CODES.OTP_EXPIRED, message: 'Too many invalid attempts. Request a new code.', status: 401 };
  }

  if (!verifyResetOtpHash(user.id, input.otp, tokenRecord.otpHash)) {
    await prisma.passwordResetToken.updateMany({
      where: { id: tokenRecord.id, usedAt: null },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, code: ERROR_CODES.OTP_INVALID, message: 'Invalid verification code', status: 401 };
  }

  const passwordHash = await hashPassword(input.newPassword);

  const wasConsumed = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: tokenRecord.id,
        usedAt: null,
        attempts: { lt: MAX_VERIFY_ATTEMPTS },
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      return false;
    }

    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return true;
  });

  if (!wasConsumed) {
    return { ok: false, code: ERROR_CODES.OTP_EXPIRED, message: 'Verification code expired or not found', status: 401 };
  }

  await createAuditLog({
    actorId: user.id,
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    entityType: 'User',
    entityId: user.id,
    ipAddress: input.ipAddress,
  });

  return { ok: true };
}
