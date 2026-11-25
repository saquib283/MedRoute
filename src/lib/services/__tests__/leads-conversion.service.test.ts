import { NextRequest } from 'next/server';

const mockTxLeadFindUnique = jest.fn();
const mockTxLeadUpdateMany = jest.fn();
const mockTxLeadActivityCreate = jest.fn();
const mockTxUserFindUnique = jest.fn();
const mockTxUserCreate = jest.fn();
const mockTxPatientFindUnique = jest.fn();
const mockTxPatientCount = jest.fn();
const mockTxPatientCreate = jest.fn();
const mockTxPatientUpdate = jest.fn();
const mockTxMedicalProfileCreate = jest.fn();
const mockTxHospitalFindUnique = jest.fn();
const mockTxDoctorFindUnique = jest.fn();
const mockTxCaseCreate = jest.fn();
const mockTxClinicalStepCreateMany = jest.fn();
const mockTxAuditLogCreate = jest.fn();
const mockTxNotificationCreateMany = jest.fn();

const mockLeadFindMany = jest.fn();
const mockLeadActivityCreateMany = jest.fn();
const mockReferralPartnerFindMany = jest.fn();
const mockCaseFindMany = jest.fn();
const mockMedicalBillFindMany = jest.fn();
const mockEmailCampaignUpdate = jest.fn();
const mockSystemConfigFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
    leadActivity: {
      createMany: (...args: unknown[]) => mockLeadActivityCreateMany(...args),
    },
    referralPartner: {
      findMany: (...args: unknown[]) => mockReferralPartnerFindMany(...args),
    },
    case: {
      findMany: (...args: unknown[]) => mockCaseFindMany(...args),
    },
    medicalBill: {
      findMany: (...args: unknown[]) => mockMedicalBillFindMany(...args),
    },
    emailCampaign: {
      update: (...args: unknown[]) => mockEmailCampaignUpdate(...args),
    },
    notification: {
      createMany: jest.fn(),
    },
    systemConfig: {
      findMany: (...args: unknown[]) => mockSystemConfigFindMany(...args),
    },
    $transaction: async <T>(fn: (tx: Record<string, unknown>) => Promise<T>) =>
      fn({
        lead: {
          findUnique: mockTxLeadFindUnique,
          updateMany: mockTxLeadUpdateMany,
        },
        leadActivity: {
          create: mockTxLeadActivityCreate,
        },
        user: {
          findUnique: mockTxUserFindUnique,
          create: mockTxUserCreate,
        },
        patient: {
          findUnique: mockTxPatientFindUnique,
          count: mockTxPatientCount,
          create: mockTxPatientCreate,
          update: mockTxPatientUpdate,
        },
        patientMedicalProfile: {
          create: mockTxMedicalProfileCreate,
        },
        hospital: {
          findUnique: mockTxHospitalFindUnique,
        },
        doctor: {
          findUnique: mockTxDoctorFindUnique,
        },
        case: {
          create: mockTxCaseCreate,
        },
        clinicalStep: {
          createMany: mockTxClinicalStepCreateMany,
        },
        auditLog: {
          create: mockTxAuditLogCreate,
        },
        notification: {
          createMany: mockTxNotificationCreateMany,
        },
      }),
  },
}));

import prisma from '@/lib/prisma';
import {
  convertLeadToPatientCase,
  computeLeadsCrmAnalytics,
} from '@/lib/services/leads-conversion.service';
import {
  findCampaignRecipients,
  dispatchCampaignToRecipients,
} from '@/lib/services/email-campaign.service';
import { POST as convertLeadRoute } from '@/app/api/v1/leads/[id]/convert/route';
import { clearSystemSettingsCache } from '@/lib/services/system-settings.service';
import { buildStandardMvtPathwaySteps } from '@/lib/validation/lifecycle-schemas';
import { decrypt } from '@/lib/auth/crypto';

const EXPECTED_DEFAULT_STEP_COUNT = buildStandardMvtPathwaySteps().length;

function makeSampleLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    referenceNo: 'LD-2026-AB12CD',
    fullName: 'Tariq Al-Balushi',
    email: 'tariq@example.com',
    phone: '+96891234567',
    whatsappNumber: '+96891234567',
    nationality: 'Oman',
    preferredLanguage: 'Arabic',
    medicalCondition: 'Severe coronary artery disease requiring CABG assessment',
    specialtyInterest: 'CARDIOLOGY',
    urgencyLevel: 'URGENT',
    preliminaryQuoteUsd: 11500,
    preliminaryQuoteNotes: 'Includes 7d ICU/ward stay',
    targetHospitalId: null,
    targetDoctorId: null,
    status: 'QUALIFIED',
    source: 'B2B_PARTNER',
    assignedManagerId: 'mgr-1',
    referralPartnerId: 'partner-oman-1',
    firstResponseDueAt: new Date('2026-11-25T10:15:00Z'),
    firstRespondedAt: null,
    convertedPatientId: null,
    convertedCaseId: null,
    convertedAt: null,
    ...overrides,
  };
}

describe('Task 3: Atomic Lead Conversion, Funnel Analytics & LEADS_ACTIVE Nurture Campaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSystemSettingsCache();
    process.env.ENCRYPTION_KEY =
      '0000000000000000000000000000000000000000000000000000000000000000';
    mockSystemConfigFindMany.mockResolvedValue([]);
    mockTxPatientCount.mockResolvedValue(2);
    mockTxLeadActivityCreate.mockResolvedValue({ id: 'act-conv-1' });
    mockTxAuditLogCreate.mockResolvedValue({ id: 'audit-conv-1' });
    mockTxNotificationCreateMany.mockResolvedValue({ count: 2 });
    mockTxClinicalStepCreateMany.mockResolvedValue({ count: EXPECTED_DEFAULT_STEP_COUNT });
  });

  describe('convertLeadToPatientCase — NEW_PATIENT mode', () => {
    it('encrypts passportNo, checks capacity, creates User+Patient+MedicalProfile+Case+ClinicalSteps, marks Lead CONVERTED, and rejects double-conversion with 409', async () => {
      mockTxLeadFindUnique.mockResolvedValue(makeSampleLead());
      mockTxUserFindUnique.mockResolvedValue(null);
      mockTxHospitalFindUnique.mockResolvedValue({ id: 'hosp-1', isActive: true });
      mockTxDoctorFindUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'u-doc-1',
        hospitalId: 'hosp-1',
        isActive: true,
      });
      mockTxUserCreate.mockResolvedValue({
        id: 'u-pat-new',
        email: 'tariq@example.com',
        fullName: 'Tariq Al-Balushi',
        role: 'PATIENT',
      });
      mockTxPatientCreate.mockResolvedValue({
        id: 'pat-new',
        userId: 'u-pat-new',
        assignedManagerId: 'mgr-1',
      });
      mockTxMedicalProfileCreate.mockResolvedValue({ id: 'mp-new', patientId: 'pat-new' });
      mockTxCaseCreate.mockResolvedValue({
        id: 'case-new-1',
        patientId: 'pat-new',
        managerId: 'mgr-1',
        status: 'UNDER_REVIEW',
      });
      mockTxLeadUpdateMany.mockResolvedValue({ count: 1 });

      const res = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'TARIQ@Example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
          hospitalId: 'hosp-1',
          primaryDoctorId: 'doc-1',
          specialtyId: 'CARDIOLOGY',
          notes: 'Prior angiogram uploaded via WhatsApp',
        },
        { userId: 'mgr-1', role: 'MANAGER', ipAddress: '127.0.0.1' }
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data).toMatchObject({
        leadId: 'lead-1',
        patientId: 'pat-new',
        caseId: 'case-new-1',
        userId: 'u-pat-new',
        mode: 'NEW_PATIENT',
      });
      expect(res.data.generatedTemporaryPassword).toBeDefined();
      expect(res.data.generatedTemporaryPassword!.length).toBe(16);

      // AES-256-GCM passport encryption check
      const createdPatientData = mockTxPatientCreate.mock.calls[0][0].data;
      expect(createdPatientData.passportNo).not.toBe('OM4455667');
      expect(createdPatientData.passportNo.split(':')).toHaveLength(3);
      expect(decrypt(createdPatientData.passportNo)).toBe('OM4455667');

      // Capacity checked for target coordinator
      expect(mockTxPatientCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedManagerId: 'mgr-1' }),
        })
      );

      // Case created with UNDER_REVIEW, referralPartnerId, hospital, primaryDoctor, isUrgent
      expect(mockTxCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: 'pat-new',
            managerId: 'mgr-1',
            hospitalId: 'hosp-1',
            primaryDoctorId: 'doc-1',
            referralPartnerId: 'partner-oman-1',
            status: 'UNDER_REVIEW',
            isUrgent: true,
          }),
        })
      );

      // Clinical steps created with Stage 1 Step 1 IN_PROGRESS
      const seededSteps = mockTxClinicalStepCreateMany.mock.calls[0][0].data;
      expect(seededSteps).toHaveLength(EXPECTED_DEFAULT_STEP_COUNT);
      expect(seededSteps[0]).toMatchObject({
        caseId: 'case-new-1',
        stageOrder: 1,
        stepOrder: 1,
        status: 'IN_PROGRESS',
      });

      // Lead marked CONVERTED with atomic concurrency predicate + activity + audit + notifications
      expect(mockTxLeadUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'lead-1',
            status: { notIn: ['CONVERTED', 'LOST'] },
            convertedCaseId: null,
          },
          data: expect.objectContaining({
            status: 'CONVERTED',
            convertedPatientId: 'pat-new',
            convertedCaseId: 'case-new-1',
          }),
        })
      );
      expect(mockTxLeadActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadId: 'lead-1',
            activityType: 'CONVERSION',
          }),
        })
      );
      expect(mockTxAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CONVERT_LEAD',
            entityType: 'Lead',
            entityId: 'lead-1',
          }),
        })
      );
      expect(mockTxNotificationCreateMany).toHaveBeenCalledTimes(1);

      // Reject double conversion with 409
      mockTxLeadFindUnique.mockResolvedValueOnce(
        makeSampleLead({ status: 'CONVERTED', convertedCaseId: 'case-new-1' })
      );
      const dupRes = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );
      expect(dupRes.ok).toBe(false);
      if (!dupRes.ok) {
        expect(dupRes.status).toBe(409);
      }
    });

    it('rejects NEW_PATIENT conversion when manager capacity is full or email already exists', async () => {
      // Duplicate user email -> 409 USER_ALREADY_EXISTS
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead());
      mockTxUserFindUnique.mockResolvedValueOnce({ id: 'existing-u-1' });

      const emailDup = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );
      expect(emailDup.ok).toBe(false);
      if (!emailDup.ok) {
        expect(emailDup.status).toBe(409);
        expect(emailDup.code).toBe('USER_ALREADY_EXISTS');
      }

      // Capacity reached -> 400
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead());
      mockTxUserFindUnique.mockResolvedValueOnce(null);
      mockTxPatientCount.mockResolvedValueOnce(25);

      const capFail = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq2@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );
      expect(capFail.ok).toBe(false);
      if (!capFail.ok) {
        expect(capFail.status).toBe(400);
      }
    });

    it('enforces RBAC, rejects LOST leads, and validates hospital/doctor integrity', async () => {
      // Unassigned/different manager -> 403
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead({ assignedManagerId: 'mgr-2' }));
      const forbiddenRes = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );
      expect(forbiddenRes.ok).toBe(false);
      if (!forbiddenRes.ok) expect(forbiddenRes.status).toBe(403);

      // LOST lead -> 400
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead({ status: 'LOST' }));
      const lostRes = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'admin-1', role: 'ADMIN' }
      );
      expect(lostRes.ok).toBe(false);
      if (!lostRes.ok) expect(lostRes.status).toBe(400);

      // Doctor from mismatched hospital -> 400
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead());
      mockTxHospitalFindUnique.mockResolvedValueOnce({ id: 'hosp-1', isActive: true });
      mockTxDoctorFindUnique.mockResolvedValueOnce({
        id: 'doc-other',
        userId: 'u-doc-2',
        hospitalId: 'hosp-2',
        isActive: true,
      });
      const mismatchRes = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
          hospitalId: 'hosp-1',
          primaryDoctorId: 'doc-other',
        },
        { userId: 'admin-1', role: 'ADMIN' }
      );
      expect(mismatchRes.ok).toBe(false);
      if (!mismatchRes.ok) expect(mismatchRes.status).toBe(400);
    });

    it('returns 409 CONFLICT and rolls back when tx.lead.updateMany returns count: 0 due to a concurrent conversion race', async () => {
      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead());
      mockTxUserFindUnique.mockResolvedValueOnce(null);
      mockTxUserCreate.mockResolvedValueOnce({
        id: 'u-race-1',
        email: 'tariq@example.com',
        fullName: 'Tariq Al-Balushi',
        role: 'PATIENT',
      });
      mockTxPatientCreate.mockResolvedValueOnce({
        id: 'pat-race-1',
        userId: 'u-race-1',
        assignedManagerId: 'mgr-1',
      });
      mockTxMedicalProfileCreate.mockResolvedValueOnce({ id: 'mp-race-1', patientId: 'pat-race-1' });
      mockTxCaseCreate.mockResolvedValueOnce({
        id: 'case-race-1',
        patientId: 'pat-race-1',
        managerId: 'mgr-1',
        status: 'INQUIRY_RECEIVED',
      });
      mockTxLeadUpdateMany.mockResolvedValueOnce({ count: 0 });

      const raceRes = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'NEW_PATIENT',
          email: 'tariq@example.com',
          passportNo: 'OM4455667',
          dob: '1978-04-12',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );

      expect(mockTxLeadUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'lead-1',
            status: { notIn: ['CONVERTED', 'LOST'] },
            convertedCaseId: null,
          },
        })
      );
      expect(raceRes).toEqual({
        ok: false,
        code: 'CONFLICT',
        message: 'Lead has already been converted',
        status: 409,
      });
      expect(mockTxLeadActivityCreate).not.toHaveBeenCalled();
      expect(mockTxAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  describe('convertLeadToPatientCase — EXISTING_PATIENT mode', () => {
    it('links a new Case + ClinicalSteps to an existing Patient without duplicating User/Patient, preserving referralPartnerId & clinical notes', async () => {
      mockTxLeadFindUnique.mockResolvedValue(
        makeSampleLead({
          urgencyLevel: 'ROUTINE',
          preliminaryQuoteUsd: 6500,
          preliminaryQuoteNotes: 'Knee arthroscopy package',
        })
      );
      mockTxPatientFindUnique.mockResolvedValue({
        id: 'pat-existing-1',
        userId: 'u-pat-existing-1',
        assignedManagerId: 'mgr-1',
      });
      mockTxCaseCreate.mockResolvedValue({
        id: 'case-existing-2',
        patientId: 'pat-existing-1',
        managerId: 'mgr-1',
        status: 'INQUIRY_RECEIVED',
      });
      mockTxLeadUpdateMany.mockResolvedValue({ count: 1 });

      const res = await convertLeadToPatientCase(
        'lead-1',
        {
          mode: 'EXISTING_PATIENT',
          existingPatientId: 'pat-existing-1',
          notes: 'Returning patient second surgical episode',
        },
        { userId: 'mgr-1', role: 'MANAGER' }
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data).toEqual({
        leadId: 'lead-1',
        patientId: 'pat-existing-1',
        caseId: 'case-existing-2',
        userId: 'u-pat-existing-1',
        mode: 'EXISTING_PATIENT',
      });
      expect(mockTxUserCreate).not.toHaveBeenCalled();
      expect(mockTxPatientCreate).not.toHaveBeenCalled();
      expect(mockTxCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: 'pat-existing-1',
            referralPartnerId: 'partner-oman-1',
            status: 'INQUIRY_RECEIVED',
            notes: expect.stringContaining('Returning patient second surgical episode'),
          }),
        })
      );
      expect(mockTxClinicalStepCreateMany).toHaveBeenCalledTimes(1);
      expect(mockTxClinicalStepCreateMany.mock.calls[0][0].data).toHaveLength(
        EXPECTED_DEFAULT_STEP_COUNT
      );
    });
  });

  describe('computeLeadsCrmAnalytics', () => {
    it('computes funnel stage counts, conversion rate %, avg first-response minutes, SLA breaches, lostReason breakdown, and B2B partner attributed MedicalBill revenue', async () => {
      const now = new Date('2026-11-25T12:00:00.000Z');
      mockLeadFindMany.mockResolvedValue([
        {
          id: 'l-1',
          status: 'CONVERTED',
          source: 'B2B_PARTNER',
          lostReason: null,
          referralPartnerId: 'p-1',
          convertedCaseId: 'c-1',
          createdAt: new Date('2026-11-25T09:00:00.000Z'),
          firstResponseDueAt: new Date('2026-11-25T10:00:00.000Z'),
          firstRespondedAt: new Date('2026-11-25T09:30:00.000Z'), // 30m, on time
        },
        {
          id: 'l-2',
          status: 'NEW',
          source: 'WHATSAPP',
          lostReason: null,
          referralPartnerId: null,
          convertedCaseId: null,
          createdAt: new Date('2026-11-25T10:00:00.000Z'),
          firstResponseDueAt: new Date('2026-11-25T11:00:00.000Z'), // breached (> 11:00 vs 12:00)
          firstRespondedAt: null,
        },
        {
          id: 'l-3',
          status: 'LOST',
          source: 'B2B_PARTNER',
          lostReason: 'PRICE_TOO_HIGH',
          referralPartnerId: 'p-1',
          convertedCaseId: null,
          createdAt: new Date('2026-11-25T08:00:00.000Z'),
          firstResponseDueAt: new Date('2026-11-25T09:00:00.000Z'),
          firstRespondedAt: new Date('2026-11-25T09:30:00.000Z'), // 90m, late
        },
        {
          id: 'l-4',
          status: 'QUALIFIED',
          source: 'WEBSITE_INQUIRY',
          lostReason: null,
          referralPartnerId: null,
          convertedCaseId: null,
          createdAt: new Date('2026-11-25T11:30:00.000Z'),
          firstResponseDueAt: new Date('2026-11-25T15:30:00.000Z'),
          firstRespondedAt: null, // active window
        },
      ]);

      mockReferralPartnerFindMany.mockResolvedValue([
        {
          id: 'p-1',
          name: 'Gulf MedConnect',
          code: 'OMAN-CARE-01',
          partnerType: 'FACILITATOR_AGENCY',
          country: 'Oman',
          commissionPercent: 12,
        },
      ]);
      mockCaseFindMany.mockResolvedValue([{ id: 'c-1', referralPartnerId: 'p-1' }]);
      mockMedicalBillFindMany.mockResolvedValue([
        {
          totalAmount: 10000,
          caseId: 'c-1',
          case: { referralPartnerId: 'p-1' },
        },
      ]);

      const analytics = await computeLeadsCrmAnalytics(now);

      expect(analytics.totalLeads).toBe(4);
      expect(analytics.convertedLeads).toBe(1);
      expect(analytics.lostLeads).toBe(1);
      expect(analytics.activeLeads).toBe(2);
      expect(analytics.conversionRatePercent).toBe(25);
      expect(analytics.avgFirstResponseMinutes).toBe(60); // avg(30, 90)
      expect(analytics.slaBreachCount).toBe(2); // l-2 BREACHED + l-3 RESPONDED_LATE
      expect(analytics.lostReasonBreakdown).toEqual([{ reason: 'PRICE_TOO_HIGH', count: 1 }]);
      expect(analytics.stageCounts.find((s) => s.status === 'CONVERTED')?.count).toBe(1);
      expect(analytics.partnerPerformance[0]).toMatchObject({
        id: 'p-1',
        code: 'OMAN-CARE-01',
        totalLeads: 2,
        convertedLeads: 1,
        conversionRatePercent: 50,
        attributedCases: 1,
        attributedRevenueUsd: 10000,
        estimatedPartnerCommissionUsd: 1200,
      });
    });
  });

  describe('LEADS_ACTIVE email nurture campaigns', () => {
    it('deduplicates active non-converted/non-lost leads with valid emails and logs LeadActivity without calling Notification.createMany', async () => {
      mockLeadFindMany.mockResolvedValue([
        {
          id: 'l-a1',
          fullName: 'Amina Yusuf',
          email: 'Amina@Example.com ',
          nationality: 'Kenya',
          status: 'QUOTE_SHARED',
        },
        {
          id: 'l-a2',
          fullName: 'Amina Duplicate',
          email: 'amina@example.com',
          nationality: 'Kenya',
          status: 'NEW',
        },
        {
          id: 'l-a3',
          fullName: 'Hassan Omar',
          email: 'hassan@example.com',
          nationality: 'Iraq',
          status: 'NURTURING',
        },
      ]);

      const recipients = await findCampaignRecipients('LEADS_ACTIVE');
      expect(recipients).toHaveLength(2);
      expect(recipients[0]).toMatchObject({
        id: 'l-a1',
        email: 'amina@example.com',
        role: 'LEAD',
        patient: { nationality: 'Kenya', cases: [{ status: 'QUOTE_SHARED' }] },
      });

      mockLeadActivityCreateMany.mockResolvedValue({ count: 2 });
      mockEmailCampaignUpdate.mockResolvedValue({
        id: 'camp-leads-1',
        status: 'SENT',
        sentCount: 2,
      });

      const result = await dispatchCampaignToRecipients(
        'camp-leads-1',
        {
          subject: 'Medical Estimate Follow-Up for {{fullName}}',
          body: '<p>Hello {{fullName}} from {{nationality}}</p><script>bad()</script>',
        },
        'LEADS_ACTIVE',
        new Date('2026-11-25T12:00:00Z'),
        recipients
      );

      expect(result.notificationsCreated).toBe(2);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(mockLeadActivityCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            leadId: 'l-a1',
            actorId: null,
            activityType: 'EMAIL',
            summary: 'Campaign: Medical Estimate Follow-Up for Amina Yusuf',
          }),
          expect.objectContaining({
            leadId: 'l-a3',
            actorId: null,
            activityType: 'EMAIL',
          }),
        ],
      });
    });
  });

  describe('POST /api/v1/leads/[id]/convert route handler', () => {
    it('returns 201 on successful conversion and 403 for unauthorized roles', async () => {
      const forbiddenReq = new NextRequest('http://localhost/api/v1/leads/lead-1/convert', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'pat-1',
          'x-user-email': 'p@example.com',
          'x-user-role': 'PATIENT',
        },
        body: JSON.stringify({
          mode: 'EXISTING_PATIENT',
          existingPatientId: 'pat-1',
        }),
      });
      const forbiddenRes = await convertLeadRoute(forbiddenReq, {
        params: Promise.resolve({ id: 'lead-1' }),
      });
      expect(forbiddenRes.status).toBe(403);

      mockTxLeadFindUnique.mockResolvedValueOnce(makeSampleLead());
      mockTxPatientFindUnique.mockResolvedValueOnce({
        id: 'pat-existing-1',
        userId: 'u-pat-existing-1',
        assignedManagerId: 'mgr-1',
      });
      mockTxCaseCreate.mockResolvedValueOnce({
        id: 'case-route-1',
        patientId: 'pat-existing-1',
        managerId: 'mgr-1',
        status: 'INQUIRY_RECEIVED',
      });
      mockTxLeadUpdateMany.mockResolvedValueOnce({ count: 1 });

      const okReq = new NextRequest('http://localhost/api/v1/leads/lead-1/convert', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'mgr-1',
          'x-user-email': 'm@example.com',
          'x-user-role': 'MANAGER',
        },
        body: JSON.stringify({
          mode: 'EXISTING_PATIENT',
          existingPatientId: 'pat-existing-1',
        }),
      });
      const okRes = await convertLeadRoute(okReq, {
        params: Promise.resolve({ id: 'lead-1' }),
      });
      const okJson = await okRes.json();

      expect(okRes.status).toBe(201);
      expect(okJson.success).toBe(true);
      expect(okJson.data).toMatchObject({
        leadId: 'lead-1',
        patientId: 'pat-existing-1',
        caseId: 'case-route-1',
      });
    });
  });
});
