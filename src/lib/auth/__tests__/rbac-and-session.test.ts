import { NextRequest } from 'next/server';
import { canAccessRoute, getDefaultRoute, hasPermission, PUBLIC_ROUTES, SKIP_ROUTES } from '../rbac';
import { extractRefreshTokenFromRequest } from '@/lib/api/auth-helper';

describe('RBAC & Edge Proxy Route Protection', () => {
  it('restricts /doctor routes exclusively to DOCTOR role', () => {
    expect(canAccessRoute('DOCTOR', '/doctor/dashboard')).toBe(true);
    expect(canAccessRoute('PATIENT', '/doctor/patients')).toBe(false);
    expect(canAccessRoute('MANAGER', '/doctor/appointments')).toBe(false);
  });

  it('grants PATIENT permission to send messages and maps DOCTOR default route', () => {
    expect(hasPermission('PATIENT', 'send:messages')).toBe(true);
    expect(hasPermission('DOCTOR', 'view:appointments')).toBe(true);
    expect(getDefaultRoute('DOCTOR')).toBe('/doctor/dashboard');
  });

  it('whitelists 2FA setup/validate, logout, and static assets in PUBLIC_ROUTES / SKIP_ROUTES', () => {
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/2fa/setup');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/2fa/validate');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/logout');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/forgot-password');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/reset-password');
    expect(SKIP_ROUTES).toContain('/assets');
    expect(SKIP_ROUTES).toContain('/icon.png');
  });
});

describe('extractRefreshTokenFromRequest', () => {
  it('prefers refresh_token HttpOnly cookie over JSON body', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'refresh_token=cookie-token-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: 'body-token-456' }),
    });
    await expect(extractRefreshTokenFromRequest(req)).resolves.toBe('cookie-token-123');
  });

  it('falls back to JSON body refreshToken when cookie is absent', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'body-token-456' }),
    });
    await expect(extractRefreshTokenFromRequest(req)).resolves.toBe('body-token-456');
  });

  it('returns null cleanly on empty body when cookie is absent', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/logout', {
      method: 'POST',
    });
    await expect(extractRefreshTokenFromRequest(req)).resolves.toBeNull();
  });
});
