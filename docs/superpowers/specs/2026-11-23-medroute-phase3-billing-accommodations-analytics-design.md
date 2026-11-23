# MedRoute (`afzal-healthcare`) — Sub-Project 3 Architectural Design Specification
## Medical Billing Unblocking, Dual Payment Settlement, Real PDF Stream OCR, Accommodations Lifecycle & Revenue Analytics

- **Date:** 2026-11-23
- **Status:** Approved for Spec Review
- **Audit Findings Remediated:** `C-07 #3` (Manager Billing `403` Patient Selector Deadlock), `4.1 #1` (Hardcoded OCR Billing Engine + `route.ts` Export Hazard), `4.1 #2` (Dead Medical Bill Settlement Workflow), `4.2` (Hotel Booking Date Inversion, Past Defaults, Missing Hotel/Booking Update & Cancel Flows, `DOCTOR` Commission Leak), and `4.2` (Analytics Month-End Rollover Bug & Disconnected `MedicalBill` / `HotelBooking` / `CommissionOverride` Revenue Metrics).
- **Prerequisite Baseline:** Sub-project 2 (`34f9da7` on `main`). Zero Prisma schema DDL changes are required — all features operate over existing `MedicalBill`, `BillItem`, `Hotel`, `HotelBooking`, `CommissionOverride`, `Hospital`, `Case`, and `ClinicalStep` models.

---

## 1. Goals & Scope Boundaries

### In Scope (Sub-Project 3)
1. **Manager Billing Unblocking & Dual Payment Settlement (`C-07`, `4.1 #2`):**
   - Expose `GET /api/v1/manager/billing?meta=true` returning authorized open patient cases and active partner hospitals so `/manager/billing` no longer calls `/api/v1/patient/cases` (`403 FORBIDDEN`) and can attach `hospitalId` to new invoices.
   - Add `PATCH /api/v1/manager/billing` for assigned `MANAGER`s and `ADMIN`s to record offline/hospital payments (`paymentAmount` increment or explicit `paidAmount`), update `status` (`PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`), `dueDate`, `notes`, and `hospitalId`, with `AuditLog` tracking.
   - Add `POST /api/v1/patient/billing/pay` for owning `PATIENT`s to pay full or partial invoice balances (`amount`, `paymentMethod`: `'CARD' | 'WIRE_TRANSFER' | 'INSURANCE_DIRECT'`, optional `referenceNo`), updating `paidAmount` and `status` atomically inside `prisma.$transaction`.
   - Auto-complete pending `SETTLE_BILL` `ClinicalStep` rows on `bill.caseId` whenever a bill reaches `PAID` and no other unpaid non-`CANCELLED` bills remain on that case.
2. **Real PDF Text-Stream OCR Parser & Upload Hardening (`4.1 #1`):**
   - Move `OcrLineItem`, `PageOcrMetadata`, and `MultiPageOcrExtractionResult` out of `src/app/api/v1/manager/billing/ocr/route.ts` into `src/lib/services/billing-ocr.service.ts` (eliminating Next.js 16 `route.ts` type-export violations).
   - Gate `POST /api/v1/manager/billing/ocr` to `MANAGER` and `ADMIN`, enforce `instanceof File`, and validate every uploaded file via `validateUploadBuffer` (`%PDF-`, JPEG, PNG magic bytes + 25 MB cap).
   - Parse real text streams from uploaded PDFs using Node `zlib.inflateSync` (`/FlateDecode` decompression with 10 MB output guard + `BT ... ET` `Tj`/`TJ` token extraction) to extract real invoice numbers, hospital names, currency (`USD` / `INR`), and itemized `description + quantity + unitPrice + amount` charges (`extractionMode: 'PDF_TEXT'`, `confidenceScore: 0.94`).
   - Provide an explicit, honest fallback (`extractionMode: 'SCANNED_FALLBACK'`, `confidenceScore: 0.65`) when an uploaded raster scan (`.jpg`/`.png` or image-only PDF) contains no digital text tokens, displaying a verification banner in `/manager/billing`.
