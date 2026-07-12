import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const sendMessageSchema = z.object({
  patientUserId: z.string(),
  body: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const patientUserId = searchParams.get('patientUserId');

    // Scenario A: Get conversation history with a specific patient
    if (patientUserId) {
      // First, verify the patient is assigned to this manager
      const patient = await prisma.patient.findFirst({
        where: {
          userId: patientUserId,
          assignedManagerId: userId,
        },
      });

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found or unauthorized' }, { status: 404 });
      }

      // Mark incoming messages as read
      await prisma.message.updateMany({
        where: {
          senderId: patientUserId,
          receiverId: userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      // Fetch messages
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: patientUserId },
            { senderId: patientUserId, receiverId: userId },
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      return NextResponse.json({ messages });
    }

    // Scenario B: Get list of active chat threads for all assigned patients
    const patients = await prisma.patient.findMany({
      where: {
        assignedManagerId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    const threads = await Promise.all(
      patients.map(async (patient) => {
        // Get last message in thread
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: patient.userId },
              { senderId: patient.userId, receiverId: userId },
            ],
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        // Count unread messages
        const unreadCount = await prisma.message.count({
          where: {
            senderId: patient.userId,
            receiverId: userId,
            isRead: false,
          },
        });

        return {
          patientUserId: patient.userId,
          fullName: patient.user.fullName,
          email: patient.user.email,
          lastMessage: lastMessage ? lastMessage.body : null,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
          unreadCount,
        };
      })
    );

    // Sort threads by last message time desc
    threads.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return NextResponse.json({ threads });
  } catch (err) {
    console.error('Failed to load chat threads:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const { patientUserId, body: messageText } = parsed.data;

    // Verify patient is assigned to this manager
    const patient = await prisma.patient.findFirst({
      where: {
        userId: patientUserId,
        assignedManagerId: userId,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found or unauthorized' }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: patientUserId,
        body: messageText,
        isRead: false,
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error('Failed to dispatch coordination message:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
