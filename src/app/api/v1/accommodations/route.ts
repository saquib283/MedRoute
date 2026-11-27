/**
 * Afzal Healthcare — Accommodation Partner Hotels API
 * GET /api/v1/accommodations — Fetch list of partner hotels and recovery suites
 * POST /api/v1/accommodations — Admin & Manager add partner hotel listings
 * PUT /api/v1/accommodations — Admin & Manager update partner hotel listings
 * DELETE /api/v1/accommodations — Admin & Manager soft-deactivate partner hotel listings
 */

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthUser, getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import {
  createPartnerHotel,
  deactivatePartnerHotel,
  sanitizeHotelsForViewer,
  updatePartnerHotel,
} from '@/lib/services/accommodations.service';

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const hospitalId = searchParams.get('hospitalId');
    const isStaff = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER';
    const includeInactive = isStaff && searchParams.get('includeInactive') === 'true';

    const where: Prisma.HotelWhereInput = includeInactive ? {} : { isActive: true };
    if (city) where.city = city;
    if (hospitalId) where.nearHospitalId = hospitalId;

    const hotels = await prisma.hotel.findMany({
      where,
      include: {
        nearHospital: { select: { id: true, name: true, city: true } },
      },
      orderBy: [
        { distanceKm: 'asc' },
        { starRating: 'desc' },
      ],
    });

    const sanitizedHotels = sanitizeHotelsForViewer(
      hotels as unknown as Array<Record<string, unknown>>,
      authUser?.role
    );

    return apiSuccess({ hotels: sanitizedHotels });
  } catch (err) {
    console.error('[Accommodations GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch accommodations', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await createPartnerHotel({
      name: body.name,
      city: body.city,
      address: body.address,
      nearHospitalId: body.nearHospitalId,
      distanceKm: body.distanceKm,
      starRating: body.starRating,
      nightlyRateUsd: body.nightlyRateUsd,
      commissionPercent: body.commissionPercent,
      amenities: body.amenities,
      images: body.images,
      description: body.description,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
      actor: {
        userId: authUser.userId,
        role: authUser.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data, undefined, 201);
  } catch (err) {
    console.error('[Accommodations POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create partner hotel listing', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await updatePartnerHotel({
      id: body.id,
      name: body.name,
      city: body.city,
      address: body.address,
      nearHospitalId: body.nearHospitalId,
      distanceKm: body.distanceKm,
      starRating: body.starRating,
      nightlyRateUsd: body.nightlyRateUsd,
      commissionPercent: body.commissionPercent,
      amenities: body.amenities,
      images: body.images,
      description: body.description,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
      isActive: body.isActive,
      actor: {
        userId: authUser.userId,
        role: authUser.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Accommodations PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update partner hotel listing', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    let hotelId: unknown = searchParams.get('id');

    if (!hotelId) {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        hotelId = body?.id;
      } catch {
        hotelId = null;
      }
    }

    const result = await deactivatePartnerHotel({
      id: hotelId,
      actor: {
        userId: authUser.userId,
        role: authUser.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Accommodations DELETE Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate partner hotel listing', 500);
  }
}
