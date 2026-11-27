# MedRoute (`afzal-healthcare`) — Sub-Project 1 Design Specification
## Foundation, Auth/2FA Lifecycle, Dual Onboarding, Document Vault & ePHI/RBAC Safety

- **Date:** 2026-11-23
- **Status:** Draft for Review
- **Scope:** Sub-project 1 of 4 (Remediation of Critical Audit Blockers `C-01` through `C-06`, `C-08`, `C-10`, `C-11`, `C-12`, plus Prisma connection pooling and `DatePicker` / `HotelBooking` integrity fixes)

---

## 1. Context & Goals

A full-stack audit of MedRoute (`afzal-healthcare`) identified multiple end-to-end deadlocks preventing production deployment and core multi-role workflows:
1. **Database & CI Drift (`C-12`):** `prisma/migrations/20260718104855_init/migration.sql` omits 6 Prisma models (`ClinicalStep`, `FitToFlyClearance`, `MedicalBill`, `BillItem`, `Hotel`, `HotelBooking`), 4 `Document` verification columns, 5 `DocumentCategory` enum values, and 6 `CaseStatus` enum values while keeping removed `hostels` and `accommodation_bookings` tables. `.github/workflows/ci.yml` provisions PostgreSQL against a MySQL Prisma schema with an unencoded space in `DATABASE_URL`.
2. **Authentication, 2FA, Session & Password Recovery Breaks (`C-02`, `C-03`, `C-04`):**
   - `/api/v1/auth/2fa/setup`, `/api/v1/auth/2fa/validate`, and `/api/v1/auth/logout` are blocked by `src/proxy.ts` when no valid `access_token` is present.
   - First-time 2FA setup stores `2fa_setup_${id}` in `RefreshToken.token`, whereas `2fa/validate` only queries `2fa_${id}`.
   - `/api/v1/auth/logout` and `/api/v1/auth/refresh` require `refreshToken` in the JSON request body despite `refresh_token` being an `HttpOnly` cookie; bodyless `POST /api/v1/auth/logout` calls from layouts and `SessionTimeoutProvider` throw `SyntaxError` (`500`) before clearing cookies.
   - `SessionTimeoutProvider` `"Stay Logged In"` never refreshes the 15-minute `access_token`.
   - `/forgot-password` calls `/api/v1/auth/forgot-password` and `/api/v1/auth/reset-password`, neither of which exists.
3. **Onboarding & Case Lifecycle Deadlocks (`C-01`, `C-06`, `C-11`):**
   - `POST /api/v1/auth/register` is disabled (`403`), `POST /api/v1/admin/users` creates orphan `User` rows without `Patient` or `Case` rows, and zero `prisma.patient.create` or `prisma.case.create` calls exist in `src/`.
   - `prisma/schema.prisma` defines 12 `CaseStatus` stages (`seed.ts` uses `WARD_RECOVERY`), whereas `constants.ts`, `schemas.ts`, `Badge.tsx`, and all portals only support 6 stages.
   - Admin reassignment updates `Case.managerId` and `Patient.assignedManagerId` independently across routes, and `admin/patients/page.tsx` resets `reassignManagerId` to `''` on drawer open.
4. **Broken Document Downloads & Upload XSS (`C-05`):**
   - `POST /api/v1/patient/documents` overwrites `Document.fileUrl` with `/api/v1/patient/documents/download?id=...`, destroying the physical disk filename so `download/route.ts` (`path.basename(fileUrl)`) always returns `404` and `DELETE` leaves orphan files on disk.
   - Seeded documents and Manager billing PDFs use `?file=...`, returning `400` on `download/route.ts`, while `MANAGER`/`ADMIN`/`DOCTOR` roles receive `403` from `proxy.ts` on `/api/v1/patient/*`.
   - Uploads skip MIME/extension/magic-byte validation while serving files `inline`.
