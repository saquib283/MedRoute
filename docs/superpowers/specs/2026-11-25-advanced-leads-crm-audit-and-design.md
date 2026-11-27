# Advanced International MVT Leads CRM — Audit & Architecture Specification

**Date:** 2026-11-25  
**Application:** Afzal Healthcare (`MedRoute`)  
**Domain Benchmark:** International Patient Department (IPD) & Medical Value Travel (MVT) Healthcare CRM Standards (Omnichannel Pre-Clinical Intake, Speed-to-Lead SLAs, Clinical Intent Scoring, B2B Facilitator Attribution, and Atomic Patient/Case Conversion).

---

## 1. Forensic Audit of Current Acquisition & Pre-Registration Gaps

1. **P0 — High-Friction Registration Wall Drops Pre-Account Inquiries (`src/app/page.tsx`, `src/app/(auth)/register/page.tsx`):**
   - `/` redirects straight to `/login`, and `/register` requires creating a portal password plus entering a mandatory passport number and date of birth.
   - International medical travelers overwhelmingly request a preliminary specialist opinion and cost ballpark *before* holding a valid passport or committing to portal registration.
   - Coordinators (`MANAGER`) also have no endpoint or UI on `/manager/patients` to log incoming WhatsApp, phone, or walk-in inquiries without full passport/account credentials.
2. **P0 — Unqualified Prospects Conflated with Clinical `Patient` + `Case` (`src/lib/services/onboarding.service.ts`):**
   - Creating `User` + `Patient` + `PatientMedicalProfile` + `Case` + `13` `ClinicalStep` rows for early-stage price inquiries pollutes clinical cohorts and artificially consumes `SystemConfig.maxPatientsPerManager` clinical capacity (`assertManagerCapacity`).
3. **P0 — Zero B2B Referral Partner & Campaign Attribution (`prisma/schema.prisma`):**
   - No `ReferralPartner` entity exists to track international medical facilitators, referring overseas physicians, embassies/health ministries, or corporate insurers, nor can `Case` / `MedicalBill` revenue be attributed back to `?ref=` partner codes or `utm_*` campaigns.
4. **P1 — Missing Speed-to-Lead SLAs, Intent Scoring & Language-Aware Routing:**
   - MVT conversion depends on rapid first response (`< 15m` Urgent, `< 60m` Priority/Hot, `< 4h` Routine). MedRoute has no `0–100` lead scoring engine, no `firstResponseDueAt` / `firstRespondedAt` SLA tracking, and no language-aware coordinator routing.
5. **P1 — Missing Omnichannel Activity Log, Follow-Up Cadence & Duplicate Detection:**
   - Coordinators lack a structured timeline for WhatsApp/phone/email touchpoints, preliminary quote estimates, scheduled follow-ups (`nextFollowUpAt`), structured `lostReason` codes, and duplicate detection across existing `Lead` and `Patient` records.
6. **P1 — Missing Transactional `Lead → Patient + Case` Conversion Bridge:**
   - Qualified leads cannot be promoted in one click into either a new `User` + `Patient` + `Case` or a new `Case` under an existing returning `Patient` while preserving clinical triage notes, target hospital/specialist, and B2B partner attribution.
7. **P2 — Disconnected Nurture Campaigns & Funnel Analytics:**
   - `EmailCampaign` cannot target active pre-conversion leads (`LEADS_ACTIVE`), and `/admin/analytics` has no top-of-funnel conversion, SLA breach, lost-reason, or B2B partner ROI telemetry.

---

## 2. Target Domain Model & Schema Extensions (`prisma/schema.prisma`)

### 2.1 New Enums
- **`LeadStatus`:** `NEW`, `CONTACTED`, `MEDICAL_RECORDS_REQUESTED`, `CLINICAL_REVIEW`, `QUOTE_SHARED`, `NURTURING`, `QUALIFIED`, `CONVERTED`, `LOST`
- **`LeadSource`:** `WEBSITE_INQUIRY`, `WHATSAPP`, `PHONE_CALL`, `B2B_PARTNER`, `DOCTOR_REFERRAL`, `EMBASSY_SPONSOR`, `META_GOOGLE_ADS`, `EMAIL_CAMPAIGN`, `WALK_IN`
- **`LeadTemperature`:** `HOT`, `WARM`, `COLD`
- **`LeadActivityType`:** `NOTE`, `WHATSAPP`, `PHONE_CALL`, `EMAIL`, `QUOTE_ESTIMATE`, `STATUS_CHANGE`, `FOLLOW_UP_SCHEDULED`, `CONVERSION`

