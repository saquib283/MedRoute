/**
 * Afzal Healthcare â€” Database Seed Script
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
  console.log('ðŸŒ± Seeding database...\n');

  // â”€â”€â”€ 1. Specialisations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  console.log(`  âœ“ ${specialisations.length} specialisations created\n`);

  // â”€â”€â”€ 2. Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  console.log(`  âœ“ Admin: admin@afzalhealthcare.in / Admin@123`);

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
  console.log(`  âœ“ Manager: manager@afzalhealthcare.in / Manager@123`);

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
  console.log(`  âœ“ Doctor: doctor@afzalhealthcare.in / Doctor@123`);

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
      medicalCondition: 'Cardiac evaluation required â€” suspected coronary artery disease',
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
  console.log(`  âœ“ Patient: patient@afzalhealthcare.in / Patient@123\n`);

  // â”€â”€â”€ 3. Hospitals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Hospital IPS Coordinator User
  const hospitalPasswordHash = await bcrypt.hash('Hospital@123', BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: 'fortis.ips@mediroute.in' },
    update: { hospitalId: hospital1.id },
    create: {
      email: 'fortis.ips@mediroute.in',
      passwordHash: hospitalPasswordHash,
      role: 'HOSPITAL',
      fullName: 'Vikramaditya Rao (IPS Desk)',
      phone: '+919876543214',
      hospitalId: hospital1.id,
    },
  });
  console.log(`  âœ“ Hospital Coordinator: fortis.ips@mediroute.in / Hospital@123`);

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

  console.log(`  âœ“ 2 hospitals created\n`);

  // â”€â”€â”€ 4. Doctors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  console.log(`  âœ“ 3 doctors created\n`);

  // â”€â”€â”€ 5. Sample Case & Clinical Workflow Steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ 6. Sample Verification & Hospital-Issued Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ 7. Sample Medical Bills & Itemized Breakdowns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  console.log(`  âœ“ Sample clinical case with ${clinicalStepsData.length} workflow steps & Fit-to-Fly clearance created`);
  console.log(`  âœ“ ${sampleDocs.length} official verification documents & VIL certificates issued`);
  console.log(`  âœ“ Sample medical bill ($4,850 USD) with 5 itemized line-item breakdowns created\n`);

  // â”€â”€â”€ 8. Accommodations & Hotels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  console.log(`  âœ“ 3 partner hotels & 1 accommodation booking ($105 USD partner commission) created\n`);

  // â”€â”€â”€ 9. Platform System Governance Defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  console.log(`  âœ“ ${Object.keys(DEFAULT_SYSTEM_SETTINGS).length} SystemConfig defaults seeded\n`);

  // â”€â”€â”€ 10. B2B Referral Partners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  console.log('  âœ“ 3 B2B Referral Partners created (GULF-MUSCAT, NAIROBI-HEART, EMBASSY-IRQ)\n');

  // â”€â”€â”€ 11. Second Sample International Inquiry Patient (Pre-Travel Triage & Plan Consent) â”€
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
      medicalCondition: 'Exertional angina â€” pre-travel cardiology workup & angiography review',
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
    diagnosis: 'Exertional angina â€” suspected single-vessel coronary stenosis',
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

  console.log(`  âœ“ Second inquiry patient: omar@afzalhealthcare.in / Patient@123 (UNDER_REVIEW)\n`);

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

  // â”€â”€â”€ 12. Advanced Leads CRM Pipeline & Activities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          summary: 'Public web inquiry captured (WEBSITE_INQUIRY) â€” urgent oncology triage requested',
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
          summary: 'Shared $8,800 USD Medanta neurosurgery pro-forma estimate with Embassy attachÃ©',
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
      medicalCondition: 'Exertional angina â€” pre-travel cardiology workup & angiography review',
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
          summary: 'Marked LOST (TIMELINE_POSTPONED) â€” passport renewal pending',
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
        createdAt: spec.createdAt,
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

  console.log(`  âœ“ ${seedLeads.length} Leads CRM records & activity timelines seeded\n`);

  console.log('âœ… Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin: admin@afzalhealthcare.in / Admin@123');
  console.log('  Manager:     manager@afzalhealthcare.in / Manager@123');
  console.log('  Doctor:      doctor@afzalhealthcare.in / Doctor@123');
  console.log('  Patient 1:   patient@afzalhealthcare.in / Patient@123');
  console.log('  Patient 2:   omar@afzalhealthcare.in / Patient@123');


  // â”€â”€â”€ 6. Medical Hotels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Creating medical hotels...');
  await prisma.hostel.upsert({
    where: { id: 'seed-hostel-001' },
    update: {
      name: 'Grand HealthSuites & Recovery Inn',
      city: 'New Delhi',
      address: 'A-12, Saket Institutional Area, New Delhi, Delhi 110017',
      description: 'Luxury medical recuperation hotel situated right next to Max Super Speciality Hospital. Features 24/7 on-call nursing, patient-accessible elevators, custom diet meals, and dedicated international patient concierge.',
      capacity: 60,
      pricingPerNight: 2800,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE'],
      amenities: [
        '24/7 On-Call Nursing',
        'Wheelchair Accessible',
        'Hospital Shuttle (Free)',
        'Custom Medical Meals',
        'High-Speed Wi-Fi',
        'Oxygen Cylinder Support',
        'Private Kitchenette',
        'Air Conditioned'
      ],
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.3 km from Max Super Speciality Hospital',
      rating: 4.9,
      contactPhone: '+91 11 4055 8899',
      rules: 'Check-in: 12:00 PM | Check-out: 11:00 AM. Quiet hours from 10:00 PM. No smoking inside rooms. 1 attendant stay allowed per single room.',
    },
    create: {
      id: 'seed-hostel-001',
      name: 'Grand HealthSuites & Recovery Inn',
      city: 'New Delhi',
      address: 'A-12, Saket Institutional Area, New Delhi, Delhi 110017',
      description: 'Luxury medical recuperation hotel situated right next to Max Super Speciality Hospital. Features 24/7 on-call nursing, patient-accessible elevators, custom diet meals, and dedicated international patient concierge.',
      capacity: 60,
      pricingPerNight: 2800,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE'],
      amenities: [
        '24/7 On-Call Nursing',
        'Wheelchair Accessible',
        'Hospital Shuttle (Free)',
        'Custom Medical Meals',
        'High-Speed Wi-Fi',
        'Oxygen Cylinder Support',
        'Private Kitchenette',
        'Air Conditioned'
      ],
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.3 km from Max Super Speciality Hospital',
      rating: 4.9,
      contactPhone: '+91 11 4055 8899',
      rules: 'Check-in: 12:00 PM | Check-out: 11:00 AM. Quiet hours from 10:00 PM. No smoking inside rooms. 1 attendant stay allowed per single room.',
    },
  });

  await prisma.hostel.upsert({
    where: { id: 'seed-hostel-002' },
    update: {
      name: 'Gurugram Wellness Medical Lodge',
      city: 'Gurugram',
      address: 'Sector 38, Medicity Enclave, Gurugram, Haryana 122001',
      description: 'Dedicated post-operative recovery hotel located 2 minutes from Medanta - The Medicity. Features anti-microbial clean suites, adjustable medical beds, in-house physiotherapist assistance, and multi-cuisine halal food.',
      capacity: 45,
      pricingPerNight: 3200,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE', 'DORMITORY'],
      amenities: [
        'Adjustable Hospital Beds',
        '24/7 Nursing & Vitals Check',
        'In-House Physiotherapist',
        'Halal & Custom Diet Kitchen',
        'Wheelchair Ramp Access',
        'Free Airport Pickup',
        'Laundry Service',
        'High-Speed Wi-Fi'
      ],
      images: [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.5 km from Medanta The Medicity',
      rating: 4.8,
      contactPhone: '+91 124 4900 112',
      rules: 'Check-in: 2:00 PM | Check-out: 12:00 PM. Medical assistance available round the clock.',
    },
    create: {
      id: 'seed-hostel-002',
      name: 'Gurugram Wellness Medical Lodge',
      city: 'Gurugram',
      address: 'Sector 38, Medicity Enclave, Gurugram, Haryana 122001',
      description: 'Dedicated post-operative recovery hotel located 2 minutes from Medanta - The Medicity. Features anti-microbial clean suites, adjustable medical beds, in-house physiotherapist assistance, and multi-cuisine halal food.',
      capacity: 45,
      pricingPerNight: 3200,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE', 'DORMITORY'],
      amenities: [
        'Adjustable Hospital Beds',
        '24/7 Nursing & Vitals Check',
        'In-House Physiotherapist',
        'Halal & Custom Diet Kitchen',
        'Wheelchair Ramp Access',
        'Free Airport Pickup',
        'Laundry Service',
        'High-Speed Wi-Fi'
      ],
      images: [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.5 km from Medanta The Medicity',
      rating: 4.8,
      contactPhone: '+91 124 4900 112',
      rules: 'Check-in: 2:00 PM | Check-out: 12:00 PM. Medical assistance available round the clock.',
    },
  });

  await prisma.hostel.upsert({
    where: { id: 'seed-hostel-003' },
    update: {
      name: 'Apollo Care Residency & Suites',
      city: 'Chennai',
      address: 'Greams Road, Thousand Lights, Chennai, Tamil Nadu 600006',
      description: 'Premium healthcare hospitality suites located walking distance from Apollo Hospital Greams Road. Designed specifically for cardiac, transplant, and orthopedic surgery patients with family accommodation suites.',
      capacity: 70,
      pricingPerNight: 2400,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE'],
      amenities: [
        '24/7 Emergency Response',
        'Translator Service (Arabic/French)',
        'Wheelchair Accessible',
        'Free Hospital Shuttle',
        'High-Speed Wi-Fi',
        'Kitchenette in Suites',
        'Doctor-Prescribed Catering'
      ],
      images: [
        'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.2 km from Apollo Hospital Greams Road',
      rating: 4.9,
      contactPhone: '+91 44 2829 0333',
      rules: 'Check-in: 1:00 PM | Check-out: 11:00 AM. 24/7 Concierge desk active.',
    },
    create: {
      id: 'seed-hostel-003',
      name: 'Apollo Care Residency & Suites',
      city: 'Chennai',
      address: 'Greams Road, Thousand Lights, Chennai, Tamil Nadu 600006',
      description: 'Premium healthcare hospitality suites located walking distance from Apollo Hospital Greams Road. Designed specifically for cardiac, transplant, and orthopedic surgery patients with family accommodation suites.',
      capacity: 70,
      pricingPerNight: 2400,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE'],
      amenities: [
        '24/7 Emergency Response',
        'Translator Service (Arabic/French)',
        'Wheelchair Accessible',
        'Free Hospital Shuttle',
        'High-Speed Wi-Fi',
        'Kitchenette in Suites',
        'Doctor-Prescribed Catering'
      ],
      images: [
        'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80',
      ],
      distanceToHospital: '0.2 km from Apollo Hospital Greams Road',
      rating: 4.9,
      contactPhone: '+91 44 2829 0333',
      rules: 'Check-in: 1:00 PM | Check-out: 11:00 AM. 24/7 Concierge desk active.',
    },
  });
  console.log('  âœ“ 3 medical hotels created\n');

  // â”€â”€â”€ 8. Treatment Plan (for seed-case-001) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Creating sample treatment plan...');
  await prisma.treatmentPlan.upsert({
    where: { id: 'seed-plan-001' },
    update: {},
    create: {
      id: 'seed-plan-001',
      caseId: 'seed-case-001',
      title: 'Cardiac Bypass Surgery â€” CABG',
      description: 'Triple-vessel coronary artery bypass graft with pre-op evaluation and post-op ICU stay.',
      status: 'ACCEPTED',
      totalEstimatedCost: 450000,
      estimatedDuration: '10-14 days',
      estimatedHospitalStay: '7 nights',
      estimatedRecovery: '4-6 weeks',
      sentAt: new Date('2026-08-20'),
      respondedAt: new Date('2026-08-21'),
      createdBy: manager.id,
      items: {
        create: [
          { itemType: 'CONSULTATION', description: 'Pre-op Cardiology Consultation', quantity: 1, unitCost: 5000, totalCost: 5000, hospitalId: 'seed-hospital-001', sortOrder: 0 },
          { itemType: 'TEST', description: 'Coronary Angiography', quantity: 1, unitCost: 25000, totalCost: 25000, hospitalId: 'seed-hospital-001', sortOrder: 1 },
          { itemType: 'PROCEDURE', description: 'CABG Surgery (Triple Vessel)', quantity: 1, unitCost: 350000, totalCost: 350000, hospitalId: 'seed-hospital-001', sortOrder: 2 },
          { itemType: 'ROOM_CHARGE', description: 'ICU (3 nights) + Private Room (4 nights)', quantity: 7, unitCost: 8000, totalCost: 56000, hospitalId: 'seed-hospital-001', sortOrder: 3 },
          { itemType: 'MEDICATION', description: 'Post-op medication course', quantity: 1, unitCost: 14000, totalCost: 14000, sortOrder: 4 },
        ],
      },
    },
  });
  console.log('  âœ“ Treatment plan with 5 items created\n');

  // â”€â”€â”€ 9. Invoice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Creating sample invoices...');
  await prisma.invoice.upsert({
    where: { id: 'seed-invoice-001' },
    update: {},
    create: {
      id: 'seed-invoice-001',
      caseId: 'seed-case-001',
      hospitalId: 'seed-hospital-001',
      invoiceNumber: 'MR-INV-2026-00001',
      invoiceType: 'TREATMENT',
      status: 'PARTIALLY_PAID',
      subtotal: 450000,
      taxRate: 18,
      taxAmount: 81000,
      commissionRate: 20,
      commissionAmount: 90000,
      totalAmount: 531000,
      paidAmount: 300000,
      balanceDue: 231000,
      currency: 'INR',
      notes: 'Advance payment received. Balance due after discharge.',
      dueDate: new Date('2026-09-15'),
      issuedAt: new Date('2026-08-22'),
      createdBy: manager.id,
      lineItems: {
        create: [
          { description: 'Pre-op Consultation', quantity: 1, unitPrice: 5000, totalPrice: 5000, category: 'PROCEDURE', sortOrder: 0 },
          { description: 'Coronary Angiography', quantity: 1, unitPrice: 25000, totalPrice: 25000, category: 'PROCEDURE', sortOrder: 1 },
          { description: 'CABG Surgery', quantity: 1, unitPrice: 350000, totalPrice: 350000, category: 'PROCEDURE', sortOrder: 2 },
          { description: 'Hospital Stay (7 nights)', quantity: 7, unitPrice: 8000, totalPrice: 56000, category: 'ROOM', sortOrder: 3 },
          { description: 'Medications', quantity: 1, unitPrice: 14000, totalPrice: 14000, category: 'MEDICATION', sortOrder: 4 },
        ],
      },
      payments: {
        create: [
          { amount: 200000, paymentMethod: 'INTERNATIONAL_WIRE', referenceNo: 'WIRE-2026-8820', paidAt: new Date('2026-08-22'), notes: 'Initial advance', recordedBy: manager.id },
          { amount: 100000, paymentMethod: 'CARD', referenceNo: 'TXN-VISA-9922', paidAt: new Date('2026-08-25'), notes: 'Second installment', recordedBy: manager.id },
        ],
      },
    },
  });

  // Accommodation invoice
  await prisma.invoice.upsert({
    where: { id: 'seed-invoice-002' },
    update: {},
    create: {
      id: 'seed-invoice-002',
      caseId: 'seed-case-001',
      invoiceNumber: 'MR-INV-2026-00002',
      invoiceType: 'ACCOMMODATION',
      status: 'SENT',
      subtotal: 42000,
      taxRate: 18,
      taxAmount: 7560,
      commissionRate: 15,
      commissionAmount: 6300,
      totalAmount: 49560,
      paidAmount: 0,
      balanceDue: 49560,
      currency: 'INR',
      dueDate: new Date('2026-09-10'),
      issuedAt: new Date('2026-08-23'),
      createdBy: manager.id,
      lineItems: {
        create: [
          { description: 'Recovery Suite â€” Medistay Residency (14 nights)', quantity: 14, unitPrice: 3000, totalPrice: 42000, category: 'ACCOMMODATION', sortOrder: 0 },
        ],
      },
    },
  });
  console.log('  âœ“ 2 invoices with payments created\n');

  // â”€â”€â”€ 10. Visa Assistance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Creating visa assistance record...');
  await prisma.visaAssistance.upsert({
    where: { id: 'seed-visa-001' },
    update: {},
    create: {
      id: 'seed-visa-001',
      caseId: 'seed-case-001',
      hospitalId: 'seed-hospital-001',
      status: 'SENT',
      patientFullName: 'Amara Okafor',
      nationality: 'Nigerian',
      treatmentDescription: 'Coronary Artery Bypass Graft (CABG) surgery with pre and post-operative care.',
      estimatedArrival: new Date('2026-09-01'),
      estimatedDeparture: new Date('2026-09-28'),
      frroRequired: false,
      attendantCount: 1,
      attendantDetails: [{ name: 'Emeka Okafor', passport: 'A12345678', relation: 'Brother' }],
      generatedAt: new Date('2026-08-18'),
      sentAt: new Date('2026-08-19'),
    },
  });
  console.log('  âœ“ Visa assistance record created\n');

  // â”€â”€â”€ 11. Transfer Bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Creating transfer bookings...');
  await prisma.transferBooking.createMany({
    data: [
      {
        id: 'seed-transfer-001',
        caseId: 'seed-case-001',
        transferType: 'AIRPORT_PICKUP',
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-09-01T14:30:00'),
        pickupLocation: 'Indira Gandhi International Airport, Terminal 3',
        dropLocation: 'Medistay Health Residency, Saket, New Delhi',
        vehicleType: 'SUV',
        driverName: 'Rajesh Kumar',
        driverPhone: '+91 98765 43210',
        estimatedCost: 1500,
        passengerCount: 2,
      },
      {
        id: 'seed-transfer-002',
        caseId: 'seed-case-001',
        transferType: 'HOSPITAL_TRANSFER',
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-09-02T08:00:00'),
        pickupLocation: 'Medistay Health Residency',
        dropLocation: 'Fortis Escorts Heart Institute, Okhla Road',
        vehicleType: 'SEDAN',
        estimatedCost: 800,
        passengerCount: 1,
      },
    ],
    skipDuplicates: true,
  });
  console.log('  âœ“ 2 transfer bookings created\n');

  // â”€â”€â”€ 12. System Config (Revenue settings) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding revenue config keys...');
  const revenueConfigs = [
    { key: 'defaultCommissionRate', value: '20' },
    { key: 'defaultHotelCommission', value: '15' },
    { key: 'taxRate', value: '18' },
    { key: 'invoicePrefix', value: 'MR-INV' },
    { key: 'companyName', value: 'MediRoute India Pvt. Ltd.' },
    { key: 'companyAddress', value: 'Plot 42, Sector 18, Noida, Uttar Pradesh 201301, India' },
    { key: 'companyGSTIN', value: '09ABCDE1234F1Z5' },
  ];
  for (const cfg of revenueConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }
  console.log('  âœ“ Revenue config keys seeded\n');

  // â”€â”€â”€ 13. Exchange Rates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding baseline exchange rates...');
  const exchangeRates = [
    { toCurrency: 'USD', rate: 0.0116, inverseRate: 86.20 },
    { toCurrency: 'AED', rate: 0.0426, inverseRate: 23.47 },
    { toCurrency: 'SAR', rate: 0.0435, inverseRate: 22.98 },
    { toCurrency: 'OMR', rate: 0.00446, inverseRate: 224.20 },
    { toCurrency: 'QAR', rate: 0.0422, inverseRate: 23.70 },
    { toCurrency: 'KWD', rate: 0.00356, inverseRate: 280.90 },
    { toCurrency: 'BHD', rate: 0.00437, inverseRate: 228.80 },
    { toCurrency: 'NGN', rate: 18.55, inverseRate: 0.0539 },
    { toCurrency: 'KES', rate: 1.51, inverseRate: 0.662 },
    { toCurrency: 'TZS', rate: 30.50, inverseRate: 0.0328 },
    { toCurrency: 'GHS', rate: 0.178, inverseRate: 5.62 },
    { toCurrency: 'ZAR', rate: 0.215, inverseRate: 4.65 },
    { toCurrency: 'ETB', rate: 1.45, inverseRate: 0.69 },
    { toCurrency: 'BDT', rate: 1.39, inverseRate: 0.72 },
    { toCurrency: 'NPR', rate: 1.60, inverseRate: 0.625 },
    { toCurrency: 'LKR', rate: 3.48, inverseRate: 0.287 },
    { toCurrency: 'MVR', rate: 0.179, inverseRate: 5.58 },
    { toCurrency: 'GBP', rate: 0.0091, inverseRate: 109.90 },
    { toCurrency: 'EUR', rate: 0.0108, inverseRate: 92.60 },
    { toCurrency: 'CAD', rate: 0.0162, inverseRate: 61.70 },
    { toCurrency: 'AUD', rate: 0.0180, inverseRate: 55.55 },
  ];

  for (const er of exchangeRates) {
    await prisma.exchangeRate.upsert({
      where: { toCurrency: er.toCurrency },
      update: { rate: er.rate, inverseRate: er.inverseRate },
      create: {
        fromCurrency: 'INR',
        toCurrency: er.toCurrency,
        rate: er.rate,
        inverseRate: er.inverseRate,
        source: 'SYSTEM_DEFAULT',
        isLocked: false,
        markupPercent: 0,
      },
    });
  }
  console.log(`  âœ“ ${exchangeRates.length} exchange rates seeded\n`);

  // â”€â”€â”€ 14. Legal Consents & Evidentiary Proofs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding digital legal consents & proofs...');
  await prisma.legalConsent.upsert({
    where: { verificationCode: 'MR-PROOF-2026-N8K3X' },
    update: {},
    create: {
      id: 'seed-consent-001',
      verificationCode: 'MR-PROOF-2026-N8K3X',
      consentType: 'TREATMENT_PLAN_ACCEPTANCE',
      caseId: 'seed-case-001',
      patientId: patient.id,
      entityType: 'TreatmentPlan',
      entityId: 'seed-plan-001',
      documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signerFullName: 'Amara Okafor',
      signerEmail: 'patient@mediroute.in',
      signerRole: 'PATIENT',
      statement: 'I, Amara Okafor, hereby formally accept and confirm Treatment Plan "Comprehensive Cardiac Revascularization (CABG)" with an estimated cost of INR 520,000 at Fortis Escorts Heart Institute. I authorize MediRoute India to coordinate and transmit my medical records to the designated hospital medical board.',
      metadata: {
        planTitle: 'Comprehensive Cardiac Revascularization (CABG)',
        totalEstimatedCost: 520000,
        currency: 'INR',
        hospitalName: 'Fortis Escorts Heart Institute',
      },
      ipAddress: '197.210.226.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
      geoCountry: 'NG',
      signedAt: new Date('2026-08-16T11:20:00Z'),
    },
  });

  await prisma.legalConsent.upsert({
    where: { verificationCode: 'MR-PROOF-2026-TRV91' },
    update: {},
    create: {
      id: 'seed-consent-002',
      verificationCode: 'MR-PROOF-2026-TRV91',
      consentType: 'MEDICAL_TRAVEL_AGREEMENT',
      caseId: 'seed-case-001',
      patientId: patient.id,
      documentHash: 'a7c5b138e9d2f64a1b0c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a',
      signerFullName: 'Amara Okafor',
      signerEmail: 'patient@mediroute.in',
      signerRole: 'PATIENT',
      statement: 'I, Amara Okafor (Nationality: Nigerian, Passport: A12345678), hereby consent to medical tourism travel to India coordinated by MediRoute India Pvt. Ltd. I acknowledge that MediRoute acts strictly as a healthcare facilitator and not as a treating hospital.',
      metadata: {
        nationality: 'Nigerian',
        passportNumber: 'A12345678',
        purpose: 'Medical Travel Facilitation',
      },
      ipAddress: '197.210.226.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
      geoCountry: 'NG',
      signedAt: new Date('2026-08-14T09:15:00Z'),
    },
  });
  console.log('  âœ“ 2 digital legal consents seeded\n');

  // â”€â”€â”€ 15. e-FRRO Form 'C' Immigration Compliance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding e-FRRO Form C registrations...');
  const arrivalDate = new Date('2026-09-01T14:30:00Z');
  const deadline = new Date(arrivalDate.getTime() + 24 * 60 * 60 * 1000);

  await prisma.formCRegistration.upsert({
    where: { id: 'seed-formc-001' },
    update: {},
    create: {
      id: 'seed-formc-001',
      caseId: 'seed-case-001',
      patientId: patient.id,
      hostelName: 'Medistay Health Residency, Saket',
      guestFullName: 'Amara Okafor',
      nationality: 'Nigerian',
      passportNumber: 'A12345678',
      visaNumber: 'MED-IN-889412',
      visaType: 'MEDICAL',
      arrivalDate,
      departureDate: new Date('2026-09-28'),
      deadline,
      status: 'SUBMITTED_TO_BOI',
      formCApplicationNumber: 'BOI-DEL-2026-89412',
      submittedAt: new Date('2026-09-01T18:00:00Z'),
      submittedBy: 'manager@mediroute.in',
      notes: 'Form C filed within 4 hours of arrival at guest house.',
    },
  });

  await prisma.formCRegistration.upsert({
    where: { id: 'seed-formc-002' },
    update: {},
    create: {
      id: 'seed-formc-002',
      caseId: 'seed-case-001',
      patientId: patient.id,
      hostelName: 'Medistay Health Residency, Saket',
      guestFullName: 'Emeka Okafor (Attendant)',
      nationality: 'Nigerian',
      passportNumber: 'A87654321',
      visaNumber: 'MEDX-IN-889413',
      visaType: 'MEDICAL_ATTENDANT',
      arrivalDate,
      departureDate: new Date('2026-09-28'),
      deadline,
      status: 'ACKNOWLEDGED',
      formCApplicationNumber: 'BOI-DEL-2026-89413',
      submittedAt: new Date('2026-09-01T18:15:00Z'),
      submittedBy: 'manager@mediroute.in',
      notes: 'Attendant Form C acknowledged by FRRO Delhi.',
    },
  });
  console.log('  âœ“ 2 Form C records seeded\n');

  // â”€â”€â”€ 16. THOTA Organ Transplant Statutory Compliance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding THOTA transplant compliance...');
  await prisma.transplantCompliance.upsert({
    where: { caseId: 'seed-case-001' },
    update: {},
    create: {
      id: 'seed-thota-001',
      caseId: 'seed-case-001',
      patientId: patient.id,
      organType: 'KIDNEY (Living Donor)',
      donorFullName: 'Emeka Okafor',
      donorNationality: 'Nigerian',
      donorPassport: 'A87654321',
      donorRelation: 'BROTHER (Near Relative)',
      donorAge: 32,
      form21EmbassyNocUrl: '/uploads/embassy_form21_amara_okafor.pdf',
      form11JointApplicationUrl: '/uploads/form11_joint_living_donor.pdf',
      dnaTissueTypingReportUrl: '/uploads/dna_hla_matching_report.pdf',
      approvalStatus: 'APPROVED_NOC_ISSUED',
      committeeMeetingDate: new Date('2026-08-20'),
      committeeNocNumber: 'NOC-THOTA-DEL-2026-1049',
      committeeDecisionNotes: 'Authorisation committee verified living sibling relationship via Embassy Form 21. No commercial dealing observed.',
      verifiedAt: new Date('2026-08-20T16:00:00Z'),
      verifiedBy: 'compliance@mediroute.in',
    },
  });
  console.log('  âœ“ 1 THOTA transplant compliance record seeded\n');

  // â”€â”€â”€ 17. NABH Grievance Redressal Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding NABH grievance records...');
  const grvCreated = new Date('2026-08-22T10:00:00Z');
  await prisma.grievanceRecord.upsert({
    where: { ticketNumber: 'MR-GRV-2026-0042' },
    update: {},
    create: {
      id: 'seed-grv-001',
      ticketNumber: 'MR-GRV-2026-0042',
      patientId: patient.id,
      caseId: 'seed-case-001',
      category: 'ACCOMMODATION_TRANSPORT',
      severity: 'MEDIUM',
      subject: 'Specialized low-sodium cardiac diet request at accommodation',
      description: 'Patient requires strictly low-sodium meals during post-op stay. Need coordination with guest house kitchen.',
      status: 'RESOLVED',
      acknowledgedAt: new Date('2026-08-22T14:30:00Z'),
      acknowledgedBy: 'manager@mediroute.in',
      resolutionNotes: 'Coordinated directly with chef at Medistay Health Residency. Tailored cardiac meal plan confirmed.',
      resolvedAt: new Date('2026-08-23T11:00:00Z'),
      resolvedBy: 'manager@mediroute.in',
      slaAcknowledgeDeadline: new Date(grvCreated.getTime() + 48 * 60 * 60 * 1000),
      slaResolutionDeadline: new Date(grvCreated.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: grvCreated,
    },
  });
  console.log('  âœ“ 1 NABH grievance record seeded\n');

  // â”€â”€â”€ 18. FEMA & Inward Foreign Remittances â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding FEMA remittances...');
  await prisma.femaRemittance.upsert({
    where: { id: 'seed-fema-001' },
    update: {},
    create: {
      id: 'seed-fema-001',
      invoiceId: 'seed-invoice-001',
      fircNumber: 'FIRC-HDFC-IN-2026-89412',
      swiftReference: 'HDFCINBBA0984214',
      remittingBank: 'First Bank of Nigeria, Lagos',
      remittingCountry: 'Nigeria (NG)',
      foreignCurrency: 'USD',
      foreignAmount: 6240.00,
      inrRealizedAmount: 520000.00,
      exchangeRateApplied: 83.33333333,
      isLutExportCovered: true,
      fircCertificateUrl: '/uploads/firc_cert_amara_okafor.pdf',
      realizedAt: new Date('2026-08-16T15:30:00Z'),
    },
  });
  console.log('  âœ“ 1 FEMA remittance record seeded\n');

  // â”€â”€â”€ 19. Hospital Quotes (IPS Desk) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding Hospital Quotes...');
  await prisma.hospitalQuote.upsert({
    where: { id: 'seed-hosp-quote-001' },
    update: {},
    create: {
      id: 'seed-hosp-quote-001',
      caseId: 'seed-case-001',
      hospitalId: hospital1.id,
      doctorId: 'seed-doctor-001',
      title: 'Minimally Invasive CABG & Cardiac Rehabilitation Package',
      description: 'Comprehensive 4-vessel off-pump coronary bypass surgery package including 2 ICU days and 4 Deluxe Single ward days.',
      estimatedStayDays: 6,
      icuDays: 2,
      roomCategory: 'DELUXE_SINGLE',
      estimatedCost: 5800,
      currency: 'USD',
      inclusions: ['Surgeon & Anaesthetist fees', '2 ICU days with 1:1 nursing', '4 Deluxe ward days', 'Pre-op angiography & bloods', 'Post-op cardiac rehab consultation'],
      exclusions: ['High-end coronary stents/implants if required', 'Cross-consultations for unrelated comorbidities', 'Emergency blood product transfusions'],
      status: 'ACCEPTED_BY_PATIENT',
      validUntil: new Date('2026-10-31'),
      submittedBy: 'fortis.ips@mediroute.in',
    },
  });
  console.log('  âœ“ 1 Hospital quote seeded\n');

  // â”€â”€â”€ 20. Commission Rules Configurator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding Commission Rules...');
  await prisma.commissionRule.upsert({
    where: { id: 'seed-rule-001' },
    update: {},
    create: {
      id: 'seed-rule-001',
      ruleName: 'Global Hospital Surgical Standard Cut',
      category: 'HOSPITAL_SURGICAL',
      partnerId: null,
      partnerName: null,
      ratePercent: 12.5,
      isActive: true,
      notes: 'Standard 12.5% facilitation margin on tertiary inpatient hospital packages.',
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'seed-rule-002' },
    update: {},
    create: {
      id: 'seed-rule-002',
      ruleName: 'Fortis Escorts Heart Institute Contracted Rate',
      category: 'HOSPITAL_SURGICAL',
      partnerId: hospital1.id,
      partnerName: 'Fortis Escorts Heart Institute',
      ratePercent: 12.5,
      isActive: true,
      notes: 'NABH/JCI contracted rate for cardiac interventions.',
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'seed-rule-003' },
    update: {},
    create: {
      id: 'seed-rule-003',
      ruleName: 'Global Recovery Hotel & Guest House Cut',
      category: 'HOTEL_ACCOMMODATION',
      partnerId: null,
      partnerName: null,
      ratePercent: 15.0,
      isActive: true,
      notes: 'Standard 15% booking cut on post-op sanitized accommodation stays.',
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'seed-rule-004' },
    update: {},
    create: {
      id: 'seed-rule-004',
      ruleName: 'Medistay Health Residency Preferred Partner Rate',
      category: 'HOTEL_ACCOMMODATION',
      partnerId: 'seed-hostel-001',
      partnerName: 'Medistay Health Residency, Saket',
      ratePercent: 18.0,
      isActive: true,
      notes: 'Preferred accommodation partner offering specialized cardiac low-sodium diets.',
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'seed-rule-005' },
    update: {},
    create: {
      id: 'seed-rule-005',
      ruleName: 'Airport Transit & Ambulance Logistics Markup',
      category: 'LOGISTICS_TRANSFER',
      partnerId: null,
      partnerName: null,
      ratePercent: 20.0,
      isActive: true,
      notes: 'Logistics coordination cut for wheelchair & stretcher airport transfers.',
    },
  });
  console.log('  âœ“ 5 Commission rules seeded\n');

  // â”€â”€â”€ 21. Partner Settlements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Seeding Partner Settlements...');
  await prisma.partnerSettlement.upsert({
    where: { settlementNumber: 'MR-SET-2026-0001' },
    update: {},
    create: {
      id: 'seed-settlement-001',
      settlementNumber: 'MR-SET-2026-0001',
      partnerType: 'HOSPITAL',
      partnerId: hospital1.id,
      partnerName: 'Fortis Escorts Heart Institute',
      invoiceId: 'seed-invoice-001',
      grossAmount: 480000,
      commissionRate: 12.5,
      commissionAmount: 60000,
      netPayable: 420000,
      currency: 'INR',
      status: 'APPROVED',
      paymentReference: 'NEFT-HDFC-984214589',
      paidAt: new Date('2026-08-18T12:00:00Z'),
      processedBy: 'admin@mediroute.in',
      notes: 'Inpatient surgical package settlement for Amara Okafor.',
    },
  });

  await prisma.partnerSettlement.upsert({
    where: { settlementNumber: 'MR-SET-2026-0002' },
    update: {},
    create: {
      id: 'seed-settlement-002',
      settlementNumber: 'MR-SET-2026-0002',
      partnerType: 'HOTEL',
      partnerId: 'seed-hostel-001',
      partnerName: 'Medistay Health Residency, Saket',
      invoiceId: 'seed-invoice-001',
      grossAmount: 40000,
      commissionRate: 18.0,
      commissionAmount: 7200,
      netPayable: 32800,
      currency: 'INR',
      status: 'PENDING',
      notes: '7 Nights deluxe recovery room + specialized cardiac meals.',
    },
  });
  console.log('  âœ“ 2 Partner settlements seeded\n');

  console.log('âœ… Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin:          admin@mediroute.in / Admin@123');
  console.log('  Manager:              manager@mediroute.in / Manager@123');
  console.log('  Hospital IPS Desk:    fortis.ips@mediroute.in / Hospital@123');
  console.log('  Patient:              patient@mediroute.in / Patient@123');
  console.log('  Doctor:               doctor@mediroute.in / Doctor@123');
  

  console.log('Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin:          admin@afzalhealthcare.in / Admin@123');
  console.log('  Manager:              manager@afzalhealthcare.in / Manager@123');
  console.log('  Doctor:               doctor@afzalhealthcare.in / Doctor@123');
  console.log('  Hospital IPS Desk:    fortis.ips@mediroute.in / Hospital@123');
  console.log('  Patient 1:            patient@afzalhealthcare.in / Patient@123');
  console.log('  Patient 2:            omar@afzalhealthcare.in / Patient@123');
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

