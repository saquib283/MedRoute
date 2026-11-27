# Advanced International MVT Leads CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end International Medical Value Travel (MVT) Leads CRM for MedRoute—spanning public 60-second inquiry capture (`/inquiry`), B2B Referral Partner attribution (`?ref=` & UTM tracking), deterministic `0–100` clinical-intent lead scoring, `15m`/`1h`/`4h` Speed-to-Lead SLAs, language-aware coordinator routing, omnichannel WhatsApp/Call/Email activity & follow-up timelines, duplicate detection, Kanban + Table pipeline workspaces, funnel analytics, lead nurture email campaigns, and 1-click transactional `Lead → Patient + Case` conversion.

**Architecture:** Add `ReferralPartner`, `Lead`, and `LeadActivity` models (plus `Case.referralPartnerId`) to Prisma/TiDB via an additive migration. Place all pure Zod schemas, `0–100` scoring, SLA state calculation, WhatsApp deep-link builders, and stage-transition validators in a client-safe module (`src/lib/validation/leads-crm-schemas.ts`). Implement server workflows in two focused domain services—`src/lib/services/leads-crm.service.ts` (intake, rate-limiting, language routing, deduplication, activities, B2B partners, CSV) and `src/lib/services/leads-conversion.service.ts` (atomic `Lead → Patient + Case` conversion and funnel/ROI analytics)—and surface clean Institutional Clinical UI workspaces across `/inquiry`, `/manager/leads`, `/admin/leads`, `/admin/referral-partners`, and `/admin/analytics`.

**Tech Stack:** Next.js 16.2.9 (App Router, Turbopack, TypeScript 5), React 19.2, Tailwind CSS v4 (`@theme` clinical tokens), Prisma 6.19 (TiDB Cloud / MySQL), Zod 4, AES-256-GCM ePHI encryption, Jest 30.

**Spec:** `docs/superpowers/specs/2026-11-25-advanced-leads-crm-audit-and-design.md`

## Global Constraints

- **Next.js 16 Conventions (`AGENTS.md`):** Dynamic route `params` in pages and route handlers are `Promise<{ id: string }>` (`await params` in route handlers, `use(params)` in client pages). Never add custom named exports to `src/app/**/layout.tsx`. Avoid bare `useSearchParams()` in client pages without `<Suspense>` so `next build` static generation succeeds cleanly.
- **Client/Server Module Boundary:** `'use client'` files MUST NEVER import `@/lib/services/*` or runtime `@prisma/client` values; import pure schemas, types, and helpers strictly from `@/lib/validation/leads-crm-schemas` and `@/lib/constants`.
- **Institutional Clinical Design System:** Strictly enforce `rounded-lg` (`8px`) on cards/modals, `rounded-md` (`6px`) on buttons/inputs/selects/tabs/badges, `font-semibold` (`600`) for headings/KPIs, `font-medium` (`500`) for labels/controls, `font-normal` (`400`) for body copy, `tabular-nums` on all scores/timers/currencies/counts, `min-h-11` (`44px`) touch targets, and `0` occurrences of `rounded-3xl`, `rounded-2xl`, `font-black`, `font-extrabold`, `backdrop-blur`, `hover:-translate-y`, or `bg-gradient-to-`.
- **React 19 Lint Compliance:** Schedule initial `useEffect` async data loads via `const timer = setTimeout(() => { void loadFn(); }, 0); return () => clearTimeout(timer);` to keep `eslint` at `0` errors/warnings.
- **Security & ePHI Discipline:** Encrypt `Patient.passportNo` via `encrypt()` on conversion, mask passports via `formatPatientForViewer(..., { maskPassport: true })` in staff responses, neutralize CSV formula prefixes (`=`, `+`, `-`, `@`) via `src/lib/api/csv-helper.ts`, and validate external URLs with `http:`/`https:` checks.
- **Windows PowerShell 5.1 Chaining:** Never use `&&` in shell commands; chain commands with `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`.

---

## File Structure

