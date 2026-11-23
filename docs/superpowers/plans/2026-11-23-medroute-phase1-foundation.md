# MedRoute Sub-Project 1: Foundation, Auth/2FA, Onboarding, Document Vault & ePHI Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all Sub-Project 1 production blockers — reconciling Prisma MySQL migrations & CI, fixing production 2FA/logout/refresh/OTP password recovery, enabling dual Patient & Case onboarding across all 12 clinical statuses, restoring secure multi-role document & invoice downloads, decrypting clinical ePHI across portals, and locking down cross-tenant RBAC/IDOR vulnerabilities.

**Architecture:** We introduce dedicated storage/token fields in Prisma (`Document.storageKey`, `MedicalBill.storageKey`, `PasswordResetToken`) alongside a clean MySQL reconciliation migration, and extract 5 focused server domain modules under `src/lib/services/` (`phi.service.ts`, `password-reset.service.ts`, `onboarding.service.ts`, `case-assignment.service.ts`, `document-storage.service.ts`). Route handlers across Auth, Patient, Manager, Doctor, Admin, and Accommodations delegate to these shared services so encryption, RBAC/ownership checks, and transactional invariants stay identical everywhere.

**Tech Stack:** Next.js 16.2.9 (App Router, `src/proxy.ts` Edge Middleware), React 19, TypeScript 5, Prisma 6.19 (`mysql`), `jose` 6, `otpauth` 9, `bcryptjs` 3, `zod` 4, Tailwind CSS v4, Jest 30 + `ts-jest`.

**Spec:** `docs/superpowers/specs/2026-11-23-medroute-phase1-foundation-design.md`

## Global Constraints

- **Next.js 16 Convention:** Route middleware lives in `src/proxy.ts` (`export default async function proxy(request: NextRequest)`), NOT `middleware.ts`. Read relevant Next.js 16 docs in `node_modules/next/dist/docs/` after `npm ci` if touching framework conventions.
- **Database Engine:** MySQL 8 (`provider = "mysql"` in `prisma/schema.prisma`). Never introduce PostgreSQL-only DDL or Prisma scalar arrays (`String[]`).
- **Prisma Singleton:** Every server module MUST import `prisma` from `@/lib/prisma` — never instantiate `new PrismaClient()` in route handlers.
- **ePHI Security:** AES-256-GCM via `src/lib/auth/crypto.ts`. Never return raw `"iv:authTag:ciphertext"` strings on authTag tamper failure; always decrypt `PatientMedicalProfile` before returning clinical profiles to UI consumers.
- **File Uploads:** Maximum `25 MB` (`SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES`), restricted to `application/pdf`, `image/jpeg`, `image/png` verified by BOTH MIME/extension AND binary magic bytes; stored exclusively in `storage/uploads/` via `storageKey`.
- **Cookie Security:** `access_token` (`15m`) and `refresh_token` (`7d`) are `httpOnly: true`, `sameSite: 'strict'`, `path: '/'`. Logout and refresh endpoints MUST read `refresh_token` from `request.cookies` first without failing when the POST body is empty.

---

## File Map (Created & Modified)

### Created Files
- `prisma/migrations/20261123000000_sync_schema_phase1/migration.sql` — Reconciles schema drift (`clinical_steps`, `fit_to_fly_clearances`, `medical_bills`, `bill_items`, `hotels`, `hotel_bookings`, `password_reset_tokens`, `documents` columns/enums, 12 `CaseStatus` values).
- `src/lib/services/phi.service.ts` — Centralized `formatPatientForViewer` and `maskPassportNumber` helpers.
- `src/lib/services/password-reset.service.ts` — CSPRNG OTP generation, SHA-256 hashing, rate-limit check, timing-safe verification, password update & token revocation.
- `src/lib/services/onboarding.service.ts` — Transactional `onboardPatient` (`User + Patient + PatientMedicalProfile + Case`) and `createCaseForPatient`.
- `src/lib/services/case-assignment.service.ts` — Transactional `assignPatientCoordinator` synchronizing `Patient.assignedManagerId` and open `Case.managerId`.
- `src/lib/services/document-storage.service.ts` — Magic-byte validator, private `storage/uploads` writer/deleter, and multi-role streaming download authorizer.
- `src/app/api/v1/auth/forgot-password/route.ts` — `POST` OTP request endpoint.
- `src/app/api/v1/auth/reset-password/route.ts` — `POST` OTP verification & password update endpoint.
- `src/app/api/v1/documents/[id]/download/route.ts` — Unified multi-role authenticated `Document` streaming endpoint.
- `src/app/api/v1/documents/bill/[id]/download/route.ts` — Unified multi-role authenticated `MedicalBill` PDF streaming endpoint.
- `src/lib/__tests__/schema-constants.test.ts` — Schema/constants verification tests.
- `src/lib/services/__tests__/phi.service.test.ts` — ePHI projection & tamper tests.
- `src/lib/auth/__tests__/rbac-and-session.test.ts` — RBAC, `ROUTE_ROLES`, and 2FA/cookie helper tests.
- `src/lib/services/__tests__/password-reset.service.test.ts` — OTP lifecycle unit tests.
- `src/lib/__tests__/case-status.test.ts` — 12-stage `CaseStatus` & macro phase mapping tests.
- `src/lib/services/__tests__/onboarding-and-assignment.test.ts` — Onboarding & coordinator sync tests.
- `src/lib/services/__tests__/document-storage.service.test.ts` — Magic-byte & ownership authorization tests.
- `src/lib/__tests__/idor-and-datepicker.test.ts` — Date validation & local date parsing tests.

### Modified Files
- `prisma/schema.prisma`, `prisma/seed.ts`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore`, `jest.config.js`, `src/lib/prisma.ts`
- `src/lib/auth/crypto.ts`, `src/lib/api/phi-encryption.ts`, `src/lib/auth/rbac.ts`, `src/proxy.ts`
- `src/lib/constants.ts`, `src/lib/validation/schemas.ts`, `src/components/ui/Badge.tsx`
- `src/app/api/v1/auth/2fa/validate/route.ts`, `src/app/api/v1/auth/logout/route.ts`, `src/app/api/v1/auth/refresh/route.ts`, `src/app/api/v1/auth/register/route.ts`, `src/app/api/v1/auth/me/route.ts`
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/components/SessionTimeoutProvider.tsx`
- `src/app/api/v1/admin/users/route.ts`, `src/app/api/v1/admin/patients/route.ts`, `src/app/api/v1/admin/cases/route.ts`, `src/app/api/v1/admin/cases/reassign/route.ts`
- `src/app/(admin)/admin/users/page.tsx`, `src/app/(admin)/admin/patients/page.tsx`, `src/app/(admin)/admin/cases/page.tsx`, `src/app/(admin)/admin/dashboard/page.tsx`
- `src/app/api/v1/manager/cases/route.ts`, `src/app/api/v1/manager/patients/route.ts`, `src/app/api/v1/manager/billing/route.ts`, `src/app/api/v1/manager/appointments/route.ts`, `src/app/api/v1/manager/chat/route.ts`, `src/app/api/v1/manager/dashboard/route.ts`
- `src/app/(manager)/manager/cases/page.tsx`, `src/app/(manager)/manager/billing/page.tsx`
- `src/app/api/v1/patient/documents/route.ts`, `src/app/api/v1/patient/documents/download/route.ts`, `src/app/api/v1/patient/appointments/route.ts`
- `src/app/(patient)/patient/layout.tsx`, `src/app/(patient)/patient/dashboard/page.tsx`
- `src/app/api/v1/doctor/dashboard/route.ts`, `src/app/api/v1/doctor/appointments/route.ts`, `src/app/api/v1/doctor/patients/route.ts`
- `src/app/api/v1/accommodations/route.ts`, `src/app/api/v1/accommodations/bookings/route.ts`
- `src/components/ui/DatePicker.tsx`, `src/components/ui/PhoneInput.tsx`, `src/components/ui/Toast.tsx`

---

### Task 1: Workspace Bootstrap, Prisma Schema & Migration Sync, Seed & CI (`C-12`)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261123000000_sync_schema_phase1/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `jest.config.js`
- Modify: `src/lib/prisma.ts`
- Test: `src/lib/__tests__/schema-constants.test.ts`

**Interfaces:**
- Produces:
  - Prisma Client models & fields: `Document.storageKey: string | null`, `MedicalBill.storageKey: string | null`, `PasswordResetToken` (`id`, `userId`, `otpHash`, `attempts`, `expiresAt`, `usedAt`, `createdAt`).
  - Singleton `prisma` from `@/lib/prisma` without default stdout query-parameter logging.

- [ ] **Step 1: Install dependencies and verify Next.js 16 docs**

