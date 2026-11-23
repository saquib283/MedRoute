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