### Created Files
- `prisma/migrations/20261125160000_advanced_leads_crm/migration.sql` — Additive TiDB/MySQL migration creating `referral_partners`, `leads`, `lead_activities`, and `cases.referral_partner_id`.
- `src/lib/validation/leads-crm-schemas.ts` — Client-safe constants, Zod schemas, `computeLeadScoreAndTemperature`, `computeLeadFirstResponseDueAt`, `computeLeadSlaState`, `validateLeadStatusTransition`, and `buildWhatsAppFollowUpUrl`.
- `src/lib/services/leads-crm.service.ts` — Public inquiry intake + IP rate limiter, staff lead CRUD, language/load coordinator auto-router, email/phone duplicate detector (`Lead` + `Patient`), omnichannel activity & follow-up task mutations, B2B `ReferralPartner` CRUD, and CSV import/export.
- `src/lib/services/leads-conversion.service.ts` — Atomic `convertLeadToPatientCase` (`NEW_PATIENT` & `EXISTING_PATIENT` modes) and `computeLeadsCrmAnalytics` funnel + B2B partner revenue attribution engine.
- `src/app/api/v1/public/inquiries/route.ts` — Public rate-limited `POST` endpoint for `/inquiry` submissions.
- `src/app/api/v1/leads/route.ts` — `GET` (filtered/paginated leads + KPI summary strip) & `POST` (manual lead creation or bulk CSV import) for `MANAGER` & `ADMIN`.
- `src/app/api/v1/leads/[id]/route.ts` — `GET` (full lead dossier + duplicate matches) & `PATCH` (status/field updates, Preliminary Quote, Claim/Reassign) for `MANAGER` & `ADMIN`.
- `src/app/api/v1/leads/[id]/activities/route.ts` — `POST` (log WhatsApp/Call/Email/Quote/Follow-Up) & `PATCH` (complete scheduled follow-up task) for `MANAGER` & `ADMIN`.
- `src/app/api/v1/leads/[id]/convert/route.ts` — `POST` atomic `Lead → Patient + Case` conversion endpoint.
- `src/app/api/v1/referral-partners/route.ts` — `GET` (`MANAGER` & `ADMIN`), `POST` (`ADMIN`), & `PATCH` (`ADMIN`) for B2B Referral Partners.
- `src/app/api/v1/admin/export/leads/route.ts` — `GET` formula-safe CSV export of filtered leads (`ADMIN`).
- `src/app/(auth)/inquiry/page.tsx` — Public 60-second "Free Specialist Opinion & Cost Estimate" intake form with `?ref=` & UTM capture and SLA confirmation card.
- `src/components/crm/LeadsPipelineWorkspace.tsx` — Shared Coordinator & Admin Leads CRM workspace featuring KPI/SLA strip, Kanban Pipeline Board, High-Density Triage Table, and `+ Log New Lead` modal.
- `src/components/crm/LeadDossierWorkspace.tsx` — Shared single-lead command dossier with Omnichannel Quick-Log Bar, `wa.me` WhatsApp launcher, Activity & Follow-Up Timeline, Duplicate Match Alert, Preliminary Quote editor, and B2B Attribution rail.
- `src/components/crm/ConvertLeadModal.tsx` — Guided 1-click conversion modal supporting `New Patient + Case` (with passport/DOB capture) and `Returning Patient → New Case`.
- `src/app/(manager)/manager/leads/page.tsx` & `src/app/(manager)/manager/leads/[id]/page.tsx` — Manager Leads CRM routes.
- `src/app/(admin)/admin/leads/page.tsx`, `src/app/(admin)/admin/leads/[id]/page.tsx`, & `src/app/(admin)/admin/referral-partners/page.tsx` — Admin Leads CRM & B2B Referral Partner routes.
- `src/lib/__tests__/leads-crm-schemas.test.ts` — Unit tests for lead scoring, temperature, SLA states, transition guardrails, and WhatsApp URL builder.
- `src/lib/services/__tests__/leads-crm.service.test.ts` — Service & API tests for public intake rate-limiting, `?ref=` resolution, language routing, deduplication, RBAC, and activities.
- `src/lib/services/__tests__/leads-conversion.service.test.ts` — Tests for `NEW_PATIENT` & `EXISTING_PATIENT` atomic conversion, `Case.referralPartnerId` propagation, `LEADS_ACTIVE` campaigns, and funnel analytics.
- `src/lib/__tests__/public-inquiry-route.test.ts` — Route integration tests for `POST /api/v1/public/inquiries` (honeypot, rate-limit, validation, non-leaky response).

### Modified Files
- `prisma/schema.prisma` — Add `LeadStatus`, `LeadSource`, `LeadTemperature`, `LeadActivityType`, `ReferralPartner`, `Lead`, `LeadActivity`, `Case.referralPartnerId`, and `User` relations (`managedLeads`, `leadActivities`).
- `src/lib/constants.ts` — Export `LEAD_STATUS_LABELS`, `LEAD_SOURCE_LABELS`, `LEAD_LOST_REASON_LABELS`, and `MVT_SPECIALTY_OPTIONS`.
- `src/lib/auth/rbac.ts` — Add `/inquiry` and `/api/v1/public/inquiries` to `PUBLIC_ROUTES`, and add `'manage:leads': ['MANAGER', 'ADMIN']` & `'manage:referral-partners': ['ADMIN']` to `PERMISSIONS`.
- `src/lib/api/audit-logger.ts` — Add `CREATE_LEAD`, `UPDATE_LEAD`, `CONVERT_LEAD`, `EXPORT_LEADS` to `AUDIT_ACTIONS`.
- `src/lib/services/analytics.service.ts` — Include `leadsFunnel` (`LeadsFunnelAnalyticsPayload`) inside `PlatformAnalyticsPayload`.
- `src/lib/services/email-campaign.service.ts` & `src/app/api/v1/admin/email-campaigns/route.ts` — Support `LEADS_ACTIVE` target audience for lead nurture email campaigns.
- `src/app/(auth)/login/page.tsx` & `src/app/(auth)/register/page.tsx` — Add clean entry links to `/inquiry` for prospective international patients without a passport/account yet.
- `src/app/(manager)/manager/layout.tsx` & `src/app/(admin)/admin/layout.tsx` — Add `Leads CRM` (with live SLA/new-lead badge) and `Referral Partners` (`AdminLayout`) sidebar navigation items.
- `src/app/(manager)/manager/dashboard/page.tsx` & `src/app/api/v1/manager/dashboard/route.ts` — Surface assigned open leads & SLA due counts.
- `src/app/(admin)/admin/dashboard/page.tsx`, `src/app/(admin)/admin/analytics/page.tsx`, & `src/app/(admin)/admin/email-campaigns/page.tsx` — Surface Leads Acquisition Funnel, B2B Partner ROI table, and `LEADS_ACTIVE` campaign selector.
- `prisma/seed.ts` — Seed 3 `ReferralPartner` records, 6 realistic multi-stage international `Lead` records (Hot/Warm/Cold, SLA active/breached, converted), `LeadActivity` timelines, and `Case.referralPartnerId` attribution.

