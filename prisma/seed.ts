/**
 * Afzal Healthcare — Database Seed Script
 * Seeds specialisations, test users, and sample partner data.
 * Run with: npx tsx prisma/seed.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { DocumentCategory, LeadActivityType, LeadSource, LeadStatus, Prisma, PrismaClient, UrgencyLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from '../src/lib/auth/crypto';
import { encryptMedicalProfile } from '../src/lib/api/phi-encryption';
import { DEFAULT_SYSTEM_SETTINGS } from '../src/lib/services/system-settings.service';
import { buildStandardMvtPathwaySteps } from '../src/lib/validation/lifecycle-schemas';
import {
  computeLeadFirstResponseDueAt,
  computeLeadScoreAndTemperature,
} from '../src/lib/validation/leads-crm-schemas';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const SAMPLE_PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. Specialisations ───────────────────────────────────────────
  console.log('Creating specialisations...');
  const specialisations = [
    { name: 'Cardiology', description: 'Heart and cardiovascular system' },
    { name: 'Orthopaedics', description: 'Bones, joints, and musculoskeletal system' },
    { name: 'Oncology', description: 'Cancer treatment and care' },
    { name: 'Neurology', description: 'Brain and nervous system' },
    { name: 'Ophthalmology', description: 'Eye care and surgery' },
    { name: 'Cosmetic Surgery', description: 'Aesthetic and reconstructive procedures' },
    { name: 'Dental', description: 'Dental care and oral surgery' },
    { name: 'Fertility', description: 'Reproductive medicine and IVF' },
    { name: 'Gastroenterology', description: 'Digestive system disorders' },
    { name: 'Urology', description: 'Urinary tract and male reproductive system' },
    { name: 'Nephrology', description: 'Kidney diseases and dialysis' },
    { name: 'Pulmonology', description: 'Lung and respiratory diseases' },
    { name: 'Dermatology', description: 'Skin diseases and cosmetic dermatology' },
    { name: 'ENT', description: 'Ear, nose, and throat' },
    { name: 'General Surgery', description: 'General surgical procedures' },
  ];

  for (const spec of specialisations) {
    await prisma.specialisation.upsert({
      where: { name: spec.name },
      update: {},
      create: spec,
    });
  }
  console.log(`  ✓ ${specialisations.length} specialisations created\n`);

  // ─── 2. Users ─────────────────────────────────────────────────────
  console.log('Creating users...');

  // Super Admin
  const adminPasswordHash = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@afzalhealthcare.in' },
    update: {},
    create: {
      email: 'admin@afzalhealthcare.in',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      fullName: 'Rahul Mehra',
      phone: '+919876543210',
    },
  });
  console.log(`  ✓ Admin: admin@afzalhealthcare.in / Admin@123`);

  // Manager
  const managerPasswordHash = await bcrypt.hash('Manager@123', BCRYPT_ROUNDS);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@afzalhealthcare.in' },
    update: {},
    create: {
      email: 'manager@afzalhealthcare.in',
      passwordHash: managerPasswordHash,
      role: 'MANAGER',
      fullName: 'Priya Sharma',
      phone: '+919876543211',
    },
  });
  console.log(`  ✓ Manager: manager@afzalhealthcare.in / Manager@123`);

  // Doctor
  const doctorPasswordHash = await bcrypt.hash('Doctor@123', BCRYPT_ROUNDS);
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@afzalhealthcare.in' },
    update: {
      role: 'DOCTOR',
      fullName: 'Dr. Ashok Seth',
    },
    create: {
      email: 'doctor@afzalhealthcare.in',
      passwordHash: doctorPasswordHash,
      role: 'DOCTOR',
      fullName: 'Dr. Ashok Seth',
      phone: '+919876543212',
    },
  });
  console.log(`  ✓ Doctor: doctor@afzalhealthcare.in / Doctor@123`);

  // Patient
  const patientPasswordHash = await bcrypt.hash('Patient@123', BCRYPT_ROUNDS);
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@afzalhealthcare.in' },
    update: {},
    create: {
      email: 'patient@afzalhealthcare.in',
      passwordHash: patientPasswordHash,
      role: 'PATIENT',
      fullName: 'Ranya Al-Hassan',
      phone: '+971501234567',
    },
  });

  // Create patient profile (encrypt ePHI fields)
  const encryptedPassportNo = encrypt('A12345678');
  const patientPassportExpiry = new Date('2028-06-15T00:00:00.000Z');
  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {
      passportNo: encryptedPassportNo,
      passportExpiry: patientPassportExpiry,
      assignedManagerId: manager.id,
    },
    create: {
      userId: patientUser.id,
      nationality: 'UAE',
      passportNo: encryptedPassportNo,
      passportExpiry: patientPassportExpiry,
      dob: new Date('1984-03-15'),
      bloodGroup: 'O+',
      medicalCondition: 'Cardiac evaluation required — suspected coronary artery disease',
      urgencyLevel: 'SEMI_URGENT',
      primaryLanguage: 'Arabic',
      emergencyContact: {
        name: 'Ahmed Al-Hassan',
        phone: '+971501234568',
        relation: 'Husband',
      },
      assignedManagerId: manager.id,
    },
  });

  // Create medical profile (encrypt ePHI fields)
  const encryptedMedicalProfile = encryptMedicalProfile({
    allergies: ['Penicillin', 'Sulfa drugs'],
    medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'Daily' }],
    surgeries: [{ name: 'Appendectomy', date: '2015-06-20', notes: 'Laparoscopic' }],
    chronicConditions: ['Hypertension', 'Type 2 Diabetes'],
    specialisationsRequired: ['Cardiology'],
  });

  const medicalProfileData = {
    allergies: encryptedMedicalProfile.allergies as Prisma.InputJsonValue,
    medications: encryptedMedicalProfile.medications as Prisma.InputJsonValue,
    surgeries: encryptedMedicalProfile.surgeries as Prisma.InputJsonValue,
    chronicConditions: encryptedMedicalProfile.chronicConditions as Prisma.InputJsonValue,
    specialisationsRequired: ['Cardiology'] as Prisma.InputJsonValue,
  };

  await prisma.patientMedicalProfile.upsert({
    where: { patientId: patient.id },
    update: medicalProfileData,
    create: {
      patientId: patient.id,
      ...medicalProfileData,
    },
  });
  console.log(`  ✓ Patient: patient@afzalhealthcare.in / Patient@123\n`);

  // ─── 3. Hospitals ─────────────────────────────────────────────────
  console.log('Creating hospitals...');

  const cardiologySpec = await prisma.specialisation.findUnique({
    where: { name: 'Cardiology' },
  });
  const orthoSpec = await prisma.specialisation.findUnique({
    where: { name: 'Orthopaedics' },
  });

  const hospital1 = await prisma.hospital.upsert({
    where: { id: 'seed-hospital-001' },
    update: {},
    create: {
      id: 'seed-hospital-001',
      name: 'Fortis Escorts Heart Institute',
      city: 'New Delhi',
      address: 'Okhla Road, Sukhdev Vihar, New Delhi, Delhi 110025',
      accreditation: 'NABH, JCI',
      contactPerson: 'Dr. Ashok Seth',
      commissionRate: 12.5,
      departments: ['Cardiology', 'Cardiac Surgery', 'Neurology', 'Orthopaedics'],
    },
  });

  const hospital2 = await prisma.hospital.upsert({
    where: { id: 'seed-hospital-002' },
    update: {},
    create: {
      id: 'seed-hospital-002',
      name: 'Medanta - The Medicity',
      city: 'Gurugram',
      address: 'CH Baktawar Singh Rd, Sector 38, Gurugram, Haryana 122001',
      accreditation: 'NABH, JCI',
      contactPerson: 'Dr. Naresh Trehan',
      commissionRate: 10.0,
      departments: ['Cardiology', 'Oncology', 'Gastroenterology', 'Pulmonology'],
    },
  });

  console.log(`  ✓ 2 hospitals created\n`);

  // ─── 4. Doctors ───────────────────────────────────────────────────
  console.log('Creating doctors...');

  if (cardiologySpec) {
    await prisma.doctor.upsert({
      where: { id: 'seed-doctor-001' },
      update: {
        userId: doctorUser.id,
      },
      create: {
        id: 'seed-doctor-001',
        userId: doctorUser.id,
        hospitalId: hospital1.id,
        fullName: 'Dr. Ashok Seth',
        specialisationId: cardiologySpec.id,
        qualification: 'MBBS, MD (Cardiology), FRCP',
        languages: ['English', 'Hindi'],
        consultationFee: 2500,
        availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      },
    });

    await prisma.doctor.upsert({
      where: { id: 'seed-doctor-002' },
      update: {},
      create: {
        id: 'seed-doctor-002',
        hospitalId: hospital2.id,
        fullName: 'Dr. Naresh Trehan',
        specialisationId: cardiologySpec.id,
        qualification: 'MBBS, MS (Surgery), FACS',
        languages: ['English', 'Hindi', 'Punjabi'],
        consultationFee: 3000,
        availableDays: ['MON', 'WED', 'FRI'],
      },
    });
  }

  if (orthoSpec) {
    await prisma.doctor.upsert({
      where: { id: 'seed-doctor-003' },
      update: {},
      create: {
        id: 'seed-doctor-003',
        hospitalId: hospital1.id,
        fullName: 'Dr. S.K. Rajan',
        specialisationId: orthoSpec.id,
        qualification: 'MBBS, MS (Ortho), MCh',
        languages: ['English', 'Hindi'],
        consultationFee: 2000,
        availableDays: ['TUE', 'THU', 'SAT'],
      },
    });
  }

  console.log(`  ✓ 3 doctors created\n`);

  // ─── 5. Sample Case & Clinical Workflow Steps ─────────────────────
  console.log('Creating sample clinical case & treatment steps...');
  const dayMs = 86400000;
  const inboundArrivalAt = new Date(Date.now() - 6 * dayMs);
  const outboundDepartureAt = new Date(Date.now() + 4 * dayMs);
  const formCSubmittedAt = new Date(inboundArrivalAt.getTime() + 6 * 3600000);

  const ranyaTreatmentPlan = {
    diagnosis: 'Symptomatic double-vessel coronary artery disease (LAD proximal stenosis)',
    procedureName: 'Percutaneous Coronary Intervention (PCI) with 2 Drug-Eluting Stents',
    specialty: 'Cardiology',
    hospitalLosDays: 3,
    recoveryStayDays: 7,
    estimatedCostUsd: 4850,
    depositRequiredUsd: 2000,
    currency: 'USD',
    inclusions: [
      'Cardiac catheterization suite & 2 drug-eluting stents',
      '24-hour CCU telemetry + 2 days private ward room',
      'Pre-anesthesia workup, medications during admission & airport pickup',
    ],
    exclusions: [
      'International return airfare & companion hotel meals',
      'Extended ICU stay beyond 48 hours if clinically required',
    ],
    doctorOpinionNotes:
      'Coronary angiogram confirms 85% proximal LAD lesion suitable for elective PCI. Continue Aspirin 81mg daily.',
    publishedAt: new Date(Date.now() - 12 * dayMs).toISOString(),
    publishedBy: doctorUser.id,
    consentAcceptedAt: new Date(Date.now() - 11 * dayMs).toISOString(),
    consentAcceptedBy: patientUser.id,
  };

  const ranyaTravelLogistics = {
    attendants: [
      {
        fullName: 'Ahmed Al-Hassan',
        passportNo: encrypt('M99887766'),
        relation: 'Husband',
      },
    ],
    arrivalAirline: 'Emirates',
    arrivalFlightNo: 'EK512',
    arrivalAt: inboundArrivalAt.toISOString(),
    arrivalAirport: 'Indira Gandhi International Airport (DEL)',
    airportPickupRequired: true,
    pickupConfirmed: true,
    pickupDriverNotes:
      'Hospital cardiac concierge vehicle + Arabic interpreter assigned at Terminal 3 Gate 4.',
    wheelchairSsrCode: 'WCHR',
    dietaryPreferences: 'Halal Low-Sodium',
    departureAirline: 'Emirates',
    departureFlightNo: 'EK511',
    departureAt: outboundDepartureAt.toISOString(),
    visaNumber: 'IND-MED-2026-44190',
    visaExpiryDate: new Date(Date.now() + 170 * dayMs).toISOString(),
    formCSubmittedAt: formCSubmittedAt.toISOString(),
    frroNumber: 'FRRO-DEL-2026-8812',
    updatedAt: new Date().toISOString(),
  };

  const ranyaFollowUps = [
    {
      milestone: 'DAY_7',
      dueAt: new Date(outboundDepartureAt.getTime() + 7 * dayMs).toISOString(),
      status: 'SUBMITTED',
      painScore: 2,
      woundStatus: 'Radial access site clean & dry, no hematoma',
      patientNotes:
        'Walking 15 minutes twice daily without angina or dyspnea. Taking DAPT medications as prescribed.',
      updatedAt: new Date().toISOString(),
    },
    {
      milestone: 'DAY_30',
      dueAt: new Date(outboundDepartureAt.getTime() + 30 * dayMs).toISOString(),
      status: 'PENDING',
    },
    {
      milestone: 'DAY_90',
      dueAt: new Date(outboundDepartureAt.getTime() + 90 * dayMs).toISOString(),
      status: 'PENDING',
    },
  ];

  const sampleCase = await prisma.case.upsert({
    where: { id: 'seed-case-001' },
    update: {
      hospitalId: hospital1.id,
      primaryDoctorId: 'seed-doctor-001',
      managerId: manager.id,
      status: 'WARD_RECOVERY',
      treatmentPlan: ranyaTreatmentPlan as unknown as Prisma.InputJsonValue,
      travelLogistics: ranyaTravelLogistics as unknown as Prisma.InputJsonValue,
      postReturnFollowUps: ranyaFollowUps as unknown as Prisma.InputJsonValue,
    },
    create: {
      id: 'seed-case-001',
      patientId: patient.id,
      managerId: manager.id,
      hospitalId: hospital1.id,
      primaryDoctorId: 'seed-doctor-001',
      status: 'WARD_RECOVERY',
      notes: 'Patient undergoing post-operative cardiac catheterization recovery and monitoring.',
      isUrgent: false,
      treatmentPlan: ranyaTreatmentPlan as unknown as Prisma.InputJsonValue,
      travelLogistics: ranyaTravelLogistics as unknown as Prisma.InputJsonValue,
      postReturnFollowUps: ranyaFollowUps as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.clinicalStep.deleteMany({ where: { caseId: sampleCase.id } });

  const clinicalStepsData = [
    {
      stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance',
      stageOrder: 1,
      stepOrder: 1,
      title: 'Inquiry & Initial Medical DICOM Review',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'UPLOAD_DOCS',
      requiredRole: 'PATIENT',
      doctorNotes: 'Coronary angiography scans and cardiac panel received. Referred to Senior Cardiologist.',
      completedAt: new Date(Date.now() - 14 * dayMs),
    },
    {
      stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance',
      stageOrder: 1,
      stepOrder: 2,
      title: 'Multi-Disciplinary Team (MDT) Board Clearance',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'VOTE_MDT',
      requiredRole: 'DOCTOR',
      decisionBranch: 'APPROVED_FOR_SURGERY',
      doctorNotes: 'MDT Board approves elective Percutaneous Coronary Intervention (PCI) with drug-eluting stent.',
      completedAt: new Date(Date.now() - 10 * dayMs),
    },
    {
      stageName: 'Stage 2: MDT Board & Pro-Forma Invoice',
      stageOrder: 2,
      stepOrder: 1,
      title: 'Pro-Forma Treatment Cost Estimate Generation',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'ISSUE_PROFORMA',
      requiredRole: 'MANAGER',
      doctorNotes: 'All-in quote ($4,850 USD) published and consented by patient prior to travel.',
      completedAt: new Date(Date.now() - 10 * dayMs),
    },
    {
      stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
      stageOrder: 3,
      stepOrder: 1,
      title: 'Official Hospital Visa Invitation Letter (VIL) Issuance',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'ISSUE_VIL',
      requiredRole: 'MANAGER',
      doctorNotes: 'VIL issued for patient and MED-X husband companion.',
      completedAt: new Date(Date.now() - 8 * dayMs),
    },
    {
      stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel',
      stageOrder: 3,
      stepOrder: 2,
      title: 'Flight Itinerary & Airport Transfer Confirmation',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'ARRANGE_LOGISTICS',
      requiredRole: 'MANAGER',
      doctorNotes: 'Emirates EK512 pickup & WCHR assistance confirmed.',
      completedAt: new Date(Date.now() - 6 * dayMs),
    },
    {
      stageName: 'Stage 4: Hospital Admission & Pre-Anesthesia (PAC)',
      stageOrder: 4,
      stepOrder: 1,
      title: 'Pre-Anesthesia Evaluation (PAC) & Cardiac Assessment',
      category: 'PRE_OP',
      status: 'COMPLETED',
      actionType: 'SIGN_PAC',
      requiredRole: 'DOCTOR',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
      doctorNotes: 'ASA Class II. HbA1c 6.8%. Cleared for cardiac catheterization lab under local & MAC anesthesia.',
      completedAt: new Date(Date.now() - 5 * dayMs),
    },
    {
      stageName: 'Stage 5: Active Procedural / Surgical Intervention',
      stageOrder: 5,
      stepOrder: 1,
      title: 'Cardiac Catheterization & Stent Placement Procedure',
      category: 'TREATMENT',
      status: 'COMPLETED',
      actionType: 'OPERATIVE_SUMMARY',
      requiredRole: 'DOCTOR',
      decisionBranch: 'UNCOMPLICATED_PROCEDURE',
      doctorNotes: 'Successful placement of 2 drug-eluting stents in LAD artery. Zero intra-op complications.',
      completedAt: new Date(Date.now() - 2 * dayMs),
    },
    {
      stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery',
      stageOrder: 6,
      stepOrder: 1,
      title: 'Post-Op Coronary Care Unit (CCU) Monitoring',
      category: 'POST_OP',
      status: 'COMPLETED',
      actionType: 'HEMODYNAMICS_CLEARANCE',
      requiredRole: 'DOCTOR',
      decisionBranch: 'STABLE_STEARN_HEMODYNAMICS',
      doctorNotes: 'Transferred to CCU for 24h continuous telemetry. Vital signs stable, troponin levels trending down.',
      completedAt: new Date(Date.now() - 1 * dayMs),
    },
    {
      stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery',
      stageOrder: 6,
      stepOrder: 2,
      title: 'In-Patient Ward Recovery & Mobilization Protocol',
      category: 'POST_OP',
      status: 'IN_PROGRESS',
      decisionBranch: 'NORMAL_RECOVERY_TRACK',
      doctorNotes: 'Patient ambulatory, on dual antiplatelet therapy (DAPT). Surgical entry site clean.',
    },
    {
      stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery',
      stageOrder: 6,
      stepOrder: 3,
      title: 'Clinical Discharge Summary & Medication Plan',
      category: 'DISCHARGE',
      status: 'COMPLETED',
      actionType: 'DISCHARGE_SUMMARY',
      requiredRole: 'DOCTOR',
      doctorNotes: 'Official hospital discharge summary issued with DAPT medication & radial access care instructions.',
      completedAt: new Date(Date.now() - 12 * 3600000),
    },
    {
      stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
      stageOrder: 7,
      stepOrder: 1,
      title: 'Hospital Final Bill Settlement',
      category: 'DISCHARGE',
      status: 'PENDING',
      actionType: 'SETTLE_BILL',
      requiredRole: 'MANAGER',
      doctorNotes: 'Discharge summary issued; awaiting final balance settlement prior to departure.',
    },
    {
      stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
      stageOrder: 7,
      stepOrder: 2,
      title: 'Fit-to-Fly Medical Travel Clearance Certificate',
      category: 'DISCHARGE',
      status: 'COMPLETED',
      actionType: 'SIGN_FIT_TO_FLY',
      requiredRole: 'DOCTOR',
      decisionBranch: 'FIT_TO_FLY_GRANTED',
      doctorNotes: '5-point IATA physiological safety checklist verified; WCHR assistance prescribed.',
      completedAt: new Date(),
    },
    {
      stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab',
      stageOrder: 7,
      stepOrder: 3,
      title: 'Day-7, Day-30 & Day-90 Post-Return Tele-Rehab Follow-Up',
      category: 'REHAB',
      status: 'IN_PROGRESS',
      actionType: 'SCHEDULE_TELE_REHAB',
      requiredRole: 'DOCTOR',
      doctorNotes: 'Day-7 recovery check-in submitted by patient; awaiting specialist review.',
    },
  ];

  for (const step of clinicalStepsData) {
    await prisma.clinicalStep.create({
      data: {
        caseId: sampleCase.id,
        stageName: step.stageName,
        stageOrder: step.stageOrder,
        stepOrder: step.stepOrder,
        title: step.title,
        category: step.category,
        status: step.status,
        actionType: step.actionType || null,
        requiredRole: step.requiredRole || null,
        decisionBranch: step.decisionBranch || null,
        doctorNotes: step.doctorNotes,
        completedAt: step.completedAt || null,
      },
    });
  }

  const ftfChecklist = {
    woundStable: true,
    noTrappedGasRisk: true,
    cardioRespiratoryStable: true,
    hemoglobinCleared: true,
    dvtProphylaxisPlan: true,
  };

  await prisma.fitToFlyClearance.upsert({
    where: { caseId: sampleCase.id },
    update: {
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth (MBBS, MD Cardiology)',
      clearanceDate: new Date(),
      restrictions:
        'Patient cleared for commercial flights. WCHR wheelchair assistance at airport; wear compression stockings and keep emergency nitroglycerin in carry-on bag.',
      checklist: ftfChecklist as unknown as Prisma.InputJsonValue,
      ssrCode: 'WCHR',
      requiresMedif: false,
      flightNumber: 'EK511',
      departureDate: outboundDepartureAt,
    },
    create: {
      caseId: sampleCase.id,
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth (MBBS, MD Cardiology)',
      clearanceDate: new Date(),
      restrictions:
        'Patient cleared for commercial flights. WCHR wheelchair assistance at airport; wear compression stockings and keep emergency nitroglycerin in carry-on bag.',
      checklist: ftfChecklist as unknown as Prisma.InputJsonValue,
      ssrCode: 'WCHR',
      requiresMedif: false,
      flightNumber: 'EK511',
      departureDate: outboundDepartureAt,
    },
  });

  // Seed TELECONSULTATION appointments with meeting URLs for Ranya
  await prisma.appointment.upsert({
    where: { id: 'seed-appt-001' },
    update: {
      mode: 'TELECONSULTATION',
      meetingUrl: 'https://meet.afzalhealthcare.in/consult-cardiology-ranya',
      interpreterLanguage: 'Arabic',
    },
    create: {
      id: 'seed-appt-001',
      caseId: sampleCase.id,
      patientId: patient.id,
      hospitalId: hospital1.id,
      doctorId: 'seed-doctor-001',
      appointmentType: 'PRE_OP_ASSESSMENT',
      mode: 'TELECONSULTATION',
      meetingUrl: 'https://meet.afzalhealthcare.in/consult-cardiology-ranya',
      interpreterLanguage: 'Arabic',
      scheduledAt: new Date(Date.now() - 9 * dayMs),
      status: 'COMPLETED',
      clinicalNotes:
        'Pre-travel video teleconsultation completed with Arabic interpreter. Angiography reviewed; patient cleared for travel.',
      createdBy: manager.id,
    },
  });

  await prisma.appointment.upsert({
    where: { id: 'seed-appt-002' },
    update: {
      mode: 'TELECONSULTATION',
      meetingUrl: 'https://meet.afzalhealthcare.in/rehab-cardiology-ranya',
      interpreterLanguage: 'Arabic',
      scheduledAt: new Date(Date.now() + 2 * dayMs),
    },
    create: {
      id: 'seed-appt-002',
      caseId: sampleCase.id,
      patientId: patient.id,
      hospitalId: hospital1.id,
      doctorId: 'seed-doctor-001',
      appointmentType: 'POST_OP_REVIEW',
      mode: 'TELECONSULTATION',
      meetingUrl: 'https://meet.afzalhealthcare.in/rehab-cardiology-ranya',
      interpreterLanguage: 'Arabic',
      scheduledAt: new Date(Date.now() + 2 * dayMs),
      status: 'CONFIRMED',
      clinicalNotes: 'Post-op discharge & tele-rehab review prior to return flight EK511.',
      createdBy: manager.id,
    },
  });

  // ─── 6. Sample Verification & Hospital-Issued Documents ──────────
  const uploadDir = path.join(process.cwd(), 'storage', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  const samplePdfFiles = [
    'VIL_Sample.pdf',
    'Invoice_Sample.pdf',
    'Passport_Sample.pdf',
    'Angio_Report.pdf',
    'Discharge_Summary_Sample.pdf',
  ];
  for (const filename of samplePdfFiles) {
    await fs.writeFile(path.join(uploadDir, filename), SAMPLE_PDF_BUFFER);
  }

  await prisma.document.deleteMany({ where: { patientId: patient.id } });

  const sampleDocs: Array<{
    category: DocumentCategory;
    fileName: string;
    storageKey: string;
    fileSize: number;
    mimeType: string;
    verificationStatus: string;
    uploadedBy: string;
    verifiedBy?: string;
    verificationNotes: string;
    verifiedAt: Date;
  }> = [
    {
      category: 'VISA_INVITATION_LETTER',
      fileName: 'Official_Visa_Invitation_Letter_Fortis_Escorts.pdf',
      storageKey: 'VIL_Sample.pdf',
      fileSize: 245000,
      mimeType: 'application/pdf',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      uploadedBy: manager.id,
      verificationNotes: 'Official Medical Visa Invitation Letter issued by Fortis Escorts for Indian Consulate M-Visa application.',
      verifiedAt: new Date(),
    },
    {
      category: 'PROFORMA_INVOICE',
      fileName: 'Treatment_Cost_Estimate_Proforma_Invoice.pdf',
      storageKey: 'Invoice_Sample.pdf',
      fileSize: 180000,
      mimeType: 'application/pdf',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      uploadedBy: manager.id,
      verificationNotes: 'Signed Pro-Forma treatment invoice for foreign currency exchange and hospital admission deposit.',
      verifiedAt: new Date(),
    },
    {
      category: 'PASSPORT',
      fileName: 'International_Passport_UAE_Patient.pdf',
      storageKey: 'Passport_Sample.pdf',
      fileSize: 520000,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      uploadedBy: patientUser.id,
      verifiedBy: manager.id,
      verificationNotes: 'Verified UAE Passport. Expiry date valid for 18 months.',
      verifiedAt: new Date(),
    },
    {
      category: 'MEDICAL_REPORT',
      fileName: 'Coronary_Angiography_Diagnostics_2026.pdf',
      storageKey: 'Angio_Report.pdf',
      fileSize: 1240000,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      uploadedBy: patientUser.id,
      verifiedBy: manager.id,
      verificationNotes: 'Pre-op diagnostic angiography labs verified by Senior Cardiologist.',
      verifiedAt: new Date(),
    },
    {
      category: 'DISCHARGE_SUMMARY',
      fileName: 'Hospital_Discharge_Summary_Fortis_Escorts.pdf',
      storageKey: 'Discharge_Summary_Sample.pdf',
      fileSize: 310000,
      mimeType: 'application/pdf',
      verificationStatus: 'ISSUED_BY_HOSPITAL',
      uploadedBy: doctorUser.id,
      verifiedBy: doctorUser.id,
      verificationNotes:
        'Procedure: PCI x2 DES to LAD. Uncomplicated course. Continue DAPT (Aspirin 81mg + Clopidogrel 75mg), keep radial site clean/dry.',
      verifiedAt: new Date(),
    },
  ];

  for (const doc of sampleDocs) {
    const createdDoc = await prisma.document.create({
      data: {
        patientId: patient.id,
        category: doc.category,
        fileName: doc.fileName,
        fileUrl: doc.storageKey,
        storageKey: doc.storageKey,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        verificationStatus: doc.verificationStatus,
        uploadedBy: doc.uploadedBy,
        verifiedBy: doc.verifiedBy || null,
        verificationNotes: doc.verificationNotes || null,
        verifiedAt: doc.verifiedAt || null,
      },
    });

    await prisma.document.update({
      where: { id: createdDoc.id },
      data: { fileUrl: `/api/v1/documents/${createdDoc.id}/download` },
    });
  }

  // ─── 7. Sample Medical Bills & Itemized Breakdowns ──────────────
  console.log('Creating sample medical bills & itemized breakdowns...');
  const sampleBillRecord = await prisma.medicalBill.upsert({
    where: { billNumber: 'INV-2026-0042' },
    update: {
      storageKey: 'Invoice_Sample.pdf',
    },
    create: {
      billNumber: 'INV-2026-0042',
      caseId: sampleCase.id,
      patientId: patient.id,
      hospitalId: hospital1.id,
      title: 'Percutaneous Coronary Intervention (PCI) Surgical & Hospital Bill',
      category: 'HOSPITAL_SURGERY',
      totalAmount: 4850.00,
      paidAmount: 2000.00,
      currency: 'USD',
      status: 'PARTIALLY_PAID',
      dueDate: new Date(Date.now() + 10 * 86400000),
      fileUrl: 'Invoice_Sample.pdf',
      storageKey: 'Invoice_Sample.pdf',
      fileName: 'Hospital_Final_Tax_Invoice_INV0042.pdf',
      notes: 'Initial $2,000 deposit paid prior to cardiac catheterization lab admission. Balance due upon discharge.',
      createdBy: manager.id,
    },
  });

  const sampleBill = await prisma.medicalBill.update({
    where: { id: sampleBillRecord.id },
    data: {
      fileUrl: `/api/v1/documents/bill/${sampleBillRecord.id}/download`,
    },
  });

  await prisma.billItem.deleteMany({ where: { billId: sampleBill.id } });

  const billItemsData = [
    { description: 'Cardiac Catheterization Lab & Operating Suite Charges', quantity: 1, unitPrice: 1800.00, amount: 1800.00, category: 'SURGERY_OT' },
    { description: 'Drug-Eluting Coronary Stents (LAD Artery, x2)', quantity: 2, unitPrice: 750.00, amount: 1500.00, category: 'PHARMACY' },
    { description: 'Coronary Care Unit (CCU) Bed Rent (24-Hour Telemetry Monitoring)', quantity: 2, unitPrice: 350.00, amount: 700.00, category: 'BED_RENT' },
    { description: 'Pre-Op Angiography Diagnostics & Electrocardiogram', quantity: 1, unitPrice: 450.00, amount: 450.00, category: 'DIAGNOSTICS' },
    { description: 'Senior Consultant Interventional Cardiologist Rounds', quantity: 2, unitPrice: 200.00, amount: 400.00, category: 'CONSULTATION' },
  ];

  for (const item of billItemsData) {
    await prisma.billItem.create({
      data: {
        billId: sampleBill.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        category: item.category,
      },
    });
  }

  console.log(`  ✓ Sample clinical case with ${clinicalStepsData.length} workflow steps & Fit-to-Fly clearance created`);
  console.log(`  ✓ ${sampleDocs.length} official verification documents & VIL certificates issued`);
  console.log(`  ✓ Sample medical bill ($4,850 USD) with 5 itemized line-item breakdowns created\n`);

  // ─── 8. Accommodations & Hotels ──────────────────────────────────
  console.log('Creating partner accommodations & hotel bookings...');
  const hotel1 = await prisma.hotel.upsert({
    where: { id: 'seed-hotel-001' },
    update: {},
    create: {
      id: 'seed-hotel-001',
      name: 'Taj Palace Luxury Recovery Suites',
      city: 'New Delhi',
      address: '2 Sardar Patel Marg, Diplomatic Enclave, New Delhi',
      nearHospitalId: hospital1.id,
      distanceKm: 1.8,
      starRating: 5.0,
      nightlyRateUsd: 140.00,
      commissionPercent: 15.00,
      amenities: ['Wheelchair Accessible', 'ICU Nurse On-Call', 'Halal Certified Kitchen', 'Airport Ambulance Shuttle', 'Post-Op Recliner Beds'],
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80'
      ],
      description: 'Luxury 5-star medical recovery suites located 1.8 km from Fortis Heart Institute. Features dedicated post-op nursing care, customized Arabic/Halal meals, and wheelchair-accessible roll-in showers.',
      contactPhone: '+911126110202',
      contactEmail: 'medical.concierge@tajpalace.com',
    },
  });

  const hotel2 = await prisma.hotel.upsert({
    where: { id: 'seed-hotel-002' },
    update: {},
    create: {
      id: 'seed-hotel-002',
      name: 'Radisson Blu Executive Care Residence',
      city: 'Gurgaon',
      address: 'Adjacent to Medanta MediCity, Sector 38, Gurgaon',
      nearHospitalId: hospital2.id,
      distanceKm: 0.8,
      starRating: 4.8,
      nightlyRateUsd: 95.00,
      commissionPercent: 12.50,
      amenities: ['0.8 km to Medanta Hospital', 'Wheelchair Accessible', '24/7 Room Service', 'Kitchenette', 'Free High-Speed Wi-Fi'],
      images: [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'
      ],
      description: 'Executive service apartment suite located directly opposite Medanta Hospital. Includes full kitchenette for family attendants and zero-step wheelchair access.',
      contactPhone: '+911244771100',
      contactEmail: 'stay@radissongurgaon.com',
    },
  });

  const hotel3 = await prisma.hotel.upsert({
    where: { id: 'seed-hotel-003' },
    update: {},
    create: {
      id: 'seed-hotel-003',
      name: 'Medanta Wellness & Recovery Guest House',
      city: 'Gurgaon',
      address: 'Block C, Sector 38, Gurgaon',
      nearHospitalId: hospital2.id,
      distanceKm: 0.4,
      starRating: 4.5,
      nightlyRateUsd: 65.00,
      commissionPercent: 10.00,
      amenities: ['Hospital Shuttle', 'Wheelchair Access', 'Translator Support', 'Laundry Service'],
      images: [
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80'
      ],
      description: 'Dedicated patient and family guest suites with direct covered walkway access to hospital wings. Optimized for post-discharge outpatient observation.',
      contactPhone: '+911244141414',
      contactEmail: 'guesthouse@medanta.org',
    },
  });

  // Sample Hotel Booking
  await prisma.hotelBooking.upsert({
    where: { bookingNo: 'HTL-2026-8801' },
    update: {},
    create: {
      bookingNo: 'HTL-2026-8801',
      patientId: patient.id,
      hotelId: hotel1.id,
      caseId: 'seed-case-001',
      checkInDate: new Date('2026-08-05'),
      checkOutDate: new Date('2026-08-10'),
      roomType: 'Deluxe Recovery Suite with Recliner',
      numGuests: 2,
      numNights: 5,
      totalAmountUsd: 700.00,
      commissionAmountUsd: 105.00, // 15% of $700
      status: 'CONFIRMED',
      specialRequests: 'Ground floor suite required. Wheelchair access and Arabic halal breakfast requested.',
    },
  });

  console.log(`  ✓ 3 partner hotels & 1 accommodation booking ($105 USD partner commission) created\n`);

  // ─── 9. Platform System Governance Defaults ───────────────────────
  console.log('Seeding default SystemConfig governance settings...');
  for (const [key, value] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: {},
      create: {
        key,
        value: JSON.stringify(value),
      },
    });
  }
  console.log(`  ✓ ${Object.keys(DEFAULT_SYSTEM_SETTINGS).length} SystemConfig defaults seeded\n`);

  // ─── 10. B2B Referral Partners ───────────────────────────────────
  console.log('Seeding B2B Referral Partners...');
  const partnerGulf = await prisma.referralPartner.upsert({
    where: { code: 'GULF-MUSCAT' },
    update: {
      name: 'Gulf MedConnect Muscat',
      partnerType: 'FACILITATOR_AGENCY',
      country: 'Oman',
      contactName: 'Dr. Tariq Al-Lawati',
      contactEmail: 'referrals@gulfmedconnect.om',
      contactPhone: '+96824501122',
      commissionPercent: 12.0,
      isActive: true,
      notes: 'Primary GCC cardiac & orthopaedic patient facilitator partner based in Muscat.',
    },
    create: {
      id: 'seed-partner-001',
      name: 'Gulf MedConnect Muscat',
      code: 'GULF-MUSCAT',
      partnerType: 'FACILITATOR_AGENCY',
      country: 'Oman',
      contactName: 'Dr. Tariq Al-Lawati',
      contactEmail: 'referrals@gulfmedconnect.om',
      contactPhone: '+96824501122',
      commissionPercent: 12.0,
      isActive: true,
      notes: 'Primary GCC cardiac & orthopaedic patient facilitator partner based in Muscat.',
    },
  });

  const partnerNairobi = await prisma.referralPartner.upsert({
    where: { code: 'NAIROBI-HEART' },
    update: {
      name: 'Nairobi Heart & Ortho Clinic',
      partnerType: 'REFERRING_PHYSICIAN',
      country: 'Kenya',
      contactName: 'Dr. Wanjiku Kamau',
      contactEmail: 'intl.desk@nairobiheartortho.co.ke',
      contactPhone: '+254202718900',
      commissionPercent: 8.5,
      isActive: true,
      notes: 'East Africa specialist cardiology & joint replacement referral clinic.',
    },
    create: {
      id: 'seed-partner-002',
      name: 'Nairobi Heart & Ortho Clinic',
      code: 'NAIROBI-HEART',
      partnerType: 'REFERRING_PHYSICIAN',
      country: 'Kenya',
      contactName: 'Dr. Wanjiku Kamau',
      contactEmail: 'intl.desk@nairobiheartortho.co.ke',
      contactPhone: '+254202718900',
      commissionPercent: 8.5,
      isActive: true,
      notes: 'East Africa specialist cardiology & joint replacement referral clinic.',
    },
  });

  const partnerBaghdad = await prisma.referralPartner.upsert({
    where: { code: 'EMBASSY-IRQ' },
    update: {
      name: 'Embassy Medical Desk Baghdad',
      partnerType: 'EMBASSY_MINISTRY',
      country: 'Iraq',
      contactName: 'Mustafa Al-Dulaimi',
      contactEmail: 'medical.attach@baghdad-health.iq',
      contactPhone: '+9647701234567',
      commissionPercent: 10.0,
      isActive: true,
      notes: 'Sponsored tertiary oncology, neurosurgery & transplant referrals.',
    },
    create: {
      id: 'seed-partner-003',
      name: 'Embassy Medical Desk Baghdad',
      code: 'EMBASSY-IRQ',
      partnerType: 'EMBASSY_MINISTRY',
      country: 'Iraq',
      contactName: 'Mustafa Al-Dulaimi',
      contactEmail: 'medical.attach@baghdad-health.iq',
      contactPhone: '+9647701234567',
      commissionPercent: 10.0,
      isActive: true,
      notes: 'Sponsored tertiary oncology, neurosurgery & transplant referrals.',
    },
  });
  console.log('  ✓ 3 B2B Referral Partners created (GULF-MUSCAT, NAIROBI-HEART, EMBASSY-IRQ)\n');

  // ─── 11. Second Sample International Inquiry Patient (Pre-Travel Triage & Plan Consent) ─
  console.log('Seeding second sample international inquiry patient (Omar Al-Harthy)...');
  const omarUser = await prisma.user.upsert({
    where: { email: 'omar@afzalhealthcare.in' },
    update: {
      role: 'PATIENT',
      fullName: 'Omar Al-Harthy',
    },
    create: {
      email: 'omar@afzalhealthcare.in',
      passwordHash: patientPasswordHash,
      role: 'PATIENT',
      fullName: 'Omar Al-Harthy',
      phone: '+96891234567',
    },
  });

  const omarPassportEncrypted = encrypt('B77665544');
  const omarPassportExpiry = new Date('2028-09-20T00:00:00.000Z');
  const omarPatient = await prisma.patient.upsert({
    where: { userId: omarUser.id },
    update: {
      passportNo: omarPassportEncrypted,
      passportExpiry: omarPassportExpiry,
      assignedManagerId: manager.id,
    },
    create: {
      userId: omarUser.id,
      nationality: 'Oman',
      passportNo: omarPassportEncrypted,
      passportExpiry: omarPassportExpiry,
      dob: new Date('1978-11-04'),
      bloodGroup: 'A+',
      medicalCondition: 'Exertional angina — pre-travel cardiology workup & angiography review',
      urgencyLevel: 'ROUTINE',
      primaryLanguage: 'Arabic',
      emergencyContact: {
        name: 'Salim Al-Harthy',
        phone: '+96891234568',
        relation: 'Brother',
      },
      assignedManagerId: manager.id,
    },
  });

  const omarMedProfileEncrypted = encryptMedicalProfile({
    allergies: [],
    medications: [{ name: 'Atorvastatin', dosage: '20mg', frequency: 'Nightly' }],
    surgeries: [],
    chronicConditions: ['Hyperlipidemia', 'Stable Angina'],
    specialisationsRequired: ['Cardiology'],
  });

  await prisma.patientMedicalProfile.upsert({
    where: { patientId: omarPatient.id },
    update: {
      allergies: omarMedProfileEncrypted.allergies as Prisma.InputJsonValue,
      medications: omarMedProfileEncrypted.medications as Prisma.InputJsonValue,
      surgeries: omarMedProfileEncrypted.surgeries as Prisma.InputJsonValue,
      chronicConditions: omarMedProfileEncrypted.chronicConditions as Prisma.InputJsonValue,
      specialisationsRequired: ['Cardiology'] as Prisma.InputJsonValue,
    },
    create: {
      patientId: omarPatient.id,
      allergies: omarMedProfileEncrypted.allergies as Prisma.InputJsonValue,
      medications: omarMedProfileEncrypted.medications as Prisma.InputJsonValue,
      surgeries: omarMedProfileEncrypted.surgeries as Prisma.InputJsonValue,
      chronicConditions: omarMedProfileEncrypted.chronicConditions as Prisma.InputJsonValue,
      specialisationsRequired: ['Cardiology'] as Prisma.InputJsonValue,
    },
  });

  const omarTreatmentPlan = {
    diagnosis: 'Exertional angina — suspected single-vessel coronary stenosis',
    procedureName: 'Diagnostic Coronary Angiography & Fractional Flow Reserve (FFR)',
    specialty: 'Cardiology',
    hospitalLosDays: 2,
    recoveryStayDays: 4,
    estimatedCostUsd: 2400,
    depositRequiredUsd: 1000,
    currency: 'USD',
    inclusions: [
      'Diagnostic coronary angiography & FFR assessment',
      'Senior cardiologist consultation & ECG/Echo panel',
      'Airport reception & 2-day executive hospital room',
    ],
    exclusions: [
      'Therapeutic angioplasty / stenting (quoted separately if indicated)',
      'International flights & post-discharge hotel accommodation',
    ],
    doctorOpinionNotes:
      'Reviewed stress echo from Muscat. Recommend elective coronary angiography at Fortis Escorts.',
    publishedAt: new Date().toISOString(),
    publishedBy: doctorUser.id,
    consentAcceptedAt: null,
    consentAcceptedBy: null,
  };

  const omarCase = await prisma.case.upsert({
    where: { id: 'seed-case-002' },
    update: {
      hospitalId: hospital1.id,
      primaryDoctorId: 'seed-doctor-001',
      managerId: manager.id,
      referralPartnerId: partnerGulf.id,
      status: 'UNDER_REVIEW',
      treatmentPlan: omarTreatmentPlan as unknown as Prisma.InputJsonValue,
    },
    create: {
      id: 'seed-case-002',
      patientId: omarPatient.id,
      managerId: manager.id,
      hospitalId: hospital1.id,
      primaryDoctorId: 'seed-doctor-001',
      referralPartnerId: partnerGulf.id,
      status: 'UNDER_REVIEW',
      notes: 'Pre-travel file review assigned to Dr. Ashok Seth; treatment plan awaiting patient consent.',
      isUrgent: false,
      treatmentPlan: omarTreatmentPlan as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.clinicalStep.deleteMany({ where: { caseId: omarCase.id } });
  const omarSteps = buildStandardMvtPathwaySteps('CARDIOLOGY');
  for (const step of omarSteps) {
    const isIntakeDone = step.actionType === 'UPLOAD_DOCS' || step.actionType === 'VOTE_MDT';
    const isProformaAction = step.actionType === 'ISSUE_PROFORMA';
    await prisma.clinicalStep.create({
      data: {
        caseId: omarCase.id,
        stageName: step.stageName,
        stageOrder: step.stageOrder,
        stepOrder: step.stepOrder,
        title: step.title,
        category: step.category,
        status: isIntakeDone
          ? 'COMPLETED'
          : isProformaAction
            ? 'ACTION_REQUIRED'
            : 'PENDING',
        actionType: step.actionType ?? null,
        requiredRole: step.requiredRole ?? null,
        completedAt: isIntakeDone ? new Date() : null,
      },
    });
  }

  await prisma.document.deleteMany({ where: { patientId: omarPatient.id } });
  const omarPassportDoc = await prisma.document.create({
    data: {
      patientId: omarPatient.id,
      uploadedBy: omarUser.id,
      category: 'PASSPORT',
      fileName: 'Oman_Passport_Omar_Al_Harthy.pdf',
      fileUrl: 'Passport_Sample.pdf',
      storageKey: 'Passport_Sample.pdf',
      fileSize: 412000,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedBy: manager.id,
      verificationNotes: 'Omani passport verified (> 6 months validity).',
      verifiedAt: new Date(),
    },
  });
  await prisma.document.update({
    where: { id: omarPassportDoc.id },
    data: { fileUrl: `/api/v1/documents/${omarPassportDoc.id}/download` },
  });

  console.log(`  ✓ Second inquiry patient: omar@afzalhealthcare.in / Patient@123 (UNDER_REVIEW)\n`);

  // Partner-attributed billing record on seed-case-002 for B2B ROI analytics
  await prisma.medicalBill.upsert({
    where: { billNumber: 'INV-2026-0043' },
    update: {
      caseId: omarCase.id,
      patientId: omarPatient.id,
      hospitalId: hospital1.id,
      totalAmount: 2400.0,
      paidAmount: 1000.0,
      status: 'PARTIALLY_PAID',
    },
    create: {
      billNumber: 'INV-2026-0043',
      caseId: omarCase.id,
      patientId: omarPatient.id,
      hospitalId: hospital1.id,
      title: 'Diagnostic Coronary Angiography & FFR Deposit Invoice',
      category: 'DIAGNOSTICS',
      totalAmount: 2400.0,
      paidAmount: 1000.0,
      currency: 'USD',
      status: 'PARTIALLY_PAID',
      dueDate: new Date(Date.now() + 14 * dayMs),
      notes: 'Referred via Gulf MedConnect Muscat (GULF-MUSCAT). Pre-travel deposit recorded.',
      createdBy: manager.id,
    },
  });

  // ─── 12. Advanced Leads CRM Pipeline & Activities ────────────────
  console.log('Seeding international Leads CRM records & activity timelines...');

  const now = new Date();
  const hourMs = 3600000;

  interface SeedLeadSpec {
    id: string;
    referenceNo: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    nationality: string;
    countryOfResidence: string | null;
    preferredLanguage: string | null;
    medicalCondition: string;
    specialtyInterest: string | null;
    urgencyLevel: UrgencyLevel;
    hasDiagnosticReports: boolean;
    passportReady: boolean;
    preferredTravelWindow: string | null;
    estimatedBudgetUsd: number | null;
    preliminaryQuoteUsd: number | null;
    preliminaryQuoteNotes: string | null;
    targetHospitalId: string | null;
    targetDoctorId: string | null;
    status: LeadStatus;
    source: LeadSource;
    assignedManagerId: string | null;
    referralPartnerId: string | null;
    createdAt: Date;
    firstRespondedAt: Date | null;
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
    lostReason?: string | null;
    lostNotes?: string | null;
    convertedPatientId?: string | null;
    convertedCaseId?: string | null;
    convertedAt?: Date | null;
    activities: Array<{
      activityType: LeadActivityType;
      summary: string;
      actorId: string | null;
      dueAt?: Date | null;
      completedAt?: Date | null;
      createdAt: Date;
    }>;
  }

  const seedLeads: SeedLeadSpec[] = [
    {
      id: 'seed-lead-001',
      referenceNo: 'LD-2026-SEED01',
      fullName: 'Amina Abubakar',
      email: 'amina.abubakar@example.ng',
      phone: '+2348035550192',
      whatsappNumber: '+2348035550192',
      nationality: 'Nigeria',
      countryOfResidence: 'Nigeria',
      preferredLanguage: 'English',
      medicalCondition:
        'Stage II invasive ductal breast carcinoma; biopsy & PET-CT completed in Abuja, seeking surgical oncology + radiation opinion.',
      specialtyInterest: 'ONCOLOGY',
      urgencyLevel: 'URGENT',
      hasDiagnosticReports: true,
      passportReady: true,
      preferredTravelWindow: 'IMMEDIATE_7D',
      estimatedBudgetUsd: 9500,
      preliminaryQuoteUsd: null,
      preliminaryQuoteNotes: null,
      targetHospitalId: hospital2.id,
      targetDoctorId: null,
      status: 'NEW',
      source: 'WEBSITE_INQUIRY',
      assignedManagerId: null,
      referralPartnerId: null,
      createdAt: new Date(now.getTime() - 2 * hourMs),
      firstRespondedAt: null,
      lastContactedAt: null,
      nextFollowUpAt: new Date(now.getTime() + 1 * hourMs),
      activities: [
        {
          activityType: 'NOTE',
          summary: 'Public web inquiry captured (WEBSITE_INQUIRY) — urgent oncology triage requested',
          actorId: null,
          createdAt: new Date(now.getTime() - 2 * hourMs),
        },
      ],
    },
    {
      id: 'seed-lead-002',
      referenceNo: 'LD-2026-SEED02',
      fullName: 'Khalid Al-Qahtani',
      email: 'khalid.qahtani@example.sa',
      phone: '+966505551144',
      whatsappNumber: '+966505551144',
      nationality: 'Saudi Arabia',
      countryOfResidence: 'Saudi Arabia',
      preferredLanguage: 'Arabic',
      medicalCondition:
        'Severe tricompartmental osteoarthritis right knee; wheelchair-bound for 3 months, seeking robotic total knee replacement.',
      specialtyInterest: 'ORTHOPEDICS',
      urgencyLevel: 'SEMI_URGENT',
      hasDiagnosticReports: false,
      passportReady: true,
      preferredTravelWindow: 'WITHIN_30D',
      estimatedBudgetUsd: 7800,
      preliminaryQuoteUsd: null,
      preliminaryQuoteNotes: null,
      targetHospitalId: hospital1.id,
      targetDoctorId: 'seed-doctor-003',
      status: 'CONTACTED',
      source: 'WHATSAPP',
      assignedManagerId: manager.id,
      referralPartnerId: null,
      createdAt: new Date(now.getTime() - 18 * hourMs),
      firstRespondedAt: new Date(now.getTime() - 17.5 * hourMs),
      lastContactedAt: new Date(now.getTime() - 16 * hourMs),
      nextFollowUpAt: new Date(now.getTime() + 18 * hourMs),
      activities: [
        {
          activityType: 'WHATSAPP',
          summary: 'Initial Arabic WhatsApp triage completed; requested standing knee X-ray DICOM files',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 17.5 * hourMs),
          createdAt: new Date(now.getTime() - 17.5 * hourMs),
        },
        {
          activityType: 'FOLLOW_UP_SCHEDULED',
          summary: 'Follow up with family on X-ray upload and companion passport copy',
          actorId: manager.id,
          dueAt: new Date(now.getTime() + 18 * hourMs),
          createdAt: new Date(now.getTime() - 16 * hourMs),
        },
      ],
    },
    {
      id: 'seed-lead-003',
      referenceNo: 'LD-2026-SEED03',
      fullName: 'Samuel Ochieng',
      email: 'samuel.ochieng@example.ke',
      phone: '+254712555830',
      whatsappNumber: '+254712555830',
      nationality: 'Kenya',
      countryOfResidence: 'Kenya',
      preferredLanguage: 'English',
      medicalCondition:
        'L4-L5 lumbar disc herniation with progressive bilateral radiculopathy; MRI reports uploaded via Nairobi clinic.',
      specialtyInterest: 'ORTHOPEDICS',
      urgencyLevel: 'SEMI_URGENT',
      hasDiagnosticReports: true,
      passportReady: true,
      preferredTravelWindow: 'WITHIN_30D',
      estimatedBudgetUsd: 6500,
      preliminaryQuoteUsd: 5900,
      preliminaryQuoteNotes: 'Microdiscectomy package estimate pending Dr. S.K. Rajan review',
      targetHospitalId: hospital1.id,
      targetDoctorId: 'seed-doctor-003',
      status: 'CLINICAL_REVIEW',
      source: 'B2B_PARTNER',
      assignedManagerId: manager.id,
      referralPartnerId: partnerNairobi.id,
      createdAt: new Date(now.getTime() - 2 * dayMs),
      firstRespondedAt: new Date(now.getTime() - 2 * dayMs + 25 * 60000),
      lastContactedAt: new Date(now.getTime() - 1 * dayMs),
      nextFollowUpAt: new Date(now.getTime() + 12 * hourMs),
      activities: [
        {
          activityType: 'PHONE_CALL',
          summary: 'Coordinated referral intake call with Nairobi Heart & Ortho Clinic nurse desk',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 2 * dayMs + 25 * 60000),
          createdAt: new Date(now.getTime() - 2 * dayMs + 25 * 60000),
        },
        {
          activityType: 'STATUS_CHANGE',
          summary: 'Moved to CLINICAL_REVIEW with lumbar MRI forwarded to Dr. S.K. Rajan',
          actorId: manager.id,
          createdAt: new Date(now.getTime() - 1 * dayMs),
        },
      ],
    },
    {
      id: 'seed-lead-004',
      referenceNo: 'LD-2026-SEED04',
      fullName: 'Zainab Al-Khatib',
      email: 'zainab.alkhatib@example.iq',
      phone: '+9647715550911',
      whatsappNumber: '+9647715550911',
      nationality: 'Iraq',
      countryOfResidence: 'Iraq',
      preferredLanguage: 'Arabic',
      medicalCondition:
        'Recurrent pituitary macroadenoma requiring endoscopic transsphenoidal resection & endocrinology follow-up.',
      specialtyInterest: 'NEUROSURGERY',
      urgencyLevel: 'URGENT',
      hasDiagnosticReports: true,
      passportReady: true,
      preferredTravelWindow: 'WITHIN_30D',
      estimatedBudgetUsd: 11000,
      preliminaryQuoteUsd: 8800,
      preliminaryQuoteNotes:
        'Includes endoscopic neurosurgery, 48h neuro-ICU, 4 days private ward, and Arabic interpreter.',
      targetHospitalId: hospital2.id,
      targetDoctorId: 'seed-doctor-002',
      status: 'QUOTE_SHARED',
      source: 'EMBASSY_SPONSOR',
      assignedManagerId: manager.id,
      referralPartnerId: partnerBaghdad.id,
      createdAt: new Date(now.getTime() - 4 * dayMs),
      firstRespondedAt: new Date(now.getTime() - 4 * dayMs + 10 * 60000),
      lastContactedAt: new Date(now.getTime() - 8 * hourMs),
      nextFollowUpAt: new Date(now.getTime() + 24 * hourMs),
      activities: [
        {
          activityType: 'EMAIL',
          summary: 'Confirmed embassy medical sponsorship letter receipt with Baghdad desk',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 4 * dayMs + 10 * 60000),
          createdAt: new Date(now.getTime() - 4 * dayMs + 10 * 60000),
        },
        {
          activityType: 'QUOTE_ESTIMATE',
          summary: 'Shared $8,800 USD Medanta neurosurgery pro-forma estimate with Embassy attaché',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 8 * hourMs),
          createdAt: new Date(now.getTime() - 8 * hourMs),
        },
      ],
    },
    {
      id: 'seed-lead-005',
      referenceNo: 'LD-2026-SEED05',
      fullName: 'Omar Al-Harthy',
      email: 'omar@afzalhealthcare.in',
      phone: '+96891234567',
      whatsappNumber: '+96891234567',
      nationality: 'Oman',
      countryOfResidence: 'Oman',
      preferredLanguage: 'Arabic',
      medicalCondition: 'Exertional angina — pre-travel cardiology workup & angiography review',
      specialtyInterest: 'CARDIOLOGY',
      urgencyLevel: 'ROUTINE',
      hasDiagnosticReports: true,
      passportReady: true,
      preferredTravelWindow: 'WITHIN_30D',
      estimatedBudgetUsd: 3000,
      preliminaryQuoteUsd: 2400,
      preliminaryQuoteNotes: 'Diagnostic Coronary Angiography & FFR at Fortis Escorts',
      targetHospitalId: hospital1.id,
      targetDoctorId: 'seed-doctor-001',
      status: 'CONVERTED',
      source: 'B2B_PARTNER',
      assignedManagerId: manager.id,
      referralPartnerId: partnerGulf.id,
      createdAt: new Date(now.getTime() - 7 * dayMs),
      firstRespondedAt: new Date(now.getTime() - 7 * dayMs + 20 * 60000),
      lastContactedAt: new Date(now.getTime() - 5 * dayMs),
      nextFollowUpAt: null,
      convertedPatientId: omarPatient.id,
      convertedCaseId: omarCase.id,
      convertedAt: new Date(now.getTime() - 5 * dayMs),
      activities: [
        {
          activityType: 'WHATSAPP',
          summary: 'Received Oman stress echo & referral packet from Gulf MedConnect Muscat',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 7 * dayMs + 20 * 60000),
          createdAt: new Date(now.getTime() - 7 * dayMs + 20 * 60000),
        },
        {
          activityType: 'CONVERSION',
          summary: `Converted to Patient & Case #${omarCase.id.slice(0, 8)} (UNDER_REVIEW)`,
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 5 * dayMs),
          createdAt: new Date(now.getTime() - 5 * dayMs),
        },
      ],
    },
    {
      id: 'seed-lead-006',
      referenceNo: 'LD-2026-SEED06',
      fullName: 'Farhana Rahman',
      email: 'farhana.rahman@example.bd',
      phone: '+8801711550234',
      whatsappNumber: '+8801711550234',
      nationality: 'Bangladesh',
      countryOfResidence: 'Bangladesh',
      preferredLanguage: 'Bengali',
      medicalCondition: 'Symptomatic gallstones requesting elective laparoscopic cholecystectomy.',
      specialtyInterest: 'GENERAL',
      urgencyLevel: 'ROUTINE',
      hasDiagnosticReports: false,
      passportReady: false,
      preferredTravelWindow: 'EXPLORING',
      estimatedBudgetUsd: 2500,
      preliminaryQuoteUsd: 2200,
      preliminaryQuoteNotes: 'Elective laparoscopic cholecystectomy package estimate',
      targetHospitalId: hospital2.id,
      targetDoctorId: null,
      status: 'LOST',
      source: 'META_GOOGLE_ADS',
      assignedManagerId: manager.id,
      referralPartnerId: null,
      createdAt: new Date(now.getTime() - 10 * dayMs),
      firstRespondedAt: new Date(now.getTime() - 10 * dayMs + 90 * 60000),
      lastContactedAt: new Date(now.getTime() - 6 * dayMs),
      nextFollowUpAt: null,
      lostReason: 'TIMELINE_POSTPONED',
      lostNotes: 'Family postponed international travel by 6 months due to passport renewal.',
      activities: [
        {
          activityType: 'PHONE_CALL',
          summary: 'Spoke with patient spouse regarding passport validity and travel window',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 10 * dayMs + 90 * 60000),
          createdAt: new Date(now.getTime() - 10 * dayMs + 90 * 60000),
        },
        {
          activityType: 'STATUS_CHANGE',
          summary: 'Marked LOST (TIMELINE_POSTPONED) — passport renewal pending',
          actorId: manager.id,
          completedAt: new Date(now.getTime() - 6 * dayMs),
          createdAt: new Date(now.getTime() - 6 * dayMs),
        },
      ],
    },
  ];

  for (const spec of seedLeads) {
    const scoreResult = computeLeadScoreAndTemperature({
      urgencyLevel: spec.urgencyLevel,
      hasDiagnosticReports: spec.hasDiagnosticReports,
      medicalCondition: spec.medicalCondition,
      specialtyInterest: spec.specialtyInterest,
      passportReady: spec.passportReady,
      preferredTravelWindow: spec.preferredTravelWindow,
      estimatedBudgetUsd: spec.estimatedBudgetUsd,
      source: spec.source,
      email: spec.email,
      phone: spec.phone,
      whatsappNumber: spec.whatsappNumber,
    });
    const firstResponseDueAt = computeLeadFirstResponseDueAt(
      spec.urgencyLevel,
      scoreResult.temperature,
      spec.createdAt
    );

    const upsertedLead = await prisma.lead.upsert({
      where: { referenceNo: spec.referenceNo },
      update: {
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        whatsappNumber: spec.whatsappNumber,
        nationality: spec.nationality,
        countryOfResidence: spec.countryOfResidence,
        preferredLanguage: spec.preferredLanguage,
        medicalCondition: spec.medicalCondition,
        specialtyInterest: spec.specialtyInterest,
        urgencyLevel: spec.urgencyLevel,
        hasDiagnosticReports: spec.hasDiagnosticReports,
        passportReady: spec.passportReady,
        preferredTravelWindow: spec.preferredTravelWindow,
        estimatedBudgetUsd: spec.estimatedBudgetUsd,
        preliminaryQuoteUsd: spec.preliminaryQuoteUsd,
        preliminaryQuoteNotes: spec.preliminaryQuoteNotes,
        targetHospitalId: spec.targetHospitalId,
        targetDoctorId: spec.targetDoctorId,
        status: spec.status,
        source: spec.source,
        leadScore: scoreResult.score,
        temperature: scoreResult.temperature,
        assignedManagerId: spec.assignedManagerId,
        referralPartnerId: spec.referralPartnerId,
        firstResponseDueAt,
        firstRespondedAt: spec.firstRespondedAt,
        lastContactedAt: spec.lastContactedAt,
        nextFollowUpAt: spec.nextFollowUpAt,
        lostReason: spec.lostReason ?? null,
        lostNotes: spec.lostNotes ?? null,
        convertedPatientId: spec.convertedPatientId ?? null,
        convertedCaseId: spec.convertedCaseId ?? null,
        convertedAt: spec.convertedAt ?? null,
      },
      create: {
        id: spec.id,
        referenceNo: spec.referenceNo,
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        whatsappNumber: spec.whatsappNumber,
        nationality: spec.nationality,
        countryOfResidence: spec.countryOfResidence,
        preferredLanguage: spec.preferredLanguage,
        medicalCondition: spec.medicalCondition,
        specialtyInterest: spec.specialtyInterest,
        urgencyLevel: spec.urgencyLevel,
        hasDiagnosticReports: spec.hasDiagnosticReports,
        passportReady: spec.passportReady,
        preferredTravelWindow: spec.preferredTravelWindow,
        estimatedBudgetUsd: spec.estimatedBudgetUsd,
        preliminaryQuoteUsd: spec.preliminaryQuoteUsd,
        preliminaryQuoteNotes: spec.preliminaryQuoteNotes,
        targetHospitalId: spec.targetHospitalId,
        targetDoctorId: spec.targetDoctorId,
        status: spec.status,
        source: spec.source,
        leadScore: scoreResult.score,
        temperature: scoreResult.temperature,
        assignedManagerId: spec.assignedManagerId,
        referralPartnerId: spec.referralPartnerId,
        firstResponseDueAt,
        firstRespondedAt: spec.firstRespondedAt,
        lastContactedAt: spec.lastContactedAt,
        nextFollowUpAt: spec.nextFollowUpAt,
        lostReason: spec.lostReason ?? null,
        lostNotes: spec.lostNotes ?? null,
        convertedPatientId: spec.convertedPatientId ?? null,
        convertedCaseId: spec.convertedCaseId ?? null,
        convertedAt: spec.convertedAt ?? null,
        createdAt: spec.createdAt,
      },
    });

    await prisma.leadActivity.deleteMany({ where: { leadId: upsertedLead.id } });
    for (const act of spec.activities) {
      await prisma.leadActivity.create({
        data: {
          leadId: upsertedLead.id,
          actorId: act.actorId,
          activityType: act.activityType,
          summary: act.summary,
          dueAt: act.dueAt ?? null,
          completedAt: act.completedAt ?? null,
          createdAt: act.createdAt,
        },
      });
    }
  }

  console.log(`  ✓ ${seedLeads.length} Leads CRM records & activity timelines seeded\n`);

  console.log('✅ Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin: admin@afzalhealthcare.in / Admin@123');
  console.log('  Manager:     manager@afzalhealthcare.in / Manager@123');
  console.log('  Doctor:      doctor@afzalhealthcare.in / Doctor@123');
  console.log('  Patient 1:   patient@afzalhealthcare.in / Patient@123');
  console.log('  Patient 2:   omar@afzalhealthcare.in / Patient@123');

  // Suppress unused variable warnings
  void admin;
  void hotel2;
  void hotel3;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
