# MedRoute Sub-Project 4: Platform Governance (`SystemConfig`), In-App Notifications, Campaign/CSV Security & Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate platform settings from mutable disk files to Prisma `SystemConfig` with full runtime governance (`maxPatientsPerManager`, `defaultCommissionRate`, `sessionTimeoutMinutes`, `maintenanceMode`, `alertBannerText`), deliver universal in-app Notification reader APIs and `<NotificationBell />` across all 4 portals, harden Email Campaigns and CSV exports against XSS/formula injection with full 7-placeholder interpolation, and complete final audit polish (`emergencyCountryCode`, smart chat scroll, `INSURANCE` filter tab, idempotent `seed.ts`, unused shelfware pruning, and `0`-warning repo-wide ESLint).

**Architecture:** Governance, notification, and email-campaign business logic live in unit-tested server services (`src/lib/services/system-settings.service.ts`, `notifications.service.ts`, `email-campaign.service.ts`) while client-shared HTML sanitization lives in zero-Prisma `src/lib/validation/email-sanitizer.ts`. Next.js 16's Node-runtime `src/proxy.ts` enforces `maintenanceMode` across portal navigations and mutating non-Admin APIs, while `route.ts` files strictly export HTTP verb handlers only.

**Tech Stack:** Next.js 16.2.9 (App Router, `src/proxy.ts` Node runtime), React 19, TypeScript 5, Prisma 6.19 (MySQL), Zod 4, Jest 30 (`ts-jest`), Tailwind CSS 4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-23-medroute-phase4-governance-notifications-security-design.md`

## Global Constraints

- **Next.js 16 Export Rules (`AGENTS.md`):** App Router `route.ts` files MUST ONLY export HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), and `src/proxy.ts` MUST ONLY export `default function proxy` and `config`. Never export interfaces, schemas, constants, or helpers from `route.ts` or `src/proxy.ts`.
- **Client/Server Import Boundary:** Client components (`'use client'`) MUST NEVER import files that import `@/lib/prisma`. Place pure shared validators/sanitizers in `src/lib/validation/*`.
- **Database & Env Safety:** Never run `prisma migrate reset`, `DROP`, or modify `.env`. Always import singleton `prisma` from `@/lib/prisma` (never `new PrismaClient()`).
- **UTF-8 Encoding:** Write all created and modified files as UTF-8 **without BOM** (`\uFEFF`).
- **Zod Partial Update Safety:** Never use `.optional().transform(v => v || null)` without preserving `undefined` (`if (v === undefined) return undefined;`).
- **Zero-Warning Lint Standard:** Every touched file in Tasks 1–3 must pass `npx eslint --max-warnings=0`, and Task 4 brings the entire repository to `npx eslint . --max-warnings=0` (`0` errors, `0` warnings).

---

### Task 1: `SystemConfig` Governance Service & Runtime Enforcement

**Files:**
- Create: `src/lib/services/system-settings.service.ts`
- Modify: `src/lib/api/errors.ts`
- Modify: `src/lib/api/settings-helper.ts`
- Modify: `src/app/api/v1/admin/settings/route.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/api/v1/auth/login/route.ts`
- Modify: `src/app/api/v1/auth/me/route.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/SessionTimeoutProvider.tsx`
- Modify: `src/lib/services/onboarding.service.ts`
- Modify: `src/lib/services/case-assignment.service.ts`
- Modify: `src/app/api/v1/admin/hospitals/route.ts`
- Modify: `src/lib/services/accommodations.service.ts`
- Modify: `src/app/api/v1/accommodations/route.ts`
- Test: `src/lib/services/__tests__/system-settings.service.test.ts`

**Interfaces:**
- Consumes: `prisma.systemConfig` (`key`, `value`, `updatedAt`), `prisma.patient`, `prisma.hospital`, `prisma.hotel`, `createAuditLog` (`AUDIT_ACTIONS.SETTINGS_UPDATE`).
- Produces:
  - `ERROR_CODES.MAINTENANCE_MODE = 'MAINTENANCE_MODE'` in `src/lib/api/errors.ts`.
  - `SystemSettings`, `DEFAULT_SYSTEM_SETTINGS`, `getSystemSettings()`, `updateSystemSettings(input, actor)`, `checkMaintenanceActive(role?, now?)`, `assertManagerCapacity(db, managerId, incomingNewPatients, excludePatientIds?)`, `clearSystemSettingsCache()` in `src/lib/services/system-settings.service.ts`.
  - `createPartnerHotel(params)` in `src/lib/services/accommodations.service.ts` (bringing `POST /api/v1/accommodations` into validation parity with `PUT` and defaulting `commissionPercent` to `settings.defaultCommissionRate`).
  - `GET /api/v1/auth/me` returning `{ user, alertBannerText, sessionTimeoutMinutes }`.

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/system-settings.service.test.ts`)**

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    patient: {
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    hospital: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    hotel: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  clearSystemSettingsCache,
  getSystemSettings,
  updateSystemSettings,
  checkMaintenanceActive,
  assertManagerCapacity,
} from '@/lib/services/system-settings.service';
import { assignPatientCoordinator } from '@/lib/services/case-assignment.service';
import { POST as postHospital } from '@/app/api/v1/admin/hospitals/route';
import { POST as postAccommodation } from '@/app/api/v1/accommodations/route';
import proxy from '@/proxy';
import { signAccessToken } from '@/lib/auth/jwt';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>> & {
  $transaction: jest.Mock;
};

describe('Task 1: SystemConfig Governance Service & Runtime Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSystemSettingsCache();
    mockedPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(mockedPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('reads and updates SystemConfig rows in DB and invalidates cache immediately', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValueOnce([
      { key: 'maxPatientsPerManager', value: '12' },
      { key: 'defaultCommissionRate', value: '14.5' },
      { key: 'maintenanceMode', value: 'false' },
      { key: 'sessionTimeoutMinutes', value: '30' },
      { key: 'maintenanceStart', value: '""' },
      { key: 'maintenanceEnd', value: '""' },
      { key: 'alertBannerText', value: '"Sunday Window"' },
    ]);

    const initial = await getSystemSettings();
    expect(initial.maxPatientsPerManager).toBe(12);
    expect(initial.defaultCommissionRate).toBe(14.5);
    expect(initial.sessionTimeoutMinutes).toBe(30);
    expect(initial.alertBannerText).toBe('Sunday Window');

    mockedPrisma.systemConfig.upsert.mockResolvedValue({});
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const res = await updateSystemSettings(
      {
        maxPatientsPerManager: 8,
        defaultCommissionRate: 16,
        maintenanceMode: true,
        sessionTimeoutMinutes: 20,
        maintenanceStart: '',
        maintenanceEnd: '',
        alertBannerText: 'Maintenance Active',
      },
      { userId: 'adm-1', ipAddress: '127.0.0.1' }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.maxPatientsPerManager).toBe(8);
      expect(res.data.maintenanceMode).toBe(true);
    }
    expect(mockedPrisma.systemConfig.upsert).toHaveBeenCalledTimes(7);
  });

  it('enforces checkMaintenanceActive for manual toggle and scheduled window while bypassing ADMIN', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maintenanceMode', value: 'false' },
      { key: 'maintenanceStart', value: '"2026-11-23T10:00:00.000Z"' },
      { key: 'maintenanceEnd', value: '"2026-11-23T12:00:00.000Z"' },
    ]);

    const duringWindow = new Date('2026-11-23T11:00:00.000Z');
    expect(await checkMaintenanceActive('PATIENT', duringWindow)).toBe(true);
    expect(await checkMaintenanceActive('MANAGER', duringWindow)).toBe(true);
    expect(await checkMaintenanceActive('ADMIN', duringWindow)).toBe(false);

    const outsideWindow = new Date('2026-11-23T14:00:00.000Z');
    expect(await checkMaintenanceActive('PATIENT', outsideWindow)).toBe(false);
  });

  it('blocks non-Admin mutating API calls in proxy.ts with 503 MAINTENANCE_MODE when maintenance is active', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maintenanceMode', value: 'true' },
    ]);

    const patToken = await signAccessToken({
      userId: 'u-pat-1',
      email: 'p@example.com',
      role: 'PATIENT',
    });

    const writeReq = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: { authorization: `Bearer ${patToken}` },
    });
    const writeRes = await proxy(writeReq);
    expect(writeRes.status).toBe(503);
    const writeJson = await writeRes.json();
    expect(writeJson.error.code).toBe('MAINTENANCE_MODE');

    // Admin write still passes
    const admToken = await signAccessToken({
      userId: 'u-adm-1',
      email: 'a@example.com',
      role: 'ADMIN',
    });
    const admReq = new NextRequest('http://localhost/api/v1/admin/settings', {
      method: 'PUT',
      headers: { authorization: `Bearer ${admToken}` },
    });
    const admRes = await proxy(admReq);
    expect(admRes.status).toBe(200);
  });

  it('enforces maxPatientsPerManager in assignPatientCoordinator and assertManagerCapacity', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'maxPatientsPerManager', value: '2' },
    ]);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'mgr-1',
      fullName: 'Coord One',
      role: 'MANAGER',
      isActive: true,
    });
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: 'pat-3',
      userId: 'u-pat-3',
      assignedManagerId: null,
    });
    mockedPrisma.patient.count.mockResolvedValue(2); // Already at cap of 2!

    const capCheck = await assertManagerCapacity(mockedPrisma as never, 'mgr-1', 1, ['pat-3']);
    expect(capCheck.ok).toBe(false);

    const reassignRes = await assignPatientCoordinator({
      patientId: 'pat-3',
      managerId: 'mgr-1',
      actorId: 'adm-1',
    });
    expect(reassignRes.ok).toBe(false);
    if (!reassignRes.ok) {
      expect(reassignRes.status).toBe(400);
      expect(reassignRes.message).toMatch(/maximum capacity/i);
    }
  });

  it('applies defaultCommissionRate on POST /api/v1/admin/hospitals and POST /api/v1/accommodations when omitted', async () => {
    mockedPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'defaultCommissionRate', value: '17.5' },
    ]);
    mockedPrisma.hospital.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'hosp-new',
      ...data,
    }));
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const hospReq = new NextRequest('http://localhost/api/v1/admin/hospitals', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Fortis Care',
        city: 'Delhi',
        address: 'Okhla Road',
      }),
    });
    const hospRes = await postHospital(hospReq);
    const hospJson = await hospRes.json();
    expect(hospRes.status).toBe(201);
    expect(hospJson.data.hospital.commissionRate).toBe(17.5);

    mockedPrisma.hotel.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'hotel-new',
      ...data,
    }));

    const hotelReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Oberoi Recovery',
        city: 'Delhi',
        address: 'Dr Zakir Hussain Marg',
        nightlyRateUsd: 160,
      }),
    });
    const hotelRes = await postAccommodation(hotelReq);
    const hotelJson = await hotelRes.json();
    expect(hotelRes.status).toBe(201);
    expect(hotelJson.data.hotel.commissionPercent).toBe(17.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/system-settings.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/services/system-settings.service'`).

- [ ] **Step 3: Implement `system-settings.service.ts` and wire runtime governance hooks**

1. Add `MAINTENANCE_MODE: 'MAINTENANCE_MODE'` under `System` in `src/lib/api/errors.ts`.
2. Create `src/lib/services/system-settings.service.ts`:
   - `DEFAULT_SYSTEM_SETTINGS = { maxPatientsPerManager: 25, defaultCommissionRate: 10.0, maintenanceMode: false, sessionTimeoutMinutes: 15, maintenanceStart: '', maintenanceEnd: '', alertBannerText: '' }`.
   - `getSystemSettings()` with `5_000 ms` TTL cache, querying `prisma.systemConfig.findMany()`, bootstrapping from `src/data/settings.json` / `DEFAULT_SYSTEM_SETTINGS` if empty (`rows.length === 0`), and gracefully returning `DEFAULT_SYSTEM_SETTINGS` if `prisma.systemConfig?.findMany` is unavailable or throws in isolated mocks.
   - `updateSystemSettings(input, actor)` validating with Zod (ensuring `maintenanceEnd > maintenanceStart` when both are non-empty valid dates), upserting all 7 keys in `prisma.$transaction`, calling `clearSystemSettingsCache()`, and creating an `AuditLog` (`AUDIT_ACTIONS.SETTINGS_UPDATE`, `entityType: 'SystemConfig'`, `entityId: 'global'`).
   - `checkMaintenanceActive(role?: string, now = new Date())` returning `false` for `'ADMIN'`, `true` when `maintenanceMode === true` or `start <= now && now <= end`.
   - `assertManagerCapacity(db, managerId: string, incomingNewPatients: number, excludePatientIds: string[] = [])` checking `incomingNewPatients <= 0` (immediate `{ ok: true }`), else querying `db.patient.count({ where: { assignedManagerId: managerId, ...(excludePatientIds.length > 0 ? { id: { notIn: excludePatientIds } } : {}) } })` and comparing `currentCount + incomingNewPatients > settings.maxPatientsPerManager`.
3. Update `src/lib/api/settings-helper.ts` to re-export `SystemSettings`, `getSystemSettings as readSettings`, `getSystemSettings`, `checkMaintenanceActive`, and `clearSystemSettingsCache` from `@/lib/services/system-settings.service`.
4. Update `src/app/api/v1/admin/settings/route.ts` to delegate `GET` -> `getSystemSettings()` and `PUT` -> `updateSystemSettings(body, { userId: authUser!.userId, ipAddress: getClientIP(request) })` (removing all `fs.writeFile` local mutations).
5. Update `src/proxy.ts` (Next.js 16 Node runtime):
   - After JWT verification & RBAC check, when `role !== 'ADMIN'`: call `const inMaintenance = await checkMaintenanceActive(role);`.
   - If `inMaintenance`:
     - For mutating API requests (`pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())`), return `NextResponse.json({ success: false, error: { code: 'MAINTENANCE_MODE', message: 'System is currently undergoing scheduled maintenance. Please try again later.' } }, { status: 503 })`.
     - For non-API page navigations (`!pathname.startsWith('/api/')`), redirect to `new URL('/login?reason=maintenance', request.url)`.
6. Update `src/app/api/v1/auth/login/route.ts` and `src/app/api/v1/auth/me/route.ts`:
   - Return `503` with `ERROR_CODES.MAINTENANCE_MODE` when `checkMaintenanceActive(role)` is `true`.
   - In `auth/me/route.ts`, include `alertBannerText: settings.alertBannerText || ''` and `sessionTimeoutMinutes: settings.sessionTimeoutMinutes || 15` in `apiSuccess({ user: formattedUser, alertBannerText, sessionTimeoutMinutes })`.
7. Update `src/app/(auth)/login/page.tsx`:
   - Display a clean contextual notice banner when `searchParams.get('reason')` is `'maintenance'`, `'timeout'`, or `'expired'` (wrapped safely in `<Suspense>` if using `useSearchParams()`, or read cleanly via `window.location.search` in `useEffect` so static prerendering of `/login` stays `○ Static`!). **Important:** `/login` is currently `○ (Static)` in `next build` — reading `new URLSearchParams(window.location.search).get('reason')` inside `setTimeout` in `useEffect` avoids forcing `/login` dynamic or needing a Suspense boundary refactor, while cleaning up the unused `Stethoscope` import, adding `fetch2FASecret` to `useCallback`, and fixing the duplicate `role !== 'ADMIN' && role !== 'ADMIN'` check!
8. Update `src/components/SessionTimeoutProvider.tsx`:
   - Fetch `/api/v1/auth/me` once when entering a non-public route to read `data?.sessionTimeoutMinutes` (clamped `5..1440`, default `15`), dynamically computing `inactivityLimitMs = timeoutMinutes * 60 * 1000` and `warningThresholdMs = Math.max(60 * 1000, inactivityLimitMs - 2 * 60 * 1000)`.
9. Update `src/lib/services/onboarding.service.ts` and `src/lib/services/case-assignment.service.ts`:
   - In `onboarding.service.ts`: filter `resolveLeastLoadedManagerId()` against `settings.maxPatientsPerManager` (counting `_count.assignedPatients`), and when an explicit `assignedManagerId` is supplied in `onboardPatient` (or `managerId` in `createCaseForPatient` for a patient not yet assigned to that manager), call `assertManagerCapacity` and return `400` if over capacity.
   - In `case-assignment.service.ts` (`assignPatientCoordinator`): when `managerId` is non-null, compute how many target patient(s) are not already assigned to `managerId` and call `assertManagerCapacity`, returning `400` before mutating if capacity would be exceeded.
10. Update `src/app/api/v1/admin/hospitals/route.ts`, `src/lib/services/accommodations.service.ts`, and `src/app/api/v1/accommodations/route.ts`:
    - In `admin/hospitals/route.ts` `POST`: `const commissionRate = result.data.commissionRate ?? (await getSystemSettings()).defaultCommissionRate;`.
    - In `accommodations.service.ts`: add `createPartnerHotel(params)` with full Zod validation parity (`name`, `city`, `address`, `nightlyRateUsd > 0`, `starRating 1..5`, `distanceKm >= 0`, `nearHospitalId` existence check, `optionalNullableEmail`, `safeImageUrl`, defaulting `commissionPercent` to `(await getSystemSettings()).defaultCommissionRate` when omitted, and writing `AuditLog`), and wire `POST` in `src/app/api/v1/accommodations/route.ts` to `createPartnerHotel`.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/system-settings.service.test.ts && npm test && npm run typecheck && npx eslint --max-warnings=0 src/lib/services/system-settings.service.ts src/lib/api/errors.ts src/lib/api/settings-helper.ts src/app/api/v1/admin/settings/route.ts src/proxy.ts src/app/api/v1/auth/login/route.ts src/app/api/v1/auth/me/route.ts "src/app/(auth)/login/page.tsx" src/components/SessionTimeoutProvider.tsx src/lib/services/onboarding.service.ts src/lib/services/case-assignment.service.ts src/app/api/v1/admin/hospitals/route.ts src/lib/services/accommodations.service.ts src/app/api/v1/accommodations/route.ts src/lib/services/__tests__/system-settings.service.test.ts`
Expected: PASS (`0` errors, `0` warnings).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/system-settings.service.ts src/lib/api/errors.ts src/lib/api/settings-helper.ts src/app/api/v1/admin/settings/route.ts src/proxy.ts src/app/api/v1/auth/login/route.ts src/app/api/v1/auth/me/route.ts "src/app/(auth)/login/page.tsx" src/components/SessionTimeoutProvider.tsx src/lib/services/onboarding.service.ts src/lib/services/case-assignment.service.ts src/app/api/v1/admin/hospitals/route.ts src/lib/services/accommodations.service.ts src/app/api/v1/accommodations/route.ts src/lib/services/__tests__/system-settings.service.test.ts
git commit -m "feat(governance): migrate settings to SystemConfig and enforce maintenance, manager capacity, timeout, and commission defaults"
```

---

### Task 2: In-App Notification Reader APIs & Universal `<NotificationBell />` + `<GlobalAlertBanner />`

**Files:**
- Modify: `src/lib/auth/rbac.ts`
- Create: `src/lib/services/notifications.service.ts`
- Create: `src/app/api/v1/notifications/route.ts`
- Create: `src/components/ui/GlobalAlertBanner.tsx`
- Create: `src/components/notifications/NotificationBell.tsx`
- Modify: `src/app/(patient)/patient/layout.tsx`
- Modify: `src/app/(manager)/manager/layout.tsx`
- Modify: `src/app/(doctor)/doctor/layout.tsx`
- Modify: `src/app/(admin)/admin/layout.tsx`
- Test: `src/lib/services/__tests__/notifications.service.test.ts`

**Interfaces:**
- Consumes: `alertBannerText` from `GET /api/v1/auth/me` (Task 1), `prisma.notification` (`id`, `userId`, `channel`, `title`, `body`, `isRead`, `sentAt`, `triggerEvent`).
- Produces:
  - `listUserNotifications({ userId, limit?, unreadOnly? })` and `markUserNotificationsRead({ userId, notificationId?, markAllRead? })` in `src/lib/services/notifications.service.ts`.
  - `GET` and `PATCH` `/api/v1/notifications` in `src/app/api/v1/notifications/route.ts`.
  - `<NotificationBell />` and `<GlobalAlertBanner text={alertBannerText} />` mounted across all 4 portal shells (`Patient`, `Manager`, `Doctor`, `Admin`).

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/notifications.service.test.ts`)**

```typescript
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

    const req = new NextRequest('http://localhost/api/v1/notifications?limit=15&unreadOnly=true', {
      headers: {
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
    });
    const res = await getNotifications(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.unreadCount).toBe(1);
    expect(json.data.notifications).toHaveLength(1);
    expect(mockedPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-pat-1', isRead: false },
        take: 15,
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
      body: JSON.stringify({ notificationId: 'notif-other' }),
    });
    const idorRes = await patchNotifications(idorReq);
    expect(idorRes.status).toBe(403);

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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/notifications.service.test.ts`
Expected: FAIL (`Cannot find module '@/app/api/v1/notifications/route'`).

- [ ] **Step 3: Implement `notifications.service.ts`, `/api/v1/notifications`, `<GlobalAlertBanner />`, `<NotificationBell />`, and wire all 4 layouts**

1. Add `'/notifications': ['PATIENT', 'MANAGER', 'DOCTOR', 'ADMIN']` to `ROUTE_ROLES` in `src/lib/auth/rbac.ts`.
2. Create `src/lib/services/notifications.service.ts` with `listUserNotifications` (`limit` clamped `1..50`, default `20`; `unreadOnly` boolean) and `markUserNotificationsRead` (validating `{ notificationId?, markAllRead? }` via Zod, returning `400` if neither provided, `404` if `notificationId` missing, `403` if `notification.userId !== userId`).
3. Create `src/app/api/v1/notifications/route.ts` exporting **only** `GET` and `PATCH`.
4. Create `src/components/ui/GlobalAlertBanner.tsx` rendering a crisp amber/warning alert bar when `text?.trim()` is non-empty.
5. Create `src/components/notifications/NotificationBell.tsx`:
   - Accessible trigger button (`aria-label="Notifications"`, `aria-expanded`, unread pill `99+`).
   - Polls `GET /api/v1/notifications?limit=15` on mount (`setTimeout(..., 0)`) and every `30_000 ms` with cancellation cleanup.
   - Popover drawer showing channel badge (`IN_APP`/`EMAIL`/`SMS`), title, plain-text body preview (stripping `<[^>]+>` tags cleanly for `EMAIL` notifications), formatted timestamp, click-to-mark-read (`PATCH { notificationId }`), and `"Mark all read"` (`PATCH { markAllRead: true }`), closing on outside click or `Escape`.
6. Update all 4 portal layouts (`patient/layout.tsx`, `manager/layout.tsx`, `doctor/layout.tsx`, `admin/layout.tsx`):
   - Capture `alertBannerText` from the existing `/api/v1/auth/me` call (`setAlertBannerText(data.data?.alertBannerText || '')`).
   - Render `<GlobalAlertBanner text={alertBannerText} />` above the main content / below the top header bar across all 4 layouts (replacing the inline banner in `admin/layout.tsx` so all 4 portals are consistent).
   - Mount `<NotificationBell />` in the top header bar of all 4 layouts.
   - Clean up any unused imports in all 4 layout files and fix the duplicate `if (role !== 'ADMIN' && role !== 'ADMIN')` expression in `src/app/(admin)/admin/layout.tsx` to `if (role !== 'ADMIN')`.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/notifications.service.test.ts && npm test && npm run typecheck && npx eslint --max-warnings=0 src/lib/auth/rbac.ts src/lib/services/notifications.service.ts src/app/api/v1/notifications/route.ts src/components/ui/GlobalAlertBanner.tsx src/components/notifications/NotificationBell.tsx "src/app/(patient)/patient/layout.tsx" "src/app/(manager)/manager/layout.tsx" "src/app/(doctor)/doctor/layout.tsx" "src/app/(admin)/admin/layout.tsx" src/lib/services/__tests__/notifications.service.test.ts`
Expected: PASS (`0` errors, `0` warnings).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/rbac.ts src/lib/services/notifications.service.ts src/app/api/v1/notifications/route.ts src/components/ui/GlobalAlertBanner.tsx src/components/notifications/NotificationBell.tsx "src/app/(patient)/patient/layout.tsx" "src/app/(manager)/manager/layout.tsx" "src/app/(doctor)/doctor/layout.tsx" "src/app/(admin)/admin/layout.tsx" src/lib/services/__tests__/notifications.service.test.ts
git commit -m "feat(notifications): add in-app notification reader/mark-read APIs, NotificationBell drawer, and cross-portal GlobalAlertBanner"
```

---

### Task 3: Email Campaign HTML Sanitizer, Full Placeholder Interpolation & OWASP CSV Protection

**Files:**
- Create: `src/lib/validation/email-sanitizer.ts`
- Create: `src/lib/services/email-campaign.service.ts`
- Modify: `src/app/api/v1/admin/email-templates/route.ts`
- Modify: `src/app/api/v1/admin/email-campaigns/route.ts`
- Modify: `src/app/(admin)/admin/email-campaigns/page.tsx`
- Modify: `src/app/(admin)/admin/email-templates/page.tsx`
- Modify: `src/lib/api/csv-helper.ts`
- Test: `src/lib/services/__tests__/campaigns-and-csv.service.test.ts`

**Interfaces:**
- Consumes: `prisma.emailCampaign`, `prisma.emailTemplate`, `prisma.user`, `prisma.notification`.
- Produces:
  - `sanitizeEmailHtml(html: string): string`, `escapeHtmlText(val: string): string`, `interpolateCampaignTemplate(templateText: string, ctx: CampaignRecipientContext, options?: { escapeHtml?: boolean }): string` in zero-Prisma `src/lib/validation/email-sanitizer.ts`.
  - `processQueuedCampaigns(now?: Date)` and `dispatchCampaignToRecipients(campaignId, template, targetRole, now?)` in `src/lib/services/email-campaign.service.ts`.
  - `PATCH /api/v1/admin/email-campaigns` (`{ action: 'PROCESS_QUEUED' }`) returning `{ processedCampaigns, notificationsCreated }`.
  - Formula-injection-safe `generateCSV` and header-hardened `csvResponse` in `src/lib/api/csv-helper.ts`.

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/campaigns-and-csv.service.test.ts`)**

```typescript
import { NextRequest } from 'next/server';
import {
  sanitizeEmailHtml,
  interpolateCampaignTemplate,
} from '@/lib/validation/email-sanitizer';
import { generateCSV, csvResponse } from '@/lib/api/csv-helper';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    emailTemplate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailCampaign: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { POST as postTemplate } from '@/app/api/v1/admin/email-templates/route';
import {
  POST as postCampaign,
  PATCH as patchCampaigns,
} from '@/app/api/v1/admin/email-campaigns/route';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>>;

describe('Task 3: Email Campaign Sanitizer, Placeholder Interpolation & CSV Hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips scripts, iframes, inline on* handlers, and javascript:/data:text/html URIs in sanitizeEmailHtml', () => {
    const dirty = `
      <div>Hello <b>World</b></div>
      <script>alert('xss')</script>
      <iframe src="https://evil.example"></iframe>
      <img src="x" onerror="alert(1)" onclick='steal()' />
      <a href="javascript:alert(2)">Click</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data</a>
    `;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toContain('<b>World</b>');
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/data:text\/html/i);
  });

  it('interpolates all 7 placeholders in subject and HTML-escapes recipient fields in body', () => {
    const ctx = {
      fullName: 'Sara <script>alert(1)</script>',
      email: 'sara@example.com',
      role: 'PATIENT',
      nationality: 'Oman',
      caseStatus: 'WARD_RECOVERY',
      portalUrl: 'https://portal.afzalhealthcare.in',
      supportEmail: 'concierge@afzalhealthcare.in',
    };

    const subject = interpolateCampaignTemplate(
      'Update for {{fullName}} ({{nationality}} - {{caseStatus}})',
      ctx,
      { escapeHtml: false }
    );
    expect(subject).toBe('Update for Sara <script>alert(1)</script> (Oman - WARD_RECOVERY)');

    const body = interpolateCampaignTemplate(
      '<p>Dear {{fullName}} ({{email}}, {{role}}), visit <a href="{{portalUrl}}">portal</a> or email {{supportEmail}}.</p>',
      ctx,
      { escapeHtml: true }
    );
    expect(body).toContain('Dear Sara &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).toContain('sara@example.com, PATIENT');
    expect(body).toContain('https://portal.afzalhealthcare.in');
    expect(body).toContain('concierge@afzalhealthcare.in');
  });

  it('sanitizes templates on POST /api/v1/admin/email-templates and interpolates subject + body on campaign send & PATCH queued processing', async () => {
    mockedPrisma.emailTemplate.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.emailTemplate.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'tpl-1',
      ...data,
    }));
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const tplReq = new NextRequest('http://localhost/api/v1/admin/email-templates', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Welcome',
        subject: 'Hello {{fullName}} — {{caseStatus}}',
        body: '<p>Hi {{fullName}} from {{nationality}}</p><script>evil()</script>',
        category: 'onboarding',
      }),
    });
    const tplRes = await postTemplate(tplReq);
    const tplJson = await tplRes.json();
    expect(tplRes.status).toBe(201);
    expect(tplJson.data.template.body).not.toContain('<script>');

    // Immediate campaign send interpolates both subject and body
    mockedPrisma.emailTemplate.findUnique.mockResolvedValueOnce({
      id: 'tpl-1',
      name: 'Welcome',
      subject: 'Hello {{fullName}} — {{caseStatus}}',
      body: '<p>Hi {{fullName}} from {{nationality}}</p>',
      isActive: true,
    });
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u-1',
        fullName: 'Ahmed Al-Mansoor',
        email: 'ahmed@example.com',
        role: 'PATIENT',
        patient: {
          nationality: 'UAE',
          cases: [{ status: 'WARD_RECOVERY' }],
        },
      },
    ]);
    mockedPrisma.emailCampaign.create.mockResolvedValueOnce({ id: 'camp-1', name: 'Blast' });
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.emailCampaign.update.mockResolvedValueOnce({
      id: 'camp-1',
      name: 'Blast',
      status: 'SENT',
      sentCount: 1,
      template: { name: 'Welcome', subject: 'Hello {{fullName}} — {{caseStatus}}' },
    });

    const campReq = new NextRequest('http://localhost/api/v1/admin/email-campaigns', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Blast',
        templateId: 'tpl-1',
        targetRole: 'PATIENT',
      }),
    });
    const campRes = await postCampaign(campReq);
    expect(campRes.status).toBe(201);
    expect(mockedPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'u-1',
          title: 'Hello Ahmed Al-Mansoor — WARD_RECOVERY',
          body: '<p>Hi Ahmed Al-Mansoor from UAE</p>',
        }),
      ],
    });

    // Explicit PATCH queued processor
    mockedPrisma.emailCampaign.findMany.mockResolvedValueOnce([]);
    const procReq = new NextRequest('http://localhost/api/v1/admin/email-campaigns', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({ action: 'PROCESS_QUEUED' }),
    });
    const procRes = await patchCampaigns(procReq);
    expect(procRes.status).toBe(200);
  });

  it('neutralizes OWASP CSV formula injection while preserving negative numbers and sanitizing filenames', () => {
    const csv = generateCSV(
      ['Name', 'Formula', 'NegativeBalance', 'TabAttack'],
      [['Alice, Jr.', '=CMD|\' /C calc\'!A0', -125.5, '\t+SUM(A1:A2)']]
    );
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"Alice, Jr."');
    expect(lines[1]).toContain("'=CMD|' /C calc'!A0");
    expect(lines[1]).toContain(',-125.5,');
    expect(lines[1]).toContain("'\t+SUM(A1:A2)");

    const res = csvResponse(csv, 'cases";evil\r\n.csv');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="cases__evil__.csv"');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/campaigns-and-csv.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/validation/email-sanitizer'`).

- [ ] **Step 3: Implement `email-sanitizer.ts`, `email-campaign.service.ts`, route updates, UI preview sanitization, and `csv-helper.ts`**

1. Create `src/lib/validation/email-sanitizer.ts` (zero Prisma imports so client components can import it safely!):
   - `sanitizeEmailHtml(html: string): string` stripping `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<meta>`, `<link>`, `<base>` blocks/tags, stripping all `\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)` attributes, and replacing `javascript:`, `vbscript:`, and `data:\s*text\/html` URI values in `href`/`src`/`xlink:href`/`action`/`formaction` with `"#"`.
   - `escapeHtmlText(val: string): string` escaping `&`, `<`, `>`, `"`, `'`.
   - `interpolateCampaignTemplate(templateText: string, ctx: CampaignRecipientContext, options?: { escapeHtml?: boolean }): string` replacing `{{fullName}}`, `{{email}}`, `{{role}}`, `{{nationality}}`, `{{caseStatus}}`, `{{portalUrl}}`, and `{{supportEmail}}`.
2. Create `src/lib/services/email-campaign.service.ts`:
   - Queries active target users including `patient: { select: { nationality: true, cases: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 } } }`.
   - Sanitizes `template.body` via `sanitizeEmailHtml` and interpolates **both** `template.subject` (`escapeHtml: false`) and `template.body` (`escapeHtml: true`) for each recipient.
   - Implements `dispatchImmediateCampaign` and `processQueuedCampaigns(now = new Date())` returning `{ processedCampaigns, notificationsCreated }`.
3. Update `src/app/api/v1/admin/email-templates/route.ts` to sanitize `body` via `sanitizeEmailHtml` on `POST` and `PUT`.
4. Update `src/app/api/v1/admin/email-campaigns/route.ts` to use `email-campaign.service.ts` and add `PATCH` (`{ action: 'PROCESS_QUEUED' }`) for `ADMIN`.
5. Update `src/app/(admin)/admin/email-campaigns/page.tsx` and `src/app/(admin)/admin/email-templates/page.tsx`:
   - Pass HTML previews through `sanitizeEmailHtml(...)` before rendering `dangerouslySetInnerHTML`.
   - Add a `"Process Due Queued"` button in `admin/email-campaigns/page.tsx` when queued campaigns exist (`PATCH /api/v1/admin/email-campaigns`).
6. Update `src/lib/api/csv-helper.ts`:
   - Prefix string cells whose raw value starts with `\t` or `\r`, or whose trimmed value starts with `=`, `+`, `@`, `|`, `%`, or non-numeric `-` (`!/^-\d+(\.\d+)?$/`) with `'`.
   - Quote fields containing `,`, `"`, `\n`, or `\r`.
   - Sanitize `filename` (`filename.replace(/[^a-zA-Z0-9._-]/g, '_')`) and set `X-Content-Type-Options: nosniff` in `csvResponse`.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/campaigns-and-csv.service.test.ts && npm test && npm run typecheck && npx eslint --max-warnings=0 src/lib/validation/email-sanitizer.ts src/lib/services/email-campaign.service.ts src/app/api/v1/admin/email-templates/route.ts src/app/api/v1/admin/email-campaigns/route.ts "src/app/(admin)/admin/email-campaigns/page.tsx" "src/app/(admin)/admin/email-templates/page.tsx" src/lib/api/csv-helper.ts src/lib/services/__tests__/campaigns-and-csv.service.test.ts`
Expected: PASS (`0` errors, `0` warnings).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/email-sanitizer.ts src/lib/services/email-campaign.service.ts src/app/api/v1/admin/email-templates/route.ts src/app/api/v1/admin/email-campaigns/route.ts "src/app/(admin)/admin/email-campaigns/page.tsx" "src/app/(admin)/admin/email-templates/page.tsx" src/lib/api/csv-helper.ts src/lib/services/__tests__/campaigns-and-csv.service.test.ts
git commit -m "feat(security): add email HTML sanitizer, 7-placeholder campaign interpolation, and OWASP CSV formula protection"
```

---

### Task 4: Final Audit Polish, Seed Idempotency, Unused Shelfware Pruning & Repo-Wide `--max-warnings=0` Lint

**Files:**
- Modify: `src/lib/validation/schemas.ts`
- Modify: `src/app/api/v1/patient/profile/route.ts`
- Modify: `src/app/(patient)/patient/profile/page.tsx`
- Modify: `src/app/(patient)/patient/messages/page.tsx`
- Modify: `src/app/(manager)/manager/chat/page.tsx`
- Modify: `src/app/(patient)/patient/dashboard/page.tsx`
- Modify: `src/app/(patient)/patient/documents/page.tsx`
- Modify: `src/components/clinical/ClinicalRoadmapTree.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `prisma/seed.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/lib/__tests__/phase4-polish.test.ts`

**Interfaces:**
- Consumes: `patientProfileSchema` (`src/lib/validation/schemas.ts`), `DEFAULT_SYSTEM_SETTINGS` (`src/lib/services/system-settings.service.ts`).
- Produces:
  - `emergencyContact.countryCode` round-trip persistence in `/api/v1/patient/profile` and `/patient/profile`.
  - Non-yanking background chat polling in `/patient/messages` and `/manager/chat`.
  - Complete 10-category filter coverage (including `INSURANCE`) in `/patient/documents`.
  - Idempotent `prisma/seed.ts` (`clinicalStep.deleteMany` + `systemConfig.upsert` defaults).
  - Pruned `package.json` (zero unused `bullmq`, `ioredis`, `jsonwebtoken`, `cookie`) and `0` ESLint warnings across the **entire** repository (`npx eslint . --max-warnings=0`).

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/__tests__/phase4-polish.test.ts`)**

```typescript
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { patientProfileSchema } from '@/lib/validation/schemas';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patient: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    patientMedicalProfile: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import { PUT as putPatientProfile } from '@/app/api/v1/patient/profile/route';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>> & {
  $transaction: jest.Mock;
};

describe('Task 4: Profile Country Code, Seed Idempotency & Dependency Hygiene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockedPrisma)
    );
  });

  it('persists emergencyContact.countryCode in patientProfileSchema and PUT /api/v1/patient/profile', async () => {
    const parsed = patientProfileSchema.safeParse({
      bloodGroup: 'O+',
      emergencyContact: {
        name: 'Fatima Al-Mansoor',
        countryCode: '+968',
        phone: '91234567',
        relation: 'Spouse',
      },
    });
    expect(parsed.success).toBe(true);

    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.patient.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pat-1',
      ...data,
    }));
    mockedPrisma.patientMedicalProfile.upsert.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/v1/patient/profile', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        bloodGroup: 'O+',
        primaryLanguage: 'Arabic',
        emergencyContact: {
          name: 'Fatima Al-Mansoor',
          countryCode: '+968',
          phone: '91234567',
          relation: 'Spouse',
        },
        allergies: ['Penicillin'],
      }),
    });
    const res = await putPatientProfile(req);
    expect(res.status).toBe(200);
    expect(mockedPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emergencyContact: {
            name: 'Fatima Al-Mansoor',
            countryCode: '+968',
            phone: '91234567',
            relation: 'Spouse',
          },
        }),
      })
    );
  });

  it('removes unused runtime shelfware from package.json and keeps seed.ts idempotent', () => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    expect(pkgJson.dependencies.bullmq).toBeUndefined();
    expect(pkgJson.dependencies.ioredis).toBeUndefined();
    expect(pkgJson.dependencies.jsonwebtoken).toBeUndefined();
    expect(pkgJson.dependencies.cookie).toBeUndefined();

    const seedSource = fs.readFileSync(
      path.join(process.cwd(), 'prisma', 'seed.ts'),
      'utf8'
    );
    expect(seedSource).toContain('prisma.clinicalStep.deleteMany');
    expect(seedSource).toContain('prisma.systemConfig.upsert');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/phase4-polish.test.ts`
Expected: FAIL (`pkgJson.dependencies.bullmq` is defined / `emergencyContact.phone` regex rejects local digits without countryCode).

- [ ] **Step 3: Implement profile countryCode, smart chat scroll, `INSURANCE` filter tab, idempotent `seed.ts`, dependency pruning, and repo-wide zero-warning lint**

1. Update `src/lib/validation/schemas.ts`, `src/app/api/v1/patient/profile/route.ts`, and `src/app/(patient)/patient/profile/page.tsx`:
   - Allow `countryCode: z.string().regex(/^\+\d{1,4}$/).optional()` and `phone: z.string().regex(/^\+?[0-9\s-]{6,16}$/)` in `patientProfileSchema.shape.emergencyContact`.
   - Send `countryCode: emergencyCountryCode` in `handleSave` (`patient/profile/page.tsx`) and restore `setEmergencyCountryCode(pat.emergencyContact.countryCode || '+971')` in `loadProfile`.
2. Update `src/app/(patient)/patient/messages/page.tsx` and `src/app/(manager)/manager/chat/page.tsx`:
   - Track `lastMessageIdRef = useRef<string | null>(null)` (and reset on thread switch in Manager Chat). Only scroll the feed to bottom when `latestId !== lastMessageIdRef.current`, preventing 10s/15s background polling from yanking scroll position while reading history; also remove unused `Home` import in `patient/messages/page.tsx`.
3. Update `src/app/(patient)/patient/documents/page.tsx`:
   - Ensure `INSURANCE` documents appear under the category tabs (add `'INSURANCE'` to the appropriate tab filter / add an `Insurance` filter option so `INSURANCE` uploads are never hidden from category views) and remove the 6 unused imports (`Badge`, `Lock`, `HardDrive`, `FileCode`, `Award`, `HelpCircle`).
4. Update `src/app/(patient)/patient/dashboard/page.tsx`, `src/components/clinical/ClinicalRoadmapTree.tsx`, and `src/components/ui/Select.tsx`:
   - Remove unused icon/variable declarations in `patient/dashboard/page.tsx` (`Clock`) and `ClinicalRoadmapTree.tsx` (`CheckCircle2`, `Clock`, `AlertCircle`, `FileText`, `Sparkles`, `GitCommit`, `FileCheck`, `CategoryIcon`, `isLastBranch`).
   - Add `aria-expanded={isOpen}` and `aria-controls={listboxId}` (`useId()`) to the `role="combobox"` trigger in `src/components/ui/Select.tsx` (and matching `id={listboxId}` on the dropdown list).
5. Update `prisma/seed.ts`:
   - Add `await prisma.clinicalStep.deleteMany({ where: { caseId: sampleCase.id } });` right before inserting `clinicalStepsData`.
   - Seed the 7 `DEFAULT_SYSTEM_SETTINGS` keys via `prisma.systemConfig.upsert({ where: { key }, update: {}, create: { key, value: JSON.stringify(val) } })`.
6. Uninstall unused packages cleanly:
   - Run `npm uninstall bullmq ioredis jsonwebtoken cookie @types/jsonwebtoken @types/cookie`.

- [ ] **Step 4: Run full verification suite (`npm test`, `npm run typecheck`, `npx eslint . --max-warnings=0`, `npm run build`)**

Run: `npm test && npm run typecheck && npx eslint . --max-warnings=0 && npm run build`
Expected: PASS (`0` errors, **`0` warnings across the entire repository**, all Next.js routes compiled cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/schemas.ts src/app/api/v1/patient/profile/route.ts "src/app/(patient)/patient/profile/page.tsx" "src/app/(patient)/patient/messages/page.tsx" "src/app/(manager)/manager/chat/page.tsx" "src/app/(patient)/patient/dashboard/page.tsx" "src/app/(patient)/patient/documents/page.tsx" src/components/clinical/ClinicalRoadmapTree.tsx src/components/ui/Select.tsx prisma/seed.ts package.json package-lock.json src/lib/__tests__/phase4-polish.test.ts
git commit -m "fix(polish): persist emergencyCountryCode, fix chat scroll yank, make seed idempotent, prune unused deps, and reach 0 lint warnings"
```