5. **ePHI Decryption Hazard & Cross-Tenant IDOR (`C-08`, `C-10`):**
   - `PUT /api/v1/patient/profile` encrypts `allergies`, `medications`, `surgeries`, and `chronicConditions`, while `GET /api/v1/manager/patients`, `GET /api/v1/doctor/patients`, and `GET /api/v1/auth/me` return raw ciphertext, causing Manager UI `JSON.parse` fallbacks to display `"None declared"` for patient allergies and medications.
   - `GET /api/v1/manager/billing` and `GET /api/v1/accommodations/bookings` leak cross-patient financial and ePHI records across roles/managers; `POST /api/v1/patient/appointments` and `POST /api/v1/accommodations/bookings` do not verify `caseId` ownership; hotel booking uses `Math.abs()` allowing `checkOutDate < checkInDate`; and 5 Manager API routes instantiate `new PrismaClient()` directly.

### Non-Goals for Sub-Project 1
- Building the `(doctor)` frontend portal, Clinical Pathway Builder fixes, `FitToFlyClearance` UI, and Document Verification/VIL issuance UI (scheduled for **Sub-project 2**).
- Medical Billing settlement (`PUT`/`PATCH`), Manager Billing dropdown refactor, OCR replacement, and Revenue/Commission analytics overhaul (scheduled for **Sub-project 3**, aside from the IDOR filter & invoice download support included here).
- Migrating `src/data/settings.json` to `SystemConfig`, building in-app Notification drawers, and live Email Campaign workers (scheduled for **Sub-project 4**).

---

## 2. Database Schema, Migrations, Seed & CI Architecture

### 2.1 Prisma Schema Additions (`prisma/schema.prisma`)
1. **`Document` model:**
   - Add `storageKey String? @map("storage_key")` — stores the sanitized physical filename inside `storage/uploads/` (e.g., `"doc_cma123_passport.pdf"`), decoupling physical file resolution from `fileUrl` (`/api/v1/documents/${id}/download`).
2. **`MedicalBill` model:**
   - Add `storageKey String? @map("storage_key")` — stores the physical invoice filename inside `storage/uploads/`, decoupling physical file resolution from `fileUrl` (`/api/v1/documents/bill/${id}/download`).
3. **`PasswordResetToken` model:**
   ```prisma
   model PasswordResetToken {
     id        String    @id @default(cuid())
     userId    String    @map("user_id")
     otpHash   String    @map("otp_hash") // SHA-256 hex digest of 6-digit OTP + userId
     attempts  Int       @default(0)
     expiresAt DateTime  @map("expires_at")
     usedAt    DateTime? @map("used_at")
     createdAt DateTime  @default(now()) @map("created_at")

     user User @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId, expiresAt])
     @@map("password_reset_tokens")
   }
   ```
   Add `passwordResetTokens PasswordResetToken[]` relation on `User`.
4. **Remove Redundant Index:** Remove duplicate `@@index([token])` on `RefreshToken` (`token` already has `@unique`).

### 2.2 Migration Reconciliation (`prisma/migrations/`)
- Create migration `prisma/migrations/20261123000000_sync_schema_phase1/migration.sql` that cleanly migrates from `20260718104855_init` to the current `schema.prisma`:
  - `DROP TABLE IF EXISTS accommodation_bookings;` and `DROP TABLE IF EXISTS hostels;`
  - `ALTER TABLE users MODIFY COLUMN role ENUM('PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR') NOT NULL;` (reassigning any legacy `'SUPER_ADMIN'` rows to `'ADMIN'` first).
  - `ALTER TABLE cases MODIFY COLUMN status ENUM('INQUIRY_RECEIVED', 'UNDER_REVIEW', 'PRE_OP_CLEARANCE', 'PLAN_CONFIRMED', 'IN_TREATMENT', 'ICU_RECOVERY', 'WARD_RECOVERY', 'POST_TREATMENT', 'OUTPATIENT_RECUPERATION', 'FIT_TO_FLY_CLEARED', 'REMOTE_REHAB', 'CLOSED') NOT NULL DEFAULT 'INQUIRY_RECEIVED';`
  - `ALTER TABLE documents` to expand `category` to all 10 `DocumentCategory` values and add `storage_key`, `verification_status`, `verified_by`, `verification_notes`, `verified_at`, plus index `documents_verification_status_idx`.
  - `CREATE TABLE` + foreign keys + indexes for `clinical_steps`, `fit_to_fly_clearances`, `medical_bills` (including `storage_key`), `bill_items`, `hotels`, `hotel_bookings`, and `password_reset_tokens`.

