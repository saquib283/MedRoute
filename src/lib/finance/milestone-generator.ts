/**
 * MediRoute India — Milestone Installment Invoicing Engine
 * Automatically splits a medical travel treatment package into 3 statutory installments.
 */

import prisma from '@/lib/prisma';
import { generateVerificationCode } from '@/lib/legal/crypto-proof';
import { calculateSplitBreakdown, createPartnerSettlements } from './commission-engine';

export interface MilestoneConfig {
  caseId: string;
  hospitalId?: string | null;
  hostelId?: string | null;
  totalPackageCost: number;
  currency?: string;
  procedureTitle: string;
  createdById: string;
}

export async function generate3StageMilestoneInvoices({
  caseId,
  hospitalId,
  hostelId,
  totalPackageCost,
  currency = 'USD',
  procedureTitle,
  createdById,
}: MilestoneConfig) {
  const m1Amount = Math.round(totalPackageCost * 0.20 * 100) / 100; // 20%
  const m2Amount = Math.round(totalPackageCost * 0.50 * 100) / 100; // 50%
  const m3Amount = Math.round((totalPackageCost - m1Amount - m2Amount) * 100) / 100; // 30% remainder

  const now = new Date();
  const m1DueDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
  const m2DueDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days
  const m3DueDate = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000); // 35 days

  const milestonesData = [
    {
      installmentNumber: 1,
      name: 'Milestone 1: Deposit & Visa Invitation Letter (VIL) Authorization (20%)',
      amount: m1Amount,
      dueDate: m1DueDate,
      description: `Initial deposit (20%) for ${procedureTitle} covering Visa Invitation Letter generation and operating surgeon scheduling.`,
      category: 'FACILITATION',
    },
    {
      installmentNumber: 2,
      name: 'Milestone 2: Hospital Inpatient Check-In & Pre-Op Surgical Clearance (50%)',
      amount: m2Amount,
      dueDate: m2DueDate,
      description: `Hospital admission installment (50%) for ${procedureTitle} covering OT charges, surgeon fees, and inpatient room accommodation.`,
      category: 'PROCEDURE',
    },
    {
      installmentNumber: 3,
      name: 'Milestone 3: Post-Operative Review & Discharge Clearance (30%)',
      amount: m3Amount,
      dueDate: m3DueDate,
      description: `Discharge installment (30%) for ${procedureTitle} covering post-op rehabilitation, recovery hostel stay, and medical handoff reports.`,
      category: 'ROOM',
    },
  ];

  const generatedInvoices = [];

  for (const m of milestonesData) {
    const invNumber = generateVerificationCode('MR-INV');

    // Calculate split breakdown for this milestone
    const lineItems = [
      {
        description: m.description,
        quantity: 1,
        unitPrice: m.amount,
        totalPrice: m.amount,
        category: m.category,
      },
    ];

    const breakdown = await calculateSplitBreakdown(lineItems, hospitalId, hostelId, currency);

    const invoice = await prisma.invoice.create({
      data: {
        caseId,
        hospitalId: hospitalId || null,
        invoiceNumber: invNumber,
        invoiceType: 'TREATMENT',
        status: 'SENT',
        subtotal: m.amount,
        totalAmount: m.amount,
        paidAmount: 0,
        balanceDue: m.amount,
        currency,
        milestoneName: m.name,
        installmentNumber: m.installmentNumber,
        totalInstallments: 3,
        commissionRate: breakdown.hospitalShare.commissionRate,
        commissionAmount: breakdown.hospitalShare.commissionAmount,
        hotelCommissionRate: breakdown.hotelShare.commissionRate,
        hotelCommissionAmount: breakdown.hotelShare.commissionAmount,
        facilitationFeeAmount: breakdown.facilitationFee,
        notes: `Milestone installment ${m.installmentNumber} of 3 for ${procedureTitle}.`,
        dueDate: m.dueDate,
        issuedAt: now,
        createdBy: createdById,
        lineItems: {
          create: lineItems.map((item, idx) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: item.category,
            sortOrder: idx,
          })),
        },
      },
    });

    // Create linked partner settlement vouchers
    await createPartnerSettlements(invoice.id, breakdown);

    generatedInvoices.push(invoice);
  }

  return generatedInvoices;
}
