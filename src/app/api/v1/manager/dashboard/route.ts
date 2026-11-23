import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    // Get manager's user record to resolve ID if needed
    const manager = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const [totalPatients, activeCases, upcomingAppointments] = await Promise.all([
      prisma.patient.count({
        where: { assignedManagerId: manager.id },
      }),
      prisma.case.count({
        where: {
          managerId: manager.id,
          status: { not: 'CLOSED' },
        },
      }),
      prisma.appointment.count({
        where: {
          case: {
            managerId: manager.id,
          },
          scheduledAt: { gte: new Date() },
          status: { not: 'CANCELLED' },
        },
      }),
    ]);

    return NextResponse.json({
      metrics: {
        totalPatients,
        activeCases,
        upcomingAppointments,
      },
    });
  } catch (err) {
    console.error('Failed to load manager dashboard metrics:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
