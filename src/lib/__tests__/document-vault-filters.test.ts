import {
  matchesPatientDocumentCategoryFilter,
  canPatientDeleteDocument,
} from '@/lib/validation/document-vault-helpers';
import {
  isPassportValidForMedicalVisa,
  formatConsultationScheduleDualTz,
  isSafeHttpUrl,
} from '@/lib/validation/booking-helpers';
import { bookAppointmentSchema } from '@/lib/validation/schemas';

describe('Task 4: Patient Document Vault Filters & Delete Eligibility', () => {
  it('includes INSURANCE under TRAVEL_VERIFICATION filter and preserves HOSPITAL_OFFICIAL / DIAGNOSTICS', () => {
    expect(matchesPatientDocumentCategoryFilter('INSURANCE', 'TRAVEL_VERIFICATION')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('PASSPORT', 'TRAVEL_VERIFICATION')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('MEDICAL_REPORT', 'TRAVEL_VERIFICATION')).toBe(false);
    expect(matchesPatientDocumentCategoryFilter('FIT_TO_FLY_CERTIFICATE', 'HOSPITAL_OFFICIAL')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('DISCHARGE_SUMMARY', 'HOSPITAL_OFFICIAL')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('DISCHARGE_SUMMARY', 'ALL')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('MEDICAL_REPORT', 'DIAGNOSTICS')).toBe(true);
    expect(matchesPatientDocumentCategoryFilter('INSURANCE', 'ALL')).toBe(true);
  });

  it('allows patient deletion only on PENDING or REJECTED documents (never VERIFIED or ISSUED_BY_HOSPITAL)', () => {
    expect(canPatientDeleteDocument('PENDING')).toBe(true);
    expect(canPatientDeleteDocument('REJECTED')).toBe(true);
    expect(canPatientDeleteDocument('VERIFIED')).toBe(false);
    expect(canPatientDeleteDocument('ISSUED_BY_HOSPITAL')).toBe(false);
  });

  it('isPassportValidForMedicalVisa enforces 6-month (180-day) validity window', () => {
    const ref = new Date('2026-11-24T00:00:00Z');
    expect(isPassportValidForMedicalVisa('2027-02-01', ref)).toBe(false);
    expect(isPassportValidForMedicalVisa('2027-08-01', ref)).toBe(true);
    expect(isPassportValidForMedicalVisa('2027-05-23', ref)).toBe(true); // exactly 180 days from 2026-11-24
    expect(isPassportValidForMedicalVisa('2027-05-22', ref)).toBe(false); // 179 days
    expect(isPassportValidForMedicalVisa(null, ref)).toBe(false);
  });

  it('formatConsultationScheduleDualTz includes IST label and local label', () => {
    const formatted = formatConsultationScheduleDualTz('2026-12-01T09:00:00.000Z');
    expect(formatted.istLabel).toContain('IST');
    expect(formatted.istLabel).toContain('2:30');
    expect(formatted.localLabel.length).toBeGreaterThan(0);
  });

  it('isSafeHttpUrl and bookAppointmentSchema.meetingUrl allow only http/https and reject javascript:/data:', () => {
    expect(isSafeHttpUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:3000/teleconsult')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);

    const futureIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const basePayload = {
      caseId: 'case-1',
      patientId: 'pat-1',
      hospitalId: 'hosp-1',
      doctorId: 'doc-1',
      appointmentType: 'CONSULTATION',
      mode: 'TELECONSULTATION',
      scheduledAt: futureIso,
    };

    expect(
      bookAppointmentSchema.safeParse({
        ...basePayload,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }).success
    ).toBe(true);
    expect(
      bookAppointmentSchema.safeParse({
        ...basePayload,
        meetingUrl: 'javascript:alert(1)',
      }).success
    ).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({
        ...basePayload,
        meetingUrl: 'data:text/html,<script>alert(1)</script>',
      }).success
    ).toBe(false);
  });
});
