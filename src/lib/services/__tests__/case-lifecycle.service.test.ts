import { NextRequest } from 'next/server';
import { decrypt, encrypt } from '@/lib/auth/crypto';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      update: jest.fn(),
    },
    hospital: {
      findUnique: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
    medicalBill: {
      count: jest.fn(),
    },
    clinicalStep: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  registerSchema,
  patientProfileSchema,
} from '@/lib/validation/schemas';
import {
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  derivePatientNextActions,
  canShowRoadmapCertificateDownload,
  computeFormCSlaStatus,
  validateFitToFlySafetyChecklist,
  lifecycleMutationSchema,
  getCaseLifecycle,
  assignCaseClinicalTeam,
  publishCaseTreatmentPlan,
  acceptCaseTreatmentPlan,
  updateCaseTravelLogistics,
  recordCaseFormC,
  submitCaseFollowUpCheckIn,
} from '@/lib/services/case-lifecycle.service';
import { PRESET_TEMPLATES } from '@/lib/services/clinical-pathway.service';
import {
  GET as getLifecycleRoute,
  PUT as putLifecycleRoute,
} from '@/app/api/v1/cases/[id]/lifecycle/route';

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

  describe('Server-Side Lifecycle Mutations & /api/v1/cases/[id]/lifecycle', () => {
    const mockedPrisma = prisma as unknown as {
      case: Record<string, jest.Mock>;
      patient: Record<string, jest.Mock>;
      hospital: Record<string, jest.Mock>;
      doctor: Record<string, jest.Mock>;
      appointment: Record<string, jest.Mock>;
      document: Record<string, jest.Mock>;
      medicalBill: Record<string, jest.Mock>;
      clinicalStep: Record<string, jest.Mock>;
      notification: Record<string, jest.Mock>;
      auditLog: Record<string, jest.Mock>;
    };

    const baseCaseRecord = {
      id: 'case-101',
      patientId: 'pat-101',
      managerId: 'mgr-1',
      hospitalId: null,
      primaryDoctorId: null,
      status: 'INQUIRY_RECEIVED',
      notes: 'Coronary artery disease evaluation',
      treatmentPlan: null,
      travelLogistics: null,
      postReturnFollowUps: null,
      patient: {
        id: 'pat-101',
        userId: 'pat-u-101',
        assignedManagerId: 'mgr-1',
        nationality: 'UAE',
        passportNo: encrypt('A12345678'),
        passportExpiry: new Date('2030-05-15T00:00:00.000Z'),
        user: {
          fullName: 'Ranya Al-Hassan',
          email: 'ranya@example.com',
          phone: '+971501234567',
        },
        medicalProfile: null,
      },
      hospital: null,
      primaryDoctor: null,
      clinicalSteps: [],
      fitToFlyClearance: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockedPrisma.document.findMany.mockResolvedValue([]);
      mockedPrisma.medicalBill.count.mockResolvedValue(0);
      mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });
      mockedPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockedPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    });

    test('updateCaseTravelLogistics encrypts MED-X attendant passports at rest, preserves existing ciphertext on masked re-submit, enforces max 2 attendants, and normalizes date strings', async () => {
      // Also verify registerSchema & patientProfileSchema empty-string passportExpiry normalization
      expect(
        registerSchema.safeParse({
          email: 'ranya@example.com',
          password: 'Password1!',
          fullName: 'Ranya Al-Hassan',
          nationality: 'UAE',
          passportNo: 'A12345678',
          passportExpiry: '',
          dob: '1988-04-12',
        }).success
      ).toBe(true);
      expect(patientProfileSchema.safeParse({ passportExpiry: '' }).success).toBe(true);
      expect(patientProfileSchema.safeParse({ passportExpiry: 'invalid-date' }).success).toBe(false);

      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRecord);
      mockedPrisma.patient.update.mockResolvedValue({ id: 'pat-101' });

      let savedTravelLogistics: Record<string, unknown> = {};
      mockedPrisma.case.update.mockImplementation(async ({ data }: { data: { travelLogistics?: Record<string, unknown> } }) => {
        savedTravelLogistics = data.travelLogistics ?? {};
        return {
          ...baseCaseRecord,
          travelLogistics: data.travelLogistics,
        };
      });

      // >2 attendants rejected per Indian MHA rules
      const tooManyAttendants = await updateCaseTravelLogistics({
        caseId: 'case-101',
        payload: {
          action: 'UPDATE_TRAVEL_LOGISTICS',
          attendants: [
            { fullName: 'Att 1', passportNo: 'P1111111', relation: 'Spouse' },
            { fullName: 'Att 2', passportNo: 'P2222222', relation: 'Brother' },
            { fullName: 'Att 3', passportNo: 'P3333333', relation: 'Sister' },
          ],
        },
        actor: { userId: 'pat-u-101', role: 'PATIENT' },
      });
      expect(tooManyAttendants.ok).toBe(false);
      if (!tooManyAttendants.ok) {
        expect(tooManyAttendants.status).toBe(400);
        expect(tooManyAttendants.message).toContain('at most 2 MED-X');
      }

      // Invalid date string rejected cleanly
      const invalidArrival = await updateCaseTravelLogistics({
        caseId: 'case-101',
        payload: {
          action: 'UPDATE_TRAVEL_LOGISTICS',
          arrivalAt: 'not-a-valid-date',
        },
        actor: { userId: 'pat-u-101', role: 'PATIENT' },
      });
      expect(invalidArrival.ok).toBe(false);
      if (!invalidArrival.ok) expect(invalidArrival.status).toBe(400);

      // Valid submission with 2 MED-X attendants and empty departureAt="" normalized to null
      const savedRes = await updateCaseTravelLogistics({
        caseId: 'case-101',
        payload: {
          action: 'UPDATE_TRAVEL_LOGISTICS',
          passportExpiry: '2031-08-20',
          attendants: [
            { fullName: 'Ahmed Al-Hassan', passportNo: 'U99887766', relation: 'Husband' },
            { fullName: 'Layla Al-Hassan', passportNo: 'U55443322', relation: 'Daughter' },
          ],
          arrivalAirline: 'Emirates',
          arrivalFlightNo: 'EK-510',
          arrivalAt: '2026-12-02T03:45:00.000Z',
          departureAt: '',
          airportPickupRequired: true,
          pickupConfirmed: true, // PATIENT cannot self-confirm pickup
          wheelchairSsrCode: 'WCHR',
        },
        actor: { userId: 'pat-u-101', role: 'PATIENT' },
      });

      expect(savedRes.ok).toBe(true);
      const storedAttendants = (savedTravelLogistics as { attendants: Array<{ passportNo: string }> }).attendants;
      expect(storedAttendants[0].passportNo).not.toBe('U99887766');
      expect(storedAttendants[0].passportNo.split(':')).toHaveLength(3);
      expect(decrypt(storedAttendants[0].passportNo)).toBe('U99887766');
      expect(decrypt(storedAttendants[1].passportNo)).toBe('U55443322');
      expect(savedTravelLogistics.departureAt).toBeNull();
      expect(savedTravelLogistics.pickupConfirmed).not.toBe(true);

      // Viewer response masks attendant passport numbers
      if (savedRes.ok) {
        expect(savedRes.data.travelLogistics?.attendants?.[0].passportNo).toBe('*****7766');
      }

      // Subsequent update re-submitting masked passport preserves original encrypted passport without double-encrypting
      const originalCiphertext = storedAttendants[0].passportNo;
      mockedPrisma.case.findUnique.mockResolvedValueOnce({
        ...baseCaseRecord,
        travelLogistics: savedTravelLogistics,
      });

      const secondRes = await updateCaseTravelLogistics({
        caseId: 'case-101',
        payload: {
          action: 'UPDATE_TRAVEL_LOGISTICS',
          attendants: [
            { fullName: 'Ahmed Al-Hassan', passportNo: '*****7766', relation: 'Husband' },
          ],
          pickupConfirmed: true,
        },
        actor: { userId: 'mgr-1', role: 'MANAGER' },
      });
      expect(secondRes.ok).toBe(true);
      const secondAttendants = (savedTravelLogistics as { attendants: Array<{ passportNo: string }> }).attendants;
      expect(secondAttendants[0].passportNo).toBe(originalCiphertext);
      expect(decrypt(secondAttendants[0].passportNo)).toBe('U99887766');
      expect(savedTravelLogistics.pickupConfirmed).toBe(true);
    });

    test('executes ASSIGN_CLINICAL_TEAM, PUBLISH_TREATMENT_PLAN, ACCEPT_TREATMENT_PLAN, RECORD_FORM_C, and SUBMIT_FOLLOW_UP via service & /api/v1/cases/[id]/lifecycle', async () => {
      // 1. ASSIGN_CLINICAL_TEAM by MANAGER -> UNDER_REVIEW
      mockedPrisma.case.findUnique.mockResolvedValueOnce(baseCaseRecord);
      mockedPrisma.hospital.findUnique.mockResolvedValueOnce({
        id: 'hosp-1',
        name: 'Fortis Escorts Heart Institute',
        city: 'New Delhi',
        address: 'Okhla Road',
        accreditation: 'NABH, JCI',
        isActive: true,
      });
      mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'doc-u-1',
        hospitalId: 'hosp-1',
        fullName: 'Ashok Seth',
        qualification: 'MD, DM',
        isActive: true,
        specialisation: { id: 'spec-1', name: 'Cardiology' },
      });
      mockedPrisma.case.update.mockResolvedValueOnce({
        ...baseCaseRecord,
        hospitalId: 'hosp-1',
        primaryDoctorId: 'doc-1',
        status: 'UNDER_REVIEW',
      });

      const assignRes = await assignCaseClinicalTeam({
        caseId: 'case-101',
        payload: {
          action: 'ASSIGN_CLINICAL_TEAM',
          hospitalId: 'hosp-1',
          primaryDoctorId: 'doc-1',
        },
        actor: { userId: 'mgr-1', role: 'MANAGER' },
      });
      expect(assignRes.ok).toBe(true);
      if (assignRes.ok) {
        expect((assignRes.data.case as { status: string }).status).toBe('UNDER_REVIEW');
      }
      expect(mockedPrisma.notification.createMany).toHaveBeenCalled();

      // 2. PUBLISH_TREATMENT_PLAN by DOCTOR
      const underReviewCase = {
        ...baseCaseRecord,
        hospitalId: 'hosp-1',
        primaryDoctorId: 'doc-1',
        status: 'UNDER_REVIEW',
      };
      mockedPrisma.case.findUnique.mockResolvedValueOnce(underReviewCase);
      mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'doc-u-1',
        fullName: 'Ashok Seth',
        isActive: true,
      });
      let publishedPlan: Record<string, unknown> | null = null;
      mockedPrisma.case.update.mockImplementationOnce(async ({ data }: { data: { treatmentPlan: Record<string, unknown> } }) => {
        publishedPlan = data.treatmentPlan;
        return { ...underReviewCase, treatmentPlan: data.treatmentPlan };
      });

      const pubRes = await publishCaseTreatmentPlan({
        caseId: 'case-101',
        payload: {
          action: 'PUBLISH_TREATMENT_PLAN',
          diagnosis: 'Triple Vessel Coronary Artery Disease',
          procedureName: 'Drug-Eluting Stent Angioplasty (PCI)',
          hospitalLosDays: 3,
          recoveryStayDays: 5,
          estimatedCostUsd: 5400,
          currency: 'USD',
          inclusions: ['Cath lab', '2 DES stents', 'Airport transfers'],
        },
        actor: { userId: 'doc-u-1', role: 'DOCTOR' },
      });
      expect(pubRes.ok).toBe(true);
      expect(publishedPlan).toMatchObject({
        diagnosis: 'Triple Vessel Coronary Artery Disease',
        estimatedCostUsd: 5400,
        consentAcceptedAt: null,
      });

      // 3. ACCEPT_TREATMENT_PLAN: MANAGER blocked (403), then PATIENT succeeds via PUT /api/v1/cases/[id]/lifecycle -> PLAN_CONFIRMED
      const mgrAcceptBlocked = await acceptCaseTreatmentPlan({
        caseId: 'case-101',
        payload: {
          action: 'ACCEPT_TREATMENT_PLAN',
          informedConsentAccepted: true,
        },
        actor: { userId: 'mgr-1', role: 'MANAGER' },
      });
      expect(mgrAcceptBlocked.ok).toBe(false);
      if (!mgrAcceptBlocked.ok) expect(mgrAcceptBlocked.status).toBe(403);

      mockedPrisma.case.findUnique.mockResolvedValueOnce({
        ...underReviewCase,
        treatmentPlan: publishedPlan,
      });
      mockedPrisma.case.update.mockImplementationOnce(async ({ data }: { data: { status: string; treatmentPlan: Record<string, unknown> } }) => ({
        ...underReviewCase,
        status: data.status,
        treatmentPlan: data.treatmentPlan,
      }));

      const putAcceptReq = new NextRequest('http://localhost/api/v1/cases/case-101/lifecycle', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'pat-u-101',
          'x-user-email': 'ranya@example.com',
          'x-user-role': 'PATIENT',
        },
        body: JSON.stringify({
          action: 'ACCEPT_TREATMENT_PLAN',
          informedConsentAccepted: true,
        }),
      });
      const putAcceptRes = await putLifecycleRoute(putAcceptReq, {
        params: Promise.resolve({ id: 'case-101' }),
      });
      expect(putAcceptRes.status).toBe(200);
      const acceptJson = await putAcceptRes.json();
      expect(acceptJson.data.case.status).toBe('PLAN_CONFIRMED');
      expect(acceptJson.data.treatmentPlan.consentAcceptedAt).toBeTruthy();

      // 4. RECORD_FORM_C by MANAGER
      mockedPrisma.case.findUnique.mockResolvedValueOnce({
        ...underReviewCase,
        status: 'IN_TREATMENT',
        travelLogistics: { arrivalAt: '2026-12-02T04:00:00.000Z' },
      });
      mockedPrisma.case.update.mockImplementationOnce(async ({ data }: { data: { travelLogistics: Record<string, unknown> } }) => ({
        ...underReviewCase,
        status: 'IN_TREATMENT',
        travelLogistics: data.travelLogistics,
      }));

      const formCRes = await recordCaseFormC({
        caseId: 'case-101',
        payload: {
          action: 'RECORD_FORM_C',
          formCSubmittedAt: '2026-12-02T12:00:00.000Z',
          frroNumber: 'FRRO-DEL-8821',
        },
        actor: { userId: 'mgr-1', role: 'MANAGER' },
      });
      expect(formCRes.ok).toBe(true);
      if (formCRes.ok) {
        expect(formCRes.data.travelLogistics?.frroNumber).toBe('FRRO-DEL-8821');
        expect(formCRes.data.formCSlaStatus).toBe('SUBMITTED_ON_TIME');
      }

      // 5. SUBMIT_FOLLOW_UP by PATIENT then DOCTOR
      const ftfClearedCase = {
        ...underReviewCase,
        status: 'FIT_TO_FLY_CLEARED',
        postReturnFollowUps: [
          { milestone: 'DAY_7', dueAt: '2026-12-17T00:00:00.000Z', status: 'PENDING' },
          { milestone: 'DAY_30', dueAt: '2027-01-09T00:00:00.000Z', status: 'PENDING' },
          { milestone: 'DAY_90', dueAt: '2027-03-10T00:00:00.000Z', status: 'PENDING' },
        ],
      };
      mockedPrisma.case.findUnique.mockResolvedValueOnce(ftfClearedCase);
      let updatedMilestones: unknown[] = [];
      mockedPrisma.case.update.mockImplementationOnce(async ({ data }: { data: { postReturnFollowUps: unknown[]; status?: string } }) => {
        updatedMilestones = data.postReturnFollowUps;
        return { ...ftfClearedCase, ...data };
      });

      const patFollowUp = await submitCaseFollowUpCheckIn({
        caseId: 'case-101',
        payload: {
          action: 'SUBMIT_FOLLOW_UP',
          milestone: 'DAY_7',
          painScore: 2,
          woundStatus: 'CLEAN_DRY',
          patientNotes: 'Radial access site completely healed; walking 20 mins daily.',
        },
        actor: { userId: 'pat-u-101', role: 'PATIENT' },
      });
      expect(patFollowUp.ok).toBe(true);
      expect(updatedMilestones[0]).toMatchObject({
        milestone: 'DAY_7',
        status: 'SUBMITTED',
        painScore: 2,
      });

      mockedPrisma.case.findUnique.mockResolvedValueOnce({
        ...ftfClearedCase,
        status: 'REMOTE_REHAB',
        postReturnFollowUps: updatedMilestones,
      });
      mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'doc-u-1',
        fullName: 'Ashok Seth',
        isActive: true,
      });
      mockedPrisma.case.update.mockImplementationOnce(async ({ data }: { data: { postReturnFollowUps: unknown[] } }) => {
        updatedMilestones = data.postReturnFollowUps;
        return { ...ftfClearedCase, status: 'REMOTE_REHAB', ...data };
      });

      const docFollowUp = await submitCaseFollowUpCheckIn({
        caseId: 'case-101',
        payload: {
          action: 'SUBMIT_FOLLOW_UP',
          milestone: 'DAY_7',
          doctorFeedback: 'Excellent recovery; continue aspirin + ticagrelor as prescribed.',
        },
        actor: { userId: 'doc-u-1', role: 'DOCTOR' },
      });
      expect(docFollowUp.ok).toBe(true);
      expect(updatedMilestones[0]).toMatchObject({
        milestone: 'DAY_7',
        status: 'REVIEWED',
        doctorFeedback: 'Excellent recovery; continue aspirin + ticagrelor as prescribed.',
      });

      // 6. GET /api/v1/cases/[id]/lifecycle returns masked patient & attendant passports
      mockedPrisma.case.findUnique.mockResolvedValueOnce({
        ...underReviewCase,
        travelLogistics: {
          attendants: [
            { fullName: 'Ahmed Al-Hassan', passportNo: encrypt('U99887766'), relation: 'Husband' },
          ],
        },
      });
      const getReq = new NextRequest('http://localhost/api/v1/cases/case-101/lifecycle', {
        method: 'GET',
        headers: {
          'x-user-id': 'pat-u-101',
          'x-user-email': 'ranya@example.com',
          'x-user-role': 'PATIENT',
        },
      });
      const getRes = await getLifecycleRoute(getReq, {
        params: Promise.resolve({ id: 'case-101' }),
      });
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.data.case.patient.passportNo).toBe('*****5678');
      expect(getJson.data.travelLogistics.attendants[0].passportNo).toBe('*****7766');
      expect(Array.isArray(getJson.data.nextActions)).toBe(true);

      // Unassigned patient blocked on getCaseLifecycle -> 403
      mockedPrisma.case.findUnique.mockResolvedValueOnce(underReviewCase);
      const wrongPatLifecycle = await getCaseLifecycle('case-101', {
        userId: 'other-patient-user',
        role: 'PATIENT',
      });
      expect(wrongPatLifecycle.ok).toBe(false);
      if (!wrongPatLifecycle.ok) expect(wrongPatLifecycle.status).toBe(403);
    });
  });
});
