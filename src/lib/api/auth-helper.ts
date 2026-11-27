/**
 * Afzal Healthcare — API Route Helper
 * Extracts authenticated user info from middleware-injected headers.
 */

import { type NextRequest } from 'next/server';
import type { UserRole } from '@prisma/client';
import { hasPermission, type Permission } from '@/lib/auth/rbac';
import { forbidden, unauthorized } from '@/lib/api/response';

export interface AuthUser {
  userId: string;
  role: UserRole;
  email: string;
  hospitalId?: string | null;
  fullName?: string | null;
}

/**
 * Extract authenticated user from request headers (set by middleware).
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role') as UserRole | null;
  const email = request.headers.get('x-user-email');
  const hospitalId = request.headers.get('x-user-hospital-id') || null;
  const fullName = request.headers.get('x-user-full-name') || null;

  if (!userId || !role || !email) return null;

  return { userId, role, email, hospitalId, fullName };
}

/**
 * Require authentication — returns user or throws 401.
 */
export function requireAuth(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return { user: null, error: unauthorized() };
  }
  return { user, error: null };
}

/**
 * Require specific permission — returns user or throws 403.
 */
export function requirePermission(request: NextRequest, permission: Permission) {
  const { user, error } = requireAuth(request);
  if (error) return { user: null, error };

  if (!hasPermission(user!.role, permission)) {
    return { user: null, error: forbidden() };
  }

  return { user: user!, error: null };
}

/**
 * Get client IP address from request.
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

import { cookies } from 'next/headers';

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 mins
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}

/**
 * Extract refresh token from HttpOnly cookie first, falling back to JSON body.
 * Returns null cleanly when both cookie and body are absent or unparseable.
 */
export async function extractRefreshTokenFromRequest(request: NextRequest): Promise<string | null> {
  const cookieToken = request.cookies.get('refresh_token')?.value;
  if (cookieToken) return cookieToken;
  try {
    const body = await request.json();
    return typeof body?.refreshToken === 'string' ? body.refreshToken : null;
  } catch {
    return null;
  }
}
