/**
 * MediRoute India — API Response Helpers
 * Consistent response envelope per PRD Section 6.4:
 * { success: boolean, data?: T, error?: { code: string, message: string }, meta?: object }
 */

import { NextResponse } from 'next/server';

// ─── Types ──────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cursor?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Success Response ───────────────────────────────────────────────

export function apiSuccess<T>(
  data: T,
  meta?: ApiSuccessResponse['meta'],
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = { success: true as const, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

// ─── Error Response ─────────────────────────────────────────────────

export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const error: ApiErrorResponse['error'] = { code, message };
  if (details !== undefined) error.details = details;
  return NextResponse.json(
    { success: false as const, error },
    { status }
  );
}

// ─── Common Error Helpers ───────────────────────────────────────────

export function notFound(message: string = 'Resource not found') {
  return apiError('NOT_FOUND', message, 404);
}

export function unauthorized(message: string = 'Authentication required') {
  return apiError('UNAUTHORIZED', message, 401);
}

export function forbidden(message: string = 'Insufficient permissions') {
  return apiError('FORBIDDEN', message, 403);
}

export function badRequest(message: string, details?: unknown) {
  return apiError('BAD_REQUEST', message, 400, details);
}

export function validationError(details: unknown) {
  return apiError('VALIDATION_ERROR', 'Invalid request data', 422, details);
}

export function conflict(code: string, message: string) {
  return apiError(code, message, 409);
}

export function tooManyRequests(message: string = 'Rate limit exceeded') {
  return apiError('RATE_LIMIT_EXCEEDED', message, 429);
}

export function internalError(message: string = 'Internal server error') {
  // Log internally but don't expose details to client
  console.error('[API Internal Error]', message);
  return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
