/**
 * Afzal Healthcare — Patient Document Vault Filter & Deletion Eligibility Helpers
 */

const TRAVEL_VERIFICATION_CATEGORIES = new Set([
  'PASSPORT',
  'VISA',
  'VISA_INVITATION_LETTER',
  'PROFORMA_INVOICE',
  'FRRO_REGISTRATION',
  'INSURANCE',
]);

const HOSPITAL_OFFICIAL_CATEGORIES = new Set([
  'VISA_INVITATION_LETTER',
  'PROFORMA_INVOICE',
  'MEDICAL_OPINION',
  'FIT_TO_FLY_CERTIFICATE',
  'DISCHARGE_SUMMARY',
]);

export function matchesPatientDocumentCategoryFilter(
  docCategory: string,
  activeFilter: string
): boolean {
  if (activeFilter === 'ALL') return true;
  if (activeFilter === 'TRAVEL_VERIFICATION') {
    return TRAVEL_VERIFICATION_CATEGORIES.has(docCategory);
  }
  if (activeFilter === 'HOSPITAL_OFFICIAL') {
    return HOSPITAL_OFFICIAL_CATEGORIES.has(docCategory);
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