---

### Task 1: Leads CRM & B2B Partner Schema, Migration & Pure Scoring/SLA Engine

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261125160000_advanced_leads_crm/migration.sql`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/api/audit-logger.ts`
- Create: `src/lib/validation/leads-crm-schemas.ts`
- Test: `src/lib/__tests__/leads-crm-schemas.test.ts`

**Interfaces:**
- Produces in `src/lib/validation/leads-crm-schemas.ts`:
  - `LEAD_STATUSES`, `LEAD_SOURCES`, `LEAD_TEMPERATURES`, `LEAD_ACTIVITY_TYPES`, `LEAD_LOST_REASONS`, `REFERRAL_PARTNER_TYPES`, `PREFERRED_TRAVEL_WINDOWS`
  - `publicInquirySchema`, `createLeadSchema`, `updateLeadSchema`, `logLeadActivitySchema`, `convertLeadSchema`, `referralPartnerSchema`
  - `computeLeadScoreAndTemperature(input: LeadScoringInput): { score: number; temperature: 'HOT' | 'WARM' | 'COLD'; breakdown: string[] }`
  - `computeLeadFirstResponseDueAt(urgencyLevel: 'ROUTINE' | 'SEMI_URGENT' | 'URGENT', temperature: 'HOT' | 'WARM' | 'COLD', createdAt?: Date): Date`
  - `computeLeadSlaState(params: { firstResponseDueAt: Date | string; firstRespondedAt?: Date | string | null; status: string; now?: Date }): 'RESPONDED_ON_TIME' | 'RESPONDED_LATE' | 'DUE_SOON' | 'ACTIVE_WINDOW' | 'BREACHED'`
  - `validateLeadStatusTransition(params: { currentStatus: string; nextStatus: string; lostReason?: string | null; preliminaryQuoteUsd?: number | null; targetHospitalId?: string | null; viaConversionService?: boolean }): { allowed: true } | { allowed: false; reason: string }`
  - `buildWhatsAppFollowUpUrl(params: { phone?: string | null; fullName: string; referenceNo: string; coordinatorName?: string; specialty?: string | null }): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/leads-crm-schemas.test.ts`:

