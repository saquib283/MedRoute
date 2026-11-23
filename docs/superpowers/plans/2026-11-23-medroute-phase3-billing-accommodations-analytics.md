# MedRoute Sub-Project 3: Medical Billing, Invoice OCR, Accommodations & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock Manager Billing, implement dual Manager/Patient `MedicalBill` payment settlement with `SETTLE_BILL` pathway auto-completion, replace the hardcoded OCR mock with real PDF text-stream extraction, add full Partner Hotel & `HotelBooking` update/cancellation lifecycles, and integrate `MedicalBill`, `HotelBooking`, and date-bound `CommissionOverride` metrics into Admin Analytics (fixing the month-end rollover bug).

**Architecture:** Financial and logistics logic is extracted into pure, unit-tested services under `src/lib/services/` (`billing.service.ts`, `billing-ocr.service.ts`, `accommodations.service.ts`, `analytics.service.ts`), keeping all Next.js 16 App Router `route.ts` files strictly restricted to HTTP verb handler exports. PDF invoice OCR decompresses `/FlateDecode` streams via Node `zlib.inflateSync` and parses `BT ... ET` text operators deterministically without external SDKs, falling back transparently (`extractionMode: 'SCANNED_FALLBACK'`) on raster scans.

**Tech Stack:** Next.js 16.2.9 (App Router, `src/proxy.ts`), React 19, TypeScript 5, Prisma 6.19 (MySQL), Node `zlib`, Zod 4, Jest 30 (`ts-jest`), Tailwind CSS 4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-23-medroute-phase3-billing-accommodations-analytics-design.md`

## Global Constraints

- **Next.js 16 Export Rules (`AGENTS.md`):** App Router `route.ts` files MUST ONLY export HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). Never export interfaces, schemas, constants, or helpers from `route.ts` or `src/proxy.ts` — place all shared types/helpers in `src/lib/*` or `src/components/*`.
- **Database & Env Safety:** Never run `prisma migrate reset`, `DROP`, or modify `.env`. Always import singleton `prisma` from `@/lib/prisma` (never `new PrismaClient()`).
- **UTF-8 Encoding:** Write all created and modified files as UTF-8 **without BOM** (`\uFEFF`).
- **Zod Partial Update Safety:** Never use `.optional().transform(v => v || null)` without preserving `undefined` (`if (v === undefined) return undefined;`), so omitted fields on `PATCH`/`PUT` never overwrite existing DB columns with `null`.
- **Upload & Security Hygiene:** Validate all uploaded files with `validateUploadBuffer` / `saveValidatedUpload` (`@/lib/services/document-storage.service`), check `rawFile instanceof File`, redact `commissionPercent` for non-`ADMIN`/`MANAGER` viewers, and record `AuditLog` entries on mutations.

---

### Task 1: Medical Billing Service, Dual Settlement APIs & Real PDF Text-Stream OCR

**Files:**
- Modify: `src/lib/api/audit-logger.ts`
- Create: `src/lib/services/billing.service.ts`
- Create: `src/lib/services/billing-ocr.service.ts`
- Modify: `src/app/api/v1/manager/billing/route.ts`
- Modify: `src/app/api/v1/manager/billing/ocr/route.ts`
- Create: `src/app/api/v1/patient/billing/pay/route.ts`
- Test: `src/lib/services/__tests__/billing-and-ocr.service.test.ts`

**Interfaces:**
- Consumes: `validateUploadBuffer`, `saveValidatedUpload`, `removeStoredFile` from `@/lib/services/document-storage.service`, `requireAuth` & `getClientIP` from `@/lib/api/auth-helper`, `ERROR_CODES` from `@/lib/api/errors`.
- Produces:
  - `AUDIT_ACTIONS.SETTLE_BILL`, `AUDIT_ACTIONS.UPDATE_BILL`, `AUDIT_ACTIONS.UPDATE_BOOKING` in `src/lib/api/audit-logger.ts`.
  - `deriveBillStatus(totalAmount: number, paidAmount: number, requestedStatus?: string): string`
  - `getManagerBillingMetadata(actor: { userId: string; role: string }): Promise<{ cases: unknown[]; hospitals: unknown[] }>`
  - `updateMedicalBill(params: UpdateMedicalBillParams): Promise<ServiceResult<{ bill: unknown }>>`
  - `payPatientMedicalBill(params: PayPatientBillParams): Promise<ServiceResult<{ bill: unknown }>>`
  - `extractTextFromPdfBuffer(buffer: Buffer): string[]` and `parseMultiPageMedicalBillOcr(files: Array<{ name: string; type: string; buffer: Buffer }>): MultiPageOcrExtractionResult` (including `extractionMode: 'PDF_TEXT' | 'SCANNED_FALLBACK'`) in `src/lib/services/billing-ocr.service.ts`.

- [ ] **Step 1: Write the failing unit tests (`src/lib/services/__tests__/billing-and-ocr.service.test.ts`)**

```typescript
import { generateClinicalCertificatePdf } from '@/lib/services/clinical-certificate.service';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    hospital: {
      findMany: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    medicalBill: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    clinicalStep: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  deriveBillStatus,
  getManagerBillingMetadata,
  updateMedicalBill,
  payPatientMedicalBill,
} from '@/lib/services/billing.service';
import {
  extractTextFromPdfBuffer,
  parseMultiPageMedicalBillOcr,
} from '@/lib/services/billing-ocr.service';

const mockedPrisma = prisma as unknown as {
  case: Record<string, jest.Mock>;
  hospital: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  medicalBill: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

describe('Task 1: Billing Service, Dual Settlement & Real PDF Stream OCR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives consistent bill statuses from totalAmount, paidAmount, and requestedStatus', () => {
    expect(deriveBillStatus(2000, 0)).toBe('PENDING');
    expect(deriveBillStatus(2000, 500)).toBe('PARTIALLY_PAID');
    expect(deriveBillStatus(2000, 500, 'OVERDUE')).toBe('OVERDUE');
    expect(deriveBillStatus(2000, 2000)).toBe('PAID');
    expect(deriveBillStatus(2000, 0, 'CANCELLED')).toBe('CANCELLED');
  });

  it('scopes getManagerBillingMetadata cases to assigned manager while giving ADMIN all open cases', async () => {
    mockedPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        patientId: 'pat-1',
        status: 'IN_TREATMENT',
        patient: { id: 'pat-1', user: { fullName: 'Tariq Al-Said', email: 't@example.com' } },
      },
    ]);
    mockedPrisma.hospital.findMany.mockResolvedValue([
      { id: 'hosp-1', name: 'Apollo Hospital', city: 'New Delhi' },
    ]);

    await getManagerBillingMetadata({ userId: 'mgr-1', role: 'MANAGER' });
    expect(mockedPrisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' }, managerId: 'mgr-1' },
      })
    );

    await getManagerBillingMetadata({ userId: 'adm-1', role: 'ADMIN' });
    expect(mockedPrisma.case.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' } },
      })
    );
  });

  it('enforces manager ownership and overpayment bounds on updateMedicalBill, and auto-completes SETTLE_BILL steps when fully paid', async () => {
    const baseBill = {
      id: 'bill-1',
      caseId: 'case-1',
      patientId: 'pat-1',
      totalAmount: 3000,
      paidAmount: 1000,
      status: 'PARTIALLY_PAID',
      notes: null,
      case: { id: 'case-1', managerId: 'mgr-1' },
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
    };

    mockedPrisma.medicalBill.findUnique.mockResolvedValue(baseBill);

    // Wrong manager -> 403
    const wrongMgr = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 500,
      actor: { userId: 'mgr-other', role: 'MANAGER' },
    });
    expect(wrongMgr.ok).toBe(false);
    if (!wrongMgr.ok) expect(wrongMgr.status).toBe(403);

    // Overpayment -> 400
    const overpay = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 2500,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(overpay.ok).toBe(false);
    if (!overpay.ok) expect(overpay.status).toBe(400);

    // Settling remaining 2000 -> PAID + completes SETTLE_BILL step
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          update: jest.fn().mockResolvedValue({
            ...baseBill,
            paidAmount: 3000,
            status: 'PAID',
          }),
          count: jest
            .fn()
            .mockResolvedValueOnce(0) // unpaid non-cancelled count
            .mockResolvedValueOnce(1), // paid count
        },
        clinicalStep: {
          updateMany: stepUpdateMany,
        },
      })
    );

    const paidRes = await updateMedicalBill({
      billId: 'bill-1',
      paymentAmount: 2000,
      actor: { userId: 'mgr-1', role: 'MANAGER' },
    });
    expect(paidRes.ok).toBe(true);
    expect(stepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', actionType: 'SETTLE_BILL' }),
      })
    );
  });

  it('allows owning PATIENT to pay partial or full balance via payPatientMedicalBill and blocks other patients', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.medicalBill.findUnique.mockResolvedValueOnce({
      id: 'bill-other',
      caseId: 'case-2',
      patientId: 'pat-other',
      totalAmount: 1000,
      paidAmount: 0,
      status: 'PENDING',
      notes: null,
    });

    const forbidden = await payPatientMedicalBill({
      billId: 'bill-other',
      amount: 500,
      paymentMethod: 'CARD',
      actor: { userId: 'u-pat-1', role: 'PATIENT' },
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    mockedPrisma.medicalBill.findUnique.mockResolvedValueOnce({
      id: 'bill-1',
      caseId: 'case-1',
      patientId: 'pat-1',
      totalAmount: 1500,
      paidAmount: 500,
      currency: 'USD',
      status: 'PARTIALLY_PAID',
      notes: null,
    });
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        medicalBill: {
          update: jest.fn().mockResolvedValue({
            id: 'bill-1',
            totalAmount: 1500,
            paidAmount: 1500,
            status: 'PAID',
          }),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        },
        clinicalStep: { updateMany: jest.fn() },
      })
    );

    const payRes = await payPatientMedicalBill({
      billId: 'bill-1',
      amount: 1000,
      paymentMethod: 'WIRE_TRANSFER',
      referenceNo: 'SWIFT-9988',
      actor: { userId: 'u-pat-1', role: 'PATIENT' },
    });
    expect(payRes.ok).toBe(true);
  });

  it('extracts real itemized charges from a PDF text stream (PDF_TEXT) and falls back honestly on PNG scans (SCANNED_FALLBACK)', () => {
    const invoicePdf = generateClinicalCertificatePdf({
      title: 'Apollo Hospital Tax Invoice INV-2026-4412',
      category: 'PROFORMA_INVOICE',
      patientName: 'Tariq Al-Said',
      nationality: 'Oman',
      caseId: 'case-1',
      issuedByName: 'Billing Desk',
      issuedByRole: 'Finance',
      bodyLines: [
        'Apollo Multi-Specialty Hospital New Delhi',
        'Currency: USD',
        'Cardiac Catheterization OT Suite | 1 | 2200.00 | 2200.00',
        'Coronary Care Unit Bed Rent | 2 | 400.00 | 800.00',
        'Drug Eluting Stent Pharmacy | 1 | 1200.00 | 1200.00',
      ],
    });

    const lines = extractTextFromPdfBuffer(invoicePdf);
    expect(lines.some((l) => l.includes('INV-2026-4412'))).toBe(true);

    const parsedPdf = parseMultiPageMedicalBillOcr([
      { name: 'apollo-invoice.pdf', type: 'application/pdf', buffer: invoicePdf },
    ]);
    expect(parsedPdf.extractionMode).toBe('PDF_TEXT');
    expect(parsedPdf.invoiceNumber).toBe('INV-2026-4412');
    expect(parsedPdf.items.length).toBeGreaterThanOrEqual(3);
    expect(parsedPdf.totalAmount).toBe(4200);

    // Minimal valid PNG header with no text layer -> SCANNED_FALLBACK
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const parsedPng = parseMultiPageMedicalBillOcr([
      { name: 'scan-page1.png', type: 'image/png', buffer: pngHeader },
    ]);
    expect(parsedPng.extractionMode).toBe('SCANNED_FALLBACK');
    expect(parsedPng.confidenceScore).toBeLessThan(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/billing-and-ocr.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/services/billing.service'`).

- [ ] **Step 3: Implement `billing.service.ts`, `billing-ocr.service.ts`, and the 3 billing API routes**

1. In `src/lib/api/audit-logger.ts`, add:
   ```typescript
   SETTLE_BILL: 'SETTLE_BILL',
   UPDATE_BILL: 'UPDATE_BILL',
   UPDATE_BOOKING: 'UPDATE_BOOKING',
   ```
2. Create `src/lib/services/billing.service.ts`:
   - Implement `deriveBillStatus(totalAmount, paidAmount, requestedStatus?)`, `syncCaseSettleBillSteps(tx, caseId)`, `getManagerBillingMetadata(actor)`, `updateMedicalBill`, and `payPatientMedicalBill` per Spec Section 3.1.
   - Preserve `undefined` on optional nullable fields (`dueDate`, `notes`, `hospitalId`) so partial `PATCH` calls never overwrite omitted columns with `null`.
3. Create `src/lib/services/billing-ocr.service.ts`:
   - Export `OcrLineItem`, `PageOcrMetadata`, and `MultiPageOcrExtractionResult` (adding `extractionMode: 'PDF_TEXT' | 'SCANNED_FALLBACK'`).
   - Implement `extractTextFromPdfBuffer(buffer: Buffer)`:
     - Locate `stream` ... `endstream` segments; inspect preceding `<< ... >>` dictionary for `/FlateDecode`; decompress via `zlib.inflateSync(rawSlice, { maxOutputLength: 10 * 1024 * 1024 })` inside `try/catch` (falling back to Latin1/ASCII string when uncompressed).
     - Extract parenthesized PDF string literals `(...)` inside text blocks (unescaping `\(`, `\)`, `\\`, `\n`, `\r`, `\t`), join tokens per line (`Td`/`TD`/`Tm`/`T*`/`Tj`/`TJ` boundaries), and return cleaned non-empty lines.
   - Implement `parseMultiPageMedicalBillOcr(files)`:
     - Extract text lines from any `.pdf` files; parse invoice number (`/\b(?:INV|BILL)[-_A-Z0-9]{3,}\b/i`), currency (`/\b(USD|INR|EUR|GBP|AED|OMR)\b/i`), hospital name (`/\b[A-Za-z0-9 &.,'-]*(?:Hospital|Medical Center|Clinic|Institute)\b/i`), and itemized rows matching pipe-delimited (`Description | qty | unitPrice | amount`), multiplication (`Description 2 x 400.00 = 800.00`), or trailing-amount (`Description ... $1,200.00`) patterns, classifying item `category` by medical keywords (`SURGERY_OT`, `BED_RENT`, `PHARMACY`, `DIAGNOSTICS`, `CONSULTATION`, `ADMIN_SERVICE`).
     - Return `extractionMode: 'PDF_TEXT'` (`confidenceScore: 0.94`) when `>= 1` line items are extracted; otherwise return `extractionMode: 'SCANNED_FALLBACK'` (`confidenceScore: 0.65`) with editable starter items per page.
4. Update `src/app/api/v1/manager/billing/route.ts`:
   - `GET`: When `searchParams.get('meta') === 'true'`, also call `getManagerBillingMetadata({ userId: authUser!.userId, role: authUser!.role })` and return `apiSuccess({ bills, metadata })`.
   - `POST`: Validate `paidAmount >= 0 && paidAmount <= calculatedTotal` (`400 BAD_REQUEST` otherwise) and normalize `status = deriveBillStatus(calculatedTotal, paidAmount, status)`; call `syncCaseSettleBillSteps` if created as `PAID`.
   - Add `PATCH` handler calling `updateMedicalBill`.
5. Update `src/app/api/v1/manager/billing/ocr/route.ts`:
   - Remove all exported interfaces (`OcrLineItem`, `PageOcrMetadata`, `MultiPageOcrExtractionResult`) from `route.ts` (keep only `export async function POST`).
   - Require `authUser.role === 'MANAGER' || authUser.role === 'ADMIN'` (`403` otherwise).
   - Filter uploaded entries strictly with `entry instanceof File && entry.size > 0`, convert each to `Buffer`, validate each with `validateUploadBuffer(buf, file.name, file.type)` (`400 BAD_REQUEST` if invalid), and return `apiSuccess({ ocr: parseMultiPageMedicalBillOcr(preparedFiles) })`.
6. Create `src/app/api/v1/patient/billing/pay/route.ts` (`POST` calling `payPatientMedicalBill`).

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/billing-and-ocr.service.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/audit-logger.ts src/lib/services/billing.service.ts src/lib/services/billing-ocr.service.ts src/app/api/v1/manager/billing/route.ts src/app/api/v1/manager/billing/ocr/route.ts src/app/api/v1/patient/billing/pay/route.ts src/lib/services/__tests__/billing-and-ocr.service.test.ts
git commit -m "feat(billing,ocr): add dual bill settlement service, real PDF text-stream OCR, and manager metadata API"
```

---

### Task 2: Manager & Patient Billing Portal UIs + Route Handler Tests

**Files:**
- Modify: `src/app/(manager)/manager/billing/page.tsx`
- Modify: `src/app/(patient)/patient/billing/page.tsx`
- Modify: `src/lib/services/__tests__/billing-and-ocr.service.test.ts`

**Interfaces:**
- Consumes: `GET / PATCH / POST /api/v1/manager/billing`, `POST /api/v1/manager/billing/ocr`, `POST /api/v1/patient/billing/pay`.
- Produces: Complete end-to-end Manager Billing & Patient Payment UIs.

- [ ] **Step 1: Add failing HTTP route-handler tests to `src/lib/services/__tests__/billing-and-ocr.service.test.ts`**

Append route tests importing `GET as getManagerBills, PATCH as patchManagerBill` from `@/app/api/v1/manager/billing/route`, `POST as postBillingOcr` from `@/app/api/v1/manager/billing/ocr/route`, and `POST as postPatientPay` from `@/app/api/v1/patient/billing/pay/route`:
- Verify `GET /api/v1/manager/billing?meta=true` returns `{ bills, metadata: { cases, hospitals } }`.
- Verify `POST /api/v1/manager/billing/ocr` rejects `PATIENT` (`403`) and spoofed non-PDF files (`400`).
- Verify `POST /api/v1/patient/billing/pay` returns `200` with updated `PAID` bill for the owning patient.

- [ ] **Step 2: Run tests to verify new route assertions pass/exercise routes, then implement UI updates**

1. Update `src/app/(manager)/manager/billing/page.tsx`:
   - Replace `fetch('/api/v1/patient/cases')` with a single `fetch('/api/v1/manager/billing?meta=true')` loading `bills`, `caseOptions` (`caseId`, `patientId`, `patientName`, `caseStatus`), and `hospitals` (`id`, `name`, `city`).
   - Key the case/patient selector in Create Bill modal by `caseId` (displaying `${opt.patientName} — Case #${opt.caseId.slice(-6)} (${opt.caseStatus})`) so patients with multiple open cases can be billed accurately, and add an optional `Hospital` dropdown (`selectedHospitalId`) appended to `FormData` (`hospitalId`).
   - Display an amber `"Scanned Image Fallback — Please verify line-item amounts"` badge in the OCR tray when `ocr.extractionMode === 'SCANNED_FALLBACK'` vs emerald `"Digital PDF Text Extracted"` when `ocr.extractionMode === 'PDF_TEXT'`.
   - Inside the `selectedBillForDetails` modal, add a **Payment & Status Settlement** panel allowing the coordinator/admin to:
     - Click `"Mark Paid in Full"` (sends `paidAmount: Number(selectedBillForDetails.totalAmount), status: 'PAID'`)
     - Record an incremental payment (`paymentAmount`)
     - Update `status` (`PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`) and `notes` via `PATCH /api/v1/manager/billing`.
   - Remove unused icon/component imports so `npx eslint "src/app/(manager)/manager/billing/page.tsx"` reports `0` warnings and `0` errors.
2. Update `src/app/(patient)/patient/billing/page.tsx`:
   - Add a `"Pay Balance"` button on every non-`CANCELLED` bill where `due > 0`.
   - Add a clean **Pay Medical Bill** modal allowing the patient to choose `Full Remaining Balance ($due)` or `Custom Deposit Amount`, select `paymentMethod` (`CARD`, `WIRE_TRANSFER`, `INSURANCE_DIRECT`), enter optional `referenceNo`, and submit to `POST /api/v1/patient/billing/pay`, refreshing bills and showing a success toast on completion.
   - Remove unused icon/component imports so `npx eslint "src/app/(patient)/patient/billing/page.tsx"` reports `0` warnings and `0` errors.

- [ ] **Step 3: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/billing-and-ocr.service.test.ts && npm run typecheck && npx eslint "src/app/(manager)/manager/billing/page.tsx" "src/app/(patient)/patient/billing/page.tsx" && npm run lint`
Expected: PASS (`0` errors, `0` warnings in touched billing pages).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(manager)/manager/billing/page.tsx" "src/app/(patient)/patient/billing/page.tsx" src/lib/services/__tests__/billing-and-ocr.service.test.ts
git commit -m "feat(billing-ui): wire manager billing metadata, payment settlement drawer, and patient bill payment modal"
```

---

### Task 3: Partner Accommodations & Hotel Booking Lifecycle

**Files:**
- Modify: `src/lib/validation/booking-helpers.ts`
- Create: `src/lib/services/accommodations.service.ts`
- Modify: `src/app/api/v1/accommodations/route.ts`
- Modify: `src/app/api/v1/accommodations/bookings/route.ts`
- Create: `src/components/accommodations/PartnerAccommodationsWorkspace.tsx`
- Modify: `src/app/(admin)/admin/accommodations/page.tsx`
- Create: `src/app/(manager)/manager/accommodations/page.tsx`
- Modify: `src/app/(manager)/manager/layout.tsx`
- Modify: `src/app/(patient)/patient/accommodations/page.tsx`
- Test: `src/lib/services/__tests__/accommodations.service.test.ts`

**Interfaces:**
- Consumes: `calculateHotelStayNights` from `@/lib/validation/booking-helpers`, `AUDIT_ACTIONS.UPDATE_BOOKING` from Task 1.
- Produces:
  - `getDefaultStayDates(now?: Date): { checkInDate: string; checkOutDate: string }` and `previewHotelStayCost(checkInStr: string, checkOutStr: string, nightlyRateUsd: number): { valid: boolean; numNights: number; totalUsd: number; error?: string }` in `src/lib/validation/booking-helpers.ts`.
  - `sanitizeHotelsForViewer`, `updatePartnerHotel`, `deactivatePartnerHotel`, `updateHotelBooking` in `src/lib/services/accommodations.service.ts`.
  - Shared `<PartnerAccommodationsWorkspace />` mounted in both Admin and Manager portals.

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/accommodations.service.test.ts`)**

```typescript
import { NextRequest } from 'next/server';
import {
  getDefaultStayDates,
  previewHotelStayCost,
} from '@/lib/validation/booking-helpers';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hotel: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hotelBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  GET as getAccommodations,
  PUT as putAccommodation,
  DELETE as deleteAccommodation,
} from '@/app/api/v1/accommodations/route';
import { PATCH as patchHotelBooking } from '@/app/api/v1/accommodations/bookings/route';

const mockedPrisma = prisma as unknown as {
  hotel: Record<string, jest.Mock>;
  hotelBooking: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

describe('Task 3: Partner Accommodations & Hotel Booking Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes dynamic future stay dates and rejects reversed dates in previewHotelStayCost (no Math.abs)', () => {
    const fixedNow = new Date('2026-11-23T10:00:00.000Z');
    const defaults = getDefaultStayDates(fixedNow);
    expect(defaults.checkInDate).toBe('2026-11-24');
    expect(defaults.checkOutDate).toBe('2026-11-29');

    const validPreview = previewHotelStayCost('2026-11-24', '2026-11-27', 110);
    expect(validPreview).toEqual({ valid: true, numNights: 3, totalUsd: 330 });

    const reversedPreview = previewHotelStayCost('2026-11-27', '2026-11-24', 110);
    expect(reversedPreview.valid).toBe(false);
    expect(reversedPreview.totalUsd).toBe(0);
  });

  it('strips commissionPercent on GET /api/v1/accommodations for PATIENT, DOCTOR, and anonymous callers while keeping it for MANAGER/ADMIN', async () => {
    mockedPrisma.hotel.findMany.mockResolvedValue([
      {
        id: 'h-1',
        name: 'Taj Recovery',
        nightlyRateUsd: 120,
        commissionPercent: 18,
        isActive: true,
      },
    ]);

    const docReq = new NextRequest('http://localhost/api/v1/accommodations', {
      headers: { 'x-user-id': 'doc-1', 'x-user-email': 'd@example.com', 'x-user-role': 'DOCTOR' },
    });
    const docRes = await getAccommodations(docReq);
    const docJson = await docRes.json();
    expect(docJson.data.hotels[0].commissionPercent).toBeUndefined();

    const mgrReq = new NextRequest('http://localhost/api/v1/accommodations', {
      headers: { 'x-user-id': 'mgr-1', 'x-user-email': 'm@example.com', 'x-user-role': 'MANAGER' },
    });
    const mgrRes = await getAccommodations(mgrReq);
    const mgrJson = await mgrRes.json();
    expect(mgrJson.data.hotels[0].commissionPercent).toBe(18);
  });

  it('updates and soft-deactivates partner hotels via PUT and DELETE /api/v1/accommodations', async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({
      id: 'h-1',
      name: 'Taj Recovery',
      nightlyRateUsd: 120,
      commissionPercent: 15,
      isActive: true,
    });
    mockedPrisma.hotel.update.mockResolvedValue({
      id: 'h-1',
      name: 'Taj Recovery Updated',
      nightlyRateUsd: 140,
      commissionPercent: 18,
      isActive: true,
    });

    const putReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({ id: 'h-1', name: 'Taj Recovery Updated', nightlyRateUsd: 140, commissionPercent: 18 }),
    });
    const putRes = await putAccommodation(putReq);
    expect(putRes.status).toBe(200);

    mockedPrisma.hotel.update.mockResolvedValueOnce({ id: 'h-1', isActive: false });
    const delReq = new NextRequest('http://localhost/api/v1/accommodations?id=h-1', {
      method: 'DELETE',
      headers: { 'x-user-id': 'adm-1', 'x-user-email': 'a@example.com', 'x-user-role': 'ADMIN' },
    });
    const delRes = await deleteAccommodation(delReq);
    expect(delRes.status).toBe(200);
  });

  it('allows PATIENT self-cancellation of CONFIRMED bookings and recalculates commission on MANAGER date updates', async () => {
    mockedPrisma.patient.findUnique.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-1',
      patientId: 'pat-1',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    mockedPrisma.hotelBooking.update.mockResolvedValueOnce({
      id: 'bk-1',
      status: 'CANCELLED',
      commissionAmountUsd: 80,
    });

    const patCancel = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ bookingId: 'bk-1', status: 'CANCELLED' }),
    });
    const patCancelRes = await patchHotelBooking(patCancel);
    const patCancelJson = await patCancelRes.json();
    expect(patCancelRes.status).toBe(200);
    expect(patCancelJson.data.booking.commissionAmountUsd).toBeUndefined();

    // Manager extends stay to 6 nights -> total 600, commission 120
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-2',
      patientId: 'pat-1',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    mockedPrisma.hotelBooking.update.mockImplementationOnce(async ({ data }: { data: unknown }) => ({
      id: 'bk-2',
      ...(data as Record<string, unknown>),
    }));

    const mgrPatch = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'm@example.com',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({
        bookingId: 'bk-2',
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-07',
        status: 'CHECKED_IN',
      }),
    });
    const mgrPatchRes = await patchHotelBooking(mgrPatch);
    const mgrPatchJson = await mgrPatchRes.json();
    expect(mgrPatchRes.status).toBe(200);
    expect(mgrPatchJson.data.booking.numNights).toBe(6);
    expect(mgrPatchJson.data.booking.totalAmountUsd).toBe(600);
    expect(mgrPatchJson.data.booking.commissionAmountUsd).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/accommodations.service.test.ts`
Expected: FAIL (`getDefaultStayDates is not a function`).

- [ ] **Step 3: Implement booking helpers, `accommodations.service.ts`, API routes, and Admin/Manager/Patient UI updates**

1. In `src/lib/validation/booking-helpers.ts`, export `getDefaultStayDates(now = new Date())` (tomorrow `YYYY-MM-DD` and `+5` days `YYYY-MM-DD` in UTC) and `previewHotelStayCost(checkInStr, checkOutStr, nightlyRateUsd)` (wrapping `calculateHotelStayNights` cleanly without `Math.abs()`).
2. Create `src/lib/services/accommodations.service.ts` implementing `sanitizeHotelsForViewer`, `updatePartnerHotel`, `deactivatePartnerHotel`, and `updateHotelBooking` (preserving `undefined` on optional fields, recalculating `numNights`, `totalAmountUsd`, and `commissionAmountUsd` when dates change, stripping `commissionAmountUsd` on `PATIENT` responses, and writing `AuditLog` entries).
3. Update `src/app/api/v1/accommodations/route.ts` (`GET` strict `ADMIN`/`MANAGER` `commissionPercent` gate + `?includeInactive=true`, `PUT`, `DELETE`) and `src/app/api/v1/accommodations/bookings/route.ts` (`PATCH`).
4. Create `src/components/accommodations/PartnerAccommodationsWorkspace.tsx` (with Add/Edit modal, Deactivate/Reactivate toggle, `Show Inactive` filter, and `Check In` / `Complete` / `Cancel` booking status buttons, zero unused imports) and mount it in `src/app/(admin)/admin/accommodations/page.tsx` and new `src/app/(manager)/manager/accommodations/page.tsx`.
5. Update `src/app/(manager)/manager/layout.tsx` to add `{ label: 'Partner Hotels', href: '/manager/accommodations', icon: <Home className="w-5 h-5" /> }` under `'Operations & Travel'` and add breadcrumb headers for `/manager/accommodations` and `/manager/billing`.
6. Update `src/app/(patient)/patient/accommodations/page.tsx` to initialize `checkInDate` / `checkOutDate` from `getDefaultStayDates()`, compute stay preview via `previewHotelStayCost` (rendering inline date error and disabling submit when invalid), remove `commissionPercent` from client `Hotel` interface, and add `"Cancel Reservation"` button on `PENDING` / `CONFIRMED` booking vouchers.

- [ ] **Step 4: Run tests, typecheck & lint**

Run: `npx jest src/lib/services/__tests__/accommodations.service.test.ts && npm run typecheck && npm run lint`
Expected: PASS (`0` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/booking-helpers.ts src/lib/services/accommodations.service.ts src/app/api/v1/accommodations/route.ts src/app/api/v1/accommodations/bookings/route.ts src/components/accommodations/PartnerAccommodationsWorkspace.tsx "src/app/(admin)/admin/accommodations/page.tsx" "src/app/(manager)/manager/accommodations/page.tsx" "src/app/(manager)/manager/layout.tsx" "src/app/(patient)/patient/accommodations/page.tsx" src/lib/services/__tests__/accommodations.service.test.ts
git commit -m "feat(accommodations): add partner hotel edit/deactivation, booking lifecycle PATCH, and dynamic stay date validation"
```

---

### Task 4: Financial Analytics & Date-Bound `CommissionOverride` Engine

**Files:**
- Create: `src/lib/services/analytics.service.ts`
- Modify: `src/app/api/v1/admin/analytics/route.ts`
- Modify: `src/app/(admin)/admin/analytics/page.tsx`
- Test: `src/lib/services/__tests__/analytics.service.test.ts`

**Interfaces:**
- Consumes: `MedicalBill`, `HotelBooking`, `CommissionOverride`, `Hospital` via `@/lib/prisma`.
- Produces:
  - `buildLast12MonthBuckets(now?: Date): { startDate: Date; monthKeys: string[] }`
  - `resolveHospitalCommissionRate(baseRate: number, overrides: CommissionOverrideWindow[], atDate: Date): { rate: number; hasActiveOverride: boolean }`
  - `computePlatformAnalytics(now?: Date): Promise<PlatformAnalyticsPayload>`

- [ ] **Step 1: Write the failing unit & route tests (`src/lib/services/__tests__/analytics.service.test.ts`)**

```typescript
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patient: { groupBy: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn() },
    appointment: { groupBy: jest.fn(), count: jest.fn() },
    hospital: { findMany: jest.fn(), count: jest.fn() },
    doctor: { findMany: jest.fn(), count: jest.fn() },
    case: { count: jest.fn(), findMany: jest.fn() },
    emailCampaign: { count: jest.fn() },
    emailTemplate: { count: jest.fn() },
    medicalBill: { findMany: jest.fn() },
    commissionOverride: { findMany: jest.fn() },
    hotelBooking: { findMany: jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import {
  buildLast12MonthBuckets,
  resolveHospitalCommissionRate,
} from '@/lib/services/analytics.service';
import { GET as getAdminAnalytics } from '@/app/api/v1/admin/analytics/route';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>>;

describe('Task 4: Financial Analytics & CommissionOverride Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds 12 unique contiguous YYYY-MM buckets without skipping February on the 31st of a month', () => {
    const march31 = new Date('2026-03-31T23:59:59.000Z');
    const { monthKeys } = buildLast12MonthBuckets(march31);
    expect(monthKeys).toHaveLength(12);
    expect(new Set(monthKeys).size).toBe(12);
    expect(monthKeys).toContain('2026-02');
    expect(monthKeys[11]).toBe('2026-03');

    const may31 = new Date('2026-05-31T12:00:00.000Z');
    const mayBuckets = buildLast12MonthBuckets(may31);
    expect(new Set(mayBuckets.monthKeys).size).toBe(12);
    expect(mayBuckets.monthKeys).toContain('2026-04');
    expect(mayBuckets.monthKeys).toContain('2026-02');
  });

  it('resolves active date-bound CommissionOverride rates and falls back to base hospital rate outside window', () => {
    const overrides = [
      {
        rate: 22.5,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.000Z'),
        createdAt: new Date('2026-10-25T00:00:00.000Z'),
      },
    ];

    const inside = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-11-15T10:00:00.000Z')
    );
    expect(inside).toEqual({ rate: 22.5, hasActiveOverride: true });

    const outside = resolveHospitalCommissionRate(
      12,
      overrides,
      new Date('2026-12-05T10:00:00.000Z')
    );
    expect(outside).toEqual({ rate: 12, hasActiveOverride: false });
  });

  it('aggregates MedicalBill, CommissionOverride, and non-cancelled HotelBooking revenue in GET /api/v1/admin/analytics', async () => {
    mockedPrisma.patient.groupBy.mockResolvedValue([{ nationality: 'Oman', _count: { id: 2 } }]);
    mockedPrisma.user.findMany.mockResolvedValue([]);
    mockedPrisma.appointment.groupBy.mockResolvedValue([]);
    mockedPrisma.hospital.findMany.mockResolvedValue([
      {
        id: 'hosp-1',
        name: 'Apollo Hospital',
        city: 'New Delhi',
        commissionRate: 10,
        _count: { appointments: 4, doctors: 2 },
      },
    ]);
    mockedPrisma.doctor.findMany.mockResolvedValue([]);
    mockedPrisma.case.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockedPrisma.case.findMany.mockResolvedValue([]);
    mockedPrisma.appointment.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    mockedPrisma.user.count.mockResolvedValue(10);
    mockedPrisma.patient.count.mockResolvedValue(4);
    mockedPrisma.hospital.count.mockResolvedValue(1);
    mockedPrisma.doctor.count.mockResolvedValue(2);
    mockedPrisma.emailCampaign.count.mockResolvedValue(1);
    mockedPrisma.emailTemplate.count.mockResolvedValue(2);

    // Override active during bill-1 (20% instead of 10%)
    mockedPrisma.commissionOverride.findMany.mockResolvedValue([
      {
        id: 'ov-1',
        hospitalId: 'hosp-1',
        rate: 20,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    ]);
    mockedPrisma.medicalBill.findMany.mockResolvedValue([
      {
        id: 'bill-1',
        hospitalId: 'hosp-1',
        totalAmount: 5000,
        paidAmount: 3000,
        status: 'PARTIALLY_PAID',
        createdAt: new Date('2026-11-20T10:00:00.000Z'),
      },
    ]);
    mockedPrisma.hotelBooking.findMany.mockResolvedValue([
      { id: 'bk-1', totalAmountUsd: 800, commissionAmountUsd: 120, status: 'CONFIRMED' },
    ]);

    const req = new NextRequest('http://localhost/api/v1/admin/analytics', {
      headers: { 'x-user-id': 'adm-1', 'x-user-email': 'a@example.com', 'x-user-role': 'ADMIN' },
    });
    const res = await getAdminAnalytics(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revenueEstimates.medicalBilling).toEqual({
      totalInvoiced: 5000,
      totalCollected: 3000,
      totalOutstanding: 2000,
      estimatedHospitalCommission: 1000, // 20% override of 5000
    });
    expect(json.data.revenueEstimates.accommodations).toEqual({
      activeBookings: 1,
      grossRevenueUsd: 800,
      partnerCommissionUsd: 120,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/__tests__/analytics.service.test.ts`
Expected: FAIL (`Cannot find module '@/lib/services/analytics.service'`).

- [ ] **Step 3: Implement `analytics.service.ts`, `/api/v1/admin/analytics`, and `/admin/analytics` UI**

1. Create `src/lib/services/analytics.service.ts`:
   - `buildLast12MonthBuckets(now = new Date())`: uses `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))` for `i = 11..0`, returning `{ startDate, monthKeys }` and formatting user registration timestamps with `getUTCFullYear()` / `getUTCMonth()`.
   - `resolveHospitalCommissionRate(baseRate, overrides, atDate)`: filters overrides where `startDate <= atDate <= endDate`, sorts by `createdAt` desc then `startDate` desc, returns `{ rate: Number(match.rate), hasActiveOverride: true }` or `{ rate: baseRate, hasActiveOverride: false }`.
   - `computePlatformAnalytics(now = new Date())`: queries existing operational metrics plus non-`CANCELLED` `MedicalBill`s, `CommissionOverride`s, and non-`CANCELLED` `HotelBooking`s, computing `revenueEstimates.medicalBilling`, `revenueEstimates.accommodations`, `revenueEstimates.activeCommissionOverrides`, and `effectiveCommissionRate` / `hasActiveOverride` per hospital in `hospitalUtilization`.
2. Update `src/app/api/v1/admin/analytics/route.ts` (`GET` requiring `ADMIN` role and delegating to `computePlatformAnalytics()`).
3. Update `src/app/(admin)/admin/analytics/page.tsx`:
   - Render a dedicated **Financial & Commission Intelligence** row showing Medical Billing Invoiced / Collected / Outstanding, Estimated Hospital Commission (noting active `CommissionOverride` count), and Partner Hotel Gross Volume & Commission Cut, plus show an `"Override Active"` pill on hospitals in `hospitalUtilization` when `h.hasActiveOverride` is true.

- [ ] **Step 4: Run full verification suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`)**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS (`0` errors, all routes compiled cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/analytics.service.ts src/app/api/v1/admin/analytics/route.ts "src/app/(admin)/admin/analytics/page.tsx" src/lib/services/__tests__/analytics.service.test.ts
git commit -m "feat(analytics): fix month-end rollover and integrate MedicalBill, HotelBooking, and CommissionOverride revenue"
```
