/**
 * Afzal Healthcare — Manager Billing & Itemized Invoicing API
 * GET /api/v1/manager/billing — List all patient medical bills with line items (and optional ?meta=true)
 * POST /api/v1/manager/billing — Create a new bill with itemized cost breakdowns
 * PATCH /api/v1/manager/billing — Record payments or update bill status, due date, notes, or hospital
 */

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getClientIP, requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import {
  removeStoredFile,
  saveValidatedUpload,
} from '@/lib/services/document-storage.service';
import {
  deriveBillStatus,
  getManagerBillingMetadata,
  syncCaseSettleBillSteps,
  updateMedicalBill,
} from '@/lib/services/billing.service';

interface BillItemInput {
  description?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  category?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser!.role !== 'MANAGER' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Manager or Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const includeMeta = searchParams.get('meta') === 'true';

    const where: Prisma.MedicalBillWhereInput = {};
    if (caseId) where.caseId = caseId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (authUser!.role === 'MANAGER') {
      where.case = { managerId: authUser!.userId };
    }

    const bills = await prisma.medicalBill.findMany({
      where,
      include: {
        patient: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
        hospital: {
          select: { name: true, city: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (includeMeta) {
      const metadata = await getManagerBillingMetadata({
        userId: authUser!.userId,
        role: authUser!.role,
      });
      return apiSuccess({ bills, metadata });
    }

    return apiSuccess({ bills });
  } catch (err) {
    console.error('[Manager Billing GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch medical bills', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    if (authUser!.role !== 'MANAGER' && authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Manager or Admin access required', 403);
    }

    const contentType = request.headers.get('content-type') || '';

    let caseId = '';
    let patientId = '';
    let hospitalId: string | null = null;
    let title = '';
    let category = 'HOSPITAL_SURGERY';
    let paidAmount = 0;
    let currency = 'USD';
    let status = 'PENDING';
    let dueDateStr: string | null = null;
    let notes: string | null = null;
    let itemsRaw: BillItemInput[] = [];
    let savedStorageKey: string | null = null;
    let fileName: string | null = null;
    let uploadFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      caseId = (formData.get('caseId') as string) || '';
      patientId = (formData.get('patientId') as string) || '';
      hospitalId = (formData.get('hospitalId') as string) || null;
      title = (formData.get('title') as string) || '';
      category = (formData.get('category') as string) || 'HOSPITAL_SURGERY';
      paidAmount = parseFloat((formData.get('paidAmount') as string) || '0');
      currency = (formData.get('currency') as string) || 'USD';
      status = (formData.get('status') as string) || 'PENDING';
      dueDateStr = (formData.get('dueDate') as string) || null;
      notes = (formData.get('notes') as string) || null;

      const itemsJson = formData.get('items') as string;
      if (itemsJson) {
        try {
          const parsedItems: unknown = JSON.parse(itemsJson);
          if (Array.isArray(parsedItems)) {
            itemsRaw = parsedItems as BillItemInput[];
          }
        } catch {}
      }

      const rawFile = formData.get('file');
      uploadFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    } else {
      const body = await request.json();
      caseId = body.caseId;
      patientId = body.patientId;
      hospitalId = body.hospitalId || null;
      title = body.title;
      category = body.category || 'HOSPITAL_SURGERY';
      paidAmount = Number(body.paidAmount ?? 0);
      currency = body.currency || 'USD';
      status = body.status || 'PENDING';
      dueDateStr = body.dueDate || null;
      notes = body.notes || null;
      itemsRaw = Array.isArray(body.items) ? (body.items as BillItemInput[]) : [];
    }

    if (!caseId || !patientId || !title) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'caseId, patientId, and title are required', 400);
    }

    // Verify case existence and ownership BEFORE writing any uploaded file to disk
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return apiError(ERROR_CODES.CASE_NOT_FOUND, 'Case not found', 404);
    }
    if (caseRecord.patientId !== patientId) {
      return apiError(ERROR_CODES.FORBIDDEN, 'Case does not belong to the specified patient', 403);
    }
    if (authUser!.role === 'MANAGER' && caseRecord.managerId !== authUser!.userId) {
      return apiError(ERROR_CODES.FORBIDDEN, 'Case is not assigned to you', 403);
    }

    // Compute total from line items and validate upfront payment bounds before saving uploads
    let calculatedTotal = 0;
    const processedItems = itemsRaw.map((item) => {
      const qty = parseInt(String(item.quantity ?? ''), 10) || 1;
      const unitPrice = parseFloat(String(item.unitPrice ?? '')) || 0;
      const itemAmount = qty * unitPrice;
      calculatedTotal += itemAmount;

      return {
        description: item.description || 'Medical Line Item',
        quantity: qty,
        unitPrice,
        amount: itemAmount,
        category: item.category || 'GENERAL',
      };
    });

    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > calculatedTotal + 0.005) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'Paid amount cannot be negative or exceed total invoice amount',
        400
      );
    }

    const normalizedPaid = Math.min(calculatedTotal, Math.round(paidAmount * 100) / 100);
    const normalizedStatus = deriveBillStatus(calculatedTotal, normalizedPaid, status);

    if (hospitalId) {
      const hospital = await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true },
      });
      if (!hospital) {
        return apiError(ERROR_CODES.BAD_REQUEST, 'Hospital not found', 400);
      }
    }

    if (uploadFile) {
      const saved = await saveValidatedUpload(uploadFile, 'bill');
      if (!saved.ok) {
        return apiError(ERROR_CODES.BAD_REQUEST, saved.message, 400);
      }
      savedStorageKey = saved.storageKey;
      fileName = uploadFile.name;
    }

    // Auto-generate bill number if not specified
    const billNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    let finalBill;
    try {
      finalBill = await prisma.$transaction(async (tx) => {
        const newBill = await tx.medicalBill.create({
          data: {
            billNumber,
            caseId,
            patientId,
            hospitalId,
            title,
            category,
            totalAmount: calculatedTotal,
            paidAmount: normalizedPaid,
            currency,
            status: normalizedStatus,
            dueDate,
            fileUrl: null,
            storageKey: savedStorageKey,
            fileName,
            notes,
            createdBy: authUser!.userId,
            items: {
              create: processedItems,
            },
          },
          include: {
            items: true,
            patient: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        });

        const updatedOrCreated = savedStorageKey
          ? await tx.medicalBill.update({
              where: { id: newBill.id },
              data: { fileUrl: `/api/v1/documents/bill/${newBill.id}/download` },
              include: {
                items: true,
                patient: {
                  include: {
                    user: { select: { fullName: true } },
                  },
                },
              },
            })
          : newBill;

        if (normalizedStatus === 'PAID') {
          await syncCaseSettleBillSteps(tx, caseId);
        }

        return updatedOrCreated;
      });
    } catch (dbErr) {
      if (savedStorageKey) {
        await removeStoredFile(savedStorageKey);
      }
      throw dbErr;
    }

    return apiSuccess({ bill: finalBill });
  } catch (err) {
    console.error('[Manager Billing POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create medical bill', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON request body', 400);
    }

    const result = await updateMedicalBill({
      billId: body.billId,
      paymentAmount: body.paymentAmount,
      paidAmount: body.paidAmount,
      status: body.status,
      dueDate: body.dueDate,
      notes: body.notes,
      hospitalId: body.hospitalId,
      actor: {
        userId: authUser!.userId,
        role: authUser!.role,
        ipAddress: getClientIP(request),
      },
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    return apiSuccess(result.data);
  } catch (err) {
    console.error('[Manager Billing PATCH Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update medical bill', 500);
  }
}