### 2.2 New Models & Relations
1. **`ReferralPartner` (`referral_partners`):**
   - `id String @id @default(cuid())`
   - `name String`
   - `code String @unique` (uppercase alphanumeric slug, e.g. `OMAN-CARE-01`)
   - `partnerType String` (`FACILITATOR_AGENCY` | `REFERRING_PHYSICIAN` | `EMBASSY_MINISTRY` | `CORPORATE_INSURER`)
   - `country String`
   - `contactName String?`, `contactEmail String?`, `contactPhone String?`
   - `commissionPercent Decimal @default(10.00) @db.Decimal(5, 2)`
   - `isActive Boolean @default(true)`
   - `notes String? @db.Text`
   - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
   - Relations: `leads Lead[]`, `cases Case[]`
2. **`Lead` (`leads`):**
   - `id String @id @default(cuid())`
   - `referenceNo String @unique` (`LD-YYYY-XXXXXX`)
   - `fullName String`, `email String?`, `phone String?`, `whatsappNumber String?`
   - `nationality String`, `countryOfResidence String?`, `preferredLanguage String?`
   - `medicalCondition String @db.Text`, `specialtyInterest String?` (`CARDIOLOGY`, `ONCOLOGY`, `ORTHOPEDICS`, `NEUROSURGERY`, `TRANSPLANT`, `IVF`, `GENERAL`)
   - `urgencyLevel UrgencyLevel @default(ROUTINE)`
   - `hasDiagnosticReports Boolean @default(false)`, `passportReady Boolean @default(false)`
   - `preferredTravelWindow String?` (`IMMEDIATE_7D`, `WITHIN_30D`, `WITHIN_90D`, `EXPLORING`)
   - `estimatedBudgetUsd Decimal? @db.Decimal(12, 2)`, `preliminaryQuoteUsd Decimal? @db.Decimal(12, 2)`, `preliminaryQuoteNotes String? @db.Text`
   - `targetHospitalId String?`, `targetDoctorId String?`
   - `status LeadStatus @default(NEW)`, `source LeadSource @default(WEBSITE_INQUIRY)`
   - `leadScore Int @default(0)`, `temperature LeadTemperature @default(WARM)`
   - `assignedManagerId String?`, `referralPartnerId String?`
   - `utmSource String?`, `utmMedium String?`, `utmCampaign String?`
   - `firstResponseDueAt DateTime`, `firstRespondedAt DateTime?`, `lastContactedAt DateTime?`, `nextFollowUpAt DateTime?`
   - `lostReason String?`, `lostNotes String? @db.Text`
   - `convertedPatientId String?`, `convertedCaseId String? @unique`, `convertedAt DateTime?`
   - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
   - Indexes: `[status]`, `[assignedManagerId]`, `[source]`, `[temperature, leadScore]`, `[firstResponseDueAt]`, `[nextFollowUpAt]`, `[email]`, `[phone]`, `[referralPartnerId]`
3. **`LeadActivity` (`lead_activities`):**
   - `id String @id @default(cuid())`
   - `leadId String` (FK → `Lead`, `onDelete: Cascade`)
   - `actorId String?` (FK → `User`, nullable for unauthenticated public web intake)
   - `activityType LeadActivityType`
   - `summary String`
   - `details Json?`
   - `dueAt DateTime?`, `completedAt DateTime?`
   - `createdAt DateTime @default(now())`
   - Indexes: `[leadId, createdAt]`, `[dueAt]`
4. **`Case` Extension:**
   - Add `referralPartnerId String? @map("referral_partner_id")` + relation to `ReferralPartner` + `@@index([referralPartnerId])`.

---

## 3. Pure Scoring, SLA & Transition Rules (`src/lib/validation/leads-crm-schemas.ts`)