```typescript
import {
  computeLeadScoreAndTemperature,
  computeLeadFirstResponseDueAt,
  computeLeadSlaState,
  validateLeadStatusTransition,
  buildWhatsAppFollowUpUrl,
  publicInquirySchema,
} from '@/lib/validation/leads-crm-schemas';

describe('Leads CRM Pure Scoring, SLA & Guardrail Engine', () => {
  test('computeLeadScoreAndTemperature scores high-intent urgent B2B cardiac inquiry as HOT (>= 70)', () => {
    const res = computeLeadScoreAndTemperature({
      urgencyLevel: 'URGENT',
      hasDiagnosticReports: true,
      medicalCondition: 'Severe triple vessel coronary artery disease requiring CABG evaluation',
      specialtyInterest: 'CARDIOLOGY',
      passportReady: true,
      preferredTravelWindow: 'IMMEDIATE_7D',
      estimatedBudgetUsd: 12000,
      source: 'B2B_PARTNER',
      email: 'patient@example.com',
      phone: '+96891234567',
    });
    expect(res.score).toBeGreaterThanOrEqual(85);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.temperature).toBe('HOT');
    expect(res.breakdown.length).toBeGreaterThanOrEqual(5);
  });

  test('computeLeadScoreAndTemperature classifies minimal browsing inquiry as COLD (< 40)', () => {
    const res = computeLeadScoreAndTemperature({
      urgencyLevel: 'ROUTINE',
      hasDiagnosticReports: false,
      medicalCondition: 'Knee pain',
      passportReady: false,
      preferredTravelWindow: 'EXPLORING',
      source: 'META_GOOGLE_ADS',
      phone: '+971501112233',
    });
    expect(res.score).toBeLessThan(40);
    expect(res.temperature).toBe('COLD');
  });

  test('computeLeadFirstResponseDueAt assigns 15m for URGENT, 60m for HOT/SEMI_URGENT, and 240m for ROUTINE', () => {
    const base = new Date('2026-11-25T10:00:00.000Z');
    expect(computeLeadFirstResponseDueAt('URGENT', 'WARM', base).toISOString()).toBe(
      '2026-11-25T10:15:00.000Z'
    );
    expect(computeLeadFirstResponseDueAt('ROUTINE', 'HOT', base).toISOString()).toBe(
      '2026-11-25T11:00:00.000Z'
    );
    expect(computeLeadFirstResponseDueAt('ROUTINE', 'COLD', base).toISOString()).toBe(
      '2026-11-25T14:00:00.000Z'
    );
  });

  test('computeLeadSlaState transitions across ACTIVE_WINDOW, DUE_SOON, BREACHED, RESPONDED_ON_TIME, and RESPONDED_LATE', () => {
    const due = new Date('2026-11-25T10:30:00.000Z');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:05:00.000Z'),
      })
    ).toBe('ACTIVE_WINDOW');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:20:00.000Z'),
      })
    ).toBe('DUE_SOON');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        status: 'NEW',
        now: new Date('2026-11-25T10:31:00.000Z'),
      })
    ).toBe('BREACHED');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        firstRespondedAt: new Date('2026-11-25T10:12:00.000Z'),
        status: 'CONTACTED',
      })
    ).toBe('RESPONDED_ON_TIME');
    expect(
      computeLeadSlaState({
        firstResponseDueAt: due,
        firstRespondedAt: new Date('2026-11-25T10:45:00.000Z'),
        status: 'CONTACTED',
      })
    ).toBe('RESPONDED_LATE');
  });

  test('validateLeadStatusTransition blocks LOST without lostReason, QUOTE_SHARED without quote/hospital, and manual CONVERTED', () => {
    expect(
      validateLeadStatusTransition({ currentStatus: 'NEW', nextStatus: 'LOST' }).allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'NEW',
        nextStatus: 'LOST',
        lostReason: 'PRICE_TOO_HIGH',
      }).allowed
    ).toBe(true);
    expect(
      validateLeadStatusTransition({ currentStatus: 'CLINICAL_REVIEW', nextStatus: 'QUOTE_SHARED' })
        .allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'CLINICAL_REVIEW',
        nextStatus: 'QUOTE_SHARED',
        preliminaryQuoteUsd: 6500,
      }).allowed
    ).toBe(true);
    expect(
      validateLeadStatusTransition({ currentStatus: 'QUALIFIED', nextStatus: 'CONVERTED' }).allowed
    ).toBe(false);
    expect(
      validateLeadStatusTransition({
        currentStatus: 'QUALIFIED',
        nextStatus: 'CONVERTED',
        viaConversionService: true,
      }).allowed
    ).toBe(true);
  });

  test('buildWhatsAppFollowUpUrl strips non-digits and encodes greeting safely', () => {
    const url = buildWhatsAppFollowUpUrl({
      phone: '+968 9123-4567',
      fullName: 'Tariq Al-Said',
      referenceNo: 'LD-2026-00102',
      coordinatorName: 'Priya Nair',
      specialty: 'CARDIOLOGY',
    });
    expect(url).toContain('https://wa.me/96891234567?text=');
    expect(url).toContain('LD-2026-00102');
  });

  test('publicInquirySchema requires phone or email and validates bounds', () => {
    const invalid = publicInquirySchema.safeParse({
      fullName: 'Tariq',
      nationality: 'Oman',
      medicalCondition: 'Need cardiac consult in New Delhi',
    });
    expect(invalid.success).toBe(false);

    const valid = publicInquirySchema.safeParse({
      fullName: 'Tariq Al-Said',
      phone: '+96891234567',
      nationality: 'Oman',
      medicalCondition: 'Need cardiac bypass second opinion and cost estimate',
      urgencyLevel: 'SEMI_URGENT',
    });
    expect(valid.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/leads-crm-schemas.test.ts`
Expected: FAIL with `Cannot find module '@/lib/validation/leads-crm-schemas'`.

- [ ] **Step 3: Add Prisma models, apply migration to TiDB, regenerate Prisma Client, and implement `leads-crm-schemas.ts`**

1. Extend `prisma/schema.prisma` with `LeadStatus`, `LeadSource`, `LeadTemperature`, `LeadActivityType`, `ReferralPartner`, `Lead`, `LeadActivity`, `Case.referralPartnerId`, and `User.managedLeads` / `User.leadActivities`.
2. Create `prisma/migrations/20261125160000_advanced_leads_crm/migration.sql` with `CREATE TABLE referral_partners`, `CREATE TABLE leads`, `CREATE TABLE lead_activities`, and `ALTER TABLE cases ADD COLUMN referral_partner_id VARCHAR(191) NULL` + foreign keys & indexes, then apply via `npx prisma migrate deploy; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx prisma generate`.
3. Add `LEAD_STATUS_LABELS`, `LEAD_SOURCE_LABELS`, `LEAD_LOST_REASON_LABELS`, and `MVT_SPECIALTY_OPTIONS` in `src/lib/constants.ts`, and `CREATE_LEAD`, `UPDATE_LEAD`, `CONVERT_LEAD`, `EXPORT_LEADS` in `src/lib/api/audit-logger.ts`.
4. Implement `src/lib/validation/leads-crm-schemas.ts` (strictly zero Prisma imports).

- [ ] **Step 4: Run test & typecheck to verify they pass**

Run: `npx jest src/lib/__tests__/leads-crm-schemas.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run typecheck`
Expected: PASS (`7/7` tests green, `0` TypeScript errors).

- [ ] **Step 5: Commit**

```powershell
git add prisma src/lib/constants.ts src/lib/api/audit-logger.ts src/lib/validation/leads-crm-schemas.ts src/lib/__tests__/leads-crm-schemas.test.ts
git commit -m "feat(leads-crm): add Leads, LeadActivity, ReferralPartner schema and pure scoring/SLA engine"
```

---

