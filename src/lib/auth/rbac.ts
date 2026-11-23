/**
 * Afzal Healthcare — RBAC (Role-Based Access Control)
 * Implements the permission matrix from PRD FR-AUTH-02.
 */

import type { UserRole } from '@prisma/client';

// ─── Permission Definitions ─────────────────────────────────────────

export const PERMISSIONS = {
  // Profile
  'view:own-profile': ['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR'],
  'edit:own-profile': ['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR'],

  // Patient Management
  'view:all-patients': ['ADMIN'],
  'view:own-patients': ['MANAGER'],
  'view:own-case': ['PATIENT'],

  // Case Management
  'create:case': ['MANAGER', 'ADMIN'],
  'edit:case': ['MANAGER', 'ADMIN'],
  'view:case': ['PATIENT', 'MANAGER', 'ADMIN'],

  // Appointments
  'book:appointment': ['MANAGER', 'ADMIN'],
  'request:appointment': ['PATIENT'],
  'cancel:appointment': ['MANAGER', 'ADMIN'],
  'view:appointments': ['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR'],

  // Partners
  'manage:hospitals': ['ADMIN'],
  'manage:doctors': ['ADMIN'],
  'view:partners': ['MANAGER', 'ADMIN'],

  // Analytics & Reports
  'view:analytics': ['ADMIN'],
  'view:limited-analytics': ['MANAGER'],
  'export:reports': ['ADMIN'],

  // User Management
  'manage:users': ['ADMIN'],
  'manage:managers': ['ADMIN'],
  'view:audit-logs': ['ADMIN'],

  // Settings
  'manage:settings': ['ADMIN'],
  'manage:specialisations': ['ADMIN'],
  'manage:notification-templates': ['ADMIN'],

  // Documents
  'upload:documents': ['PATIENT', 'MANAGER', 'ADMIN'],
  'view:documents': ['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR'],

  // Messaging
  'send:messages': ['PATIENT', 'MANAGER', 'ADMIN'],
  'view:messages': ['PATIENT', 'MANAGER', 'ADMIN'],

  // Escalation
  'escalate:case': ['MANAGER'],
  'view:escalations': ['ADMIN'],

  // Notifications
  'manage:notification-preferences': ['PATIENT', 'MANAGER', 'ADMIN'],

  // Email Campaigns & Advanced Analytics (Admin-level)
  'manage:email-campaigns': ['ADMIN'],
  'manage:email-templates': ['ADMIN'],
  'view:advanced-analytics': ['ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Permission Checks ─────────────────────────────────────────────

/**
 * Check if a user role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return (allowedRoles as readonly string[]).includes(role);
}

/**
 * Check if a user role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a user role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a given role.
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return (Object.entries(PERMISSIONS) as [Permission, readonly string[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

// ─── Route → Role Mapping ───────────────────────────────────────────

/**
 * Maps route group prefixes to the minimum required role(s).
 * Used by Next.js middleware for route protection.
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/2fa/setup',
  '/api/v1/auth/2fa/validate',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
] as const;

export const SKIP_ROUTES = ['/_next', '/favicon.ico', '/icon.png', '/assets', '/api/docs'] as const;

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/patient': ['PATIENT'],
  '/doctor': ['DOCTOR'],
  '/manager': ['MANAGER', 'ADMIN'],
  '/admin': ['ADMIN'],
};

/**
 * Check if a role can access a given route.
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  for (const [prefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(prefix)) {
      return allowedRoles.includes(role);
    }
  }
  // No role restriction on this route
  return true;
}

/**
 * Get the default dashboard route for a role.
 */
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'PATIENT':
      return '/patient/dashboard';
    case 'DOCTOR':
      return '/doctor/dashboard';
    case 'MANAGER':
      return '/manager/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
