/**
 * Afzal Healthcare — Partner Accommodations & Hotel Booking Lifecycle Service
 * Handles commission redaction, partner hotel updates/soft-deactivation, and
 * role-scoped hotel booking lifecycle mutations with recalculation & audit logs.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ERROR_CODES } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/api/audit-logger';
import { calculateHotelStayNights } from '@/lib/validation/booking-helpers';
import type { ServiceResult } from '@/lib/services/clinical-pathway.service';

export const HOTEL_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
] as const;

type HotelBookingStatus = (typeof HOTEL_BOOKING_STATUSES)[number];

const TERMINAL_BOOKING_STATUSES = new Set<string>(['CANCELLED', 'COMPLETED']);

const ALLOWED_BOOKING_TRANSITIONS: Record<string, readonly HotelBookingStatus[]> = {
  PENDING: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED'],
  CONFIRMED: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_IN', 'COMPLETED', 'CANCELLED'],
};

export interface UpdatePartnerHotelParams {
  id: unknown;
  name?: unknown;
  city?: unknown;
  address?: unknown;
  nearHospitalId?: unknown;
  distanceKm?: unknown;
  starRating?: unknown;
  nightlyRateUsd?: unknown;
  commissionPercent?: unknown;
  amenities?: unknown;
  images?: unknown;
  description?: unknown;
  contactPhone?: unknown;
  contactEmail?: unknown;
  isActive?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface DeactivatePartnerHotelParams {
  id: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

export interface UpdateHotelBookingParams {
  bookingId: unknown;
  status?: unknown;
  checkInDate?: unknown;
  checkOutDate?: unknown;
  roomType?: unknown;
  numGuests?: unknown;
  specialRequests?: unknown;
  notes?: unknown;
  actor: { userId: string; role: string; ipAddress?: string };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const optionalNullableString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      return val.length > 0 ? val : null;
    });

const optionalNumberInRange = (
  label: string,
  options: { min?: number; max?: number; gt?: number; integer?: boolean }
) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined) return undefined;
      const num = typeof val === 'number' ? val : val.trim() === '' ? NaN : Number(val);
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a valid number` });
        return z.NEVER;
      }
      if (options.integer && !Number.isInteger(num)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be an integer` });
        return z.NEVER;
      }
      if (options.gt !== undefined && num <= options.gt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be greater than ${options.gt}`,
        });
        return z.NEVER;
      }
      if (options.min !== undefined && num < options.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at least ${options.min}`,
        });
        return z.NEVER;
      }
      if (options.max !== undefined && num > options.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at most ${options.max}`,
        });
        return z.NEVER;
      }
      return num;
    });

const optionalNullableEmail = z
  .string()
  .trim()
  .max(180)
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null || val.length === 0) return null;
    const check = z.string().email().safeParse(val);
    if (!check.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'contactEmail must be a valid email address',
      });
      return z.NEVER;
    }
    return val;
  });

const safeImageUrl = z
  .string()
  .trim()
  .min(1, 'Image URL cannot be empty')
  .refine(
    (val) => /^https?:\/\//i.test(val) || /^\/(?!\/)/.test(val),
    'Image URLs must use https://, http://, or a single-slash / path'
  );

const updatePartnerHotelSchema = z.object({
  id: z.string().trim().min(1, 'Hotel id is required'),
  name: z.string().trim().min(1, 'Hotel name cannot be empty').max(200).optional(),
  city: z.string().trim().min(1, 'City cannot be empty').max(120).optional(),
  address: z.string().trim().min(1, 'Address cannot be empty').max(500).optional(),
  nearHospitalId: optionalNullableString(120),
  distanceKm: optionalNumberInRange('distanceKm', { min: 0, max: 500 }),
  starRating: optionalNumberInRange('starRating', { min: 0, max: 5 }),
  nightlyRateUsd: optionalNumberInRange('nightlyRateUsd', { gt: 0 }),
  commissionPercent: optionalNumberInRange('commissionPercent', { min: 0, max: 100 }),
  amenities: z.array(z.string().trim().min(1)).optional(),
  images: z.array(safeImageUrl).optional(),
  description: optionalNullableString(5000),
  contactPhone: optionalNullableString(60),
  contactEmail: optionalNullableEmail,
  isActive: z.boolean().optional(),
});

const updateHotelBookingSchema = z.object({
  bookingId: z.string().trim().min(1, 'bookingId is required'),
  status: z.enum(HOTEL_BOOKING_STATUSES).optional(),
  checkInDate: z.string().trim().min(1).optional(),
  checkOutDate: z.string().trim().min(1).optional(),
  roomType: z.string().trim().min(1, 'roomType cannot be empty').max(160).optional(),
  numGuests: optionalNumberInRange('numGuests', { min: 1, max: 10, integer: true }),
  specialRequests: optionalNullableString(2000),
  notes: optionalNullableString(2000),
});

/**
 * Strip sensitive partner commission rates for everyone except ADMIN and MANAGER.
 */
