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
    if (authUser!.role === 'ADMIN' && !hospitalId) {
      const firstHosp = await prisma.hospital.findFirst();
      hospitalId = firstHosp?.id || null;
    }

    if (!hospitalId) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'No hospital assigned', 400);
    }

    const doctors = await prisma.doctor.findMany({
      where: { hospitalId },
      include: { specialisation: true },
      orderBy: { fullName: 'asc' },
    });

    return apiSuccess({ doctors });
  } catch (err) {
    console.error('Failed to list hospital doctors:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch doctor roster', 500);
  }
}
