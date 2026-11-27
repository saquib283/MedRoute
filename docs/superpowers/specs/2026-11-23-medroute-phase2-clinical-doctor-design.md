# MedRoute (`afzal-healthcare`) — Sub-Project 2 Architectural Design Specification
## Clinical Pathway Orchestration, Doctor Portal, Document Verification/VIL & Fit-to-Fly Clearance

- **Date:** 2026-11-23
- **Status:** Approved for Spec Review
- **Audit Findings Remediated:** `C-07` (Pathway RBAC & Action Metadata Wipe), `C-09` (Headless Doctor Subsystem, Missing RBAC, Unreachable Fit-to-Fly & Document Verification/VIL), plus `P1` Clinical Appointment & Document Vault defects (`4.2`, `5`).
- **Prerequisite Baseline:** Sub-project 1 (`18bb291` on `main`). No Prisma schema DDL changes are required — all Sub-project 2 workflows operate over existing `Doctor`, `Case`, `ClinicalStep`, `FitToFlyClearance`, `Document`, and `Appointment` models.

---

## 1. Goals & Scope Boundaries

### In Scope (Sub-Project 2)
1. **Doctor RBAC, Account Provisioning & `(doctor)` Portal (`C-09`):**
   - Complete `DOCTOR` permission entries in `src/lib/auth/rbac.ts` and multi-role route prefixes (`/api/v1/cases`, `/api/v1/pathway-templates`, `/api/v1/documents`).
   - Fix `openEdit` in `/admin/doctors` (`hospitalId`, `specialisationId`, `userId` preservation) and enable linking an existing unlinked `DOCTOR` user **or** creating a `DOCTOR` `User` login inline (`createAccount: true`, `email`, `password`) inside `prisma.$transaction`.
   - Build the complete `src/app/(doctor)/doctor/` portal (`layout.tsx`, `dashboard/page.tsx`, `appointments/page.tsx`, `patients/page.tsx`, `cases/[id]/page.tsx`).
2. **Multi-Role Clinical Pathway Builder & Surgical Milestone Sign-Off (`C-07`):**
   - Shared object-RBAC endpoints `GET /api/v1/pathway-templates` and `GET / POST / PATCH /api/v1/cases/[id]/pathway` (keeping `/api/v1/admin/pathway-templates` and `/api/v1/admin/cases/[id]/pathway` as thin backward-compatible wrappers).
   - Fix `POST` pathway save so `actionType`, `requiredRole`, and `actionUrl` are persisted instead of wiped, enforce Zod validation + closed-case protection, and write `AuditLog` entries.
   - Add `PATCH /api/v1/cases/[id]/pathway` for single-step clinical sign-off (`status`, `decisionBranch`, `doctorNotes`) without replacing sibling steps.
   - Extract reusable `<PathwayBuilder />` component, wire `/manager/cases/[id]/pathway` and `/admin/cases/[id]/pathway`, and add `"Configure Pathway"` navigation links in `/manager/cases` and `/admin/cases`.
3. **Document Verification & Official Hospital/Clinical Certificate Issuance (`C-05`, `C-09`):**
   - `PATCH /api/v1/documents/[id]/verify`: Assigned `MANAGER` or `ADMIN` verifies or rejects patient uploads (`VERIFIED` | `REJECTED` + `verificationNotes`, `verifiedBy`, `verifiedAt`, `AuditLog`).
   - `GET / POST /api/v1/cases/[id]/documents`: Lists case patient documents (`ADMIN`, assigned `MANAGER`, treating `DOCTOR`) and issues official `ISSUED_BY_HOSPITAL` documents via **either** magic-byte-validated file upload **or** built-in deterministic `%PDF-1.4` certificate generation (`VISA_INVITATION_LETTER`, `PROFORMA_INVOICE`, `MEDICAL_OPINION`, `FRRO_REGISTRATION`, `FIT_TO_FLY_CERTIFICATE`, `PRESCRIPTION`, `MEDICAL_REPORT`). Issuing `VISA_INVITATION_LETTER` auto-completes pending `ISSUE_VIL` pathway steps; issuing `PROFORMA_INVOICE` auto-completes pending `ISSUE_PROFORMA` steps.
   - Add Document Review & VIL Issuance UI to Manager/Admin case views and Doctor case workspace; fix `INSURANCE` filter and hide Delete on `VERIFIED` + `ISSUED_BY_HOSPITAL` documents in `/patient/documents`.
