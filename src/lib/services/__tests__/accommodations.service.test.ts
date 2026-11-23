import { NextRequest } from 'next/server';
import {
  getDefaultStayDates,
  previewHotelStayCost,
} from '@/lib/validation/booking-helpers';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hotel: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hotelBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    hospital: {
      findUnique: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  GET as getAccommodations,
  PUT as putAccommodation,
  DELETE as deleteAccommodation,
} from '@/app/api/v1/accommodations/route';
import { PATCH as patchHotelBooking } from '@/app/api/v1/accommodations/bookings/route';

const mockedPrisma = prisma as unknown as {
  hotel: Record<string, jest.Mock>;
  hotelBooking: Record<string, jest.Mock>;
  hospital: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

describe('Task 3: Partner Accommodations & Hotel Booking Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes dynamic future stay dates and rejects reversed dates in previewHotelStayCost (no Math.abs)', () => {
    const fixedNow = new Date('2026-11-23T10:00:00.000Z');
    const defaults = getDefaultStayDates(fixedNow);
    expect(defaults.checkInDate).toBe('2026-11-24');
    expect(defaults.checkOutDate).toBe('2026-11-29');

    const validPreview = previewHotelStayCost('2026-11-24', '2026-11-27', 110);
    expect(validPreview).toEqual({ valid: true, numNights: 3, totalUsd: 330 });

    const reversedPreview = previewHotelStayCost('2026-11-27', '2026-11-24', 110);
    expect(reversedPreview.valid).toBe(false);
    expect(reversedPreview.totalUsd).toBe(0);

    const sameDayPreview = previewHotelStayCost('2026-11-24', '2026-11-24', 110);
    expect(sameDayPreview.valid).toBe(false);
    expect(sameDayPreview.totalUsd).toBe(0);
  });

  it('strips commissionPercent on GET /api/v1/accommodations for PATIENT, DOCTOR, and anonymous callers while keeping it for MANAGER/ADMIN', async () => {
    mockedPrisma.hotel.findMany.mockResolvedValue([
      {
        id: 'h-1',
        name: 'Taj Recovery',
        nightlyRateUsd: 120,
        commissionPercent: 18,
        isActive: true,
      },
    ]);

    const anonReq = new NextRequest('http://localhost/api/v1/accommodations?includeInactive=true');
    const anonRes = await getAccommodations(anonReq);
    const anonJson = await anonRes.json();
    expect(anonJson.data.hotels[0].commissionPercent).toBeUndefined();
    expect(mockedPrisma.hotel.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );

    const patReq = new NextRequest('http://localhost/api/v1/accommodations', {
      headers: { 'x-user-id': 'pat-u-1', 'x-user-email': 'p@example.com', 'x-user-role': 'PATIENT' },
    });
    const patRes = await getAccommodations(patReq);
    const patJson = await patRes.json();
    expect(patJson.data.hotels[0].commissionPercent).toBeUndefined();

    const docReq = new NextRequest('http://localhost/api/v1/accommodations?includeInactive=true', {
      headers: { 'x-user-id': 'doc-1', 'x-user-email': 'd@example.com', 'x-user-role': 'DOCTOR' },
    });
    const docRes = await getAccommodations(docReq);
    const docJson = await docRes.json();
    expect(docJson.data.hotels[0].commissionPercent).toBeUndefined();
    expect(mockedPrisma.hotel.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );

    const mgrReq = new NextRequest('http://localhost/api/v1/accommodations?includeInactive=true', {
      headers: { 'x-user-id': 'mgr-1', 'x-user-email': 'm@example.com', 'x-user-role': 'MANAGER' },
    });
    const mgrRes = await getAccommodations(mgrReq);
    const mgrJson = await mgrRes.json();
    expect(mgrJson.data.hotels[0].commissionPercent).toBe(18);
    expect(mockedPrisma.hotel.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('updates and soft-deactivates partner hotels via PUT and DELETE /api/v1/accommodations', async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({
      id: 'h-1',
      name: 'Taj Recovery',
      city: 'New Delhi',
      address: '12 Ring Road',
      nightlyRateUsd: 120,
      commissionPercent: 15,
      isActive: true,
    });
    mockedPrisma.hotel.update.mockResolvedValue({
      id: 'h-1',
      name: 'Taj Recovery Updated',
      nightlyRateUsd: 140,
      commissionPercent: 18,
      isActive: true,
    });

    const putReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'adm-1',
        'x-user-email': 'a@example.com',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        id: 'h-1',
        name: 'Taj Recovery Updated',
        nightlyRateUsd: 140,
        commissionPercent: 18,
      }),
    });
    const putRes = await putAccommodation(putReq);
    expect(putRes.status).toBe(200);
    expect(mockedPrisma.hotel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h-1' },
        data: expect.not.objectContaining({
          description: null,
          contactPhone: null,
          contactEmail: null,
          nearHospitalId: null,
        }),
      })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE',
          entityType: 'Hotel',
          entityId: 'h-1',
        }),
      })
    );

    // Reactivate / deactivate toggle via PUT
    mockedPrisma.hotel.update.mockResolvedValueOnce({ id: 'h-1', isActive: true });
    const reactivateReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'm@example.com',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({ id: 'h-1', isActive: true }),
    });
    const reactivateRes = await putAccommodation(reactivateReq);
    expect(reactivateRes.status).toBe(200);

    // Soft-deactivate via DELETE
    mockedPrisma.hotel.update.mockResolvedValueOnce({ id: 'h-1', isActive: false });
    const delReq = new NextRequest('http://localhost/api/v1/accommodations?id=h-1', {
      method: 'DELETE',
      headers: { 'x-user-id': 'adm-1', 'x-user-email': 'a@example.com', 'x-user-role': 'ADMIN' },
    });
    const delRes = await deleteAccommodation(delReq);
    expect(delRes.status).toBe(200);
    expect(mockedPrisma.hotel.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'h-1' },
        data: { isActive: false },
      })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DEACTIVATE',
          entityType: 'Hotel',
          entityId: 'h-1',
        }),
      })
    );

    // Forbidden for PATIENT / DOCTOR
    const docPutReq = new NextRequest('http://localhost/api/v1/accommodations', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'doc-1',
        'x-user-email': 'd@example.com',
        'x-user-role': 'DOCTOR',
      },
      body: JSON.stringify({ id: 'h-1', name: 'Hack' }),
    });
    expect((await putAccommodation(docPutReq)).status).toBe(403);
  });

  it('allows PATIENT self-cancellation of CONFIRMED bookings and recalculates commission on MANAGER date updates', async () => {
    mockedPrisma.patient.findUnique.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-1',
      patientId: 'pat-1',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      roomType: 'Deluxe Recovery Suite',
      numGuests: 2,
      numNights: 4,
      totalAmountUsd: 400,
      commissionAmountUsd: 80,
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    mockedPrisma.hotelBooking.update.mockResolvedValueOnce({
      id: 'bk-1',
      status: 'CANCELLED',
      commissionAmountUsd: 80,
    });

    const patCancel = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ bookingId: 'bk-1', status: 'CANCELLED' }),
    });
    const patCancelRes = await patchHotelBooking(patCancel);
    const patCancelJson = await patCancelRes.json();
    expect(patCancelRes.status).toBe(200);
    expect(patCancelJson.data.booking.commissionAmountUsd).toBeUndefined();
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE_BOOKING',
          entityType: 'HotelBooking',
          entityId: 'bk-1',
        }),
      })
    );

    // Patient cannot cancel CHECKED_IN booking
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-checked',
      patientId: 'pat-1',
      status: 'CHECKED_IN',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    const patCheckedInCancel = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({ bookingId: 'bk-checked', status: 'CANCELLED' }),
    });
    expect((await patchHotelBooking(patCheckedInCancel)).status).toBe(400);

    // Manager scoped check: unassigned manager gets 403
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-other',
      patientId: 'pat-2',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      patient: { id: 'pat-2', assignedManagerId: 'mgr-other' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    const otherMgrPatch = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'm@example.com',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({ bookingId: 'bk-other', status: 'CHECKED_IN' }),
    });
    expect((await patchHotelBooking(otherMgrPatch)).status).toBe(403);

    // Manager extends stay to 6 nights -> total 600, commission 120
    mockedPrisma.hotelBooking.findUnique.mockResolvedValueOnce({
      id: 'bk-2',
      patientId: 'pat-1',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-12-01'),
      checkOutDate: new Date('2026-12-05'),
      roomType: 'Deluxe Recovery Suite',
      numGuests: 2,
      numNights: 4,
      totalAmountUsd: 400,
      commissionAmountUsd: 80,
      patient: { id: 'pat-1', assignedManagerId: 'mgr-1' },
      hotel: { id: 'h-1', nightlyRateUsd: 100, commissionPercent: 20 },
    });
    mockedPrisma.hotelBooking.update.mockImplementationOnce(async ({ data }: { data: unknown }) => ({
      id: 'bk-2',
      ...(data as Record<string, unknown>),
    }));

    const mgrPatch = new NextRequest('http://localhost/api/v1/accommodations/bookings', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'mgr-1',
        'x-user-email': 'm@example.com',
        'x-user-role': 'MANAGER',
      },
      body: JSON.stringify({
        bookingId: 'bk-2',
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-07',
        status: 'CHECKED_IN',
      }),
    });
    const mgrPatchRes = await patchHotelBooking(mgrPatch);
    const mgrPatchJson = await mgrPatchRes.json();
    expect(mgrPatchRes.status).toBe(200);
    expect(mgrPatchJson.data.booking.numNights).toBe(6);
    expect(mgrPatchJson.data.booking.totalAmountUsd).toBe(600);
    expect(mgrPatchJson.data.booking.commissionAmountUsd).toBe(120);
  });
});
