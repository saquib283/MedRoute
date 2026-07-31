# Afzal Healthcare — Architecture Decisions Log

## Decision Log

### D-001: `case_status` on Case model only (not duplicated on Patient)
- **Date:** 2026-06-19
- **Context:** PRD Section 6.3 lists `case_status` on both `patients` and `cases` tables.
- **Decision:** Keep `case_status` only on the `Case` model. A patient's current status is derived from their most recent active case.
- **Rationale:** Avoids data duplication and synchronization issues. A patient may have multiple cases over their lifetime. The latest case's status is the "current" patient status.

### D-002: Hospital departments as String[] array, not normalized table
- **Date:** 2026-06-19
- **Context:** PRD references hospital departments as multi-select but doesn't define a separate Department entity.
- **Decision:** Store as a PostgreSQL `String[]` array on the Hospital model.
- **Rationale:** Simpler for v1.0. Departments are primarily labels for filtering. If per-department queries or department-level management becomes needed, can normalize to a table later.

### D-003: RefreshToken table added (not in PRD schema)
- **Date:** 2026-06-19
- **Context:** PRD FR-AUTH-01 specifies "JWT with refresh token rotation" but Section 6.3 doesn't list a refresh_tokens table.
- **Decision:** Added `RefreshToken` model to support server-side token tracking and rotation.
- **Rationale:** Required for secure refresh token rotation — need to track issued tokens, check for reuse, and revoke on logout.

### D-004: TOTP fields on User model (not in PRD schema)
- **Date:** 2026-06-19
- **Context:** PRD FR-AUTH-01 mandates "Two-Factor Authentication (TOTP) mandatory for Admin and Manager roles."
- **Decision:** Added `totp_secret` (encrypted) and `totp_enabled` fields to the User model.
- **Rationale:** Needed to store and validate TOTP secrets for 2FA enforcement.

### D-005: Using `jose` library instead of `jsonwebtoken` for JWT
- **Date:** 2026-06-19
- **Context:** Next.js edge runtime and middleware don't support Node.js native crypto APIs that `jsonwebtoken` depends on.
- **Decision:** Use `jose` library for JWT operations; keep `jsonwebtoken` as fallback for API routes running in Node.js runtime.
- **Rationale:** `jose` works in both Edge and Node.js runtimes, making it compatible with Next.js middleware for route protection.

### D-006: Tailwind CSS v4 for styling
- **Date:** 2026-06-19
- **Context:** User requested Tailwind CSS over vanilla CSS.
- **Decision:** Using Tailwind CSS v4 (default with create-next-app).
- **Rationale:** User preference. v4 is the latest stable version with CSS-first configuration.

### D-007: emergencyContact as JSON field
- **Date:** 2026-06-19
- **Context:** PRD lists emergency contact as a patient field without specifying structure.
- **Decision:** Store as JSON object `{ name: string, phone: string, relation: string }`.
- **Rationale:** Cleaner than three separate columns for a structured sub-object that's always read/written together.