4. **Fit-to-Fly Clearance & Clinical Appointment Lifecycle (`C-09`, `4.2`):**
   - `GET / PUT /api/v1/cases/[id]/fit-to-fly`: Treating `DOCTOR` or `ADMIN` certifies or revokes `FitToFlyClearance` (`isCleared`, `clearedBy`, `clearanceDate`, `restrictions`, `reEvalDate`), optionally uploading or auto-generating the `FIT_TO_FLY_CERTIFICATE` PDF in `Document` (`ISSUED_BY_HOSPITAL`), marking `SIGN_FIT_TO_FLY` pathway steps `COMPLETED` (`FIT_TO_FLY_GRANTED`), and advancing active `Case.status` to `FIT_TO_FLY_CLEARED`.
   - Restrict patient appointment requests (`POST /api/v1/patient/appointments`) to `CONSULTATION`, `PRE_OP_ASSESSMENT`, and `POST_OP_REVIEW` (blocking direct `SURGERY` self-booking), enforce `doctor.availableDays` when populated, add `PUT /api/v1/patient/appointments` for patient self-cancellation, strip duplicate `"Dr. "` prefixes via `formatDoctorDisplayName`, fix `selectedAppt.clinicalNotes` in `/admin/appointments`, and add `CONFIRMED` / `IN_PROGRESS` / `COMPLETED` status controls + `ADMIN` exemption on `PUT /api/v1/manager/appointments`.

### Out of Scope (Deferred to Sub-Projects 3 & 4)
- Manager Billing patient selector fix, `MedicalBill` settlement (`PUT`/`PATCH`), OCR overhaul, Hotel CRUD/cancellation, and Analytics revenue rollover (**Sub-project 3**).
- `SystemConfig` migration, Notification bell/reader, Email Campaign sanitization/worker, and CSV formula injection hardening (**Sub-project 4**).

---

## 2. Role Authority & Object-Level Access Matrix

All case-scoped clinical endpoints resolve access through a shared helper `authorizeCaseClinicalAccess(caseId, actor)` in `src/lib/services/clinical-pathway.service.ts`:

| Actor Role | Case Access Condition | Read Pathway & Case Docs | Replace Full Pathway (`POST`) | Sign Clinical Step (`PATCH`) | Verify/Reject Patient Upload | Issue Hospital Certs (`VIL`, `PROFORMA`, `FRRO`, `MEDICAL_OPINION`) | Issue Clinical Certs & Sign `FitToFlyClearance` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`ADMIN`** | Any case | Yes | Yes (non-`CLOSED`) | Yes (non-`CLOSED`) | Yes | Yes | Yes |
| **`MANAGER`** | `case.managerId === userId` or `patient.assignedManagerId === userId` | Yes | Yes (non-`CLOSED`) | Yes (non-`CLOSED`, steps where `requiredRole !== 'DOCTOR'`) | Yes | Yes | No (`403`) |
| **`DOCTOR`** | Active `Doctor` (`userId === actor.userId`, `isActive === true`) with `>= 1` non-`CANCELLED` `Appointment` on `caseId` | Yes | No (`403`) | Yes (non-`CLOSED`, steps where `!requiredRole` or `requiredRole === 'DOCTOR'`) | No (`403`) | `MEDICAL_OPINION` only | Yes (`FIT_TO_FLY_CERTIFICATE`, `MEDICAL_OPINION`, `PRESCRIPTION`, `MEDICAL_REPORT` + `FitToFlyClearance`) |
| **`PATIENT`** | `case.patient.userId === userId` | Pathway `GET` only | No (`403`) | No (`403`) | No (`403`) | No (`403`) | `FitToFly` `GET` only |

