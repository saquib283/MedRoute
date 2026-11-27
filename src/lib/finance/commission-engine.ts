/**
 * MediRoute India — Automated Dynamic Commission Engine
 * Configurable multi-party revenue splitting across Hospitals, Hotels/Hostels, Logistics, and Facilitation.
 */

import prisma from '@/lib/prisma';
import { CommissionCategory } from '@prisma/client';
import { generateVerificationCode } from '@/lib/legal/crypto-proof';

export interface CommissionCalculationResult {
  category: CommissionCategory;
  partnerId: string | null;
  grossAmount: number;
  ratePercent: number;
  commissionAmount: number;
  netPayableToPartner: number;
}

export interface SplitBreakdownResult {
  grossTotal: number;
  currency: string;
  hospitalShare: {
    hospitalId: string | null;
    hospitalName: string;
    gross: number;
    commissionRate: number;
    commissionAmount: number;
    netPayable: number;
  };
  hotelShare: {
    hostelId: string | null;
    hostelName: string;
    gross: number;
    commissionRate: number;
    commissionAmount: number;
    netPayable: number;
  };
  logisticsShare: {
    gross: number;
    commissionRate: number;
    commissionAmount: number;
    netPayable: number;
  };
  facilitationFee: number;
  totalMedRouteMargin: number;
}

/**
 * Fetches the active commission rule for a given category and optional partnerId.
 * Prioritizes partner-specific override -> falls back to category default -> falls back to hardcoded safety margin.
 */
export async function getActiveCommissionRule(
  category: CommissionCategory,
  partnerId?: string | null
): Promise<{ ratePercent: number; flatFee: number }> {
  try {
    const now = new Date();

    // 1. Check for specific partner override
    if (partnerId) {
      const specificRule = await prisma.commissionRule.findFirst({
        where: {
          category,
          partnerId,
          isActive: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
        },
      });
      if (specificRule) {
        return {
          ratePercent: Number(specificRule.ratePercent),
          flatFee: Number(specificRule.flatFee || 0),
        };
      }
    }

    // 2. Check for global category default rule
    const defaultRule = await prisma.commissionRule.findFirst({
      where: {
        category,
        partnerId: null,
        isActive: true,
      },
    });

    if (defaultRule) {
      return {
        ratePercent: Number(defaultRule.ratePercent),
        flatFee: Number(defaultRule.flatFee || 0),
      };
    }

    // 3. Fallback defaults if no rule in DB
    switch (category) {
      case 'HOSPITAL_SURGICAL':
        return { ratePercent: 12.5, flatFee: 0 };
      case 'HOTEL_ACCOMMODATION':
        return { ratePercent: 15.0, flatFee: 0 };
      case 'LOGISTICS_TRANSFER':
        return { ratePercent: 20.0, flatFee: 0 };
      case 'FACILITATION_FEE':
        return { ratePercent: 5.0, flatFee: 0 };
      case 'AFFILIATE_BROKER':
        return { ratePercent: 5.0, flatFee: 0 };
      default:
        return { ratePercent: 10.0, flatFee: 0 };
    }
  } catch (err) {
    console.error('Error fetching commission rule:', err);
    return { ratePercent: 10.0, flatFee: 0 };
  }
}

/**
 * Calculates full multi-party split breakdown across hospital, accommodation, logistics, and tech margin.
 */
