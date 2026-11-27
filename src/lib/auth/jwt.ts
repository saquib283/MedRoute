/**
 * Afzal Healthcare — JWT Utilities
 * Uses `jose` for Edge-compatible JWT operations.
 * Access tokens: 15 min, Refresh tokens: 7 days per PRD Section 5.3.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserRole } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  role: UserRole;
  email: string;
  hospitalId?: string | null;
  fullName?: string | null;
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  tokenId: string; // Maps to RefreshToken.id for rotation tracking
}

// ─── Helpers ────────────────────────────────────────────────────────

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

// ─── Access Token ───────────────────────────────────────────────────

export async function signAccessToken(payload: {
  userId: string;
  role: UserRole;
  email: string;
  hospitalId?: string | null;
  fullName?: string | null;
}): Promise<string> {
  const tokenPayload: AccessTokenPayload = {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
  if (payload.hospitalId) tokenPayload.hospitalId = payload.hospitalId;
  if (payload.fullName) tokenPayload.fullName = payload.fullName;

  return new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRY || '15m')
    .setIssuer('Afzal Healthcare')
    .sign(getAccessSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret(), {
    issuer: 'Afzal Healthcare',
  });
  return payload as AccessTokenPayload;
}

// ─── Refresh Token ──────────────────────────────────────────────────

export async function signRefreshToken(payload: {
  userId: string;
  tokenId: string;
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    tokenId: payload.tokenId,
  } as RefreshTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(
      `${process.env.JWT_REFRESH_EXPIRY_DAYS || '7'}d`
    )
    .setIssuer('Afzal Healthcare')
    .sign(getRefreshSecret());
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret(), {
    issuer: 'Afzal Healthcare',
  });
  return payload as RefreshTokenPayload;
}