### Edge Proxy & RBAC Updates (`src/lib/auth/rbac.ts` & `src/proxy.ts`)
- Add permissions to `PERMISSIONS`:
  - `'view:case': ['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']`
  - `'sign:clinical-pathway': ['DOCTOR', 'MANAGER', 'ADMIN']`
  - `'sign:fit-to-fly': ['DOCTOR', 'ADMIN']`
  - `'verify:documents': ['MANAGER', 'ADMIN']`
  - `'issue:documents': ['MANAGER', 'DOCTOR', 'ADMIN']`
  - `'update:clinical-appointments': ['DOCTOR', 'MANAGER', 'ADMIN']`
- `ROUTE_ROLES` in `src/lib/auth/rbac.ts`:
  - Keep `'/admin': ['ADMIN']`, `'/manager': ['MANAGER', 'ADMIN']`, `'/doctor': ['DOCTOR']`, `'/patient': ['PATIENT']`.
  - Neutral authenticated prefixes `/api/v1/cases/*`, `/api/v1/pathway-templates`, and `/api/v1/documents/*` pass JWT verification in `src/proxy.ts` and enforce role + object ownership in route/service handlers.
- Add `AUDIT_ACTIONS` in `src/lib/api/audit-logger.ts`:
  - `CONFIGURE_PATHWAY: 'CONFIGURE_PATHWAY'`
  - `UPDATE_PATHWAY_STEP: 'UPDATE_PATHWAY_STEP'`
  - `VERIFY_DOCUMENT: 'VERIFY_DOCUMENT'`
  - `ISSUE_DOCUMENT: 'ISSUE_DOCUMENT'`
  - `SIGN_FIT_TO_FLY: 'SIGN_FIT_TO_FLY'`

---

## 3. Subsystem Specifications

### 3.1 Doctor Provisioning & `(doctor)` Portal (`C-09`)
1. **`/api/v1/admin/doctors` (`src/app/api/v1/admin/doctors/route.ts`):**
   - `GET`: Include `hospitalId`, `specialisationId`, `userId`, `hospital: { select: { id: true, name: true, city: true } }`, `specialisation: { select: { id: true, name: true } }`, and `user: { select: { id: true, email: true, fullName: true } }`. Also support `?meta=true` returning `unlinkedDoctorUsers` (`User` rows where `role === 'DOCTOR'`, `isActive === true`, and `doctor === null`).
   - `POST` & `PUT`: Support two account-binding modes validated via Zod:
     - **Link Existing User (`userId`):** Verify target `User` exists, has `role === 'DOCTOR'`, and is not linked to a different `Doctor` (`409 USER_ALREADY_EXISTS` otherwise). Pass `userId: null` on `PUT` to unlink.
     - **Create New Login Inline (`createAccount: true`, `email`, `password` min 8 chars):** Inside `prisma.$transaction`, verify `email` is unused (`409 USER_ALREADY_EXISTS`), hash password with `hashPassword(password)`, create `User` (`role: 'DOCTOR'`, `fullName`, `isActive: true`), and link `Doctor.userId = createdUser.id`.
2. **`/admin/doctors` UI (`src/app/(admin)/admin/doctors/page.tsx`):**
   - Fix `openEdit(d)` to populate `hospitalId: d.hospitalId`, `specialisationId: d.specialisationId`, and `userId: d.userId || ''`, and allow editing hospital/specialisation on `PUT`.
   - Add **Portal Login Binding** selector in the Add/Edit modal: `"No Portal Login"`, `"Link Existing Doctor User"`, or `"Create New Doctor Login (Email + Password)"`, and display linked login email badge in the doctors table.