Run: `npm ci`
Expected: `added ... packages` with exit code `0`. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (or matching doc path) to confirm Next.js 16 conventions.

- [ ] **Step 2: Fix `jest.config.js` and write failing schema verification test**

Update `jest.config.js` so `ts-jest` compiles TypeScript with CommonJS for Jest while transforming ESM packages like `jose`:

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          jsx: 'react-jsx',
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
};
```

Create `src/lib/__tests__/schema-constants.test.ts`:

```typescript
import fs from 'fs';
import path from 'path';

describe('Phase 1 Schema & Migration Sync', () => {
  const schemaText = fs.readFileSync(
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf-8'
  );

  it('defines PasswordResetToken model and storageKey fields on Document and MedicalBill', () => {
    expect(schemaText).toContain('model PasswordResetToken');
    expect(schemaText).toMatch(/model Document[\s\S]*?storageKey\s+String\?\s+@map\("storage_key"\)/);
    expect(schemaText).toMatch(/model MedicalBill[\s\S]*?storageKey\s+String\?\s+@map\("storage_key"\)/);
  });

  it('ships the Phase 1 reconciliation migration creating all missing tables', () => {
    const migPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261123000000_sync_schema_phase1',
      'migration.sql'
    );
    expect(fs.existsSync(migPath)).toBe(true);
    const sql = fs.readFileSync(migPath, 'utf-8');
    for (const table of [
      'clinical_steps',
      'fit_to_fly_clearances',
      'medical_bills',
      'bill_items',
      'hotels',
      'hotel_bookings',
      'password_reset_tokens',
    ]) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/schema-constants.test.ts`
Expected: FAIL (`expect(schemaText).toContain('model PasswordResetToken')`).

- [ ] **Step 4: Update `prisma/schema.prisma`, create reconciliation migration, update CI, `.env.example`, `.gitignore`, `src/lib/prisma.ts`, and `prisma/seed.ts`**

In `prisma/schema.prisma`:
1. On `model User` (around line 106), add relation:
   ```prisma
   passwordResetTokens PasswordResetToken[]
   ```
2. On `model Document` (after `fileUrl` around line 282), add:
   ```prisma
   storageKey         String?          @map("storage_key")
   ```
3. On `model RefreshToken` (line 352), remove the redundant `@@index([token])` line (`token` already has `@unique`).
4. Add `PasswordResetToken` right after `RefreshToken`:
   ```prisma
   model PasswordResetToken {
     id        String    @id @default(cuid())
     userId    String    @map("user_id")
     otpHash   String    @map("otp_hash")
     attempts  Int       @default(0)
     expiresAt DateTime  @map("expires_at")
     usedAt    DateTime? @map("used_at")
     createdAt DateTime  @default(now()) @map("created_at")

     user User @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId, expiresAt])
     @@map("password_reset_tokens")
   }
   ```
5. On `model MedicalBill` (after `fileUrl` around line 508), add:
   ```prisma
   storageKey  String?    @map("storage_key")
   ```

Create `prisma/migrations/20261123000000_sync_schema_phase1/migration.sql`:

```sql
-- Drop legacy tables removed from schema.prisma
DROP TABLE IF EXISTS `accommodation_bookings`;
DROP TABLE IF EXISTS `hostels`;

-- Normalize any legacy SUPER_ADMIN users before narrowing enum
UPDATE `users` SET `role` = 'ADMIN' WHERE `role` = 'SUPER_ADMIN';
ALTER TABLE `users` MODIFY `role` ENUM('PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR') NOT NULL;

-- Expand CaseStatus to all 12 clinical lifecycle stages
ALTER TABLE `cases` MODIFY `status` ENUM(
  'INQUIRY_RECEIVED',
  'UNDER_REVIEW',
  'PRE_OP_CLEARANCE',
  'PLAN_CONFIRMED',
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED'
) NOT NULL DEFAULT 'INQUIRY_RECEIVED';

-- Expand DocumentCategory and add verification + storageKey columns
ALTER TABLE `documents`
  MODIFY `category` ENUM(
    'PASSPORT',
    'VISA',
    'VISA_INVITATION_LETTER',
    'PROFORMA_INVOICE',
    'MEDICAL_OPINION',
    'MEDICAL_REPORT',
    'PRESCRIPTION',
    'FIT_TO_FLY_CERTIFICATE',
    'FRRO_REGISTRATION',
    'INSURANCE'
  ) NOT NULL,
  ADD COLUMN `storage_key` VARCHAR(191) NULL,
  ADD COLUMN `verification_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `verified_by` VARCHAR(191) NULL,
  ADD COLUMN `verification_notes` TEXT NULL,
  ADD COLUMN `verified_at` DATETIME(3) NULL;

CREATE INDEX `documents_verification_status_idx` ON `documents`(`verification_status`);

-- Drop redundant duplicate index on refresh_tokens
DROP INDEX `refresh_tokens_token_idx` ON `refresh_tokens`;

-- Create PasswordResetToken table
CREATE TABLE `password_reset_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `otp_hash` VARCHAR(191) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `password_reset_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create ClinicalStep table
CREATE TABLE `clinical_steps` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `stage_name` VARCHAR(191) NOT NULL DEFAULT 'Stage 1: Pre-Procedure Triage & Medical Clearance',
  `stage_order` INTEGER NOT NULL DEFAULT 1,
  `step_order` INTEGER NOT NULL DEFAULT 1,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `decision_branch` VARCHAR(191) NULL,
  `doctor_notes` TEXT NULL,
  `action_type` VARCHAR(191) NULL,
  `required_role` VARCHAR(191) NULL,
  `action_url` VARCHAR(191) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `clinical_steps_case_id_idx`(`case_id`),
  INDEX `clinical_steps_category_idx`(`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create FitToFlyClearance table
CREATE TABLE `fit_to_fly_clearances` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `is_cleared` BOOLEAN NOT NULL DEFAULT false,
  `cleared_by` VARCHAR(191) NULL,
  `clearance_date` DATETIME(3) NULL,
  `restrictions` TEXT NULL,
  `re_eval_date` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `fit_to_fly_clearances_case_id_key`(`case_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create MedicalBill table
CREATE TABLE `medical_bills` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `patient_id` VARCHAR(191) NOT NULL,
  `hospital_id` VARCHAR(191) NULL,
  `bill_number` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'HOSPITAL_SURGERY',
  `total_amount` DECIMAL(12, 2) NOT NULL,
  `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `due_date` DATETIME(3) NULL,
  `file_url` VARCHAR(191) NULL,
  `storage_key` VARCHAR(191) NULL,
  `file_name` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `medical_bills_bill_number_key`(`bill_number`),
  INDEX `medical_bills_case_id_idx`(`case_id`),
  INDEX `medical_bills_patient_id_idx`(`patient_id`),
  INDEX `medical_bills_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create BillItem table
CREATE TABLE `bill_items` (
  `id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12, 2) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `category` VARCHAR(191) NULL,
  INDEX `bill_items_bill_id_idx`(`bill_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Hotel table
CREATE TABLE `hotels` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `address` TEXT NOT NULL,
  `near_hospital_id` VARCHAR(191) NULL,
  `distance_km` DOUBLE NOT NULL DEFAULT 2.5,
  `star_rating` DOUBLE NOT NULL DEFAULT 4.5,
  `nightly_rate_usd` DECIMAL(10, 2) NOT NULL,
  `commission_percent` DECIMAL(5, 2) NOT NULL DEFAULT 15.0,
  `amenities` JSON NULL,
  `images` JSON NULL,
  `description` TEXT NULL,
  `contact_phone` VARCHAR(191) NULL,
  `contact_email` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `hotels_near_hospital_id_idx`(`near_hospital_id`),
  INDEX `hotels_city_idx`(`city`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create HotelBooking table
CREATE TABLE `hotel_bookings` (
  `id` VARCHAR(191) NOT NULL,
  `booking_no` VARCHAR(191) NOT NULL,
  `patient_id` VARCHAR(191) NOT NULL,
  `hotel_id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NULL,
  `check_in_date` DATETIME(3) NOT NULL,
  `check_out_date` DATETIME(3) NOT NULL,
  `room_type` VARCHAR(191) NOT NULL DEFAULT 'Deluxe Recovery Suite',
  `num_guests` INTEGER NOT NULL DEFAULT 2,
  `num_nights` INTEGER NOT NULL DEFAULT 3,
  `total_amount_usd` DECIMAL(10, 2) NOT NULL,
  `commission_amount_usd` DECIMAL(10, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'CONFIRMED',
  `special_requests` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `hotel_bookings_booking_no_key`(`booking_no`),
  INDEX `hotel_bookings_patient_id_idx`(`patient_id`),
  INDEX `hotel_bookings_hotel_id_idx`(`hotel_id`),
  INDEX `hotel_bookings_case_id_idx`(`case_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add Foreign Keys
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clinical_steps` ADD CONSTRAINT `clinical_steps_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `fit_to_fly_clearances` ADD CONSTRAINT `fit_to_fly_clearances_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_hospital_id_fkey` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bill_items` ADD CONSTRAINT `bill_items_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `medical_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_near_hospital_id_fkey` FOREIGN KEY (`near_hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

Update `src/lib/prisma.ts` so query parameters containing ePHI are not dumped to stdout by default:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.PRISMA_LOG_QUERIES === 'true'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

Update `.env.example`:

```dotenv
DATABASE_URL="mysql://rehan:root@localhost:3306/rehan"
JWT_ACCESS_SECRET="dev-access-token-secret-must-be-very-long-and-secure"
JWT_REFRESH_SECRET="dev-refresh-token-secret-must-be-very-long-and-secure"
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
NODE_ENV="development"
```

Update `.gitignore` lines 33–35 to ignore local env variants:

```gitignore
# env files
.env
.env.local
.env.*.local
```

Update `.github/workflows/ci.yml` lines 17–37 to use `mysql:8.0`:

```yaml
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: medroute_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h 127.0.0.1 -uroot -proot"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=10

    env:
      DATABASE_URL: mysql://root:root@127.0.0.1:3306/medroute_test
      JWT_ACCESS_SECRET: test-access-secret-minimum-32-chars-long
      JWT_REFRESH_SECRET: test-refresh-secret-minimum-32-chars-long
      ENCRYPTION_KEY: 0000000000000000000000000000000000000000000000000000000000000000
```

Update `prisma/seed.ts` so:
- Seeded `passportNo` uses `encrypt('A12345678')` and `PatientMedicalProfile` uses `encryptMedicalProfile(...)`.
- A `DOCTOR` user (`doctor@afzalhealthcare.in` / `Doctor@123`) is upserted and linked via `userId` to `seed-doctor-001`.
- Duplicate `seed-case-001` upsert at lines 131–144 is removed (keeping the single `WARD_RECOVERY` upsert).
- `prisma.clinicalStep.deleteMany({ where: { caseId: sampleCase.id } })`, `prisma.document.deleteMany({ where: { patientId: patient.id } })`, and `prisma.billItem.deleteMany({ where: { billId: sampleBill.id } })` run prior to inserting seed child rows so `npm run db:seed` is idempotent.
- Valid minimal PDF files (`%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`) are written to `storage/uploads/` (`VIL_Sample.pdf`, `Invoice_Sample.pdf`, `Passport_Sample.pdf`, `Angio_Report.pdf`), `storageKey` is set on every seeded `Document` and `MedicalBill`, and `fileUrl` is set to `/api/v1/documents/${createdDoc.id}/download` and `/api/v1/documents/bill/${sampleBill.id}/download`.

- [ ] **Step 5: Generate Prisma Client and run test to verify it passes**

Run: `npx prisma generate ; npx jest src/lib/__tests__/schema-constants.test.ts`
Expected: PASS (`2 passed`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261123000000_sync_schema_phase1/migration.sql prisma/seed.ts .github/workflows/ci.yml .env.example .gitignore jest.config.js src/lib/prisma.ts src/lib/__tests__/schema-constants.test.ts
git commit -m "fix(db,ci): sync Prisma MySQL migrations, storageKey/OTP models, idempotent encrypted seed, and CI"
```

---

### Task 2: Hardened AES-256-GCM Crypto & Shared ePHI Projection Service (`C-08`)

**Files:**
- Modify: `src/lib/auth/crypto.ts`
- Modify: `src/lib/api/phi-encryption.ts`
- Create: `src/lib/services/phi.service.ts`
- Modify: `src/app/api/v1/manager/patients/route.ts`
- Modify: `src/app/api/v1/doctor/patients/route.ts`
- Modify: `src/app/api/v1/admin/patients/route.ts`
- Modify: `src/app/api/v1/auth/me/route.ts`
- Test: `src/lib/auth/__tests__/crypto.test.ts`
- Test: `src/lib/services/__tests__/phi.service.test.ts`

**Interfaces:**
- Produces:
  - `DecryptionTamperError` in `src/lib/auth/crypto.ts`
  - `maskPassportNumber(rawOrEncrypted: string | null | undefined): string` in `src/lib/services/phi.service.ts`
  - `formatPatientForViewer<T extends Record<string, unknown>>(patient: T, options?: { maskPassport?: boolean }): T` in `src/lib/services/phi.service.ts`

- [ ] **Step 1: Write failing tests for GCM tamper handling, empty-array encryption, and `formatPatientForViewer`**

Append to `src/lib/auth/__tests__/crypto.test.ts`:

```typescript
import { DecryptionTamperError } from '../crypto';

describe('AES-256-GCM Tamper & Empty Array Safety', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
  });

  it('throws DecryptionTamperError instead of returning raw ciphertext when authTag is tampered', () => {
    const ct = encrypt('Penicillin Allergy');
    const [iv, tag, body] = ct.split(':');
    const flippedTag = (tag[0] === 'a' ? 'b' : 'a') + tag.slice(1);
    expect(() => decrypt(`${iv}:${flippedTag}:${body}`)).toThrow(DecryptionTamperError);
  });
});
```

Create `src/lib/services/__tests__/phi.service.test.ts`:

```typescript
import { encrypt } from '@/lib/auth/crypto';
import { encryptMedicalProfile } from '@/lib/api/phi-encryption';
import { formatPatientForViewer, maskPassportNumber } from '../phi.service';

describe('phi.service — formatPatientForViewer', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
  });

  it('decrypts encrypted medicalProfile arrays so allergies and medications are never lost', () => {
    const encryptedProfile = encryptMedicalProfile({
      allergies: ['Penicillin', 'Sulfa drugs'],
      medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'Daily' }],
      surgeries: [],
      chronicConditions: ['Hypertension'],
    });

    const formatted = formatPatientForViewer({
      id: 'pat-1',
      passportNo: encrypt('A12345678'),
      medicalProfile: encryptedProfile,
    });

    expect(formatted.passportNo).toBe('A12345678');
    expect(formatted.medicalProfile).toEqual({
      allergies: ['Penicillin', 'Sulfa drugs'],
      medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'Daily' }],
      surgeries: [],
      chronicConditions: ['Hypertension'],
    });
  });

  it('masks passport numbers for admin list views', () => {
    expect(maskPassportNumber(encrypt('A12345678'))).toBe('*****5678');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/auth/__tests__/crypto.test.ts src/lib/services/__tests__/phi.service.test.ts`
Expected: FAIL (`Cannot find module '../phi.service'` and `DecryptionTamperError` undefined).

- [ ] **Step 3: Implement `DecryptionTamperError`, `phi-encryption.ts` empty-array fix, `phi.service.ts`, and wire into all 4 patient read routes**

Update `src/lib/auth/crypto.ts`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEX_RE = /^[0-9a-fA-F]+$/;

export class DecryptionTamperError extends Error {
  constructor(message = 'Encrypted field failed GCM authentication check') {
    super(message);
    this.name = 'DecryptionTamperError';
  }
}

function getEncryptionKey(): Buffer {
  let keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex && process.env.NODE_ENV !== 'production') {
    keyHex = '0000000000000000000000000000000000000000000000000000000000000000';
  }
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  return key;
}

export function encrypt(text: unknown): string {
  if (text === null || text === undefined || text === '') return '';
  const textToEncrypt = typeof text === 'string' ? text : JSON.stringify(text);
  if (!textToEncrypt || textToEncrypt === '""') return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext: unknown): string {
  if (!ciphertext) return '';
  if (typeof ciphertext !== 'string') {
    return String(ciphertext);
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (
    ivHex.length !== IV_LENGTH * 2 ||
    authTagHex.length !== AUTH_TAG_LENGTH * 2 ||
    !HEX_RE.test(ivHex) ||
    !HEX_RE.test(authTagHex) ||
    (encryptedHex.length > 0 && !HEX_RE.test(encryptedHex))
  ) {
    return ciphertext;
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decryptedUpdate = decipher.update(Buffer.from(encryptedHex, 'hex'));
    const decryptedFinal = decipher.final();
    return Buffer.concat([decryptedUpdate, decryptedFinal]).toString('utf8');
  } catch {
    throw new DecryptionTamperError();
  }
}
```

Update `src/lib/api/phi-encryption.ts` so `[]` encrypts cleanly and `decryptField` catches `DecryptionTamperError` safely (logging an error and returning `null` rather than leaking raw ciphertext):

```typescript
import { encrypt, decrypt, DecryptionTamperError } from '@/lib/auth/crypto';

export function encryptField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const textToEncrypt = typeof value === 'string' ? value : JSON.stringify(value);
  if (!textToEncrypt || textToEncrypt === '""') return '';
  return encrypt(textToEncrypt);
}

export function decryptField<T = unknown>(ciphertext: unknown): T | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;
  if (typeof ciphertext !== 'string') {
    return ciphertext as T;
  }

  try {
    const decrypted = decrypt(ciphertext);
    if (!decrypted) return null;
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  } catch (err) {
    if (err instanceof DecryptionTamperError) {
      console.error('[ePHI Tamper Alert] Refusing to return tampered ciphertext');
      return null;
    }
    throw err;
  }
}

export function encryptMedicalProfile(profileData: {
  allergies?: unknown;
  medications?: unknown;
  surgeries?: unknown;
  chronicConditions?: unknown;
  specialisationsRequired?: unknown;
}) {
  return {
    ...profileData,
    allergies: profileData.allergies !== undefined ? encryptField(profileData.allergies) : undefined,
    medications: profileData.medications !== undefined ? encryptField(profileData.medications) : undefined,
    surgeries: profileData.surgeries !== undefined ? encryptField(profileData.surgeries) : undefined,
    chronicConditions: profileData.chronicConditions !== undefined ? encryptField(profileData.chronicConditions) : undefined,
  };
}

export function decryptMedicalProfile<T extends Record<string, unknown>>(profile: T | null | undefined): T | null {
  if (!profile) return null;
  return {
    ...profile,
    allergies: Array.isArray(decryptField(profile.allergies)) ? decryptField(profile.allergies) : [],
    medications: Array.isArray(decryptField(profile.medications)) ? decryptField(profile.medications) : [],
    surgeries: Array.isArray(decryptField(profile.surgeries)) ? decryptField(profile.surgeries) : [],
    chronicConditions: Array.isArray(decryptField(profile.chronicConditions)) ? decryptField(profile.chronicConditions) : [],
  };
}
```

Create `src/lib/services/phi.service.ts`:

```typescript
import { decrypt, DecryptionTamperError } from '@/lib/auth/crypto';
import { decryptMedicalProfile } from '@/lib/api/phi-encryption';

export function safeDecryptString(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return decrypt(val);
  } catch (err) {
    if (err instanceof DecryptionTamperError) {
      console.error('[ePHI Tamper Alert] Failed to decrypt string field');
      return '[DECRYPTION_ERROR]';
    }
    return '';
  }
}

export function maskPassportNumber(rawOrEncrypted: string | null | undefined): string {
  const plain = safeDecryptString(rawOrEncrypted);
  if (!plain || plain === '[DECRYPTION_ERROR]') return '—';
  if (plain.length <= 4) return '****';
  return `${'*'.repeat(plain.length - 4)}${plain.slice(-4)}`;
}

export function formatPatientForViewer<T extends Record<string, any>>(
  patient: T,
  options: { maskPassport?: boolean } = {}
): T {
  const result: Record<string, any> = { ...patient };
  if ('passportNo' in result && typeof result.passportNo === 'string') {
    result.passportNo = options.maskPassport
      ? maskPassportNumber(result.passportNo)
      : safeDecryptString(result.passportNo);
  }
  if ('medicalProfile' in result && result.medicalProfile) {
    result.medicalProfile = decryptMedicalProfile(result.medicalProfile);
  }
  return result as T;
}
```

Wire `formatPatientForViewer` into:
- `src/app/api/v1/manager/patients/route.ts` (also switching to `import prisma from '@/lib/prisma'` and logging `AUDIT_ACTIONS.VIEW_PATIENT`)
- `src/app/api/v1/doctor/patients/route.ts` (enforcing `authUser.role === 'DOCTOR'` & `doctorProfile.isActive`, excluding `CANCELLED` appointments, decrypting via `formatPatientForViewer`, and logging `AUDIT_ACTIONS.VIEW_PATIENT`)
- `src/app/api/v1/admin/patients/route.ts` (`formatPatientForViewer(p, { maskPassport: true })`, plus selecting `assignedManager: { select: { id: true, fullName: true, email: true } }`)
- `src/app/api/v1/auth/me/route.ts` (decrypting `user.patient.medicalProfile` via `decryptMedicalProfile`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/auth/__tests__/crypto.test.ts src/lib/services/__tests__/phi.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/crypto.ts src/lib/api/phi-encryption.ts src/lib/services/phi.service.ts src/app/api/v1/manager/patients/route.ts src/app/api/v1/doctor/patients/route.ts src/app/api/v1/admin/patients/route.ts src/app/api/v1/auth/me/route.ts src/lib/auth/__tests__/crypto.test.ts src/lib/services/__tests__/phi.service.test.ts
git commit -m "fix(security): harden AES-GCM tamper handling and decrypt clinical medicalProfile across all portals"
```

---

### Task 3: Edge Proxy, RBAC, Production 2FA & Cookie-First Refresh/Logout (`C-02`, `C-03`)

**Files:**
- Modify: `src/lib/auth/rbac.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/api/v1/auth/2fa/validate/route.ts`
- Modify: `src/app/api/v1/auth/logout/route.ts`
- Modify: `src/app/api/v1/auth/refresh/route.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/SessionTimeoutProvider.tsx`
- Modify: `src/app/api/v1/doctor/dashboard/route.ts`
- Modify: `src/app/api/v1/doctor/appointments/route.ts`
- Test: `src/lib/auth/__tests__/rbac-and-session.test.ts`

**Interfaces:**
- Produces:
  - `ROUTE_ROLES['/doctor'] = ['DOCTOR']`
  - `getDefaultRoute('DOCTOR') === '/doctor/dashboard'`
  - `hasPermission('PATIENT', 'send:messages') === true`
  - `extractRefreshTokenFromRequest(request: NextRequest): Promise<string | null>` in `src/lib/api/auth-helper.ts`

- [ ] **Step 1: Write failing tests for RBAC doctor/patient rules and public route whitelisting**

Create `src/lib/auth/__tests__/rbac-and-session.test.ts`:

```typescript
import { canAccessRoute, getDefaultRoute, hasPermission } from '../rbac';
import { PUBLIC_ROUTES } from '@/proxy';

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

  it('whitelists 2FA setup/validate and logout in proxy PUBLIC_ROUTES', () => {
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/2fa/setup');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/2fa/validate');
    expect(PUBLIC_ROUTES).toContain('/api/v1/auth/logout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/auth/__tests__/rbac-and-session.test.ts`
Expected: FAIL (`canAccessRoute('PATIENT', '/doctor/patients')` returns `true`; `PUBLIC_ROUTES` not exported / missing `/api/v1/auth/2fa/setup`).

- [ ] **Step 3: Implement RBAC, `src/proxy.ts`, 2FA token-prefix fix, cookie-first logout/refresh, and `SessionTimeoutProvider` refresh**

1. In `src/lib/auth/rbac.ts`:
   - Add `'DOCTOR'` to `'view:own-profile'`, `'edit:own-profile'`, `'view:appointments'`, `'view:documents'`.
   - Update `'send:messages': ['PATIENT', 'MANAGER', 'ADMIN']`.
   - Update `ROUTE_ROLES` to include `'/doctor': ['DOCTOR']`.
   - Add `case 'DOCTOR': return '/doctor/dashboard';` in `getDefaultRoute`.
2. In `src/proxy.ts`:
   - Export `PUBLIC_ROUTES`:
     ```typescript
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
     ];
     ```
   - Update `SKIP_ROUTES = ['/_next', '/favicon.ico', '/icon.png', '/assets', '/api/docs'];`.
3. In `src/lib/api/auth-helper.ts`, add helper:
   ```typescript
   export async function extractRefreshTokenFromRequest(request: NextRequest): Promise<string | null> {
     const cookieToken = request.cookies.get('refresh_token')?.value;
     if (cookieToken) return cookieToken;
     try {
       const body = await request.json();
       return typeof body?.refreshToken === 'string' ? body.refreshToken : null;
     } catch {
       return null;
     }
   }
   ```
4. In `src/app/api/v1/auth/logout/route.ts`:
   - Use `extractRefreshTokenFromRequest(request)`.
   - If present, verify refresh token in `try/catch` and run `await prisma.refreshToken.updateMany({ where: { id: payload.tokenId, revokedAt: null }, data: { revokedAt: new Date() } })`.
   - Unconditionally run `await clearAuthCookies()` and return `apiSuccess({ message: 'Logged out successfully' })`.
5. In `src/app/api/v1/auth/refresh/route.ts`:
   - Use `const incomingToken = await extractRefreshTokenFromRequest(request);` so cookie-authenticated browser calls with no JSON body succeed seamlessly.
6. In `src/app/api/v1/auth/2fa/validate/route.ts`:
   - Query `token: { in: [\`2fa_${tempSessionId}\`, \`2fa_setup_${tempSessionId}\`] }, revokedAt: null, expiresAt: { gt: new Date() }`.
   - Wrap temp token revocation, `totpEnabled: true` update, and new `RefreshToken` creation in `prisma.$transaction`.
7. In `src/app/(auth)/login/page.tsx`:
   - Capture `totpUri` from `/api/v1/auth/2fa/setup` and display both the manual secret key and a copyable `otpauth://` link; add `case 'DOCTOR': router.push('/doctor/dashboard'); break;` in `handleLogin`, remove duplicate `case 'ADMIN':`, and add a link to `/register` (`"New international patient? Submit medical inquiry & create account"`).
8. In `src/components/SessionTimeoutProvider.tsx`:
   - Add `refreshSession()` calling `fetch('/api/v1/auth/refresh', { method: 'POST' })`.
   - Call `refreshSession()` when `"Stay Logged In"` is clicked (redirecting to `/login?reason=expired` if `!res.ok`) and proactively refresh every 11 minutes when user activity has occurred since the last refresh.
9. In `src/app/api/v1/doctor/dashboard/route.ts` and `src/app/api/v1/doctor/appointments/route.ts`:
   - Enforce `if (authUser!.role !== 'DOCTOR') return apiError(ERROR_CODES.FORBIDDEN, 'Doctor access required', 403);` and check `doctorProfile.isActive`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/auth/__tests__/rbac-and-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/rbac.ts src/proxy.ts src/lib/api/auth-helper.ts src/app/api/v1/auth/2fa/validate/route.ts src/app/api/v1/auth/logout/route.ts src/app/api/v1/auth/refresh/route.ts src/app/(auth)/login/page.tsx src/components/SessionTimeoutProvider.tsx src/app/api/v1/doctor/dashboard/route.ts src/app/api/v1/doctor/appointments/route.ts src/lib/auth/__tests__/rbac-and-session.test.ts
git commit -m "fix(auth): unblock production 2FA, cookie-first logout/refresh, and DOCTOR Edge RBAC"
```

---

### Task 4: DB-Backed OTP Password Recovery (`C-04`)

**Files:**
- Create: `src/lib/services/password-reset.service.ts`
- Create: `src/app/api/v1/auth/forgot-password/route.ts`
- Create: `src/app/api/v1/auth/reset-password/route.ts`
- Test: `src/lib/services/__tests__/password-reset.service.test.ts`

**Interfaces:**
- Produces:
  - `hashResetOtp(userId: string, otp: string): string`
  - `verifyResetOtpHash(userId: string, otp: string, expectedHash: string): boolean`
  - `requestPasswordResetOtp(email: string): Promise<{ rateLimited: boolean; devOtp?: string }>`
  - `completePasswordReset(input: { email: string; otp: string; newPassword: string; ipAddress?: string }): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }>`

- [ ] **Step 1: Write failing unit tests for OTP hashing, timing-safe comparison, and lockout rules**

Create `src/lib/services/__tests__/password-reset.service.test.ts`:

```typescript
import { hashResetOtp, verifyResetOtpHash } from '../password-reset.service';

describe('password-reset.service', () => {
  it('salts SHA-256 OTP hash with userId and verifies in constant time', () => {
    const hash = hashResetOtp('user-123', '482910');
    expect(verifyResetOtpHash('user-123', '482910', hash)).toBe(true);
    expect(verifyResetOtpHash('user-123', '482911', hash)).toBe(false);
    expect(verifyResetOtpHash('other-user', '482910', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/password-reset.service.test.ts`
Expected: FAIL (`Cannot find module '../password-reset.service'`).

- [ ] **Step 3: Implement `password-reset.service.ts` and `/forgot-password` + `/reset-password` routes**

Create `src/lib/services/password-reset.service.ts`:

```typescript
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { ERROR_CODES } from '@/lib/api/errors';

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

export function hashResetOtp(userId: string, otp: string): string {
  return crypto.createHash('sha256').update(`${userId}:${otp}`).digest('hex');
}

export function verifyResetOtpHash(userId: string, otp: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashResetOtp(userId, otp), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export async function requestPasswordResetOtp(email: string): Promise<{ rateLimited: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return { rateLimited: false };
  }

  const recentCount = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) },
    },
  });

  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { rateLimited: true };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = hashResetOtp(user.id, otp);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ]);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEV OTP] Password reset code for ${user.email}: ${otp}`);
  }

  return { rateLimited: false };
}

export async function completePasswordReset(input: {
  email: string;
  otp: string;
  newPassword: string;
  ipAddress?: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return { ok: false, code: ERROR_CODES.OTP_INVALID, message: 'Invalid or expired verification code', status: 401 };
  }

  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!tokenRecord) {
    return { ok: false, code: ERROR_CODES.OTP_EXPIRED, message: 'Verification code expired or not found', status: 401 };
  }

  if (tokenRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, code: ERROR_CODES.OTP_EXPIRED, message: 'Too many invalid attempts. Request a new code.', status: 401 };
  }

  if (!verifyResetOtpHash(user.id, input.otp, tokenRecord.otpHash)) {
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, code: ERROR_CODES.OTP_INVALID, message: 'Invalid verification code', status: 401 };
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: tokenRecord.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await createAuditLog({
    actorId: user.id,
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    entityType: 'User',
    entityId: user.id,
    ipAddress: input.ipAddress,
  });

  return { ok: true };
}
```

Create `src/app/api/v1/auth/forgot-password/route.ts` and `src/app/api/v1/auth/reset-password/route.ts` validating inputs with `otpRequestSchema` and `resetPasswordSchema` from `@/lib/validation/schemas` and returning standard `apiSuccess` / `apiError` responses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/__tests__/password-reset.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/password-reset.service.ts src/app/api/v1/auth/forgot-password/route.ts src/app/api/v1/auth/reset-password/route.ts src/lib/services/__tests__/password-reset.service.test.ts
git commit -m "feat(auth): implement DB-backed OTP forgot-password and reset-password endpoints"
```

---

### Task 5: 12-Stage `CaseStatus` Alignment & Escalation Hygiene (`C-06`)

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/validation/schemas.ts`
- Modify: `src/components/ui/Badge.tsx`
- Modify: `src/app/api/v1/manager/cases/route.ts`
- Modify: `src/app/api/v1/admin/cases/route.ts`
- Modify: `src/app/(patient)/patient/dashboard/page.tsx`
- Modify: `src/app/(manager)/manager/cases/page.tsx`
- Modify: `src/app/(admin)/admin/cases/page.tsx`
- Modify: `src/app/(admin)/admin/dashboard/page.tsx`
- Test: `src/lib/__tests__/case-status.test.ts`

**Interfaces:**
- Produces in `src/lib/constants.ts`:
  - `CASE_STATUSES` (all 12 keys)
  - `CASE_STATUS_ORDER` (12 ordered statuses)
  - `CASE_STATUS_LABELS` (12 human-readable labels)
  - `CASE_PHASE_GROUPS` (6 macro phases: `INQUIRY`, `PRE_OP`, `TREATMENT`, `RECOVERY`, `DISCHARGE`, `CLOSED`, each with `{ key, label, desc, statuses: readonly string[] }`)
  - `getCasePhaseIndex(status: string): number`

- [ ] **Step 1: Write failing tests for all 12 `CaseStatus` stages, Zod validation, and macro phase mapping**

Create `src/lib/__tests__/case-status.test.ts`:

```typescript
import { CASE_STATUS_ORDER, CASE_STATUS_LABELS, CASE_PHASE_GROUPS, getCasePhaseIndex } from '../constants';
import { updateCaseStatusSchema } from '../validation/schemas';

const ALL_12 = [
  'INQUIRY_RECEIVED',
  'UNDER_REVIEW',
  'PRE_OP_CLEARANCE',
  'PLAN_CONFIRMED',
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED',
];

describe('12-Stage CaseStatus Alignment', () => {
  it('orders and labels all 12 Prisma CaseStatus values', () => {
    expect([...CASE_STATUS_ORDER]).toEqual(ALL_12);
    for (const s of ALL_12) {
      expect(CASE_STATUS_LABELS[s]).toBeTruthy();
      expect(updateCaseStatusSchema.safeParse({ status: s }).success).toBe(true);
    }
  });

  it('maps WARD_RECOVERY to Phase 4 (index 3: Recovery) instead of defaulting to Phase 1', () => {
    expect(CASE_PHASE_GROUPS).toHaveLength(6);
    expect(getCasePhaseIndex('WARD_RECOVERY')).toBe(3);
    expect(getCasePhaseIndex('FIT_TO_FLY_CLEARED')).toBe(4);
    expect(getCasePhaseIndex('CLOSED')).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/case-status.test.ts`
Expected: FAIL (`CASE_STATUS_ORDER` has 6 items; `getCasePhaseIndex` undefined).

- [ ] **Step 3: Update `constants.ts`, `schemas.ts`, `Badge.tsx`, Manager/Admin Case APIs, and Portal UIs**

1. In `src/lib/constants.ts`:
   ```typescript
   export const CASE_STATUSES = {
     INQUIRY_RECEIVED: 'INQUIRY_RECEIVED',
     UNDER_REVIEW: 'UNDER_REVIEW',
     PRE_OP_CLEARANCE: 'PRE_OP_CLEARANCE',
     PLAN_CONFIRMED: 'PLAN_CONFIRMED',
     IN_TREATMENT: 'IN_TREATMENT',
     ICU_RECOVERY: 'ICU_RECOVERY',
     WARD_RECOVERY: 'WARD_RECOVERY',
     POST_TREATMENT: 'POST_TREATMENT',
     OUTPATIENT_RECUPERATION: 'OUTPATIENT_RECUPERATION',
     FIT_TO_FLY_CLEARED: 'FIT_TO_FLY_CLEARED',
     REMOTE_REHAB: 'REMOTE_REHAB',
     CLOSED: 'CLOSED',
   } as const;

   export const CASE_STATUS_ORDER = [
     CASE_STATUSES.INQUIRY_RECEIVED,
     CASE_STATUSES.UNDER_REVIEW,
     CASE_STATUSES.PRE_OP_CLEARANCE,
     CASE_STATUSES.PLAN_CONFIRMED,
     CASE_STATUSES.IN_TREATMENT,
     CASE_STATUSES.ICU_RECOVERY,
     CASE_STATUSES.WARD_RECOVERY,
     CASE_STATUSES.POST_TREATMENT,
     CASE_STATUSES.OUTPATIENT_RECUPERATION,
     CASE_STATUSES.FIT_TO_FLY_CLEARED,
     CASE_STATUSES.REMOTE_REHAB,
     CASE_STATUSES.CLOSED,
   ] as const;

   export const CASE_STATUS_LABELS: Record<string, string> = {
     INQUIRY_RECEIVED: 'Inquiry Received',
     UNDER_REVIEW: 'Under Review',
     PRE_OP_CLEARANCE: 'Pre-Op Clearance',
     PLAN_CONFIRMED: 'Plan Confirmed',
     IN_TREATMENT: 'In Treatment',
     ICU_RECOVERY: 'ICU / CCU Recovery',
     WARD_RECOVERY: 'Ward Recovery',
     POST_TREATMENT: 'Post-Treatment',
     OUTPATIENT_RECUPERATION: 'Outpatient Recuperation',
     FIT_TO_FLY_CLEARED: 'Fit-to-Fly Cleared',
     REMOTE_REHAB: 'Remote Tele-Rehab',
     CLOSED: 'Closed',
   };

   export const CASE_PHASE_GROUPS = [
     { key: 'INQUIRY', label: 'Inquiry & Triage', desc: 'Medical inquiry & coordinator assessment', statuses: ['INQUIRY_RECEIVED', 'UNDER_REVIEW'] },
     { key: 'PRE_OP', label: 'Pre-Op & Plan', desc: 'MDT clearance & confirmed treatment plan', statuses: ['PRE_OP_CLEARANCE', 'PLAN_CONFIRMED'] },
     { key: 'TREATMENT', label: 'In Treatment', desc: 'Active surgical or clinical intervention', statuses: ['IN_TREATMENT'] },
     { key: 'RECOVERY', label: 'Hospital Recovery', desc: 'ICU, inpatient ward & post-op monitoring', statuses: ['ICU_RECOVERY', 'WARD_RECOVERY', 'POST_TREATMENT'] },
     { key: 'DISCHARGE', label: 'Discharge & Rehab', desc: 'Outpatient care, Fit-to-Fly & tele-rehab', statuses: ['OUTPATIENT_RECUPERATION', 'FIT_TO_FLY_CLEARED', 'REMOTE_REHAB'] },
     { key: 'CLOSED', label: 'Closed', desc: 'Medical journey concluded', statuses: ['CLOSED'] },
   ] as const;

   export function getCasePhaseIndex(status: string): number {
     const idx = CASE_PHASE_GROUPS.findIndex((g) => (g.statuses as readonly string[]).includes(status));
     return idx >= 0 ? idx : 0;
   }
   ```
2. Update `updateCaseStatusSchema` in `src/lib/validation/schemas.ts`, `CaseStatusBadge` in `src/components/ui/Badge.tsx`, and `VALID_STATUSES` in `src/app/api/v1/admin/cases/route.ts` to use `CASE_STATUS_ORDER`.
3. Update `src/app/api/v1/manager/cases/route.ts`:
   - Replace `new PrismaClient()` with `import prisma from '@/lib/prisma'`.
   - Normalize `escalationNote` (`escalationNote !== undefined ? (escalationNote.trim() || null) : undefined`).
   - Reject reopening `CLOSED` cases (`400 Cannot reopen a closed case`).
   - Record `createAuditLog` (`STATUS_CHANGE` / `UPDATE`).
4. Update Portal UIs:
   - `src/app/(patient)/patient/dashboard/page.tsx`: Use `CASE_PHASE_GROUPS`, `getCasePhaseIndex(activeCase.status)`, and `CASE_STATUS_LABELS[activeCase.status]`; **delete lines 214–226** (the leaked `/manager/cases/${activeCase.id}/pathway` button).
   - `src/app/(manager)/manager/cases/page.tsx`: Filter tabs by `ALL` + `CASE_PHASE_GROUPS` (displaying `<CaseStatusBadge status={c.status} />` on each card) and populate the `Pipeline Stage` `<Select>` with all 12 `CASE_STATUS_ORDER` options.
   - `src/app/(admin)/admin/cases/page.tsx` & `src/app/(admin)/admin/dashboard/page.tsx`: Populate `STATUS_OPTIONS`, `STATUS_BADGE`, `STATUS_LABELS`, and `STATUS_COLORS` for all 12 statuses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/case-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/lib/validation/schemas.ts src/components/ui/Badge.tsx src/app/api/v1/manager/cases/route.ts src/app/api/v1/admin/cases/route.ts src/app/(patient)/patient/dashboard/page.tsx src/app/(manager)/manager/cases/page.tsx src/app/(admin)/admin/cases/page.tsx src/app/(admin)/admin/dashboard/page.tsx src/lib/__tests__/case-status.test.ts
git commit -m "fix(cases): unify 12-stage CaseStatus lifecycle across portals and fix ghost escalations"
```

---

### Task 6: Dual Patient & Case Onboarding + Atomic Coordinator Reassignment (`C-01`, `C-11`)

**Files:**
- Create: `src/lib/services/onboarding.service.ts`
- Create: `src/lib/services/case-assignment.service.ts`
- Modify: `src/app/api/v1/auth/register/route.ts`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/api/v1/admin/users/route.ts`
- Modify: `src/app/(admin)/admin/users/page.tsx`
- Modify: `src/app/api/v1/admin/patients/route.ts`
- Modify: `src/app/(admin)/admin/patients/page.tsx`
- Modify: `src/app/api/v1/admin/cases/route.ts`
- Modify: `src/app/api/v1/admin/cases/reassign/route.ts`
- Modify: `src/app/api/v1/manager/cases/route.ts`
- Test: `src/lib/services/__tests__/onboarding-and-assignment.test.ts`

**Interfaces:**
- Produces:
  - `onboardPatient(input: OnboardPatientInput, meta?: { actorId?: string; ipAddress?: string })` -> creates `{ user, patient, medicalProfile, initialCase }` in a single `prisma.$transaction`.
  - `createCaseForPatient(input: { patientId: string; notes?: string; isUrgent?: boolean; managerId?: string | null; actorId: string; ipAddress?: string })` -> creates `Case` and syncs `Patient.assignedManagerId` if unset.
  - `assignPatientCoordinator(input: { patientId?: string; caseIds?: string[]; managerId: string | null; actorId: string; ipAddress?: string })` -> atomically updates both `Patient.assignedManagerId` and open `Case.managerId`.

- [ ] **Step 1: Write failing tests for transactional onboarding & atomic coordinator sync**

Create `src/lib/services/__tests__/onboarding-and-assignment.test.ts` mocking `@/lib/prisma` `$transaction` to verify:
1. `onboardPatient` encrypts `passportNo` (never storing plaintext `'A12345678'`), creates `User` (`role: 'PATIENT'`), `Patient`, `PatientMedicalProfile`, and initial `Case` (`status: 'INQUIRY_RECEIVED'`) with matching `Patient.assignedManagerId === Case.managerId`.
2. `assignPatientCoordinator` updates BOTH `tx.patient.update` (`assignedManagerId`) AND `tx.case.updateMany` (`managerId` where `status !== 'CLOSED'`), preventing split-brain coordinator state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/onboarding-and-assignment.test.ts`
Expected: FAIL (`Cannot find module '../onboarding.service'`).

- [ ] **Step 3: Implement `onboarding.service.ts`, `case-assignment.service.ts`, and wire into Register, Admin, and Manager routes + UIs**

1. Create `src/lib/services/onboarding.service.ts`:
   - Validates unique email (`409 USER_ALREADY_EXISTS`), hashes password via `hashPassword`, auto-selects least-loaded active `MANAGER` when `assignedManagerId` is omitted, encrypts `passportNo` via `encrypt()`, and creates `User` + `Patient` + `PatientMedicalProfile` + `Case` inside `prisma.$transaction`.
   - Exports `createCaseForPatient` verifying `Patient` exists and creating a new `Case` (`INQUIRY_RECEIVED`).
2. Create `src/lib/services/case-assignment.service.ts`:
   - Validates `managerId` (when non-null) is an active `MANAGER`, updates `Patient.assignedManagerId` and all open (`status: { not: 'CLOSED' }`) `Case.managerId` records inside `prisma.$transaction`, writes `REASSIGN` audit logs via `tx.auditLog.create`, and inserts `IN_APP` notifications.
3. Wire Onboarding & Case Creation:
   - `src/app/api/v1/auth/register/route.ts` + `src/app/(auth)/register/page.tsx`: Validate with `registerSchema` (extended with optional `medicalCondition`), call `onboardPatient`, issue `access_token` + `refresh_token` cookies via `setAuthCookies`, and redirect to `/patient/dashboard`.
   - `src/app/api/v1/admin/patients/route.ts` + `src/app/(admin)/admin/patients/page.tsx`: Add `POST` handler calling `onboardPatient` and `"Onboard New Patient"` modal in `/admin/patients`; fix line 166 to `setReassignManagerId(p.assignedManager?.id || '')`; wire `PUT` manager updates through `assignPatientCoordinator`.
   - `src/app/api/v1/admin/users/route.ts` + `src/app/(admin)/admin/users/page.tsx`: Require `nationality`, `passportNo`, and `dob` when `role === 'PATIENT'` (shown dynamically in modal) and delegate to `onboardPatient`; prevent Admin self-deactivation/self-demotion (`id === authUser.userId` guard); exclude `CLOSED` cases and read `c.isUrgent` instead of `c.urgencyLevel` in Workload Reassignment tab.
   - `src/app/api/v1/manager/cases/route.ts` & `src/app/api/v1/admin/cases/route.ts`: Add `POST` handlers calling `createCaseForPatient`; wire `PUT /api/v1/admin/cases` (when `managerId !== undefined`) and `POST /api/v1/admin/cases/reassign` through `assignPatientCoordinator`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/__tests__/onboarding-and-assignment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/onboarding.service.ts src/lib/services/case-assignment.service.ts src/app/api/v1/auth/register/route.ts src/app/(auth)/register/page.tsx src/app/api/v1/admin/users/route.ts src/app/(admin)/admin/users/page.tsx src/app/api/v1/admin/patients/route.ts src/app/(admin)/admin/patients/page.tsx src/app/api/v1/admin/cases/route.ts src/app/api/v1/admin/cases/reassign/route.ts src/app/api/v1/manager/cases/route.ts src/lib/services/__tests__/onboarding-and-assignment.test.ts
git commit -m "feat(onboarding): enable dual patient/case onboarding and atomic coordinator reassignment"
```

---

### Task 7: Document Storage Magic-Byte Hardening & Unified Multi-Role Streaming Downloads (`C-05`)

**Files:**
- Create: `src/lib/services/document-storage.service.ts`
- Create: `src/app/api/v1/documents/[id]/download/route.ts`
- Create: `src/app/api/v1/documents/bill/[id]/download/route.ts`
- Modify: `src/app/api/v1/patient/documents/route.ts`
- Modify: `src/app/api/v1/patient/documents/download/route.ts`
- Modify: `src/app/api/v1/manager/billing/route.ts`
- Test: `src/lib/services/__tests__/document-storage.service.test.ts`

**Interfaces:**
- Produces in `src/lib/services/document-storage.service.ts`:
  - `validateUploadBuffer(buffer: Buffer, fileName: string, mimeType: string): { valid: true; canonicalMime: string; ext: string } | { valid: false; message: string }`
  - `saveValidatedUpload(file: File, prefix: 'doc' | 'bill'): Promise<{ storageKey: string; canonicalMime: string; fileSize: number }>`
  - `removeStoredFile(storageKey: string | null | undefined): Promise<void>`
  - `streamDocumentById(docId: string, authUser: AuthUser)`
  - `streamBillInvoiceById(billId: string, authUser: AuthUser)`

- [ ] **Step 1: Write failing tests for magic-byte validation (blocking `.html`/`.svg` XSS) and multi-role document authorization**

Create `src/lib/services/__tests__/document-storage.service.test.ts`:

```typescript
import { validateUploadBuffer, canUserAccessPatientDocument } from '../document-storage.service';

describe('document-storage.service', () => {
  it('accepts genuine PDF, JPEG, and PNG headers', () => {
    const pdfBuf = Buffer.from('%PDF-1.7\n...');
    expect(validateUploadBuffer(pdfBuf, 'report.pdf', 'application/pdf').valid).toBe(true);

    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateUploadBuffer(pngBuf, 'scan.png', 'image/png').valid).toBe(true);

    const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateUploadBuffer(jpgBuf, 'photo.jpg', 'image/jpeg').valid).toBe(true);
  });

  it('rejects HTML/SVG XSS payloads even when renamed to .pdf', () => {
    const xssBuf = Buffer.from('<script>alert(1)</script>');
    expect(validateUploadBuffer(xssBuf, 'evil.pdf', 'application/pdf').valid).toBe(false);
    expect(validateUploadBuffer(xssBuf, 'evil.svg', 'image/svg+xml').valid).toBe(false);
  });

  it('enforces strict patient/manager/admin object-level ownership', () => {
    const docContext = {
      patientUserId: 'pat-u1',
      assignedManagerId: 'mgr-1',
      caseManagerIds: ['mgr-1'],
      doctorUserIds: ['doc-u1'],
    };
    expect(canUserAccessPatientDocument({ userId: 'pat-u1', role: 'PATIENT', email: 'a@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'pat-u2', role: 'PATIENT', email: 'x@b.c' }, docContext)).toBe(false);
    expect(canUserAccessPatientDocument({ userId: 'mgr-1', role: 'MANAGER', email: 'm@b.c' }, docContext)).toBe(true);
    expect(canUserAccessPatientDocument({ userId: 'mgr-2', role: 'MANAGER', email: 'm2@b.c' }, docContext)).toBe(false);
    expect(canUserAccessPatientDocument({ userId: 'adm-1', role: 'ADMIN', email: 'ad@b.c' }, docContext)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/document-storage.service.test.ts`
Expected: FAIL (`Cannot find module '../document-storage.service'`).

- [ ] **Step 3: Implement `document-storage.service.ts`, unified download endpoints, and upload/delete fixes**

1. Create `src/lib/services/document-storage.service.ts`:
   - Verify extension in `ALLOWED_EXTENSIONS`, MIME in `ALLOWED_MIME_TYPES`, `buffer.length > 0 && buffer.length <= SYSTEM_LIMITS.MAX_FILE_SIZE_BYTES`, and binary header magic bytes (`255044462d` for PDF, `ffd8ff` for JPEG, `89504e470d0a1a0a` for PNG).
   - Generate `storageKey = "${prefix}_${crypto.randomUUID()}${ext}"`, write to `storage/uploads/${storageKey}`.
   - Implement `streamDocumentById` and `streamBillInvoiceById` checking `canUserAccessPatientDocument`, resolving `path.join(process.cwd(), 'storage', 'uploads', path.basename(storageKey))`, setting `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache, no-store, must-revalidate`, and logging `DOWNLOAD_DOCUMENT`.
2. Create `src/app/api/v1/documents/[id]/download/route.ts` and `src/app/api/v1/documents/bill/[id]/download/route.ts` delegating to `streamDocumentById` and `streamBillInvoiceById`.
3. Update `src/app/api/v1/patient/documents/download/route.ts` to delegate `?id=` requests to `streamDocumentById`.
4. Update `src/app/api/v1/patient/documents/route.ts`:
   - Validate `category` against allowed patient categories (`PASSPORT`, `VISA`, `MEDICAL_REPORT`, `PRESCRIPTION`, `INSURANCE`, `FRRO_REGISTRATION`).
   - Save `storageKey` on `Document` and set `fileUrl = "/api/v1/documents/${document.id}/download"` without overwriting `storageKey`.
   - In `DELETE`, block `PATIENT` deletion when `verificationStatus === 'VERIFIED' || verificationStatus === 'ISSUED_BY_HOSPITAL'` (`403`), and call `removeStoredFile(document.storageKey)`.
5. Update `src/app/api/v1/manager/billing/route.ts` (`POST`):
   - Validate & save invoice PDF via `saveValidatedUpload(file, 'bill')`, store `storageKey`, and update `fileUrl = "/api/v1/documents/bill/${newBill.id}/download"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/__tests__/document-storage.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/document-storage.service.ts src/app/api/v1/documents/[id]/download/route.ts src/app/api/v1/documents/bill/[id]/download/route.ts src/app/api/v1/patient/documents/route.ts src/app/api/v1/patient/documents/download/route.ts src/app/api/v1/manager/billing/route.ts src/lib/services/__tests__/document-storage.service.test.ts
git commit -m "fix(documents): separate storageKey, enforce magic-byte validation, and unify multi-role downloads"
```

---

### Task 8: Prisma Singleton Cleanup, Cross-Tenant IDOR Lockdown & UI Integrity Fixes (`C-10`)

**Files:**
- Modify: `src/app/api/v1/manager/appointments/route.ts`
- Modify: `src/app/api/v1/manager/chat/route.ts`
- Modify: `src/app/api/v1/manager/dashboard/route.ts`
- Modify: `src/app/api/v1/manager/billing/route.ts`
- Modify: `src/app/api/v1/accommodations/route.ts`
- Modify: `src/app/api/v1/accommodations/bookings/route.ts`
- Modify: `src/app/api/v1/patient/appointments/route.ts`
- Modify: `src/components/ui/DatePicker.tsx`
- Modify: `src/components/ui/PhoneInput.tsx`
- Modify: `src/components/ui/Toast.tsx`
- Modify: `src/app/(patient)/patient/layout.tsx`
- Modify: `src/app/(manager)/manager/billing/page.tsx`
- Test: `src/lib/__tests__/idor-and-datepicker.test.ts`

**Interfaces:**
- Produces:
  - `calculateHotelStayNights(checkInStr: string, checkOutStr: string): number` (throws/rejects when `checkOut <= checkIn` or invalid dates)
  - `parseLocalCalendarDate(value: string): Date` in `src/components/ui/DatePicker.tsx`

- [ ] **Step 1: Write failing tests for hotel stay date validation (rejecting `checkOut <= checkIn`) and local calendar date parsing**

Create `src/lib/__tests__/idor-and-datepicker.test.ts`:

```typescript
import { calculateHotelStayNights } from '@/app/api/v1/accommodations/bookings/route';
import { parseLocalCalendarDate } from '@/components/ui/DatePicker';

describe('Hotel Booking Date Integrity & DatePicker Local Parsing', () => {
  it('calculates positive stay nights and rejects reversed or identical dates', () => {
    expect(calculateHotelStayNights('2026-12-01', '2026-12-06')).toBe(5);
    expect(() => calculateHotelStayNights('2026-12-10', '2026-12-05')).toThrow();
    expect(() => calculateHotelStayNights('2026-12-10', '2026-12-10')).toThrow();
  });

  it('parses YYYY-MM-DD strings in local calendar date without UTC -1 day shift', () => {
    const d = parseLocalCalendarDate('1984-03-15');
    expect(d.getFullYear()).toBe(1984);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/idor-and-datepicker.test.ts`
Expected: FAIL (`calculateHotelStayNights` and `parseLocalCalendarDate` not exported).

- [ ] **Step 3: Implement Prisma singleton cleanup, Billing & Accommodations IDOR lockdown, Appointment ownership checks, and UI/lint fixes**

1. Replace `new PrismaClient()` with `import prisma from '@/lib/prisma'` in:
   - `src/app/api/v1/manager/appointments/route.ts`
   - `src/app/api/v1/manager/chat/route.ts`
   - `src/app/api/v1/manager/dashboard/route.ts`
2. In `src/app/api/v1/manager/billing/route.ts`:
   - Enforce `authUser.role === 'MANAGER' || authUser.role === 'ADMIN'`.
   - Scope `GET` `where` when `authUser.role === 'MANAGER'` to `where.case = { managerId: authUser.userId }`.
   - In `POST`, verify `caseRecord` exists, `caseRecord.patientId === patientId`, and (when `MANAGER`) `caseRecord.managerId === authUser.userId`.
3. In `src/app/api/v1/accommodations/route.ts` & `src/app/api/v1/accommodations/bookings/route.ts`:
   - In `GET /api/v1/accommodations`: check `getAuthUser(request)` and omit `commissionPercent` when `role === 'PATIENT'`. Use `commissionPercent !== undefined ? Number(commissionPercent) : 15.0` on `POST` so `0%` commission is preserved.
   - In `GET /api/v1/accommodations/bookings`:
     - `DOCTOR`: return `403 FORBIDDEN`.
     - `PATIENT`: filter `where: { patientId: patient.id }`, omit `commissionAmountUsd` on bookings and omit `metrics`.
     - `MANAGER`: filter `where: { patient: { assignedManagerId: authUser.userId } }`, select only `{ id: true, nationality: true, user: { select: { fullName: true, email: true } } }` on `patient` (never exposing `passportNo` or `medicalCondition`).
     - `ADMIN`: full view; exclude `b.status === 'CANCELLED'` when summing `totalGrossRevenue` and `totalCommissionEarned`.
   - Export `calculateHotelStayNights(checkInStr, checkOutStr)` validating `!isNaN` and `end > start` (no `Math.abs()`), verify `hotel.isActive`, validate `numGuests >= 1 && numGuests <= 10`, and verify `caseId` (if provided) belongs to `patient.id`.
4. In `src/app/api/v1/patient/appointments/route.ts` & `src/app/api/v1/manager/appointments/route.ts` (`POST`):
   - Verify `caseRecord.patientId === patient.id`, `caseRecord.status !== 'CLOSED'`, and `doctor.hospitalId === hospitalId`.
5. UI & Lint Fixes:
   - `src/components/ui/DatePicker.tsx`: Export `parseLocalCalendarDate` for `YYYY-MM-DD` strings; replace `if (includeTime)` / `if (!includeTime)` in `handleDaySelect` and `formatDisplay` with `hasTimePicker`; replace nested `<span onClick>` inside `<button>` with a sibling clear `<button type="button">`.
   - `src/components/ui/PhoneInput.tsx`: Escape `&ldquo;{searchTerm}&rdquo;` on line 588.
   - `src/components/ui/Toast.tsx`: Remove unused `useState` import and replace `errorObj: any` with `unknown`.
   - `src/app/(manager)/manager/billing/page.tsx`: Fix line 231 `} fontally: {` -> `} finally {`.
   - `src/app/(patient)/patient/layout.tsx`: Add `{ label: 'Medical Profile', href: '/patient/profile', icon: <User className="w-5 h-5" /> }` to `Resources & Records` in `navSections`, link the sidebar user card to `/patient/profile`, and add top-header title blocks for `/patient/billing` and `/patient/accommodations`.

- [ ] **Step 4: Run full verification suite (`jest`, `typecheck`, `lint`, `build`)**

Run: `npx jest ; npm run typecheck ; npm run lint ; npm run build`
Expected:
- All Jest test suites PASS (`0` failures)
- `tsc --noEmit` exits `0`
- `eslint` exits `0` (or `0` errors)
- `next build` exits `0`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/manager/appointments/route.ts src/app/api/v1/manager/chat/route.ts src/app/api/v1/manager/dashboard/route.ts src/app/api/v1/manager/billing/route.ts src/app/api/v1/accommodations/route.ts src/app/api/v1/accommodations/bookings/route.ts src/app/api/v1/patient/appointments/route.ts src/components/ui/DatePicker.tsx src/components/ui/PhoneInput.tsx src/components/ui/Toast.tsx src/app/(patient)/patient/layout.tsx src/app/(manager)/manager/billing/page.tsx src/lib/__tests__/idor-and-datepicker.test.ts
git commit -m "fix(security,ui): lock down billing/accommodations IDOR, Prisma singletons, and DatePicker/layout bugs"
```
