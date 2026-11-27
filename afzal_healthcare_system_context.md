# System Context & Architecture Guide — Afzal Healthcare

> **Prompt for AI Assistant:** Use this document as the single source of truth for the codebase architecture, data models, workflows, security rules, and project layout of **Afzal Healthcare**.

---

## 1. Project Overview & Business Domain

**Afzal Healthcare** (`afzal-healthcare`) is a full-stack, enterprise-grade medical tourism platform connecting international patients traveling to India with healthcare providers, specialist doctors, and dedicated case managers.

### Core Portals & User Roles
1. **Patient Portal** (`PATIENT`): International patients submitting medical inquiries, uploading medical records/passports, tracking treatment cases, booking appointments, and communicating with assigned managers.
2. **Doctor Portal** (`DOCTOR`): Specialist physicians viewing assigned patients, managing consultation schedules, and recording clinical notes.
3. **Manager Portal** (`MANAGER`): Case coordinators managing patient pipelines, arranging hospital slots, and handling live chat support.
4. **Admin & Super Admin Portals** (`ADMIN`, `SUPER_ADMIN`): Platform administrators managing partner hospitals, doctors, specialisations, user management, audit logs, system configurations, email campaigns, and analytics.

---

## 2. Technology Stack & Architecture

- **Frontend / Application Framework**: Next.js 16 (App Router with Turbopack, React 19, TypeScript).
- **Styling**: Tailwind CSS v4, Vanilla CSS utilities, Google Font (`Plus Jakarta Sans`).
- **Database & ORM**: MySQL (running locally on port 3306), Prisma 6 ORM.
- **Authentication**:
  - Stateless JWT access tokens (15-minute expiration) verified via `jose` library on Next.js Edge Runtime.
  - Refresh token rotation (7-day expiration) tracked in `refresh_tokens` database table.
  - HttpOnly, Secure, `SameSite=Strict` cookies (`access_token`, `refresh_token`).
  - Two-Factor Authentication (TOTP / MFA) mandatory for `ADMIN`, `SUPER_ADMIN`, and `MANAGER` roles using `otpauth`.
- **Security & HIPAA Compliance**:
  - Application-level `AES-256-GCM` field encryption (`crypto.ts` & `phi-encryption.ts`) for all ePHI at rest (passports, diagnoses, medical profiles, surgeries, allergies, clinical notes).
  - Isolated private file storage in `storage/uploads/` (outside public web root).
  - Authenticated streaming download endpoint (`GET /api/v1/patient/documents/download?id=...`).
  - 15-minute inactivity auto-logoff with 13-minute warning toast (`SessionTimeoutProvider.tsx`).
  - Read/Mutation audit logging (`AuditLog` table via `audit-logger.ts`).
  - HTTP Security Headers (HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).

---

## 3. Database Schema & Core Entities (`prisma/schema.prisma`)

```prisma
enum UserRole {
  PATIENT
  MANAGER
  ADMIN
  SUPER_ADMIN
  DOCTOR
}

enum CaseStatus {
  INQUIRY_RECEIVED
  UNDER_REVIEW
  PLAN_CONFIRMED
  IN_TREATMENT
  POST_TREATMENT
  CLOSED
}

enum AppointmentType {
  CONSULTATION
  PRE_OP_ASSESSMENT
  SURGERY
  POST_OP_REVIEW
}

enum DocumentCategory {
  PASSPORT
  MEDICAL_REPORT
  INSURANCE
  VISA
  PRESCRIPTION
}
```

### Key Models:
- **`User`**: `id`, `email`, `passwordHash`, `role`, `fullName`, `phone`, `isActive`, `totpSecret` (encrypted), `totpEnabled`.
- **`Patient`**: Mapped 1:1 to `User`. Stores `nationality`, `passportNo` (encrypted), `dob`, `bloodGroup`, `medicalCondition` (encrypted), `urgencyLevel`, `emergencyContact` (JSON), `assignedManagerId`.
- **`PatientMedicalProfile`**: `allergies`, `medications`, `surgeries`, `chronicConditions` (all JSON arrays encrypted at rest).
- **`Case`**: Tracks patient medical journey. Belongs to `Patient`, assigned to `User` (Manager). Fields: `status`, `notes` (encrypted), `isUrgent`, `escalationNote`.
- **`Hospital`**: `name`, `city`, `address`, `accreditation`, `commissionRate`, `departments` (JSON array).
- **`Doctor`**: Belongs to `Hospital` and `Specialisation`. Mapped optional 1:1 with `User`. Fields: `qualification`, `languages`, `consultationFee`, `availableDays`.
- **`Appointment`**: Connects `Case`, `Patient`, `Hospital`, `Doctor`, and creator `User`. `scheduledAt`, `status`, `clinicalNotes` (encrypted).
- **`Document`**: Files uploaded by patients/managers. `fileUrl` (authenticated download API path), `category`, `fileName`, `fileSize`, `mimeType`.
- **`Message`**: Real-time chat messages between patients and managers.
- **`AuditLog`**: Records system mutations (`CREATE`, `UPDATE`, `DELETE`) and ePHI reads (`VIEW_PATIENT`, `DOWNLOAD_DOCUMENT`, `EXPORT`).

---

## 4. Directory Structure & Key Files