3. **`/api/v1/doctor/*` Enhancements:**
   - `GET /api/v1/doctor/dashboard`: Return `{ doctorProfile, metrics: { todayAppointments, pendingAssessments, upcomingSurgeries, activeCases }, upcomingSchedule, pendingClinicalCases }` (cases linked via non-cancelled doctor appointments that have pending `DOCTOR` clinical steps or uncleared Fit-to-Fly in discharge stages).
   - `GET /api/v1/doctor/patients`: Include each patient's active `cases` (`id`, `status`, `isUrgent`, `fitToFlyClearance`) alongside `formatPatientForViewer(p, { maskPassport: true })`.
   - `PUT /api/v1/doctor/appointments`: Write `AuditLog` (`STATUS_CHANGE` / `UPDATE`) on status or `clinicalNotes` updates.
4. **`src/app/(doctor)/doctor/` Pages:**
   - `src/app/(doctor)/doctor/layout.tsx`: Clinical sidebar matching `ManagerLayout` (`Overview` `/doctor/dashboard`, `Appointments` `/doctor/appointments`, `My Patients` `/doctor/patients`, Sign Out button, mobile drawer, `/api/v1/auth/me` role guard for `DOCTOR`).
   - `src/app/(doctor)/doctor/dashboard/page.tsx`: Metric cards, today/upcoming appointments list, and pending clinical case clearances with direct links to `/doctor/cases/[id]`.
   - `src/app/(doctor)/doctor/appointments/page.tsx`: Filter tabs (`Upcoming`, `Past`, `All`), status transition controls (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), inline/modal `clinicalNotes` editor, and `"Open Case Workspace"` button (`/doctor/cases/${appt.case.id}`).
   - `src/app/(doctor)/doctor/patients/page.tsx`: Patient cards displaying decrypted clinical safety alerts (`allergies` in rose badge, `chronicConditions`, `medications`, `surgeries`, `bloodGroup`) and links to each patient's case workspace.
   - `src/app/(doctor)/doctor/cases/[id]/page.tsx`: Physician Case Workspace combining:
     1. Patient clinical header & decrypted `medicalProfile` banner.
     2. Interactive **Clinical Pathway Step Sign-Off** list (calls `PATCH /api/v1/cases/[id]/pathway` to update `status`, `decisionBranch`, and `doctorNotes`).
     3. **Fit-to-Fly Clearance** card/form (calls `PUT /api/v1/cases/[id]/fit-to-fly` with `isCleared`, `restrictions`, `reEvalDate`, and optional PDF upload or automatic PDF certificate generation).
     4. **Case Documents & Clinical Certificates** panel (downloads patient scans via `/api/v1/documents/[id]/download` and issues `MEDICAL_OPINION` / `PRESCRIPTION` / `MEDICAL_REPORT` / `FIT_TO_FLY_CERTIFICATE` via `POST /api/v1/cases/[id]/documents`).

### 3.2 Multi-Role Clinical Pathway Service & Builder (`C-07`)
1. **Service (`src/lib/services/clinical-pathway.service.ts`):**
   - `PRESET_TEMPLATES`: Moved from `admin/pathway-templates/route.ts` into `clinical-pathway.service.ts` as single source of truth.
   - `getCasePathwayForViewer(caseId, actor)`: Authorizes via `authorizeCaseClinicalAccess`, fetches `Case` with `patient.user`, `patient.medicalProfile` (formatted via `formatPatientForViewer` for `ADMIN`/`MANAGER`/`DOCTOR`; omitted/own for `PATIENT`), ordered `clinicalSteps`, and `fitToFlyClearance`.
   - `replaceCasePathway({ caseId, steps, caseStatus, actor, ipAddress })`:
     - Restricts to `ADMIN` or assigned `MANAGER`. Rejects `CLOSED` cases (`400 CASE_ALREADY_CLOSED`) and empty `steps` arrays (`400 BAD_REQUEST`).
     - Validates each step with Zod: `stageName` (`min(1)`), `stageOrder` (`int >= 1`), `stepOrder` (`int >= 1`), `title` (`min(1)`), `category` (`PRE_OP | TREATMENT | POST_OP | DISCHARGE | REHAB`), `status` (`PENDING | IN_PROGRESS | COMPLETED | ACTION_REQUIRED`), optional `decisionBranch`, `doctorNotes`, `actionType`, `requiredRole` (`PATIENT | DOCTOR | MANAGER | ADMIN`), `actionUrl`, `completedAt`.
     - Validates optional `caseStatus` against `CASE_STATUS_ORDER`.
     - Atomically replaces `clinicalStep` rows in `prisma.$transaction`, **persisting `actionType`, `requiredRole`, and `actionUrl`**, updates `Case.status` when `caseStatus` is provided, and records `CONFIGURE_PATHWAY` in `AuditLog`.
   - `updateSinglePathwayStep({ caseId, stepId, status, decisionBranch, doctorNotes, actor, ipAddress })`:
     - Verifies step belongs to `caseId` and case is not `CLOSED`.
     - Enforces role boundary: `DOCTOR` cannot sign steps explicitly assigned to `MANAGER`; `MANAGER` cannot sign steps explicitly assigned to `DOCTOR` (`requiredRole === 'DOCTOR'`); `ADMIN` can update any step.
     - Sets `completedAt = new Date()` when transitioning to `COMPLETED` (or `null` when reopened) and logs `UPDATE_PATHWAY_STEP`.
