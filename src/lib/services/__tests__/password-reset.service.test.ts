const mockResetTokenCount = jest.fn();
const mockResetTokenUpdateMany = jest.fn();
const mockResetTokenCreate = jest.fn();
const mockResetTokenFindFirst = jest.fn();
const mockResetTokenUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockRefreshTokenUpdateMany = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    passwordResetToken: {
      count: (...args: unknown[]) => mockResetTokenCount(...args),
      updateMany: (...args: unknown[]) => mockResetTokenUpdateMany(...args),
      create: (...args: unknown[]) => mockResetTokenCreate(...args),
      findFirst: (...args: unknown[]) => mockResetTokenFindFirst(...args),
      update: (...args: unknown[]) => mockResetTokenUpdate(...args),
    },
    refreshToken: {
      updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import {
  hashResetOtp,
  verifyResetOtpHash,
  requestPasswordResetOtp,
  completePasswordReset,
} from '../password-reset.service';

describe('password-reset.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('salts SHA-256 OTP hash with userId and verifies in constant time', () => {
    const hash = hashResetOtp('user-123', '482910');
    expect(verifyResetOtpHash('user-123', '482910', hash)).toBe(true);
    expect(verifyResetOtpHash('user-123', '482911', hash)).toBe(false);
    expect(verifyResetOtpHash('other-user', '482910', hash)).toBe(false);
    expect(verifyResetOtpHash('user-123', '482910', 'bad-length')).toBe(false);
  });

  it('enforces 3-request rate limit within 15 minutes', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenCount.mockResolvedValue(3);
    const res = await requestPasswordResetOtp('pat@example.com');
    expect(res.rateLimited).toBe(true);
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
  });

  it('silently returns rateLimited=false for unknown or inactive users without creating tokens', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const missingRes = await requestPasswordResetOtp('missing@example.com');
    expect(missingRes.rateLimited).toBe(false);
    expect(mockResetTokenCount).not.toHaveBeenCalled();

    mockUserFindUnique.mockResolvedValueOnce({ id: 'u-2', email: 'inactive@example.com', isActive: false });
    const inactiveRes = await requestPasswordResetOtp('inactive@example.com');
    expect(inactiveRes.rateLimited).toBe(false);
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
  });

  it('invalidates prior unused tokens and creates a new hashed OTP token when under rate limit', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenCount.mockResolvedValue(1);
    mockResetTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockResetTokenCreate.mockResolvedValue({ id: 'tok-new' });

    const res = await requestPasswordResetOtp('  PAT@Example.com ');

    expect(res.rateLimited).toBe(false);
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { email: 'pat@example.com' } });
    expect(mockResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockResetTokenCreate).toHaveBeenCalledWith({
      data: {
        userId: 'u-1',
        otpHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('locks out token after 5 failed verification attempts', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '123456'),
      attempts: 5,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '123456',
      newPassword: 'NewPassword@123',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('OTP_EXPIRED');
    expect(mockResetTokenUpdate).toHaveBeenCalled();
  });

  it('increments attempts on invalid OTP and returns OTP_INVALID', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '123456'),
      attempts: 2,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    mockResetTokenUpdate.mockResolvedValue({});

    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '000000',
      newPassword: 'NewPassword@123',
    });

    expect(res).toEqual({
      ok: false,
      code: 'OTP_INVALID',
      message: 'Invalid verification code',
      status: 401,
    });
    expect(mockResetTokenUpdate).toHaveBeenCalledWith({
      where: { id: 'tok-1' },
      data: { attempts: { increment: 1 } },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('updates passwordHash, marks token used, revokes refresh tokens, and logs audit on valid OTP', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '654321'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    mockUserUpdate.mockResolvedValue({});
    mockResetTokenUpdate.mockResolvedValue({});
    mockRefreshTokenUpdateMany.mockResolvedValue({ count: 2 });
    mockAuditCreate.mockResolvedValue({});

    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '654321',
      newPassword: 'NewPassword@123',
      ipAddress: '203.0.113.10',
    });

    expect(res).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
    });
    expect(mockResetTokenUpdate).toHaveBeenCalledWith({
      where: { id: 'tok-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u-1',
        action: 'RESET_PASSWORD',
        entityType: 'User',
        entityId: 'u-1',
        ipAddress: '203.0.113.10',
      }),
    });
  });
});