1. **Deterministic Lead Score (`0–100`) & Temperature:**
   - `URGENT`: `+25` | `SEMI_URGENT`: `+15` | `ROUTINE`: `+5`
   - `hasDiagnosticReports === true`: `+20`
   - `medicalCondition.trim().length >= 30`: `+12`
   - `specialtyInterest` provided & non-empty: `+8`
   - `passportReady === true`: `+12`
   - `preferredTravelWindow`: `IMMEDIATE_7D` (`+10`), `WITHIN_30D` (`+8`), `WITHIN_90D` (`+4`)
   - `estimatedBudgetUsd > 0`: `+8`
   - `source` in `['B2B_PARTNER', 'DOCTOR_REFERRAL', 'EMBASSY_SPONSOR']`: `+10`; `['WHATSAPP', 'WEBSITE_INQUIRY', 'PHONE_CALL']`: `+5`
   - Both `email` and (`phone` or `whatsappNumber`) present: `+5`
   - Clamped to `[0, 100]`. Temperature: `score >= 70` → `HOT`, `score >= 40` → `WARM`, `< 40` → `COLD`.
2. **Speed-to-Lead First-Response SLA:**
   - `URGENT`: `createdAt + 15 minutes`
   - `SEMI_URGENT` or `temperature === 'HOT'`: `createdAt + 60 minutes`
   - Otherwise: `createdAt + 240 minutes` (`4 hours`)
   - `computeLeadSlaState`:
     - Terminal `CONVERTED` / `LOST` without prior response when `status !== 'NEW'`: if `firstRespondedAt` exists, compare `firstRespondedAt <= firstResponseDueAt ? 'RESPONDED_ON_TIME' : 'RESPONDED_LATE'`.
     - Unresponded (`!firstRespondedAt`):
       - `now > firstResponseDueAt` → `'BREACHED'`
       - `firstResponseDueAt - now <= 15 minutes` → `'DUE_SOON'`
       - Otherwise → `'ACTIVE_WINDOW'`
3. **Transition Guardrails (`validateLeadStatusTransition`):**
   - Cannot transition out of `CONVERTED`.
   - Entering `CONVERTED` directly via status update is blocked (`viaConversionService` must be `true`).
   - Entering `LOST` requires `lostReason` in `LEAD_LOST_REASONS`.
   - Entering `QUOTE_SHARED` requires `preliminaryQuoteUsd > 0` or `targetHospitalId` present.

---

## 4. Security, RBAC, Deduplication & Conversion Guarantees

- **Public Intake Hardening (`POST /api/v1/public/inquiries`):**
  - Listed in `PUBLIC_ROUTES`; enforces per-IP sliding-window rate limiting (`5` submissions / `15m`), silent honeypot rejection (`websiteUrl` field), strict Zod length/format bounds, and returns only `{ referenceNo, slaMinutes, temperature }` (never leaking internal IDs or whether an email/phone already exists).
- **Role & Object-Level Access:**
  - `ADMIN`: Full CRUD across all leads, B2B partners, bulk CSV import/export, reassignment, and conversion.
  - `MANAGER`: Can create leads, view/manage leads where `assignedManagerId === userId` OR `assignedManagerId === null` (unclaimed intake pool), claim unassigned leads, log omnichannel activities, and convert assigned leads into `Patient` + `Case`. Cannot delete leads or edit B2B partner commission rates (read-only partner list for attribution).
  - `PATIENT` & `DOCTOR`: `403 FORBIDDEN` on all `/api/v1/leads*` and `/api/v1/referral-partners*` routes (`DOCTOR` sees clinical cases only once converted or assigned via `Case`).
- **Atomic 1-Click Conversion (`convertLeadToPatientCase`):**
  - Runs inside `prisma.$transaction`:
    - **Mode `NEW_PATIENT`:** Requires `email`, `passportNo`, `dob` (plus optional `passportExpiry`, `password` — auto-generating a strong 16-char initial password if omitted), verifies `assertManagerCapacity`, encrypts `passportNo` via `AES-256-GCM`, creates `User` + `Patient` + `PatientMedicalProfile` + `Case` (`referralPartnerId`, `hospitalId`, `primaryDoctorId`, `status: hospitalId && primaryDoctorId ? 'UNDER_REVIEW' : 'INQUIRY_RECEIVED'`) + `13` `ClinicalStep` rows (`buildStandardMvtPathwaySteps`).
    - **Mode `EXISTING_PATIENT`:** Links a new `Case` + `13` `ClinicalStep` rows to `existingPatientId`, preserving `referralPartnerId`, `hospitalId`, and `primaryDoctorId`.
    - Marks `Lead` `CONVERTED` (`convertedPatientId`, `convertedCaseId`, `convertedAt`), logs `CONVERSION` `LeadActivity` + `AuditLog`, and notifies assigned clinical staff.

