import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { generateInvoiceNumber } from '@/lib/constants';

const createInvoiceSchema = z.object({
  caseId: z.string(),
  hospitalId: z.string().optional(),
  invoiceType: z.enum(['TREATMENT', 'ACCOMMODATION', 'LOGISTICS', 'FACILITATION_FEE']),
  currency: z.string().default('INR'),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().int().positive().default(1),
    unitPrice: z.number().positive(),
    category: z.string().optional(),
  })).min(1),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const status = searchParams.get('status');
    const invoiceType = searchParams.get('invoiceType');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;
    if (invoiceType) where.invoiceType = invoiceType;
    if (userRole === 'MANAGER') {
      where.case = { managerId: userId };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        hospital: { select: { id: true, name: true, city: true } },
        case: {
          select: {
            id: true,
            status: true,
            patient: {
              select: {
                id: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { invoices } });
  } catch (err) {
    console.error('Failed to load invoices:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const { caseId, hospitalId, invoiceType, currency, notes, dueDate, lineItems } = parsed.data;

    // Verify case access
    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (userRole === 'MANAGER' && caseRecord.managerId !== userId) {
      return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 });
    }

    // Get system configs for defaults
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['defaultCommissionRate', 'defaultHotelCommission', 'taxRate', 'invoicePrefix'] },
      },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    // Calculate subtotal
    const processedItems = lineItems.map((item, idx) => ({
      ...item,
      totalPrice: item.unitPrice * item.quantity,
      sortOrder: idx,
    }));
    const subtotal = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Determine commission rate based on invoice type
    let commissionRate = 0;
    if (invoiceType === 'TREATMENT' && hospitalId) {
      const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
      commissionRate = hospital?.commissionRate ? Number(hospital.commissionRate) : parseFloat(configMap.defaultCommissionRate || '20');
    } else if (invoiceType === 'ACCOMMODATION') {
      commissionRate = parseFloat(configMap.defaultHotelCommission || '15');
    }

    const taxRate = parseFloat(configMap.taxRate || '18');
    const taxAmount = subtotal * (taxRate / 100);
    const commissionAmount = subtotal * (commissionRate / 100);
    const totalAmount = subtotal + taxAmount;
    const balanceDue = totalAmount;

    // Generate invoice number
    const count = await prisma.invoice.count();
    const prefix = configMap.invoicePrefix || 'MR-INV';
    const invoiceNumber = generateInvoiceNumber(prefix, count + 1);

    const invoice = await prisma.invoice.create({
      data: {
        caseId,
        hospitalId,
        invoiceNumber,
        invoiceType: invoiceType as 'TREATMENT' | 'ACCOMMODATION' | 'LOGISTICS' | 'FACILITATION_FEE',
        subtotal,
        taxRate,
        taxAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
        paidAmount: 0,
        balanceDue,
        currency,
        notes,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdBy: userId,
        lineItems: {
          create: processedItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: item.category,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        hospital: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: { invoice } }, { status: 201 });
  } catch (err) {
    console.error('Failed to create invoice:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