export function sanitizeHotelsForViewer<T extends Record<string, unknown>>(
  hotels: T[],
  role?: string | null
): Array<T | Omit<T, 'commissionPercent'>> {
  if (role === 'ADMIN' || role === 'MANAGER') {
    return hotels;
  }
  return hotels.map(({ commissionPercent: _commissionPercent, ...rest }) => {
    void _commissionPercent;
    return rest;
  });
}

/**
 * Strip booking commissionAmountUsd and nested hotel.commissionPercent for non-ADMIN/MANAGER viewers.
 */
export function sanitizeBookingForViewer<T extends Record<string, unknown>>(
  booking: T,
  role?: string | null
): T | Omit<T, 'commissionAmountUsd'> {
  if (role === 'ADMIN' || role === 'MANAGER') {
    return booking;
  }
  const { commissionAmountUsd: _commissionAmountUsd, hotel, ...rest } = booking as T & {
    commissionAmountUsd?: unknown;
    hotel?: Record<string, unknown> | null;
  };
  void _commissionAmountUsd;

  if (hotel && typeof hotel === 'object') {
    return {
      ...rest,
      hotel: sanitizeHotelsForViewer([hotel], role)[0],
    } as Omit<T, 'commissionAmountUsd'>;
  }

  return rest as Omit<T, 'commissionAmountUsd'>;
}

/**
 * Update partner hotel details or active status (ADMIN & MANAGER only).
 */
export async function updatePartnerHotel(
  params: UpdatePartnerHotelParams
): Promise<ServiceResult<{ hotel: unknown }>> {
  const { actor } = params;

  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only Admins and Managers can update partner hotels',
      status: 403,
    };
  }

  const parsed = updatePartnerHotelSchema.safeParse({
    id: params.id,
    name: params.name,
    city: params.city,
    address: params.address,
    nearHospitalId: params.nearHospitalId,
    distanceKm: params.distanceKm,
    starRating: params.starRating,
    nightlyRateUsd: params.nightlyRateUsd,
    commissionPercent: params.commissionPercent,
    amenities: params.amenities,
    images: params.images,
    description: params.description,
    contactPhone: params.contactPhone,
    contactEmail: params.contactEmail,
    isActive: params.isActive,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid partner hotel update payload',
      status: 400,
    };
  }

  const data = parsed.data;

  const existing = await prisma.hotel.findUnique({
    where: { id: data.id },
  });

  if (!existing) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Partner hotel not found',
      status: 404,
    };
  }

  if (data.nearHospitalId !== undefined && data.nearHospitalId !== null) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: data.nearHospitalId },
      select: { id: true },
    });
    if (!hospital) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Referenced hospital not found',
        status: 400,
      };
    }
  }

  const updateData: Prisma.HotelUncheckedUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.nearHospitalId !== undefined) updateData.nearHospitalId = data.nearHospitalId;
  if (data.distanceKm !== undefined) updateData.distanceKm = data.distanceKm;
  if (data.starRating !== undefined) updateData.starRating = data.starRating;
  if (data.nightlyRateUsd !== undefined) updateData.nightlyRateUsd = data.nightlyRateUsd;
  if (data.commissionPercent !== undefined) updateData.commissionPercent = data.commissionPercent;
  if (data.amenities !== undefined) updateData.amenities = data.amenities;
  if (data.images !== undefined) updateData.images = data.images;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length === 0) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'At least one updatable field is required',
      status: 400,
    };
  }

  const updated = await prisma.hotel.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      nearHospital: { select: { id: true, name: true, city: true } },
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Hotel',
    entityId: existing.id,
    oldValue: {
      name: existing.name,
      city: existing.city,
      nightlyRateUsd: existing.nightlyRateUsd,
      commissionPercent: existing.commissionPercent,
      isActive: existing.isActive,
    },
    newValue: updateData,
    ipAddress: actor.ipAddress,
  });

  return { ok: true, data: { hotel: updated } };
}

