'use client';

/**
 * Afzal Healthcare — Patient Care & Recovery Roadmap
 * Clean institutional milestone list with 8px/6px architectural radii,
 * restrained medium/semibold weights, and flat surface contrast.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { CASE_STATUS_LABELS } from '@/lib/constants';
import { resolveRoadmapStepActionState } from '@/lib/validation/lifecycle-schemas';
import {
  Plane,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
  Download,
  CreditCard,
  UploadCloud,
  Check,
  Clock,
  ClipboardCheck,
  HeartPulse,
  Calendar,
} from 'lucide-react';

export interface ClinicalStepData {
  id: string;
  title: string;
  stageName?: string;
  stageOrder?: number;
  stepOrder?: number;
  category: 'PRE_OP' | 'TREATMENT' | 'POST_OP' | 'DISCHARGE' | 'REHAB' | string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'ACTION_REQUIRED' | string;
  decisionBranch?: string | null;
  doctorNotes?: string | null;
  actionType?: string | null;
  requiredRole?: string | null;
  actionUrl?: string | null;
  completedAt?: string | null;
}

export interface FitToFlyData {
  isCleared: boolean;
  clearedBy?: string | null;
  clearanceDate?: string | null;
  restrictions?: string | null;
  reEvalDate?: string | null;
}

interface ClinicalRoadmapTreeProps {
  steps: ClinicalStepData[];
  fitToFly?: FitToFlyData | null;
  currentStatus: string;
  issuedDocCategories?: ReadonlySet<string> | readonly string[] | null;
  unpaidBillCount?: number;
  hasTreatmentPlan?: boolean;
  treatmentPlanAccepted?: boolean;
  hasPendingFollowUp?: boolean;
  onOpenAction?: (action: 'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL') => void;
}

const CLINICAL_OUTCOME_LABELS: Record<string, string> = {
  APPROVED_FOR_SURGERY: 'Cleared for Procedure',
  FIT_FOR_ANESTHESIA: 'Anesthesia Cleared',
  UNCOMPLICATED_PROCEDURE: 'Completed Smoothly',
  STABLE_STEARN_HEMODYNAMICS: 'Vital Signs Stable',
  NORMAL_RECOVERY_TRACK: 'On-Track Recovery',
  FIT_TO_FLY_GRANTED: 'Cleared for Return Travel',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In progress',
  ACTION_REQUIRED: 'Action needed',
  PENDING: 'Upcoming',
};

function cleanStageHeading(rawName: string): string {
  return rawName.replace(/^Stage\s*\d+\s*:\s*/i, '').trim() || rawName;
}

