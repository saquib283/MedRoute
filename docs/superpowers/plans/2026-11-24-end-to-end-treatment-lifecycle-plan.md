# End-to-End International Treatment Lifecycle Re-Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-implement MedRoute's end-to-end international medical tourism workflow and role UIs—from progressive patient onboarding, asynchronous specialist review, structured treatment quote & consent, MHA/FRRO-compliant Visa Invitation Letters (`MED` + `MED-X` attendants), arrival & 24-hour Form C compliance, teleconsultation/on-site scheduling, discharge summary & step-down recovery hotel coordination, through IATA MEDIF Fit-to-Fly clearance and Day-7/30/90 remote continuum follow-ups.

**Architecture:** Extend the Prisma MySQL/TiDB schema with explicit `Case` clinical team links (`hospitalId`, `primaryDoctorId`), typed lifecycle JSON documents (`treatmentPlan`, `travelLogistics`, `postReturnFollowUps`), `AppointmentMode` (`TELECONSULTATION` / `IN_PERSON`), `DISCHARGE_SUMMARY`, and structured IATA MEDIF `FitToFlyClearance` fields. Centralize state transitions, 7-stage pathway seeding, and compliance guardrails in `src/lib/services/case-lifecycle.service.ts` exposed via `/api/v1/cases/[id]/lifecycle`, then unify the Patient, Coordinator (`MANAGER`), Specialist (`DOCTOR`), and `ADMIN` portals around stage-aware next-action cards and a single 5-tab Case Command Workspace.

**Tech Stack:** Next.js 16.2.9 (App Router, Turbopack, TypeScript), React 19, Tailwind CSS v4 (`@theme` clinical design tokens), Prisma 6.19 (TiDB/MySQL), Zod, AES-256-GCM ePHI encryption, Jest 30.

**Spec:** `docs/superpowers/specs/2026-11-24-end-to-end-treatment-lifecycle-audit-and-design.md`

## Global Constraints

- **Next.js 16 Conventions:** Dynamic route `params` in pages and route handlers are `Promise<{ id: string }>` (`await params` in route handlers, `use(params)` in client pages). Never add custom named exports to `src/app/**/layout.tsx`.
- **Institutional Clinical Design System:** Strictly preserve the refined design tokens in `src/app/globals.css`: `rounded-lg` (`8px`) on cards/modals, `rounded-md` (`6px`) on buttons/inputs/selects/tabs/badges, `font-semibold` (`600`) for headings/KPIs, `font-medium` (`500`) for labels/controls, `font-normal` (`400`) for body text, `tabular-nums` for dates/amounts/counters, `min-h-11` (`44px`) interactive touch targets, and `0` occurrences of `rounded-3xl`, `rounded-2xl`, `font-black`, `font-extrabold`, `backdrop-blur`, `hover:-translate-y`, or `bg-gradient-to-`.
- **React 19 Lint Rules:** Schedule initial `useEffect` async loaders via `const timer = setTimeout(() => { void loadFn(); }, 0); return () => clearTimeout(timer);` so `react-hooks/set-state-in-effect` remains at `0` warnings/errors.
- **ePHI Encryption:** Encrypt `Patient.passportNo` and every `travelLogistics.attendants[i].passportNo` at rest with `encrypt()` from `src/lib/auth/crypto.ts`; decrypt only inside authorized server services (`decrypt()`), masking for unauthorized viewers and revealing full passport numbers only on official `VISA_INVITATION_LETTER` / `FRRO_REGISTRATION` / `FIT_TO_FLY_CERTIFICATE` PDFs and authorized compliance views.
- **Windows PowerShell Chaining:** Chain shell commands using `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }` (PowerShell 5.1 rejects `&&`).

---

## File Structure

### Created Files
- `prisma/migrations/20261124130000_treatment_lifecycle_v2/migration.sql` — Additive SQL migration adding `Case` clinical/lifecycle columns, `Patient.passport_expiry`, `Appointment` teleconsultation columns, `DISCHARGE_SUMMARY` enum value, and `FitToFlyClearance` IATA MEDIF columns.
- `src/lib/validation/lifecycle-schemas.ts` — Zod schemas & TypeScript types for `TreatmentPlanPayload`, `TravelLogisticsPayload`, `MedicalAttendantInput`, `FitToFlyChecklistPayload`, `FollowUpMilestone`, and `LifecycleMutationInput`.
- `src/lib/services/case-lifecycle.service.ts` — Clean 7-stage MVT pathway builder (`buildStandardMvtPathwaySteps`), stage-gate validator (`validateCaseStatusTransition`), `PatientNextAction` derivation (`derivePatientNextActions`), and role-scoped lifecycle mutations (`assignCaseClinicalTeam`, `publishCaseTreatmentPlan`, `acceptCaseTreatmentPlan`, `updateCaseTravelLogistics`, `submitCaseFollowUpCheckIn`).
- `src/app/api/v1/cases/[id]/lifecycle/route.ts` — `GET` & `PUT` endpoint exposing unified case lifecycle state (decrypted/masked appropriately per viewer role) and executing audited lifecycle mutations.
- `src/components/clinical/PatientNextActionCard.tsx` — Dynamic stage-aware card for `/patient/dashboard` rendering the patient's immediate next clinical/legal task, inline Treatment Plan & Cost Estimate consent modal, and Day-7/30/90 recovery check-in form.
- `src/components/clinical/VisaAndTravelConciergeCard.tsx` — Patient & Coordinator travel/compliance module for passport expiry validation (`>= 6 months`), up to 2 `MED-X` medical attendants, inbound/outbound flight details, airport pickup request, and 24-hour Form C / FRRO status.
- `src/components/clinical/CaseCommandWorkspace.tsx` — Shared 5-tab Coordinator (`MANAGER`) & `ADMIN` single-case workspace (`Triage & Specialist`, `Treatment Plan & Quote`, `Visa, FRRO & Travel`, `Pathway & Hotel Stay`, `Discharge, Billing & Follow-Up`).
- `src/app/(manager)/manager/cases/[id]/page.tsx` — Manager Case Command Workspace page delegating flush inside `max-w-6xl` to `CaseCommandWorkspace`.
- `src/app/(admin)/admin/cases/[id]/page.tsx` — Admin Case Command Workspace page delegating flush inside `max-w-6xl` to `CaseCommandWorkspace`.
- `src/lib/services/__tests__/case-lifecycle.service.test.ts` — Unit tests covering 7-stage clean pathway seeding, stage-gate rules, treatment plan consent, `MED-X` attendant passport encryption, Form C 24-hour tracking, and Day-7/30/90 check-ins.

