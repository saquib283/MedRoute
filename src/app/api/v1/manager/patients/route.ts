import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const patients = await prisma.patient.findMany({
      where: {
        assignedManagerId: userId,
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        medicalProfile: true,
        cases: {
          select: {
            id: true,
            status: true,
            isUrgent: true,
            createdAt: true,
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            category: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ patients });
  } catch (err) {
    console.error('Failed to load manager patients:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