export async function calculateSplitBreakdown(
  lineItems: { category?: string | null; totalPrice: number | string | DecimalLike }[],
  hospitalId?: string | null,
  hostelId?: string | null,
  currency: string = 'INR'
): Promise<SplitBreakdownResult> {
  const hospitalRule = await getActiveCommissionRule('HOSPITAL_SURGICAL', hospitalId);
  const hotelRule = await getActiveCommissionRule('HOTEL_ACCOMMODATION', hostelId);
  const logisticsRule = await getActiveCommissionRule('LOGISTICS_TRANSFER');

  let hospitalGross = 0;
  let hotelGross = 0;
  let logisticsGross = 0;
  let facilitationFee = 0;

  for (const item of lineItems) {
    const amount = Number(item.totalPrice) || 0;
    const cat = (item.category || '').toUpperCase();

    if (cat === 'PROCEDURE' || cat === 'SURGERY' || cat === 'CLINICAL' || cat === 'TREATMENT') {
      hospitalGross += amount;
    } else if (cat === 'ROOM' || cat === 'ACCOMMODATION' || cat === 'HOTEL' || cat === 'HOSTEL') {
      hotelGross += amount;
    } else if (cat === 'TRANSPORT' || cat === 'LOGISTICS' || cat === 'AIRPORT_TRANSFER') {
      logisticsGross += amount;
    } else if (cat === 'FEE' || cat === 'FACILITATION' || cat === 'TECH') {
      facilitationFee += amount;
    } else {
      // Default to hospital if unspecified
      hospitalGross += amount;
    }
  }

  // If no specific line item breakdown, calculate hospital from total
  const grossTotal = hospitalGross + hotelGross + logisticsGross + facilitationFee;

  const hospitalCommAmount = hospitalGross * (hospitalRule.ratePercent / 100) + hospitalRule.flatFee;
  const hospitalNet = Math.max(0, hospitalGross - hospitalCommAmount);

  const hotelCommAmount = hotelGross * (hotelRule.ratePercent / 100) + hotelRule.flatFee;
  const hotelNet = Math.max(0, hotelGross - hotelCommAmount);

  const logisticsCommAmount = logisticsGross * (logisticsRule.ratePercent / 100) + logisticsRule.flatFee;
  const logisticsNet = Math.max(0, logisticsGross - logisticsCommAmount);

  const totalMedRouteMargin = hospitalCommAmount + hotelCommAmount + logisticsCommAmount + facilitationFee;

  let hospitalName = 'Partner Hospital';
  if (hospitalId) {
    const h = await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } });
    if (h) hospitalName = h.name;
  }

  let hostelName = 'Partner Medical Hostel';
  if (hostelId) {
    const hst = await prisma.hostel.findUnique({ where: { id: hostelId }, select: { name: true } });
    if (hst) hostelName = hst.name;
  }

  return {
    grossTotal,
    currency,
    hospitalShare: {
      hospitalId: hospitalId || null,
      hospitalName,
      gross: hospitalGross,
      commissionRate: hospitalRule.ratePercent,
      commissionAmount: hospitalCommAmount,
      netPayable: hospitalNet,
    },
    hotelShare: {
      hostelId: hostelId || null,
      hostelName,
      gross: hotelGross,
      commissionRate: hotelRule.ratePercent,
      commissionAmount: hotelCommAmount,
      netPayable: hotelNet,
    },
    logisticsShare: {
      gross: logisticsGross,
      commissionRate: logisticsRule.ratePercent,
      commissionAmount: logisticsCommAmount,
      netPayable: logisticsNet,
    },
    facilitationFee,
    totalMedRouteMargin,
  };
}

/**
 * Creates B2B Partner Settlement records from a generated invoice.
 */
export async function createPartnerSettlements(
  invoiceId: string,
  breakdown: SplitBreakdownResult
) {
  const settlements = [];

  // 1. Hospital Settlement Voucher
  if (breakdown.hospitalShare.gross > 0 && breakdown.hospitalShare.hospitalId) {
    const settNo = generateVerificationCode('MR-SET-HSP');
    const s = await prisma.partnerSettlement.create({
      data: {
        settlementNumber: settNo,
        partnerType: 'HOSPITAL',
        partnerId: breakdown.hospitalShare.hospitalId,
        partnerName: breakdown.hospitalShare.hospitalName,
        invoiceId,
        grossAmount: breakdown.hospitalShare.gross,
        commissionRate: breakdown.hospitalShare.commissionRate,
        commissionAmount: breakdown.hospitalShare.commissionAmount,
        netPayable: breakdown.hospitalShare.netPayable,
        currency: breakdown.currency,
        status: 'PENDING',
      },
    });
    settlements.push(s);
  }

  // 2. Hotel Settlement Voucher
  if (breakdown.hotelShare.gross > 0 && breakdown.hotelShare.hostelId) {
    const settNo = generateVerificationCode('MR-SET-HTL');
    const s = await prisma.partnerSettlement.create({
      data: {
        settlementNumber: settNo,
        partnerType: 'HOTEL',
        partnerId: breakdown.hotelShare.hostelId,
        partnerName: breakdown.hotelShare.hostelName,
        invoiceId,
        grossAmount: breakdown.hotelShare.gross,
        commissionRate: breakdown.hotelShare.commissionRate,
        commissionAmount: breakdown.hotelShare.commissionAmount,
        netPayable: breakdown.hotelShare.netPayable,
        currency: breakdown.currency,
        status: 'PENDING',
      },
    });
    settlements.push(s);
  }

  return settlements;
}

type DecimalLike = { toNumber?: () => number; toString?: () => string };