/**
 * Soft-deactivate a partner hotel (isActive: false). Never hard-deletes Hotel rows
 * so historical HotelBooking foreign keys remain intact.
 */
export async function deactivatePartnerHotel(
  params: DeactivatePartnerHotelParams
): Promise<ServiceResult<{ hotel: unknown }>> {
  const { actor } = params;

  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only Admins and Managers can deactivate partner hotels',
      status: 403,
    };
  }

  const idSchema = z.string().trim().min(1, 'Hotel id is required');
  const parsedId = idSchema.safeParse(params.id);
  if (!parsedId.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsedId.error.issues[0]?.message || 'Hotel id is required',
      status: 400,
    };
  }

  const existing = await prisma.hotel.findUnique({
    where: { id: parsedId.data },
  });

  if (!existing) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Partner hotel not found',
      status: 404,
    };
  }

  const updated = await prisma.hotel.update({
    where: { id: existing.id },
    data: { isActive: false },
    include: {
      nearHospital: { select: { id: true, name: true, city: true } },
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.DEACTIVATE,
    entityType: 'Hotel',
    entityId: existing.id,
    oldValue: { isActive: existing.isActive },
    newValue: { isActive: false },
    ipAddress: actor.ipAddress,
  });

  return { ok: true, data: { hotel: updated } };
}

/**
 * Update a hotel booking lifecycle state, stay dates (recomputing nights, total & commission),
 * room type, guest count, or special requests under strict role & ownership checks.
 */
