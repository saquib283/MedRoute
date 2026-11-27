import { NextResponse } from 'next/server';
import { PrismaClient, AccommodationStatus, RoomType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createBookingSchema = z.object({
  caseId: z.string(),
  hostelId: z.string(),
  checkIn: z.string().transform((val) => new Date(val)),
  checkOut: z.string().transform((val) => new Date(val)),
  roomType: z.nativeEnum(RoomType),
});

const updateBookingSchema = z.object({
  bookingId: z.string(),
  status: z.nativeEnum(AccommodationStatus).optional(),
  checkIn: z.string().transform((val) => new Date(val)).optional(),
  checkOut: z.string().transform((val) => new Date(val)).optional(),
  roomType: z.nativeEnum(RoomType).optional(),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const meta = searchParams.get('meta') === 'true';

    if (meta) {
      const [hostels, patients] = await Promise.all([
        prisma.hostel.findMany({ where: { isActive: true } }),
        prisma.patient.findMany({
          where: { assignedManagerId: userId },
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
            cases: {
              where: { status: { not: 'CLOSED' } },
              select: {
                id: true,
                status: true,
              },
            },
          },
        }),
      ]);

      return NextResponse.json({ hostels, patients });
    }

    const bookings = await prisma.accommodationBooking.findMany({
      where:
        userRole === 'ADMIN'
          ? {}
          : {
              case: {
                OR: [
                  { managerId: userId },
                  { patient: { assignedManagerId: userId } },
                ],
              },
            },
      include: {
        hostel: true,
        case: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('Failed to load accommodations bookings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, hostelId, checkIn, checkOut, roomType } = parsed.data;

    // Verify manager controls this case
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord || caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Case not found or unauthorized' }, { status: 404 });
    }

    const booking = await prisma.accommodationBooking.create({
      data: {
        caseId,
        hostelId,
        checkIn,
        checkOut,
        roomType,
        status: 'CONFIRMED',
      },
      include: {
        hostel: true,
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    console.error('Failed to create accommodations booking:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const { bookingId, status, checkIn, checkOut, roomType } = parsed.data;

    // Verify booking belongs to a case managed by this manager
    const bookingRecord = await prisma.accommodationBooking.findUnique({
      where: { id: bookingId },
      include: {
        case: true,
      },
    });

    if (
      !bookingRecord ||
      (userRole !== 'ADMIN' &&
        bookingRecord.case.managerId !== userId &&
        bookingRecord.case.patientId)
    ) {
      const patientCheck = await prisma.patient.findUnique({
        where: { id: bookingRecord?.case.patientId },
      });
      if (userRole !== 'ADMIN' && patientCheck?.assignedManagerId !== userId && bookingRecord?.case.managerId !== userId) {
        return NextResponse.json({ error: 'Booking not found or unauthorized' }, { status: 404 });
      }
    }

    const updatedBooking = await prisma.accommodationBooking.update({
      where: { id: bookingId },
      data: {
        ...(status !== undefined && { status }),
        ...(checkIn !== undefined && { checkIn }),
        ...(checkOut !== undefined && { checkOut }),
        ...(roomType !== undefined && { roomType }),
      },
    });

    return NextResponse.json({ success: true, booking: updatedBooking });
  } catch (err) {
    console.error('Failed to update accommodation booking:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