### 2.3 Idempotent Seed & Sample Files (`prisma/seed.ts`)
- Remove duplicate `seed-case-001` upsert.
- Encrypt `passportNo` via `encrypt('A12345678')` and `PatientMedicalProfile` fields via `encryptMedicalProfile(...)` so seeded data matches production encryption format.
- Seed a linked `DOCTOR` user (`doctor@afzalhealthcare.in` / `Doctor@123`) connected via `userId` to `seed-doctor-001` (`Dr. Ashok Seth`).
- Before inserting `ClinicalStep`, `Document`, and `BillItem` records for `seed-case-001` / `INV-2026-0042`, run `deleteMany` scoped to those seed parent IDs so `npm run db:seed` is 100% idempotent.
- Generate valid minimal PDF buffers inside `storage/uploads/` (`VIL_Sample.pdf`, `Invoice_Sample.pdf`, `Passport_Sample.pdf`, `Angio_Report.pdf`) and populate `storageKey` + canonical `fileUrl` (`/api/v1/documents/${doc.id}/download` and `/api/v1/documents/bill/${sampleBill.id}/download`).

### 2.4 CI & Environment Hygiene (`.github/workflows/ci.yml`, `.env.example`, `.gitignore`)
- Replace `postgres:15` in `.github/workflows/ci.yml` with `mysql:8.0` (`MYSQL_ROOT_PASSWORD: root`, `MYSQL_DATABASE: medroute_test`, port `3306`, `mysqladmin ping` healthcheck) and `DATABASE_URL: mysql://root:root@127.0.0.1:3306/medroute_test`.
- Fix `.env.example` line 5 (`NODE_ENV="development"`) and add `.env.local` and `.env.*.local` to `.gitignore` (`/storage/` is already gitignored and created dynamically via `fs.mkdir`).

---

## 3. Authentication, 2FA, Session Lifecycle & Password Recovery

### 3.1 Edge Proxy & RBAC (`src/proxy.ts` & `src/lib/auth/rbac.ts`)
- **`PUBLIC_ROUTES` (`src/proxy.ts`):**
  - Include: `'/login'`, `'/register'`, `'/forgot-password'`, `'/api/v1/auth/login'`, `'/api/v1/auth/register'`, `'/api/v1/auth/2fa/setup'`, `'/api/v1/auth/2fa/validate'`, `'/api/v1/auth/forgot-password'`, `'/api/v1/auth/reset-password'`, `'/api/v1/auth/refresh'`, `'/api/v1/auth/logout'`.
  - Remove dead `/api/v1/auth/login/otp/*` entries.
- **`SKIP_ROUTES` (`src/proxy.ts`):** Add `'/assets'` and `'/icon.png'`.
- **`ROUTE_ROLES` (`src/lib/auth/rbac.ts`):**
  - `'/patient': ['PATIENT']`
  - `'/manager': ['MANAGER', 'ADMIN']`
  - `'/admin': ['ADMIN']`
  - `'/doctor': ['DOCTOR']`
- **`PERMISSIONS` & `getDefaultRoute` (`src/lib/auth/rbac.ts`):**
  - Add `'PATIENT'` to `'send:messages'`.
  - Add `'DOCTOR'` permissions (`'view:own-profile'`, `'edit:own-profile'`, `'view:appointments'`, `'view:documents'`).
  - Update `getDefaultRoute('DOCTOR')` to return `'/doctor/dashboard'` (preventing `/login` redirect loops; also enforce `authUser.role === 'DOCTOR'` in all 3 `/api/v1/doctor/*` handlers).

### 3.2 Mandatory TOTP 2FA Setup & Validation
- **`POST /api/v1/auth/2fa/validate` (`src/app/api/v1/auth/2fa/validate/route.ts`):**
  - Query `RefreshToken` with `token: { in: [\`2fa_${tempSessionId}\`, \`2fa_setup_${tempSessionId}\`] }, revokedAt: null, expiresAt: { gt: new Date() }`.
  - Verify TOTP code via `verifyTOTP(code, decrypt(user.totpSecret))`.
  - In a single `prisma.$transaction`: revoke the temp token, set `user.totpEnabled = true`, and create the real 7-day `RefreshToken` record, then issue `access_token` + `refresh_token` HttpOnly cookies.