export async function updateHotelBooking(
  params: UpdateHotelBookingParams
): Promise<ServiceResult<{ booking: unknown }>> {
  const { actor } = params;

  if (
    actor.role !== 'PATIENT' &&
    actor.role !== 'MANAGER' &&
    actor.role !== 'ADMIN'
  ) {
    return {
      ok: false,
      code: ERROR_CODES.FORBIDDEN,
      message: 'You are not authorized to update hotel bookings',
      status: 403,
    };
  }

  const parsed = updateHotelBookingSchema.safeParse({
    bookingId: params.bookingId,
    status: params.status,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    roomType: params.roomType,
    numGuests: params.numGuests,
    specialRequests: params.specialRequests,
    notes: params.notes,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: parsed.error.issues[0]?.message || 'Invalid hotel booking update payload',
      status: 400,
    };
  }

  const data = parsed.data;

  const booking = await prisma.hotelBooking.findUnique({
    where: { id: data.bookingId },
    include: {
      hotel: true,
      case: {
        select: {
          id: true,
          managerId: true,
        },
      },
      patient: {
        select: {
          id: true,
          assignedManagerId: true,
        },
      },
    },
  });

  if (!booking) {
    return {
      ok: false,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Hotel booking not found',
      status: 404,
    };
  }

  if (actor.role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({
      where: { userId: actor.userId },
    });
    if (!patient) {
      return {
        ok: false,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Patient profile not found',
        status: 404,
      };
    }

    if (booking.patientId !== patient.id) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to modify this hotel booking',
        status: 403,
      };
    }

    const attemptedFieldEdit =
      data.checkInDate !== undefined ||
      data.checkOutDate !== undefined ||
      data.roomType !== undefined ||
      data.numGuests !== undefined ||
      data.specialRequests !== undefined ||
      data.notes !== undefined;

    if (attemptedFieldEdit || data.status !== 'CANCELLED') {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Patients may only cancel their reservation',
        status: 403,
      };
    }

    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: `Cannot cancel a booking with status ${booking.status}`,
        status: 400,
      };
    }
  } else if (actor.role === 'MANAGER') {
    const isAssignedManager =
      booking.patient.assignedManagerId === actor.userId ||
      booking.case?.managerId === actor.userId;

    if (!isAssignedManager) {
      return {
        ok: false,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Patient is not assigned to you',
        status: 403,
      };
    }
  }

  if (TERMINAL_BOOKING_STATUSES.has(booking.status)) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Cannot modify a ${booking.status} hotel booking`,
      status: 400,
    };
  }

  if (data.status !== undefined) {
    const allowedNext = ALLOWED_BOOKING_TRANSITIONS[booking.status] ?? [];
    if (!allowedNext.includes(data.status)) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message: `Cannot transition booking from ${booking.status} to ${data.status}`,
        status: 400,
      };
    }
  }

  const updateData: Prisma.HotelBookingUncheckedUpdateInput = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.roomType !== undefined) {
    updateData.roomType = data.roomType;
  }
  if (data.numGuests !== undefined) {
    updateData.numGuests = data.numGuests;
  }
  const effectiveSpecialRequests =
    data.specialRequests !== undefined ? data.specialRequests : data.notes;
  if (effectiveSpecialRequests !== undefined) {
    updateData.specialRequests = effectiveSpecialRequests;
  }

  if (data.checkInDate !== undefined || data.checkOutDate !== undefined) {
    const checkInInput =
      data.checkInDate ?? new Date(booking.checkInDate).toISOString();
    const checkOutInput =
      data.checkOutDate ?? new Date(booking.checkOutDate).toISOString();

    let start: Date;
    let end: Date;
    let numNights: number;
    try {
      const stay = calculateHotelStayNights(checkInInput, checkOutInput);
      start = stay.start;
      end = stay.end;
      numNights = stay.numNights;
    } catch (dateErr) {
      return {
        ok: false,
        code: ERROR_CODES.BAD_REQUEST,
        message:
          dateErr instanceof Error
            ? dateErr.message
            : 'Invalid check-in or check-out date',
        status: 400,
      };
    }

    const totalAmountUsd = round2(numNights * Number(booking.hotel.nightlyRateUsd));
    const commissionAmountUsd = round2(
      totalAmountUsd * (Number(booking.hotel.commissionPercent) / 100)
    );

    updateData.checkInDate = start;
    updateData.checkOutDate = end;
    updateData.numNights = numNights;
    updateData.totalAmountUsd = totalAmountUsd;
    updateData.commissionAmountUsd = commissionAmountUsd;
  }

  if (Object.keys(updateData).length === 0) {
    return {
      ok: false,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'At least one booking field update is required',
      status: 400,
    };
  }

  const updated = await prisma.hotelBooking.update({
    where: { id: booking.id },
    data: updateData,
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
  });

  await createAuditLog({
    actorId: actor.userId,
    action: AUDIT_ACTIONS.UPDATE_BOOKING,
    entityType: 'HotelBooking',
    entityId: booking.id,
    oldValue: {
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numNights: booking.numNights,
      totalAmountUsd: booking.totalAmountUsd,
    },
    newValue: updateData,
    ipAddress: actor.ipAddress,
  });

  return {
    ok: true,
    data: {
      booking: sanitizeBookingForViewer(
        updated as unknown as Record<string, unknown>,
        actor.role
      ),
    },
  };
}
