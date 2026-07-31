/**
 * Afzal Healthcare — Admin & Manager Configurable Patient Pathway API
 * GET /api/v1/admin/cases/[id]/pathway — Fetch patient's custom configured clinical stages and steps
 * POST /api/v1/admin/cases/[id]/pathway — Configure, add, reorder, or update custom clinical stages and sub-steps for a patient
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;

    const targetCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        clinicalSteps: {
          orderBy: [
            { stageOrder: 'asc' },
            { stepOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        fitToFlyClearance: true,
      },
    });

    if (!targetCase) {
      return apiError(ERROR_CODES.NOT_FOUND, 'Patient case not found', 404);
    }

    return apiSuccess({ case: targetCase });
  } catch (err) {
    console.error('[Pathway GET Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch clinical pathway configuration', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    const { id: caseId } = await params;
    const body = await request.json();
    const { steps: stepsInput, caseStatus } = body;

    if (!Array.isArray(stepsInput)) {
      return apiError(ERROR_CODES.BAD_REQUEST, 'steps array is required', 400);
    }

    // Replace or update clinical steps for this case
    await prisma.$transaction(async (tx) => {
      // Delete existing steps if replacing, or update
      await tx.clinicalStep.deleteMany({
        where: { caseId },
      });

      // Insert configured steps
      for (const stepData of stepsInput) {
        await tx.clinicalStep.create({
          data: {
            caseId,
            stageName: stepData.stageName || 'Stage 1: Custom Stage',
            stageOrder: parseInt(stepData.stageOrder) || 1,
            stepOrder: parseInt(stepData.stepOrder) || 1,
            title: stepData.title,
            category: stepData.category || 'PRE_OP',
            status: stepData.status || 'PENDING',
            decisionBranch: stepData.decisionBranch || null,
            doctorNotes: stepData.doctorNotes || null,
            completedAt: stepData.status === 'COMPLETED' ? (stepData.completedAt ? new Date(stepData.completedAt) : new Date()) : null,
          },
        });
      }

      if (caseStatus) {
        await tx.case.update({
          where: { id: caseId },
          data: { status: caseStatus as any },
        });
      }
    });

    const updatedCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        clinicalSteps: {
          orderBy: [
            { stageOrder: 'asc' },
            { stepOrder: 'asc' },
          ],
        },
      },
    });

    return apiSuccess({ case: updatedCase });
  } catch (err) {
    console.error('[Pathway POST Error]', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to save patient clinical pathway', 500);
  }
}