```
Afzal Healthcare/
œ── prisma/
‚   œ── schema.prisma              # Database schema definition (MySQL)
‚   ”── seed.ts                    # Database seed script for test accounts
œ── storage/
‚   ”── uploads/                   # Private, non-public directory for ePHI files
œ── src/
‚   œ── app/
‚   ‚   œ── (auth)/                # Public auth pages: /login, /register, /forgot-password
‚   ‚   œ── (patient)/             # Patient portal: /patient/dashboard, /appointments, /documents, /profile, /messages
‚   ‚   œ── (doctor)/              # Doctor portal: /doctor/dashboard, /appointments, /patients
‚   ‚   œ── (manager)/             # Manager portal: /manager/dashboard, /cases, /appointments, /accommodations, /chat
‚   ‚   œ── (admin)/               # Admin portal: /admin/dashboard, /hospitals, /doctors, /users, /audit-logs, /settings
‚   ‚   œ── api/v1/                # Modular REST API endpoints
‚   ‚   ‚   œ── auth/              # login, register, logout, me, 2fa/setup, 2fa/validate
‚   ‚   ‚   œ── patient/           # documents, profile, appointments, cases, messages, documents/download
‚   ‚   ‚   œ── doctor/            # dashboard, appointments, patients
‚   ‚   ‚   œ── manager/           # dashboard, cases, appointments, accommodations, chat
‚   ‚   ‚   ”── admin/             # users, hospitals, doctors, hostels, audit-logs, settings, export/
‚   ‚   œ── globals.css            # Tailwind & CSS custom properties
‚   ‚   ”── layout.tsx             # Root layout with SessionTimeoutProvider
‚   œ── components/
‚   ‚   œ── ui/                    # Reusable Button, Input, Card, Badge, Toast, ConfirmDialog
‚   ‚   œ── GlobalProviders.tsx    # ToastContainer & SessionTimeoutProvider wrapper
‚   ‚   ”── SessionTimeoutProvider.tsx # HIPAA 15-minute idle auto-logoff component
‚   œ── lib/
‚   ‚   œ── api/
‚   ‚   ‚   œ── auth-helper.ts     # Cookie setters, getAuthUser, requireAuth, requirePermission
‚   ‚   ‚   œ── audit-logger.ts    # Audit trail creator and action constants
‚   ‚   ‚   œ── phi-encryption.ts  # Field-level ePHI encryption/decryption helpers
‚   ‚   ‚   ”── response.ts        # Uniform JSON response envelopes { success, data, error }
‚   ‚   œ── auth/
‚   ‚   ‚   œ── crypto.ts          # AES-256-GCM encryption primitives
‚   ‚   ‚   œ── jwt.ts             # Sign and verify access/refresh tokens via `jose`
‚   ‚   ‚   œ── rbac.ts            # PERMISSIONS & ROUTE_ROLES definitions
‚   ‚   ‚   œ── totp.ts            # 2FA secret generation and code verification
‚   ‚   ‚   ”── password.ts        # bcrypt password hashing (12 rounds)
‚   ‚   œ── constants.ts           # Enums, labels, status order, MIME types, system limits
‚   ‚   ”── prisma.ts              # Singleton PrismaClient instance
‚   ”── proxy.ts                   # Next.js middleware for route protection & JWT verification
œ── next.config.ts                 # Next.js config with Security Headers (HSTS, CSP, X-Frame-Options)
”── .env                           # DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
```

---

## 5. Security & Authentication Flow

1. **User Login (`POST /api/v1/auth/login`)**:
   - Validates email & password (bcrypt).
   - If role is `ADMIN`, `SUPER_ADMIN`, or `MANAGER`, checks 2FA status:
     - If `totpEnabled` is false, returns `requires2FASetup: true` + `tempSessionId`.
     - If `totpEnabled` is true, returns `requires2FA: true` + `tempSessionId`.
   - If `PATIENT` or 2FA validated, creates a `RefreshToken` DB record and sets HttpOnly cookies (`access_token` maxAge 15m, `refresh_token` maxAge 7d, `SameSite=Strict`).
2. **Middleware Request Checking (`src/proxy.ts`)**:
   - Extracts `access_token` cookie.
   - Verifies JWT using `jose`.
   - Checks role permissions via `canAccessRoute(role, pathname)` from `rbac.ts`.
   - Injects `x-user-id`, `x-user-role`, `x-user-email` into request headers for downstream API route handlers.
3. **Document Upload & Download Flow**:
   - Upload (`POST /api/v1/patient/documents`): Saves file to `storage/uploads/` (outside web root). Writes `fileUrl = /api/v1/patient/documents/download?id=${docId}`.
   - Download (`GET /api/v1/patient/documents/download?id=${docId}`): Verifies ownership/role authorization, streams file with `private, no-cache` headers, logs `DOWNLOAD_DOCUMENT` audit event.

---

## 6. Seed Credentials for Testing

| Role | Email | Password | 2FA Required |
| :--- | :--- | :--- | :---: |
| **Super Admin** | `admin@afzalhealthcare.in` | `Admin@123` | Yes |
| **Regular Admin** | `admin_regular@afzalhealthcare.in` | `Admin@123` | Yes |
| **Manager** | `manager@afzalhealthcare.in` | `Manager@123` | Yes |
| **Doctor** | `doctor@afzalhealthcare.in` | `Doctor@123` | No |
| **Patient** | `patient@afzalhealthcare.in` | `Patient@123` | No |

---

## 7. Key Operational Commands

```bash
# Start local development server (runs on http://localhost:3000)
npm run dev

# Run TypeScript type check (0 errors expected)
npm run typecheck

# Run unit tests (Jest)
npm run test

# Run full Next.js production build
npm run build

# Push Prisma schema to MySQL database
npx prisma db push

# Re-seed database with initial mock users and test data
npm run db:seed
```
