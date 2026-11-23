/**
 * Afzal Healthcare — Manager Billing & Itemized Invoicing API
 * GET /api/v1/manager/billing — List all patient medical bills with line items
 * POST /api/v1/manager/billing — Create a new bill with itemized cost breakdowns
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { saveValidatedUpload } from '@/lib/services/document-storage.service';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');

    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

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

    const contentType = request.headers.get('content-type') || '';

    let caseId: string = '';
    let patientId: string = '';
    let hospitalId: string | null = null;
    let title: string = '';
    let category: string = 'HOSPITAL_SURGERY';
    let paidAmount: number = 0;
    let currency: string = 'USD';
    let status: string = 'PENDING';
    let dueDateStr: string | null = null;
    let notes: string | null = null;
    let itemsRaw: any[] = [];
    let fileUrl: string | null = null;
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
          itemsRaw = JSON.parse(itemsJson);
        } catch {}
      }

      uploadFile = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      caseId = body.caseId;
      patientId = body.patientId;
      hospitalId = body.hospitalId || null;
      title = body.title;
      category = body.category || 'HOSPITAL_SURGERY';
      paidAmount = body.paidAmount || 0;
      currency = body.currency || 'USD';
      status = body.status || 'PENDING';
      dueDateStr = body.dueDate || null;
      notes = body.notes || null;
      itemsRaw = body.items || [];
    }

    if (!caseId || !patientId || !title) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'caseId, patientId, and title are required', 400);
    }

    if (uploadFile && uploadFile.size > 0) {
      const saved = await saveValidatedUpload(uploadFile, 'bill');
      if (!saved.ok) {
        return apiError(ERROR_CODES.BAD_REQUEST, saved.message, 400);
      }
      savedStorageKey = saved.storageKey;
      fileName = uploadFile.name;
    }

    // Auto-generate bill number if not specified
    const billNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Compute total from line items
    let calculatedTotal = 0;
    const processedItems = itemsRaw.map((item: any) => {
      const qty = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
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

    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    const newBill = await prisma.medicalBill.create({
      data: {
        billNumber,
        caseId,
        patientId,
        hospitalId,
        title,
        category,
        totalAmount: calculatedTotal,
        paidAmount,
        currency,
        status,
        dueDate,
        fileUrl,
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

    const finalBill = savedStorageKey
      ? await prisma.medicalBill.update({
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

    return apiSuccess({ bill: finalBill });
  } catch (err) {
    console.error('[Manager Billing POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create medical bill', 500);
  }
}
