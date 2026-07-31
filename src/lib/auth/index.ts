/**
 * Afzal Healthcare — Auth Module Barrel Export
 */

export { hashPassword, verifyPassword } from './password';
export {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from './jwt';
export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAccessRoute,
  getDefaultRoute,
  PERMISSIONS,
  ROUTE_ROLES,
  type Permission,
} from './rbac';
export { generateTOTPSecret, verifyTOTP } from './totp';
export { encrypt, decrypt } from './crypto';

