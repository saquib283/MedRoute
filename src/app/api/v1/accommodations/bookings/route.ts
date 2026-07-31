/**
 * Afzal Healthcare — Accommodation Hotel Bookings & Revenue API
 * GET /api/v1/accommodations/bookings — Fetch bookings & partner commission revenue cut summary
 * POST /api/v1/accommodations/bookings — Create hotel booking & calculate commission earnings
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let where: any = {};

    if (authUser.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: authUser.userId },
      });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient profile not found', 404);
      where.patientId = patient.id;
    }

    const bookings = await prisma.hotelBooking.findMany({
      where,
      include: {
        hotel: true,
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate revenue metrics
    let totalGrossRevenue = 0;
    let totalCommissionEarned = 0;

    bookings.forEach((b) => {
      totalGrossRevenue += Number(b.totalAmountUsd);
      totalCommissionEarned += Number(b.commissionAmountUsd);
    });

    return apiSuccess({
      bookings,
      metrics: {
        totalBookings: bookings.length,
        totalGrossRevenue,
        totalCommissionEarned,
      },
    });
  } catch (err) {
    console.error('[Hotel Bookings GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch hotel bookings', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { hotelId, checkInDate, checkOutDate, roomType, numGuests, specialRequests, caseId } = body;

    if (!hotelId || !checkInDate || !checkOutDate) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'hotelId, checkInDate, and checkOutDate are required', 400);
    }

    // Find Patient
    const patient = await prisma.patient.findUnique({
      where: { userId: authUser.userId },
    });
    if (!patient) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Patient profile required for hotel booking', 404);
    }

    // Find Hotel
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
    });
    if (!hotel) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Partner hotel not found', 404);
    }

    // Calculate Nights
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const numNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate Price & Partner Commission Cut ($ USD)
    const nightlyPrice = Number(hotel.nightlyRateUsd);
    const totalAmountUsd = nightlyPrice * numNights;
    const commissionPercent = Number(hotel.commissionPercent) / 100;
    const commissionAmountUsd = totalAmountUsd * commissionPercent;

    const bookingNo = `HTL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const booking = await prisma.hotelBooking.create({
      data: {
        bookingNo,
        patientId: patient.id,
        hotelId: hotel.id,
        caseId: caseId || null,
        checkInDate: start,
        checkOutDate: end,
        roomType: roomType || 'Deluxe Medical Suite',
        numGuests: parseInt(numGuests) || 2,
        numNights,
        totalAmountUsd,
        commissionAmountUsd,
        status: 'CONFIRMED',
        specialRequests: specialRequests || '',
      },
      include: {
        hotel: true,
      },
    });

    return apiSuccess({ booking });
  } catch (err) {
    console.error('[Hotel Bookings POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process hotel accommodation booking', 500);
  }
}
