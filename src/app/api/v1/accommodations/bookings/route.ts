/**
 * Afzal Healthcare — Accommodation Hotel Bookings & Revenue API
 * GET /api/v1/accommodations/bookings — Fetch bookings & partner commission revenue cut summary
 * POST /api/v1/accommodations/bookings — Create hotel booking & calculate commission earnings
 */

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { calculateHotelStayNights } from '@/lib/validation/booking-helpers';
import {
  sanitizeBookingForViewer,
  updateHotelBooking,
} from '@/lib/services/accommodations.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser.role === 'DOCTOR') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Doctors cannot access hotel bookings', 403);
    }

    const where: Prisma.HotelBookingWhereInput = {};

    if (authUser.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: authUser.userId },
      });
      if (!patient) return apiError(ERROR_CODES.NOT_FOUND, 'Patient profile not found', 404);
      where.patientId = patient.id;
    } else if (authUser.role === 'MANAGER') {
      where.OR = [
        { patient: { assignedManagerId: authUser.userId } },
        { case: { managerId: authUser.userId } },
      ];
    }

    const bookings = await prisma.hotelBooking.findMany({
      where,
      include: {
        hotel: true,
        patient: {
          select: {
            id: true,
            nationality: true,
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (authUser.role === 'PATIENT') {
      const sanitized = bookings.map((b) =>
        sanitizeBookingForViewer(b as unknown as Record<string, unknown>, authUser.role)
      );
      return apiSuccess({ bookings: sanitized });
    }

    // Calculate revenue metrics (excluding cancelled bookings)
    let totalGrossRevenue = 0;
    let totalCommissionEarned = 0;

    bookings.forEach((b) => {
      if (b.status !== 'CANCELLED') {
        totalGrossRevenue += Number(b.totalAmountUsd);
        totalCommissionEarned += Number(b.commissionAmountUsd);
      }
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

    if (
      authUser.role !== 'PATIENT' &&
      authUser.role !== 'MANAGER' &&
      authUser.role !== 'ADMIN'
    ) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        'Only patients, managers, or admins can create hotel bookings',
        403
      );
    }

    const body = await request.json();
    const {
      hotelId,
      checkInDate,
      checkOutDate,
      roomType,
      numGuests,
      specialRequests,
      caseId,
      patientId: bodyPatientId,
    } = body;

    if (!hotelId || !checkInDate || !checkOutDate) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'hotelId, checkInDate, and checkOutDate are required', 400);
    }

    // Verify optional case ownership
    let caseRecord: { id: string; patientId: string; managerId: string | null } | null = null;
    if (caseId) {
      caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { id: true, patientId: true, managerId: true },
      });
      if (!caseRecord) {
        return apiError(ERROR_CODES.FORBIDDEN, 'Invalid case for patient', 403);
      }
    }

    // Find Patient
    let patient;
    if (
      (authUser.role === 'MANAGER' || authUser.role === 'ADMIN') &&
      typeof bodyPatientId === 'string' &&
      bodyPatientId
    ) {
      patient = await prisma.patient.findUnique({ where: { id: bodyPatientId } });
      if (!patient) {
        return apiError(ERROR_CODES.NOT_FOUND, 'Patient profile not found', 404);
      }
      if (
        authUser.role === 'MANAGER' &&
        patient.assignedManagerId !== authUser.userId &&
        caseRecord?.managerId !== authUser.userId
      ) {
        return apiError(ERROR_CODES.FORBIDDEN, 'Patient is not assigned to you', 403);
      }
    } else {
      patient = await prisma.patient.findUnique({
        where: { userId: authUser.userId },
      });
    }
    if (!patient) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Patient profile required for hotel booking', 404);
    }

    if (caseRecord && caseRecord.patientId !== patient.id) {
      return apiError(ERROR_CODES.FORBIDDEN, 'Invalid case for patient', 403);
    }

    // Find Hotel & ensure active
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
    });
    if (!hotel) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Partner hotel not found', 404);
    }
    if (!hotel.isActive) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Partner hotel is currently inactive', 400);
    }

    // Validate dates & calculate stay nights
    let start: Date;
    let end: Date;
    let numNights: number;
    try {
      const stay = calculateHotelStayNights(checkInDate, checkOutDate);
      start = stay.start;
      end = stay.end;
      numNights = stay.numNights;
    } catch (dateErr) {
      const message =
        dateErr instanceof Error ? dateErr.message : 'Invalid check-in or check-out date';
      return apiError(ERROR_CODES.BAD_REQUEST, message, 400);
    }

    // Validate guest count
    const parsedGuests = Number(numGuests ?? 2);
    if (!Number.isInteger(parsedGuests) || parsedGuests < 1 || parsedGuests > 10) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Number of guests must be between 1 and 10', 400);
    }

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
        numGuests: parsedGuests,
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

    return apiSuccess({
      booking: sanitizeBookingForViewer(
        booking as unknown as Record<string, unknown>,
        authUser.role
      ),
    });
  } catch (err) {
    console.error('[Hotel Bookings POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process hotel accommodation booking', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await updateHotelBooking({
      bookingId: body.bookingId,
      status: body.status,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      roomType: body.roomType,
      numGuests: body.numGuests,
      specialRequests: body.specialRequests,
      notes: body.notes,
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
    console.error('[Hotel Bookings PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update hotel accommodation booking', 500);
  }
}