- **`src/app/(auth)/login/page.tsx`:**
  - Store `totpUri` returned by `/api/v1/auth/2fa/setup` and display both a copyable manual secret key and an `otpauth://` URI link / clear setup instructions; clean up duplicate `case 'ADMIN':` branch.

### 3.3 Cookie-First Token Refresh, Logout & Idle Auto-Logoff
- **`POST /api/v1/auth/logout`:**
  - Read `refresh_token` from `request.cookies.get('refresh_token')?.value`, falling back to optional JSON body `{ refreshToken }` wrapped in `try { await request.json() } catch { /* empty body allowed */ }`.
  - If a token exists and verifies, mark `RefreshToken.revokedAt = new Date()` (`updateMany` so already-deleted/missing rows never throw).
  - **Always** call `await clearAuthCookies()` and return `200 OK` (`{ message: 'Logged out successfully' }`).
- **`POST /api/v1/auth/refresh`:**
  - Read incoming refresh token from `request.cookies.get('refresh_token')?.value` first, falling back safely to optional JSON body `{ refreshToken }`.
  - Perform existing reuse detection, active-user check, old-token revocation, new token rotation, and `setAuthCookies(accessToken, refreshToken)`.
- **`src/components/SessionTimeoutProvider.tsx`:**
  - Track active user interaction: while the user is active (activity detected within the last 12 minutes and last refresh was `>= 11` minutes ago), automatically call `POST /api/v1/auth/refresh` in the background so active users are never kicked out at 15 minutes.
  - When `"Stay Logged In"` is clicked during the 13–15 minute warning window, call `POST /api/v1/auth/refresh` before resetting timers (redirecting to `/login?reason=expired` if refresh returns non-200).

### 3.4 OTP Password Recovery
- **`POST /api/v1/auth/forgot-password`:**
  - Validate `{ email }` with `otpRequestSchema`.
  - Rate-limit per user: if `>= 3` unused `PasswordResetToken` rows were created in the last 15 minutes, return `429 RATE_LIMIT_EXCEEDED`.
  - Always return `200 OK` (`{ message: 'If an account exists with that email, a verification code has been sent.' }`) when email is unknown or inactive (preventing account enumeration).
  - For active users: invalidate prior unused tokens (`usedAt = new Date()`), generate a CSPRNG 6-digit code via `crypto.randomInt(100000, 1000000)`, store `otpHash = sha256("${user.id}:${otp}")` in `PasswordResetToken` with `expiresAt = now + 5 minutes`.
  - Deliver via `sendPasswordResetEmail(email, otp)` helper (uses SMTP env config when present; logs `[DEV OTP] Password reset code for ${email}: ${otp}` when `process.env.NODE_ENV !== 'production'`).
- **`POST /api/v1/auth/reset-password`:**
  - Validate `{ email, otp, newPassword }` with `resetPasswordSchema`.
  - Locate latest unused, non-expired `PasswordResetToken` for `user.id`.
  - If `attempts >= 5`, mark `usedAt = new Date()` and return `401 OTP_EXPIRED`.
  - Compare `otpHash` using `crypto.timingSafeEqual`. On mismatch, increment `attempts` and return `401 OTP_INVALID`.
  - On match, run `prisma.$transaction`: update `User.passwordHash` (`hashPassword(newPassword)`), mark `PasswordResetToken.usedAt = new Date()`, revoke all active `RefreshToken` rows for `user.id`, and record `AuditLog` (`RESET_PASSWORD`).

---

## 4. Dual Onboarding, 12-Stage `CaseStatus` & Coordinator Sync

