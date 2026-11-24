import {
  canShowRoadmapCertificateDownload,
  derivePatientNextActions,
  resolveRoadmapStepActionState,
  validatePassportSixMonthValidity,
  validateRegistrationStepOne,
} from '@/lib/validation/lifecycle-schemas';

describe('Patient Roadmap Certificate & Next-Action Gating', () => {
  test('hides Download Visa Letter and Fit-to-Fly buttons until hospital certificate is completed and issued', () => {
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'PENDING' },
        new Set(['PASSPORT'])
      )
    ).toBe(false);

    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'SIGN_FIT_TO_FLY', status: 'IN_PROGRESS' },
        new Set(['PASSPORT'])
      )
    ).toBe(false);

    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        new Set(['PASSPORT'])
      )
    ).toBe(false);

    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        new Set(['PASSPORT', 'VISA_INVITATION_LETTER'])
      )
    ).toBe(true);

    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'SIGN_FIT_TO_FLY', status: 'COMPLETED' },
        new Set(['FIT_TO_FLY_CERTIFICATE'])
      )
    ).toBe(true);
  });

  test('derivePatientNextActions transitions smoothly across all 7 MVT stages', () => {
    // Stage 1: INQUIRY_RECEIVED with 0 medical reports -> UPLOAD_DIAGNOSTICS
    const stage1 = derivePatientNextActions({
      caseStatus: 'INQUIRY_RECEIVED',
      documents: [],
      treatmentPlan: null,
      travelLogistics: null,
      unpaidBillCount: 0,
      postReturnFollowUps: [],
    });
    expect(stage1.some((a) => a.key === 'UPLOAD_DIAGNOSTICS')).toBe(true);
    expect(stage1.some((a) => a.key === 'UPLOAD_PASSPORT')).toBe(true);

    // Stage 2: UNDER_REVIEW with published unaccepted treatmentPlan -> ACCEPT_TREATMENT_PLAN
    const stage2 = derivePatientNextActions({
      caseStatus: 'UNDER_REVIEW',
      documents: [
        { category: 'MEDICAL_REPORT', verificationStatus: 'VERIFIED' },
        { category: 'PASSPORT', verificationStatus: 'VERIFIED' },
      ],
      treatmentPlan: {
        diagnosis: 'Severe Osteoarthritis',
        procedureName: 'Total Knee Replacement',
        hospitalLosDays: 4,
        recoveryStayDays: 10,
        estimatedCostUsd: 6500,
        currency: 'USD',
        publishedAt: '2026-11-24T08:00:00.000Z',
        consentAcceptedAt: null,
      },
      travelLogistics: null,
      unpaidBillCount: 0,
      postReturnFollowUps: [],
    });
    const acceptAction = stage2.find((a) => a.key === 'ACCEPT_TREATMENT_PLAN');
    expect(acceptAction).toBeDefined();
    expect(acceptAction?.modalAction).toBe('TREATMENT_PLAN_MODAL');

    // Stage 3: PLAN_CONFIRMED with issued VIL and no VISA upload -> UPLOAD_APPROVED_VISA & SUBMIT_FLIGHT_DETAILS
    const stage3 = derivePatientNextActions({
      caseStatus: 'PLAN_CONFIRMED',
      documents: [
        { category: 'PASSPORT', verificationStatus: 'VERIFIED' },
        { category: 'MEDICAL_REPORT', verificationStatus: 'VERIFIED' },
        { category: 'VISA_INVITATION_LETTER', verificationStatus: 'ISSUED_BY_HOSPITAL' },
      ],
      treatmentPlan: {
        diagnosis: 'Severe Osteoarthritis',
        procedureName: 'Total Knee Replacement',
        hospitalLosDays: 4,
        recoveryStayDays: 10,
        estimatedCostUsd: 6500,
        currency: 'USD',
        publishedAt: '2026-11-24T08:00:00.000Z',
        consentAcceptedAt: '2026-11-24T09:00:00.000Z',
      },
      travelLogistics: null,
      unpaidBillCount: 0,
      postReturnFollowUps: [],
    });
    expect(stage3.some((a) => a.key === 'UPLOAD_APPROVED_VISA')).toBe(true);
    expect(stage3.some((a) => a.key === 'SUBMIT_FLIGHT_DETAILS')).toBe(true);

    // Stage 5/6: IN_TREATMENT with unpaid bill -> SETTLE_HOSPITAL_BILLS (no pre-arrival prompts)
    const stage5 = derivePatientNextActions({
      caseStatus: 'IN_TREATMENT',
      documents: [
        { category: 'PASSPORT', verificationStatus: 'VERIFIED' },
        { category: 'VISA_INVITATION_LETTER', verificationStatus: 'ISSUED_BY_HOSPITAL' },
      ],
      treatmentPlan: {
        diagnosis: 'Severe Osteoarthritis',
        procedureName: 'Total Knee Replacement',
        hospitalLosDays: 4,
        recoveryStayDays: 10,
        estimatedCostUsd: 6500,
        currency: 'USD',
        publishedAt: '2026-11-24T08:00:00.000Z',
        consentAcceptedAt: '2026-11-24T09:00:00.000Z',
      },
      travelLogistics: null,
      unpaidBillCount: 1,
      postReturnFollowUps: [],
    });
    expect(stage5.some((a) => a.key === 'SETTLE_HOSPITAL_BILLS')).toBe(true);
    expect(stage5.some((a) => a.key === 'UPLOAD_APPROVED_VISA')).toBe(false);
    expect(stage5.some((a) => a.key === 'SUBMIT_FLIGHT_DETAILS')).toBe(false);

    // Stage 7: FIT_TO_FLY_CLEARED / REMOTE_REHAB with PENDING DAY_7 milestone -> COMPLETE_FOLLOW_UP_CHECKIN
    for (const status of ['FIT_TO_FLY_CLEARED', 'REMOTE_REHAB']) {
      const stage7 = derivePatientNextActions({
        caseStatus: status,
        documents: [
          { category: 'PASSPORT', verificationStatus: 'VERIFIED' },
          { category: 'FIT_TO_FLY_CERTIFICATE', verificationStatus: 'ISSUED_BY_HOSPITAL' },
        ],
        treatmentPlan: null,
        travelLogistics: null,
        unpaidBillCount: 0,
        postReturnFollowUps: [
          {
            milestone: 'DAY_7',
            dueAt: '2026-12-01T00:00:00.000Z',
            status: 'PENDING',
          },
        ],
      });
      const checkInAction = stage7.find((a) => a.key === 'COMPLETE_FOLLOW_UP_CHECKIN');
      expect(checkInAction).toBeDefined();
      expect(checkInAction?.modalAction).toBe('FOLLOW_UP_MODAL');
    }

    // Closed case -> no actions
    expect(
      derivePatientNextActions({
        caseStatus: 'CLOSED',
        documents: [],
        unpaidBillCount: 2,
      })
    ).toEqual([]);
  });

  test('validateRegistrationStepOne validates account & contact fields before advancing to Step 2', () => {
    const invalid = validateRegistrationStepOne({
      fullName: 'A',
      email: 'not-an-email',
      password: 'weak',
      phone: '123',
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.fieldErrors.fullName).toBeDefined();
      expect(invalid.fieldErrors.email).toBeDefined();
      expect(invalid.fieldErrors.password).toBeDefined();
      expect(invalid.fieldErrors.phone).toBeDefined();
    }

    const valid = validateRegistrationStepOne({
      fullName: 'Sara Ali',
      email: 'sara.ali@example.com',
      password: 'Password1!',
      phone: '+96891234567',
    });
    expect(valid.ok).toBe(true);
  });

  test('validatePassportSixMonthValidity enforces >= 6 months validity when passportExpiry is supplied', () => {
    const ref = new Date('2026-11-24T00:00:00.000Z');
    expect(validatePassportSixMonthValidity('', ref).ok).toBe(true);
    expect(validatePassportSixMonthValidity(undefined, ref).ok).toBe(true);

    const tooSoon = validatePassportSixMonthValidity('2027-03-01', ref);
    expect(tooSoon.ok).toBe(false);

    const validExpiry = validatePassportSixMonthValidity('2027-08-15', ref);
    expect(validExpiry.ok).toBe(true);
  });

  test('resolveRoadmapStepActionState wires certificate gating, treatment plan, logistics, and tele-rehab actions', () => {
    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_VIL', status: 'PENDING' },
        issuedDocCategories: new Set(['PASSPORT']),
      })
    ).toEqual({ kind: 'WAITING_ON_HOSPITAL', label: 'Waiting on Hospital' });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        issuedDocCategories: new Set(['VISA_INVITATION_LETTER']),
      })
    ).toEqual({
      kind: 'CERTIFICATE_DOWNLOAD',
      label: 'Download Visa Letter',
      href: '/patient/documents',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_PROFORMA', status: 'ACTION_REQUIRED' },
        hasTreatmentPlan: true,
        treatmentPlanAccepted: false,
        unpaidBillCount: 0,
      })
    ).toEqual({
      kind: 'OPEN_MODAL',
      modalAction: 'TREATMENT_PLAN_MODAL',
      label: 'Review Treatment Plan',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ISSUE_PROFORMA', status: 'COMPLETED' },
        hasTreatmentPlan: true,
        treatmentPlanAccepted: true,
        unpaidBillCount: 1,
      })
    ).toEqual({
      kind: 'LINK',
      label: 'Review Invoice',
      href: '/patient/billing',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'ARRANGE_LOGISTICS', status: 'PENDING' },
      })
    ).toEqual({
      kind: 'LINK',
      label: 'Travel & Attendants',
      href: '/patient/documents#travel-concierge',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'SCHEDULE_TELE_REHAB', status: 'IN_PROGRESS' },
        hasPendingFollowUp: true,
      })
    ).toEqual({
      kind: 'OPEN_MODAL',
      modalAction: 'FOLLOW_UP_MODAL',
      label: 'Recovery Check-In',
    });

    expect(
      resolveRoadmapStepActionState({
        step: { actionType: 'SCHEDULE_TELE_REHAB', status: 'PENDING' },
        hasPendingFollowUp: false,
      })
    ).toEqual({
      kind: 'LINK',
      label: 'View Appointments',
      href: '/patient/appointments',
    });
  });
});
