import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiError, apiSuccess } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';
import { verifyAuditChainIntegrity } from '@/lib/legal/audit-chain';
import { createAuditLog } from '@/lib/api/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = requireAuth(request);
    if (authError) return authError;

    if (authUser!.role !== 'ADMIN') {
      return apiError(ERROR_CODES.FORBIDDEN, 'Admin access required for audit verification', 403);
    }

    const verificationResult = await verifyAuditChainIntegrity();

    // Log the integrity check itself
    void createAuditLog({
      actorId: authUser!.userId,
      action: 'AUDIT_CHAIN_INTEGRITY_CHECK',
      entityType: 'SystemAuditChain',
      entityId: 'ALL',
      newValue: {
        isValid: verificationResult.isValid,
        totalChecked: verificationResult.totalChecked,
        tamperedCount: verificationResult.tamperedCount,
      },
      route: '/api/v1/admin/compliance/audit-verify',
      status: verificationResult.isValid ? 'SUCCESS' : 'ALERT_TAMPERING_DETECTED',
    });

    return apiSuccess({ verification: verificationResult });
  } catch (err) {
    console.error('Audit verification error:', err);
    return apiError(ERROR_CODES.INTERNAL_ERROR, 'Failed to verify audit chain', 500);
  }
}
