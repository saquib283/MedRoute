import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateVisaSchema = z.object({
  status: z.enum(['REQUESTED', 'GENERATED', 'SENT', 'EXPIRED']).optional(),
  invitationLetterUrl: z.string().optional(),
  frroRegistered: z.boolean().optional(),
  notes: z.string().optional(),
});

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
    const parsed = updateVisaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'GENERATED') updateData.generatedAt = new Date();
      if (parsed.data.status === 'SENT') updateData.sentAt = new Date();
    }
    if (parsed.data.invitationLetterUrl !== undefined) updateData.invitationLetterUrl = parsed.data.invitationLetterUrl;
    if (parsed.data.frroRegistered !== undefined) updateData.frroRegistered = parsed.data.frroRegistered;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const updated = await prisma.visaAssistance.update({
      where: { id },
      data: updateData,
      include: {
        hospital: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: { visaAssistance: updated } });
  } catch (err) {
    console.error('Failed to update visa assistance:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
