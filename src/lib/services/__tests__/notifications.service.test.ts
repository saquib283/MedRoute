import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { canAccessRoute } from '@/lib/auth/rbac';
import {
  GET as getNotifications,
  PATCH as patchNotifications,
} from '@/app/api/v1/notifications/route';

const mockedPrisma = prisma as unknown as {
  notification: Record<string, jest.Mock>;
};

describe('Task 2: In-App Notification Reader APIs & RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants /notifications route access to PATIENT, MANAGER, DOCTOR, and ADMIN', () => {
    expect(canAccessRoute('PATIENT', '/notifications')).toBe(true);
    expect(canAccessRoute('MANAGER', '/notifications')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/notifications')).toBe(true);
    expect(canAccessRoute('ADMIN', '/notifications')).toBe(true);
  });

  it('rejects unauthenticated GET and PATCH requests with 401', async () => {
    const getReq = new NextRequest('http://localhost/api/v1/notifications');
    const getRes = await getNotifications(getReq);
    expect(getRes.status).toBe(401);

    const patchReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    const patchRes = await patchNotifications(patchReq);
    expect(patchRes.status).toBe(401);
  });

  it('lists notifications strictly scoped to authUser.userId with unreadCount on GET /api/v1/notifications', async () => {
    mockedPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'u-pat-1',
        channel: 'IN_APP',
        title: 'Coordinator Assigned',
        body: 'Your coordinator is ready.',
        isRead: false,
        sentAt: new Date('2026-11-23T10:00:00.000Z'),
      },
    ]);
    mockedPrisma.notification.count.mockResolvedValue(1);

    const req = new NextRequest(
      'http://localhost/api/v1/notifications?limit=15&unreadOnly=true&userId=u-victim',
      {
        headers: {
          'x-user-id': 'u-pat-1',
          'x-user-email': 'p@example.com',
          'x-user-role': 'PATIENT',
        },
      }
    );
    const res = await getNotifications(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.unreadCount).toBe(1);
    expect(json.data.notifications).toHaveLength(1);
    expect(mockedPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-pat-1', isRead: false },
        orderBy: { sentAt: 'desc' },
        take: 15,
      })
    );
    expect(mockedPrisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'u-pat-1', isRead: false },
    });
  });

  it('clamps limit to 1..50 (default 20) on GET /api/v1/notifications', async () => {
    mockedPrisma.notification.findMany.mockResolvedValue([]);
    mockedPrisma.notification.count.mockResolvedValue(0);

    const reqOver = new NextRequest('http://localhost/api/v1/notifications?limit=250', {
      headers: {
        'x-user-id': 'u-doc-1',
        'x-user-email': 'd@example.com',
        'x-user-role': 'DOCTOR',
      },
    });
    const resOver = await getNotifications(reqOver);
    expect(resOver.status).toBe(200);
    expect(mockedPrisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 'u-doc-1' },
        take: 50,
      })
    );

    const reqDefault = new NextRequest('http://localhost/api/v1/notifications', {
      headers: {
        'x-user-id': 'u-doc-1',
        'x-user-email': 'd@example.com',
        'x-user-role': 'DOCTOR',
      },
    });
    const resDefault = await getNotifications(reqDefault);
    expect(resDefault.status).toBe(200);
    expect(mockedPrisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 'u-doc-1' },
        take: 20,
      })
    );
  });

  it('blocks cross-user IDOR on PATCH /api/v1/notifications (403) and supports single + markAllRead updates', async () => {
    mockedPrisma.notification.findUnique.mockResolvedValueOnce({
      id: 'notif-other',
      userId: 'u-other',
      isRead: false,
    });

    const idorReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ notificationId: 'notif-other', userId: 'u-other' }),
    });
    const idorRes = await patchNotifications(idorReq);
    expect(idorRes.status).toBe(403);
    expect(mockedPrisma.notification.update).not.toHaveBeenCalled();

    // Valid single mark-read
    mockedPrisma.notification.findUnique.mockResolvedValueOnce({
      id: 'notif-1',
      userId: 'u-pat-1',
      isRead: false,
    });
    mockedPrisma.notification.update.mockResolvedValueOnce({ id: 'notif-1', isRead: true });
    mockedPrisma.notification.count.mockResolvedValueOnce(2);

    const singleReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ notificationId: 'notif-1' }),
    });
    const singleRes = await patchNotifications(singleReq);
    const singleJson = await singleRes.json();
    expect(singleRes.status).toBe(200);
    expect(singleJson.data.unreadCount).toBe(2);

    // Mark all read
    mockedPrisma.notification.updateMany.mockResolvedValueOnce({ count: 2 });
    mockedPrisma.notification.count.mockResolvedValueOnce(0);

    const allReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ markAllRead: true }),
    });
    const allRes = await patchNotifications(allReq);
    const allJson = await allRes.json();
    expect(allRes.status).toBe(200);
    expect(allJson.data.unreadCount).toBe(0);
    expect(mockedPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-pat-1', isRead: false },
      data: { isRead: true },
    });
  });

  it('returns 404 for missing notificationId and 400 when neither notificationId nor markAllRead: true is provided', async () => {
    mockedPrisma.notification.findUnique.mockResolvedValueOnce(null);

    const notFoundReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ notificationId: 'notif-missing' }),
    });
    const notFoundRes = await patchNotifications(notFoundReq);
    expect(notFoundRes.status).toBe(404);

    const emptyReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({}),
    });
    const emptyRes = await patchNotifications(emptyReq);
    expect(emptyRes.status).toBe(400);

    const falseAllReq = new NextRequest('http://localhost/api/v1/notifications', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ markAllRead: false }),
    });
    const falseAllRes = await patchNotifications(falseAllReq);
    expect(falseAllRes.status).toBe(400);
  });
});
