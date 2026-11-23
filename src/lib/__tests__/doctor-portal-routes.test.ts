import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    doctor: {
      findUnique: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findMany: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { GET as getDoctorDashboard } from '@/app/api/v1/doctor/dashboard/route';
import {
  GET as getDoctorAppointments,
  PUT as updateDoctorAppointment,
} from '@/app/api/v1/doctor/appointments/route';
import { GET as getDoctorPatients } from '@/app/api/v1/doctor/patients/route';

const mockedPrisma = prisma as unknown as {
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  case: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
};

const docHeaders = {
  'x-user-id': 'doc-u-1',
  'x-user-email': 'doctor@afzalhealthcare.in',
  'x-user-role': 'DOCTOR',
};

describe('Task 5: Doctor Portal API Enhancements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'seed-doctor-001',
      userId: 'doc-u-1',
      fullName: 'Dr. Ashok Seth',
      qualification: 'MBBS, MD, DM (Cardiology)',
      isActive: true,
      hospital: { name: 'Apollo Hospital', city: 'New Delhi' },
      specialisation: { name: 'Cardiology' },
    });
  });

  it('returns activeCases, upcomingSchedule, and pendingClinicalCases on GET /api/v1/doctor/dashboard', async () => {
    mockedPrisma.appointment.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockedPrisma.appointment.findMany
      .mockResolvedValueOnce([
        {
          id: 'appt-1',
          caseId: 'case-1',
          appointmentType: 'PRE_OP_ASSESSMENT',
          scheduledAt: new Date('2026-11-24T10:00:00.000Z'),
          status: 'CONFIRMED',
          patient: { user: { fullName: 'Tariq Al-Said' }, nationality: 'Oman' },
          case: { id: 'case-1', status: 'WARD_RECOVERY', isUrgent: true },
        },
      ])
      .mockResolvedValueOnce([{ caseId: 'case-1' }]);
    mockedPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        status: 'WARD_RECOVERY',
        isUrgent: true,
        patient: { user: { fullName: 'Tariq Al-Said' }, nationality: 'Oman' },
        clinicalSteps: [{ id: 's-1', title: 'Sign Fit-to-Fly', status: 'PENDING', requiredRole: 'DOCTOR' }],
        fitToFlyClearance: null,
      },
    ]);

    const req = new NextRequest('http://localhost/api/v1/doctor/dashboard', { headers: docHeaders });
    const res = await getDoctorDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.doctorProfile.hospital).toEqual({ name: 'Apollo Hospital', city: 'New Delhi' });
    expect(json.data.doctorProfile.specialisation).toEqual({ name: 'Cardiology' });
    expect(json.data.metrics.activeCases).toBe(1);
    expect(json.data.upcomingSchedule).toHaveLength(1);
    expect(json.data.pendingClinicalCases).toHaveLength(1);
  });

  it('includes patient active cases on GET /api/v1/doctor/patients and writes AuditLog on PUT /api/v1/doctor/appointments', async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([{ patientId: 'pat-1' }]);
    mockedPrisma.patient.findMany.mockResolvedValue([
      {
        id: 'pat-1',
        nationality: 'Oman',
        passportNo: 'A1234567',
        user: { fullName: 'Tariq Al-Said', email: 't@example.com', phone: '+968123456' },
        medicalProfile: {
          allergies: '["Penicillin"]',
          medications: '[]',
          surgeries: '[]',
          chronicConditions: '[]',
        },
        cases: [{ id: 'case-1', status: 'WARD_RECOVERY', isUrgent: false, fitToFlyClearance: null }],
      },
    ]);

    const patReq = new NextRequest('http://localhost/api/v1/doctor/patients', { headers: docHeaders });
    const patRes = await getDoctorPatients(patReq);
    const patJson = await patRes.json();
    expect(patRes.status).toBe(200);
    expect(patJson.data.patients[0].cases).toHaveLength(1);
    expect(patJson.data.patients[0].medicalProfile.allergies).toEqual(['Penicillin']);
    expect(mockedPrisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          cases: expect.any(Object),
        }),
      })
    );

    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: 'appt-1',
      doctorId: 'seed-doctor-001',
      status: 'CONFIRMED',
      clinicalNotes: null,
    });
    mockedPrisma.appointment.update.mockResolvedValue({
      id: 'appt-1',
      status: 'COMPLETED',
      clinicalNotes: 'Hemodynamics stable post-PCI.',
    });

    const putReq = new NextRequest('http://localhost/api/v1/doctor/appointments?id=appt-1', {
      method: 'PUT',
      headers: { ...docHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'COMPLETED',
        clinicalNotes: 'Hemodynamics stable post-PCI.',
      }),
    });
    const putRes = await updateDoctorAppointment(putReq);
    expect(putRes.status).toBe(200);
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'doc-u-1',
          action: 'STATUS_CHANGE',
          entityType: 'Appointment',
          entityId: 'appt-1',
        }),
      })
    );
  });

  it('includes hospital on GET /api/v1/doctor/appointments and accepts RESCHEDULED with UPDATE audit on notes-only change', async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-2',
        caseId: 'case-1',
        status: 'RESCHEDULED',
        hospital: { name: 'Apollo Hospital', city: 'New Delhi' },
      },
    ]);

    const getReq = new NextRequest('http://localhost/api/v1/doctor/appointments?filter=upcoming', {
      headers: docHeaders,
    });
    const getRes = await getDoctorAppointments(getReq);
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.data.appointments[0].hospital.name).toBe('Apollo Hospital');
    expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          hospital: { select: { name: true, city: true } },
        }),
      })
    );

    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: 'appt-2',
      doctorId: 'seed-doctor-001',
      status: 'RESCHEDULED',
      clinicalNotes: 'Old notes',
    });
    mockedPrisma.appointment.update.mockResolvedValue({
      id: 'appt-2',
      status: 'RESCHEDULED',
      clinicalNotes: 'Updated assessment notes',
    });

    const putReq = new NextRequest('http://localhost/api/v1/doctor/appointments?id=appt-2', {
      method: 'PUT',
      headers: { ...docHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'RESCHEDULED',
        clinicalNotes: 'Updated assessment notes',
      }),
    });
    const putRes = await updateDoctorAppointment(putReq);
    expect(putRes.status).toBe(200);
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE',
          entityType: 'Appointment',
          entityId: 'appt-2',
        }),
      })
    );
  });
});
