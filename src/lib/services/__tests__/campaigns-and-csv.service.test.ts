import { NextRequest } from 'next/server';
import {
  sanitizeEmailHtml,
  interpolateCampaignTemplate,
} from '@/lib/validation/email-sanitizer';
import { generateCSV, csvResponse } from '@/lib/api/csv-helper';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    emailTemplate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailCampaign: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    lead: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  POST as postTemplate,
  PUT as putTemplate,
} from '@/app/api/v1/admin/email-templates/route';
import {
  POST as postCampaign,
  PATCH as patchCampaigns,
} from '@/app/api/v1/admin/email-campaigns/route';
import {
  dispatchImmediateCampaign,
  findCampaignRecipients,
  processQueuedCampaigns,
} from '@/lib/services/email-campaign.service';

const mockedPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>>;

describe('Task 3: Email Campaign Sanitizer, Placeholder Interpolation & CSV Hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips scripts, iframes, inline on* handlers, and javascript:/data:text/html URIs in sanitizeEmailHtml', () => {
    const dirty = `
      <div>Hello <b>World</b></div>
      <script>alert('xss')</script>
      <iframe src="https://evil.example"></iframe>
      <img src="x" onerror="alert(1)" onclick='steal()' onmouseover=alert(3) />
      <a href="javascript:alert(2)">Click</a>
      <a href="java&#x09;script:alert(4)">Obfuscated</a>
      <a href="vbscript:msgbox(5)">VBS</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data</a>
      <p style="width: expression(alert(6)); background: url(javascript:alert(7))">Styled</p>
      <form action="https://evil.example"><meta http-equiv="refresh" content="0"></form>
    `;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toContain('<b>World</b>');
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<form/i);
    expect(clean).not.toMatch(/<meta/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/onmouseover/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/vbscript:/i);
    expect(clean).not.toMatch(/data:text\/html/i);
    expect(clean).not.toMatch(/expression\s*\(/i);
    expect(clean).toContain('href="#"');
  });

  it('strips quote-adjacent XSS attributes and handles out-of-range numeric HTML entities without throwing', () => {
    const quoteAdjacent = [
      '<img src="x"onerror="alert(1)">',
      "<img src='x'onload='alert(1)'onclick='alert(2)'>",
      '<a title="x"href="javascript:alert(1)">link</a>',
      '<a href="https://safe.example"action="javascript:alert(1)">chained</a>',
      '<p title="x"style="width:expression(alert(1))">styled</p>',
    ].join('');

    const cleanAdjacent = sanitizeEmailHtml(quoteAdjacent);
    expect(cleanAdjacent).toContain('<img src="x">');
    expect(cleanAdjacent).toContain("<img src='x'>");
    expect(cleanAdjacent).toContain('href="#"');
    expect(cleanAdjacent).toContain('href="https://safe.example"');
    expect(cleanAdjacent).toContain('action="#"');
    expect(cleanAdjacent).not.toMatch(/onerror|onload|onclick|javascript:|expression\s*\(/i);

    expect(() =>
      sanitizeEmailHtml('<a href="&#9999999;&#x110000;">x</a>')
    ).not.toThrow();
    expect(sanitizeEmailHtml('<a href="&#9999999;&#x110000;">x</a>')).toContain(
      'href="&#9999999;&#x110000;"'
    );
  });

  it('interpolates all 7 placeholders in subject and HTML-escapes recipient fields in body', () => {
    const ctx = {
      fullName: 'Sara <script>alert(1)</script>',
      email: 'sara@example.com',
      role: 'PATIENT',
      nationality: 'Oman',
      caseStatus: 'WARD_RECOVERY',
      portalUrl: 'https://portal.afzalhealthcare.in',
      supportEmail: 'concierge@afzalhealthcare.in',
    };

    const subject = interpolateCampaignTemplate(
      'Update for {{fullName}} ({{nationality}} - {{caseStatus}})',
      ctx,
      { escapeHtml: false }
    );
    expect(subject).toBe('Update for Sara <script>alert(1)</script> (Oman - WARD_RECOVERY)');

    const body = interpolateCampaignTemplate(
      '<p>Dear {{fullName}} ({{email}}, {{role}}), visit <a href="{{portalUrl}}">portal</a> or email {{supportEmail}}.</p>',
      ctx,
      { escapeHtml: true }
    );
    expect(body).toContain('Dear Sara &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).toContain('sara@example.com, PATIENT');
    expect(body).toContain('https://portal.afzalhealthcare.in');
    expect(body).toContain('concierge@afzalhealthcare.in');
  });

  it('sanitizes templates on POST/PUT (preserving omitted body) and interpolates subject + body on campaign send & PATCH queued processing', async () => {
    mockedPrisma.emailTemplate.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.emailTemplate.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'tpl-1',
      ...data,
    }));
    mockedPrisma.auditLog.create.mockResolvedValue({});

    const tplReq = new NextRequest('http://localhost/api/v1/admin/email-templates', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Welcome',
        subject: 'Hello {{fullName}} — {{caseStatus}}',
        body: '<p>Hi {{fullName}} from {{nationality}}</p><script>evil()</script>',
        category: 'onboarding',
      }),
    });
    const tplRes = await postTemplate(tplReq);
    const tplJson = await tplRes.json();
    expect(tplRes.status).toBe(201);
    expect(tplJson.data.template.body).not.toContain('<script>');

    // Partial PUT omitting body must keep body undefined in Prisma update
    mockedPrisma.emailTemplate.findUnique.mockResolvedValueOnce({
      id: 'tpl-1',
      name: 'Welcome',
      subject: 'Hello {{fullName}}',
      body: '<p>Hi</p>',
    });
    mockedPrisma.emailTemplate.update.mockResolvedValueOnce({
      id: 'tpl-1',
      name: 'Welcome Updated',
      subject: 'Hello {{fullName}}',
      body: '<p>Hi</p>',
    });
    const putReq = new NextRequest('http://localhost/api/v1/admin/email-templates', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({ id: 'tpl-1', name: 'Welcome Updated' }),
    });
    const putRes = await putTemplate(putReq);
    expect(putRes.status).toBe(200);
    expect(mockedPrisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { name: 'Welcome Updated' },
    });

    // Immediate campaign send interpolates both subject and body
    mockedPrisma.emailTemplate.findUnique.mockResolvedValueOnce({
      id: 'tpl-1',
      name: 'Welcome',
      subject: 'Hello {{fullName}} — {{caseStatus}}',
      body: '<p>Hi {{fullName}} from {{nationality}}</p>',
      isActive: true,
    });
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u-1',
        fullName: 'Ahmed Al-Mansoor',
        email: 'ahmed@example.com',
        role: 'PATIENT',
        patient: {
          nationality: 'UAE',
          cases: [{ status: 'WARD_RECOVERY' }],
        },
      },
    ]);
    mockedPrisma.emailCampaign.create.mockResolvedValueOnce({ id: 'camp-1', name: 'Blast' });
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.emailCampaign.update.mockResolvedValueOnce({
      id: 'camp-1',
      name: 'Blast',
      status: 'SENT',
      sentCount: 1,
      template: { name: 'Welcome', subject: 'Hello {{fullName}} — {{caseStatus}}' },
    });

    const campReq = new NextRequest('http://localhost/api/v1/admin/email-campaigns', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'Blast',
        templateId: 'tpl-1',
        targetRole: 'PATIENT',
      }),
    });
    const campRes = await postCampaign(campReq);
    expect(campRes.status).toBe(201);
    expect(mockedPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'u-1',
          title: 'Hello Ahmed Al-Mansoor — WARD_RECOVERY',
          body: '<p>Hi Ahmed Al-Mansoor from UAE</p>',
        }),
      ],
    });

    // Explicit PATCH queued processor dispatches overdue queued campaigns
    mockedPrisma.emailCampaign.findMany.mockResolvedValueOnce([
      {
        id: 'camp-q1',
        name: 'Due Queued',
        targetRole: 'ALL',
        template: {
          id: 'tpl-1',
          name: 'Welcome',
          subject: 'Portal {{portalUrl}} for {{fullName}}',
          body: '<p>Reach {{supportEmail}}</p><script>bad()</script>',
        },
      },
    ]);
    mockedPrisma.emailCampaign.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u-2',
        fullName: 'Dr. Noor',
        email: 'noor@example.com',
        role: 'DOCTOR',
        patient: null,
      },
    ]);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.emailCampaign.update.mockResolvedValueOnce({
      id: 'camp-q1',
      status: 'SENT',
      sentCount: 1,
    });

    const procReq = new NextRequest('http://localhost/api/v1/admin/email-campaigns', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({ action: 'PROCESS_QUEUED' }),
    });
    const procRes = await patchCampaigns(procReq);
    const procJson = await procRes.json();
    expect(procRes.status).toBe(200);
    expect(procJson.data).toEqual({ processedCampaigns: 1, notificationsCreated: 1 });
    expect(mockedPrisma.emailCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: 'camp-q1', status: 'QUEUED' },
      data: { status: 'SENT', sentAt: expect.any(Date) },
    });
    expect(mockedPrisma.notification.createMany).toHaveBeenLastCalledWith({
      data: [
        expect.objectContaining({
          userId: 'u-2',
          title: 'Portal https://portal.afzalhealthcare.in for Dr. Noor',
          body: '<p>Reach concierge@afzalhealthcare.in</p>',
        }),
      ],
    });
  });

  it('skips queued campaigns already claimed concurrently and rolls back status to FAILED on dispatch error', async () => {
    const dueCampaign = {
      id: 'camp-race',
      name: 'Concurrent Queued',
      targetRole: 'PATIENT',
      template: {
        id: 'tpl-1',
        name: 'Welcome',
        subject: 'Hello {{fullName}}',
        body: '<p>Hi {{fullName}}</p>',
      },
    };

    // Case 1: another worker already claimed the campaign (count: 0)
    mockedPrisma.emailCampaign.findMany.mockResolvedValueOnce([dueCampaign]);
    mockedPrisma.emailCampaign.updateMany.mockResolvedValueOnce({ count: 0 });

    const skippedSummary = await processQueuedCampaigns(new Date('2026-11-23T12:00:00Z'));
    expect(skippedSummary).toEqual({ processedCampaigns: 0, notificationsCreated: 0 });
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();

    // Case 2: claimed by this worker (count: 1) but notification insert fails -> rollback to FAILED
    mockedPrisma.emailCampaign.findMany.mockResolvedValueOnce([dueCampaign]);
    mockedPrisma.emailCampaign.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u-3',
        fullName: 'Layla Hassan',
        email: 'layla@example.com',
        role: 'PATIENT',
        patient: null,
      },
    ]);
    mockedPrisma.notification.createMany.mockRejectedValueOnce(new Error('DB write error'));
    mockedPrisma.emailCampaign.update.mockResolvedValueOnce({
      id: 'camp-race',
      status: 'FAILED',
    });

    await expect(
      processQueuedCampaigns(new Date('2026-11-23T12:00:00Z'))
    ).rejects.toThrow('DB write error');
    expect(mockedPrisma.emailCampaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-race' },
      data: { status: 'FAILED' },
    });
  });

  it('neutralizes OWASP CSV formula injection while preserving negative numbers and sanitizing filenames', () => {
    const csv = generateCSV(
      ['Name', 'Formula', 'NegativeBalance', 'NegativeString', 'NegativeFormula', 'TabAttack', 'AtAttack'],
      [['Alice, Jr.', '=CMD|\' /C calc\'!A0', -125.5, '-42.00', '-1+1', '\t+SUM(A1:A2)', '@SUM(1,1)']]
    );
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"Alice, Jr."');
    expect(lines[1]).toContain("'=CMD|' /C calc'!A0");
    expect(lines[1]).toContain(',-125.5,');
    expect(lines[1]).toContain(',-42.00,');
    expect(lines[1]).toContain(",'-1+1,");
    expect(lines[1]).toContain("'\t+SUM(A1:A2)");
    expect(lines[1]).toContain('"\'@SUM(1,1)"');

    const res = csvResponse(csv, 'cases";evil\r\n.csv');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="cases__evil__.csv"');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('filters malformed emails in LEADS_ACTIVE and reports No active recipients found for this audience when empty', async () => {
    mockedPrisma.lead.findMany.mockResolvedValueOnce([
      {
        id: 'l-bad',
        fullName: 'Bad Email',
        email: 'not-an-email',
        nationality: 'Oman',
        status: 'NEW',
      },
      {
        id: 'l-good-1',
        fullName: 'Good One',
        email: '  Patient@Example.com ',
        nationality: 'Oman',
        status: 'CONTACTED',
      },
      {
        id: 'l-good-dup',
        fullName: 'Good Dup',
        email: 'patient@example.com',
        nationality: 'Oman',
        status: 'QUALIFIED',
      },
    ]);

    const recipients = await findCampaignRecipients('LEADS_ACTIVE');
    expect(recipients).toHaveLength(1);
    expect(recipients[0].id).toBe('l-good-1');
    expect(recipients[0].email).toBe('patient@example.com');

    mockedPrisma.lead.findMany.mockResolvedValueOnce([]);
    const emptyDispatch = await dispatchImmediateCampaign({
      name: 'Empty Leads Blast',
      templateId: 'tpl-1',
      template: { name: 'T1', subject: 'Hi', body: '<p>Hi</p>' },
      targetRole: 'LEADS_ACTIVE',
      createdBy: 'adm-1',
    });
    expect(emptyDispatch).toEqual({
      ok: false,
      error: 'No active recipients found for this audience',
    });
  });
});