### 4.1 Shared Onboarding Service (`src/lib/services/onboarding.service.ts`)
- **`onboardPatient(input, actorId?, ipAddress?)`:**
  - Accepts `{ email, password, fullName, phone?, nationality, passportNo, dob, bloodGroup?, primaryLanguage?, medicalCondition?, urgencyLevel?, emergencyContact?, assignedManagerId?, initialCaseNotes? }`.
  - Checks email uniqueness (`409 USER_ALREADY_EXISTS`).
  - If `assignedManagerId` is omitted, selects the active `MANAGER` with the lowest open case count (or `null` if no managers exist). If provided, verifies the user exists with `role: 'MANAGER'` and `isActive: true`.
  - Executes a single `prisma.$transaction`:
    1. Creates `User` (`role: 'PATIENT'`, `passwordHash`).
    2. Creates `Patient` (`passportNo: encrypt(passportNo)`, `assignedManagerId`).
    3. Creates empty `PatientMedicalProfile` (`patientId`).
    4. Creates initial `Case` (`patientId`, `managerId: assignedManagerId`, `status: 'INQUIRY_RECEIVED'`, `isUrgent: urgencyLevel === 'URGENT'`, `notes: initialCaseNotes || medicalCondition || null`).
  - Logs `CREATE` `AuditLog` entry.
- **Entry Points Using `onboardPatient`:**
  1. **`POST /api/v1/auth/register` + `src/app/(auth)/register/page.tsx`:** Restores full self-registration form (`fullName`, `email`, `password`, `phone`, `nationality`, `passportNo`, `dob`, `primaryLanguage`, optional `medicalCondition`), calls `onboardPatient`, issues `access_token` + `refresh_token` cookies, and redirects to `/patient/dashboard`; adds `"Create Patient Account"` link on `/login`.
  2. **`POST /api/v1/admin/patients` + `POST /api/v1/admin/users`:**
     - `POST /api/v1/admin/patients` allows Admins to onboard a complete Patient + Case directly from `/admin/patients` ("Add Patient" modal).
     - `POST /api/v1/admin/users` requires `nationality`, `passportNo`, and `dob` (validated via Zod discriminated/conditional refinement, surfaced dynamically in `/admin/users` modal when `role === 'PATIENT'`) and delegates `PATIENT` creation to `onboardPatient` so orphan `PATIENT` accounts can **never** be created.
  3. **`POST /api/v1/manager/cases` & `POST /api/v1/admin/cases`:**
     - Validates `createCaseSchema` (`{ patientId, notes?, isUrgent?, managerId? }`), verifies `Patient` exists, defaults `managerId` to `patient.assignedManagerId` (or the acting `MANAGER`), syncs `patient.assignedManagerId` if previously `null`, creates the new `Case` (`INQUIRY_RECEIVED`), and logs `CREATE` `AuditLog`.

### 4.2 12-Stage `CaseStatus` Alignment & Escalation Hygiene
- **`src/lib/constants.ts` & `src/lib/validation/schemas.ts` & `src/components/ui/Badge.tsx`:**
  - Update `CASE_STATUSES`, `CASE_STATUS_ORDER`, `CASE_STATUS_LABELS`, `updateCaseStatusSchema`, `CaseStatusBadge`, and `/api/v1/admin/cases` `VALID_STATUSES` to include all **12** Prisma statuses in clinical order:
    1. `INQUIRY_RECEIVED` ("Inquiry Received")
    2. `UNDER_REVIEW` ("Under Clinical Review")
    3. `PRE_OP_CLEARANCE` ("Pre-Op Clearance")
    4. `PLAN_CONFIRMED` ("Treatment Plan Confirmed")
    5. `IN_TREATMENT` ("In Treatment / Procedure")
    6. `ICU_RECOVERY` ("ICU / CCU Recovery")
    7. `WARD_RECOVERY` ("In-Patient Ward Recovery")
    8. `POST_TREATMENT` ("Post-Treatment Observation")
    9. `OUTPATIENT_RECUPERATION` ("Outpatient Recuperation")
    10. `FIT_TO_FLY_CLEARED` ("Fit-to-Fly Cleared")
    11. `REMOTE_REHAB` ("Remote Tele-Rehab")
    12. `CLOSED` ("Case Closed")
  - Define `CASE_PHASE_GROUPS` mapping the 12 granular statuses into **6 macro phases** (`INQUIRY` -> `[INQUIRY_RECEIVED, UNDER_REVIEW]`, `PRE_OP` -> `[PRE_OP_CLEARANCE, PLAN_CONFIRMED]`, `TREATMENT` -> `[IN_TREATMENT]`, `RECOVERY` -> `[ICU_RECOVERY, WARD_RECOVERY, POST_TREATMENT]`, `DISCHARGE` -> `[OUTPATIENT_RECUPERATION, FIT_TO_FLY_CLEARED, REMOTE_REHAB]`, `CLOSED` -> `[CLOSED]`).
