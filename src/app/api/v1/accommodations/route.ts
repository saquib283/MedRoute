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
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import {
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

    if (authUser.role !== 'ADMIN' && authUser.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Only Admins and Managers can add partner hotels', 403);
    }

    const body = await request.json();
    const {
      name,
      city,
      address,
      nearHospitalId,
      distanceKm,
      starRating,
      nightlyRateUsd,
      commissionPercent,
      amenities,
      images,
      description,
      contactPhone,
      contactEmail,
    } = body;

    if (!name || !city || !address || !nightlyRateUsd) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Missing required hotel fields (name, city, address, nightlyRateUsd)', 400);
    }

    const parsedCommission =
      commissionPercent !== undefined && commissionPercent !== '' ? Number(commissionPercent) : 15.0;
    if (isNaN(parsedCommission) || parsedCommission < 0 || parsedCommission > 100) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Commission percent must be between 0 and 100', 400);
    }

    const hotel = await prisma.hotel.create({
      data: {
        name,
        city,
        address,
        nearHospitalId: nearHospitalId || null,
        distanceKm: parseFloat(distanceKm) || 2.0,
        starRating: parseFloat(starRating) || 4.5,
        nightlyRateUsd: parseFloat(nightlyRateUsd),
        commissionPercent: parsedCommission,
        amenities: Array.isArray(amenities) ? amenities : ['Wheelchair Accessible', 'Halal Food'],
        images: Array.isArray(images) ? images : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'],
        description: description || '',
        contactPhone: contactPhone || '',
        contactEmail: contactEmail || '',
      },
      include: {
        nearHospital: true,
      },
    });

    await createAuditLog({
      actorId: authUser.userId,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Hotel',
      entityId: hotel.id,
      newValue: {
        name: hotel.name,
        city: hotel.city,
        nightlyRateUsd: hotel.nightlyRateUsd,
        commissionPercent: hotel.commissionPercent,
      },
      ipAddress: getClientIP(request),
    });

    return apiSuccess({ hotel });
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
