/**
 * MediRoute India — Patient Profile API Endpoint
 * GET /api/v1/patient/profile — Fetch current patient and medical data
 * PUT /api/v1/patient/profile — Update patient and medical data
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    // Retrieve Patient profile mapped to the authenticated User id
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
      include: {
        medicalProfile: true,
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    return apiSuccess({ patient });
  } catch (err) {
    console.error('[Patient Profile GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch patient profile', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const {
      bloodGroup,
      primaryLanguage,
      emergencyContact,
      allergies,
      medications,
      surgeries,
      chronicConditions,
      specialisationsRequired,
    } = body;

    // Find the patient ID corresponding to the user ID
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    // Run transaction update for both Patient and PatientMedicalProfile tables
    const updatedPatient = await prisma.$transaction(async (tx) => {
      // 1. Update Patient details
      const pat = await tx.patient.update({
        where: { id: patient.id },
        data: {
          bloodGroup: bloodGroup !== undefined ? bloodGroup : undefined,
          primaryLanguage: primaryLanguage !== undefined ? primaryLanguage : undefined,
          emergencyContact: emergencyContact !== undefined ? (emergencyContact as Prisma.InputJsonValue) : undefined,
        },
      });

      // 2. Update or Create PatientMedicalProfile
      await tx.patientMedicalProfile.upsert({
        where: { patientId: patient.id },
        create: {
          patientId: patient.id,
          allergies: allergies !== undefined ? (allergies as Prisma.InputJsonValue) : [],
          medications: medications !== undefined ? (medications as Prisma.InputJsonValue) : [],
          surgeries: surgeries !== undefined ? (surgeries as Prisma.InputJsonValue) : [],
          chronicConditions: chronicConditions !== undefined ? (chronicConditions as Prisma.InputJsonValue) : [],
          specialisationsRequired: specialisationsRequired !== undefined ? (specialisationsRequired as Prisma.InputJsonValue) : [],
        },
        update: {
          allergies: allergies !== undefined ? (allergies as Prisma.InputJsonValue) : undefined,
          medications: medications !== undefined ? (medications as Prisma.InputJsonValue) : undefined,
          surgeries: surgeries !== undefined ? (surgeries as Prisma.InputJsonValue) : undefined,
          chronicConditions: chronicConditions !== undefined ? (chronicConditions as Prisma.InputJsonValue) : undefined,
          specialisationsRequired: specialisationsRequired !== undefined ? (specialisationsRequired as Prisma.InputJsonValue) : undefined,
        },
      });

      return pat;
    });

    // Fetch the final combined object to return
    const finalProfile = await prisma.patient.findUnique({
      where: { id: updatedPatient.id },
      include: { medicalProfile: true },
    });

    return apiSuccess({ patient: finalProfile });
  } catch (err) {
    console.error('[Patient Profile PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update patient profile', 500);
  }
}
