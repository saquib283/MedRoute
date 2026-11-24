import {
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  derivePatientNextActions,
  canShowRoadmapCertificateDownload,
  computeFormCSlaStatus,
  validateFitToFlySafetyChecklist,
  lifecycleMutationSchema,
} from '@/lib/services/case-lifecycle.service';
import { PRESET_TEMPLATES } from '@/lib/services/clinical-pathway.service';

describe('Case Lifecycle Engine & Stage Guardrails', () => {
  test('buildStandardMvtPathwaySteps seeds 7 sequential stages with Stage 1 Step 1 IN_PROGRESS and remaining PENDING', () => {
    const steps = buildStandardMvtPathwaySteps('CARDIOLOGY');
    expect(steps.length).toBeGreaterThanOrEqual(10);
    const stageOrders = Array.from(new Set(steps.map((s) => s.stageOrder)));
    expect(stageOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps[0].status).toBe('IN_PROGRESS');
    expect(steps.slice(1).every((s) => s.status === 'PENDING')).toBe(true);
    expect(steps.every((s) => !s.doctorNotes)).toBe(true);
  });

  test('buildStandardMvtPathwaySteps without specialtyId seeds clean 7-stage standard MVT pathway', () => {
    const steps = buildStandardMvtPathwaySteps();
    expect(steps.length).toBeGreaterThanOrEqual(10);
    const stageOrders = Array.from(new Set(steps.map((s) => s.stageOrder)));
    expect(stageOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps[0].status).toBe('IN_PROGRESS');
    expect(steps.slice(1).every((s) => s.status === 'PENDING')).toBe(true);
    expect(steps.every((s) => !s.doctorNotes)).toBe(true);
  });

  test('PRESET_TEMPLATES do not hardcode COMPLETED status on unexecuted clinical steps', () => {
    for (const tpl of PRESET_TEMPLATES) {
      expect(tpl.steps[0].status).toBe('IN_PROGRESS');
      expect(tpl.steps.slice(1).every((s) => s.status === 'PENDING')).toBe(true);
      expect(tpl.steps.every((s) => !s.doctorNotes)).toBe(true);
    }
  });

  test('validateCaseStatusTransition blocks jumping to FIT_TO_FLY_CLEARED without signed Fit-to-Fly clearance', () => {
    const blocked = validateCaseStatusTransition({
      currentStatus: 'WARD_RECOVERY',
      nextStatus: 'FIT_TO_FLY_CLEARED',
      hasVerifiedPassport: true,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
    });
    expect(blocked.ok).toBe(false);
  });

  test('validateCaseStatusTransition blocks pre-arrival -> inpatient/surgical transitions without verified passport', () => {
    const planToTreatmentBlocked = validateCaseStatusTransition({
      currentStatus: 'PLAN_CONFIRMED',
      nextStatus: 'IN_TREATMENT',
      hasVerifiedPassport: false,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
    });
    expect(planToTreatmentBlocked.ok).toBe(false);

    const inquiryToIcuBlocked = validateCaseStatusTransition({
      currentStatus: 'INQUIRY_RECEIVED',
      nextStatus: 'ICU_RECOVERY',
      hasVerifiedPassport: false,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
    });
    expect(inquiryToIcuBlocked.ok).toBe(false);

    const planToTreatmentAllowed = validateCaseStatusTransition({
      currentStatus: 'PLAN_CONFIRMED',
      nextStatus: 'IN_TREATMENT',
      hasVerifiedPassport: true,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
    });
    expect(planToTreatmentAllowed.ok).toBe(true);
  });

  test('validateCaseStatusTransition blocks CLOSED when unpaid bills exist without explicit overrideReason', () => {
    const blocked = validateCaseStatusTransition({
      currentStatus: 'FIT_TO_FLY_CLEARED',
      nextStatus: 'CLOSED',
      hasVerifiedPassport: true,
      hasClearedFitToFly: true,
      unpaidBillCount: 1,
    });
    expect(blocked.ok).toBe(false);

    const allowedWithOverride = validateCaseStatusTransition({
      currentStatus: 'INQUIRY_RECEIVED',
      nextStatus: 'CLOSED',
      hasVerifiedPassport: false,
      hasClearedFitToFly: false,
      unpaidBillCount: 0,
      overrideReason: 'Patient elected local care in home country',
    });
    expect(allowedWithOverride.ok).toBe(true);
  });

  test('derivePatientNextActions prioritizes deduplicated rejected docs, unaccepted treatment plan, and blocks pre-arrival prompts after arrival', () => {
    const actions = derivePatientNextActions({
      caseStatus: 'UNDER_REVIEW',
      documents: [
        { category: 'PASSPORT', verificationStatus: 'REJECTED', verificationNotes: 'Blurry MRZ line' },
        { category: 'PASSPORT', verificationStatus: 'REJECTED', verificationNotes: 'Cropped corner' },
      ],
      treatmentPlan: {
        diagnosis: 'CAD',
        procedureName: 'PCI Stent',
        hospitalLosDays: 3,
        recoveryStayDays: 5,
        estimatedCostUsd: 4850,
        currency: 'USD',
        publishedAt: '2026-11-24T00:00:00.000Z',
        consentAcceptedAt: null,
      },
      travelLogistics: null,
      unpaidBillCount: 0,
      postReturnFollowUps: [],
    });

    expect(actions[0].key).toBe('REUPLOAD_REJECTED_DOC');
    expect(actions.filter((a) => a.key === 'REUPLOAD_REJECTED_DOC')).toHaveLength(1);
    expect(actions.some((a) => a.key === 'ACCEPT_TREATMENT_PLAN')).toBe(true);

    // Inpatient & post-return phases must NOT leak pre-arrival visa/flight/quote prompts even when VIL exists
    for (const postArrivalStatus of ['IN_TREATMENT', 'FIT_TO_FLY_CLEARED']) {
      const postArrivalActions = derivePatientNextActions({
        caseStatus: postArrivalStatus,
        documents: [
          { category: 'PASSPORT', verificationStatus: 'VERIFIED' },
          { category: 'VISA_INVITATION_LETTER', verificationStatus: 'ISSUED_BY_HOSPITAL' },
        ],
        treatmentPlan: {
          diagnosis: 'CAD',
          procedureName: 'PCI Stent',
          hospitalLosDays: 3,
          recoveryStayDays: 5,
          estimatedCostUsd: 4850,
          currency: 'USD',
          publishedAt: '2026-11-24T00:00:00.000Z',
          consentAcceptedAt: null,
        },
        travelLogistics: null,
        unpaidBillCount: 0,
        postReturnFollowUps: [],
      });

      expect(postArrivalActions.some((a) => a.key === 'UPLOAD_APPROVED_VISA')).toBe(false);
      expect(postArrivalActions.some((a) => a.key === 'SUBMIT_FLIGHT_DETAILS')).toBe(false);
      expect(postArrivalActions.some((a) => a.key === 'ACCEPT_TREATMENT_PLAN')).toBe(false);
    }
  });

  test('pure client-safe helpers cover certificate visibility, Form C 24h SLA, Fit-to-Fly checklist, and discriminated lifecycle mutations', () => {
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'PENDING' },
        new Set(['PASSPORT'])
      )
    ).toBe(false);
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'PENDING' },
        new Set(['VISA_INVITATION_LETTER'])
      )
    ).toBe(false);
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'VOTE_MDT', status: 'COMPLETED' },
        new Set(['VISA_INVITATION_LETTER'])
      )
    ).toBe(false);
    expect(
      canShowRoadmapCertificateDownload(
        { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        new Set(['PASSPORT', 'VISA_INVITATION_LETTER'])
      )
    ).toBe(true);

    const arrival = new Date('2026-11-22T08:00:00Z').toISOString();
    const now = new Date('2026-11-24T10:00:00Z');
    expect(computeFormCSlaStatus(arrival, null, now)).toBe('OVERDUE_STATUTORY');
    expect(computeFormCSlaStatus(arrival, '2026-11-22T18:00:00Z', now)).toBe('SUBMITTED_ON_TIME');
    expect(computeFormCSlaStatus(arrival, '2026-11-23T12:00:00Z', now)).toBe('SUBMITTED_LATE');

    expect(validateFitToFlySafetyChecklist(true, null).ok).toBe(false);
    expect(validateFitToFlySafetyChecklist(false, null).ok).toBe(true);

    const unsafeChecklist = validateFitToFlySafetyChecklist(true, {
      woundStable: true,
      noTrappedGasRisk: false,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    });
    expect(unsafeChecklist.ok).toBe(false);

    const safeChecklist = validateFitToFlySafetyChecklist(true, {
      woundStable: true,
      noTrappedGasRisk: true,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    });
    expect(safeChecklist.ok).toBe(true);

    const parsedAssign = lifecycleMutationSchema.safeParse({
      action: 'ASSIGN_CLINICAL_TEAM',
      hospitalId: 'hosp-1',
      primaryDoctorId: 'doc-1',
    });
    expect(parsedAssign.success).toBe(true);
  });
});
