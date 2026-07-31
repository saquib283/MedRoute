/**
 * Afzal Healthcare — Accommodation Partner Hotels API
 * GET /api/v1/accommodations — Fetch list of partner hotels and recovery suites
 * POST /api/v1/accommodations — Admin & Manager add/update partner hotel listings
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const hospitalId = searchParams.get('hospitalId');

    const where: any = { isActive: true };
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

    return apiSuccess({ hotels });
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

    const hotel = await prisma.hotel.create({
      data: {
        name,
        city,
        address,
        nearHospitalId: nearHospitalId || null,
        distanceKm: parseFloat(distanceKm) || 2.0,
        starRating: parseFloat(starRating) || 4.5,
        nightlyRateUsd: parseFloat(nightlyRateUsd),
        commissionPercent: parseFloat(commissionPercent) || 15.0,
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

    return apiSuccess({ hotel });
  } catch (err) {
    console.error('[Accommodations POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create partner hotel listing', 500);
  }
}