### Task 2: Lead Intake, Language Auto-Router, Deduplication, Activities, Referral Partners & REST APIs

**Files:**
- Modify: `src/lib/auth/rbac.ts`
- Create: `src/lib/services/leads-crm.service.ts`
- Create: `src/app/api/v1/public/inquiries/route.ts`
- Create: `src/app/api/v1/leads/route.ts`
- Create: `src/app/api/v1/leads/[id]/route.ts`
- Create: `src/app/api/v1/leads/[id]/activities/route.ts`
- Create: `src/app/api/v1/referral-partners/route.ts`
- Create: `src/app/api/v1/admin/export/leads/route.ts`
- Test: `src/lib/services/__tests__/leads-crm.service.test.ts`
- Test: `src/lib/__tests__/public-inquiry-route.test.ts`

**Interfaces:**
- Consumes: Schemas & pure helpers from `src/lib/validation/leads-crm-schemas.ts`, `sanitizeCsvCell` / `buildCsvString` from `src/lib/api/csv-helper.ts`
- Produces in `src/lib/services/leads-crm.service.ts`:
  - `capturePublicInquiry(input: unknown, meta: { ipAddress: string })`
  - `createStaffLead(input: unknown, actor: LeadActor)`
  - `importLeadsFromCsvRows(rows: unknown[], actor: LeadActor)`
  - `listLeadsForActor(query: LeadListQuery, actor: LeadActor)`
  - `getLeadDossierForActor(leadId: string, actor: LeadActor)`
  - `updateLeadForActor(leadId: string, input: unknown, actor: LeadActor)`
  - `logLeadActivityForActor(leadId: string, input: unknown, actor: LeadActor)`
  - `completeLeadFollowUpTask(leadId: string, activityId: string, actor: LeadActor)`
  - `findPotentialDuplicates(params: { email?: string | null; phone?: string | null; excludeLeadId?: string })`
  - `listReferralPartners(actor: LeadActor, options?: { activeOnly?: boolean })`
  - `createReferralPartner(input: unknown, actor: LeadActor)`
  - `updateReferralPartner(partnerId: string, input: unknown, actor: LeadActor)`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/services/__tests__/leads-crm.service.test.ts` and `src/lib/__tests__/public-inquiry-route.test.ts` covering:
1. `capturePublicInquiry`: resolves `?ref=OMAN-CARE-01` (`ReferralPartner.code`) → sets `source: 'B2B_PARTNER'` & `referralPartnerId`, assigns a coordinator matching `preferredLanguage: 'Arabic'` before higher-loaded non-matching coordinators, computes `leadScore` & `firstResponseDueAt`, silently drops honeypot-filled spam (`websiteUrl` non-empty) with a fake `200`, and blocks the 6th request from the same IP within 15 minutes with `429 RATE_LIMIT_EXCEEDED`.
2. `findPotentialDuplicates`: matches normalized email and normalized last-9 phone digits against both `Lead` and `Patient` (`User.email` / `User.phone`), returning masked duplicate summaries.
3. `logLeadActivityForActor`: logging the first outbound `WHATSAPP` or `PHONE_CALL` touchpoint automatically stamps `firstRespondedAt`, `lastContactedAt`, and advances `NEW → CONTACTED`.
4. Object-level RBAC: `MANAGER` can access own leads and unassigned (`assignedManagerId: null`) leads (and claim them), receives `403 FORBIDDEN` on another manager's lead, and `PATIENT`/`DOCTOR` receive `403 FORBIDDEN`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/services/__tests__/leads-crm.service.test.ts src/lib/__tests__/public-inquiry-route.test.ts`
Expected: FAIL with missing module errors.

- [ ] **Step 3: Implement `leads-crm.service.ts`, update `rbac.ts`, and create API routes**

1. Add `'/inquiry'` and `'/api/v1/public/inquiries'` to `PUBLIC_ROUTES` in `src/lib/auth/rbac.ts`, plus `'manage:leads': ['MANAGER', 'ADMIN']` and `'manage:referral-partners': ['ADMIN']`.
2. Implement `src/lib/services/leads-crm.service.ts` including reference generator (`LD-YYYY-XXXXXX`), language-affinity + least-open-workload coordinator router, phone/email deduplication, activity & follow-up task handlers, partner CRUD, and CSV export builder.
3. Implement route handlers under `/api/v1/public/inquiries`, `/api/v1/leads`, `/api/v1/leads/[id]`, `/api/v1/leads/[id]/activities`, `/api/v1/referral-partners`, and `/api/v1/admin/export/leads`.

- [ ] **Step 4: Run tests & typecheck to verify they pass**

Run: `npx jest src/lib/services/__tests__/leads-crm.service.test.ts src/lib/__tests__/public-inquiry-route.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/auth/rbac.ts src/lib/services/leads-crm.service.ts src/app/api/v1/public src/app/api/v1/leads src/app/api/v1/referral-partners src/app/api/v1/admin/export/leads src/lib/services/__tests__/leads-crm.service.test.ts src/lib/__tests__/public-inquiry-route.test.ts
git commit -m "feat(leads-api): add public inquiry intake, auto-routing, deduplication, activities, and B2B partner APIs"
```

---

### Task 3: Atomic 1-Click `Lead → Patient + Case` Conversion, Lead Nurture Campaigns & Funnel Analytics

