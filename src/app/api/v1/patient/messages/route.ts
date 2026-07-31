/**
 * Afzal Healthcare — Patient Messages API Endpoint
 * GET /api/v1/patient/messages — Fetch message history with coordinator
 * POST /api/v1/patient/messages — Send a message to the coordinator
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    // Locate patient and retrieve manager user ID
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    if (!patient.assignedManagerId) {
      return apiSuccess({ messages: [], manager: null });
    }

    const managerUser = await prisma.user.findUnique({
      where: { id: patient.assignedManagerId },
      select: { id: true, fullName: true, email: true },
    });

    // Retrieve conversation history
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: authUser!.userId, receiverId: patient.assignedManagerId },
          { senderId: patient.assignedManagerId, receiverId: authUser!.userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: {
        senderId: patient.assignedManagerId,
        receiverId: authUser!.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return apiSuccess({ messages, manager: managerUser });
  } catch (err) {
    console.error('[Patient Messages GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch messages', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { message: messageBody } = body;

    if (!messageBody || !messageBody.trim()) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'Message content cannot be empty', 400);
    }

    // Locate patient and retrieve manager ID
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    if (!patient.assignedManagerId) {
      return apiError(
        ERROR_CODES.BAD_REQUEST,
        'No coordinator assigned to your account. You cannot send messages yet.',
        400
      );
    }

    // Create the message
    const newMessage = await prisma.message.create({
      data: {
        senderId: authUser!.userId,
        receiverId: patient.assignedManagerId,
        body: messageBody.trim(),
        isRead: false,
      },
    });

    return apiSuccess({ message: newMessage });
  } catch (err) {
    console.error('[Patient Messages POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to send message', 500);
  }
}
