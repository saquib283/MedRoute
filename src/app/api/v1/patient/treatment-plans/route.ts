import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateVerificationCode,
  computeSha256,
  generateTreatmentPlanConsentStatement,
} from '@/lib/legal/crypto-proof';
import { createAuditLog } from '@/lib/api/audit-logger';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const plans = await prisma.treatmentPlan.findMany({
      where: { case: { patientId: patient.id } },
      include: {
        items: {
          include: {
            hospital: { select: { id: true, name: true, city: true } },
            doctor: { select: { id: true, fullName: true, specialisation: { select: { name: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        case: { select: { id: true, status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { treatmentPlans: plans } });
  } catch (err) {
    console.error('Failed to load patient treatment plans:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { planId, action, patientNotes, signerFullName } = body;

    if (!planId || !['ACCEPTED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'planId and action (ACCEPTED|REJECTED) required' }, { status: 400 });
    }

    const plan = await prisma.treatmentPlan.findUnique({
      where: { id: planId },
      include: {
        case: { select: { patientId: true, id: true } },
        items: true,
      },
    });

    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const patient = await prisma.patient.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!patient || plan.case.patientId !== patient.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (plan.status !== 'SENT_TO_PATIENT') {
      return NextResponse.json({ error: 'Plan is not awaiting your response' }, { status: 400 });
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id: planId },
      data: {
        status: action,
        patientNotes: patientNotes || null,
        respondedAt: new Date(),
      },
    });

    let verificationCode: string | null = null;
    let verificationUrl: string | null = null;

    // If accepted, update case status to PLAN_CONFIRMED and create an immutable LegalConsent proof
    if (action === 'ACCEPTED') {
      await prisma.case.update({
        where: { id: plan.case.id },
        data: {
          status: 'PLAN_CONFIRMED',
          totalEstimatedCost: plan.totalEstimatedCost,
        },
      });

      const signerName = signerFullName?.trim() || patient.user.fullName;
      const statement = generateTreatmentPlanConsentStatement({
        signerFullName: signerName,
        planTitle: plan.title,
        totalEstimatedCost: Number(plan.totalEstimatedCost),
        currency: 'INR',
      });

      const documentHash = computeSha256({
        planId: plan.id,
        planTitle: plan.title,
        totalCost: Number(plan.totalEstimatedCost),
        items: plan.items.map((it) => ({
          desc: it.description,
          type: it.itemType,
          cost: Number(it.totalCost),
        })),
        signerName,
        acceptedAt: new Date().toISOString(),
      });

      verificationCode = generateVerificationCode('MR-PROOF');
      verificationUrl = `/verify/${verificationCode}`;

      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const geoCountry = request.headers.get('cf-ipcountry') || null;

      await prisma.legalConsent.create({
        data: {
          verificationCode,
          consentType: 'TREATMENT_PLAN_ACCEPTANCE',
          caseId: plan.case.id,
          patientId: patient.id,
          entityType: 'TreatmentPlan',
          entityId: plan.id,
          documentHash,
          signerFullName: signerName,
          signerEmail: patient.user.email,
          signerRole: 'PATIENT',
          statement,
          metadata: {
            planId: plan.id,
            planTitle: plan.title,
            totalEstimatedCost: Number(plan.totalEstimatedCost),
            itemCount: plan.items.length,
          },
          ipAddress,
          userAgent,
          geoCountry,
          signedAt: new Date(),
        },
      });

      void createAuditLog({
        actorId: userId,
        action: 'TREATMENT_PLAN_ACCEPTED',
        entityType: 'TreatmentPlan',
        entityId: plan.id,
        newValue: {
          verificationCode,
          documentHash,
          signerFullName: signerName,
        },
        ipAddress,
        userAgent,
        route: '/api/v1/patient/treatment-plans',
        status: 'SUCCESS',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        treatmentPlan: updated,
        verificationCode,
        verificationUrl,
      },
    });
  } catch (err) {
    console.error('Failed to respond to treatment plan:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
