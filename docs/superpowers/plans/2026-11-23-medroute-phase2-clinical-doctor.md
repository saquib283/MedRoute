# MedRoute Sub-Project 2: Clinical Pathway, Doctor Portal & Clearances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete `(doctor)` portal, inline/linked Doctor login provisioning, multi-role Clinical Pathway builder and milestone sign-off, patient document verification, official hospital/clinical PDF certificate issuance (`VIL`, `Pro-Forma`, `Fit-to-Fly`), and appointment lifecycle completion.

**Architecture:** Case-scoped clinical operations are centralized in two domain services (`src/lib/services/clinical-pathway.service.ts` and `src/lib/services/clinical-certificate.service.ts`) enforcing strict object-level RBAC across `ADMIN`, assigned `MANAGER`, treating `DOCTOR`, and owning `PATIENT`, exposed via neutral `/api/v1/cases/[id]/*`, `/api/v1/pathway-templates`, and `/api/v1/documents/[id]/verify` routes (with `/api/v1/admin/*` pathway routes preserved as delegating wrappers). A dependency-free `%PDF-1.4` certificate builder produces valid downloadable PDFs in `storage/uploads/` whenever official documents or Fit-to-Fly clearances are issued without an uploaded scan.

**Tech Stack:** Next.js 16.2.9 (App Router, `src/proxy.ts`, async `params`), React 19, TypeScript 5, Prisma 6.19 (MySQL), Zod 4, Jest 30 (`ts-jest`), Tailwind CSS 4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-23-medroute-phase2-clinical-doctor-design.md`

## Global Constraints

- **Next.js 16 Export Rules (`AGENTS.md`):** App Router `route.ts` files MUST ONLY export HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). Never export schemas, types, constants, or helper functions from `route.ts` or `src/proxy.ts` — put all shared types/helpers in `src/lib/*` or `src/components/*`. Dynamic route `params` are `Promise<{ id: string }>` (`const { id } = await params;` on server or `use(params)` on client).
- **Database & Env Safety:** Never run `prisma migrate reset`, `DROP`, or modify `.env`. Use the singleton `import prisma from '@/lib/prisma';` everywhere in `src/` (never `new PrismaClient()`).
- **UTF-8 Encoding:** Write all files as UTF-8 **without BOM** (`\uFEFF`).
- **Error Codes & Responses:** Use `ERROR_CODES` from `@/lib/api/errors` (`USER_ALREADY_EXISTS`, `FORBIDDEN`, `BAD_REQUEST`, `CASE_NOT_FOUND`, `CASE_ALREADY_CLOSED`, `DOCUMENT_NOT_FOUND`, `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_ALREADY_CANCELLED`, `CANCELLATION_REASON_REQUIRED`, `NOT_FOUND`, `INTERNAL_ERROR`) with `apiSuccess` / `apiError` from `@/lib/api/response`.
- **ePHI & Upload Safety:** Format patient records for staff viewers with `formatPatientForViewer(patient, { maskPassport: true })` (`@/lib/services/phi.service`). Validate all uploaded files through `saveValidatedUpload` (`@/lib/services/document-storage.service`) and clean up disk files via `removeStoredFile` if DB writes fail.

---

### Task 1: RBAC, Audit Actions, Doctor Provisioning & Appointment Lifecycle Hardening

**Files:**
- Modify: `src/lib/auth/rbac.ts`
- Modify: `src/lib/api/audit-logger.ts`
- Modify: `src/lib/validation/booking-helpers.ts`
- Modify: `src/app/api/v1/admin/doctors/route.ts`
- Modify: `src/app/(admin)/admin/doctors/page.tsx`
- Modify: `src/app/api/v1/patient/appointments/route.ts`
- Modify: `src/app/(patient)/patient/appointments/page.tsx`
- Modify: `src/app/api/v1/manager/appointments/route.ts`
- Modify: `src/app/api/v1/admin/appointments/route.ts`
- Modify: `src/app/(manager)/manager/appointments/page.tsx`
- Modify: `src/app/(admin)/admin/appointments/page.tsx`
- Test: `src/lib/__tests__/doctor-and-appointments.test.ts`

**Interfaces:**
- Consumes: `hashPassword` from `@/lib/auth`, `prisma` from `@/lib/prisma`, `requireAuth` & `getClientIP` from `@/lib/api/auth-helper`.
- Produces:
  - `PERMISSIONS` keys in `src/lib/auth/rbac.ts`: `'view:case'`, `'sign:clinical-pathway'`, `'sign:fit-to-fly'`, `'verify:documents'`, `'issue:documents'`, `'update:clinical-appointments'`.
  - `AUDIT_ACTIONS` keys in `src/lib/api/audit-logger.ts`: `CONFIGURE_PATHWAY`, `UPDATE_PATHWAY_STEP`, `VERIFY_DOCUMENT`, `ISSUE_DOCUMENT`, `SIGN_FIT_TO_FLY`.
  - `formatDoctorDisplayName(fullName: string): string` and `isDoctorAvailableOnDate(availableDays: unknown, scheduledAt: Date): boolean` in `src/lib/validation/booking-helpers.ts`.

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/__tests__/doctor-and-appointments.test.ts`)**

```typescript
import { NextRequest } from 'next/server';
import { hasPermission } from '@/lib/auth/rbac';
import { AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import {
  formatDoctorDisplayName,
  isDoctorAvailableOnDate,
} from '@/lib/validation/booking-helpers';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    doctor: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hospital: {
      findUnique: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import { POST as createDoctorAdmin } from '@/app/api/v1/admin/doctors/route';
import {
  POST as requestPatientAppointment,
  PUT as cancelPatientAppointment,
} from '@/app/api/v1/patient/appointments/route';
import { PUT as updateManagerAppointment } from '@/app/api/v1/manager/appointments/route';

const mockedPrisma = prisma as unknown as {
  user: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  hospital: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  case: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

describe('Task 1: Doctor RBAC, Provisioning & Appointment Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants clinical permissions to DOCTOR and exposes Sub-project 2 audit actions', () => {
    expect(hasPermission('DOCTOR', 'view:case')).toBe(true);
    expect(hasPermission('DOCTOR', 'sign:clinical-pathway')).toBe(true);
    expect(hasPermission('DOCTOR', 'sign:fit-to-fly')).toBe(true);
    expect(hasPermission('DOCTOR', 'issue:documents')).toBe(true);
    expect(hasPermission('DOCTOR', 'verify:documents')).toBe(false);
    expect(hasPermission('MANAGER', 'verify:documents')).toBe(true);
    expect(AUDIT_ACTIONS.CONFIGURE_PATHWAY).toBe('CONFIGURE_PATHWAY');
    expect(AUDIT_ACTIONS.SIGN_FIT_TO_FLY).toBe('SIGN_FIT_TO_FLY');
  });

  it('formats doctor display names without duplicating Dr. prefix and checks availableDays', () => {
    expect(formatDoctorDisplayName('Dr. Ashok Seth')).toBe('Dr. Ashok Seth');
    expect(formatDoctorDisplayName('dr. Priya Nair')).toBe('Dr. Priya Nair');
    expect(formatDoctorDisplayName('Ramesh Kumar')).toBe('Dr. Ramesh Kumar');

    // 2026-11-23 is a Monday (UTC day 1 -> MON)
    const monday = new Date('2026-11-23T10:00:00.000Z');
    const sunday = new Date('2026-11-22T10:00:00.000Z');
    expect(isDoctorAvailableOnDate(['MON', 'WED', 'FRI'], monday)).toBe(true);
    expect(isDoctorAvailableOnDate(['MON', 'WED', 'FRI'], sunday)).toBe(false);
    expect(isDoctorAvailableOnDate([], sunday)).toBe(true);
  });

  it('provisions a new DOCTOR User + Doctor profile atomically when createAccount=true', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'usr-doc-1',
            email: 'newdoc@afzalhealthcare.in',
            role: 'DOCTOR',
          }),
        },
        doctor: {
          create: jest.fn().mockResolvedValue({
            id: 'doc-1',
            fullName: 'Dr. Meera Rao',
            hospitalId: 'hosp-1',
            userId: 'usr-doc-1',
          }),
        },
      })
    );

    const req = new NextRequest('http://localhost/api/v1/admin/doctors', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@afzalhealthcare.in',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        fullName: 'Dr. Meera Rao',
        hospitalId: 'hosp-1',
        specialisationId: 'spec-1',
        createAccount: true,
        email: 'newdoc@afzalhealthcare.in',
        password: 'DoctorPassword123!',
      }),
    });

    const res = await createDoctorAdmin(req);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.doctor.userId).toBe('usr-doc-1');
  });

  it('blocks PATIENT from directly self-booking SURGERY and enforces doctor availableDays', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });

    const surgeryReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        caseId: 'case-1',
        hospitalId: 'hosp-1',
        doctorId: 'doc-1',
        appointmentType: 'SURGERY',
        scheduledAt: '2026-11-23T10:00:00.000Z',
      }),
    });

    const surgeryRes = await requestPatientAppointment(surgeryReq);
    expect(surgeryRes.status).toBe(400);

    // Unavailable day (Sunday when doctor only works MON)
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      patientId: 'pat-1',
      status: 'PLAN_CONFIRMED',
    });
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      hospitalId: 'hosp-1',
      isActive: true,
      availableDays: ['MON'],
    });
    mockedPrisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1', isActive: true });

    const unavailableReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        caseId: 'case-1',
        hospitalId: 'hosp-1',
        doctorId: 'doc-1',
        appointmentType: 'CONSULTATION',
        scheduledAt: '2026-11-22T10:00:00.000Z',
      }),
    });

    const unavailableRes = await requestPatientAppointment(unavailableReq);
    expect(unavailableRes.status).toBe(400);
  });

  it('allows PATIENT self-cancellation with reason and exempts ADMIN on PUT /api/v1/manager/appointments', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      id: 'appt-1',
      patientId: 'pat-1',
      status: 'SCHEDULED',
    });
    mockedPrisma.appointment.update.mockResolvedValueOnce({
      id: 'appt-1',
      status: 'CANCELLED',
      cancellationReason: 'Flight delayed',
    });

    const cancelReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        appointmentId: 'appt-1',
        cancellationReason: 'Flight delayed',
      }),
    });

    const cancelRes = await cancelPatientAppointment(cancelReq);
    expect(cancelRes.status).toBe(200);

    // Admin updating an appointment whose case belongs to a different manager
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      id: 'appt-2',
      status: 'CONFIRMED',
      case: { id: 'case-1', managerId: 'mgr-other' },
    });
    mockedPrisma.appointment.update.mockResolvedValueOnce({
      id: 'appt-2',
      status: 'COMPLETED',
      clinicalNotes: 'Procedure successful',
    });

    const adminPutReq = new Request('http://localhost/api/v1/manager/appointments', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        appointmentId: 'appt-2',
        status: 'COMPLETED',
        clinicalNotes: 'Procedure successful',
      }),
    });

    const adminPutRes = await updateManagerAppointment(adminPutReq);
    expect(adminPutRes.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/doctor-and-appointments.test.ts`
Expected: FAIL (`formatDoctorDisplayName` is not a function / `hasPermission('DOCTOR', 'view:case')` is `false`).

- [ ] **Step 3: Implement RBAC, audit actions, booking helpers, Doctor account provisioning & Appointment fixes**

1. In `src/lib/auth/rbac.ts`, update `'view:case'` to `['PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR']` and add permissions:
   ```typescript
   'sign:clinical-pathway': ['DOCTOR', 'MANAGER', 'ADMIN'],
   'sign:fit-to-fly': ['DOCTOR', 'ADMIN'],
   'verify:documents': ['MANAGER', 'ADMIN'],
   'issue:documents': ['MANAGER', 'DOCTOR', 'ADMIN'],
   'update:clinical-appointments': ['DOCTOR', 'MANAGER', 'ADMIN'],
   ```
2. In `src/lib/api/audit-logger.ts`, append to `AUDIT_ACTIONS`:
   ```typescript
   CONFIGURE_PATHWAY: 'CONFIGURE_PATHWAY',
   UPDATE_PATHWAY_STEP: 'UPDATE_PATHWAY_STEP',
   VERIFY_DOCUMENT: 'VERIFY_DOCUMENT',
   ISSUE_DOCUMENT: 'ISSUE_DOCUMENT',
   SIGN_FIT_TO_FLY: 'SIGN_FIT_TO_FLY',
   ```
3. In `src/lib/validation/booking-helpers.ts`, export:
   ```typescript
   const UTC_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

   export function formatDoctorDisplayName(fullName: string): string {
     const trimmed = (fullName || '').trim();
     if (!trimmed) return 'Dr.';
     if (/^dr\.?\s+/i.test(trimmed)) {
       return trimmed.replace(/^dr\.?\s+/i, 'Dr. ');
     }
     return `Dr. ${trimmed}`;
   }

   export function isDoctorAvailableOnDate(
     availableDays: unknown,
     scheduledAt: Date
   ): boolean {
     if (!Array.isArray(availableDays) || availableDays.length === 0) {
       return true;
     }
     const normalized = availableDays
       .filter((d): d is string => typeof d === 'string')
       .map((d) => d.trim().toUpperCase());
     if (normalized.length === 0) return true;
     const utcDay = UTC_DAYS[scheduledAt.getUTCDay()];
     const localDay = UTC_DAYS[scheduledAt.getDay()];
     return normalized.includes(utcDay) || normalized.includes(localDay);
   }
   ```
4. Update `src/app/api/v1/admin/doctors/route.ts`:
   - In `GET`, select `hospitalId`, `specialisationId`, `userId`, `hospital: { select: { id: true, name: true, city: true } }`, `specialisation: { select: { id: true, name: true } }`, `user: { select: { id: true, email: true, fullName: true } }`. When `searchParams.get('meta') === 'true'`, also query `unlinkedDoctorUsers = await prisma.user.findMany({ where: { role: 'DOCTOR', isActive: true, doctor: null }, select: { id: true, email: true, fullName: true } })` and return `{ doctors, unlinkedDoctorUsers }`.
   - Extend `doctorSchema` with `userId: z.string().nullable().optional()`, `createAccount: z.boolean().optional()`, `email: z.string().email().optional()`, `password: z.string().min(8).optional()`.
   - In `POST` & `PUT`:
     - When `createAccount === true`: require `email` and `password` (`400 BAD_REQUEST` if missing), check `prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })` (`409 USER_ALREADY_EXISTS` if exists), hash with `hashPassword(password)`, and create `User` (`role: 'DOCTOR'`, `fullName`, `isActive: true`) + create/update `Doctor` (`userId: newUser.id`) inside `prisma.$transaction`.
     - When `userId` is a non-empty string: verify `User` exists with `role === 'DOCTOR'` (`400 BAD_REQUEST` if not) and no other `Doctor` (`id: { not: currentDoctorId }`) already binds `userId` (`409 USER_ALREADY_EXISTS` if already linked).
5. Update `src/app/(admin)/admin/doctors/page.tsx`:
   - Fetch `/api/v1/admin/doctors?meta=true` so `unlinkedDoctorUsers` is loaded, preserve `hospitalId`, `specialisationId`, and `userId` in `openEdit(d)` (and allow updating `hospitalId` + `specialisationId` on `PUT`), display linked `d.user?.email` badge in the table, and add a `Portal Login Account` mode selector (`none` | `link` | `create` with `email` + `password` inputs).
6. Update `src/app/api/v1/patient/appointments/route.ts` and `src/app/(patient)/patient/appointments/page.tsx`:
   - In `POST /api/v1/patient/appointments`, reject `appointmentType === 'SURGERY'` (`400 BAD_REQUEST`: `'Surgical procedures must be scheduled by your Case Manager'`), validate `!isNaN(scheduledDate.getTime())`, and check `isDoctorAvailableOnDate(doctor.availableDays, scheduledDate)` (`400 SLOT_UNAVAILABLE`: `'Doctor is not available on the selected day'`).
   - Add `PUT /api/v1/patient/appointments` accepting `{ appointmentId: z.string().min(1), cancellationReason: z.string().trim().min(3).max(1000) }`, verifying `appointment.patientId === patient.id` (`404` otherwise) and `appointment.status` is not `'CANCELLED'` or `'COMPLETED'` (`400` otherwise), updating `status: 'CANCELLED'` and `cancellationReason`, and returning `apiSuccess({ appointment: updated })`.
   - In `src/app/(patient)/patient/appointments/page.tsx`, remove `'SURGERY'` from `APPOINTMENT_TYPE_OPTIONS`, use `formatDoctorDisplayName(d.fullName)` everywhere doctor names render, and add a `"Cancel"` button + modal calling `PUT /api/v1/patient/appointments` on non-cancelled, non-completed appointments.
7. Update Manager & Admin Appointments (`src/app/api/v1/manager/appointments/route.ts`, `src/app/api/v1/admin/appointments/route.ts`, `src/app/(manager)/manager/appointments/page.tsx`, `src/app/(admin)/admin/appointments/page.tsx`):
   - In `src/app/api/v1/manager/appointments/route.ts`: validate `scheduledAt` with `.refine((d) => !isNaN(d.getTime()), 'Invalid date')`, add `clinicalNotes: z.string().max(10000).optional()` to `updateAppointmentSchema`, include `clinicalNotes` in `GET` (and allow `ADMIN` to list all appointments when `userRole === 'ADMIN'`), and change line 205 to `if (!appointmentRecord || (userRole === 'MANAGER' && appointmentRecord.case.managerId !== userId))`.
   - In `src/app/api/v1/admin/appointments/route.ts`: add `clinicalNotes: z.string().max(10000).optional()` to `updateApptSchema` and persist `data.clinicalNotes = updateData.clinicalNotes` when provided.
   - In `src/app/(admin)/admin/appointments/page.tsx`: replace `selectedAppt.notes` with `selectedAppt.clinicalNotes`, use `formatDoctorDisplayName`, and add quick status buttons (`Confirm`, `Mark In Progress`, `Mark Completed`) + `clinicalNotes` textarea in the detail modal.
   - In `src/app/(manager)/manager/appointments/page.tsx`: use `formatDoctorDisplayName` and add quick status action buttons (`Confirm`, `Complete`) + `clinicalNotes` display on appointment cards.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/__tests__/doctor-and-appointments.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/rbac.ts src/lib/api/audit-logger.ts src/lib/validation/booking-helpers.ts src/app/api/v1/admin/doctors/route.ts "src/app/(admin)/admin/doctors/page.tsx" src/app/api/v1/patient/appointments/route.ts "src/app/(patient)/patient/appointments/page.tsx" src/app/api/v1/manager/appointments/route.ts src/app/api/v1/admin/appointments/route.ts "src/app/(manager)/manager/appointments/page.tsx" "src/app/(admin)/admin/appointments/page.tsx" src/lib/__tests__/doctor-and-appointments.test.ts
git commit -m "feat(doctors,appointments): add doctor login provisioning, RBAC permissions, and appointment lifecycle guards"
```

---

### Task 2: Multi-Role Clinical Pathway Service, Neutral Endpoints & Shared Pathway Builder

**Files:**
- Create: `src/lib/services/clinical-pathway.service.ts`
- Create: `src/app/api/v1/pathway-templates/route.ts`
- Create: `src/app/api/v1/cases/[id]/pathway/route.ts`
- Modify: `src/app/api/v1/admin/pathway-templates/route.ts`
- Modify: `src/app/api/v1/admin/cases/[id]/pathway/route.ts`
- Create: `src/components/clinical/PathwayBuilderEditor.tsx`
- Modify: `src/app/(manager)/manager/cases/[id]/pathway/page.tsx`
- Create: `src/app/(admin)/admin/cases/[id]/pathway/page.tsx`
- Test: `src/lib/services/__tests__/clinical-pathway.service.test.ts`

**Interfaces:**
- Consumes: `AUDIT_ACTIONS` (`CONFIGURE_PATHWAY`, `UPDATE_PATHWAY_STEP`) from Task 1, `formatPatientForViewer` from `@/lib/services/phi.service`, `CASE_STATUS_ORDER` from `@/lib/constants`.
- Produces (`src/lib/services/clinical-pathway.service.ts`):
  - `PRESET_TEMPLATES: PathwayPresetTemplate[]`
  - `authorizeCaseClinicalAccess(caseId: string, actor: { userId: string; role: string }): Promise<CaseAccessResult>`
  - `getCasePathwayForViewer(caseId: string, actor: { userId: string; role: string }): Promise<ServiceResult<{ case: unknown }>>`
  - `replaceCasePathway(params: ReplacePathwayParams): Promise<ServiceResult<{ case: unknown }>>`
  - `updateSinglePathwayStep(params: UpdateStepParams): Promise<ServiceResult<{ step: unknown }>>`

- [ ] **Step 1: Write the failing unit tests (`src/lib/services/__tests__/clinical-pathway.service.test.ts`)**

```typescript
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    clinicalStep: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  authorizeCaseClinicalAccess,
  replaceCasePathway,
  updateSinglePathwayStep,
  PRESET_TEMPLATES,
} from '@/lib/services/clinical-pathway.service';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

const baseCase = {
  id: 'case-1',
  patientId: 'pat-1',
  managerId: 'mgr-1',
  status: 'PLAN_CONFIRMED',
  patient: {
    id: 'pat-1',
    userId: 'pat-user-1',
    assignedManagerId: 'mgr-1',
    passportNo: null,
    user: { fullName: 'Ali Hassan', email: 'ali@example.com' },
    medicalProfile: null,
  },
  clinicalSteps: [],
  fitToFlyClearance: null,
};

describe('Task 2: Clinical Pathway Service & Multi-Role Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes 3 specialty preset templates with actionType and requiredRole metadata', () => {
    expect(PRESET_TEMPLATES.map((t) => t.id)).toEqual([
      'CARDIOLOGY',
      'ONCOLOGY',
      'ORTHOPEDICS',
    ]);
    expect(PRESET_TEMPLATES[0].steps.some((s) => s.actionType === 'ISSUE_VIL')).toBe(true);
  });

  it('enforces object-level case access across ADMIN, assigned MANAGER, treating DOCTOR, and PATIENT', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCase);

    const adminRes = await authorizeCaseClinicalAccess('case-1', { userId: 'adm-1', role: 'ADMIN' });
    expect(adminRes.ok).toBe(true);

    const assignedMgr = await authorizeCaseClinicalAccess('case-1', { userId: 'mgr-1', role: 'MANAGER' });
    expect(assignedMgr.ok).toBe(true);

    const wrongMgr = await authorizeCaseClinicalAccess('case-1', { userId: 'mgr-2', role: 'MANAGER' });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);

    // Doctor with active appointment vs doctor without appointment
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-user-1',
      fullName: 'Dr. Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({ id: 'appt-1' });
    const treatingDoc = await authorizeCaseClinicalAccess('case-1', {
      userId: 'doc-user-1',
      role: 'DOCTOR',
    });
    expect(treatingDoc.ok).toBe(true);

    mockedPrisma.appointment.findFirst.mockResolvedValueOnce(null);
    const unrelatedDoc = await authorizeCaseClinicalAccess('case-1', {
      userId: 'doc-user-1',
      role: 'DOCTOR',
    });
    expect(unrelatedDoc.ok).toBe(false);
    if (!unrelatedDoc.ok) expect(unrelatedDoc.status).toBe(403);
  });

  it('persists actionType, requiredRole, and actionUrl in replaceCasePathway and blocks CLOSED cases', async () => {
    mockedPrisma.case.findUnique.mockResolvedValueOnce({ ...baseCase, status: 'CLOSED' });
    const closedRes = await replaceCasePathway({
      caseId: 'case-1',
      steps: [
        {
          stageName: 'Stage 1',
          stageOrder: 1,
          stepOrder: 1,
          title: 'VIL Step',
          category: 'PRE_OP',
          status: 'PENDING',
        },
      ],
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(closedRes.ok).toBe(false);
    if (!closedRes.ok) expect(closedRes.code).toBe('CASE_ALREADY_CLOSED');

    const createdPayloads: unknown[] = [];
    mockedPrisma.case.findUnique
      .mockResolvedValueOnce(baseCase)
      .mockResolvedValueOnce({ ...baseCase, clinicalSteps: [] });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        clinicalStep: {
          deleteMany: jest.fn(),
          create: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => {
            createdPayloads.push(data);
            return data;
          }),
        },
        case: { update: jest.fn() },
      })
    );

    const saveRes = await replaceCasePathway({
      caseId: 'case-1',
      steps: [
        {
          stageName: 'Stage 3: VIL',
          stageOrder: 3,
          stepOrder: 1,
          title: 'Issue VIL',
          category: 'PRE_OP',
          status: 'PENDING',
          actionType: 'ISSUE_VIL',
          requiredRole: 'MANAGER',
          actionUrl: '/patient/documents',
        },
      ],
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });

    expect(saveRes.ok).toBe(true);
    expect(createdPayloads[0]).toMatchObject({
      actionType: 'ISSUE_VIL',
      requiredRole: 'MANAGER',
      actionUrl: '/patient/documents',
    });
  });

  it('enforces DOCTOR vs MANAGER requiredRole boundaries in updateSinglePathwayStep', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCase);
    mockedPrisma.clinicalStep.findUnique.mockResolvedValue({
      id: 'step-doc',
      caseId: 'case-1',
      title: 'Sign PAC',
      status: 'PENDING',
      requiredRole: 'DOCTOR',
    });

    // Manager blocked from completing DOCTOR-required step
    const mgrAttempt = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-doc',
      status: 'COMPLETED',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(mgrAttempt.ok).toBe(false);
    if (!mgrAttempt.ok) expect(mgrAttempt.status).toBe(403);

    // Treating doctor succeeds
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-user-1',
      fullName: 'Dr. Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });
    mockedPrisma.clinicalStep.update.mockResolvedValue({
      id: 'step-doc',
      caseId: 'case-1',
      status: 'COMPLETED',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
    });

    const docAttempt = await updateSinglePathwayStep({
      caseId: 'case-1',
      stepId: 'step-doc',
      status: 'COMPLETED',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
      doctorNotes: 'PAC cleared.',
      actor: { userId: 'doc-user-1', role: 'DOCTOR' },
    });
    expect(docAttempt.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/clinical-pathway.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/services/clinical-pathway.service'`).

- [ ] **Step 3: Implement `clinical-pathway.service.ts`, neutral & admin routes, and shared `PathwayBuilderEditor`**

1. Create `src/lib/services/clinical-pathway.service.ts`:
   - Move `PRESET_TEMPLATES`, `PresetStageStep`, and `PathwayPresetTemplate` here.
   - Implement `authorizeCaseClinicalAccess(caseId, actor)`:
     - Fetch `Case` including `patient: { include: { user: { select: { fullName: true, email: true, phone: true } }, medicalProfile: true } }`, `clinicalSteps` ordered by `[{ stageOrder: 'asc' }, { stepOrder: 'asc' }, { createdAt: 'asc' }]`, and `fitToFlyClearance: true`. Return `{ ok: false, code: ERROR_CODES.CASE_NOT_FOUND, message: 'Case not found', status: 404 }` if missing.
     - Authorize:
       - `ADMIN`: allowed (`doctorProfile: null`).
       - `MANAGER`: allowed iff `targetCase.managerId === actor.userId || targetCase.patient.assignedManagerId === actor.userId`.
       - `DOCTOR`: look up `prisma.doctor.findUnique({ where: { userId: actor.userId } })`; require `doctor && doctor.isActive` and `await prisma.appointment.findFirst({ where: { caseId, doctorId: doctor.id, status: { not: 'CANCELLED' } }, select: { id: true } })`; return `doctorProfile: doctor`.
       - `PATIENT`: allowed iff `targetCase.patient.userId === actor.userId`.
       - Otherwise `{ ok: false, code: ERROR_CODES.FORBIDDEN, message: 'Access denied for this clinical case', status: 403 }`.
   - Implement `getCasePathwayForViewer`, `replaceCasePathway` (Zod-validating `steps` min 1 item and optional `caseStatus` against `CASE_STATUS_ORDER`, persisting `actionType`, `requiredRole`, and `actionUrl`, rejecting `CLOSED` cases with `ERROR_CODES.CASE_ALREADY_CLOSED`, and logging `AUDIT_ACTIONS.CONFIGURE_PATHWAY`), and `updateSinglePathwayStep` (verifying `step.caseId === caseId`, rejecting `CLOSED` cases, blocking `MANAGER` when `step.requiredRole === 'DOCTOR'`, blocking `DOCTOR` when `step.requiredRole === 'MANAGER' || step.requiredRole === 'PATIENT'`, setting `completedAt`, and logging `AUDIT_ACTIONS.UPDATE_PATHWAY_STEP`).
2. Create `src/app/api/v1/pathway-templates/route.ts` (`GET` allowing `ADMIN`, `MANAGER`, `DOCTOR`) and `src/app/api/v1/cases/[id]/pathway/route.ts` (`GET`, `POST`, `PATCH`).
3. Refactor `src/app/api/v1/admin/pathway-templates/route.ts` (import `PRESET_TEMPLATES` from `@/lib/services/clinical-pathway.service`, require `ADMIN` role) and `src/app/api/v1/admin/cases/[id]/pathway/route.ts` (require `ADMIN` role, delegate to `getCasePathwayForViewer` and `replaceCasePathway` — NO non-HTTP exports in either `route.ts`!).
4. Create `src/components/clinical/PathwayBuilderEditor.tsx`:
   - Extract the builder UI from `src/app/(manager)/manager/cases/[id]/pathway/page.tsx`, update fetches to `/api/v1/pathway-templates` and `/api/v1/cases/${caseId}/pathway`, add a `Responsible Role` (`requiredRole`: `'' | 'PATIENT' | 'MANAGER' | 'DOCTOR' | 'ADMIN'`) selector on each milestone step, accept `{ caseId: string; backHref: string; backLabel: string }`, and remove unused icon imports.
5. Update `src/app/(manager)/manager/cases/[id]/pathway/page.tsx` and create `src/app/(admin)/admin/cases/[id]/pathway/page.tsx` to render `<PathwayBuilderEditor />` with `backHref="/manager/cases"` and `backHref="/admin/cases"` respectively.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/clinical-pathway.service.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/clinical-pathway.service.ts src/app/api/v1/pathway-templates/route.ts "src/app/api/v1/cases/[id]/pathway/route.ts" src/app/api/v1/admin/pathway-templates/route.ts "src/app/api/v1/admin/cases/[id]/pathway/route.ts" src/components/clinical/PathwayBuilderEditor.tsx "src/app/(manager)/manager/cases/[id]/pathway/page.tsx" "src/app/(admin)/admin/cases/[id]/pathway/page.tsx" src/lib/services/__tests__/clinical-pathway.service.test.ts
git commit -m "feat(pathway): add multi-role clinical pathway service, preserve step metadata, and share builder UI"
```

---

### Task 3: Deterministic PDF Certificate Generator, Document Verification, VIL Issuance & Fit-to-Fly Service

**Files:**
- Modify: `src/lib/services/document-storage.service.ts`
- Create: `src/lib/services/clinical-certificate.service.ts`
- Create: `src/app/api/v1/documents/[id]/verify/route.ts`
- Create: `src/app/api/v1/cases/[id]/documents/route.ts`
- Create: `src/app/api/v1/cases/[id]/fit-to-fly/route.ts`
- Test: `src/lib/services/__tests__/clinical-certificate.service.test.ts`

**Interfaces:**
- Consumes: `authorizeCaseClinicalAccess` from `src/lib/services/clinical-pathway.service.ts`, `validateUploadBuffer`, `saveValidatedUpload`, `removeStoredFile` from `src/lib/services/document-storage.service.ts`, `AUDIT_ACTIONS` from `@/lib/api/audit-logger`.
- Produces:
  - `saveGeneratedBuffer(buffer: Buffer, prefix: string, extension?: '.pdf'): Promise<{ storageKey: string; fileSize: number }>` in `src/lib/services/document-storage.service.ts`.
  - `generateClinicalCertificatePdf(input: CertificatePdfInput): Buffer`
  - `verifyPatientDocument(params: VerifyDocumentParams): Promise<ServiceResult<{ document: unknown }>>`
  - `listCaseDocuments(caseId: string, actor: { userId: string; role: string }): Promise<ServiceResult<{ documents: unknown[] }>>`
  - `issueCaseDocument(params: IssueCaseDocumentParams): Promise<ServiceResult<{ document: unknown }>>`
  - `getCaseFitToFly(caseId: string, actor: { userId: string; role: string }): Promise<ServiceResult<{ fitToFlyClearance: unknown; certificateDocument: unknown | null }>>`
  - `upsertCaseFitToFly(params: UpsertFitToFlyParams): Promise<ServiceResult<{ fitToFlyClearance: unknown; certificateDocument: unknown | null; caseStatus: string }>>`

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/clinical-certificate.service.test.ts`)**

```typescript
import { NextRequest } from 'next/server';
import { validateUploadBuffer } from '@/lib/services/document-storage.service';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clinicalStep: {
      updateMany: jest.fn(),
    },
    fitToFlyClearance: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  generateClinicalCertificatePdf,
  verifyPatientDocument,
  issueCaseDocument,
  upsertCaseFitToFly,
} from '@/lib/services/clinical-certificate.service';
import { PATCH as verifyDocRoute } from '@/app/api/v1/documents/[id]/verify/route';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  document: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  fitToFlyClearance: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

const activeCase = {
  id: 'case-1',
  patientId: 'pat-1',
  managerId: 'mgr-1',
  status: 'OUTPATIENT_RECUPERATION',
  patient: {
    id: 'pat-1',
    userId: 'pat-u-1',
    assignedManagerId: 'mgr-1',
    nationality: 'Oman',
    passportNo: null,
    user: { fullName: 'Tariq Al-Said', email: 'tariq@example.com', phone: null },
    medicalProfile: null,
  },
  clinicalSteps: [],
  fitToFlyClearance: null,
};

describe('Task 3: Clinical Certificate PDF Generator, Document Verification & Fit-to-Fly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a valid %PDF-1.4 buffer passing magic-byte validation', () => {
    const pdfBuf = generateClinicalCertificatePdf({
      title: 'Official Visa Invitation Letter (VIL)',
      category: 'VISA_INVITATION_LETTER',
      patientName: 'Tariq Al-Said',
      nationality: 'Oman',
      caseId: 'case-1',
      issuedByName: 'Priya Coordinator',
      issuedByRole: 'Case Manager',
      bodyLines: ['Approved for Interventional Cardiology evaluation at Apollo Hospital.'],
    });

    expect(pdfBuf.subarray(0, 8).toString('ascii')).toContain('%PDF-1.4');
    const check = validateUploadBuffer(pdfBuf, 'application/pdf', 'vil.pdf');
    expect(check.ok).toBe(true);
  });

  it('verifies and rejects patient documents with assigned-manager RBAC and note requirements', async () => {
    mockedPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      patientId: 'pat-1',
      verificationStatus: 'PENDING',
      patient: {
        id: 'pat-1',
        assignedManagerId: 'mgr-1',
        cases: [{ managerId: 'mgr-1' }],
      },
    });

    // Reject without notes -> 400
    const missingNotes = await verifyPatientDocument({
      documentId: 'doc-1',
      verificationStatus: 'REJECTED',
      verificationNotes: '   ',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(missingNotes.ok).toBe(false);
    if (!missingNotes.ok) expect(missingNotes.status).toBe(400);

    // Unassigned manager -> 403
    const wrongMgr = await verifyPatientDocument({
      documentId: 'doc-1',
      verificationStatus: 'VERIFIED',
      actor: { userId: 'mgr-other', role: 'MANAGER' },
    });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);

    // Assigned manager via route PATCH -> 200
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-1',
      verificationStatus: 'VERIFIED',
    });
    const req = new NextRequest('http://localhost/api/v1/documents/doc-1/verify', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'mgr@afzalhealthcare.in',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({
        verificationStatus: 'VERIFIED',
        verificationNotes: 'Passport bio-page verified.',
      }),
    });
    const res = await verifyDocRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    expect(res.status).toBe(200);
  });

  it('auto-generates an official VIL PDF and completes ISSUE_VIL steps when MANAGER issues VISA_INVITATION_LETTER', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(activeCase);
    mockedPrisma.user.findUnique.mockResolvedValue({ fullName: 'Priya Sharma' });
    mockedPrisma.document.create.mockResolvedValue({ id: 'doc-vil-1' });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-vil-1',
      category: 'VISA_INVITATION_LETTER',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-vil-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });

    // Manager blocked from issuing FIT_TO_FLY_CERTIFICATE
    const forbiddenCert = await issueCaseDocument({
      caseId: 'case-1',
      category: 'FIT_TO_FLY_CERTIFICATE',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(forbiddenCert.ok).toBe(false);
    if (!forbiddenCert.ok) expect(forbiddenCert.status).toBe(403);

    // Manager issues VIL without uploading a file -> auto-generates PDF
    const vilRes = await issueCaseDocument({
      caseId: 'case-1',
      category: 'VISA_INVITATION_LETTER',
      notes: 'M-Visa invitation issued for New Delhi arrival.',
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(vilRes.ok).toBe(true);
    expect(mockedPrisma.clinicalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', actionType: 'ISSUE_VIL' }),
      })
    );
  });

  it('allows treating DOCTOR (not MANAGER) to certify FitToFlyClearance, generating certificate & advancing case status', async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(activeCase);

    const mgrAttempt = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(mgrAttempt.ok).toBe(false);
    if (!mgrAttempt.ok) expect(mgrAttempt.status).toBe(403);

    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'doc-u-1',
      fullName: 'Dr. Ashok Seth',
      isActive: true,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValue({
      id: 'ftf-1',
      caseId: 'case-1',
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth',
    });
    mockedPrisma.document.create.mockResolvedValue({ id: 'doc-ftf-1' });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-ftf-1',
      category: 'FIT_TO_FLY_CERTIFICATE',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      fileUrl: '/api/v1/documents/doc-ftf-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.case.update.mockResolvedValue({
      ...activeCase,
      status: 'FIT_TO_FLY_CLEARED',
    });

    const docRes = await upsertCaseFitToFly({
      caseId: 'case-1',
      isCleared: true,
      restrictions: 'Wheelchair assistance at airport; cabin pressurization standard.',
      actor: { userId: 'doc-u-1', role: 'DOCTOR' },
    });
    expect(docRes.ok).toBe(true);
    if (docRes.ok) {
      expect(docRes.caseStatus).toBe('FIT_TO_FLY_CLEARED');
      expect(docRes.certificateDocument).toBeTruthy();
    }
    expect(mockedPrisma.case.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { status: 'FIT_TO_FLY_CLEARED' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/clinical-certificate.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/services/clinical-certificate.service'`).

- [ ] **Step 3: Implement `saveGeneratedBuffer`, `clinical-certificate.service.ts`, and the 3 verification/issuance/fit-to-fly API routes**

1. In `src/lib/services/document-storage.service.ts`, export:
   ```typescript
   export async function saveGeneratedBuffer(
     buffer: Buffer,
     prefix: string,
     extension: '.pdf' = '.pdf'
   ): Promise<{ storageKey: string; fileSize: number }> {
     const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'cert';
     const storageKey = `${safePrefix}_${crypto.randomUUID()}${extension}`;
     await fs.mkdir(UPLOAD_DIR, { recursive: true });
     await fs.writeFile(path.join(UPLOAD_DIR, storageKey), buffer);
     return { storageKey, fileSize: buffer.length };
   }
   ```
2. Create `src/lib/services/clinical-certificate.service.ts`:
   - `escapePdfText(text: string)`: strips non-printable ASCII (`[^\x20-\x7E]` -> `'?'`) and escapes `\`, `(`, `)`.
   - `generateClinicalCertificatePdf(input)`: constructs a valid 5-object `%PDF-1.4` document (`Catalog`, `Pages`, `Page` [595x842 A4], `Font` `/Helvetica`, and `Contents` stream rendering the Afzal Healthcare official header, certificate title, Case ID, Patient Name, Nationality, Issued By, Issuance Date UTC, and wrapped `bodyLines`) with exact byte-offset `xref` table and `startxref` trailer.
   - `verifyPatientDocument`: authorizes `ADMIN` or assigned `MANAGER` (`doc.patient.assignedManagerId === actor.userId || doc.patient.cases.some((c) => c.managerId === actor.userId)`), blocks modifying `ISSUED_BY_HOSPITAL` rows (`400 BAD_REQUEST`), requires trimmed `verificationNotes` when `verificationStatus === 'REJECTED'`, updates `Document`, and logs `AUDIT_ACTIONS.VERIFY_DOCUMENT`.
   - `listCaseDocuments`: authorizes `ADMIN`, assigned `MANAGER`, or treating `DOCTOR` via `authorizeCaseClinicalAccess` (`PATIENT` uses `/api/v1/patient/documents`), returns `prisma.document.findMany({ where: { patientId: access.targetCase.patientId }, orderBy: { createdAt: 'desc' } })`.
   - `issueCaseDocument`:
     - Enforces category allowlists:
       - `MANAGER`: `['VISA_INVITATION_LETTER', 'PROFORMA_INVOICE', 'MEDICAL_OPINION', 'FRRO_REGISTRATION']`
       - `DOCTOR`: `['FIT_TO_FLY_CERTIFICATE', 'MEDICAL_OPINION', 'PRESCRIPTION', 'MEDICAL_REPORT']`
       - `ADMIN`: union of both lists.
     - Rejects `CLOSED` cases (`400 CASE_ALREADY_CLOSED`).
     - Uses `saveValidatedUpload(file, 'cert')` when `file` is provided, or `generateClinicalCertificatePdf` + `saveGeneratedBuffer(pdfBuf, 'cert')` when `file` is omitted. Cleans up stored file via `removeStoredFile` if `prisma.document.create` fails.
     - Updates `fileUrl: /api/v1/documents/${doc.id}/download`, auto-completes matching `ClinicalStep`s (`ISSUE_VIL`, `ISSUE_PROFORMA`, `SIGN_FIT_TO_FLY`), and logs `AUDIT_ACTIONS.ISSUE_DOCUMENT`.
   - `getCaseFitToFly` & `upsertCaseFitToFly`:
     - `getCaseFitToFly`: allows `ADMIN`, assigned `MANAGER`, treating `DOCTOR`, and owning `PATIENT`; returns `{ fitToFlyClearance, certificateDocument }`.
     - `upsertCaseFitToFly`: allows treating `DOCTOR` or `ADMIN` on non-`CLOSED` cases; upserts `FitToFlyClearance` (`clearedBy: formatDoctorDisplayName(doctor.fullName)` for `DOCTOR` or `adminUser.fullName` for `ADMIN`); when `isCleared === true`, calls `issueCaseDocument({ caseId, category: 'FIT_TO_FLY_CERTIFICATE', file, notes: restrictions, actor, ipAddress })`, marks `SIGN_FIT_TO_FLY` steps `COMPLETED` (`decisionBranch: 'FIT_TO_FLY_GRANTED'`), updates `Case.status` to `'FIT_TO_FLY_CLEARED'` (unless already `'REMOTE_REHAB'` or `'CLOSED'`), and logs `AUDIT_ACTIONS.SIGN_FIT_TO_FLY`.
3. Create routes:
   - `src/app/api/v1/documents/[id]/verify/route.ts` (`PATCH`)
   - `src/app/api/v1/cases/[id]/documents/route.ts` (`GET`, `POST` supporting both `multipart/form-data` with `rawFile instanceof File` check and `application/json`)
   - `src/app/api/v1/cases/[id]/fit-to-fly/route.ts` (`GET`, `PUT` supporting both `multipart/form-data` and `application/json`)

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/clinical-certificate.service.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/document-storage.service.ts src/lib/services/clinical-certificate.service.ts "src/app/api/v1/documents/[id]/verify/route.ts" "src/app/api/v1/cases/[id]/documents/route.ts" "src/app/api/v1/cases/[id]/fit-to-fly/route.ts" src/lib/services/__tests__/clinical-certificate.service.test.ts
git commit -m "feat(certificates,fit-to-fly): add PDF certificate generator, document verification, VIL issuance, and Fit-to-Fly API"
```

---

### Task 4: Case Document Review, VIL Issuance & Pathway Navigation across Manager, Admin & Patient Portals

**Files:**
- Create: `src/components/clinical/CaseDocumentsManagerPanel.tsx`
- Modify: `src/app/(manager)/manager/cases/page.tsx`
- Modify: `src/app/(admin)/admin/cases/page.tsx`
- Modify: `src/app/(patient)/patient/documents/page.tsx`
- Test: `src/lib/__tests__/document-vault-filters.test.ts`

**Interfaces:**
- Consumes: `GET / POST /api/v1/cases/[id]/documents`, `PATCH /api/v1/documents/[id]/verify`, `/manager/cases/[id]/pathway`, `/admin/cases/[id]/pathway`.
- Produces:
  - `<CaseDocumentsManagerPanel caseId={string} canVerify={boolean} issueCategories={Array<{ value: string; label: string }>} />` in `src/components/clinical/CaseDocumentsManagerPanel.tsx` (reusable in Manager Cases, Admin Cases, and Doctor Case Workspace in Task 5!).
  - Pure helper `matchesPatientDocumentCategoryFilter(docCategory: string, activeFilter: string): boolean` and `canPatientDeleteDocument(verificationStatus: string): boolean` in `src/lib/validation/document-vault-helpers.ts` (imported by `patient/documents/page.tsx` and tested directly).

- [ ] **Step 1: Write the failing unit tests (`src/lib/__tests__/document-vault-filters.test.ts`)**

```typescript
import {
  matchesPatientDocumentCategoryFilter,
  canPatientDeleteDocument,
} from '@/lib/validation/document-vault-helpers';

describe('Task 4: Patient Document Vault Filters & Delete Eligibility', () => {
  it('includes INSURANCE under TRAVEL_VERIFICATION filter and preserves HOSPITAL_OFFICIAL / DIAGNOSTICS', () => {
    expect(matchesPatientDocumentCategoryFilter('INSURANCE', 'TRAVEL_VERIFICATION')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('PASSPORT', 'TRAVEL_VERIFICATION')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('MEDICAL_REPORT', 'TRAVEL_VERIFICATION')).toBe(false);
    expect(matchesPatientDocumentCategoryFilter('FIT_TO_FLY_CERTIFICATE', 'HOSPITAL_OFFICIAL')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('MEDICAL_REPORT', 'DIAGNOSTICS')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('INSURANCE', 'ALL')).toBe(true);
  });

  it('allows patient deletion only on PENDING or REJECTED documents (never VERIFIED or ISSUED_BY_HOSPITAL)', () => {
    expect(canPatientDeleteDocument('PENDING')).toBe(true);
    expect(canPatientDeleteDocument('REJECTED')).toBe(true);
    expect(canPatientDeleteDocument('VERIFIED')).toBe(false);
    expect(canPatientDeleteDocument('ISSUED_BY_HOSPITAL')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/document-vault-filters.test.ts`
Expected: FAIL (`Cannot find module '@/lib/validation/document-vault-helpers'`).

- [ ] **Step 3: Implement `document-vault-helpers.ts`, `CaseDocumentsManagerPanel.tsx`, and Portal UI updates**

1. Create `src/lib/validation/document-vault-helpers.ts`:
   ```typescript
   export function matchesPatientDocumentCategoryFilter(
     docCategory: string,
     activeFilter: string
   ): boolean {
     if (activeFilter === 'ALL') return true;
     if (activeFilter === 'TRAVEL_VERIFICATION') {
       return [
         'PASSPORT',
         'VISA',
         'VISA_INVITATION_LETTER',
         'PROFORMA_INVOICE',
         'FRRO_REGISTRATION',
         'INSURANCE',
       ].includes(docCategory);
     }
     if (activeFilter === 'HOSPITAL_OFFICIAL') {
       return [
         'VISA_INVITATION_LETTER',
         'PROFORMA_INVOICE',
         'MEDICAL_OPINION',
         'FIT_TO_FLY_CERTIFICATE',
       ].includes(docCategory);
     }
     if (activeFilter === 'DIAGNOSTICS') {
       return docCategory === 'MEDICAL_REPORT';
     }
     return docCategory === activeFilter;
   }

   export function canPatientDeleteDocument(verificationStatus: string): boolean {
     return (
       verificationStatus !== 'ISSUED_BY_HOSPITAL' &&
       verificationStatus !== 'VERIFIED'
     );
   }
   ```
2. Update `src/app/(patient)/patient/documents/page.tsx` to use `matchesPatientDocumentCategoryFilter(doc.category, activeCategoryFilter)` and `canPatientDeleteDocument(doc.verificationStatus)` in both grid and table views.
3. Create `src/components/clinical/CaseDocumentsManagerPanel.tsx`:
   - Props: `{ caseId: string; canVerify?: boolean; issueCategories?: { value: string; label: string }[]; onDocumentIssued?: () => void }`.
   - Fetches `GET /api/v1/cases/${caseId}/documents`.
   - Renders each document with category badge, verification status badge, `Download` link (`doc.fileUrl`), and — when `canVerify && doc.verificationStatus !== 'ISSUED_BY_HOSPITAL'` — `Approve` (`VERIFIED`) and `Reject` (`REJECTED` with required reason input) controls calling `PATCH /api/v1/documents/${doc.id}/verify`.
   - Renders an `"Issue Official Document"` collapsible/compact form allowing category selection (`VISA_INVITATION_LETTER`, `PROFORMA_INVOICE`, `MEDICAL_OPINION`, `FRRO_REGISTRATION` by default), notes input, and optional PDF/image attachment (`Leave file blank to auto-generate official PDF certificate`), submitting `FormData` to `POST /api/v1/cases/${caseId}/documents`.
4. Update `src/app/(manager)/manager/cases/page.tsx`:
   - Add a `"Configure Pathway"` `<Link href={`/manager/cases/${c.id}/pathway`}>` button (stopping click propagation) on each case card AND inside the selected `editingCase` panel, plus render `<CaseDocumentsManagerPanel caseId={editingCase.id} canVerify />` below the case form.
5. Update `src/app/(admin)/admin/cases/page.tsx`:
   - Widen the Case Detail modal (`max-w-2xl`), add a `"Configure Clinical Pathway"` `<Link href={`/admin/cases/${selectedCase.id}/pathway`}>` button, and render `<CaseDocumentsManagerPanel caseId={selectedCase.id} canVerify />` inside the modal.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/__tests__/document-vault-filters.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/document-vault-helpers.ts src/components/clinical/CaseDocumentsManagerPanel.tsx "src/app/(manager)/manager/cases/page.tsx" "src/app/(admin)/admin/cases/page.tsx" "src/app/(patient)/patient/documents/page.tsx" src/lib/__tests__/document-vault-filters.test.ts
git commit -m "feat(documents,cases): add case document verification/VIL panel, pathway links, and vault filter fixes"
```

---

### Task 5: Complete `(doctor)` Portal UI & Doctor API Enhancements

**Files:**
- Modify: `src/app/api/v1/doctor/dashboard/route.ts`
- Modify: `src/app/api/v1/doctor/patients/route.ts`
- Modify: `src/app/api/v1/doctor/appointments/route.ts`
- Create: `src/app/(doctor)/doctor/layout.tsx`
- Create: `src/app/(doctor)/doctor/dashboard/page.tsx`
- Create: `src/app/(doctor)/doctor/appointments/page.tsx`
- Create: `src/app/(doctor)/doctor/patients/page.tsx`
- Create: `src/app/(doctor)/doctor/cases/[id]/page.tsx`
- Test: `src/lib/__tests__/doctor-portal-routes.test.ts`

**Interfaces:**
- Consumes:
  - `GET / PATCH /api/v1/cases/[id]/pathway` (Task 2)
  - `GET / PUT /api/v1/cases/[id]/fit-to-fly` (Task 3)
  - `GET / POST /api/v1/cases/[id]/documents` (Task 3)
  - `<CaseDocumentsManagerPanel />` (Task 4)
  - `formatDoctorDisplayName` (Task 1)
  - `formatPatientForViewer` (`@/lib/services/phi.service`)
- Produces:
  - Enhanced `/api/v1/doctor/dashboard`, `/api/v1/doctor/patients`, `/api/v1/doctor/appointments`
  - Complete `(doctor)` App Router portal: `/doctor/dashboard`, `/doctor/appointments`, `/doctor/patients`, `/doctor/cases/[id]`

- [ ] **Step 1: Write the failing route tests (`src/lib/__tests__/doctor-portal-routes.test.ts`)**

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findMany: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { GET as getDoctorDashboard } from '@/app/api/v1/doctor/dashboard/route';
import { PUT as updateDoctorAppointment } from '@/app/api/v1/doctor/appointments/route';
import { GET as getDoctorPatients } from '@/app/api/v1/doctor/patients/route';

const mockedPrisma = prisma as unknown as {
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  case: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

const docHeaders = {
  'x-user-id': 'doc-u-1',
  'x-user-email': 'doctor@afzalhealthcare.in',
  'x-user-role': 'DOCTOR',
};

describe('Task 5: Doctor Portal API Enhancements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'seed-doctor-001',
      userId: 'doc-u-1',
      fullName: 'Dr. Ashok Seth',
      qualification: 'MBBS, MD, DM (Cardiology)',
      isActive: true,
      hospital: { name: 'Apollo Hospital', city: 'New Delhi' },
      specialisation: { name: 'Cardiology' },
    });
  });

  it('returns activeCases, upcomingSchedule, and pendingClinicalCases on GET /api/v1/doctor/dashboard', async () => {
    mockedPrisma.appointment.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockedPrisma.appointment.findMany
      .mockResolvedValueOnce([
        {
          id: 'appt-1',
          caseId: 'case-1',
          appointmentType: 'PRE_OP_ASSESSMENT',
          scheduledAt: new Date('2026-11-24T10:00:00.000Z'),
          status: 'CONFIRMED',
          patient: { user: { fullName: 'Tariq Al-Said' }, nationality: 'Oman' },
          case: { id: 'case-1', status: 'WARD_RECOVERY', isUrgent: true },
        },
      ])
      .mockResolvedValueOnce([{ caseId: 'case-1' }]);
    mockedPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        status: 'WARD_RECOVERY',
        isUrgent: true,
        patient: { user: { fullName: 'Tariq Al-Said' }, nationality: 'Oman' },
        clinicalSteps: [{ id: 's-1', title: 'Sign Fit-to-Fly', status: 'PENDING', requiredRole: 'DOCTOR' }],
        fitToFlyClearance: null,
      },
    ]);

    const req = new NextRequest('http://localhost/api/v1/doctor/dashboard', { headers: docHeaders });
    const res = await getDoctorDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.metrics.activeCases).toBe(1);
    expect(json.data.upcomingSchedule).toHaveLength(1);
    expect(json.data.pendingClinicalCases).toHaveLength(1);
  });

  it('includes patient active cases on GET /api/v1/doctor/patients and writes AuditLog on PUT /api/v1/doctor/appointments', async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([{ patientId: 'pat-1' }]);
    mockedPrisma.patient.findMany.mockResolvedValue([
      {
        id: 'pat-1',
        nationality: 'Oman',
        passportNo: 'A1234567',
        user: { fullName: 'Tariq Al-Said', email: 't@example.com', phone: '+968123456' },
        medicalProfile: {
          allergies: '["Penicillin"]',
          medications: '[]',
          surgeries: '[]',
          chronicConditions: '[]',
        },
        cases: [{ id: 'case-1', status: 'WARD_RECOVERY', isUrgent: false, fitToFlyClearance: null }],
      },
    ]);

    const patReq = new NextRequest('http://localhost/api/v1/doctor/patients', { headers: docHeaders });
    const patRes = await getDoctorPatients(patReq);
    const patJson = await patRes.json();
    expect(patRes.status).toBe(200);
    expect(patJson.data.patients[0].cases).toHaveLength(1);
    expect(patJson.data.patients[0].medicalProfile.allergies).toEqual(['Penicillin']);

    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: 'appt-1',
      doctorId: 'seed-doctor-001',
      status: 'CONFIRMED',
      clinicalNotes: null,
    });
    mockedPrisma.appointment.update.mockResolvedValue({
      id: 'appt-1',
      status: 'COMPLETED',
      clinicalNotes: 'Hemodynamics stable post-PCI.',
    });

    const putReq = new NextRequest('http://localhost/api/v1/doctor/appointments?id=appt-1', {
      method: 'PUT',
      headers: { ...docHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'COMPLETED',
        clinicalNotes: 'Hemodynamics stable post-PCI.',
      }),
    });
    const putRes = await updateDoctorAppointment(putReq);
    expect(putRes.status).toBe(200);
    expect(mockedPrisma.auditLog.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/doctor-portal-routes.test.ts`
Expected: FAIL (`json.data.metrics.activeCases` is `undefined`).

- [ ] **Step 3: Enhance `/api/v1/doctor/*` routes and build all 5 `src/app/(doctor)/doctor/*` portal files**

1. Update `src/app/api/v1/doctor/dashboard/route.ts`:
   - Include `hospital: { select: { name: true, city: true } }` and `specialisation: { select: { name: true } }` on `doctorProfile`.
   - Query `upcomingSchedule` (top 6 non-`CANCELLED` appointments with `scheduledAt >= todayStart`, including `patient.user.fullName`, `patient.nationality`, `case: { select: { id: true, status: true, isUrgent: true } }`), distinct `caseId`s from non-`CANCELLED` doctor appointments, and `pendingClinicalCases` (`prisma.case.findMany({ where: { id: { in: caseIds }, status: { not: 'CLOSED' } }, include: { patient: { select: { nationality: true, user: { select: { fullName: true } } } }, clinicalSteps: { where: { status: { not: 'COMPLETED' } }, orderBy: [{ stageOrder: 'asc' }, { stepOrder: 'asc' }] }, fitToFlyClearance: true } })`).
   - Return `{ doctorProfile, metrics: { todayAppointments, pendingAssessments, upcomingSurgeries, activeCases: pendingClinicalCases.length }, upcomingSchedule, pendingClinicalCases }`.
2. Update `src/app/api/v1/doctor/patients/route.ts`:
   - Include `cases: { where: { status: { not: 'CLOSED' } }, select: { id: true, status: true, isUrgent: true, fitToFlyClearance: true }, orderBy: { createdAt: 'desc' } }` in `prisma.patient.findMany`.
3. Update `src/app/api/v1/doctor/appointments/route.ts`:
   - Include `hospital: { select: { name: true, city: true } }` in `GET`, allow `'RESCHEDULED'` in `updateAppointmentSchema`, and write `createAuditLog` (`STATUS_CHANGE` when `status !== existing.status`, else `UPDATE`) in `PUT`.
4. Build `src/app/(doctor)/doctor/layout.tsx`:
   - Responsive clinical sidebar (`Overview` `/doctor/dashboard`, `Appointments` `/doctor/appointments`, `My Patients` `/doctor/patients`), `Image` logo (`../../../../public/assets/logo.png`), `/api/v1/auth/me` verification requiring `role === 'DOCTOR'`, breadcrumb header (including `/doctor/cases/`), and `POST /api/v1/auth/logout` Sign Out button.
5. Build `src/app/(doctor)/doctor/dashboard/page.tsx`:
   - Specialist greeting banner (`formatDoctorDisplayName`, hospital & specialisation), 4 KPI cards (`Today's Encounters`, `Pending Assessments`, `Upcoming Surgeries`, `Active Clinical Cases`), Today/Upcoming Schedule list with `"Open Case"` links, and Active Cases Requiring Physician Review list (`/doctor/cases/${c.id}`).
6. Build `src/app/(doctor)/doctor/appointments/page.tsx`:
   - Filter tabs (`upcoming`, `past`, `all`), appointment cards with status transition controls (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), inline/modal `clinicalNotes` editor (`PUT /api/v1/doctor/appointments?id=${id}`), and `"Case Workspace"` link (`/doctor/cases/${appt.case.id}`).
7. Build `src/app/(doctor)/doctor/patients/page.tsx`:
   - Searchable patient cards showing decrypted `medicalProfile` clinical safety alerts (`allergies` highlighted in rose, `chronicConditions`, `medications`, `surgeries`, `bloodGroup`) and active case buttons (`/doctor/cases/${c.id}`).
8. Build `src/app/(doctor)/doctor/cases/[id]/page.tsx`:
   - Fetches `GET /api/v1/cases/${caseId}/pathway` and `GET /api/v1/cases/${caseId}/fit-to-fly`.
   - Displays patient header + decrypted `medicalProfile` allergy/medication alert strip.
   - **Fit-to-Fly Travel Clearance Card:** Form for `isCleared` toggle, `restrictions` clinical travel instructions, optional `reEvalDate`, and optional PDF attachment (or automatic PDF certificate generation), submitting to `PUT /api/v1/cases/${caseId}/fit-to-fly` + download link for any issued `FIT_TO_FLY_CERTIFICATE`.
   - **Clinical Pathway Milestone Sign-Offs:** Grouped stages displaying each `ClinicalStep`; for steps modifiable by `DOCTOR` (`!step.requiredRole || step.requiredRole === 'DOCTOR'`), provides status selector (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `ACTION_REQUIRED`), `decisionBranch` selector, `doctorNotes` input, and `"Save Milestone"` button calling `PATCH /api/v1/cases/${caseId}/pathway`.
   - **Case Documents & Clinical Certificates:** Renders `<CaseDocumentsManagerPanel caseId={caseId} canVerify={false} issueCategories={[{ value: 'MEDICAL_OPINION', label: 'Hospital Medical Opinion' }, { value: 'PRESCRIPTION', label: 'Doctor Prescription' }, { value: 'MEDICAL_REPORT', label: 'Medical Diagnostic Report' }, { value: 'FIT_TO_FLY_CERTIFICATE', label: 'Fit-to-Fly Certificate' }]} />`.

- [ ] **Step 4: Run full verification suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`)**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS (`0` errors, all routes including `/doctor/*` and `/api/v1/cases/[id]/*` compiled cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/doctor/dashboard/route.ts src/app/api/v1/doctor/patients/route.ts src/app/api/v1/doctor/appointments/route.ts "src/app/(doctor)" src/lib/__tests__/doctor-portal-routes.test.ts
git commit -m "feat(doctor-portal): build complete Doctor Portal UI, case workspace, and enhanced doctor APIs"
```