export function ClinicalRoadmapTree({
  steps,
  fitToFly,
  currentStatus,
  issuedDocCategories,
  unpaidBillCount = 0,
  hasTreatmentPlan = false,
  treatmentPlanAccepted = false,
  hasPendingFollowUp = false,
  onOpenAction,
}: ClinicalRoadmapTreeProps) {
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const totalCount = steps.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const dynamicStageGroups = useMemo(() => {
    const map = new Map<string, { stageName: string; stageOrder: number; steps: ClinicalStepData[] }>();

    steps.forEach((s) => {
      const name =
        s.stageName ||
        (s.category === 'PRE_OP'
          ? 'Pre-Procedure Assessment & Clearance'
          : s.category === 'TREATMENT'
          ? 'Hospital Admission & Procedure'
          : s.category === 'POST_OP'
          ? 'In-Hospital Recovery & Monitoring'
          : 'Travel Clearance & Follow-Up Care');
      const order =
        s.stageOrder ||
        (s.category === 'PRE_OP' ? 1 : s.category === 'TREATMENT' ? 2 : s.category === 'POST_OP' ? 3 : 4);

      if (!map.has(name)) {
        map.set(name, { stageName: name, stageOrder: order, steps: [] });
      }
      map.get(name)!.steps.push(s);
    });

    return Array.from(map.values()).sort((a, b) => a.stageOrder - b.stageOrder);
  }, [steps]);

  const [openStages, setOpenStages] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    let openedAny = false;

    dynamicStageGroups.forEach((group) => {
      const hasActive = group.steps.some(
        (s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED'
      );
      if (hasActive) {
        initial[group.stageName] = true;
        openedAny = true;
      }
    });

    if (!openedAny && dynamicStageGroups.length > 0) {
      const firstIncomplete = dynamicStageGroups.find((group) =>
        group.steps.some((s) => s.status !== 'COMPLETED')
      );
      const fallbackStage = firstIncomplete || dynamicStageGroups[dynamicStageGroups.length - 1];
      initial[fallbackStage.stageName] = true;
    }

    return initial;
  });

  const allExpanded =
    dynamicStageGroups.length > 0 &&
    dynamicStageGroups.every((group) => Boolean(openStages[group.stageName]));

  const toggleAllStages = () => {
    if (allExpanded) {
      const compact: Record<string, boolean> = {};
      dynamicStageGroups.forEach((group) => {
        const hasActive = group.steps.some(
          (s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED'
        );
        if (hasActive) compact[group.stageName] = true;
      });
      if (Object.keys(compact).length === 0 && dynamicStageGroups[0]) {
        compact[dynamicStageGroups[0].stageName] = true;
      }
      setOpenStages(compact);
    } else {
      const next: Record<string, boolean> = {};
      dynamicStageGroups.forEach((group) => {
        next[group.stageName] = true;
      });
      setOpenStages(next);
    }
  };

  const toggleStage = (stageName: string) => {
    setOpenStages((prev) => ({
      ...prev,
      [stageName]: !prev[stageName],
    }));
  };

  const renderActionButton = (step: ClinicalStepData) => {
    const actionState = resolveRoadmapStepActionState({
      step,
      issuedDocCategories,
      unpaidBillCount,
      hasTreatmentPlan,
      treatmentPlanAccepted,
      hasPendingFollowUp,
    });

    if (!actionState) return null;

    if (actionState.kind === 'WAITING_ON_HOSPITAL') {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-surface-100 text-surface-600 border border-surface-200 rounded-md text-xs font-medium shrink-0">
          <Clock className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
          <span>{actionState.label}</span>
        </span>
      );
    }

    if (actionState.kind === 'CERTIFICATE_DOWNLOAD') {
      return (
        <Link
          href={actionState.href}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-white hover:bg-surface-100 text-surface-800 border border-surface-300 rounded-md text-xs font-medium transition-colors shrink-0"
        >
          {step.actionType === 'SIGN_FIT_TO_FLY' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
          ) : (
            <Download className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
          )}
          <span>{actionState.label}</span>
        </Link>
      );
    }

    if (actionState.kind === 'OPEN_MODAL') {
      const isFollowUp = actionState.modalAction === 'FOLLOW_UP_MODAL';
      const fallbackHref = isFollowUp ? '/patient/appointments' : '/patient/billing';
      if (onOpenAction) {
        return (
          <button
            type="button"
            onClick={() => onOpenAction(actionState.modalAction)}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-primary-600 hover:bg-primary-700 text-white border border-primary-700/20 rounded-md text-xs font-medium transition-colors shrink-0"
          >
            {isFollowUp ? (
              <HeartPulse className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{actionState.label}</span>
          </button>
        );
      }
      return (
        <Link
          href={fallbackHref}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-white hover:bg-surface-100 text-surface-800 border border-surface-300 rounded-md text-xs font-medium transition-colors shrink-0"
        >
          <span>{actionState.label}</span>
        </Link>
      );
    }

    if (actionState.variant === 'primary') {
      return (
        <Link
          href={actionState.href}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-xs font-medium transition-colors shrink-0"
        >
          <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{actionState.label}</span>
        </Link>
      );
    }

    return (
      <Link
        href={actionState.href}
        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-white hover:bg-surface-100 text-surface-800 border border-surface-300 rounded-md text-xs font-medium transition-colors shrink-0"
      >
        {step.actionType === 'ARRANGE_LOGISTICS' ? (
          <Plane className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
        ) : step.actionType === 'SCHEDULE_TELE_REHAB' ? (
          <Calendar className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
        ) : (
          <CreditCard className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
        )}
        <span>{actionState.label}</span>
      </Link>
    );
  };

  const humanCurrentStatus =
    CASE_STATUS_LABELS[currentStatus] || currentStatus.replace(/_/g, ' ');

  return (
    <section
      aria-labelledby="care-roadmap-heading"
      className="bg-white rounded-lg border border-surface-200 shadow-2xs overflow-hidden"
    >
      {/* ─── Clean Flat Section Header ─────────────────────────────────── */}
      <div className="p-5 border-b border-surface-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 id="care-roadmap-heading" className="text-base font-semibold text-surface-900">
              Care &amp; Recovery Milestones
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary-50 text-primary-800 border border-primary-200 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600" aria-hidden="true" />
              {humanCurrentStatus}
            </span>
          </div>
          <p className="text-xs text-surface-500">
            Clinical steps from pre-travel review through hospital care and return travel clearance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-50 border border-surface-200 text-xs">
            <span className="text-surface-600 tabular-nums">
              <strong className="font-semibold text-surface-900">{completedCount}</strong> of{' '}
              {totalCount} completed
            </span>
            <span className="text-surface-300" aria-hidden="true">
              •
            </span>
            <span className="font-semibold text-primary-700 tabular-nums">{progressPercent}%</span>
          </div>

          {dynamicStageGroups.length > 1 && (
            <button
              type="button"
              onClick={toggleAllStages}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-50 text-xs font-medium text-surface-700 transition-colors"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
                  <span>Collapse completed</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
                  <span>Expand all</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Restrained Fit-to-Fly Notice Bar ──────────────────────────── */}
      {fitToFly && (
        <div
          className={`px-5 py-4 border-b ${
            fitToFly.isCleared
              ? 'bg-success-50/50 border-surface-200 text-surface-900'
              : 'bg-warning-50/60 border-surface-200 text-surface-900'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border ${
                fitToFly.isCleared
                  ? 'bg-white text-success-700 border-success-200'
                  : 'bg-white text-warning-700 border-warning-200'
              }`}
            >
              <Plane className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-surface-900">
                    Fit-to-Fly Travel Clearance
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${
                      fitToFly.isCleared
                        ? 'bg-white text-success-800 border-success-200'
                        : 'bg-white text-warning-800 border-warning-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    {fitToFly.isCleared ? 'Cleared for Travel' : 'Pending Review'}
                  </span>
                </div>
                {fitToFly.clearanceDate && (
                  <span className="text-xs text-surface-500 flex items-center gap-1 tabular-nums">
                    <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Issued{' '}
                    {new Date(fitToFly.clearanceDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {fitToFly.isCleared ? (
                <div className="text-xs text-surface-600 space-y-1">
                  <p>
                    <span className="font-medium text-surface-800">Signed by:</span>{' '}
                    {fitToFly.clearedBy || 'Attending Specialist Physician'}
                  </p>
                  {fitToFly.restrictions && (
                    <p className="text-surface-600 leading-relaxed">
                      <span className="font-medium text-surface-800">Travel guidance:</span>{' '}
                      {fitToFly.restrictions}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-surface-600 leading-relaxed">
                  Your attending physician will issue your Fit-to-Fly certificate following your
                  post-procedure evaluation.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Collapsible Stage Rows ────────────────────────────────────── */}
      <div className="divide-y divide-surface-200">
        {dynamicStageGroups.map((stageGroup, stageIdx) => {
          const isOpen = Boolean(openStages[stageGroup.stageName]);
          const completedInGroup = stageGroup.steps.filter((s) => s.status === 'COMPLETED').length;
          const totalInGroup = stageGroup.steps.length;
          const isStageComplete = totalInGroup > 0 && completedInGroup === totalInGroup;
          const isStageActive = stageGroup.steps.some(
            (s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED'
          );

          return (
            <div key={stageGroup.stageName} className="bg-white">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleStage(stageGroup.stageName)}
                className="w-full min-h-14 px-5 py-3.5 text-left flex items-center justify-between gap-4 hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center font-semibold text-xs tabular-nums shrink-0 border ${
                      isStageComplete
                        ? 'bg-success-50 text-success-700 border-success-200'
                        : isStageActive
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-surface-100 text-surface-600 border-surface-200'
                    }`}
                  >
                    {isStageComplete ? (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      stageIdx + 1
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-surface-900">
                        {cleanStageHeading(stageGroup.stageName)}
                      </h3>
                      {isStageActive && (
                        <span className="bg-primary-50 text-primary-800 border border-primary-200 text-[11px] font-medium px-2 py-0.5 rounded-md">
                          Current stage
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 tabular-nums">
                      {completedInGroup} of {totalInGroup} completed
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md text-surface-400 shrink-0">
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 pt-1 bg-surface-50/50 border-t border-surface-100 divide-y divide-surface-200/70">
                  {stageGroup.steps.map((step, stepIdx) => {
                    const isCompleted = step.status === 'COMPLETED';
                    const isInProgress =
                      step.status === 'IN_PROGRESS' || step.status === 'ACTION_REQUIRED';
                    const outcomeLabel = step.decisionBranch
                      ? CLINICAL_OUTCOME_LABELS[step.decisionBranch]
                      : null;
                    const actionButton = renderActionButton(step);

                    return (
                      <div key={step.id || stepIdx} className="py-3.5 first:pt-2.5 last:pb-1 space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center font-medium text-[11px] tabular-nums shrink-0 ${
                                isCompleted
                                  ? 'bg-success-50 text-success-700 border border-success-200'
                                  : isInProgress
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-surface-500 border border-surface-200'
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                stepIdx + 1
                              )}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-surface-900 leading-snug">
                                {step.title}
                              </h4>
                              {step.completedAt && isCompleted && (
                                <p className="text-xs text-surface-500 mt-0.5 tabular-nums">
                                  Completed{' '}
                                  {new Date(step.completedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {outcomeLabel && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-surface-700 border border-surface-200 text-[11px] font-medium">
                                {outcomeLabel}
                              </span>
                            )}

                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                isCompleted
                                  ? 'bg-success-50 text-success-800 border-success-200'
                                  : isInProgress
                                  ? 'bg-warning-50 text-warning-800 border-warning-200'
                                  : 'bg-white text-surface-600 border-surface-200'
                              }`}
                            >
                              {!isCompleted && <Clock className="w-3 h-3" aria-hidden="true" />}
                              {STEP_STATUS_LABELS[step.status] || step.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {(step.doctorNotes || actionButton) && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-7">
                            {step.doctorNotes ? (
                              <p className="text-xs text-surface-600 leading-relaxed">
                                <span className="font-medium text-surface-800">Note:</span>{' '}
                                {step.doctorNotes}
                              </p>
                            ) : (
                              <span />
                            )}

                            {actionButton}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
