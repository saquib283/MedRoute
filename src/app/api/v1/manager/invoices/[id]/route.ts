import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        hospital: { select: { id: true, name: true, city: true, address: true } },
        case: {
          select: {
            id: true,
            status: true,
            patient: {
              select: {
                id: true,
                nationality: true,
                user: { select: { fullName: true, email: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { invoice } });
  } catch (err) {
    console.error('Failed to get invoice:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'SENT') updateData.issuedAt = new Date();
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.dueDate !== undefined) updateData.dueDate = new Date(parsed.data.dueDate);

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });

    return NextResponse.json({ success: true, data: { invoice: updated } });
  } catch (err) {
    console.error('Failed to update invoice:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
