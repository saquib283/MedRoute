const mockResetTokenCount = jest.fn();
const mockResetTokenUpdateMany = jest.fn();
const mockResetTokenCreate = jest.fn();
const mockResetTokenFindFirst = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockRefreshTokenUpdateMany = jest.fn();
const mockAuditCreate = jest.fn();

const mockPrismaTx = {
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    update: (...args: unknown[]) => mockUserUpdate(...args),
  },
  passwordResetToken: {
    count: (...args: unknown[]) => mockResetTokenCount(...args),
    updateMany: (...args: unknown[]) => mockResetTokenUpdateMany(...args),
    create: (...args: unknown[]) => mockResetTokenCreate(...args),
    findFirst: (...args: unknown[]) => mockResetTokenFindFirst(...args),
  },
  refreshToken: {
    updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
  },
  auditLog: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
};

const mockPrismaClient = {
  ...mockPrismaTx,
  $transaction: (
    arg: Promise<unknown>[] | ((tx: typeof mockPrismaTx) => Promise<unknown>)
  ) => (typeof arg === 'function' ? arg(mockPrismaTx) : Promise.all(arg)),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrismaClient,
}));

import {
  hashResetOtp,
  verifyResetOtpHash,
  requestPasswordResetOtp,
  completePasswordReset,
  resetRateLimitStoreForTests,
} from '../password-reset.service';

describe('password-reset.service', () => {
  const originalWebhook = process.env.PASSWORD_RESET_WEBHOOK_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStoreForTests();
    delete process.env.PASSWORD_RESET_WEBHOOK_URL;
  });

  afterAll(() => {
    if (originalWebhook === undefined) {
      delete process.env.PASSWORD_RESET_WEBHOOK_URL;
    } else {
      process.env.PASSWORD_RESET_WEBHOOK_URL = originalWebhook;
    }
  });

  it('salts SHA-256 OTP hash with userId and verifies in constant time', () => {
    const hash = hashResetOtp('user-123', '482910');
    expect(verifyResetOtpHash('user-123', '482910', hash)).toBe(true);
    expect(verifyResetOtpHash('user-123', '482911', hash)).toBe(false);
    expect(verifyResetOtpHash('other-user', '482910', hash)).toBe(false);
    expect(verifyResetOtpHash('user-123', '482910', 'bad-length')).toBe(false);
  });

  it('enforces 3-request DB backup rate limit within 15 minutes for active users', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenCount.mockResolvedValue(3);
    const res = await requestPasswordResetOtp('pat@example.com');
    expect(res.rateLimited).toBe(true);
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
  });

  it('enforces uniform 3-request sliding-window rate limit on unknown emails without leaking account existence', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    expect(await requestPasswordResetOtp('unknown@example.com')).toEqual({ rateLimited: false });
    expect(await requestPasswordResetOtp('UNKNOWN@example.com ')).toEqual({ rateLimited: false });
    expect(await requestPasswordResetOtp('unknown@example.com')).toEqual({ rateLimited: false });

    const fourth = await requestPasswordResetOtp('unknown@example.com');
    expect(fourth).toEqual({ rateLimited: true });
    expect(mockUserFindUnique).toHaveBeenCalledTimes(3);
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
  });

  it('silently returns rateLimited=false for inactive users without creating tokens', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-2', email: 'inactive@example.com', isActive: false });
    const inactiveRes = await requestPasswordResetOtp('inactive@example.com');
    expect(inactiveRes.rateLimited).toBe(false);
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
  });

  it('invalidates prior unused tokens, creates a new hashed OTP token, and stays silent in test env', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

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
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('posts OTP payload to PASSWORD_RESET_WEBHOOK_URL when configured', async () => {
    process.env.PASSWORD_RESET_WEBHOOK_URL = 'https://mailer.example.test/otp';
    const originalFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
      mockResetTokenCount.mockResolvedValue(0);
      mockResetTokenUpdateMany.mockResolvedValue({ count: 0 });
      mockResetTokenCreate.mockResolvedValue({ id: 'tok-hook' });

      const res = await requestPasswordResetOtp('pat@example.com');
      expect(res.rateLimited).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('https://mailer.example.test/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringMatching(/"to":"pat@example.com".*"purpose":"PASSWORD_RESET"/),
      });
    } finally {
      global.fetch = originalFetch;
    }
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
    mockResetTokenUpdateMany.mockResolvedValue({ count: 1 });

    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '123456',
      newPassword: 'NewPassword@123',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('OTP_EXPIRED');
    expect(mockResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('increments attempts with usedAt: null guard on invalid OTP and returns OTP_INVALID', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '123456'),
      attempts: 2,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    mockResetTokenUpdateMany.mockResolvedValue({ count: 1 });

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
    expect(mockResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', usedAt: null },
      data: { attempts: { increment: 1 } },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('returns OTP_EXPIRED without updating password when concurrent request already consumed token', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '654321'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    mockResetTokenUpdateMany.mockResolvedValue({ count: 0 });

    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '654321',
      newPassword: 'NewPassword@123',
    });

    expect(res).toEqual({
      ok: false,
      code: 'OTP_EXPIRED',
      message: 'Verification code expired or not found',
      status: 401,
    });
    expect(mockResetTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'tok-1',
        usedAt: null,
        attempts: { lt: 5 },
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockRefreshTokenUpdateMany).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('atomically consumes token, updates passwordHash, revokes refresh tokens, and logs audit on valid OTP', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u-1', email: 'pat@example.com', isActive: true });
    mockResetTokenFindFirst.mockResolvedValue({
      id: 'tok-1',
      userId: 'u-1',
      otpHash: hashResetOtp('u-1', '654321'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
    });
    mockResetTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockUserUpdate.mockResolvedValue({});
    mockRefreshTokenUpdateMany.mockResolvedValue({ count: 2 });
    mockAuditCreate.mockResolvedValue({});

    const res = await completePasswordReset({
      email: 'pat@example.com',
      otp: '654321',
      newPassword: 'NewPassword@123',
      ipAddress: '203.0.113.10',
    });

    expect(res).toEqual({ ok: true });
    expect(mockResetTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'tok-1',
        usedAt: null,
        attempts: { lt: 5 },
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
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
