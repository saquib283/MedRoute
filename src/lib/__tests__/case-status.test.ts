import { CASE_STATUS_ORDER, CASE_STATUS_LABELS, CASE_PHASE_GROUPS, getCasePhaseIndex } from '../constants';
import { updateCaseStatusSchema } from '../validation/schemas';

const ALL_12 = [
  'INQUIRY_RECEIVED',
  'UNDER_REVIEW',
  'PRE_OP_CLEARANCE',
  'PLAN_CONFIRMED',
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED',
];

describe('12-Stage CaseStatus Alignment', () => {
  it('orders and labels all 12 Prisma CaseStatus values', () => {
    expect([...CASE_STATUS_ORDER]).toEqual(ALL_12);
    for (const s of ALL_12) {
      expect(CASE_STATUS_LABELS[s]).toBeTruthy();
      expect(updateCaseStatusSchema.safeParse({ status: s }).success).toBe(true);
    }
  });

  it('maps WARD_RECOVERY to Phase 4 (index 3: Recovery) instead of defaulting to Phase 1', () => {
    expect(CASE_PHASE_GROUPS).toHaveLength(6);
    expect(getCasePhaseIndex('WARD_RECOVERY')).toBe(3);
    expect(getCasePhaseIndex('FIT_TO_FLY_CLEARED')).toBe(4);
    expect(getCasePhaseIndex('CLOSED')).toBe(5);
  });
});
