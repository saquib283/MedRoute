# End-to-End International Treatment Lifecycle & UI User-Friendliness Audit Specification

**Date:** 2026-11-24  
**Application:** Afzal Healthcare (`MedRoute`)  
**Standards Benchmarked:**
1. **JCI (Joint Commission International) & NABH MVT Standards** — International Patient Safety Goals (IPSG), pre-travel informed consent, dual-identifier verification, multilingual discharge summaries, and post-return continuum of care.
2. **Government of India MHA / Bureau of Immigration / e-FRRO (`indianfrro.gov.in`)** — Official Hospital Visa Invitation Letter (VIL) mandatory fields, `MED` (Patient) + up to 2 `MED-X` (Medical Attendant) visas, 6-month passport validity rule, **Form C statutory submission within 24 hours of foreign inpatient/hotel check-in**, and e-FRRO visa extension tracking.
3. **IATA Medical Manual & MEDIF (Medical Information Form)** — Post-surgical physiological flight clearance (`5,000–8,000 ft` cabin altitude = `25–30%` trapped gas expansion & `20%` lower oxygen partial pressure), wound stability, DVT prophylaxis, Special Service Request (`SSR`) codes (`WCHR`, `WCHS`, `WCHC`, `MEDA`), and `48–72h` pre-departure MEDIF airline medical desk submission.

---

## 1. Industry-Standard 7-Stage Medical Value Travel (MVT) Process

| Stage | Standard Clinical, Legal & Operational Gates | Responsible Actors |
| :--- | :--- | :--- |
| **Stage 1: Digital Intake & Clinical Triage** | Patient registers -> completes guided safety profile (allergies, medications, chronic conditions, passport expiry >= 6 months, interpreter language) -> uploads passport + diagnostic scans/DICOM reports -> Coordinator auto-assigned -> Case initialized with clean 7-stage pathway (`Stage 1` active, `Stages 2–7` pending). | `PATIENT`, `MANAGER` |
| **Stage 2: Specialist Evaluation, All-In Quote & Consent** | Coordinator assigns Primary Partner Hospital (`hospitalId`) & Attending Specialist (`primaryDoctorId`) to `Case` -> Doctor reviews pre-travel scans asynchronously (without requiring a physical appointment first) -> Pre-arrival Teleconsultation (video URL, dual timezone) -> Structured **Treatment Plan & All-In Financial Quote** (Diagnosis, Procedure, Hospital LOS days, Hotel Recovery days, Estimate USD, Inclusions/Exclusions) -> **Patient Plan Acceptance & Pre-Travel Informed Consent**. | `MANAGER`, `DOCTOR`, `PATIENT` |
| **Stage 3: Visa Sponsorship (`VIL` + `MED-X`) & Travel Concierge** | Patient submits up to 2 Medical Attendants (`MED-X`: full passport name, passport no, relationship) -> Hospital/Coordinator issues MHA-compliant **Visa Invitation Letter (VIL)** containing Hospital NABH/JCI & FRRO Registration ID, decrypted Patient Passport No + Expiry, Attendants, Diagnosis/Procedure, Doctor, and Stay Window -> Patient uploads approved e-Medical Visa (`MED`/`MED-X`) + Inbound Flight Itinerary -> Coordinator confirms Airport Reception & Concierge Transfer. | `PATIENT`, `MANAGER` |
| **Stage 4: Arrival, Statutory Form C (24h FRRO) & PAC Clearance** | Patient arrives -> Hospital/Hotel records check-in -> **Statutory Form C filed within 24 hours** (`formCSubmittedAt`, `frroNumber`, `visaExpiryDate` tracked) -> Physical consultation, baseline labs, **Pre-Anesthesia Checkup (PAC)** (`ASA Class`, cardiac/airway fitness), surgical consent, and admission deposit. | `MANAGER`, `DOCTOR`, `PATIENT` |
| **Stage 5: Active Procedure & Daily Inpatient Updates** | Operating Theatre / Catheterization Lab intervention (`IN_TREATMENT`) -> Surgeon logs **Operative Summary** -> `ICU_RECOVERY` / `WARD_RECOVERY` daily plain-language clinical progress updates (vitals, pain control, mobilization) shared with patient & attendant. | `DOCTOR`, `MANAGER` |
| **Stage 6: Hospital Discharge, Step-Down Recovery Stay & Billing** | Multidisciplinary discharge readiness -> Doctor issues official **Discharge Summary (`DISCHARGE_SUMMARY`)** & **Prescription** (medications, wound care, red-flag emergency symptoms, 24/7 helpline) -> Final itemized hospital invoice settled (`PAID` -> tax/insurance receipt) -> Transition to nearby **Step-Down Partner Recovery Hotel** (`OUTPATIENT_RECUPERATION`) for outpatient dressing/suture review. | `DOCTOR`, `MANAGER`, `PATIENT` |
| **Stage 7: IATA Fit-to-Fly / MEDIF Clearance & Remote Continuum** | 24–72h before departure, Surgeon completes **Structured Fit-to-Fly / IATA MEDIF Checklist** (`woundStable`, `noTrappedGasRisk`, `cardioRespiratoryStable`, `hemoglobinCleared`, `dvtProphylaxisPlan`, `ssrCode`, `requiresMedif`) -> Official Fit-to-Fly PDF issued -> Hotel-to-Airport transfer -> **Remote Continuum of Care (`REMOTE_REHAB`)**: structured **Day-7, Day-30, and Day-90** recovery check-ins + local PCP handover packet -> Case `CLOSED`. | `DOCTOR`, `PATIENT`, `MANAGER` |

