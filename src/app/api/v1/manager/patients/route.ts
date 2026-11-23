import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getClientIP } from '@/lib/api/auth-helper';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/api/audit-logger';
import { formatPatientForViewer } from '@/lib/services/phi.service';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN')) {
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

    const formattedPatients = patients.map((p) => formatPatientForViewer(p));

    void createAuditLog({
      actorId: userId,
      action: AUDIT_ACTIONS.VIEW_PATIENT,
      entityType: 'Patient',
      entityId: 'cohort',
      newValue: { count: formattedPatients.length },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ patients: formattedPatients });
  } catch (err) {
    console.error('Failed to load manager patients:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
