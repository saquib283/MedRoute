import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    referralPartner: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
    },
    lead: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    leadActivity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  capturePublicInquiry,
  resetPublicInquiryRateLimitForTests,
  findPotentialDuplicates,
  logLeadActivityForActor,
  completeLeadFollowUpTask,
  getLeadDossierForActor,
  listLeadsForActor,
  updateLeadForActor,
  createStaffLead,
  importLeadsFromCsvRows,
  listReferralPartners,
  createReferralPartner,
  updateReferralPartner,
  exportLeadsCsvForAdmin,
} from '@/lib/services/leads-crm.service';
import { GET as getLeadsRoute, POST as postLeadsRoute } from '@/app/api/v1/leads/route';
import { GET as getLeadDossierRoute, PATCH as patchLeadRoute } from '@/app/api/v1/leads/[id]/route';
import {
  POST as postLeadActivityRoute,
  PATCH as patchLeadActivityRoute,
} from '@/app/api/v1/leads/[id]/activities/route';
import {
  GET as getPartnersRoute,
  POST as postPartnerRoute,
  PATCH as patchPartnerRoute,
} from '@/app/api/v1/referral-partners/route';
import { GET as exportLeadsRoute } from '@/app/api/v1/admin/export/leads/route';

const mockedPrisma = prisma as unknown as {
  referralPartner: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  systemConfig: Record<string, jest.Mock>;
  lead: Record<string, jest.Mock>;
  leadActivity: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  notification: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

const adminActor = { userId: 'admin-1', role: 'ADMIN' as const, email: 'admin@afzalhealthcare.in' };
const mgr1Actor = { userId: 'mgr-1', role: 'MANAGER' as const, email: 'mgr1@afzalhealthcare.in' };
const mgr2Actor = { userId: 'mgr-2', role: 'MANAGER' as const, email: 'mgr2@afzalhealthcare.in' };
const patientActor = { userId: 'pat-1', role: 'PATIENT' as const, email: 'p@example.com' };
const doctorActor = { userId: 'doc-1', role: 'DOCTOR' as const, email: 'd@example.com' };

describe('Task 2: Leads CRM Service, Language Router, Deduplication, Activities & Partner RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPublicInquiryRateLimitForTests();
    mockedPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockedPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    mockedPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockedPrisma.leadActivity.create.mockResolvedValue({ id: 'act-1', activityType: 'NOTE' });
  });

  describe('capturePublicInquiry — referral resolution, language auto-routing & scoring', () => {
    it('resolves ?ref=OMAN-CARE-01 to B2B_PARTNER, routes to Arabic-fluent coordinator before higher-loaded non-matching coordinator, and computes score + SLA', async () => {
      mockedPrisma.referralPartner.findUnique.mockResolvedValue({
        id: 'partner-oman-1',
        code: 'OMAN-CARE-01',
        name: 'Oman Care Facilitators',
        isActive: true,
      });

      // mgr-en has lower workload (1) but no Arabic affinity;
      // mgr-ar has higher workload (3) but manages Arabic patients.
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'mgr-en',
          fullName: 'Priya Sharma',
          _count: { managedLeads: 1, managedPatients: 0 },
          managedPatients: [{ primaryLanguage: 'English' }],
          managedLeads: [],
        },
        {
          id: 'mgr-ar',
          fullName: 'Layla Al-Mansoor',
          _count: { managedLeads: 2, managedPatients: 1 },
          managedPatients: [{ primaryLanguage: 'Arabic' }],
          managedLeads: [],
        },
      ]);

      mockedPrisma.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-created-1',
        createdAt: new Date('2026-11-25T10:00:00.000Z'),
        ...data,
      }));

      const result = await capturePublicInquiry(
        {
          fullName: 'Tariq Al-Said',
          email: 'tariq@example.com',
          phone: '+968 9123-4567',
          nationality: 'Oman',
          preferredLanguage: 'Arabic',
          medicalCondition:
            'Severe triple vessel coronary artery disease requiring urgent CABG evaluation',
          specialtyInterest: 'CARDIOLOGY',
          urgencyLevel: 'URGENT',
          hasDiagnosticReports: true,
          passportReady: true,
          preferredTravelWindow: 'IMMEDIATE_7D',
          estimatedBudgetUsd: 15000,
          referralCode: 'oman-care-01',
        },
        { ipAddress: '203.0.113.10' }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.referenceNo).toMatch(/^LD-\d{4}-[A-Z0-9]{6}$/);
      expect(result.data.temperature).toBe('HOT');
      expect(result.data.slaMinutes).toBe(15);
      // Public payload must NOT leak internal DB id or assignedManagerId
      expect((result.data as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((result.data as unknown as Record<string, unknown>).assignedManagerId).toBeUndefined();

      expect(mockedPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'B2B_PARTNER',
            referralPartnerId: 'partner-oman-1',
            assignedManagerId: 'mgr-ar',
            temperature: 'HOT',
            leadScore: expect.any(Number),
            firstResponseDueAt: expect.any(Date),
          }),
        })
      );

      const createArgs = mockedPrisma.lead.create.mock.calls[0][0] as {
        data: { leadScore: number };
      };
      expect(createArgs.data.leadScore).toBeGreaterThanOrEqual(70);
    });
  });

  describe('findPotentialDuplicates — email & last-9-digit phone matching', () => {
    it('matches normalized email and normalized last-9 phone digits across Lead and Patient (without raw passports)', async () => {
      mockedPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-dup-1',
          referenceNo: 'LD-2026-000991',
          fullName: 'Tariq Al-Said',
          email: 'tariq@example.com',
          phone: '+968 9123 4567',
          whatsappNumber: null,
          status: 'CONTACTED',
          createdAt: new Date('2026-11-20T09:00:00.000Z'),
        },
        {
          id: 'lead-nonmatch',
          referenceNo: 'LD-2026-000992',
          fullName: 'Other Lead',
          email: 'other@example.com',
          phone: '+919999999999',
          whatsappNumber: null,
          status: 'NEW',
          createdAt: new Date('2026-11-20T09:00:00.000Z'),
        },
      ]);

      mockedPrisma.patient.findMany.mockResolvedValue([
        {
          id: 'pat-dup-1',
          nationality: 'Oman',
          createdAt: new Date('2026-10-01T09:00:00.000Z'),
          user: {
            id: 'user-pat-1',
            fullName: 'Tariq Said',
            email: 'TARIQ.ALT@EXAMPLE.COM',
            phone: '0096891234567',
          },
          cases: [{ id: 'case-1', status: 'UNDER_REVIEW' }],
        },
      ]);

      const matches = await findPotentialDuplicates({
        email: '  TARIQ@Example.com ',
        phone: '+968-9123-4567',
        excludeLeadId: 'lead-self',
      });

      expect(matches).toHaveLength(2);

      const leadMatch = matches.find((m) => m.kind === 'LEAD');
      expect(leadMatch).toBeDefined();
      expect(leadMatch?.referenceNo).toBe('LD-2026-000991');
      expect(leadMatch?.matchedBy).toEqual(expect.arrayContaining(['EMAIL', 'PHONE']));
      expect(leadMatch?.maskedEmail).not.toBe('tariq@example.com');
      expect(leadMatch?.maskedPhone).not.toBe('+968 9123 4567');

      const patientMatch = matches.find((m) => m.kind === 'PATIENT');
      expect(patientMatch).toBeDefined();
      expect(patientMatch?.id).toBe('pat-dup-1');
      expect(patientMatch?.matchedBy).toEqual(['PHONE']);
      expect(patientMatch?.status).toBe('UNDER_REVIEW');
      expect((patientMatch as unknown as Record<string, unknown>).passportNo).toBeUndefined();
    });
  });

  describe('logLeadActivityForActor & completeLeadFollowUpTask', () => {
    it('stamps firstRespondedAt, lastContactedAt, and advances NEW -> CONTACTED on first outbound WHATSAPP or PHONE_CALL', async () => {
      mockedPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-1',
        referenceNo: 'LD-2026-111222',
        status: 'NEW',
        assignedManagerId: 'mgr-1',
        firstRespondedAt: null,
        lastContactedAt: null,
        nextFollowUpAt: null,
      });

      mockedPrisma.leadActivity.create.mockResolvedValue({
        id: 'act-wa-1',
        leadId: 'lead-1',
        actorId: 'mgr-1',
        activityType: 'WHATSAPP',
        summary: 'Sent Arabic intro and requested angiogram report',
        createdAt: new Date(),
      });

      mockedPrisma.lead.update.mockResolvedValue({
        id: 'lead-1',
        status: 'CONTACTED',
        firstRespondedAt: new Date(),
        lastContactedAt: new Date(),
      });

      const res = await logLeadActivityForActor(
        'lead-1',
        {
          activityType: 'WHATSAPP',
          summary: 'Sent Arabic intro and requested angiogram report',
          nextFollowUpAt: '2026-11-27T10:00:00.000Z',
        },
        mgr1Actor
      );

      expect(res.ok).toBe(true);
      expect(mockedPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({
            status: 'CONTACTED',
            firstRespondedAt: expect.any(Date),
            lastContactedAt: expect.any(Date),
            nextFollowUpAt: new Date('2026-11-27T10:00:00.000Z'),
          }),
        })
      );
    });

    it('completes a scheduled follow-up task and updates nextFollowUpAt to next pending task', async () => {
      mockedPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-1',
        assignedManagerId: 'mgr-1',
      });
      mockedPrisma.leadActivity.findUnique.mockResolvedValue({
        id: 'act-fu-1',
        leadId: 'lead-1',
        dueAt: new Date('2026-11-26T10:00:00.000Z'),
        completedAt: null,
      });
      mockedPrisma.leadActivity.update.mockResolvedValue({
        id: 'act-fu-1',
        completedAt: new Date('2026-11-26T09:30:00.000Z'),
      });
      mockedPrisma.leadActivity.findFirst.mockResolvedValue(null);
      mockedPrisma.lead.update.mockResolvedValue({ id: 'lead-1', nextFollowUpAt: null });

      const res = await completeLeadFollowUpTask('lead-1', 'act-fu-1', mgr1Actor);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.nextFollowUpAt).toBeNull();
    });
  });

  describe('Object-level RBAC, claiming, bulk import & partner commission visibility', () => {
    it('allows MANAGER on own and unassigned leads (and claiming), returns 403 on other manager leads and for PATIENT/DOCTOR', async () => {
      // PATIENT & DOCTOR blocked across service & routes
      const patList = await listLeadsForActor({}, patientActor);
      expect(patList.ok).toBe(false);
      if (!patList.ok) expect(patList.status).toBe(403);

      const docDossier = await getLeadDossierForActor('lead-1', doctorActor);
      expect(docDossier.ok).toBe(false);
      if (!docDossier.ok) expect(docDossier.status).toBe(403);

      // MANAGER blocked on another manager's lead
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-other',
        assignedManagerId: 'mgr-2',
        status: 'CONTACTED',
        firstResponseDueAt: new Date(),
        activities: [],
      });
      const forbiddenDossier = await getLeadDossierForActor('lead-other', mgr1Actor);
      expect(forbiddenDossier.ok).toBe(false);
      if (!forbiddenDossier.ok) expect(forbiddenDossier.status).toBe(403);

      // MANAGER allowed on unassigned lead and can CLAIM it atomically
      const poolLeadSnapshot = {
        id: 'lead-pool',
        referenceNo: 'LD-2026-555555',
        fullName: 'Amina Yusuf',
        nationality: 'Kenya',
        medicalCondition: 'Knee replacement consultation needed',
        status: 'NEW',
        urgencyLevel: 'ROUTINE',
        hasDiagnosticReports: false,
        passportReady: true,
        source: 'WEBSITE_INQUIRY',
        assignedManagerId: null,
        firstResponseDueAt: new Date('2026-11-26T12:00:00.000Z'),
        firstRespondedAt: null,
      };
      mockedPrisma.lead.findUnique.mockResolvedValueOnce(poolLeadSnapshot);
      mockedPrisma.lead.updateMany.mockResolvedValueOnce({ count: 1 });
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        ...poolLeadSnapshot,
        assignedManagerId: 'mgr-1',
      });

      const claimRes = await updateLeadForActor('lead-pool', { action: 'CLAIM' }, mgr1Actor);
      expect(claimRes.ok).toBe(true);
      expect(mockedPrisma.lead.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'lead-pool',
            status: { notIn: ['CONVERTED', 'LOST'] },
            OR: [{ assignedManagerId: null }, { assignedManagerId: 'mgr-1' }],
          }),
          data: { assignedManagerId: 'mgr-1' },
        })
      );

      // MANAGER cannot reassign to another manager
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-own',
        status: 'NEW',
        assignedManagerId: 'mgr-1',
        firstResponseDueAt: new Date(),
      });
      const reassignRes = await updateLeadForActor(
        'lead-own',
        { assignedManagerId: 'mgr-2' },
        mgr1Actor
      );
      expect(reassignRes.ok).toBe(false);
      if (!reassignRes.ok) expect(reassignRes.status).toBe(403);

      // Route-level 403 check for DOCTOR
      const docReq = new NextRequest('http://localhost/api/v1/leads', {
        headers: { 'x-user-id': 'doc-1', 'x-user-email': 'd@example.com', 'x-user-role': 'DOCTOR' },
      });
      const docRouteRes = await getLeadsRoute(docReq);
      expect(docRouteRes.status).toBe(403);
    });

    it('hides commissionPercent from MANAGER on GET /api/v1/referral-partners and restricts POST/PATCH to ADMIN', async () => {
      mockedPrisma.referralPartner.findMany.mockResolvedValue([
        {
          id: 'rp-1',
          name: 'Oman Care',
          code: 'OMAN-CARE-01',
          partnerType: 'FACILITATOR_AGENCY',
          country: 'Oman',
          commissionPercent: 12.5,
          isActive: true,
          _count: { leads: 4, cases: 2 },
        },
      ]);

      const mgrPartners = await listReferralPartners(mgr1Actor);
      expect(mgrPartners.ok).toBe(true);
      if (mgrPartners.ok) {
        expect(mgrPartners.data.partners[0]).not.toHaveProperty('commissionPercent');
      }

      const adminPartners = await listReferralPartners(adminActor);
      expect(adminPartners.ok).toBe(true);
      if (adminPartners.ok) {
        expect(adminPartners.data.partners[0]).toHaveProperty('commissionPercent');
      }

      const mgrCreateAttempt = await createReferralPartner(
        {
          name: 'Dubai Health',
          code: 'DXB-01',
          partnerType: 'FACILITATOR_AGENCY',
          country: 'UAE',
        },
        mgr2Actor
      );
      expect(mgrCreateAttempt.ok).toBe(false);
      if (!mgrCreateAttempt.ok) expect(mgrCreateAttempt.status).toBe(403);

      // Route tests for referral partners
      const mgrPatchReq = new NextRequest('http://localhost/api/v1/referral-partners', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'mgr-1',
          'x-user-email': 'm@example.com',
          'x-user-role': 'MANAGER',
        },
        body: JSON.stringify({ id: 'rp-1', commissionPercent: 20 }),
      });
      const mgrPatchRes = await patchPartnerRoute(mgrPatchReq);
      expect(mgrPatchRes.status).toBe(403);

      const mgrGetReq = new NextRequest('http://localhost/api/v1/referral-partners', {
        headers: { 'x-user-id': 'mgr-1', 'x-user-email': 'm@example.com', 'x-user-role': 'MANAGER' },
      });
      const mgrGetRes = await getPartnersRoute(mgrGetReq);
      const mgrGetJson = await mgrGetRes.json();
      expect(mgrGetRes.status).toBe(200);
      expect(mgrGetJson.data.partners[0]).not.toHaveProperty('commissionPercent');
    });

    it('supports bulk CSV row import with per-row validation summary and formula-safe ADMIN CSV export', async () => {
      mockedPrisma.lead.findMany.mockResolvedValue([]);
      mockedPrisma.patient.findMany.mockResolvedValue([]);
      mockedPrisma.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-bulk-1',
        createdAt: new Date(),
        ...data,
      }));

      const importRes = await importLeadsFromCsvRows(
        [
          {
            fullName: 'Hassan Ali',
            phone: '+96891112233',
            nationality: 'Oman',
            medicalCondition: 'Oncology second opinion needed',
            source: 'WHATSAPP',
          },
          {
            fullName: 'No Contact',
            nationality: 'UAE',
            medicalCondition: 'Missing phone and email',
          },
        ],
        mgr1Actor
      );

      expect(importRes.ok).toBe(true);
      if (!importRes.ok) return;
      expect(importRes.data.createdCount).toBe(1);
      expect(importRes.data.skippedCount).toBe(1);
      expect(importRes.data.errors).toHaveLength(1);
      expect(importRes.data.errors[0].row).toBe(2);

      // Export CSV is ADMIN-only and neutralizes formula injection
      const mgrExportReq = new NextRequest('http://localhost/api/v1/admin/export/leads', {
        headers: { 'x-user-id': 'mgr-1', 'x-user-email': 'm@example.com', 'x-user-role': 'MANAGER' },
      });
      const mgrExportRes = await exportLeadsRoute(mgrExportReq);
      expect(mgrExportRes.status).toBe(403);

      mockedPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-exp-1',
          referenceNo: 'LD-2026-000001',
          fullName: '=CMD("calc")',
          email: 'test@example.com',
          phone: '+96891112233',
          nationality: 'Oman',
          preferredLanguage: 'Arabic',
          specialtyInterest: 'CARDIOLOGY',
          status: 'NEW',
          source: 'B2B_PARTNER',
          leadScore: 85,
          temperature: 'HOT',
          preliminaryQuoteUsd: null,
          firstResponseDueAt: new Date('2026-11-25T10:15:00.000Z'),
          firstRespondedAt: null,
          createdAt: new Date('2026-11-25T10:00:00.000Z'),
          assignedManager: { fullName: 'Layla Al-Mansoor' },
          referralPartner: { code: 'OMAN-CARE-01', name: 'Oman Care' },
        },
      ]);

      const adminExportReq = new NextRequest('http://localhost/api/v1/admin/export/leads', {
        headers: {
          'x-user-id': 'admin-1',
          'x-user-email': 'admin@afzalhealthcare.in',
          'x-user-role': 'ADMIN',
        },
      });
      const adminExportRes = await exportLeadsRoute(adminExportReq);
      expect(adminExportRes.status).toBe(200);
      const csvText = await adminExportRes.text();
      expect(csvText).toContain("'=CMD");
      expect(csvText).toContain('OMAN-CARE-01');
    });

    it('preserves omitted commissionPercent and isActive on partial referral partner PATCH', async () => {
      mockedPrisma.referralPartner.findUnique.mockResolvedValueOnce({
        id: 'rp-1',
        name: 'Oman Care',
        code: 'OMAN-CARE-01',
        partnerType: 'FACILITATOR_AGENCY',
        country: 'Oman',
        commissionPercent: 18,
        isActive: false,
      });
      mockedPrisma.referralPartner.update.mockResolvedValueOnce({
        id: 'rp-1',
        name: 'Oman Care Updated',
        code: 'OMAN-CARE-01',
        partnerType: 'FACILITATOR_AGENCY',
        country: 'Oman',
        commissionPercent: 18,
        isActive: false,
      });

      const patchRes = await updateReferralPartner(
        'rp-1',
        { name: 'Oman Care Updated' },
        adminActor
      );

      expect(patchRes.ok).toBe(true);
      expect(mockedPrisma.referralPartner.update).toHaveBeenCalledWith({
        where: { id: 'rp-1' },
        data: { name: 'Oman Care Updated' },
      });
      const updateCallData = mockedPrisma.referralPartner.update.mock.calls[0][0].data;
      expect(updateCallData).not.toHaveProperty('commissionPercent');
      expect(updateCallData).not.toHaveProperty('isActive');
    });

    it('returns 400 BAD_REQUEST for invalid status/source/temperature filters in listLeadsForActor and exportLeadsCsvForAdmin', async () => {
      const badStatusList = await listLeadsForActor({ status: 'BOGUS_STATUS' }, adminActor);
      expect(badStatusList.ok).toBe(false);
      if (!badStatusList.ok) {
        expect(badStatusList.status).toBe(400);
        expect(badStatusList.code).toBe('BAD_REQUEST');
      }

      const badSourceList = await listLeadsForActor({ source: 'BOGUS_SOURCE' }, adminActor);
      expect(badSourceList.ok).toBe(false);
      if (!badSourceList.ok) {
        expect(badSourceList.status).toBe(400);
        expect(badSourceList.code).toBe('BAD_REQUEST');
      }

      const badTempExport = await exportLeadsCsvForAdmin({ temperature: 'SCORCHING' }, adminActor);
      expect(badTempExport.ok).toBe(false);
      if (!badTempExport.ok) {
        expect(badTempExport.status).toBe(400);
        expect(badTempExport.code).toBe('BAD_REQUEST');
      }

      expect(mockedPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it('returns 400 BAD_REQUEST when updateLeadForActor receives a non-existent referralPartnerId', async () => {
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        status: 'NEW',
        assignedManagerId: 'mgr-1',
        urgencyLevel: 'ROUTINE',
        hasDiagnosticReports: false,
        medicalCondition: 'Cardiac checkup needed',
        passportReady: false,
        source: 'WEBSITE_INQUIRY',
        firstResponseDueAt: new Date(),
      });
      mockedPrisma.referralPartner.findUnique.mockResolvedValueOnce(null);

      const res = await updateLeadForActor(
        'lead-1',
        { referralPartnerId: 'missing-partner-id' },
        adminActor
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(400);
        expect(res.code).toBe('BAD_REQUEST');
        expect(res.message).toBe('Referral partner not found');
      }
      expect(mockedPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('passes specialtyInterest filter into prisma.lead.findMany where clause in listLeadsForActor', async () => {
      mockedPrisma.lead.findMany.mockResolvedValueOnce([]);
      mockedPrisma.lead.count.mockResolvedValue(0);

      const res = await listLeadsForActor(
        { specialtyInterest: 'CARDIOLOGY', page: 1, limit: 25 },
        adminActor
      );

      expect(res.ok).toBe(true);
      expect(mockedPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ specialtyInterest: 'CARDIOLOGY' }],
          },
        })
      );
    });

    it('rejects partial PATCH (without status) on a CONVERTED lead with 409 without calling prisma.lead.update', async () => {
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-converted-1',
        status: 'CONVERTED',
        assignedManagerId: 'mgr-1',
        firstResponseDueAt: new Date(),
      });

      const res = await updateLeadForActor(
        'lead-converted-1',
        { preliminaryQuoteUsd: 9500, medicalCondition: 'Attempted edit after conversion' },
        mgr1Actor
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(409);
        expect(res.code).toBe('INVALID_STATUS_TRANSITION');
        expect(res.message).toBe('Converted leads are locked and cannot be edited');
      }
      expect(mockedPrisma.lead.update).not.toHaveBeenCalled();
      expect(mockedPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    it('returns 409 CONFLICT on CLAIM race loss (updateMany count: 0) without logging duplicate claim activity', async () => {
      mockedPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-race-1',
        status: 'NEW',
        assignedManagerId: null,
        firstResponseDueAt: new Date(),
      });
      mockedPrisma.lead.updateMany.mockResolvedValueOnce({ count: 0 });

      const res = await updateLeadForActor('lead-race-1', { action: 'CLAIM' }, mgr1Actor);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(409);
        expect(res.code).toBe('CONFLICT');
      }
      expect(mockedPrisma.leadActivity.create).not.toHaveBeenCalled();
      expect(mockedPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('detects duplicates via distinct whatsappNumber in findPotentialDuplicates and clamps fractional pagination in listLeadsForActor', async () => {
      mockedPrisma.lead.findMany.mockResolvedValueOnce([
        {
          id: 'lead-wa-dup',
          referenceNo: 'LD-2026-008811',
          fullName: 'Salim Al-Harthy',
          email: null,
          phone: null,
          whatsappNumber: '+971 55 888 7766',
          status: 'NEW',
          createdAt: new Date('2026-11-21T10:00:00.000Z'),
        },
      ]);
      mockedPrisma.patient.findMany.mockResolvedValueOnce([]);

      const waMatches = await findPotentialDuplicates({
        phone: '+968 9000 1111',
        whatsappNumber: '+971-55-888-7766',
        excludeLeadId: 'lead-new-self',
      });

      expect(waMatches).toHaveLength(1);
      expect(waMatches[0].id).toBe('lead-wa-dup');
      expect(waMatches[0].matchedBy).toEqual(['PHONE']);

      mockedPrisma.lead.findMany.mockResolvedValueOnce([]);
      mockedPrisma.lead.count.mockResolvedValue(0);

      const pageRes = await listLeadsForActor({ page: 1.5, limit: 10.9 }, adminActor);
      expect(pageRes.ok).toBe(true);
      if (pageRes.ok) {
        expect(pageRes.data.meta).toEqual({ page: 1, limit: 10, total: 0 });
      }
      expect(mockedPrisma.lead.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });
  });

  // Ensure imported route handlers remain referenced and callable
  it('wires staff lead routes cleanly', async () => {
    expect(typeof createStaffLead).toBe('function');
    expect(typeof updateReferralPartner).toBe('function');
    expect(typeof postLeadsRoute).toBe('function');
    expect(typeof getLeadDossierRoute).toBe('function');
    expect(typeof patchLeadRoute).toBe('function');
    expect(typeof postLeadActivityRoute).toBe('function');
    expect(typeof patchLeadActivityRoute).toBe('function');
    expect(typeof postPartnerRoute).toBe('function');
  });
});