---

## 2. Forensic Audit of Current Process Gaps (`MedRoute` Codebase)

### P0 — Critical Broken Workflow & Compliance Gaps

1. **Empty Pathway on Onboarding (`src/lib/services/onboarding.service.ts:169-180`):**
   - `onboardPatient()` and `createCaseForPatient()` create a `Case` with **zero `ClinicalStep` rows**. Newly registered patients do not get the 7-stage interactive `ClinicalRoadmapTree` until a Coordinator manually opens `/manager/cases/[id]/pathway`, picks a preset, and clicks Save.
   - Worse, `PRESET_TEMPLATES` (`src/lib/services/clinical-pathway.service.ts:45-120`) hardcodes Stages 1–4 as `status: 'COMPLETED'` with pre-filled fake notes (`"Pre-op Angiography DICOM scans reviewed"`), corrupting real patient timelines when applied to a new inquiry.
2. **Missing `hospitalId` & `primaryDoctorId` on `Case` — Doctors Locked Out Pre-Travel (`prisma/schema.prisma:157-180`, `clinical-pathway.service.ts:526-540`):**
   - `Case` has no hospital or primary specialist relation. `authorizeCaseClinicalAccess()` throws `403 FORBIDDEN` for `DOCTOR` unless a non-cancelled `Appointment` already exists. Specialists cannot review pre-travel diagnostic scans or record MDT opinions during `INQUIRY_RECEIVED` / `UNDER_REVIEW`.
3. **No Structured Treatment Plan, All-In Quote, or Patient Consent Gate:**
   - `PROFORMA_INVOICE` is a 2-line generic PDF with no cost figure, no procedure, no hospital/hotel stay duration, and no patient acceptance state.
   - Clicking `Review Invoice` on `ISSUE_PROFORMA` in `ClinicalRoadmapTree.tsx:192-201` routes to `/patient/billing` (`MedicalBill` table), which is empty at the pre-travel quote stage.
4. **Non-Compliant Visa Invitation Letter (VIL), Zero `MED-X` Attendants, Zero Flight/Arrival Logistics, Zero 24h Form C Tracking:**
   - `Patient` lacks `passportExpiry` (6-month rule unvalidated).
   - No schema or UI for **Medical Attendants (`MED-X` companions)** — up to 2 attendants (name, passport no, relationship) are mandatory on Indian VILs.
   - `generateClinicalCertificatePdf()` (`clinical-certificate.service.ts:137-214`) omits the patient's passport number, hospital name/accreditation/FRRO ID, treating specialist, diagnosis/procedure, tentative dates, and attendants.
   - `ARRANGE_LOGISTICS` has **no UI or API** (`ClinicalRoadmapTree.tsx:213` returns `null`).
   - Statutory **Form C (24-hour FRRO reporting)** and **visa expiry tracking** do not exist.

### P1 — Clinical Safety, State-Machine & Post-Discharge Gaps

5. **Disconnected State Machines & Unguarded Status Jumps (`src/app/api/v1/manager/cases/route.ts:113-154`):**
   - Managers can jump `Case.status` from `INQUIRY_RECEIVED` straight to `FIT_TO_FLY_CLEARED` or `CLOSED` without verified passport, signed Fit-to-Fly, or settled bills.
   - `GET /api/v1/patient/cases` (`src/app/api/v1/patient/cases/route.ts:38-40`) sorts `clinicalSteps` by `createdAt: 'asc'` instead of `[{ stageOrder: 'asc' }, { stepOrder: 'asc' }]`, scrambling reordered stages for patients.