**Files:**
- Create: `src/lib/services/leads-conversion.service.ts`
- Create: `src/app/api/v1/leads/[id]/convert/route.ts`
- Modify: `src/lib/services/analytics.service.ts`
- Modify: `src/lib/services/email-campaign.service.ts`
- Modify: `src/app/api/v1/admin/email-campaigns/route.ts`
- Modify: `src/app/api/v1/manager/dashboard/route.ts`
- Modify: `src/app/api/v1/admin/dashboard/route.ts`
- Test: `src/lib/services/__tests__/leads-conversion.service.test.ts`

**Interfaces:**
- Consumes: `buildStandardMvtPathwaySteps` from `src/lib/validation/lifecycle-schemas.ts`, `assertManagerCapacity` from `src/lib/services/system-settings.service.ts`, `encrypt` from `src/lib/auth/crypto.ts`, `formatPatientForViewer` from `src/lib/services/phi.service.ts`
- Produces in `src/lib/services/leads-conversion.service.ts`:
  - `convertLeadToPatientCase(leadId: string, input: unknown, actor: { userId: string; role: string; ipAddress?: string }): Promise<ServiceResult<{ leadId: string; patientId: string; caseId: string; userId: string; mode: 'NEW_PATIENT' | 'EXISTING_PATIENT'; generatedTemporaryPassword?: string }>>`
  - `computeLeadsCrmAnalytics(now?: Date): Promise<LeadsFunnelAnalyticsPayload>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/leads-conversion.service.test.ts` testing:
1. `NEW_PATIENT` conversion: encrypts `passportNo` with AES-256-GCM, checks `assertManagerCapacity`, creates `User` + `Patient` + `PatientMedicalProfile` + `Case` (with `referralPartnerId`, `hospitalId`, `primaryDoctorId`, and `status: 'UNDER_REVIEW'` when clinical team is provided) + `13` `ClinicalStep` rows (`Stage 1 Step 1 = IN_PROGRESS`), marks `Lead` `CONVERTED`, and rejects double-conversion with `409`.
2. `EXISTING_PATIENT` conversion: links a new `Case` + `13` `ClinicalStep` rows to an existing returning `Patient` without duplicating `User`/`Patient`, propagating `referralPartnerId` and preliminary clinical notes.
3. `computeLeadsCrmAnalytics`: calculates funnel stage counts, conversion rate %, average first-response minutes, SLA breach count, `lostReason` breakdown, and B2B `ReferralPartner` attributed `MedicalBill` revenue.
4. `findCampaignRecipients('LEADS_ACTIVE')`: deduplicates active non-converted/non-lost leads with valid email addresses for `LEADS_ACTIVE` nurture campaigns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/leads-conversion.service.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `leads-conversion.service.ts`, `/api/v1/leads/[id]/convert`, analytics funnel, and `LEADS_ACTIVE` campaign support**

1. Implement `convertLeadToPatientCase` and `computeLeadsCrmAnalytics` in `src/lib/services/leads-conversion.service.ts`.
2. Wire `POST /api/v1/leads/[id]/convert/route.ts`.
3. Extend `computePlatformAnalytics` in `src/lib/services/analytics.service.ts` with `leadsFunnel: await computeLeadsCrmAnalytics(now)` and expose `openLeads` / `slaBreachedLeads` in `/api/v1/manager/dashboard` & `/api/v1/admin/dashboard`.
4. Extend `src/lib/services/email-campaign.service.ts` and `src/app/api/v1/admin/email-campaigns/route.ts` to accept `LEADS_ACTIVE` in `targetRole` (sending sanitized HTML preview/log for external lead emails without violating `Notification.userId` FK).

- [ ] **Step 4: Run tests & typecheck to verify they pass**

Run: `npx jest src/lib/services/__tests__/leads-conversion.service.test.ts src/lib/services/__tests__/analytics.service.test.ts src/lib/services/__tests__/campaigns-and-csv.service.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/services/leads-conversion.service.ts src/app/api/v1/leads/\[id\]/convert src/lib/services/analytics.service.ts src/lib/services/email-campaign.service.ts src/app/api/v1/admin/email-campaigns/route.ts src/app/api/v1/manager/dashboard/route.ts src/app/api/v1/admin/dashboard/route.ts src/lib/services/__tests__/leads-conversion.service.test.ts
git commit -m "feat(leads-conversion): add atomic Lead-to-Patient+Case conversion, funnel analytics, and lead nurture campaigns"
```

---

### Task 4: Public 60-Second Medical Opinion & Estimate Portal (`/inquiry`)

