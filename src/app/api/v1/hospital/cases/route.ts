import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    let hospitalId = authUser!.hospitalId;
    if (authUser!.role === 'ADMIN' && !hospitalId) {
      const { searchParams } = new URL(request.url);
      hospitalId = searchParams.get('hospitalId');
      if (!hospitalId) {
        const firstHosp = await prisma.hospital.findFirst();
        hospitalId = firstHosp?.id || null;
      }
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned to this account', 400);
    }

    const cases = await prisma.case.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            nationality: true,
            bloodGroup: true,
            medicalCondition: true,
            urgencyLevel: true,
            user: { select: { fullName: true, email: true, phone: true } },
            medicalProfile: true,
            documents: {
              select: {
                id: true,
                category: true,
                fileName: true,
                fileUrl: true,
                createdAt: true,
                sha256Hash: true,
              },
            },
          },
        },
        hospitalQuotes: {
          where: { hospitalId },
          include: { doctor: { select: { id: true, fullName: true, specialisation: { select: { name: true } } } } },
        },
        appointments: { where: { hospitalId } },
      },
    });

    return apiSuccess({ cases });
  } catch (err) {
    console.error('Failed to list hospital cases:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch hospital cases', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'HOSPITAL' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Hospital IPS Desk or Admin access required', 403);
    }

    const body = await request.json();
    const {
      caseId,
      doctorId,
      title,
      description,
      estimatedStayDays = 5,
      icuDays = 1,
      roomCategory = 'DELUXE_SINGLE',
      estimatedCost,
      currency = 'USD',
      inclusions = [],
      exclusions = [],
      validDays = 30,
    } = body;

    if (!caseId || !title || !description || !estimatedCost) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing required quotation fields', 400);
    }

    let hospitalId = authUser!.hospitalId;
    if (authUser!.role === 'ADMIN' && body.hospitalId) {
      hospitalId = body.hospitalId;
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned to this account', 400);
    }

    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    const quote = await prisma.hospitalQuote.create({
      data: {
        caseId,
        hospitalId,
        doctorId: doctorId || null,
        title,
        description,
        estimatedStayDays: parseInt(estimatedStayDays, 10),
        icuDays: parseInt(icuDays, 10),
        roomCategory,
        estimatedCost: parseFloat(estimatedCost),
        currency,
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        status: 'SUBMITTED',
        validUntil,
        submittedBy: authUser!.email,
      },
      include: {
        hospital: { select: { name: true, city: true } },
        doctor: { select: { fullName: true } },
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'HOSPITAL_QUOTE_SUBMITTED',
      entityType: 'HospitalQuote',
      entityId: quote.id,
      newValue: {
        caseId,
        hospitalId,
        title,
        estimatedCost,
        currency,
      },
      route: '/api/v1/hospital/cases',
    });

    return apiSuccess({ quote }, undefined, 201);
  } catch (err) {
    console.error('Failed to submit hospital quote:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to submit hospital quote', 500);
  }
}