### Modified Files
- `prisma/schema.prisma` — Add new enums/fields on `DocumentCategory`, `AppointmentMode`, `Patient`, `Hospital`, `Doctor`, `Case`, `Appointment`, and `FitToFlyClearance`.
- `src/lib/constants.ts` — Add `DISCHARGE_SUMMARY` to `DOCUMENT_CATEGORIES` & `DOCUMENT_CATEGORY_LABELS`, `APPOINTMENT_MODES`, `SSR_ASSISTANCE_CODES`, and `FOLLOW_UP_MILESTONES`.
- `src/lib/validation/schemas.ts` — Add optional `passportExpiry` to `registerSchema` and `patientProfileSchema`, and `mode`, `meetingUrl`, `interpreterLanguage` to `bookAppointmentSchema`.
- `src/lib/validation/document-vault-helpers.ts` — Map `DISCHARGE_SUMMARY` under `HOSPITAL_OFFICIAL` filter group.
- `src/lib/services/onboarding.service.ts` — Persist `passportExpiry` and auto-seed the clean 7-stage MVT pathway inside `onboardPatient()` and `createCaseForPatient()`.
- `src/lib/services/clinical-pathway.service.ts` — Normalize `PRESET_TEMPLATES` via a helper so templates initialize clean `IN_PROGRESS`/`PENDING` statuses (never pre-completed fake notes), and allow `DOCTOR` access in `authorizeCaseClinicalAccess()` when `targetCase.primaryDoctorId === doctor.id`.
- `src/lib/services/clinical-certificate.service.ts` — Add `DISCHARGE_SUMMARY` to `DOCTOR_ISSUE_CATEGORIES` and `ALL_ISSUE_CATEGORIES`; enrich generated VIL PDFs (hospital accreditation, decrypted patient passport + expiry, `MED-X` attendants, doctor, procedure, stay window), Discharge Summary PDFs, and IATA MEDIF Fit-to-Fly PDFs (`checklist`, `ssrCode`, `requiresMedif`, `flightNumber`, `departureDate`).
- `src/app/api/v1/patient/cases/route.ts` — Fix `clinicalSteps` order to `[{ stageOrder: 'asc' }, { stepOrder: 'asc' }, { createdAt: 'asc' }]` and include `hospital`, `primaryDoctor`, `treatmentPlan`, `travelLogistics` (with masked/decrypted own-patient fields), and `postReturnFollowUps`.
- `src/app/api/v1/doctor/dashboard/route.ts` & `src/app/api/v1/doctor/patients/route.ts` — Include cases where `primaryDoctorId === doctor.id` alongside appointment-linked cases so specialists see pre-travel inquiries immediately.
- `src/app/api/v1/patient/appointments/route.ts` & `src/app/api/v1/manager/appointments/route.ts` — Persist and return `mode`, `meetingUrl`, and `interpreterLanguage`.
- `src/app/(auth)/register/page.tsx` — Convert the 9-field single wall into a clean 2-step progressive registration form (`Step 1: Account & Contact`, `Step 2: Passport, Expiry & Clinical Need`).
- `src/components/clinical/ClinicalRoadmapTree.tsx` — Gate download buttons on actual issued documents / `COMPLETED` status, wire all `12` `actionType`s (`ISSUE_PROFORMA` -> plan drawer, `ARRANGE_LOGISTICS` -> travel concierge, `SCHEDULE_TELE_REHAB` -> follow-up check-in), and show clear owner badges (`Waiting on Hospital` vs `Your Action`).
- `src/app/(patient)/patient/dashboard/page.tsx` — Replace static `"Recommended Next Steps"` with `PatientNextActionCard`.
- `src/app/(patient)/patient/documents/page.tsx` — Add top **Rejected Document Alert**, embed `VisaAndTravelConciergeCard`, and switch checklist between `Pre-Travel & Visa` and `Discharge & Return Flight` phases.
- `src/app/(patient)/patient/appointments/page.tsx`, `src/app/(manager)/manager/appointments/page.tsx`, `src/app/(doctor)/doctor/appointments/page.tsx` — Add `TELECONSULTATION` / `IN_PERSON` selector, `Join Video Consultation` link, dual `IST (UTC+5:30)` + local time display, and interpreter language badge.
- `src/app/(manager)/manager/cases/page.tsx` & `src/app/(admin)/admin/cases/page.tsx` — Link directly to `/manager/cases/[id]` and `/admin/cases/[id]` `CaseCommandWorkspace`, enforcing `validateCaseStatusTransition` on quick status updates.
- `src/app/(doctor)/doctor/dashboard/page.tsx` & `src/app/(doctor)/doctor/cases/[id]/page.tsx` — Surface pre-travel file review queue, structured MDT / Pre-Travel Opinion publisher, `DISCHARGE_SUMMARY` issuer, and IATA MEDIF + SSR Fit-to-Fly safety checklist.
- `prisma/seed.ts` — Seed complete end-to-end MVT lifecycle data (hospital & primary doctor on case, published & accepted treatment plan, `MED-X` attendant, flight arrival & 24h Form C record, teleconsultation link, and structured IATA Fit-to-Fly checklist).

---

### Task 1: Lifecycle Schema, Clean 7-Stage Pathway Engine & Pre-Travel Doctor Access

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261124130000_treatment_lifecycle_v2/migration.sql`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/validation/schemas.ts`
- Modify: `src/lib/validation/document-vault-helpers.ts`
- Create: `src/lib/validation/lifecycle-schemas.ts`
- Create: `src/lib/services/case-lifecycle.service.ts`
- Modify: `src/lib/services/onboarding.service.ts`
- Modify: `src/lib/services/clinical-pathway.service.ts`
- Modify: `src/app/api/v1/patient/cases/route.ts`
- Test: `src/lib/services/__tests__/case-lifecycle.service.test.ts`