2. **Routes & Shared UI:**
   - Create `src/app/api/v1/pathway-templates/route.ts` (`GET` for `ADMIN`, `MANAGER`, `DOCTOR`) and `src/app/api/v1/cases/[id]/pathway/route.ts` (`GET`, `POST`, `PATCH`).
   - Refactor `src/app/api/v1/admin/pathway-templates/route.ts` and `src/app/api/v1/admin/cases/[id]/pathway/route.ts` to delegate to the same service functions while keeping their `ADMIN` guard intact.
   - Extract `src/components/clinical/PathwayBuilderEditor.tsx` (adding `requiredRole` selector alongside `actionType` and `decisionBranch`, calling `/api/v1/cases/${caseId}/pathway` and `/api/v1/pathway-templates`), render it in both `src/app/(manager)/manager/cases/[id]/pathway/page.tsx` (`backHref="/manager/cases"`) and new `src/app/(admin)/admin/cases/[id]/pathway/page.tsx` (`backHref="/admin/cases"`).
   - Add `"Configure Pathway"` links to `/manager/cases` (on each case card and edit panel) and `/admin/cases` (in table actions and Case Detail modal).

### 3.3 Document Verification & Deterministic PDF Certificate Generator (`C-05`, `C-09`)
1. **Service (`src/lib/services/clinical-certificate.service.ts`):**
   - `generateClinicalCertificatePdf(params)`: Pure Node `Buffer` builder producing a valid, multi-object `%PDF-1.4` document (with proper byte-offset `xref` table, Helvetica typography, Afzal Healthcare header, certificate title, patient name, masked/formatted passport or nationality, case ID, hospital/physician metadata, clinical/travel notes, and issuance timestamp). Passes `validateUploadBuffer(..., 'application/pdf', 'cert.pdf')` (`%PDF-` magic bytes).
   - `verifyPatientDocument({ documentId, verificationStatus, verificationNotes, actor, ipAddress })`:
     - Restricts to `ADMIN` or `MANAGER` assigned to the document's patient (`403` otherwise).
     - Rejects modifying `ISSUED_BY_HOSPITAL` documents (`400 BAD_REQUEST`).
     - Requires non-empty `verificationNotes` when `verificationStatus === 'REJECTED'`.
     - Updates `verificationStatus` (`'VERIFIED' | 'REJECTED'`), `verificationNotes`, `verifiedBy: actor.userId`, `verifiedAt: new Date()`, and writes `VERIFY_DOCUMENT` to `AuditLog`.
   - `issueCaseDocument({ caseId, category, file, notes, actor, ipAddress })`:
     - Enforces role-to-category rules:
       - `MANAGER`: `VISA_INVITATION_LETTER`, `PROFORMA_INVOICE`, `MEDICAL_OPINION`, `FRRO_REGISTRATION`.
       - `DOCTOR`: `FIT_TO_FLY_CERTIFICATE`, `MEDICAL_OPINION`, `PRESCRIPTION`, `MEDICAL_REPORT`.
       - `ADMIN`: Any of the above official categories.
     - If `file` (`File`) is provided, validates and writes via `saveValidatedUpload(file, 'cert')`. If `file` is omitted, generates a PDF via `generateClinicalCertificatePdf` and writes it to `storage/uploads/cert_<uuid>.pdf` (`removeStoredFile` cleanup on DB error).
     - Creates `Document` with `verificationStatus: 'ISSUED_BY_HOSPITAL'`, `verifiedBy: actor.userId`, `verifiedAt: new Date()`, `verificationNotes: notes || null`, `storageKey`, and `fileUrl: '/api/v1/documents/<id>/download'`.
     - Auto-completes matching non-`COMPLETED` `ClinicalStep`s on `caseId` (`ISSUE_VIL` for `VISA_INVITATION_LETTER`; `ISSUE_PROFORMA` for `PROFORMA_INVOICE`; `SIGN_FIT_TO_FLY` for `FIT_TO_FLY_CERTIFICATE`) and logs `ISSUE_DOCUMENT`.