- **Portal UI Updates:**
  - `/patient/dashboard`: Maps any of the 12 statuses accurately to its macro phase index and displays the exact sub-stage label (`"Ward Recovery — Phase 4 of 6"`).
  - `/manager/cases`: Uses `"ALL"` + the 6 macro phase tabs (matching all underlying statuses in each group so `WARD_RECOVERY` cases appear immediately) while allowing full 12-status selection in the case update modal.
  - `/admin/cases` & `/admin/dashboard`: Supports all 12 statuses in filter dropdowns, status distribution charts (with defined hex colors), and `"Move to → ..."` progression.
- **Ghost Escalation Fix (`PUT /api/v1/manager/cases` & `GET /api/v1/admin/escalations`):**
  - Normalize `escalationNote`: `const normalizedEscalation = escalationNote?.trim() ? escalationNote.trim() : null;`.
  - Block reopening `CLOSED` cases in `PUT /api/v1/manager/cases`, and write `STATUS_CHANGE` / `UPDATE` `AuditLog` entries.

### 4.3 Atomic Coordinator Assignment (`src/lib/services/case-assignment.service.ts`)
- **`assignPatientCoordinator({ patientId, caseId?, managerId, actorId, ipAddress })`:**
  - Verifies `managerId` (when non-null) belongs to an active `MANAGER`.
  - In a single `prisma.$transaction`: updates `Patient.assignedManagerId = managerId` AND updates all open (`status !== 'CLOSED'`) cases for that patient (or the targeted `caseId` + `Patient.assignedManagerId`) so `Case.managerId` and `Patient.assignedManagerId` never diverge; creates `AuditLog` (`REASSIGN`) inside `tx`.
- **Admin Patients Fix (`src/app/(admin)/admin/patients/page.tsx` & `route.ts`):**
  - Include `assignedManager: { select: { id: true, fullName: true, email: true } }` in `GET /api/v1/admin/patients`.
  - Fix line 166 to `setReassignManagerId(p.assignedManager?.id || '')`.

---

## 5. Document Vault, Upload Validation & Unified Streaming Download

### 5.1 Upload Hardening (`src/lib/services/document-storage.service.ts`)
- **`validateAndStoreUpload(file, prefix)`:**
  - Enforces `file.size > 0 && file.size <= SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES` (`25 MB`).
  - Validates extension against `ALLOWED_EXTENSIONS` (`.pdf`, `.jpg`, `.jpeg`, `.png`) and MIME against `ALLOWED_MIME_TYPES`.
  - Validates true binary **magic bytes** on buffer header:
    - `application/pdf`: `%PDF-` (`25 50 44 46 2D`)
    - `image/jpeg`: `FF D8 FF`
    - `image/png`: `89 50 4E 47 0D 0A 1A 0A`
  - Generates collision-free `storageKey = "${prefix}_${crypto.randomUUID()}${ext}"` and writes to `storage/uploads/${storageKey}`.
- **`POST /api/v1/patient/documents`:**
  - Validates `category` against the 5 patient-uploadable categories (`PASSPORT`, `VISA`, `MEDICAL_REPORT`, `PRESCRIPTION`, `INSURANCE`, plus `FRRO_REGISTRATION`).
  - Calls `validateAndStoreUpload(file, 'doc')`, saves `storageKey`, and sets `fileUrl = "/api/v1/documents/${doc.id}/download"`.