**Interfaces:**
- Produces:
  - `TreatmentPlanPayload`, `TravelLogisticsPayload`, `MedicalAttendantRecord`, `FitToFlyChecklistPayload`, `FollowUpMilestone` in `src/lib/validation/lifecycle-schemas.ts`
  - `buildStandardMvtPathwaySteps(specialtyId?: string): PresetStageStep[]` in `src/lib/services/case-lifecycle.service.ts`
  - `validateCaseStatusTransition(params: { currentStatus: string; nextStatus: string; hasVerifiedPassport: boolean; hasClearedFitToFly: boolean; unpaidBillCount: number; overrideReason?: string | null }): { ok: true } | { ok: false; message: string }` in `src/lib/services/case-lifecycle.service.ts`
  - `derivePatientNextActions(input: PatientNextActionContext): PatientNextActionItem[]` in `src/lib/services/case-lifecycle.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/case-lifecycle.service.test.ts`:

```typescript
import {
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  derivePatientNextActions,
} from '@/lib/services/case-lifecycle.service';
import { PRESET_TEMPLATES } from '@/lib/services/clinical-pathway.service';

describe('Case Lifecycle Engine & Stage Guardrails', () => {
  test('buildStandardMvtPathwaySteps seeds 7 sequential stages with Stage 1 Step 1 IN_PROGRESS and remaining PENDING', () => {
    const steps = buildStandardMvtPathwaySteps('CARDIOLOGY');
    expect(steps.length).toBeGreaterThanOrEqual(10);
    const stageOrders = Array.from(new Set(steps.map((s) => s.stageOrder)));
    expect(stageOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps[0].status).toBe('IN_PROGRESS');
    expect(steps.slice(1).every((s) => s.status === 'PENDING')).toBe(true);
    expect(steps.every((s) => !s.doctorNotes)).toBe(true);
  });

  test('PRESET_TEMPLATES do not hardcode COMPLETED status on unexecuted clinical steps', () => {
    for (const tpl of PRESET_TEMPLATES) {
      expect(tpl.steps[0].status).toBe('IN_PROGRESS');
      expect(tpl.steps.slice(1).every((s) => s.status === 'PENDING')).toBe(true);
    }
  });

  test('validateCaseStatusTransition blocks jumping to FIT_TO_FLY_CLEARED without signed Fit-to-Fly clearance', () => {
    const blocked = validateCaseStatusTransition({
      currentStatus: 'WARD_RECOVERY',
      nextStatus: 'FIT_TO_FLY_CLEARED',
      hasVerifiedPassport: true,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
    });
    expect(blocked.ok).toBe(false);
  });

  test('validateCaseStatusTransition blocks CLOSED when unpaid bills exist without explicit overrideReason', () => {
    const blocked = validateCaseStatusTransition({
      currentStatus: 'FIT_TO_FLY_CLEARED',
      nextStatus: 'CLOSED',
      hasVerifiedPassport: true,
      hasClearedFitToFly: true,
      unpaidBillCount: 1,
    });
    expect(blocked.ok).toBe(false);

    const allowedWithOverride = validateCaseStatusTransition({
      currentStatus: 'INQUIRY_RECEIVED',
      nextStatus: 'CLOSED',
      hasVerifiedPassport: false,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
      overrideReason: 'Patient elected local care in home country',
    });
    expect(allowedWithOverride.ok).toBe(true);
  });

  test('derivePatientNextActions prioritizes rejected documents, unaccepted treatment plan, and missing flight details by phase', () => {
    const actions = derivePatientNextActions({
      caseStatus: 'UNDER_REVIEW',
      documents: [
        { category: 'PASSPORT', verificationStatus: 'REJECTED', verificationNotes: 'Blurry MRZ line' },
      ],
      treatmentPlan: {
        diagnosis: 'CAD',
        procedureName: 'PCI Stent',
        hospitalLosDays: 3,
        recoveryStayDays: 5,
        estimatedCostUsd: 4850,
        currency: 'USD',
        publishedAt: '2026-11-24T00:00:00.000Z',
        consentAcceptedAt: null,
      },
      travelLogistics: null,
      unpaidBillCount: 0,
      postReturnFollowUps: [],
    });

    expect(actions[0].key).toBe('REUPLOAD_REJECTED_DOC');
    expect(actions.some((a) => a.key === 'ACCEPT_TREATMENT_PLAN')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/case-lifecycle.service.test.ts`
Expected: FAIL with `Cannot find module '@/lib/services/case-lifecycle.service'`.

- [ ] **Step 3: Write minimal implementation**

1. Update `prisma/schema.prisma`:
   - Add `DISCHARGE_SUMMARY` to `enum DocumentCategory`.
   - Add `enum AppointmentMode { TELECONSULTATION IN_PERSON }`.
   - On `Patient`: add `passportExpiry DateTime? @map("passport_expiry")`.
   - On `Hospital`: add `cases Case[]`.
   - On `Doctor`: add `primaryCases Case[] @relation("PrimaryDoctorCases")`.
   - On `Case`:
     ```prisma
     hospitalId          String?   @map("hospital_id")
     primaryDoctorId     String?   @map("primary_doctor_id")
     treatmentPlan       Json?     @map("treatment_plan")
     travelLogistics     Json?     @map("travel_logistics")
     postReturnFollowUps Json?     @map("post_return_follow_ups")

     hospital            Hospital? @relation(fields: [hospitalId], references: [id])
     primaryDoctor       Doctor?   @relation("PrimaryDoctorCases", fields: [primaryDoctorId], references: [id])
     ```
   - On `Appointment`:
     ```prisma
     mode                AppointmentMode @default(IN_PERSON)
     meetingUrl          String?         @map("meeting_url")
     interpreterLanguage String?         @map("interpreter_language")
     ```
   - On `FitToFlyClearance`:
     ```prisma
     checklist     Json?
     ssrCode       String?   @default("NONE") @map("ssr_code")
     requiresMedif Boolean   @default(false) @map("requires_medif")
     flightNumber  String?   @map("flight_number")
     departureDate DateTime? @map("departure_date")
     ```
