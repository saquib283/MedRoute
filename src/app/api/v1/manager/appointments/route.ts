import { NextResponse } from 'next/server';
import { AppointmentMode, AppointmentStatus, AppointmentType } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const optionalMeetingUrlSchema = z
  .union([z.string().trim().url('Invalid video meeting URL').max(500), z.literal('')])
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const optionalInterpreterLanguageSchema = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const createAppointmentSchema = z.object({
  caseId: z.string(),
  patientId: z.string(),
  hospitalId: z.string(),
  doctorId: z.string(),
  appointmentType: z.nativeEnum(AppointmentType),
  mode: z.nativeEnum(AppointmentMode).optional(),
  meetingUrl: optionalMeetingUrlSchema,
  interpreterLanguage: optionalInterpreterLanguageSchema,
  scheduledAt: z
    .string()
    .transform((val) => new Date(val))
    .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
});

const updateAppointmentSchema = z.object({
  appointmentId: z.string(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  mode: z.nativeEnum(AppointmentMode).optional(),
  meetingUrl: optionalMeetingUrlSchema,
  interpreterLanguage: optionalInterpreterLanguageSchema,
  scheduledAt: z
    .string()
    .transform((val) => new Date(val))
    .refine((d) => !isNaN(d.getTime()), 'Invalid date')
    .optional(),
  cancellationReason: z.string().optional(),
  clinicalNotes: z.string().max(10000).optional(),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const meta = searchParams.get('meta') === 'true';

    if (meta) {
      const [hospitals, doctors, patients] = await Promise.all([
        prisma.hospital.findMany({ where: { isActive: true } }),
        prisma.doctor.findMany({
          where: { isActive: true },
          include: {
            specialisation: true,
          },
        }),
        prisma.patient.findMany({
          where: userRole === 'ADMIN' ? {} : { assignedManagerId: userId },
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

      return NextResponse.json({ hospitals, doctors, patients });
    }

    const appointments = await prisma.appointment.findMany({
      where:
        userRole === 'ADMIN'
          ? {}
          : {
              case: {
                managerId: userId,
              },
            },
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
        doctor: {
          select: {
            fullName: true,
            specialisation: {
              select: {
                name: true,
              },
            },
          },
        },
        hospital: {
          select: {
            name: true,
            city: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('Failed to load appointments roster:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const {
      caseId,
      patientId,
      hospitalId,
      doctorId,
      appointmentType,
      mode,
      meetingUrl,
      interpreterLanguage,
      scheduledAt,
    } = parsed.data;

    // Verify manager controls this case
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord || (userRole === 'MANAGER' && caseRecord.managerId !== userId)) {
      return NextResponse.json({ error: 'Case not found or unauthorized' }, { status: 404 });
    }

    if (caseRecord.patientId !== patientId) {
      return NextResponse.json({ error: 'Case does not belong to the specified patient' }, { status: 400 });
    }

    if (caseRecord.status === 'CLOSED') {
      return NextResponse.json({ error: 'Cannot schedule an appointment for a closed case' }, { status: 400 });
    }

    const [doctor, hospital] = await Promise.all([
      prisma.doctor.findUnique({ where: { id: doctorId } }),
      prisma.hospital.findUnique({ where: { id: hospitalId } }),
    ]);

    if (!doctor || !hospital || !doctor.isActive || !hospital.isActive || doctor.hospitalId !== hospitalId) {
      return NextResponse.json(
        { error: 'Selected doctor or hospital is inactive or mismatched' },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        caseId,
        patientId,
        hospitalId,
        doctorId,
        appointmentType,
        mode: mode ?? AppointmentMode.IN_PERSON,
        meetingUrl: meetingUrl ?? null,
        interpreterLanguage: interpreterLanguage ?? null,
        scheduledAt,
        status: 'SCHEDULED',
        createdBy: userId,
      },
      include: {
        doctor: true,
        hospital: true,
      },
    });

    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    console.error('Failed to schedule appointment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const {
      appointmentId,
      status,
      mode,
      meetingUrl,
      interpreterLanguage,
      scheduledAt,
      cancellationReason,
      clinicalNotes,
    } = parsed.data;

    // Verify appointment belongs to a case managed by this manager (ADMIN exempt)
    const appointmentRecord = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        case: true,
      },
    });

    if (!appointmentRecord || (userRole === 'MANAGER' && appointmentRecord.case.managerId !== userId)) {
      return NextResponse.json({ error: 'Appointment not found or unauthorized' }, { status: 404 });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(status !== undefined && { status }),
        ...(mode !== undefined && { mode }),
        ...(meetingUrl !== undefined && { meetingUrl }),
        ...(interpreterLanguage !== undefined && { interpreterLanguage }),
        ...(scheduledAt !== undefined && { scheduledAt }),
        ...(cancellationReason !== undefined && { cancellationReason }),
        ...(clinicalNotes !== undefined && { clinicalNotes }),
      },
    });

    return NextResponse.json({ success: true, appointment: updatedAppointment });
  } catch (err) {
    console.error('Failed to reschedule or cancel appointment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