2. **Routes & Portal UIs:**
   - `PATCH /api/v1/documents/[id]/verify/route.ts`
   - `GET / POST /api/v1/cases/[id]/documents/route.ts`
   - Update `/manager/cases` edit panel and `/admin/cases` detail modal to display patient documents with Download, `Verify` / `Reject` controls, and an `"Issue Official Document (VIL / Pro-Forma)"` action (supporting optional file upload or instant PDF generation).
   - Update `src/app/(patient)/patient/documents/page.tsx`:
     - Include `INSURANCE` in the `TRAVEL_VERIFICATION` category filter (`['PASSPORT', 'VISA', 'VISA_INVITATION_LETTER', 'FRRO_REGISTRATION', 'INSURANCE']`).
     - Hide the Delete button whenever `doc.verificationStatus === 'ISSUED_BY_HOSPITAL' || doc.verificationStatus === 'VERIFIED'`.

### 3.4 Fit-to-Fly Clearance & Appointment Lifecycle Polish (`C-09`, `4.2`)
1. **`GET / PUT /api/v1/cases/[id]/fit-to-fly/route.ts`:**
   - `GET`: Accessible to `ADMIN`, assigned `MANAGER`, treating `DOCTOR`, and owning `PATIENT`. Returns `fitToFlyClearance` + latest `FIT_TO_FLY_CERTIFICATE` document link if present.
   - `PUT`: Accessible to treating `DOCTOR` or `ADMIN` on non-`CLOSED` cases. Accepts JSON or `multipart/form-data`:
     - `isCleared` (`boolean`), `restrictions` (`string?`), `reEvalDate` (`string?`), optional `file` (`File?`).
     - Resolves signer display name (`Dr. <fullName>` or Admin `fullName`).
     - Upserts `FitToFlyClearance` (`isCleared`, `clearedBy`, `clearanceDate: isCleared ? new Date() : null`, `restrictions`, `reEvalDate`).
     - When `isCleared === true`: calls `issueCaseDocument` (`category: 'FIT_TO_FLY_CERTIFICATE'`) using uploaded `file` or auto-generated Fit-to-Fly PDF certificate, marks `SIGN_FIT_TO_FLY` pathway steps `COMPLETED` (`decisionBranch: 'FIT_TO_FLY_GRANTED'`), and updates `Case.status` to `'FIT_TO_FLY_CLEARED'` (unless status is `'REMOTE_REHAB'` or `'CLOSED'`).
     - Writes `SIGN_FIT_TO_FLY` to `AuditLog`.