- **`DELETE /api/v1/patient/documents`:**
  - Rejects `PATIENT` deletion when `document.verificationStatus` is `'VERIFIED'` or `'ISSUED_BY_HOSPITAL'` (`403 FORBIDDEN`).
  - Unlinks physical file using `document.storageKey` (with safe legacy fallback only if `storageKey` is null and `fileUrl` does not contain `?`), then deletes DB row and writes `DELETE` `AuditLog`.
- **`POST /api/v1/manager/billing`:**
  - Uses `validateAndStoreUpload(file, 'bill')`, stores `storageKey` on `MedicalBill`, and sets `fileUrl = "/api/v1/documents/bill/${bill.id}/download"`.

### 5.2 Unified Multi-Role Download Endpoints
- **`GET /api/v1/documents/[id]/download` (`src/app/api/v1/documents/[id]/download/route.ts`):**
  - Accessible to all authenticated roles (not under `/api/v1/patient/*`).
  - Enforces strict object-level authorization:
    - `PATIENT`: `document.patient.userId === authUser.userId`
    - `MANAGER`: `document.patient.assignedManagerId === authUser.userId` or active case `managerId === authUser.userId`
    - `DOCTOR`: has non-cancelled `Appointment` with `document.patientId`
    - `ADMIN`: allowed
  - Resolves physical path strictly via `path.basename(document.storageKey)` inside `storage/uploads/`.
  - Streams buffer with `Content-Type` allowlisted to `application/pdf`, `image/jpeg`, `image/png`, or `application/octet-stream`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache, no-store, must-revalidate`, and `Content-Disposition: inline; filename="..."`.
  - Records `DOWNLOAD_DOCUMENT` `AuditLog`.
- **`GET /api/v1/documents/bill/[id]/download`:**
  - Same role/ownership checks against `MedicalBill` (`patient.userId`, `case.managerId` / `patient.assignedManagerId`, `ADMIN`), resolving `bill.storageKey` and logging `DOWNLOAD_DOCUMENT`.
- **Backward-Compatible Alias (`GET /api/v1/patient/documents/download`):**
  - Supports `?id=` by delegating to the same shared download service so existing DB links continue working for patients.

---

## 6. ePHI Decryption Safety, Prisma Singleton & IDOR Lockdown

### 6.1 Centralized ePHI Projection & Hardened Crypto (`src/lib/services/phi.service.ts` & `src/lib/auth/crypto.ts`)
- **`crypto.ts`:**
  - Separate legacy non-ciphertext passthrough (`parts.length !== 3` or non-hex IV/tag -> legacy plaintext from pre-encryption rows) from **GCM authentication failure** (`decipher.final()` throws on valid `iv:tag:cipher` structure -> log error and throw `DecryptionTamperError` or return `null` in `decryptField` instead of returning raw `"iv:tag:cipher"` string!).
  - Fix `encryptField([])` in `src/lib/api/phi-encryption.ts` to encrypt `'[]'` consistently so decrypted empty arrays always parse back to `[]`.
- **`phi.service.ts`:**
  - `formatPatientForViewer(patient, viewerRole)`:
    - Always runs `decryptMedicalProfile(patient.medicalProfile)` ensuring `allergies`, `medications`, `surgeries`, and `chronicConditions` are returned as clean JavaScript arrays (`string[]` / `object[]`).
    - Decrypts `passportNo` only when needed; masks `passportNo` in list endpoints (`GET /api/v1/admin/patients` returns masked `****5678` in table list).
  - Applied across:
    1. `GET /api/v1/manager/patients` (+ records `VIEW_PATIENT` `AuditLog`)
    2. `GET /api/v1/doctor/patients` (+ enforces `role === 'DOCTOR'` & active doctor check + records `VIEW_PATIENT` `AuditLog`)
    3. `GET /api/v1/admin/patients`
    4. `GET /api/v1/auth/me`

### 6.2 Singleton Prisma Client & Cross-Tenant IDOR Fixes
- **Prisma Singleton:** Replace `new PrismaClient()` with `import prisma from '@/lib/prisma'` in all 5 Manager API routes (`appointments`, `cases`, `chat`, `dashboard`, `patients`), and remove `'query'` stdout logging of bound ePHI parameters in `src/lib/prisma.ts` unless `PRISMA_LOG_QUERIES === 'true'`.
- **Manager Billing IDOR (`src/app/api/v1/manager/billing/route.ts`):**
  - Enforce `role === 'MANAGER' || role === 'ADMIN'`.
  - When `role === 'MANAGER'`, scope `GET` `where` to `{ case: { managerId: authUser.userId } }` and verify `caseRecord.managerId === authUser.userId` on `POST`.
- **Accommodations RBAC & Data Minimization (`src/app/api/v1/accommodations/*`):**
  - `GET /api/v1/accommodations`: Strip `commissionPercent` when `authUser.role === 'PATIENT'`.
  - `GET /api/v1/accommodations/bookings`:
    - `PATIENT`: `where: { patientId: patient.id }`, strip `commissionAmountUsd` and `metrics`.
    - `MANAGER`: `where: { patient: { assignedManagerId: authUser.userId } }`, `select` only safe patient contact fields (`user.fullName`, `user.email`, `nationality` — omit `passportNo`, `medicalCondition`, `dob`, `bloodGroup`, `emergencyContact`).
    - `ADMIN`: full bookings + revenue/commission metrics (excluding `status: 'CANCELLED'` from revenue/commission sums).
    - `DOCTOR`: return `403 FORBIDDEN`.
  - `POST /api/v1/accommodations/bookings`: Require `role === 'PATIENT' || role === 'MANAGER' || role === 'ADMIN'`; verify `hotel.isActive === true`; validate `checkInDate` and `checkOutDate` are valid dates with **`checkOutDate > checkInDate`** (removing `Math.abs()`); validate `numGuests >= 1 && numGuests <= 10`; verify `caseId` (when provided) belongs to `patient.id`.
- **Appointment Case Ownership (`POST /api/v1/patient/appointments` & `POST /api/v1/manager/appointments`):**
  - Verify `caseRecord.patientId === patient.id`, `caseRecord.status !== 'CLOSED'`, and `doctor.hospitalId === hospitalId`.
- **UI Fixes Coupled to Phase 1 Workflows:**
  - `src/components/ui/DatePicker.tsx`: Replace `includeTime` checks in `handleDaySelect` and `formatDisplay` with `hasTimePicker`, and parse `YYYY-MM-DD` strings in local time (`new Date(year, month - 1, day)`) to prevent UTC off-by-one-day shifts.
  - `src/components/ui/PhoneInput.tsx`: Escape JSX quotes on line 588 so `npm run lint` passes cleanly.
  - `src/app/(patient)/patient/layout.tsx`: Add `"Medical Profile"` (`/patient/profile`) link to Patient sidebar navigation; remove leaked `/manager/cases/${id}/pathway` button from `src/app/(patient)/patient/dashboard/page.tsx`.

---

## 7. Verification Strategy

1. **Static & Build Verification:**
   - `npm ci`, `npx prisma generate`, `npm run typecheck` (`0` errors), `npm run lint` (`0` errors), `npm run build` (`exit 0`).
2. **Database & Migration Verification:**
   - Validate `prisma migrate deploy` + `npm run db:seed` twice consecutively (verifying idempotency, encrypted seed ePHI, and sample PDF files in `storage/uploads/`).
3. **Automated Unit & Integration Tests (`jest`):**
   - `crypto.test.ts` & `phi.service.test.ts`: AES-256-GCM roundtrip, empty-array handling, legacy plaintext fallback, tamper failure refusal, and `formatPatientForViewer` allergy/medication decryption.
   - `document-storage.test.ts`: Magic-byte validation (accepts valid PDF/JPEG/PNG; rejects `.html`/`.svg` spoofing `.pdf`), ownership checks, and `VERIFIED` delete protection.
   - `auth-flows.test.ts`: 2FA `2fa_setup_` -> `2fa/validate` token flow, cookie-first logout/refresh with empty POST body, and OTP password reset lifecycle (hash verification, expiry, 5-attempt lockout).
   - `case-status-and-onboarding.test.ts`: All 12 `CaseStatus` validations/phase mappings, dual onboarding transaction (`User + Patient + MedicalProfile + Case`), and atomic `Patient.assignedManagerId` <-> `Case.managerId` reassignment.