2. Create `prisma/migrations/20261124130000_treatment_lifecycle_v2/migration.sql` with the exact MySQL/TiDB `ALTER TABLE` statements (`MODIFY COLUMN category ENUM(..., 'DISCHARGE_SUMMARY')`, `ALTER TABLE patients ADD COLUMN passport_expiry DATETIME(3) NULL`, `ALTER TABLE cases ADD COLUMN hospital_id VARCHAR(191) NULL, ADD COLUMN primary_doctor_id VARCHAR(191) NULL, ADD COLUMN treatment_plan JSON NULL, ADD COLUMN travel_logistics JSON NULL, ADD COLUMN post_return_follow_ups JSON NULL`, `ALTER TABLE appointments ADD COLUMN mode ENUM('TELECONSULTATION', 'IN_PERSON') NOT NULL DEFAULT 'IN_PERSON', ADD COLUMN meeting_url VARCHAR(500) NULL, ADD COLUMN interpreter_language VARCHAR(100) NULL`, `ALTER TABLE fit_to_fly_clearances ADD COLUMN checklist JSON NULL, ADD COLUMN ssr_code VARCHAR(32) NULL DEFAULT 'NONE', ADD COLUMN requires_medif BOOLEAN NOT NULL DEFAULT false, ADD COLUMN flight_number VARCHAR(64) NULL, ADD COLUMN departure_date DATETIME(3) NULL`), apply via `npx prisma migrate deploy`, and regenerate Prisma Client via `npx prisma generate`.
3. Update `src/lib/constants.ts`, `src/lib/validation/schemas.ts`, and `src/lib/validation/document-vault-helpers.ts` with `DISCHARGE_SUMMARY`, `APPOINTMENT_MODES`, `SSR_ASSISTANCE_CODES` (`NONE`, `WCHR`, `WCHS`, `WCHC`, `MEDA`), and `FOLLOW_UP_MILESTONES` (`DAY_7`, `DAY_30`, `DAY_90`).
4. Create `src/lib/validation/lifecycle-schemas.ts` and `src/lib/services/case-lifecycle.service.ts` implementing `buildStandardMvtPathwaySteps`, `validateCaseStatusTransition`, and `derivePatientNextActions`.
5. Update `src/lib/services/onboarding.service.ts` (`onboardPatient` and `createCaseForPatient`) to insert `buildStandardMvtPathwaySteps()` into `tx.clinicalStep.createMany(...)` so every new case starts with a clean 7-stage pathway.
6. Update `src/lib/services/clinical-pathway.service.ts`:
   - Set `PRESET_TEMPLATES` step 1 to `IN_PROGRESS` and subsequent steps to `PENDING` (with empty `doctorNotes`).
   - In `authorizeCaseClinicalAccess`, allow `DOCTOR` access when `authCase.primaryDoctorId === doctor.id` OR an active appointment exists.
7. Update `src/app/api/v1/patient/cases/route.ts` to order `clinicalSteps` by `[{ stageOrder: 'asc' }, { stepOrder: 'asc' }, { createdAt: 'asc' }]` and include `hospital` and `primaryDoctor`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/__tests__/case-lifecycle.service.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test`
Expected: PASS (all existing + new lifecycle unit tests pass).

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations src/lib src/app/api/v1/patient/cases/route.ts
git commit -m "feat(lifecycle): add MVT schema extensions, 7-stage pathway seeding, and stage guardrails"
```

---

### Task 2: MHA-Compliant VIL (`MED-X`), Discharge Summary, IATA MEDIF PDF & `/api/v1/cases/[id]/lifecycle`

**Files:**
- Modify: `src/lib/services/clinical-certificate.service.ts`
- Modify: `src/lib/services/case-lifecycle.service.ts`
- Create: `src/app/api/v1/cases/[id]/lifecycle/route.ts`
- Modify: `src/app/api/v1/cases/[id]/fit-to-fly/route.ts`
- Test: `src/lib/services/__tests__/clinical-certificate.service.test.ts`

**Interfaces:**
- Consumes: `TreatmentPlanPayload`, `TravelLogisticsPayload`, `FitToFlyChecklistPayload` from `src/lib/validation/lifecycle-schemas.ts`
- Produces:
  - `GET /api/v1/cases/[id]/lifecycle` -> `{ case, hospital, primaryDoctor, treatmentPlan, travelLogistics, postReturnFollowUps, nextActions }`
  - `PUT /api/v1/cases/[id]/lifecycle` -> discriminated `action`:
    - `'ASSIGN_CLINICAL_TEAM'` (`MANAGER` | `ADMIN`)
    - `'PUBLISH_TREATMENT_PLAN'` (`MANAGER` | `DOCTOR` | `ADMIN`)
    - `'ACCEPT_TREATMENT_PLAN'` (`PATIENT`)
    - `'UPDATE_TRAVEL_LOGISTICS'` (`PATIENT` | `MANAGER` | `ADMIN`)
    - `'RECORD_FORM_C'` (`MANAGER` | `ADMIN`)
    - `'SUBMIT_FOLLOW_UP'` (`PATIENT` | `DOCTOR`)

- [ ] **Step 1: Write the failing test**

Add tests in `src/lib/services/__tests__/clinical-certificate.service.test.ts` verifying:
1. Issuing `VISA_INVITATION_LETTER` embeds the Hospital name/accreditation, decrypted Patient Passport No + Expiry, `MED-X` attendant names & decrypted passport numbers, Treating Specialist name, and Proposed Procedure in the generated PDF stream.
2. Issuing `DISCHARGE_SUMMARY` by `DOCTOR` succeeds and generates an official PDF with medication/wound-care/red-flag instructions.
3. `upsertCaseFitToFly` persists `checklist`, `ssrCode` (`WCHR`), `requiresMedif`, `flightNumber`, and `departureDate`, and initializes `DAY_7`, `DAY_30`, and `DAY_90` `postReturnFollowUps` milestones on the `Case` when cleared.
4. `updateCaseTravelLogistics` encrypts `attendants[i].passportNo` at rest and enforces max 2 `MED-X` attendants per Indian MHA rules.