**Files:**
- Create: `src/app/(auth)/inquiry/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

**Interfaces:**
- Consumes: `publicInquirySchema`, `PREFERRED_TRAVEL_WINDOWS` from `@/lib/validation/leads-crm-schemas`, `MVT_SPECIALTY_OPTIONS`, `COMMON_LANGUAGES` from `@/lib/constants`, `POST /api/v1/public/inquiries`

- [ ] **Step 1: Extend `public-inquiry-route.test.ts` with UTM / `?ref=` & Travel Window validation cases**

Verify `publicInquirySchema` normalizes empty optional strings, accepts `referralCode` + `utmSource`/`utmMedium`/`utmCampaign`, and enforces minimum medical description clarity.

- [ ] **Step 2: Run test to verify behavior**

Run: `npx jest src/lib/__tests__/public-inquiry-route.test.ts`

- [ ] **Step 3: Build `/inquiry` page and connect `/login` & `/register`**

1. Create `src/app/(auth)/inquiry/page.tsx` using Institutional Clinical styling (`rounded-lg` card, `rounded-md` inputs/buttons, `min-h-11` controls, `tabular-nums`):
   - Reads `?ref=`, `?utm_source=`, `?utm_medium=`, `?utm_campaign=` via `window.location.search` inside `useEffect` (`setTimeout(..., 0)`).
   - Collects `Full Name`, `WhatsApp / Phone` (`PhoneInput`), `Email`, `Nationality`, `Preferred Language`, `Medical Specialty`, `Urgency`, `Preferred Travel Window`, `Diagnostic Reports Ready` & `Passport Ready` checkboxes, and `Medical Condition / Treatment Goal` (plus visually hidden `websiteUrl` honeypot).
   - Displays an institutional confirmation receipt with `referenceNo` (`LD-2026-XXXXXX`), guaranteed response SLA (`15 mins` / `60 mins` / `4 hours`), and direct link to `/register` when ready to create a full patient portal account.
2. Add a clean secondary banner/link on `src/app/(auth)/login/page.tsx` and `src/app/(auth)/register/page.tsx`: `"Exploring treatment options or don't have your passport yet? Request a Free Medical Opinion & Cost Estimate →"`.

- [ ] **Step 4: Run lint, typecheck & tests**

Run: `npm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx jest src/lib/__tests__/public-inquiry-route.test.ts`
Expected: PASS (`0` lint/typecheck issues).

- [ ] **Step 5: Commit**

```powershell
git add src/app/\(auth\)/inquiry src/app/\(auth\)/login/page.tsx src/app/\(auth\)/register/page.tsx src/lib/__tests__/public-inquiry-route.test.ts
git commit -m "feat(public-inquiry): add low-friction international medical opinion & quote intake portal"
```

---

### Task 5: Coordinator & Admin Leads Pipeline (Kanban + Table), Lead Dossier & 1-Click Conversion Modal

**Files:**
- Create: `src/components/crm/LeadsPipelineWorkspace.tsx`
- Create: `src/components/crm/LeadDossierWorkspace.tsx`
- Create: `src/components/crm/ConvertLeadModal.tsx`
- Create: `src/app/(manager)/manager/leads/page.tsx`
- Create: `src/app/(manager)/manager/leads/[id]/page.tsx`
- Create: `src/app/(admin)/admin/leads/page.tsx`
- Create: `src/app/(admin)/admin/leads/[id]/page.tsx`
- Modify: `src/app/(manager)/manager/layout.tsx`
- Modify: `src/app/(admin)/admin/layout.tsx`

**Interfaces:**
- Consumes: `/api/v1/leads`, `/api/v1/leads/[id]`, `/api/v1/leads/[id]/activities`, `/api/v1/leads/[id]/convert`, `/api/v1/referral-partners`, `/api/v1/admin/export/leads`, and pure helpers from `@/lib/validation/leads-crm-schemas`

- [ ] **Step 1: Add integration test for full Dossier → Activity → Convert API flow**

Extend `src/lib/services/__tests__/leads-conversion.service.test.ts` to test `POST /api/v1/leads/[id]/convert` route handler end-to-end (`201` response returning `caseId` & `patientId`, `403` for unassigned manager).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/leads-conversion.service.test.ts`

- [ ] **Step 3: Implement `<LeadsPipelineWorkspace />`, `<LeadDossierWorkspace />`, `<ConvertLeadModal />`, portal pages, and sidebar navigation**

1. **`LeadsPipelineWorkspace.tsx` (`role: 'MANAGER' | 'ADMIN'`):**
   - 6-metric KPI & SLA Alert Bar (`New Unclaimed`, `SLA Breached / Due Soon`, `Follow-Ups Due`, `Hot Leads`, `Quotes Shared`, `Converted`).
   - Toggle between **Kanban Board** (grouped pipeline columns with score badge, SLA pill, source tag, 1-click `Claim` and `Open Dossier`) and **Triage Table** (search + `status`, `temperature`, `slaState`, `source`, `specialty` filters + `+ Log Inquiry` modal + Admin CSV Export / CSV Import modal).
2. **`LeadDossierWorkspace.tsx` (`role: 'MANAGER' | 'ADMIN'`):**
   - Header with Reference No, `HOT`/`WARM`/`COLD` + `leadScore/100` badge, live SLA status badge, `Open WhatsApp` (`buildWhatsAppFollowUpUrl`), and primary `Convert to Patient & Case` CTA (or `View Converted Case` link if `CONVERTED`).
   - Duplicate Detection Banner when `duplicates.patients.length > 0 || duplicates.leads.length > 0` with 1-click `Convert Under Existing Patient`.
   - Omnichannel Quick-Log Composer (`WHATSAPP`, `PHONE_CALL`, `EMAIL`, `QUOTE_ESTIMATE`, `FOLLOW_UP_SCHEDULED`, `NOTE`) + Activity & Follow-Up Checklist Timeline.
   - Right-rail Clinical & Preliminary Quote Editor (Target Hospital, Target Doctor, Preliminary Quote USD, Travel Window, B2B Partner Attribution, Status & Lost-Reason guardrails).
