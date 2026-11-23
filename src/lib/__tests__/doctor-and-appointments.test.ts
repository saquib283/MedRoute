import { NextRequest } from 'next/server';
import { hasPermission } from '@/lib/auth/rbac';
import { AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import {
  formatDoctorDisplayName,
  isDoctorAvailableOnDate,
} from '@/lib/validation/booking-helpers';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    doctor: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hospital: {
      findUnique: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/lib/prisma';
import {
  GET as listDoctorsAdmin,
  POST as createDoctorAdmin,
  PUT as updateDoctorAdmin,
} from '@/app/api/v1/admin/doctors/route';
import {
  POST as requestPatientAppointment,
  PUT as cancelPatientAppointment,
} from '@/app/api/v1/patient/appointments/route';
import { PUT as updateManagerAppointment } from '@/app/api/v1/manager/appointments/route';
import { PUT as updateAdminAppointment } from '@/app/api/v1/admin/appointments/route';

const mockedPrisma = prisma as unknown as {
  user: Record<string, jest.Mock>;
  doctor: Record<string, jest.Mock>;
  hospital: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  case: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

describe('Task 1: Doctor RBAC, Provisioning & Appointment Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants clinical permissions to DOCTOR and exposes Sub-project 2 audit actions', () => {
    expect(hasPermission('DOCTOR', 'view:case')).toBe(true);
    expect(hasPermission('DOCTOR', 'sign:clinical-pathway')).toBe(true);
    expect(hasPermission('DOCTOR', 'sign:fit-to-fly')).toBe(true);
    expect(hasPermission('DOCTOR', 'issue:documents')).toBe(true);
    expect(hasPermission('DOCTOR', 'verify:documents')).toBe(false);
    expect(hasPermission('MANAGER', 'verify:documents')).toBe(true);
    expect(AUDIT_ACTIONS.CONFIGURE_PATHWAY).toBe('CONFIGURE_PATHWAY');
    expect(AUDIT_ACTIONS.SIGN_FIT_TO_FLY).toBe('SIGN_FIT_TO_FLY');
  });

  it('formats doctor display names without duplicating Dr. prefix and checks availableDays', () => {
    expect(formatDoctorDisplayName('Dr. Ashok Seth')).toBe('Dr. Ashok Seth');
    expect(formatDoctorDisplayName('dr. Priya Nair')).toBe('Dr. Priya Nair');
    expect(formatDoctorDisplayName('Ramesh Kumar')).toBe('Dr. Ramesh Kumar');

    // 2026-11-23 is a Monday (UTC day 1 -> MON)
    const monday = new Date('2026-11-23T10:00:00.000Z');
    const sunday = new Date('2026-11-22T10:00:00.000Z');
    expect(isDoctorAvailableOnDate(['MON', 'WED', 'FRI'], monday)).toBe(true);
    expect(isDoctorAvailableOnDate(['MON', 'WED', 'FRI'], sunday)).toBe(false);
    expect(isDoctorAvailableOnDate([], sunday)).toBe(true);
  });

  it('provisions a new DOCTOR User + Doctor profile atomically when createAccount=true', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'usr-doc-1',
            email: 'newdoc@afzalhealthcare.in',
            role: 'DOCTOR',
          }),
        },
        doctor: {
          create: jest.fn().mockResolvedValue({
            id: 'doc-1',
            fullName: 'Dr. Meera Rao',
            hospitalId: 'hosp-1',
            userId: 'usr-doc-1',
          }),
        },
      })
    );

    const req = new NextRequest('http://localhost/api/v1/admin/doctors', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@afzalhealthcare.in',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        fullName: 'Dr. Meera Rao',
        hospitalId: 'hosp-1',
        specialisationId: 'spec-1',
        createAccount: true,
        email: 'newdoc@afzalhealthcare.in',
        password: 'DoctorPassword123!',
      }),
    });

    const res = await createDoctorAdmin(req);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.doctor.userId).toBe('usr-doc-1');
  });

  it('blocks PATIENT from directly self-booking SURGERY and enforces doctor availableDays', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });

    const surgeryReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        caseId: 'case-1',
        hospitalId: 'hosp-1',
        doctorId: 'doc-1',
        appointmentType: 'SURGERY',
        scheduledAt: '2026-11-23T10:00:00.000Z',
      }),
    });

    const surgeryRes = await requestPatientAppointment(surgeryReq);
    expect(surgeryRes.status).toBe(400);

    // Unavailable day (Sunday when doctor only works MON)
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      patientId: 'pat-1',
      status: 'PLAN_CONFIRMED',
    });
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      hospitalId: 'hosp-1',
      isActive: true,
      availableDays: ['MON'],
    });
    mockedPrisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1', isActive: true });

    const unavailableReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        caseId: 'case-1',
        hospitalId: 'hosp-1',
        doctorId: 'doc-1',
        appointmentType: 'CONSULTATION',
        scheduledAt: '2026-11-29T10:00:00.000Z',
      }),
    });

    const unavailableRes = await requestPatientAppointment(unavailableReq);
    const unavailableJson = await unavailableRes.json();
    expect(unavailableRes.status).toBe(400);
    expect(unavailableJson.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('allows PATIENT self-cancellation with reason and exempts ADMIN on PUT /api/v1/manager/appointments', async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1', userId: 'u-pat-1' });
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      id: 'appt-1',
      patientId: 'pat-1',
      status: 'SCHEDULED',
    });
    mockedPrisma.appointment.update.mockResolvedValueOnce({
      id: 'appt-1',
      status: 'CANCELLED',
      cancellationReason: 'Flight delayed',
    });

    const cancelReq = new NextRequest('http://localhost/api/v1/patient/appointments', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'u-pat-1',
        'x-user-email': 'p@example.com',
        'x-user-role': 'PATIENT',
      },
      body: JSON.stringify({
        appointmentId: 'appt-1',
        cancellationReason: 'Flight delayed',
      }),
    });

    const cancelRes = await cancelPatientAppointment(cancelReq);
    expect(cancelRes.status).toBe(200);

    // Admin updating an appointment whose case belongs to a different manager
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      id: 'appt-2',
      status: 'CONFIRMED',
      case: { id: 'case-1', managerId: 'mgr-other' },
    });
    mockedPrisma.appointment.update.mockResolvedValueOnce({
      id: 'appt-2',
      status: 'COMPLETED',
      clinicalNotes: 'Procedure successful',
    });

    const adminPutReq = new Request('http://localhost/api/v1/manager/appointments', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        appointmentId: 'appt-2',
        status: 'COMPLETED',
        clinicalNotes: 'Procedure successful',
      }),
    });

    const adminPutRes = await updateManagerAppointment(adminPutReq);
    expect(adminPutRes.status).toBe(200);
  });

  it('lists unlinked DOCTOR users when meta=true, supports linking/creating via PUT, and persists admin clinicalNotes', async () => {
    mockedPrisma.doctor.findMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        fullName: 'Dr. Ashok Seth',
        hospitalId: 'hosp-1',
        specialisationId: 'spec-1',
        userId: null,
        hospital: { id: 'hosp-1', name: 'Fortis Escorts', city: 'New Delhi' },
        specialisation: { id: 'spec-1', name: 'Cardiology' },
        user: null,
        _count: { appointments: 0 },
      },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'u-doc-free', email: 'free@hospital.in', fullName: 'Dr. Free' },
    ]);

    const metaReq = new NextRequest('http://localhost/api/v1/admin/doctors?meta=true', {
      headers: {
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@afzalhealthcare.in',
        'x-user-role': 'ADMIN',
      },
    });
    const metaRes = await listDoctorsAdmin(metaReq);
    const metaJson = await metaRes.json();
    expect(metaRes.status).toBe(200);
    expect(metaJson.data.unlinkedDoctorUsers).toHaveLength(1);

    // PUT /api/v1/admin/doctors linking an existing DOCTOR user that is already taken -> 409
    mockedPrisma.doctor.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      fullName: 'Dr. Ashok Seth',
      hospitalId: 'hosp-1',
      specialisationId: 'spec-1',
      userId: null,
      isActive: true,
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u-doc-taken', role: 'DOCTOR' });
    mockedPrisma.doctor.findFirst.mockResolvedValueOnce({ id: 'doc-other' });

    const conflictPutReq = new NextRequest('http://localhost/api/v1/admin/doctors', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@afzalhealthcare.in',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        id: 'doc-1',
        userId: 'u-doc-taken',
      }),
    });
    const conflictPutRes = await updateDoctorAdmin(conflictPutReq);
    expect(conflictPutRes.status).toBe(409);

    // PUT /api/v1/admin/appointments persists clinicalNotes
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      id: 'appt-3',
      status: 'CONFIRMED',
      scheduledAt: new Date('2026-11-25T10:00:00.000Z'),
    });
    mockedPrisma.appointment.update.mockResolvedValueOnce({
      id: 'appt-3',
      status: 'COMPLETED',
      clinicalNotes: 'Cleared for surgery',
    });

    const adminApptPutReq = new NextRequest('http://localhost/api/v1/admin/appointments', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@afzalhealthcare.in',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        id: 'appt-3',
        status: 'COMPLETED',
        clinicalNotes: 'Cleared for surgery',
      }),
    });
    const adminApptPutRes = await updateAdminAppointment(adminApptPutReq);
    const adminApptPutJson = await adminApptPutRes.json();
    expect(adminApptPutRes.status).toBe(200);
    expect(adminApptPutJson.data.appointment.clinicalNotes).toBe('Cleared for surgery');
  });
});