2. **Appointment Helpers & Lifecycle Updates:**
   - Add `formatDoctorDisplayName(fullName: string): string` in `src/lib/validation/booking-helpers.ts` (returns `fullName` unchanged if it already starts with `/^dr\.?\s+/i`, otherwise prefixes `'Dr. '`).
   - `src/app/api/v1/patient/appointments/route.ts`:
     - Restrict `POST` `appointmentType` to `['CONSULTATION', 'PRE_OP_ASSESSMENT', 'POST_OP_REVIEW']` (`400 BAD_REQUEST` if `'SURGERY'` is submitted by a patient).
     - Validate `scheduledAt` parses as a valid future/valid `Date` and, if `doctor.availableDays` is a non-empty array, verify the UTC/local weekday (`SUN`..`SAT`) is in `availableDays` (`400` otherwise).
     - Add `PUT` allowing a `PATIENT` to cancel their own `SCHEDULED` / `CONFIRMED` / `RESCHEDULED` appointment (`appointmentId`, `cancellationReason` min 3 chars -> `status: 'CANCELLED'`).
   - `src/app/(patient)/patient/appointments/page.tsx`: Remove `'SURGERY'` from `APPOINTMENT_TYPE_OPTIONS`, use `formatDoctorDisplayName`, and add a `"Cancel"` button + reason modal on upcoming non-cancelled appointments.
   - `src/app/api/v1/manager/appointments/route.ts` & `src/app/(manager)/manager/appointments/page.tsx` & `src/app/(admin)/admin/appointments/page.tsx`:
     - Exempt `ADMIN` from `appointmentRecord.case.managerId !== userId` in `PUT /api/v1/manager/appointments` and accept `clinicalNotes` updates.
     - Fix `/admin/appointments` drawer to read `selectedAppt.clinicalNotes` (instead of non-existent `selectedAppt.notes`), support status transitions (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`) in both `/admin/appointments` and `/manager/appointments`, and display `clinicalNotes`.

---

## 4. Verification & Test Plan

1. **`src/lib/services/__tests__/clinical-pathway.service.test.ts`:**
   - Multi-role authorization matrix (`ADMIN`, assigned vs. unassigned `MANAGER`, treating vs. non-treating `DOCTOR`, owning vs. other `PATIENT`).
   - `replaceCasePathway` persists `actionType`, `requiredRole`, and `actionUrl`, rejects `CLOSED` cases, and logs `CONFIGURE_PATHWAY`.
   - `updateSinglePathwayStep` enforces `DOCTOR` vs `MANAGER` `requiredRole` boundaries and sets `completedAt`.
2. **`src/lib/services/__tests__/clinical-certificate.service.test.ts`:**
   - `generateClinicalCertificatePdf` produces a valid `%PDF-1.4` buffer accepted by `validateUploadBuffer`.
   - `verifyPatientDocument` enforces assigned-manager check, requires `verificationNotes` on `REJECTED`, and blocks mutating `ISSUED_BY_HOSPITAL` rows.
   - `issueCaseDocument` enforces role-to-category rules, auto-generates PDF when no file is supplied, and auto-completes `ISSUE_VIL` steps.
   - `FitToFlyClearance` signing (`isCleared: true`) upserts clearance, generates `FIT_TO_FLY_CERTIFICATE`, completes `SIGN_FIT_TO_FLY` step, and transitions case status to `FIT_TO_FLY_CLEARED`.
3. **`src/lib/__tests__/doctor-and-appointments.test.ts`:**
   - `formatDoctorDisplayName` idempotency (`"Dr. Ashok Seth"` -> `"Dr. Ashok Seth"`, `"Priya Nair"` -> `"Dr. Priya Nair"`).
   - `/api/v1/admin/doctors` inline `DOCTOR` account creation (`createAccount: true`) + conflict checks.
   - `/api/v1/patient/appointments` blocks `'SURGERY'` self-booking, enforces `availableDays`, and allows patient self-cancellation.
   - `rbac.ts` `DOCTOR` permissions check.
4. **Full Build & Quality Gates:** `npm test`, `npm run typecheck` (`next typegen && tsc --noEmit`), `npm run lint` (`0` errors), and `npm run build` (`next build`).