3. **`ConvertLeadModal.tsx`:**
   - Supports `NEW_PATIENT` (pre-filled fullName, email, phone, nationality, specialty, hospitalId, primaryDoctorId + Passport No, Passport Expiry `>=6m` warning, DOB) and `EXISTING_PATIENT` (one-click case creation on matched returning patient), redirecting on success to `/${role === 'ADMIN' ? 'admin' : 'manager'}/cases/${caseId}`.
4. Wire `/manager/leads`, `/manager/leads/[id]`, `/admin/leads`, `/admin/leads/[id]`, and add `Leads CRM` (with live open/SLA badge) to `ManagerLayout` & `AdminLayout`.

- [ ] **Step 4: Run lint, typecheck & tests**

Run: `npm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/crm src/app/\(manager\)/manager/leads src/app/\(admin\)/admin/leads src/app/\(manager\)/manager/layout.tsx src/app/\(admin\)/admin/layout.tsx src/lib/services/__tests__/leads-conversion.service.test.ts
git commit -m "feat(leads-ui): add Kanban & Table pipeline workspace, omnichannel lead dossier, and 1-click conversion modal"
```

---

### Task 6: B2B Referral Partners Console, Funnel Analytics UI, Dashboard SLA Widgets, Seed & Full Gate Verification

**Files:**
- Create: `src/app/(admin)/admin/referral-partners/page.tsx`
- Modify: `src/app/(admin)/admin/analytics/page.tsx`
- Modify: `src/app/(admin)/admin/email-campaigns/page.tsx`
- Modify: `src/app/(admin)/admin/dashboard/page.tsx`
- Modify: `src/app/(manager)/manager/dashboard/page.tsx`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `/api/v1/referral-partners`, `/api/v1/admin/analytics` (`leadsFunnel`), `/api/v1/admin/email-campaigns` (`LEADS_ACTIVE`)

- [ ] **Step 1: Add analytics & partner attribution test assertions**

Extend `src/lib/services/__tests__/analytics.service.test.ts` to assert `computePlatformAnalytics` returns `leadsFunnel` with `stageCounts`, `conversionRatePercent`, `slaBreachCount`, and `partnerPerformance`.

- [ ] **Step 2: Run test to inspect current state**

Run: `npx jest src/lib/services/__tests__/analytics.service.test.ts`

- [ ] **Step 3: Build `/admin/referral-partners`, enhance Analytics/Campaigns/Dashboards, and seed TiDB**

1. Create `src/app/(admin)/admin/referral-partners/page.tsx` (partner table, create/edit modal, active toggle, commission %, attributed leads/conversions, and 1-click copyable `/inquiry?ref=CODE` referral link) and add `Referral Partners` under `Partners` in `AdminLayout`.
2. Add the **Leads Acquisition & Conversion Funnel** + **B2B Referral Partner ROI** section to `src/app/(admin)/admin/analytics/page.tsx`.
3. Add `Active Pre-Conversion Leads (LEADS_ACTIVE)` to the audience selector in `src/app/(admin)/admin/email-campaigns/page.tsx`.
4. Add `Active Leads` & `SLA Attention` KPI cards + quick links on `src/app/(manager)/manager/dashboard/page.tsx` and `src/app/(admin)/admin/dashboard/page.tsx`.
5. Update `prisma/seed.ts` to upsert 3 `ReferralPartner` records (`Gulf MedConnect Muscat`, `Nairobi Heart & Ortho Clinic`, `Embassy Medical Desk Baghdad`), 6 realistic international `Lead` records across `NEW`, `CONTACTED`, `CLINICAL_REVIEW`, `QUOTE_SHARED`, `CONVERTED` (linked to `seed-case-002`), and `LOST`, plus `LeadActivity` timelines, then run `npm run db:seed`.

- [ ] **Step 4: Run full project verification gates**

```powershell
$hits = Get-ChildItem -Path src/app,src/components -Recurse -Filter *.tsx | Select-String -Pattern 'rounded-3xl|rounded-2xl|font-black|font-extrabold|backdrop-blur|hover:-translate-y|bg-gradient-to-'
Write-Host "LEGACY_TOKEN_HITS=$($hits.Count)"
if ($hits.Count -gt 0) { exit 1 }
npm run db:seed; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "C:\Users\Admin\.gemini\config\skills\impeccable\scripts\impeccable.cmd" detect --json "src/app" "src/components"
```
Expected: `LEGACY_TOKEN_HITS=0`, `db:seed` exit `0`, `0` lint/typecheck errors, `100%` Jest suites green, `next build` succeeds across all routes, and `impeccable detect` returns `[]`.

- [ ] **Step 5: Commit**

```powershell
git add src/app/\(admin\)/admin/referral-partners src/app/\(admin\)/admin/analytics/page.tsx src/app/\(admin\)/admin/email-campaigns/page.tsx src/app/\(admin\)/admin/dashboard/page.tsx src/app/\(manager\)/manager/dashboard/page.tsx prisma/seed.ts src/lib/services/__tests__/analytics.service.test.ts
git commit -m "feat(leads-analytics): add B2B Referral Partners console, funnel analytics, campaign integration, and CRM seed"
```

