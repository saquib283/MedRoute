/**
 * MediRoute India — Database Seed Script
 * Seeds specialisations, test users, and sample partner data.
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

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
    where: { email: 'admin@mediroute.in' },
    update: {},
    create: {
      email: 'admin@mediroute.in',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      fullName: 'Rahul Mehra',
      phone: '+919876543210',
    },
  });
  console.log(`  ✓ Admin: admin@mediroute.in / Admin@123`);

  // Manager
  const managerPasswordHash = await bcrypt.hash('Manager@123', BCRYPT_ROUNDS);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@mediroute.in' },
    update: {},
    create: {
      email: 'manager@mediroute.in',
      passwordHash: managerPasswordHash,
      role: 'MANAGER',
      fullName: 'Priya Sharma',
      phone: '+919876543211',
    },
  });
  console.log(`  ✓ Manager: manager@mediroute.in / Manager@123`);

  // Patient
  const patientPasswordHash = await bcrypt.hash('Patient@123', BCRYPT_ROUNDS);
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@mediroute.in' },
    update: {},
    create: {
      email: 'patient@mediroute.in',
      passwordHash: patientPasswordHash,
      role: 'PATIENT',
      fullName: 'Ranya Al-Hassan',
      phone: '+971501234567',
    },
  });

  // Create patient profile
  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      nationality: 'UAE',
      passportNo: 'A12345678',
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

  // Create medical profile
  await prisma.patientMedicalProfile.upsert({
    where: { patientId: patient.id },
    update: {},
    create: {
      patientId: patient.id,
      allergies: JSON.parse('["Penicillin", "Sulfa drugs"]'),
      medications: JSON.parse('[{"name": "Aspirin", "dosage": "81mg", "frequency": "Daily"}]'),
      surgeries: JSON.parse('[{"name": "Appendectomy", "date": "2015-06-20", "notes": "Laparoscopic"}]'),
      chronicConditions: JSON.parse('["Hypertension", "Type 2 Diabetes"]'),
      specialisationsRequired: ['Cardiology'],
    },
  });
  console.log(`  ✓ Patient: patient@mediroute.in / Patient@123`);

  // Doctor
  const doctorPasswordHash = await bcrypt.hash('Doctor@123', BCRYPT_ROUNDS);
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@mediroute.in' },
    update: {},
    create: {
      email: 'doctor@mediroute.in',
      passwordHash: doctorPasswordHash,
      role: 'DOCTOR',
      fullName: 'Dr. Ashok Seth',
      phone: '+919876543212',
    },
  });
  console.log(`  ✓ Doctor: doctor@mediroute.in / Doctor@123\n`);

  // ─── 3. Sample Case ──────────────────────────────────────────────
  console.log('Creating sample case...');
  await prisma.case.upsert({
    where: { id: 'seed-case-001' },
    update: {},
    create: {
      id: 'seed-case-001',
      patientId: patient.id,
      managerId: manager.id,
      status: 'UNDER_REVIEW',
      notes: 'Patient requires cardiac evaluation. Reports uploaded. Awaiting hospital slot confirmation.',
    },
  });
  console.log('  ✓ Sample case created\n');

  // ─── 4. Hospitals ─────────────────────────────────────────────────
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

  // ─── 5. Doctors ───────────────────────────────────────────────────
  console.log('Creating doctors...');

  if (cardiologySpec) {
    await prisma.doctor.upsert({
      where: { id: 'seed-doctor-001' },
      update: {},
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

  // ─── 6. Hostel ────────────────────────────────────────────────────
  console.log('Creating hostel...');
  await prisma.hostel.upsert({
    where: { id: 'seed-hostel-001' },
    update: {},
    create: {
      id: 'seed-hostel-001',
      name: 'MediStay Residences',
      city: 'New Delhi',
      address: 'A-12, Saket, New Delhi, Delhi 110017',
      capacity: 50,
      pricingPerNight: 1500,
      roomTypes: ['SINGLE', 'DOUBLE', 'SUITE'],
    },
  });
  console.log('  ✓ 1 hostel created\n');

  console.log('✅ Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin: admin@mediroute.in / Admin@123');
  console.log('  Manager:     manager@mediroute.in / Manager@123');
  console.log('  Patient:     patient@mediroute.in / Patient@123');
  console.log('  Doctor:      doctor@mediroute.in / Doctor@123');
  
  // Suppress unused variable warnings
  void admin;
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
