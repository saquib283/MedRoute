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

  test('derivePatientNextActions prioritizes rejected documents, unaccepted treatment plan, and missing flight details by phase', () => {
    const actions = derivePatientNextActions({
      caseStatus: 'UNDER_REVIEW',
      documents: [
        { category: 'PASSPORT', verificationStatus: 'REJECTED', verificationNotes: 'Blurry MRZ line' },
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
    expect(actions.some((a) => a.key === 'ACCEPT_TREATMENT_PLAN')).toBe(true);
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
        { actionType: 'ISSUE_VIL', status: 'COMPLETED' },
        new Set(['PASSPORT', 'VISA_INVITATION_LETTER'])
      )
    ).toBe(true);

    const arrival = new Date('2026-11-22T08:00:00Z').toISOString();
    const now = new Date('2026-11-24T10:00:00Z');
    expect(computeFormCSlaStatus(arrival, null, now)).toBe('OVERDUE_STATUTORY');
    expect(computeFormCSlaStatus(arrival, '2026-11-22T18:00:00Z', now)).toBe('SUBMITTED_ON_TIME');

    const unsafeChecklist = validateFitToFlySafetyChecklist(true, {
      woundStable: true,
      noTrappedGasRisk: false,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    });
    expect(unsafeChecklist.ok).toBe(false);

    const parsedAssign = lifecycleMutationSchema.safeParse({
      action: 'ASSIGN_CLINICAL_TEAM',
      hospitalId: 'hosp-1',
      primaryDoctorId: 'doc-1',
    });
    expect(parsedAssign.success).toBe(true);
  });
});