```typescript
test('VISA_INVITATION_LETTER PDF includes decrypted patient passport, hospital accreditation, and MED-X attendants', () => {
  const pdf = generateClinicalCertificatePdf({
    title: 'Visa Invitation Letter (VIL)',
    category: 'VISA_INVITATION_LETTER',
    patientName: 'Ranya Al-Hassan',
    nationality: 'UAE',
    caseId: 'case-1',
    issuedByName: 'Priya Sharma',
    issuedByRole: 'Case Manager',
    bodyLines: [
      'Hospital: Fortis Escorts Heart Institute (NABH, JCI)',
      'Patient Passport No: A12345678 | Expiry: 2030-05-15',
      'MED-X Attendant 1: Ahmed Al-Hassan | Passport: U99887766 | Relation: Husband',
      'Proposed Procedure: Percutaneous Coronary Intervention (PCI)',
    ],
  });
  const text = pdf.toString('ascii');
  expect(text).toContain('Patient Passport No: A12345678');
  expect(text).toContain('MED-X Attendant 1: Ahmed Al-Hassan');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/clinical-certificate.service.test.ts`
Expected: FAIL on `DISCHARGE_SUMMARY` issuance, VIL passport/attendant enrichment, and MEDIF `checklist`/`ssrCode` persistence.

- [ ] **Step 3: Write minimal implementation**

1. Update `src/lib/services/clinical-certificate.service.ts`:
   - Add `'DISCHARGE_SUMMARY'` to `DOCTOR_ISSUE_CATEGORIES` and `ALL_ISSUE_CATEGORIES`.
   - Map `DISCHARGE_SUMMARY` -> `'OPERATIVE_SUMMARY'` / `'DISCHARGE_SUMMARY'` step completion if matching `ClinicalStep` exists.
   - In `issueCaseDocument()`, load `hospital`, `primaryDoctor`, `treatmentPlan`, `travelLogistics`, and `patient.passportNo` / `patient.passportExpiry`. When `category === 'VISA_INVITATION_LETTER'` or `'FRRO_REGISTRATION'`, decrypt `patient.passportNo` and any `travelLogistics.attendants[].passportNo` to populate complete MHA/FRRO-compliant body lines on the generated PDF.
   - Extend `upsertFitToFlySchema` and `upsertCaseFitToFly()` (plus `PUT /api/v1/cases/[id]/fit-to-fly`) to validate & save `checklist`, `ssrCode`, `requiresMedif`, `flightNumber`, and `departureDate`, embed them in the `FIT_TO_FLY_CERTIFICATE` PDF, and seed `[DAY_7, DAY_30, DAY_90]` `postReturnFollowUps` if not yet initialized.
2. Implement `assignCaseClinicalTeam`, `publishCaseTreatmentPlan`, `acceptCaseTreatmentPlan`, `updateCaseTravelLogistics`, `recordCaseFormC`, and `submitCaseFollowUpCheckIn` in `src/lib/services/case-lifecycle.service.ts` with full `AuditLog` + `Notification` dispatch.
3. Create `src/app/api/v1/cases/[id]/lifecycle/route.ts` (`GET` and `PUT`) enforcing `authorizeCaseClinicalAccess` and role permissions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/__tests__/clinical-certificate.service.test.ts src/lib/services/__tests__/case-lifecycle.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/services/clinical-certificate.service.ts src/lib/services/case-lifecycle.service.ts src/app/api/v1/cases src/lib/services/__tests__
git commit -m "feat(compliance): add MHA VIL with MED-X attendants, discharge summary, IATA MEDIF, and lifecycle API"
```

---

### Task 3: Progressive Patient Onboarding & Dynamic Stage-Aware Care Hub

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`
- Create: `src/components/clinical/PatientNextActionCard.tsx`
- Modify: `src/components/clinical/ClinicalRoadmapTree.tsx`
- Modify: `src/app/(patient)/patient/dashboard/page.tsx`
- Test: `src/lib/__tests__/patient-next-actions-and-roadmap.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/cases/[id]/lifecycle`, `PUT /api/v1/cases/[id]/lifecycle`, `derivePatientNextActions`
- Produces:
  - `<PatientNextActionCard caseId={...} caseStatus={...} treatmentPlan={...} postReturnFollowUps={...} documents={...} travelLogistics={...} unpaidBillCount={...} onUpdated={...} />`
  - Updated `<ClinicalRoadmapTree steps={...} fitToFly={...} currentStatus={...} issuedDocCategories={...} onOpenAction={...} />`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/patient-next-actions-and-roadmap.test.ts` testing:
1. `canShowRoadmapCertificateDownload(step, issuedDocCategories)` returns `false` when `ISSUE_VIL` or `SIGN_FIT_TO_FLY` is `PENDING` and no corresponding document exists, and `true` once issued.
2. `derivePatientNextActions` transitions smoothly across all 7 stages:
   - `INQUIRY_RECEIVED` with 0 medical reports -> `UPLOAD_DIAGNOSTICS`
   - `UNDER_REVIEW` with published unaccepted `treatmentPlan` -> `ACCEPT_TREATMENT_PLAN`
   - `PLAN_CONFIRMED` with issued VIL and no `VISA` upload -> `UPLOAD_APPROVED_VISA` & `SUBMIT_FLIGHT_DETAILS`
   - `FIT_TO_FLY_CLEARED` / `REMOTE_REHAB` with `PENDING` `DAY_7` milestone -> `COMPLETE_FOLLOW_UP_CHECKIN`.

```typescript
import {
  canShowRoadmapCertificateDownload,
  derivePatientNextActions,
} from '@/lib/services/case-lifecycle.service';

