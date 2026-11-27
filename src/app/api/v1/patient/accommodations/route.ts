import { NextResponse } from 'next/server';
import { PrismaClient, RoomType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createPatientBookingSchema = z.object({
  caseId: z.string(),
  hostelId: z.string(),
  checkIn: z.string().transform((val) => new Date(val)),
  checkOut: z.string().transform((val) => new Date(val)),
  roomType: z.nativeEnum(RoomType),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized role' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotelId');

    const patient = await prisma.patient.findUnique({
      where: { userId },
      include: {
        cases: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: { message: 'Patient profile not found' } }, { status: 404 });
    }

    // If fetching single hotel property details
    if (hotelId) {
      const hotel = await prisma.hostel.findFirst({
        where: { id: hotelId, isActive: true },
      });

      if (!hotel) {
        return NextResponse.json({ success: false, error: { message: 'Hotel property not found' } }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          hotel,
          cases: patient.cases,
        },
      });
    }

    const caseIds = patient.cases.map((c) => c.id);

    const [bookings, hostels] = await Promise.all([
      prisma.accommodationBooking.findMany({
        where: {
          caseId: { in: caseIds },
        },
        include: {
          hostel: true,
          case: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.hostel.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bookings,
        hostels,
        cases: patient.cases,
      },
    });
  } catch (err) {
    console.error('Failed to fetch patient accommodations:', err);
    return NextResponse.json({ success: false, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || userRole !== 'PATIENT') {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized role' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPatientBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: 'Invalid accommodation parameters', details: parsed.error.issues } }, { status: 400 });
    }

    const { caseId, hostelId, checkIn, checkOut, roomType } = parsed.data;

    // Verify patient owns this case
    const patient = await prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: { message: 'Patient profile not found' } }, { status: 404 });
    }

    const targetCase = await prisma.case.findFirst({
      where: {
        id: caseId,
        patientId: patient.id,
      },
    });

    if (!targetCase) {
      return NextResponse.json({ success: false, error: { message: 'Active case not found or unauthorized' } }, { status: 404 });
    }

    // Create booking in PENDING status for coordinator review
    const booking = await prisma.accommodationBooking.create({
      data: {
        caseId,
        hostelId,
        checkIn,
        checkOut,
        roomType,
        status: 'PENDING',
      },
      include: {
        hostel: true,
      },
    });

    return NextResponse.json({ success: true, data: { booking } });
  } catch (err) {
    console.error('Failed to request patient accommodation booking:', err);
    return NextResponse.json({ success: false, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
