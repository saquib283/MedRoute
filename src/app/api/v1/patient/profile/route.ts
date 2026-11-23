/**
 * Afzal Healthcare — Patient Profile API Endpoint
 * GET /api/v1/patient/profile — Fetch current patient and medical data
 * PUT /api/v1/patient/profile — Update patient and medical data
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/api/audit-logger';
import { encryptMedicalProfile, decryptMedicalProfile } from '@/lib/api/phi-encryption';
import { decrypt } from '@/lib/auth/crypto';
import { patientProfileSchema } from '@/lib/validation/schemas';
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

    // Decrypt encrypted fields before returning to client
    const decryptedPatient = {
      ...patient,
      passportNo: decrypt(patient.passportNo),
      medicalProfile: decryptMedicalProfile(patient.medicalProfile as Record<string, unknown>),
    };

    // HIPAA Audit Logging (§ 164.312(b))
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'VIEW_PATIENT_PROFILE',
      entityType: 'Patient',
      entityId: patient.id,
    });

    return apiSuccess({ patient: decryptedPatient });
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

    const normalizedBloodGroup = bloodGroup === '' ? undefined : bloodGroup;
    if (normalizedBloodGroup !== undefined) {
      const bgParsed = patientProfileSchema.shape.bloodGroup.safeParse(normalizedBloodGroup);
      if (!bgParsed.success) {
        return apiError(ERROR_CODES.VALIDATION_ERROR, 'Invalid blood group', 400);
      }
    }

    const normalizedPrimaryLanguage =
      typeof primaryLanguage === 'string' && primaryLanguage.trim() === ''
        ? undefined
        : primaryLanguage;

    let validatedEmergencyContact:
      | { name: string; countryCode?: string; phone: string; relation: string }
      | undefined;

    if (emergencyContact !== undefined && emergencyContact !== null) {
      const rawEc =
        typeof emergencyContact === 'object' ? (emergencyContact as Record<string, unknown>) : null;
      const isAllBlank =
        rawEc !== null &&
        !String(rawEc.name ?? '').trim() &&
        !String(rawEc.phone ?? '').trim() &&
        !String(rawEc.relation ?? '').trim();

      if (!isAllBlank) {
        const ecParsed = patientProfileSchema.shape.emergencyContact.safeParse(emergencyContact);
        if (!ecParsed.success || !ecParsed.data) {
          return apiError(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid emergency contact details',
            400,
            ecParsed.success ? undefined : ecParsed.error.flatten().fieldErrors
          );
        }
        validatedEmergencyContact = {
          name: ecParsed.data.name,
          ...(ecParsed.data.countryCode ? { countryCode: ecParsed.data.countryCode } : {}),
          phone: ecParsed.data.phone,
          relation: ecParsed.data.relation,
        };
      }
    }

    // Find the patient ID corresponding to the user ID
    const patient = await prisma.patient.findFirst({
      where: { userId: authUser!.userId },
    });

    if (!patient) {
      return apiError(ERROR_CODES.USER_NOT_FOUND, 'Patient profile not found', 404);
    }

    const encryptedProfileData = encryptMedicalProfile({
      allergies,
      medications,
      surgeries,
      chronicConditions,
      specialisationsRequired,
    });

    // Run transaction update for both Patient and PatientMedicalProfile tables
    const updatedPatient = await prisma.$transaction(async (tx) => {
      // 1. Update Patient details
      const pat = await tx.patient.update({
        where: { id: patient.id },
        data: {
          bloodGroup: normalizedBloodGroup !== undefined ? normalizedBloodGroup : undefined,
          primaryLanguage:
            normalizedPrimaryLanguage !== undefined ? normalizedPrimaryLanguage : undefined,
          emergencyContact:
            validatedEmergencyContact !== undefined
              ? (validatedEmergencyContact as Prisma.InputJsonValue)
              : undefined,
        },
      });

      // 2. Update or Create PatientMedicalProfile
      await tx.patientMedicalProfile.upsert({
        where: { patientId: patient.id },
        create: {
          patientId: patient.id,
          allergies: encryptedProfileData.allergies as Prisma.InputJsonValue || [],
          medications: encryptedProfileData.medications as Prisma.InputJsonValue || [],
          surgeries: encryptedProfileData.surgeries as Prisma.InputJsonValue || [],
          chronicConditions: encryptedProfileData.chronicConditions as Prisma.InputJsonValue || [],
          specialisationsRequired: (specialisationsRequired as Prisma.InputJsonValue) || [],
        },
        update: {
          allergies: encryptedProfileData.allergies !== undefined ? (encryptedProfileData.allergies as Prisma.InputJsonValue) : undefined,
          medications: encryptedProfileData.medications !== undefined ? (encryptedProfileData.medications as Prisma.InputJsonValue) : undefined,
          surgeries: encryptedProfileData.surgeries !== undefined ? (encryptedProfileData.surgeries as Prisma.InputJsonValue) : undefined,
          chronicConditions: encryptedProfileData.chronicConditions !== undefined ? (encryptedProfileData.chronicConditions as Prisma.InputJsonValue) : undefined,
          specialisationsRequired: specialisationsRequired !== undefined ? (specialisationsRequired as Prisma.InputJsonValue) : undefined,
        },
      });

      return pat;
    });

    // Audit Logging
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'UPDATE_PATIENT_PROFILE',
      entityType: 'Patient',
      entityId: patient.id,
    });

    // Fetch the final combined object to return
    const finalProfile = await prisma.patient.findUnique({
      where: { id: updatedPatient.id },
      include: { medicalProfile: true },
    });

    const decryptedProfile = {
      ...finalProfile,
      passportNo: decrypt(finalProfile?.passportNo || ''),
      medicalProfile: decryptMedicalProfile(finalProfile?.medicalProfile as Record<string, unknown>),
    };

    return apiSuccess({ patient: decryptedProfile });
  } catch (err) {
    console.error('[Patient Profile PUT Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to update patient profile', 500);
  }
}

