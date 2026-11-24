import {
  matchesPatientDocumentCategoryFilter,
  canPatientDeleteDocument,
} from '@/lib/validation/document-vault-helpers';
import {
  isPassportValidForMedicalVisa,
  formatConsultationScheduleDualTz,
} from '@/lib/validation/booking-helpers';

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
});
