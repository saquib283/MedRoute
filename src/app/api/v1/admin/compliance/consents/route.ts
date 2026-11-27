import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const consentType = searchParams.get('consentType') || '';

    const where: Record<string, unknown> = {};

    if (consentType) {
      where.consentType = consentType;
    }

    if (search) {
      where.OR = [
        { verificationCode: { contains: search } },
        { signerFullName: { contains: search } },
        { signerEmail: { contains: search } },
        { documentHash: { contains: search } },
      ];
    }

    const [consents, totalCount, statsByType] = await Promise.all([
      prisma.legalConsent.findMany({
        where,
        orderBy: { signedAt: 'desc' },
        take: 50,
        include: {
          patient: {
            select: {
              id: true,
              nationality: true,
              user: { select: { fullName: true, email: true } },
            },
          },
          case: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.legalConsent.count({ where }),
      prisma.legalConsent.groupBy({
        by: ['consentType'],
        _count: { id: true },
      }),
    ]);

    return apiSuccess({
      consents,
      totalCount,
      statsByType: statsByType.map((s) => ({
        type: s.consentType,
        count: s._count.id,
      })),
    });
  } catch (err) {
    console.error('Failed to query compliance consents:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch compliance consents', 500);
  }
}
