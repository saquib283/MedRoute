import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { CommissionCategory } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN' && authUser!.role !== 'MANAGER') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin or Manager access required', 403);
    }

    const rules = await prisma.commissionRule.findMany({
      orderBy: [{ category: 'asc' }, { partnerId: 'asc' }],
    });

    const [hospitals, hostels] = await Promise.all([
      prisma.hospital.findMany({ select: { id: true, name: true, city: true, commissionRate: true } }),
      prisma.hostel.findMany({ select: { id: true, name: true, city: true } }),
    ]);

    return apiSuccess({
      rules,
      partners: {
        hospitals,
        hostels,
      },
    });
  } catch (err) {
    console.error('Failed to list commission rules:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch commission rules', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required to modify commission rules', 403);
    }

    const body = await request.json();
    const {
      ruleName,
      category,
      partnerId,
      partnerName,
      ratePercent,
      flatFee = 0,
      minFee,
      maxFee,
      currency = 'INR',
      startDate,
      endDate,
      notes,
    } = body;

    if (!ruleName || !category || ratePercent === undefined) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'ruleName, category, and ratePercent are required', 400);
    }

    const rule = await prisma.commissionRule.create({
      data: {
        ruleName,
        category: category as CommissionCategory,
        partnerId: partnerId || null,
        partnerName: partnerName || null,
        ratePercent: parseFloat(ratePercent),
        flatFee: flatFee ? parseFloat(flatFee) : null,
        minFee: minFee ? parseFloat(minFee) : null,
        maxFee: maxFee ? parseFloat(maxFee) : null,
        currency,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        notes: notes || null,
      },
    });

    void createAuditLog({
      actorId: authUser!.userId,
      action: 'COMMISSION_RULE_CREATED',
      entityType: 'CommissionRule',
      entityId: rule.id,
      newValue: {
        ruleName,
        category,
        ratePercent,
        partnerName,
      },
      route: '/api/v1/finance/commission-rules',
    });

    return apiSuccess({ rule }, undefined, 201);
  } catch (err) {
    console.error('Failed to create commission rule:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create commission rule', 500);
  }
}