3. **Accommodations & Hotel Booking Lifecycle (`4.2`):**
   - Redact `commissionPercent` in `GET /api/v1/accommodations` for every caller except `ADMIN` and `MANAGER` (closing the `DOCTOR` commission leak) and support `?includeInactive=true` for `ADMIN`/`MANAGER`.
   - Add `PUT` and `DELETE` (soft-deactivate `isActive: false`) on `/api/v1/accommodations` (`ADMIN` and `MANAGER`, with `AuditLog`).
   - Add `PATCH /api/v1/accommodations/bookings`:
     - `PATIENT` can cancel (`status: 'CANCELLED'`) their own `PENDING` or `CONFIRMED` reservation.
     - Assigned `MANAGER` or `ADMIN` can update booking `status` (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`), stay dates (`checkInDate`, `checkOutDate` validated via `calculateHotelStayNights`, recomputing `numNights`, `totalAmountUsd`, and `commissionAmountUsd`), `roomType`, `numGuests`, and `specialRequests`.
   - Extract shared `<PartnerAccommodationsWorkspace />` mounted at both `/admin/accommodations` and new `/manager/accommodations` (linked in `ManagerLayout`), and update `/patient/accommodations` with dynamic future default dates (`tomorrow` to `+5 nights`), strict `calculateHotelStayNights` client preview (no `Math.abs()`), and a `"Cancel Reservation"` action.
4. **Financial Analytics & Date-Bound `CommissionOverride` Engine (`4.2`):**
   - Fix the month-end rollover bug in `GET /api/v1/admin/analytics` using UTC day-1 month anchoring (`Date.UTC(year, month - i, 1)`).
   - Compute real `medicalBilling` (`totalInvoiced`, `totalCollected`, `totalOutstanding`, `estimatedHospitalCommission` honoring active date-bound `CommissionOverride` windows per hospital bill), `accommodations` (`activeBookings`, `grossRevenueUsd`, `partnerCommissionUsd` excluding `CANCELLED`), and effective current commission rates in `hospitalUtilization`, and render them in `/admin/analytics`.

### Out of Scope (Deferred to Sub-Project 4)
- `SystemConfig` migration from `src/data/settings.json`, runtime enforcement of `maxPatientsPerManager` / `maintenanceMode`, Notification bell/reader APIs, Email Campaign sanitization/worker, and CSV formula injection hardening (**Sub-project 4**).

---

## 2. Role Authority & Access Matrix

| Endpoint / Capability | `PATIENT` | `DOCTOR` | `MANAGER` | `ADMIN` |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/v1/manager/billing?meta=true` | `403` | `403` | Assigned open cases + active hospitals | All open cases + active hospitals |
| `PATCH /api/v1/manager/billing` | `403` | `403` | Assigned case bills (`case.managerId === userId`) | All bills |
| `POST /api/v1/manager/billing/ocr` | `403` | `403` | Allowed | Allowed |
| `POST /api/v1/patient/billing/pay` | Own bills (`bill.patientId === patient.id`) | `403` | `403` | `403` |
| `GET /api/v1/accommodations` | Active hotels (`commissionPercent` stripped) | Active hotels (`commissionPercent` stripped) | Active (or `?includeInactive=true`) with `commissionPercent` | Active (or `?includeInactive=true`) with `commissionPercent` |
| `POST / PUT / DELETE /api/v1/accommodations` | `403` | `403` | Allowed (audited) | Allowed (audited) |
| `PATCH /api/v1/accommodations/bookings` | Cancel own `PENDING`/`CONFIRMED` booking | `403` | Assigned patient bookings (status/dates/details) | All bookings |
| `GET /api/v1/admin/analytics` | `403` | `403` | `403` | Full financial & operational analytics |

Add `AUDIT_ACTIONS` in `src/lib/api/audit-logger.ts`:
- `SETTLE_BILL: 'SETTLE_BILL'`
- `UPDATE_BILL: 'UPDATE_BILL'`
- `UPDATE_BOOKING: 'UPDATE_BOOKING'`

---

## 3. Subsystem Specifications

### 3.1 Medical Billing Service & Dual Settlement (`src/lib/services/billing.service.ts`)
1. **`getManagerBillingMetadata(actor)` (`GET /api/v1/manager/billing?meta=true`):**
   - Queries `Case` where `status: { not: 'CLOSED' }` (and `managerId: actor.userId` when `actor.role === 'MANAGER'`) including `patient: { select: { id: true, user: { select: { fullName: true, email: true } } } }`.
   - Queries `Hospital` where `isActive: true` selecting `{ id: true, name: true, city: true }`.
   - Returns `{ bills, metadata: { cases, hospitals } }` when `meta=true` (preserving `{ bills }` when `meta` is omitted).
2. **`deriveBillStatus(totalAmount, paidAmount, requestedStatus?)`:**
   - Pure helper:
     - If `requestedStatus === 'CANCELLED'`, returns `'CANCELLED'`.
     - If `totalAmount > 0 && paidAmount >= totalAmount`, returns `'PAID'`.
     - If `paidAmount > 0 && paidAmount < totalAmount`, returns `requestedStatus === 'OVERDUE' ? 'OVERDUE' : 'PARTIALLY_PAID'`.
     - Otherwise returns `requestedStatus === 'OVERDUE' ? 'OVERDUE' : 'PENDING'`.
   - Also applied in `POST /api/v1/manager/billing` so creating a bill with an upfront deposit or full payment sets a consistent status and rejects negative `paidAmount` or `paidAmount > totalAmount` (`400 BAD_REQUEST`).
3. **`syncCaseSettleBillSteps(tx, caseId)`:**
   - Counts remaining non-`CANCELLED` `MedicalBill`s on `caseId` where `status !== 'PAID'`. When `unpaidCount === 0` (and at least 1 `PAID` bill exists on `caseId`), updates non-`COMPLETED` `ClinicalStep`s with `caseId` and `actionType: 'SETTLE_BILL'` to `{ status: 'COMPLETED', completedAt: new Date() }`.
4. **`updateMedicalBill` (`PATCH /api/v1/manager/billing`):**
   - Schema: `{ billId: z.string().min(1), paymentAmount: z.number().positive().optional(), paidAmount: z.number().min(0).optional(), status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(), dueDate: z.string().nullable().optional(), notes: z.string().max(5000).nullable().optional(), hospitalId: z.string().nullable().optional() }`.
   - Verifies bill exists (`404 NOT_FOUND`) and `actor.role === 'ADMIN' || bill.case.managerId === actor.userId || bill.patient.assignedManagerId === actor.userId` (`403 FORBIDDEN` otherwise).
   - Computes `nextPaid = paymentAmount !== undefined ? Number(bill.paidAmount) + paymentAmount : (paidAmount !== undefined ? paidAmount : Number(bill.paidAmount))`. Rejects `nextPaid < 0` or `nextPaid > Number(bill.totalAmount) + 0.005` (`400 BAD_REQUEST`: `'Paid amount cannot exceed total invoice amount'`).
   - Clamps `nextPaid = Math.min(Number(bill.totalAmount), Math.round(nextPaid * 100) / 100)`, computes `nextStatus = deriveBillStatus(Number(bill.totalAmount), nextPaid, status)`, updates inside `prisma.$transaction`, calls `syncCaseSettleBillSteps`, and logs `SETTLE_BILL` (when `nextPaid > Number(bill.paidAmount)` or `nextStatus === 'PAID'`) or `UPDATE_BILL`.
5. **`payPatientMedicalBill` (`POST /api/v1/patient/billing/pay`):**
   - Schema: `{ billId: z.string().min(1), amount: z.number().positive(), paymentMethod: z.enum(['CARD', 'WIRE_TRANSFER', 'INSURANCE_DIRECT']), referenceNo: z.string().trim().max(120).optional() }`.
   - Verifies `actor.role === 'PATIENT'`, resolves `Patient` by `userId`, verifies `bill.patientId === patient.id` (`403` otherwise), rejects `bill.status === 'CANCELLED'` or `bill.status === 'PAID'` (`400 BAD_REQUEST`), and verifies `amount <= remainingBalance + 0.005` (`400 BAD_REQUEST`).
   - Atomically increments `paidAmount`, derives `status` (`PAID` or `PARTIALLY_PAID`), appends a timestamped payment receipt line to `notes` (`[Paid USD X.XX via CARD ...]`), runs `syncCaseSettleBillSteps`, and writes `SETTLE_BILL` to `AuditLog`.
6. **UI Updates (`/manager/billing` & `/patient/billing`):**
   - `src/app/(manager)/manager/billing/page.tsx`: Fetch `/api/v1/manager/billing?meta=true` (populating both patient/case options — supporting patients with multiple open cases cleanly by `caseId` — and optional `Hospital` selector in the Create Bill modal), and add a `"Record Payment / Update Status"` section inside the Bill Breakdown modal (`Record Full Balance`, custom `paymentAmount`, or status/notes update via `PATCH /api/v1/manager/billing`).
   - `src/app/(patient)/patient/billing/page.tsx`: Add `"Pay Balance"` button on any bill with `due > 0 && bill.status !== 'CANCELLED'`, opening a payment modal (`Pay Full Remaining Balance` or `Pay Custom Deposit`, `paymentMethod` selector, optional `referenceNo`) calling `POST /api/v1/patient/billing/pay`.

### 3.2 Real PDF Text-Stream OCR Parser (`src/lib/services/billing-ocr.service.ts`)
1. **Validation & Security (`POST /api/v1/manager/billing/ocr`):**
   - Require `MANAGER` or `ADMIN` role (`403 FORBIDDEN` otherwise).
   - Filter `formData.getAll('files')` and `formData.get('file')` strictly with `f instanceof File && f.size > 0`.
   - Read each file's `Buffer` and validate via `validateUploadBuffer(buf, file.name, file.type)` (`400 BAD_REQUEST` on invalid MIME/extension/magic bytes or `> 25 MB`).
2. **Deterministic PDF Stream Extraction (`extractTextFromPdfBuffer(buffer)`):**
   - Scans PDF `stream ... endstream` blocks; if the stream's dictionary declares `/FlateDecode` (without secondary predictors that fail raw inflate), decompresses with `zlib.inflateSync(rawStream, { maxOutputLength: 10 * 1024 * 1024 })` (catching corrupt streams safely); otherwise inspects uncompressed ASCII streams directly.
   - Extracts text strings from `( ... ) Tj`, `[( ... )] TJ`, `'`, and `"` operators (unescaping `\n`, `\r`, `\t`, `\(`, `\)`, `\\`, and octal escapes).
   - Parses extracted lines across pages for:
     - Invoice number (`/\b(?:INV|BILL)[-_A-Z0-9]+\b/i`).
     - Currency (`/\b(USD|INR|EUR|GBP|AED|OMR)\b/i`, defaulting to `'USD'`).
     - Hospital name (first line matching `/\b(?:Hospital|Medical Center|Clinic|Institute|Healthcare)\b/i`).
     - Line items matching description + numeric quantity/unitPrice/amount patterns (e.g. `Description ... 2 x 750.00 = 1500.00`, `Description | 2 | 750 | 1500`, or `Description $1,800.00`), classifying each item into `'SURGERY_OT' | 'BED_RENT' | 'PHARMACY' | 'DIAGNOSTICS' | 'CONSULTATION' | 'ADMIN_SERVICE'` by keyword matching.
   - When `>= 1` real line item is extracted from PDF text streams, returns `extractionMode: 'PDF_TEXT'`, `confidenceScore: 0.94`, and exact extracted items/subtotals.
   - When `0` text line items are found (e.g., `.jpg`/`.png` raster image or scanned image-only PDF), returns `extractionMode: 'SCANNED_FALLBACK'`, `confidenceScore: 0.65`, and editable starter line items per uploaded file so the coordinator can key in values with a clear `"Scanned Image — Verify Line Items"` warning badge in `/manager/billing`.

### 3.3 Partner Accommodations & Hotel Booking Lifecycle (`src/lib/services/accommodations.service.ts`)
1. **Hotel Management (`/api/v1/accommodations`):**
   - `GET`: Only include `commissionPercent` when `authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'`; strip `commissionPercent` for `PATIENT`, `DOCTOR`, and unauthenticated callers. Allow `?includeInactive=true` when `authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'`.
   - `PUT`: Restricted to `ADMIN` and `MANAGER`. Validates `id` and updatable fields (`name`, `city`, `address`, `nearHospitalId`, `distanceKm`, `starRating`, `nightlyRateUsd` > 0, `0 <= commissionPercent <= 100`, `amenities`, `images`, `description`, `contactPhone`, `contactEmail`, `isActive`), updates `Hotel`, and logs `AUDIT_ACTIONS.UPDATE`.
   - `DELETE`: Restricted to `ADMIN` and `MANAGER`. Accepts `?id=<hotelId>`, soft-deactivates `isActive: false`, and logs `AUDIT_ACTIONS.DEACTIVATE`.
2. **Hotel Booking Lifecycle (`PATCH /api/v1/accommodations/bookings`):**
   - `PATIENT`: May only submit `{ bookingId, status: 'CANCELLED' }` on a booking where `booking.patientId === patient.id` and `booking.status` is `'PENDING'` or `'CONFIRMED'` (`400 BAD_REQUEST` if already `CHECKED_IN`, `COMPLETED`, or `CANCELLED`).
   - `MANAGER` / `ADMIN`: Verify `booking` exists and (for `MANAGER`) `booking.patient.assignedManagerId === authUser.userId` (`403` otherwise). Supports updating `status` (`'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'`), `checkInDate` / `checkOutDate` (re-validated via `calculateHotelStayNights` and recomputing `numNights`, `totalAmountUsd`, and `commissionAmountUsd` from `booking.hotel`), `roomType`, `numGuests` (`1..10`), and `specialRequests`, logging `AUDIT_ACTIONS.UPDATE_BOOKING`.
3. **Portal UI Updates:**
   - Extract `src/components/accommodations/PartnerAccommodationsWorkspace.tsx` (replacing `<img>` with clean layout or keeping zero new lint warnings, adding `Edit` and `Deactivate` buttons on hotel cards, `Show Inactive` toggle, and `Check In` / `Complete` / `Cancel` status controls on the bookings ledger).
   - Render `<PartnerAccommodationsWorkspace />` in `src/app/(admin)/admin/accommodations/page.tsx` and new `src/app/(manager)/manager/accommodations/page.tsx`, and add `'Partner Hotels'` (`/manager/accommodations`) to `ManagerLayout` (`src/app/(manager)/manager/layout.tsx`) under `'Operations & Travel'`.
   - Update `src/app/(patient)/patient/accommodations/page.tsx`:
     - Compute dynamic default dates via helper `getDefaultStayDates(now)` (`checkIn`: tomorrow `YYYY-MM-DD`, `checkOut`: `+5` days `YYYY-MM-DD`).
     - Replace `Math.abs()` in `calculateStayPrice` with `calculateHotelStayNights` (returning `{ valid: false, error, total: 0 }` when `checkOutDate <= checkInDate`, displaying inline date validation error and disabling submit).
     - Remove `commissionPercent` from client `Hotel` interface and add `"Cancel Reservation"` button on `PENDING` / `CONFIRMED` booking vouchers calling `PATCH /api/v1/accommodations/bookings`.

### 3.4 Financial Analytics & `CommissionOverride` Resolution (`src/lib/services/analytics.service.ts`)
1. **`buildLast12MonthBuckets(now: Date)`:**
   - Anchors every month calculation on UTC day `1`: `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))` for `i = 11..0`, returning `{ startDate: Date, monthKeys: string[] }`. Eliminates `setMonth()` day-overflow bugs on the 29th–31st.
2. **`resolveHospitalCommissionRate(baseRate: number, overrides: Array<{ rate: number | Prisma.Decimal; startDate: Date; endDate: Date; createdAt?: Date }>, atDate: Date): number`:**
   - Filters overrides where `startDate.getTime() <= atDate.getTime() && atDate.getTime() <= endDate.getTime()`. If matching overrides exist, returns `Number(latestOverride.rate)` (sorted by `createdAt` desc, then `startDate` desc); otherwise returns `baseRate`.
3. **`GET /api/v1/admin/analytics` & `/admin/analytics` UI:**
   - Queries non-`CANCELLED` `MedicalBill`s (`totalAmount`, `paidAmount`, `hospitalId`, `createdAt`), all `CommissionOverride`s, and non-`CANCELLED` `HotelBooking`s (`totalAmountUsd`, `commissionAmountUsd`).
   - Computes and returns under `revenueEstimates`:
     - `completedAppointments`, `avgCommissionRate` (preserved for backward compatibility)
     - `medicalBilling`: `{ totalInvoiced, totalCollected, totalOutstanding, estimatedHospitalCommission }`
     - `accommodations`: `{ activeBookings, grossRevenueUsd, partnerCommissionUsd }`
     - `activeCommissionOverrides`: count of overrides active at `now`
   - Enhances `hospitalUtilization` items with `effectiveCommissionRate` (resolved at `now`) and `hasActiveOverride: boolean`.
   - Updates `src/app/(admin)/admin/analytics/page.tsx` to display the Medical Billing Settlement, Hospital Commission (with active override indicator), and Partner Hotel Commission breakdowns inside the Revenue & Financial Intelligence section.

---

## 4. Verification & Test Plan

1. **`src/lib/services/__tests__/billing-and-ocr.service.test.ts`:**
   - `deriveBillStatus` and `GET /api/v1/manager/billing?meta=true` manager vs admin scoping.
   - `PATCH /api/v1/manager/billing` & `POST /api/v1/patient/billing/pay` partial/full payment math, overpayment rejection (`400`), ownership enforcement (`403`), and `SETTLE_BILL` clinical pathway step auto-completion when all case bills are settled.
   - `POST /api/v1/manager/billing/ocr`: real PDF buffer text-stream extraction (`extractionMode: 'PDF_TEXT'`) extracting line items/amounts/invoice number, PNG raster fallback (`extractionMode: 'SCANNED_FALLBACK'`), spoofed magic-byte rejection (`400`), and `PATIENT` role rejection (`403`).
2. **`src/lib/services/__tests__/accommodations.service.test.ts`:**
   - `GET /api/v1/accommodations` strips `commissionPercent` for `PATIENT`, `DOCTOR`, and unauthenticated callers while preserving it for `MANAGER` and `ADMIN`.
   - `PUT` / `DELETE /api/v1/accommodations` hotel update & soft-deactivation + audit logging.
   - `PATCH /api/v1/accommodations/bookings` patient self-cancellation (blocking `CHECKED_IN`/`COMPLETED`) vs manager stay-date update recomputing `numNights`, `totalAmountUsd`, and `commissionAmountUsd`.
   - `getDefaultStayDates` future date generation.
3. **`src/lib/services/__tests__/analytics.service.test.ts`:**
   - `buildLast12MonthBuckets` tested at `2026-03-31T23:59:59Z` and `2026-05-31T12:00:00Z` verifying 12 unique contiguous `YYYY-MM` keys including `'2026-02'` and `'2026-04'`.
   - `resolveHospitalCommissionRate` date-window override matching vs base-rate fallback.
   - `GET /api/v1/admin/analytics` end-to-end aggregation of `MedicalBill` + `CommissionOverride` + `HotelBooking` revenue metrics.
4. **Full Build & Quality Gates:** `npm test`, `npm run typecheck` (`next typegen && tsc --noEmit`), `npm run lint` (`0` errors), and `npm run build` (`next build`).
