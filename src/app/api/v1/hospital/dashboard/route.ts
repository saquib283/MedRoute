import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    let hospitalId = authUser!.hospitalId;

    // If Admin, allow selecting hospital via query param or default to first hospital
    if (authUser!.role === 'ADMIN' && !hospitalId) {
      const { searchParams } = new URL(request.url);
      const queryHospitalId = searchParams.get('hospitalId');
      if (queryHospitalId) {
        hospitalId = queryHospitalId;
      } else {
        const firstHosp = await prisma.hospital.findFirst();
        hospitalId = firstHosp?.id || null;
      }
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned to this account', 400);
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        city: true,
        accreditation: true,
        commissionRate: true,
        contactPerson: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    if (!hospital) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Hospital record not found', 404);
    }

    // 1. Fetch cases linked to this hospital
    // Either via TreatmentPlan items, HospitalQuotes, or Appointments
    const quotes = await prisma.hospitalQuote.findMany({
      where: { hospitalId },
      include: {
        case: {
          include: {
            patient: { select: { nationality: true, user: { select: { fullName: true } } } },
          },
        },
        doctor: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch all cases that are open or referred
    const allReferredCases = await prisma.case.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { nationality: true, user: { select: { fullName: true, email: true } } } },
        hospitalQuotes: { where: { hospitalId } },
        appointments: { where: { hospitalId } },
      },
    });

    // 3. Visa assistance letters issued by this hospital
    const visaLetters = await prisma.visaAssistance.findMany({
      where: { hospitalId },
      include: {
        case: {
          select: {
            id: true,
            patient: { select: { nationality: true, user: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Invoices linked to this hospital
    const invoices = await prisma.invoice.findMany({
      where: { hospitalId },
      include: { payments: true },
    });

    const grossHospitalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const commRate = Number(hospital.commissionRate || 10) / 100;
    const commissionDue = grossHospitalBilled * commRate;

    const admittedInpatients = allReferredCases.filter(
      (c) => c.status === 'IN_TREATMENT' && c.hospitalQuotes.some((q) => q.status === 'ACCEPTED_BY_PATIENT')
    ).length;

    return apiSuccess({
      hospital,
      stats: {
        totalQuotes: quotes.length,
        acceptedQuotes: quotes.filter((q) => q.status === 'ACCEPTED_BY_PATIENT').length,
        pendingQuotes: quotes.filter((q) => q.status === 'SUBMITTED').length,
        activeInpatients: admittedInpatients,
        visaLettersIssued: visaLetters.length,
        grossHospitalBilled,
        commissionDueToMedroute: commissionDue,
        commissionRate: hospital.commissionRate,
      },
      recentQuotes: quotes.slice(0, 5),
      recentReferrals: allReferredCases.slice(0, 6),
      recentVisaLetters: visaLetters.slice(0, 5),
    });
  } catch (err) {
    console.error('Failed to fetch hospital dashboard metrics:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch hospital dashboard data', 500);
  }
}