6. **No Teleconsultation Mode, Video Link, or Dual Timezone (`prisma/schema.prisma:247-275`):**
   - `Appointment` treats pre-travel remote video consults identically to physical on-site hospital visits, with no `TELECONSULTATION` vs `IN_PERSON` mode, no `meetingUrl`, and no `IST` + patient timezone clarity.
7. **Missing `DISCHARGE_SUMMARY`, Unstructured Fit-to-Fly (No IATA MEDIF / SSR), and Missing Day-7/30/90 Follow-Ups:**
   - `DocumentCategory` lacks `DISCHARGE_SUMMARY`.
   - `FitToFlyClearance` lacks structured physiological checks (wound integrity, trapped cabin gas risk, cardiorespiratory stability, DVT prophylaxis, `SSR` wheelchair/assistance codes, `requiresMedif`).
   - `REMOTE_REHAB` has no structured Day-7 / Day-30 / Day-90 patient symptom & wound check-in flow (`SCHEDULE_TELE_REHAB` renders `null` in `ClinicalRoadmapTree.tsx`).

---

## 3. UI User-Friendliness & Cognitive Load Audit

| Portal & Surface | UX / User-Friendliness Defect | Concrete Remediation |
| :--- | :--- | :--- |
| **Onboarding (`/register` -> `/patient/dashboard`)** | 9-field single-wall registration followed by a cold drop into 4 separate sidebar sections with no guided intake flow. | Progressive 2-step registration (`Account & Contact` -> `Passport & Medical Need`) + auto-seeded 7-stage pathway + **Guided Intake & Next-Action Banner** on `/patient/dashboard`. |
| **Patient Overview (`/patient/dashboard`)** | `"Recommended Next Steps"` (`lines 438-494`) is 100% static HTML — shows pre-travel scan upload prompts even after surgery or Fit-to-Fly clearance. `ClinicalRoadmapTree` shows `"Download Visa Letter"` even when VIL status is `PENDING`. | Replace static checklist with a **Stage-Aware Next Required Action Engine** driven by live `Case` phase, unverified/rejected docs, pending Treatment Plan consent, missing flight details, unpaid balance, and due Day-7/30/90 check-ins. Render download CTAs only when certificates exist. |
| **Patient Document & Visa Vault (`/patient/documents`)** | Only shows 5 pre-travel tiles; hides rejected document reasons inside bottom card list; nowhere to enter `MED-X` attendants, passport expiry, or flight arrival details. | Add top **Rejected Document Action Alert**, **Visa & Travel Concierge Card** (`passportExpiry`, up to 2 `MED-X` attendants, inbound/outbound flight & airport pickup), and **Phase-Adaptive Checklist** (`Pre-Travel Visa Readiness` vs `Discharge & Return Flight Pack`). |
| **Patient & Staff Consultations (`appointments`)** | No distinction between video teleconsultations from abroad vs. on-site hospital visits in India; local browser `toLocaleString()` hides India Standard Time (`IST`, `UTC+5:30`). | Add `TELECONSULTATION` / `IN_PERSON` mode badge, 1-click `Join Video Consultation` link, dual `IST + Local Time` display, and interpreter language indicator. |
| **Coordinator Case Management (`/manager/cases`)** | Severe **Context-Switch Tax**: managing 1 patient requires jumping across 5 separate routes (`cases` narrow right sidebar, `cases/[id]/pathway` developer form, `appointments`, `billing`, `accommodations`). | Build unified **`/manager/cases/[id]` (and `/admin/cases/[id]`) Case Command Workspace** with 5 clean tabs: `1. Triage & Specialist`, `2. Treatment Plan & Quote`, `3. Visa, FRRO & Travel`, `4. Pathway & Hotel Stay`, `5. Discharge, Billing & Follow-Up`. |
| **Doctor Workspace (`/doctor/dashboard`, `/doctor/cases/[id]`)** | Doctors cannot see assigned `UNDER_REVIEW` pre-travel cases; PAC, Discharge Summary, and Fit-to-Fly require typing everything into free-text boxes. | Unlock `primaryDoctorId` cases on Doctor Dashboard (`Pre-Travel File Reviews`), add structured **MDT Medical Opinion**, **Discharge Summary**, and **IATA MEDIF Fit-to-Fly Safety Checklist** (`SSR` code + MEDIF flag). |

---

## 4. Target Re-Implementation Architecture