describe('Patient Roadmap Certificate & Next-Action Gating', () => {
  test('hides Download Visa Letter button until VISA_INVITATION_LETTER is actually issued', () => {
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'PENDING' },
        new Set(['PASSPORT'])
      )
    ).toBe(false);

    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        new Set(['PASSPORT', 'VISA_INVITATION_LETTER'])
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/patient-next-actions-and-roadmap.test.ts`
Expected: FAIL (`canShowRoadmapCertificateDownload is not a function`).

- [ ] **Step 3: Write minimal implementation**

1. Export `canShowRoadmapCertificateDownload` from `src/lib/services/case-lifecycle.service.ts` (or a client-safe pure helper `src/lib/validation/lifecycle-schemas.ts` imported by both server & client components — keep pure functions in `src/lib/validation/lifecycle-schemas.ts` so `'use client'` components never import `prisma`!).
2. Refactor `src/app/(auth)/register/page.tsx` into a clean 2-step progressive form with step indicator (`1. Account & Contact` -> `2. Passport, Expiry (>= 6 months) & Medical Inquiry`), validating Step 1 fields before advancing to Step 2 and preserving direct 1-screen clarity on mobile (`375px`).
3. Create `src/components/clinical/PatientNextActionCard.tsx`:
   - Displays the top 1–3 dynamic required actions for the patient's exact stage (`rounded-lg`, `font-semibold`/`font-medium`, `min-h-11` CTAs).
   - Includes a native `<Modal>` (`<dialog>`) for **Review & Accept Hospital Treatment Plan & Cost Estimate** (showing Hospital, Specialist, Diagnosis, Procedure, Hospital LOS + Hotel Recovery nights, All-In Estimate USD, Inclusions/Exclusions, and informed consent checkbox + `Accept Treatment Plan` button calling `PUT /api/v1/cases/[id]/lifecycle` with `ACCEPT_TREATMENT_PLAN`).
   - Includes a native `<Modal>` for **Post-Return Recovery Check-In (`Day 7` / `Day 30` / `Day 90`)** (pain scale `0–10`, wound healing status select, recovery notes -> `SUBMIT_FOLLOW_UP`).
4. Update `src/components/clinical/ClinicalRoadmapTree.tsx`:
   - Show `"Waiting on Hospital"` pill instead of a broken `"Download Visa Letter"` button when `ISSUE_VIL` / `SIGN_FIT_TO_FLY` is not yet issued.
   - Wire `ISSUE_PROFORMA` (opens Treatment Plan modal or `/patient/billing` if bills exist), `ARRANGE_LOGISTICS` (links to `/patient/documents#travel-concierge`), and `SCHEDULE_TELE_REHAB` (opens Follow-Up Check-In modal or `/patient/appointments`).
5. Update `src/app/(patient)/patient/dashboard/page.tsx` to render `<PatientNextActionCard />` in place of the hardcoded static checklist, and display Assigned Hospital & Primary Attending Specialist alongside the Case Coordinator.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/patient-next-actions-and-roadmap.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx eslint "src/app/(auth)/register/page.tsx" "src/app/(patient)/patient/dashboard/page.tsx" "src/components/clinical/PatientNextActionCard.tsx" "src/components/clinical/ClinicalRoadmapTree.tsx"`
Expected: PASS with `0` ESLint errors/warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/app/\(auth\)/register/page.tsx src/components/clinical src/app/\(patient\)/patient/dashboard/page.tsx src/lib
git commit -m "feat(patient-ux): add 2-step progressive onboarding and stage-aware next-action care hub"
```

---

### Task 4: Phase-Adaptive Visa, `MED-X` Attendant & Travel Concierge Vault + Teleconsultation UX

**Files:**
- Create: `src/components/clinical/VisaAndTravelConciergeCard.tsx`
- Modify: `src/app/(patient)/patient/documents/page.tsx`
- Modify: `src/app/(patient)/patient/profile/page.tsx`
- Modify: `src/app/api/v1/patient/profile/route.ts`
- Modify: `src/app/api/v1/patient/appointments/route.ts`
- Modify: `src/app/api/v1/manager/appointments/route.ts`
- Modify: `src/app/(patient)/patient/appointments/page.tsx`
- Modify: `src/app/(manager)/manager/appointments/page.tsx`
- Modify: `src/app/(doctor)/doctor/appointments/page.tsx`
- Test: `src/lib/__tests__/document-vault-filters.test.ts`

**Interfaces:**
- Consumes: `PUT /api/v1/cases/[id]/lifecycle` (`UPDATE_TRAVEL_LOGISTICS`), `Appointment.mode`, `Appointment.meetingUrl`, `Appointment.interpreterLanguage`
- Produces:
  - `<VisaAndTravelConciergeCard caseId={...} passportExpiry={...} travelLogistics={...} role="PATIENT" | "STAFF" onSaved={...} />`

- [ ] **Step 1: Write the failing test**

Extend `src/lib/__tests__/document-vault-filters.test.ts` to test:
1. `DISCHARGE_SUMMARY` matches `HOSPITAL_OFFICIAL` and `ALL` filters.
2. Passport 6-month travel readiness helper `isPassportValidForMedicalVisa(passportExpiryIso, referenceDate)` returns `false` when expiry is `< 180` days from travel/reference date and `true` when `>= 180` days.
3. Dual timezone formatter `formatConsultationScheduleDualTz(isoDate)` renders both `IST (Hospital)` and viewer local time clearly.

```typescript
import {
  isPassportValidForMedicalVisa,
  formatConsultationScheduleDualTz,
} from '@/lib/validation/booking-helpers';

test('isPassportValidForMedicalVisa enforces 6-month (180-day) validity window', () => {
  const ref = new Date('2026-11-24T00:00:00Z');
  expect(isPassportValidForMedicalVisa('2027-02-01', ref)).toBe(false);
  expect(isPassportValidForMedicalVisa('2027-08-01', ref)).toBe(true);
});

test('formatConsultationScheduleDualTz includes IST label', () => {
  const formatted = formatConsultationScheduleDualTz('2026-12-01T09:00:00.000Z');
  expect(formatted.istLabel).toContain('IST');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/document-vault-filters.test.ts`
Expected: FAIL (`isPassportValidForMedicalVisa is not a function`).

- [ ] **Step 3: Write minimal implementation**

1. Add `isPassportValidForMedicalVisa` and `formatConsultationScheduleDualTz` (`Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', ... })`) to `src/lib/validation/booking-helpers.ts`.
2. Create `src/components/clinical/VisaAndTravelConciergeCard.tsx` (`id="travel-concierge"`):
   - Shows Passport 6-month validity status badge (editable `passportExpiry` in `/patient/profile` and inline here).
   - Allows adding up to **2 Medical Attendants (`MED-X` visa companions)** (Full Passport Name, Passport Number, Relationship).
   - Allows submitting **Inbound & Outbound Flight Details** (`arrivalAirline`, `arrivalFlightNo`, `arrivalAt`, `airportPickupRequired`, `wheelchairSsrCode`, `dietaryPreferences`), showing Coordinator `Pickup Confirmed` badge and `FRRO / Form C` compliance status once recorded.
3. Upgrade `src/app/(patient)/patient/documents/page.tsx`:
   - Surface a top `border-danger-200 bg-danger-50` **Rejected Document Action Banner** whenever any document has `verificationStatus === 'REJECTED'`, showing exact `verificationNotes` and a 1-click `Replace Document` button that pre-selects that category and focuses the upload dropzone.
   - Switch the checklist between **Pre-Travel & Medical Visa Checklist** (`PASSPORT`, `MEDICAL_REPORT`, `PROFORMA_INVOICE`, `VISA_INVITATION_LETTER`, `VISA`) and **Hospital Discharge & Return Travel Pack** (`DISCHARGE_SUMMARY`, `PRESCRIPTION`, `FIT_TO_FLY_CERTIFICATE`, `FRRO_REGISTRATION`) with a clean 2-tab toggle (auto-defaulting based on `Case.status`).
   - Render `<VisaAndTravelConciergeCard />`.
4. Update `src/app/api/v1/patient/appointments/route.ts`, `src/app/api/v1/manager/appointments/route.ts`, and the 3 appointment pages (`patient`, `manager`, `doctor`) to support `mode` (`TELECONSULTATION` vs `IN_PERSON`), `meetingUrl` (clickable `Join Video Consultation` button when `TELECONSULTATION`), `interpreterLanguage` badge, and dual `IST (Hospital Time)` display.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/document-vault-filters.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run lint`
Expected: PASS with `0` ESLint errors/warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/validation src/components/clinical/VisaAndTravelConciergeCard.tsx src/app/api/v1/patient src/app/api/v1/manager/appointments src/app/\(patient\) src/app/\(manager\)/manager/appointments src/app/\(doctor\)/doctor/appointments src/lib/__tests__/document-vault-filters.test.ts
git commit -m "feat(visa-telemed): add MED-X attendant & flight concierge vault and dual-timezone teleconsultations"
```

---

### Task 5: Unified Coordinator & Admin Case Command Workspace (`/manager/cases/[id]` & `/admin/cases/[id]`)

**Files:**
- Create: `src/components/clinical/CaseCommandWorkspace.tsx`
- Create: `src/app/(manager)/manager/cases/[id]/page.tsx`
- Create: `src/app/(admin)/admin/cases/[id]/page.tsx`
- Modify: `src/app/(manager)/manager/cases/page.tsx`
- Modify: `src/app/(admin)/admin/cases/page.tsx`
- Modify: `src/app/api/v1/manager/cases/route.ts`
- Modify: `src/app/api/v1/admin/cases/route.ts`
- Test: `src/lib/__tests__/case-status.test.ts`

**Interfaces:**
- Consumes: `GET/PUT /api/v1/cases/[id]/lifecycle`, `CaseDocumentsManagerPanel`, `VisaAndTravelConciergeCard`, `PathwayBuilderEditor`, `validateCaseStatusTransition`
- Produces:
  - `<CaseCommandWorkspace caseId={string} role="MANAGER" | "ADMIN" backHref={string} />`

- [ ] **Step 1: Write the failing test**

Extend `src/lib/__tests__/case-status.test.ts` to verify that `validateCaseStatusTransition` is enforced on case status updates:
- Rejects `FIT_TO_FLY_CLEARED` when `fitToFlyClearance?.isCleared !== true`.
- Rejects `CLOSED` when unpaid non-cancelled bills exist and no `escalationNote` / `overrideReason` is provided.
- Computes 24-hour statutory **Form C SLA state** (`computeFormCSlaStatus(arrivalAt, formCSubmittedAt)` -> `'NOT_ARRIVED' | 'SUBMITTED_ON_TIME' | 'DUE_WITHIN_24H' | 'OVERDUE_STATUTORY'`).

```typescript
import { computeFormCSlaStatus } from '@/lib/validation/lifecycle-schemas';

test('computeFormCSlaStatus flags OVERDUE_STATUTORY when >24h elapsed since arrival without Form C', () => {
  const arrival = new Date('2026-11-22T08:00:00Z').toISOString();
  const now = new Date('2026-11-24T10:00:00Z');
  expect(computeFormCSlaStatus(arrival, null, now)).toBe('OVERDUE_STATUTORY');
  expect(computeFormCSlaStatus(arrival, '2026-11-22T18:00:00Z', now)).toBe('SUBMITTED_ON_TIME');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/case-status.test.ts`
Expected: FAIL (`computeFormCSlaStatus is not a function`).

- [ ] **Step 3: Write minimal implementation**

1. Add `computeFormCSlaStatus` to `src/lib/validation/lifecycle-schemas.ts` and enforce `validateCaseStatusTransition` in `PUT /api/v1/manager/cases` and `PATCH /PUT /api/v1/admin/cases`.
2. Create `src/components/clinical/CaseCommandWorkspace.tsx` organizing the entire single-case Coordinator/Admin workflow into 5 clean horizontal tabs (`2px` underline indicator, `min-h-11` buttons, `rounded-lg` cards):
   - **Tab 1 — Triage & Specialist Assignment:** Assign Partner Hospital (`hospitalId`) + Primary Attending Doctor (`primaryDoctorId`), set Case Status (with guardrail hints), Urgency, and Escalation notes.
   - **Tab 2 — Treatment Plan & Cost Estimate:** Publish structured Diagnosis, Proposed Procedure, Hospital LOS days, Hotel Recovery days, All-In Cost Estimate (USD), Inclusions/Exclusions, view live `Patient Consent Accepted` timestamp, and quick-link to issue formal `MedicalBill`.
   - **Tab 3 — Visa (`VIL`), FRRO Form C & Travel Concierge:** View `MED-X` attendants & flight arrival details, toggle `Airport Pickup Confirmed`, record **Statutory Form C (<24h SLA badge)** + `frroNumber` + `visaExpiryDate`, and manage/verify documents via embedded `<CaseDocumentsManagerPanel canVerify />`.
   - **Tab 4 — Clinical Pathway & Recovery Stay:** Clean specialty preset selector + milestone orchestration + summary of linked `HotelBooking` vouchers for the patient.
   - **Tab 5 — Discharge, Fit-to-Fly & Remote Follow-Up:** Read/verify Hospital Bill settlement progress, Discharge Summary & Fit-to-Fly / MEDIF clearance status, and Day-7 / Day-30 / Day-90 recovery check-ins.
3. Create `src/app/(manager)/manager/cases/[id]/page.tsx` and `src/app/(admin)/admin/cases/[id]/page.tsx`, and add prominent `Open Case Workspace` primary buttons on `/manager/cases` and `/admin/cases`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/case-status.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run lint`
Expected: PASS with `0` ESLint errors/warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/validation/lifecycle-schemas.ts src/components/clinical/CaseCommandWorkspace.tsx src/app/\(manager\)/manager/cases src/app/\(admin\)/admin/cases src/app/api/v1/manager/cases src/app/api/v1/admin/cases src/lib/__tests__/case-status.test.ts
git commit -m "feat(coordinator-ux): add unified 5-tab Case Command Workspace and Form C 24h SLA tracking"
```

---

### Task 6: Specialist Doctor Pre-Travel Triage, Discharge Summary & IATA MEDIF Workspace + Seed & Verification

**Files:**
- Modify: `src/app/api/v1/doctor/dashboard/route.ts`
- Modify: `src/app/api/v1/doctor/patients/route.ts`
- Modify: `src/app/(doctor)/doctor/dashboard/page.tsx`
- Modify: `src/app/(doctor)/doctor/cases/[id]/page.tsx`
- Modify: `prisma/seed.ts`
- Test: `src/lib/__tests__/doctor-portal-routes.test.ts`

**Interfaces:**
- Consumes: `Case.primaryDoctorId`, `PUT /api/v1/cases/[id]/lifecycle`, `PUT /api/v1/cases/[id]/fit-to-fly` (`checklist`, `ssrCode`, `requiresMedif`, `flightNumber`, `departureDate`), `DISCHARGE_SUMMARY` document issuance

- [ ] **Step 1: Write the failing test**

Extend `src/lib/__tests__/doctor-portal-routes.test.ts` to verify:
1. A Doctor assigned via `Case.primaryDoctorId` (with **zero** `Appointment` rows yet) receives the `UNDER_REVIEW` case in `GET /api/v1/doctor/dashboard` (`pendingClinicalCases`) and can load `GET /api/v1/cases/[id]/pathway` + `PUT /api/v1/cases/[id]/fit-to-fly`.
2. Submitting the IATA MEDIF Fit-to-Fly checklist with `isCleared: true` and `woundStable: false` returns `400 BAD_REQUEST` (`All physiological safety criteria must be confirmed to certify Fit-to-Fly clearance`).

```typescript
import { validateFitToFlySafetyChecklist } from '@/lib/validation/lifecycle-schemas';

test('validateFitToFlySafetyChecklist blocks clearance if wound or trapped-gas check fails', () => {
  const unsafe = validateFitToFlySafetyChecklist(true, {
    woundStable: true,
    noTrappedGasRisk: false,
    cardioRespiratoryStable: true,
    hemoglobinCleared: true,
    dvtProphylaxisPlan: true,
  });
  expect(unsafe.ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/doctor-portal-routes.test.ts`
Expected: FAIL (`validateFitToFlySafetyChecklist is not a function`).

- [ ] **Step 3: Write minimal implementation**

1. Add `validateFitToFlySafetyChecklist` to `src/lib/validation/lifecycle-schemas.ts` and enforce it inside `upsertCaseFitToFly()` when `isCleared === true` and `checklist` is provided.
2. Update `src/app/api/v1/doctor/dashboard/route.ts` and `src/app/api/v1/doctor/patients/route.ts` so `OR: [{ primaryDoctorId: doctor.id }, { appointments: { some: { doctorId: doctor.id, status: { not: 'CANCELLED' } } } }]` powers both the Doctor Dashboard case queue and Patient Roster.
3. Update `src/app/(doctor)/doctor/dashboard/page.tsx` to badge `Pre-Travel File Review` cases distinctly so specialists immediately spot new international inquiries awaiting clinical opinion.
4. Upgrade `src/app/(doctor)/doctor/cases/[id]/page.tsx`:
   - Add `DISCHARGE_SUMMARY` to `DOCTOR_ISSUE_CATEGORIES` in `<CaseDocumentsManagerPanel />` with structured Discharge Summary prompt helpers (Procedure Performed, Hospital Course, Discharge Medications, Wound Care, Emergency Red Flags).
   - Upgrade the **Fit-to-Fly Travel Clearance** card to include the **5-point IATA Physiological Flight-Safety Checklist** (`Wound stable & free of active drainage`, `No trapped gas expansion risk at 8,000 ft cabin pressure`, `Cardiorespiratory & hemodynamic stability`, `Hemoglobin >= 8.5 g/dL & oxygenation adequate`, `DVT thromboembolism prophylaxis prescribed`), **Airline SSR Assistance Code** (`NONE`, `WCHR`, `WCHS`, `WCHC`, `MEDA`), **`IATA MEDIF Required (48–72h airline desk clearance)`** checkbox, and return flight number/date.
   - Display submitted **Day-7 / Day-30 / Day-90 Remote Follow-Up** check-ins from the patient so the specialist can record feedback.
5. Update `prisma/seed.ts` to populate `hospitalId`, `primaryDoctorId`, `passportExpiry`, `treatmentPlan` (published & consented), `travelLogistics` (`MED-X` attendant Ahmed Al-Hassan, inbound Emirates flight, confirmed pickup, submitted Form C), `TELECONSULTATION` mode on pre-op consult, `DISCHARGE_SUMMARY` document, structured `FitToFlyClearance` checklist + `WCHR` SSR code, and `[DAY_7, DAY_30, DAY_90]` follow-ups, then run `npm run db:seed`.

- [ ] **Step 4: Run full verification suite**

Run:
```powershell
npm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "C:\Users\Admin\.gemini\config\skills\impeccable\scripts\impeccable.cmd" detect --json "src/app" "src/components"
```
Expected: `0` lint issues, `0` TypeScript errors, `100%` Jest suites green, `next build` succeeds across all routes, and `impeccable detect` returns `[]`.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/v1/doctor src/app/\(doctor\) src/lib prisma/seed.ts
git commit -m "feat(doctor-medif): add pre-travel doctor triage, discharge summary, IATA MEDIF checklist, and full MVT seed"
```

