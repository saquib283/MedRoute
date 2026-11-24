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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    document: {
      create: jest.fn(),
      update: jest.fn(),
    },
    clinicalStep: {
      updateMany: jest.fn(),
    },
    fitToFlyClearance: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/document-storage.service', () => ({
  saveGeneratedBuffer: jest.fn().mockResolvedValue({
    storageKey: 'cert_test_ftf.pdf',
    fileSize: 1024,
  }),
  saveValidatedUpload: jest.fn(),
  removeStoredFile: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/auth/crypto';
import { validateFitToFlySafetyChecklist } from '@/lib/validation/lifecycle-schemas';
import { GET as getDoctorDashboard } from '@/app/api/v1/doctor/dashboard/route';
import {
  GET as getDoctorAppointments,
  PUT as updateDoctorAppointment,
} from '@/app/api/v1/doctor/appointments/route';
import { GET as getDoctorPatients } from '@/app/api/v1/doctor/patients/route';
import { GET as getCasePathway } from '@/app/api/v1/cases/[id]/pathway/route';
import { PUT as updateCaseFitToFly } from '@/app/api/v1/cases/[id]/fit-to-fly/route';

const mockedPrisma = prisma as unknown as {
  doctor: Record<string, jest.Mock>;
  appointment: Record<string, jest.Mock>;
  patient: Record<string, jest.Mock>;
  case: Record<string, jest.Mock>;
  document: Record<string, jest.Mock>;
  clinicalStep: Record<string, jest.Mock>;
  fitToFlyClearance: Record<string, jest.Mock>;
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
    mockedPrisma.appointment.findMany.mockResolvedValueOnce([
      {
        id: 'appt-1',
        caseId: 'case-1',
        appointmentType: 'PRE_OP_ASSESSMENT',
        scheduledAt: new Date('2026-11-24T10:00:00.000Z'),
        status: 'CONFIRMED',
        patient: { user: { fullName: 'Tariq Al-Said' }, nationality: 'Oman' },
        case: { id: 'case-1', status: 'WARD_RECOVERY', isUrgent: true },
      },
    ]);
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

describe('Task 6: Pre-Travel Doctor Triage & IATA MEDIF Fit-to-Fly Safety Checklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.doctor.findUnique.mockResolvedValue({
      id: 'seed-doctor-001',
      userId: 'doc-u-1',
      fullName: 'Dr. Ashok Seth',
      qualification: 'MBBS, MD, DM (Cardiology)',
      isActive: true,
      hospital: { name: 'Fortis Escorts Heart Institute', city: 'New Delhi' },
      specialisation: { name: 'Cardiology' },
    });
  });

  it('includes UNDER_REVIEW pre-travel cases & patients assigned via primaryDoctorId even with zero Appointment rows, and masks travelLogistics/passports', async () => {
    mockedPrisma.appointment.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockedPrisma.appointment.findMany.mockResolvedValue([]);

    const encryptedAttendantPassport = encrypt('M9876543');
    mockedPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-pretravel-1',
        status: 'UNDER_REVIEW',
        isUrgent: false,
        primaryDoctorId: 'seed-doctor-001',
        travelLogistics: {
          attendants: [
            {
              fullName: 'Salim Al-Harthy',
              passportNo: encryptedAttendantPassport,
              relation: 'Brother',
            },
          ],
        },
        patient: {
          nationality: 'Oman',
          passportNo: encrypt('P11223344'),
          user: { fullName: 'Omar Al-Harthy' },
        },
        clinicalSteps: [
          {
            id: 'step-mdt-1',
            title: 'Specialist Triage & Multi-Disciplinary Case Review',
            status: 'IN_PROGRESS',
            requiredRole: 'DOCTOR',
          },
        ],
        fitToFlyClearance: null,
      },
    ]);

    const dashReq = new NextRequest('http://localhost/api/v1/doctor/dashboard', {
      headers: docHeaders,
    });
    const dashRes = await getDoctorDashboard(dashReq);
    const dashJson = await dashRes.json();

    expect(dashRes.status).toBe(200);
    expect(dashJson.data.metrics.activeCases).toBe(1);
    expect(dashJson.data.pendingClinicalCases).toHaveLength(1);
    expect(dashJson.data.pendingClinicalCases[0].id).toBe('case-pretravel-1');
    expect(dashJson.data.pendingClinicalCases[0].status).toBe('UNDER_REVIEW');
    expect(
      dashJson.data.pendingClinicalCases[0].travelLogistics.attendants[0].passportNo
    ).toBe('****6543');
    expect(dashJson.data.pendingClinicalCases[0].patient.passportNo).toBe('*****3344');

    mockedPrisma.patient.findMany.mockResolvedValue([
      {
        id: 'pat-pretravel-1',
        nationality: 'Oman',
        passportNo: encrypt('P11223344'),
        user: {
          fullName: 'Omar Al-Harthy',
          email: 'omar@afzalhealthcare.in',
          phone: '+96891234567',
        },
        medicalProfile: {
          allergies: '[]',
          medications: '[]',
          surgeries: '[]',
          chronicConditions: '["Coronary Artery Disease"]',
        },
        cases: [
          {
            id: 'case-pretravel-1',
            status: 'UNDER_REVIEW',
            isUrgent: false,
            fitToFlyClearance: null,
          },
        ],
      },
    ]);

    const patReq = new NextRequest('http://localhost/api/v1/doctor/patients', {
      headers: docHeaders,
    });
    const patRes = await getDoctorPatients(patReq);
    const patJson = await patRes.json();

    expect(patRes.status).toBe(200);
    expect(patJson.data.patients).toHaveLength(1);
    expect(patJson.data.patients[0].id).toBe('pat-pretravel-1');
    expect(patJson.data.patients[0].passportNo).toBe('*****3344');
    expect(patJson.data.patients[0].medicalProfile.chronicConditions).toEqual([
      'Coronary Artery Disease',
    ]);

    mockedPrisma.case.findUnique.mockResolvedValue({
      id: 'case-pretravel-1',
      patientId: 'pat-pretravel-1',
      managerId: 'mgr-1',
      primaryDoctorId: 'seed-doctor-001',
      status: 'UNDER_REVIEW',
      travelLogistics: {
        attendants: [
          {
            fullName: 'Salim Al-Harthy',
            passportNo: encryptedAttendantPassport,
            relation: 'Brother',
          },
        ],
      },
      patient: {
        id: 'pat-pretravel-1',
        userId: 'pat-u-pretravel',
        nationality: 'Oman',
        passportNo: encrypt('P11223344'),
        user: {
          fullName: 'Omar Al-Harthy',
          email: 'omar@afzalhealthcare.in',
          phone: '+96891234567',
        },
        medicalProfile: null,
      },
      hospital: {
        id: 'seed-hospital-001',
        name: 'Fortis Escorts Heart Institute',
        city: 'New Delhi',
        address: 'Okhla Road',
        accreditation: 'NABH, JCI',
      },
      primaryDoctor: {
        id: 'seed-doctor-001',
        userId: 'doc-u-1',
        fullName: 'Dr. Ashok Seth',
        qualification: 'MBBS, MD',
        specialisation: { id: 'spec-1', name: 'Cardiology' },
      },
      clinicalSteps: [
        {
          id: 'step-mdt-1',
          title: 'Specialist Triage & Multi-Disciplinary Case Review',
          status: 'IN_PROGRESS',
          requiredRole: 'DOCTOR',
        },
      ],
      fitToFlyClearance: null,
    });

    const pathwayReq = new NextRequest('http://localhost/api/v1/cases/case-pretravel-1/pathway', {
      headers: docHeaders,
    });
    const pathwayRes = await getCasePathway(pathwayReq, {
      params: Promise.resolve({ id: 'case-pretravel-1' }),
    });
    const pathwayJson = await pathwayRes.json();

    expect(pathwayRes.status).toBe(200);
    expect(pathwayJson.data.case.id).toBe('case-pretravel-1');
    expect(pathwayJson.data.case.patient.passportNo).toBe('*****3344');
    expect(pathwayJson.data.case.travelLogistics.attendants[0].passportNo).toBe('****6543');
  });

  it('validateFitToFlySafetyChecklist blocks clearance if wound or trapped-gas check fails', () => {
    const unsafeGas = validateFitToFlySafetyChecklist(true, {
      woundStable: true,
      noTrappedGasRisk: false,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    });
    expect(unsafeGas.ok).toBe(false);

    const unsafeWound = validateFitToFlySafetyChecklist(true, {
      woundStable: false,
      noTrappedGasRisk: true,
      cardioRespiratoryStable: true,
      hemoglobinCleared: true,
      dvtProphylaxisPlan: true,
    });
    expect(unsafeWound.ok).toBe(false);
  });

  it('PUT /api/v1/cases/[id]/fit-to-fly rejects isCleared=true when woundStable=false or noTrappedGasRisk=false, succeeds when all 5 pass, and clears empty fields to null', async () => {
    const expectedSafetyMessage =
      'All physiological safety criteria must be confirmed to certify Fit-to-Fly clearance';

    for (const unsafeChecklist of [
      {
        woundStable: false,
        noTrappedGasRisk: true,
        cardioRespiratoryStable: true,
        hemoglobinCleared: true,
        dvtProphylaxisPlan: true,
      },
      {
        woundStable: true,
        noTrappedGasRisk: false,
        cardioRespiratoryStable: true,
        hemoglobinCleared: true,
        dvtProphylaxisPlan: true,
      },
    ]) {
      const unsafeReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
        method: 'PUT',
        headers: { ...docHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          isCleared: true,
          restrictions: 'Wheelchair assistance requested',
          ssrCode: 'WCHR',
          requiresMedif: true,
          flightNumber: 'EK511',
          departureDate: '2026-12-10T10:00:00.000Z',
          checklist: unsafeChecklist,
        }),
      });

      const unsafeRes = await updateCaseFitToFly(unsafeReq, {
        params: Promise.resolve({ id: 'case-1' }),
      });
      const unsafeJson = await unsafeRes.json();
      expect(unsafeRes.status).toBe(400);
      expect(unsafeJson.error.code).toBe('BAD_REQUEST');
      expect(unsafeJson.error.message).toContain(expectedSafetyMessage);
    }

    mockedPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      patientId: 'pat-1',
      managerId: 'mgr-1',
      primaryDoctorId: 'seed-doctor-001',
      status: 'OUTPATIENT_RECUPERATION',
      postReturnFollowUps: [],
      patient: {
        id: 'pat-1',
        userId: 'pat-u-1',
        nationality: 'UAE',
        passportNo: encrypt('A12345678'),
        passportExpiry: new Date('2028-01-01T00:00:00.000Z'),
        user: { fullName: 'Ranya Al-Hassan', email: 'patient@afzalhealthcare.in', phone: '+971501234567' },
        medicalProfile: null,
      },
      hospital: {
        id: 'seed-hospital-001',
        name: 'Fortis Escorts Heart Institute',
        city: 'New Delhi',
        address: 'Okhla Road',
        accreditation: 'NABH, JCI',
      },
      primaryDoctor: {
        id: 'seed-doctor-001',
        userId: 'doc-u-1',
        fullName: 'Dr. Ashok Seth',
        qualification: 'MBBS, MD',
        specialisation: { id: 'spec-1', name: 'Cardiology' },
      },
      clinicalSteps: [],
      fitToFlyClearance: null,
    });
    mockedPrisma.document.create.mockResolvedValue({ id: 'doc-ftf-1' });
    mockedPrisma.document.update.mockResolvedValue({
      id: 'doc-ftf-1',
      fileName: 'fit_to_fly_certificate_case-1.pdf',
      fileUrl: '/api/v1/documents/doc-ftf-1/download',
    });
    mockedPrisma.clinicalStep.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.fitToFlyClearance.upsert.mockResolvedValue({
      id: 'ftf-1',
      caseId: 'case-1',
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth',
      ssrCode: 'WCHR',
      requiresMedif: true,
      flightNumber: 'EK511',
      checklist: {
        woundStable: true,
        noTrappedGasRisk: true,
        cardioRespiratoryStable: true,
        hemoglobinCleared: true,
        dvtProphylaxisPlan: true,
      },
    });
    mockedPrisma.case.update.mockResolvedValue({
      id: 'case-1',
      status: 'FIT_TO_FLY_CLEARED',
    });

    const validReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
      method: 'PUT',
      headers: { ...docHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        isCleared: true,
        restrictions: 'Wheelchair assistance requested',
        ssrCode: 'WCHR',
        requiresMedif: true,
        flightNumber: 'EK511',
        departureDate: '2026-12-10T10:00:00.000Z',
        checklist: {
          woundStable: true,
          noTrappedGasRisk: true,
          cardioRespiratoryStable: true,
          hemoglobinCleared: true,
          dvtProphylaxisPlan: true,
        },
      }),
    });

    const validRes = await updateCaseFitToFly(validReq, {
      params: Promise.resolve({ id: 'case-1' }),
    });
    const validJson = await validRes.json();
    expect(validRes.status).toBe(200);
    expect(validJson.data.caseStatus).toBe('FIT_TO_FLY_CLEARED');
    expect(validJson.data.fitToFlyClearance.ssrCode).toBe('WCHR');
    expect(validJson.data.fitToFlyClearance.requiresMedif).toBe(true);

    // Verify clearing optional fields via multipart FormData persists null (not skipped)
    const clearForm = new FormData();
    clearForm.append('isCleared', 'false');
    clearForm.append('ssrCode', 'NONE');
    clearForm.append('requiresMedif', 'false');
    clearForm.append('flightNumber', '');
    clearForm.append('departureDate', '');
    clearForm.append('restrictions', '');
    clearForm.append('reEvalDate', '');

    const clearReq = new NextRequest('http://localhost/api/v1/cases/case-1/fit-to-fly', {
      method: 'PUT',
      headers: docHeaders,
      body: clearForm,
    });

    const clearRes = await updateCaseFitToFly(clearReq, {
      params: Promise.resolve({ id: 'case-1' }),
    });
    expect(clearRes.status).toBe(200);
    expect(mockedPrisma.fitToFlyClearance.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isCleared: false,
          restrictions: null,
          reEvalDate: null,
          flightNumber: null,
          departureDate: null,
        }),
      })
    );
  });
});
