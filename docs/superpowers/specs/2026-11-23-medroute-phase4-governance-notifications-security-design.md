# MedRoute Sub-Project 4 Design Specification: Platform Governance (`SystemConfig`), In-App Notifications, Campaign/CSV Security & Final Polish

**Date:** 2026-11-23  
**Status:** Draft for User Review  
**Scope:** Final remediation phase (Sub-project 4 of 4) closing all remaining audit findings (`4.1.3`, `4.1.4`, `4.1.5`, `4.2`, `4.3`, and `Section 5`) across `afzal-healthcare` (`MedRoute`).

---

## 1. Architectural Overview & Goals

Sub-projects 1–3 remediated authentication/2FA/recovery, ePHI encryption, 12-stage case onboarding & coordinator sync, clinical pathways, the `(doctor)` portal, document verification/VIL/Fit-to-Fly PDF certificates, dual medical bill settlement, real PDF stream OCR, partner hotel/booking lifecycles, and UTC/commission revenue analytics.

Sub-project 4 completes the platform remediation across four cohesive subsystems:

1. **Database-Backed Platform Governance (`SystemConfig`) & Runtime Enforcement:** Migrate platform settings away from mutable local disk writes (`src/data/settings.json`) to Prisma `SystemConfig` (`system_configs`) with a short-TTL cache, and enforce `maxPatientsPerManager`, `defaultCommissionRate`, `sessionTimeoutMinutes`, `maintenanceMode` (including scheduled windows), and `alertBannerText` across APIs, Next.js 16 `src/proxy.ts` (Node.js runtime), and all 4 role portals.
2. **In-App Notification Reader APIs & Universal `<NotificationBell />`:** Expose `GET` and `PATCH` on `/api/v1/notifications` for all 4 authenticated roles (`PATIENT`, `MANAGER`, `DOCTOR`, `ADMIN`) and mount an accessible `<NotificationBell />` drawer in all 4 portal headers.
3. **Email Campaign XSS Hardening, Full Placeholder Interpolation & OWASP CSV Protection:** Sanitize stored/previewed email HTML (`sanitizeEmailHtml`), interpolate all supported user/patient/case placeholders in **both** `subject` and `body`, expose an explicit due-campaign processor alongside auto-processing, and harden `generateCSV` / `csvResponse` against spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`).
4. **Final Audit Polish, Seed Idempotency, Dependency Pruning & Repo-Wide Zero-Warning Lint:** Persist `emergencyCountryCode` on Patient Medical Profile, eliminate chat scroll-yank during background polling, make `prisma/seed.ts` 100% idempotent, remove unused runtime shelfware (`bullmq`, `ioredis`, `jsonwebtoken`, `cookie`), and resolve all remaining ESLint warnings so `npx eslint . --max-warnings=0` passes repository-wide.

---

## 2. Component Designs

### 2.1 Component 1: `SystemConfig` Migration & Runtime Governance

#### Data Model & Service (`src/lib/services/system-settings.service.ts`)
- Uses the existing Prisma `SystemConfig` model (`key String @id`, `value String @db.Text`, `updatedAt DateTime`) — no destructive schema migration required.
- Canonical strongly-typed interface `SystemSettings`:
  ```ts
  export interface SystemSettings {
    maxPatientsPerManager: number;   // int 1..500, default 25
    defaultCommissionRate: number;   // float 0..100, default 10.0
    maintenanceMode: boolean;        // boolean, default false
    sessionTimeoutMinutes: number;   // int 5..1440, default 15
    maintenanceStart: string;        // ISO string or '', default ''
    maintenanceEnd: string;          // ISO string or '', default ''
    alertBannerText: string;         // string max 500, default ''
  }
  ```
- **Read Path (`getSystemSettings()`):**
  1. Returns cached `SystemSettings` when within the `5_000 ms` in-memory TTL window.
  2. Queries `prisma.systemConfig.findMany()`. If rows exist, parses each `key`'s JSON-encoded `value` overlaid onto `DEFAULT_SETTINGS`.
  3. **Seamless Bootstrap:** If `system_configs` has `0` rows, reads `src/data/settings.json` once (if present and valid, else `DEFAULT_SETTINGS`), seeds `system_configs` via `prisma.$transaction` (`upsert` per key), caches, and returns the settings. If the DB query fails transiently in unit tests without `systemConfig` mocked, falls back gracefully to `DEFAULT_SETTINGS`.
- **Write Path (`updateSystemSettings(input, actor)`):**
  - Validates `input` with Zod (including verifying `maintenanceEnd > maintenanceStart` when both are non-empty valid dates).
  - Upserts all 7 keys inside `prisma.$transaction`, invalidates the in-memory cache immediately (`clearSystemSettingsCache()`), records `AuditLog` (`AUDIT_ACTIONS.SETTINGS_UPDATE`, `entityType: 'SystemConfig'`, `entityId: 'global'`, `oldValue`, `newValue`), and returns the updated `SystemSettings`.
- **Backwards-Compatible Shim (`src/lib/api/settings-helper.ts`):**
  - Re-exports `getSystemSettings` (aliased as `readSettings`), `checkMaintenanceActive(role, now?)`, and `clearSystemSettingsCache` from `system-settings.service.ts`.

#### Runtime Enforcement Points
1. **`maintenanceMode` & Scheduled Window (`[maintenanceStart, maintenanceEnd]`):**
   - `checkMaintenanceActive(role, now = new Date())`: Returns `false` immediately when `role === 'ADMIN'`. Otherwise returns `true` if `settings.maintenanceMode === true` or if both `maintenanceStart` and `maintenanceEnd` parse to valid `Date`s with `start <= now && now <= end`.
   - **Next.js 16 Node Proxy (`src/proxy.ts`):** After JWT verification, when `role !== 'ADMIN'` and `await checkMaintenanceActive(role)` is `true`:
     - If `pathname.startsWith('/api/')` and `request.method` is mutating (`POST`, `PUT`, `PATCH`, `DELETE`), returns `503` JSON `{ success: false, error: { code: 'MAINTENANCE_MODE', message: 'System is currently undergoing scheduled maintenance. Please try again later.' } }` (note `/api/v1/auth/logout` is in `PUBLIC_ROUTES` and exits before this check so users can always sign out).
     - If `!pathname.startsWith('/api/')` (portal page navigation), redirects to `/login?reason=maintenance`.
   - **Auth Endpoints (`/api/v1/auth/login` & `/api/v1/auth/me`):** Continue checking `checkMaintenanceActive(user.role)` (returning `503` `MAINTENANCE_MODE` on non-`ADMIN` login/session check), and `src/app/(auth)/login/page.tsx` renders a clear informational banner when `?reason=maintenance`, `?reason=timeout`, or `?reason=expired` is in the query string.
   - **`ERROR_CODES.MAINTENANCE_MODE`:** Added to `src/lib/api/errors.ts`.

2. **`alertBannerText` & `sessionTimeoutMinutes` Across All 4 Portals:**
   - `GET /api/v1/auth/me` returns `alertBannerText: settings.alertBannerText` and `sessionTimeoutMinutes: settings.sessionTimeoutMinutes` in `data`.
   - Create a lightweight shared `<GlobalAlertBanner text={alertBannerText} />` component (`src/components/ui/GlobalAlertBanner.tsx`) and render it across `(patient)/patient/layout.tsx`, `(manager)/manager/layout.tsx`, `(doctor)/doctor/layout.tsx`, and `(admin)/admin/layout.tsx` whenever `alertBannerText` is non-empty.
   - `SessionTimeoutProvider.tsx` fetches `/api/v1/auth/me` once on non-public route mount (or reads `sessionTimeoutMinutes`, defaulting to `15` minutes, clamped to `5..1440`) so `inactivityLimitMs = sessionTimeoutMinutes * 60_000` and `warningThresholdMs = Math.max(60_000, inactivityLimitMs - 120_000)` dynamically honor Admin settings.

3. **`maxPatientsPerManager` Capacity Guard:**
   - Helper `assertManagerCapacity(txOrPrisma, managerId, excludePatientIds?: string[])` in `system-settings.service.ts`:
     - Reads `maxPatientsPerManager` from `getSystemSettings()`.
     - Counts `patient.count({ where: { assignedManagerId: managerId, ...(excludePatientIds?.length ? { id: { notIn: excludePatientIds } } : {}) } })`.
     - If `currentCount + incomingNewPatientCount > maxPatientsPerManager`, returns `{ ok: false, status: 400, code: ERROR_CODES.BAD_REQUEST, message: "Target manager has reached the maximum capacity of X assigned patients." }`.
   - Enforced in:
     - `onboardPatientAndCase` (`src/lib/services/onboarding.service.ts`) when `assignedManagerId` is provided.
     - `assignPatientCoordinator` (`src/lib/services/case-assignment.service.ts`) for both single-patient (`patientId`) and bulk-case (`caseIds`) reassignments when `managerId` is non-null (excluding patients already assigned to `managerId` so idempotent reassignments never false-trip).

4. **`defaultCommissionRate` & Partner Creation Parity:**
   - `POST /api/v1/admin/hospitals`: When `result.data.commissionRate === undefined`, defaults to `(await getSystemSettings()).defaultCommissionRate`.
   - `POST /api/v1/accommodations`: Moves creation validation into `createPartnerHotel` in `src/lib/services/accommodations.service.ts` (bringing `POST` validation into full parity with `PUT` — validating `nightlyRateUsd > 0`, `nearHospitalId` existence, `contactEmail` format, and `safeImageUrl` schemes) and defaults `commissionPercent` to `(await getSystemSettings()).defaultCommissionRate` when omitted.

---

### 2.2 Component 2: In-App Notification Reader APIs & Universal `<NotificationBell />`

#### Backend Service & Route (`src/lib/services/notifications.service.ts` & `src/app/api/v1/notifications/route.ts`)
- **RBAC (`src/lib/auth/rbac.ts`):** Add `'/notifications': ['PATIENT', 'MANAGER', 'DOCTOR', 'ADMIN']` to `ROUTE_ROLES`.
- **`GET /api/v1/notifications`:**
  - Requires authenticated user (`requireAuth`).
  - Query params: `limit` (1..50, default `20`), `unreadOnly` (`'true' | 'false'`, default `false`).
  - Queries `prisma.notification.findMany({ where: { userId: authUser.userId, ...(unreadOnly ? { isRead: false } : {}) }, orderBy: { sentAt: 'desc' }, take: limit })` and `prisma.notification.count({ where: { userId: authUser.userId, isRead: false } })`.
  - Returns `apiSuccess({ notifications, unreadCount })`.
- **`PATCH /api/v1/notifications`:**
  - Requires authenticated user (`requireAuth`).
  - Zod schema accepts `{ notificationId?: string, markAllRead?: boolean }` (requiring at least one).
  - If `markAllRead === true`: `prisma.notification.updateMany({ where: { userId: authUser.userId, isRead: false }, data: { isRead: true } })`.
  - Else (`notificationId`): verifies the notification exists and `notification.userId === authUser.userId` (`404` if missing, `403` if owned by another user — strict IDOR guard), updates `isRead: true`.
  - Returns `apiSuccess({ unreadCount })`.
- **Next.js 16 Export Compliance:** `src/app/api/v1/notifications/route.ts` exports **only** `GET` and `PATCH`.

#### Frontend Component (`src/components/notifications/NotificationBell.tsx`)
- Renders an accessible bell trigger button (`aria-label="Notifications"`, `aria-expanded`, unread count badge `99+`) in the top header bar of:
  - `src/app/(patient)/patient/layout.tsx`
  - `src/app/(manager)/manager/layout.tsx`
  - `src/app/(doctor)/doctor/layout.tsx`
  - `src/app/(admin)/admin/layout.tsx`
- Polls `GET /api/v1/notifications?limit=15` on mount (`setTimeout(..., 0)` with cleanup) and every `30s`.
- Clicking the bell opens a clean popover panel listing recent notifications (unread blue dot, channel badge `IN_APP`/`EMAIL`/`SMS`, title, plain-text snippet stripped of HTML tags for `EMAIL` rows, relative/formatted timestamp), clicking an unread item dispatches `PATCH { notificationId }`, and `"Mark all read"` dispatches `PATCH { markAllRead: true }`. Closes on `Escape` and outside click.

---

### 2.3 Component 3: Email Campaign XSS Hardening, Placeholder Interpolation & CSV Protection

#### Email Campaign Service (`src/lib/services/email-campaign.service.ts`)
- **`sanitizeEmailHtml(html: string): string`:**
  - Deterministic server-and-client safe HTML sanitizer (zero external DOM dependency):
    1. Strips dangerous container blocks together with their contents: `<script\b[^>]*>[\s\S]*?<\/script>`, `<style\b[^>]*>[\s\S]*?<\/style>`, `<iframe\b[^>]*>[\s\S]*?<\/iframe>`, `<object\b[^>]*>[\s\S]*?<\/object>`, `<embed\b[^>]*>`, `<form\b[^>]*>[\s\S]*?<\/form>`, `<meta\b[^>]*>`, `<link\b[^>]*>`, `<base\b[^>]*>` (plus unclosed/self-closing variants).
    2. Strips all inline event-handler attributes (`\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)`).
    3. Neutralizes dangerous URI schemes (`javascript:`, `vbscript:`, `data:\s*text\/html`) inside `href`, `src`, `xlink:href`, and `action` attributes by replacing them with `"#"`.
  - Applied in:
    - `POST` and `PUT` `/api/v1/admin/email-templates` (sanitizing `body` before DB persistence).
    - `email-campaign.service.ts` campaign dispatch (defense in depth for legacy/seeded templates).
    - `src/app/(admin)/admin/email-campaigns/page.tsx` and `src/app/(admin)/admin/email-templates/page.tsx` before rendering any HTML preview.
- **`interpolateCampaignTemplate(text: string, ctx: CampaignRecipientContext): string`:**
  - Supports all 7 platform placeholders in **both** `template.subject` and `template.body` (HTML-escaping user-supplied values when interpolating into HTML `body` so a malicious `fullName` cannot inject HTML!):
    - `{{fullName}}` -> `user.fullName`
    - `{{email}}` -> `user.email`
    - `{{role}}` -> `user.role`
    - `{{nationality}}` -> `user.patient?.nationality || 'International'`
    - `{{caseStatus}}` -> latest case status label or `'INQUIRY_RECEIVED'`
    - `{{portalUrl}}` -> `process.env.NEXT_PUBLIC_APP_URL || 'https://portal.afzalhealthcare.in'`
    - `{{supportEmail}}` -> `'concierge@afzalhealthcare.in'`
- **Queued Campaign Processing:**
  - `processQueuedCampaigns(now = new Date())` extracted into `email-campaign.service.ts`, querying recipients with `patient: { select: { nationality: true, cases: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 } } }`, interpolating **both** `subject` and `body`, creating `Notification` rows, and updating `EmailCampaign` (`SENT`, `sentCount`, `sentAt`).
  - Invoked automatically on `GET /api/v1/admin/email-campaigns` and exposed via `PATCH /api/v1/admin/email-campaigns` (`{ action: 'PROCESS_QUEUED' }`) with a `"Process Queued Now"` button in `/admin/email-campaigns` when queued campaigns exist.

#### OWASP CSV Formula-Injection Protection (`src/lib/api/csv-helper.ts`)
- **`sanitizeCsvCell(val)`:**
  - Converts `null` / `undefined` to `''`.
  - For strings: checks if the string (or the string after leading whitespace/`\t`/`\r`/`\n`) starts with a spreadsheet formula trigger (`=`, `+`, `@`, `|`, `%`, or `-` when the trimmed value is **not** a plain finite numeric literal `/^-\d+(\.\d+)?$/`) — or if the raw string starts with `\t` or `\r`. When matched, prefixes the value with a single quote `'` (`'${str}`) so Excel / Google Sheets / LibreOffice treat it strictly as text.
  - Quotes any field containing `,`, `"`, `\n`, or `\r` (`"${safe.replace(/"/g, '""')}"`).
- **`csvResponse(csv, filename)`:** Sanitizes `filename` (`filename.replace(/[^a-zA-Z0-9._-]/g, '_')`) and adds `X-Content-Type-Options: nosniff`.

---

### 2.4 Component 4: Final Audit Polish, Seed Idempotency, Dependency Pruning & Zero-Warning Repo Lint

1. **Patient Emergency Contact Country Code (`src/app/(patient)/patient/profile/page.tsx` & `src/app/api/v1/patient/profile/route.ts`):**
   - Persist `countryCode: emergencyCountryCode` inside `emergencyContact` JSON (`{ name, countryCode, phone, relation }`), update Zod validation in `src/lib/validation/schemas.ts` / `patient/profile/route.ts` to accept optional `countryCode`, and restore `setEmergencyCountryCode(pat.emergencyContact.countryCode || '+971')` on load.
2. **Smart Chat Auto-Scroll (`src/app/(patient)/patient/messages/page.tsx` & `src/app/(manager)/manager/chat/page.tsx`):**
   - Track `lastMessageIdRef` (and thread changes in Manager Chat). On background 10s/15s polling refreshes, only scroll to the bottom if a new message arrived (`latestId !== lastMessageIdRef.current`) or on initial thread load — never yank the user's scroll position while reading older messages when the message list is unchanged.
3. **Idempotent `prisma/seed.ts`:**
   - Add `await prisma.clinicalStep.deleteMany({ where: { caseId: sampleCase.id } });` immediately before the `for (const step of clinicalStepsData)` loop so re-running `npm run db:seed` never duplicates the 9 clinical steps.
   - Seed default `SystemConfig` rows via `prisma.systemConfig.upsert` (`update: {}`, `create: ...`) so fresh databases start with populated `system_configs`.
4. **Remove Unused Runtime Shelfware (`package.json`):**
   - Remove `bullmq`, `ioredis`, `jsonwebtoken`, `cookie` from `dependencies` and `@types/jsonwebtoken`, `@types/cookie` from `devDependencies` (verifying `0` imports across `src/` and `prisma/`).
5. **Zero-Warning Repository-Wide ESLint Sweep:**
   - Clean up the remaining pre-existing warnings in:
     - `src/app/(auth)/login/page.tsx` (unused `Stethoscope`, `fetch2FASecret` `useCallback` dependency, plus duplicate `role !== 'ADMIN' && role !== 'ADMIN'` expression and maintenance/timeout query banner)
     - `src/app/(admin)/admin/layout.tsx` (duplicate `role !== 'ADMIN' && role !== 'ADMIN'`)
     - `src/app/(patient)/patient/dashboard/page.tsx` (unused `Clock`)
     - `src/app/(patient)/patient/documents/page.tsx` (unused icons/Badge, plus ensure `INSURANCE` category is visible in document filter tabs!)
     - `src/app/(patient)/patient/messages/page.tsx` (unused `Home`)
     - `src/components/clinical/ClinicalRoadmapTree.tsx` (unused icons/variables)
     - `src/components/ui/Select.tsx` (`aria-expanded` and `aria-controls` on `role="combobox"`)

---

## 3. Error Handling & Security Invariants

- **Fail-Closed Maintenance Enforcement:** `ADMIN` users always retain full portal & API access so they can toggle `maintenanceMode: false` at any time; `logout` remains reachable for all users during maintenance.
- **Strict Notification Tenant Isolation:** `/api/v1/notifications` never accepts a `userId` query/body override — every read and mark-as-read query is bound to `authUser.userId` from the verified JWT.
- **Defense-in-Depth HTML & CSV Sanitization:** Email HTML is sanitized both at write time (`email-templates`) and at render/dispatch time (`email-campaigns`), and interpolated user fields are HTML-entity escaped before substitution into HTML bodies.
- **Next.js 16 Route Hygiene:** Every new and modified `route.ts` file exports **only** HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), and all touched files are saved as UTF-8 without BOM.

---

## 4. Verification Strategy

1. **Unit & Route Tests (`Jest`):**
   - `src/lib/services/__tests__/system-settings.service.test.ts`: `SystemConfig` read/write/cache invalidation, JSON bootstrap fallback, `checkMaintenanceActive` (manual + scheduled window + `ADMIN` bypass), `assertManagerCapacity` enforcement in onboarding & reassignment, and `defaultCommissionRate` fallback in hospitals & accommodations `POST`.
   - `src/lib/services/__tests__/notifications-and-campaigns.service.test.ts`: `GET`/`PATCH /api/v1/notifications` (unread count, single mark-read, `403` cross-user IDOR block, `markAllRead`), `sanitizeEmailHtml` (`<script>`, `<iframe>`, `onerror=`, `javascript:` stripping), `interpolateCampaignTemplate` across all 7 placeholders in `subject` + `body` with HTML escaping, `processQueuedCampaigns`, and `generateCSV` OWASP formula-injection escaping (`=CMD()`, `+1+1`, `@SUM()`, `\t=1`, while preserving `-125.50`).
2. **Repository-Wide Static & Build Gates:**
   - `npm test` (all 19 Jest suites passing)
   - `npm run typecheck` (`next typegen && tsc --noEmit` — `0` errors)
   - `npx eslint . --max-warnings=0` (**`0` errors AND `0` warnings across the entire repository**)
   - `npm run build` (`next build` — all static & dynamic routes compiling cleanly)
