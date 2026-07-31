/**
 * Afzal Healthcare — Next.js Proxy
 * Route protection with JWT validation and role-based access control.
 * Runs on the Edge runtime, using `jose` for JWT verification.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { canAccessRoute, getDefaultRoute, ROUTE_ROLES } from '@/lib/auth/rbac';
import type { UserRole } from '@prisma/client';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/login/otp/request',
  '/api/v1/auth/login/otp/verify',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
];

// Static assets and internal routes to skip
const SKIP_ROUTES = ['/_next', '/favicon.ico', '/api/docs'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and internal Next.js routes
  if (SKIP_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Root path — redirect to login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ─── Extract and verify JWT ───────────────────────────────────

  // Extract JWT (HttpOnly cookie first for browser requests, fallback header for API clients)
  const cookieToken = request.cookies.get('access_token')?.value;
  const authHeader = request.headers.get('authorization');
  const token = cookieToken || authHeader?.replace('Bearer ', '');


  if (!token) {
    // API routes return 401, page routes redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const payload = await verifyAccessToken(token);

    // ─── Role-based route access ──────────────────────────────

    const role = payload.role as UserRole;

    // Check if the route requires a specific role
    const isProtectedRoute = Object.keys(ROUTE_ROLES).some((prefix) =>
      pathname.startsWith(prefix) || pathname.startsWith(`/api/v1${prefix}`)
    );

    if (isProtectedRoute) {
      // For API routes, check /api/v1/admin -> /admin etc.
      const routeToCheck = pathname.startsWith('/api/v1')
        ? pathname.replace('/api/v1', '')
        : pathname;

      if (!canAccessRoute(role, routeToCheck)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
              },
            },
            { status: 403 }
          );
        }
        // Redirect to user's appropriate dashboard
        return NextResponse.redirect(
          new URL(getDefaultRoute(role), request.url)
        );
      }
    }

    // ─── Inject user info into request headers ──────────────────

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-email', payload.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Token invalid or expired
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired or invalid' },
        },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