### 4.1 Schema Extensions (`prisma/schema.prisma`)
- **`DocumentCategory` enum:** Add `DISCHARGE_SUMMARY`.
- **`AppointmentMode` enum:** `TELECONSULTATION`, `IN_PERSON`.
- **`Patient` model:** Add `passportExpiry DateTime? @map("passport_expiry")`.
- **`Case` model:**
  - `hospitalId String? @map("hospital_id")` -> relation to `Hospital`
  - `primaryDoctorId String? @map("primary_doctor_id")` -> relation to `Doctor`
  - `treatmentPlan Json? @map("treatment_plan")` — typed via Zod `TreatmentPlanPayload`:
    `{ diagnosis, procedureName, specialty, hospitalLosDays, recoveryStayDays, estimatedCostUsd, depositRequiredUsd, currency, inclusions, exclusions, doctorOpinionNotes, publishedAt, consentAcceptedAt, consentAcceptedBy }`
  - `travelLogistics Json? @map("travel_logistics")` — typed via Zod `TravelLogisticsPayload`:
    `{ attendants: Array<{ fullName, passportNo, relation }>, arrivalAirline, arrivalFlightNo, arrivalAt, arrivalAirport, airportPickupRequired, pickupConfirmed, wheelchairSsrCode, dietaryPreferences, departureFlightNo, departureAt, visaNumber, visaExpiryDate, formCSubmittedAt, frroNumber }`
  - `postReturnFollowUps Json? @map("post_return_follow_ups")` — typed via Zod `FollowUpMilestone[]`:
    `Array<{ milestone: 'DAY_7' | 'DAY_30' | 'DAY_90', dueAt, status: 'PENDING' | 'SUBMITTED' | 'REVIEWED', painScore?: number, woundStatus?: string, patientNotes?: string, doctorFeedback?: string, updatedAt?: string }>`
- **`Appointment` model:**
  - `mode AppointmentMode @default(IN_PERSON)`
  - `meetingUrl String? @map("meeting_url")`
  - `interpreterLanguage String? @map("interpreter_language")`
- **`FitToFlyClearance` model:**
  - `checklist Json?` (`{ woundStable: boolean, noTrappedGasRisk: boolean, cardioRespiratoryStable: boolean, hemoglobinCleared: boolean, dvtProphylaxisPlan: boolean }`)
  - `ssrCode String? @default("NONE") @map("ssr_code")` (`NONE` | `WCHR` | `WCHS` | `WCHC` | `MEDA`)
  - `requiresMedif Boolean @default(false) @map("requires_medif")`
  - `flightNumber String? @map("flight_number")`
  - `departureDate DateTime? @map("departure_date")`

### 4.2 Unified Lifecycle & Stage-Gate Service (`src/lib/services/case-lifecycle.service.ts`)
- Deterministic **Default 7-Stage MVT Pathway Generator** (`buildInitialCasePathwaySteps(specialty?)`) used on `onboardPatient()`, `createCaseForPatient()`, and clean template application (`resetStatuses: true` sets Stage 1 Step 1 `IN_PROGRESS` and all remaining steps `PENDING`).
- **Role-Scoped Lifecycle Mutations (`PUT /api/v1/cases/[id]/lifecycle`):**
  1. `ASSIGN_CLINICAL_TEAM` (`MANAGER` / `ADMIN`): Sets `hospitalId` + `primaryDoctorId`, advances `INQUIRY_RECEIVED -> UNDER_REVIEW`, notifies Doctor.
  2. `PUBLISH_TREATMENT_PLAN` (`MANAGER` / `DOCTOR` / `ADMIN`): Saves structured `treatmentPlan`, auto-generates itemized `PROFORMA_INVOICE` PDF, marks `ISSUE_PROFORMA` `ACTION_REQUIRED` for patient consent.
  3. `RESPOND_TREATMENT_PLAN` (`PATIENT`): Records `consentAcceptedAt` + `consentAcceptedBy`, completes `ISSUE_PROFORMA`, advances `Case.status` to `PLAN_CONFIRMED`, unlocks Stage 3 Visa Sponsorship.
  4. `UPDATE_TRAVEL_LOGISTICS` (`PATIENT` / `MANAGER` / `ADMIN`): Encrypts/stores `MED-X` attendant passport numbers, flight itinerary, pickup confirmation, **Form C 24h timestamp**, and `frroNumber`; completes `ARRANGE_LOGISTICS` when pickup is confirmed.
  5. `SUBMIT_FOLLOW_UP_CHECKIN` (`PATIENT` / `DOCTOR`): Patient submits Day-7/30/90 pain/wound status; Doctor reviews and closes loop.
- **Stage-Gate Guardrails:** Closing a case (`CLOSED`) requires either settled non-cancelled bills + Fit-to-Fly clearance (when surgical treatment occurred) OR an explicit `closureReason` logged in `AuditLog`.

