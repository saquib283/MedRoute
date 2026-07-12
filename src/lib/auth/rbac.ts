/**
 * MediRoute India — RBAC (Role-Based Access Control)
 * Implements the permission matrix from PRD FR-AUTH-02.
 */

import type { UserRole } from '@prisma/client';

// ─── Permission Definitions ─────────────────────────────────────────

export const PERMISSIONS = {
  // Profile
  'view:own-profile': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'edit:own-profile': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Patient Management
  'view:all-patients': ['ADMIN', 'SUPER_ADMIN'],
  'view:own-patients': ['MANAGER'],
  'view:own-case': ['PATIENT'],

  // Case Management
  'create:case': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'edit:case': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'view:case': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Appointments
  'book:appointment': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'request:appointment': ['PATIENT'],
  'cancel:appointment': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'view:appointments': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Partners
  'manage:hospitals': ['ADMIN', 'SUPER_ADMIN'],
  'manage:hostels': ['ADMIN', 'SUPER_ADMIN'],
  'manage:doctors': ['ADMIN', 'SUPER_ADMIN'],
  'view:partners': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Analytics & Reports
  'view:analytics': ['ADMIN', 'SUPER_ADMIN'],
  'view:limited-analytics': ['MANAGER'],
  'export:reports': ['ADMIN', 'SUPER_ADMIN'],

  // User Management
  'manage:users': ['ADMIN', 'SUPER_ADMIN'],
  'manage:managers': ['ADMIN', 'SUPER_ADMIN'],
  'view:audit-logs': ['ADMIN', 'SUPER_ADMIN'],

  // Settings
  'manage:settings': ['ADMIN', 'SUPER_ADMIN'],
  'manage:specialisations': ['ADMIN', 'SUPER_ADMIN'],
  'manage:notification-templates': ['ADMIN', 'SUPER_ADMIN'],

  // Documents
  'upload:documents': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'view:documents': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Messaging
  'send:messages': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'view:messages': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],

  // Escalation
  'escalate:case': ['MANAGER'],
  'view:escalations': ['ADMIN', 'SUPER_ADMIN'],

  // Notifications
  'manage:notification-preferences': ['PATIENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
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
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/patient': ['PATIENT'],
  '/manager': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  '/admin': ['ADMIN', 'SUPER_ADMIN'],
  '/doctor': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
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
    case 'MANAGER':
      return '/manager/dashboard';
    case 'DOCTOR':
      return '/doctor/dashboard';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
