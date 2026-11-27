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
  console.log(`  ✓ Hospital Coordinator: fortis.ips@mediroute.in / Hospital@123`);

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

  // ─── 6. Medical Hotels ─────────────────────────────────────────────
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
  console.log('  ✓ 3 medical hotels created\n');

  // ─── 8. Treatment Plan (for seed-case-001) ───────────────────────
  console.log('Creating sample treatment plan...');
  await prisma.treatmentPlan.upsert({
    where: { id: 'seed-plan-001' },
    update: {},
    create: {
      id: 'seed-plan-001',
      caseId: 'seed-case-001',
      title: 'Cardiac Bypass Surgery — CABG',
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
  console.log('  ✓ Treatment plan with 5 items created\n');

  // ─── 9. Invoice ──────────────────────────────────────────────────
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
          { description: 'Recovery Suite — Medistay Residency (14 nights)', quantity: 14, unitPrice: 3000, totalPrice: 42000, category: 'ACCOMMODATION', sortOrder: 0 },
        ],
      },
    },
  });
  console.log('  ✓ 2 invoices with payments created\n');

  // ─── 10. Visa Assistance ─────────────────────────────────────────
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
  console.log('  ✓ Visa assistance record created\n');

  // ─── 11. Transfer Bookings ───────────────────────────────────────
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
  console.log('  ✓ 2 transfer bookings created\n');

  // ─── 12. System Config (Revenue settings) ────────────────────────
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
  console.log('  ✓ Revenue config keys seeded\n');

  // ─── 13. Exchange Rates ──────────────────────────────────────────
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
  console.log(`  ✓ ${exchangeRates.length} exchange rates seeded\n`);

  // ─── 14. Legal Consents & Evidentiary Proofs ─────────────────────
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
  console.log('  ✓ 2 digital legal consents seeded\n');

  // ─── 15. e-FRRO Form 'C' Immigration Compliance ─────────────────
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
  console.log('  ✓ 2 Form C records seeded\n');

  // ─── 16. THOTA Organ Transplant Statutory Compliance ────────────
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
  console.log('  ✓ 1 THOTA transplant compliance record seeded\n');

  // ─── 17. NABH Grievance Redressal Records ─────────────────────────
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
  console.log('  ✓ 1 NABH grievance record seeded\n');

  // ─── 18. FEMA & Inward Foreign Remittances ────────────────────────
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
  console.log('  ✓ 1 FEMA remittance record seeded\n');

  // ─── 19. Hospital Quotes (IPS Desk) ───────────────────────────────
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
  console.log('  ✓ 1 Hospital quote seeded\n');

  // ─── 20. Commission Rules Configurator ────────────────────────────
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
  console.log('  ✓ 5 Commission rules seeded\n');

  // ─── 21. Partner Settlements ──────────────────────────────────────
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
  console.log('  ✓ 2 Partner settlements seeded\n');

  console.log('✅ Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin:          admin@mediroute.in / Admin@123');
  console.log('  Manager:              manager@mediroute.in / Manager@123');
  console.log('  Hospital IPS Desk:    fortis.ips@mediroute.in / Hospital@123');
  console.log('  Patient:              patient@mediroute.in / Patient@123');
  console.log('  Doctor:               doctor@mediroute.in / Doctor@123');
  
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

