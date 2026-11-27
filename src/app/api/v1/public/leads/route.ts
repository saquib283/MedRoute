import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── CORS Headers for external site / form integration ───────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

/**
 * OPTIONS /api/v1/public/leads
 * Pre-flight handler for cross-origin form submissions.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * POST /api/v1/public/leads
 * Public endpoint for external marketing forms, landing pages, and webhooks.
 * Supports application/json, application/x-www-form-urlencoded, and multipart/form-data.
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await req.formData().catch(() => new FormData());
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else {
      // Fallback attempt to parse JSON
      body = await req.json().catch(() => ({}));
    }

    // ── Field Aliases for maximum integration flexibility ─────────────
    const fullName =
      (body.fullName as string) ||
      (body.name as string) ||
      (body.full_name as string) ||
      (body.patient_name as string) ||
      '';

    const email = (body.email as string) || '';

    const phone =
      (body.phone as string) ||
      (body.phoneNumber as string) ||
      (body.phone_number as string) ||
      (body.mobile as string) ||
      '';

    const nationality = (body.nationality as string) || (body.country as string) || 'Not Specified';

    const city = (body.city as string) || (body.location as string) || null;

    const medicalCondition =
      (body.medicalCondition as string) ||
      (body.medical_condition as string) ||
      (body.condition as string) ||
      (body.treatment as string) ||
      (body.inquiry as string) ||
      (body.message as string) ||
      '';

    const preferredHospitalCity =
      (body.preferredHospitalCity as string) ||
      (body.preferred_hospital_city as string) ||
      (body.preferred_city as string) ||
      (body.destination_city as string) ||
      null;

    const estimatedBudget =
      (body.estimatedBudget as string) ||
      (body.estimated_budget as string) ||
      (body.budget as string) ||
      null;

    const source =
      (body.source as string) ||
      (body.utm_source as string) ||
      (body.campaign_source as string) ||
      'external_form';

    const message = (body.message as string) || (body.comments as string) || (body.notes as string) || null;

    // ── Validate required fields ──────────────────────────────────────
    if (!fullName || !email || !phone || !medicalCondition) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Name, email, phone number, and medical condition/inquiry message are required.',
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: { message: 'Please provide a valid email address.' } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Spam protection: block duplicate email within 24h ─────────────
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const recentDuplicate = await db.leadQuery.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              'We have already received your inquiry. Our team will contact you within 24–48 hours.',
          },
          data: { referenceId: recentDuplicate.id },
        },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // ── Create lead record ────────────────────────────────────────────
    const lead = await db.leadQuery.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        nationality: nationality.trim(),
        city: city?.trim() || null,
        medicalCondition: medicalCondition.trim(),
        preferredHospitalCity: preferredHospitalCity?.trim() || null,
        estimatedBudget: estimatedBudget?.trim() || null,
        source: source.trim(),
        message: message?.trim() || null,
        status: 'NEW',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Inquiry received successfully. Our team will reach out shortly.',
        data: {
          referenceId: lead.id,
          fullName: lead.fullName,
          email: lead.email,
          createdAt: lead.createdAt,
        },
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[POST /api/v1/public/leads] Integration Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Something went wrong processing the submission.' } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
