/**
 * Afzal Healthcare — Database Seed Script
 * Seeds specialisations, test users, and sample partner data.
 * Run with: npx tsx prisma/seed.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { DocumentCategory, Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from '../src/lib/auth/crypto';
import { encryptMedicalProfile } from '../src/lib/api/phi-encryption';

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
  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {
      passportNo: encryptedPassportNo,
    },
    create: {
      userId: patientUser.id,
      nationality: 'UAE',
      passportNo: encryptedPassportNo,
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
  const sampleCase = await prisma.case.upsert({
    where: { id: 'seed-case-001' },
    update: {
      status: 'WARD_RECOVERY',
    },
    create: {
      id: 'seed-case-001',
      patientId: patient.id,
      managerId: manager.id,
      status: 'WARD_RECOVERY',
      notes: 'Patient undergoing post-operative cardiac catheterization recovery and monitoring.',
      isUrgent: false,
    },
  });

  await prisma.clinicalStep.deleteMany({ where: { caseId: sampleCase.id } });

  const clinicalStepsData = [
    {
      title: 'Inquiry & Initial Medical File Review',
      category: 'PRE_OP',
      status: 'COMPLETED',
      doctorNotes: 'Coronary angiography scans and cardiac panel received. Referred to Senior Cardiologist.',
      completedAt: new Date(Date.now() - 14 * 86400000),
    },
    {
      title: 'Multi-Disciplinary Team (MDT) Board Clearance',
      category: 'PRE_OP',
      status: 'COMPLETED',
      decisionBranch: 'APPROVED_FOR_SURGERY',
      doctorNotes: 'MDT Board approves elective Percutaneous Coronary Intervention (PCI) with drug-eluting stent.',
      completedAt: new Date(Date.now() - 10 * 86400000),
    },
    {
      title: 'Pre-Anesthesia Clearance (PAC) & Cardiac Assessment',
      category: 'PRE_OP',
      status: 'COMPLETED',
      decisionBranch: 'FIT_FOR_ANESTHESIA',
      doctorNotes: 'ASA Class II. HbA1c 6.8%. Cleared for cardiac catheterization lab under local & MAC anesthesia.',
      completedAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      title: 'Cardiac Catheterization & Stent Placement Procedure',
      category: 'TREATMENT',
      status: 'COMPLETED',
      decisionBranch: 'UNCOMPLICATED_PROCEDURE',
      doctorNotes: 'Successful placement of 2 drug-eluting stents in LAD artery. Zero intra-op complications.',
      completedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      title: 'Post-Op Coronary Care Unit (CCU) Monitoring',
      category: 'POST_OP',
      status: 'COMPLETED',
      decisionBranch: 'STABLE_STEARN_HEMODYNAMICS',
      doctorNotes: 'Transferred to CCU for 24h continuous telemetry. Vital signs stable, troponin levels trending down.',
      completedAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      title: 'In-Patient Ward Recovery & Mobilization Protocol',
      category: 'POST_OP',
      status: 'IN_PROGRESS',
      decisionBranch: 'NORMAL_RECOVERY_TRACK',
      doctorNotes: 'Patient ambulatory, on dual antiplatelet therapy (DAPT). Surgical entry site clean.',
    },
    {
      title: 'Criteria-Based Hospital Discharge & Epicrisis',
      category: 'DISCHARGE',
      status: 'PENDING',
      doctorNotes: 'Scheduled for Day 5 post-procedure upon repeat blood panel.',
    },
    {
      title: 'Outpatient Follow-Up & Fit-to-Fly Evaluation',
      category: 'DISCHARGE',
      status: 'PENDING',
      decisionBranch: 'FIT_TO_FLY_PENDING',
      doctorNotes: 'Cardiology outpatient visit scheduled for suture/sheath site review and flight clearance.',
    },
    {
      title: 'Remote Tele-Rehabilitation & Telehealth Tracking',
      category: 'REHAB',
      status: 'PENDING',
      doctorNotes: 'Scheduled virtual follow-ups at 2 weeks, 1 month, and 3 months post-discharge.',
    },
  ];

  for (const step of clinicalStepsData) {
    await prisma.clinicalStep.create({
      data: {
        caseId: sampleCase.id,
        title: step.title,
        category: step.category,
        status: step.status,
        decisionBranch: step.decisionBranch || null,
        doctorNotes: step.doctorNotes,
        completedAt: step.completedAt || null,
      },
    });
  }

  await prisma.fitToFlyClearance.upsert({
    where: { caseId: sampleCase.id },
    update: {},
    create: {
      caseId: sampleCase.id,
      isCleared: true,
      clearedBy: 'Dr. Ashok Seth (MBBS, MD Cardiology)',
      clearanceDate: new Date(Date.now() + 3 * 86400000),
      restrictions: 'Patient cleared for commercial flights. Must maintain hydrated state, wear compression stockings, and keep emergency nitroglycerin in carry-on bag.',
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

  console.log(`  ✓ Sample clinical case with 9 workflow steps & Fit-to-Fly clearance created`);
  console.log(`  ✓ 4 official verification documents & VIL certificates issued`);
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

  console.log('✅ Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Super Admin: admin@afzalhealthcare.in / Admin@123');
  console.log('  Manager:     manager@afzalhealthcare.in / Manager@123');
  console.log('  Doctor:      doctor@afzalhealthcare.in / Doctor@123');
  console.log('  Patient:     patient@afzalhealthcare.in / Patient@123');

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
