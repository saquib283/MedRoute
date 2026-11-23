'use client';

/**
 * Afzal Healthcare — Patient Care & Recovery Roadmap
 * Calm, plain-English clinical milestone tracker that auto-collapses completed stages
 * so patients immediately see their active step and next action.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { CASE_STATUS_LABELS } from '@/lib/constants';
import {
  Plane,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Award,
  CalendarCheck,
  Download,
  CreditCard,
  UploadCloud,
  Check,
  Clock,
  Sparkles,
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
}

const CLINICAL_OUTCOME_LABELS: Record<string, { label: string; style: string }> = {
  APPROVED_FOR_SURGERY: {
    label: 'Cleared for Procedure',
    style: 'bg-success-50 text-success-800 border-success-200',
  },
  FIT_FOR_ANESTHESIA: {
    label: 'Anesthesia Cleared',
    style: 'bg-success-50 text-success-800 border-success-200',
  },
  UNCOMPLICATED_PROCEDURE: {
    label: 'Procedure Completed Smoothly',
    style: 'bg-info-50 text-info-800 border-info-200',
  },
  STABLE_STEARN_HEMODYNAMICS: {
    label: 'Vital Signs Stable',
    style: 'bg-primary-50 text-primary-800 border-primary-200',
  },
  NORMAL_RECOVERY_TRACK: {
    label: 'On-Track Recovery',
    style: 'bg-success-50 text-success-800 border-success-200',
  },
  FIT_TO_FLY_GRANTED: {
    label: 'Cleared for Return Travel',
    style: 'bg-info-50 text-info-800 border-info-200',
  },
};

const STEP_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  ACTION_REQUIRED: 'Action Needed',
  PENDING: 'Upcoming',
};

function cleanStageHeading(rawName: string): string {
  return rawName.replace(/^Stage\s*\d+\s*:\s*/i, '').trim() || rawName;
}

export function ClinicalRoadmapTree({
  steps,
  fitToFly,
  currentStatus,
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

  // Auto-open ONLY active or first incomplete stage so completed history stays compact
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
    if (!step.actionType) return null;

    switch (step.actionType) {
      case 'ISSUE_VIL':
        return (
          <Link
            href="/patient/documents"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 bg-info-600 hover:bg-info-700 active:scale-[0.96] text-white rounded-xl text-xs font-semibold shadow-2xs transition-[background-color,transform] duration-150 shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download Visa Letter</span>
          </Link>
        );
      case 'SIGN_FIT_TO_FLY':
        return (
          <Link
            href="/patient/documents"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 bg-success-600 hover:bg-success-700 active:scale-[0.96] text-white rounded-xl text-xs font-semibold shadow-2xs transition-[background-color,transform] duration-150 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fit-to-Fly Certificate</span>
          </Link>
        );
      case 'ISSUE_PROFORMA':
      case 'SETTLE_BILL':
        return (
          <Link
            href="/patient/billing"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.96] text-white rounded-xl text-xs font-semibold shadow-2xs transition-[background-color,transform] duration-150 shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Review Invoice</span>
          </Link>
        );
      case 'UPLOAD_DOCS':
        return (
          <Link
            href="/patient/documents"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 bg-warning-600 hover:bg-warning-700 active:scale-[0.96] text-white rounded-xl text-xs font-semibold shadow-2xs transition-[background-color,transform] duration-150 shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Upload Medical Records</span>
          </Link>
        );
      default:
        return null;
    }
  };

  const humanCurrentStatus =
    CASE_STATUS_LABELS[currentStatus] || currentStatus.replace(/_/g, ' ');

  return (
    <section aria-labelledby="care-roadmap-heading" className="space-y-5">
      {/* ─── Summary Header Card ───────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-surface-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 id="care-roadmap-heading" className="text-lg sm:text-xl font-bold text-surface-900">
              Your Care &amp; Recovery Roadmap
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-800 border border-primary-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              {humanCurrentStatus}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-surface-600 max-w-2xl">
            Follow each clinical step from pre-travel preparation through hospital recovery and safe return travel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 bg-surface-50 px-4 py-2.5 rounded-2xl border border-surface-200">
            <div>
              <p className="text-xs font-semibold text-surface-600">Milestones Completed</p>
              <p className="text-sm font-bold text-surface-900 tabular-nums">
                {completedCount} of {totalCount} steps
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-primary-600 text-white font-bold text-xs tabular-nums flex items-center justify-center shadow-2xs">
              {progressPercent}%
            </div>
          </div>

          {dynamicStageGroups.length > 1 && (
            <button
              type="button"
              onClick={toggleAllStages}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-surface-700 transition-colors"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 text-surface-500" aria-hidden="true" />
                  <span>Focus active step</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-surface-500" aria-hidden="true" />
                  <span>Expand all stages</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Fit-to-Fly Clearance Card ────────────────────────────────── */}
      {fitToFly && (
        <div
          className={`p-5 rounded-3xl border ${
            fitToFly.isCleared
              ? 'bg-gradient-to-r from-primary-900 to-primary-800 text-white border-primary-700 shadow-md'
              : 'bg-warning-50 text-warning-900 border-warning-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                fitToFly.isCleared
                  ? 'bg-primary-800 text-primary-100 border border-primary-700'
                  : 'bg-warning-100 text-warning-800 border border-warning-200'
              }`}
            >
              <Plane className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2 flex-wrap">
                  <span>Fit-to-Fly Return Travel Clearance</span>
                  {fitToFly.isCleared && (
                    <span className="inline-flex items-center gap-1 bg-success-500/20 text-success-200 border border-success-400/40 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5 text-success-300" aria-hidden="true" />
                      Cleared to Fly
                    </span>
                  )}
                </h3>
                {fitToFly.clearanceDate && (
                  <span className="text-xs font-medium opacity-90 flex items-center gap-1 tabular-nums">
                    <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Issued {new Date(fitToFly.clearanceDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {fitToFly.isCleared ? (
                <div className="text-xs leading-relaxed text-primary-100 space-y-1.5">
                  <p>
                    <strong className="text-white">Cleared by:</strong>{' '}
                    {fitToFly.clearedBy || 'Attending Specialist Physician'}
                  </p>
                  {fitToFly.restrictions && (
                    <p className="p-3 bg-primary-950/50 rounded-2xl border border-primary-700 text-primary-100">
                      <strong className="text-white">Cabin &amp; Mobility Guidance:</strong>{' '}
                      {fitToFly.restrictions}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-warning-800 leading-relaxed">
                  Your attending doctor will issue your official Fit-to-Fly certificate after your post-procedure checkup.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Collapsible Care Stages ───────────────────────────────────── */}
      <div className="space-y-4">
        {dynamicStageGroups.map((stageGroup, stageIdx) => {
          const isOpen = Boolean(openStages[stageGroup.stageName]);
          const completedInGroup = stageGroup.steps.filter((s) => s.status === 'COMPLETED').length;
          const totalInGroup = stageGroup.steps.length;
          const isStageComplete = totalInGroup > 0 && completedInGroup === totalInGroup;
          const isStageActive = stageGroup.steps.some(
            (s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED'
          );

          return (
            <div
              key={stageGroup.stageName}
              className={`rounded-3xl border overflow-hidden shadow-2xs transition-colors ${
                isStageActive
                  ? 'bg-white border-primary-400 ring-2 ring-primary-500/20'
                  : isStageComplete
                  ? 'bg-white border-surface-200'
                  : 'bg-surface-50/90 border-surface-200'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleStage(stageGroup.stageName)}
                className={`w-full min-h-16 px-5 py-4 text-left flex items-center justify-between gap-4 transition-colors ${
                  isStageActive ? 'bg-primary-50/50 hover:bg-primary-50/80' : 'hover:bg-surface-50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs tabular-nums shrink-0 border ${
                      isStageComplete
                        ? 'bg-success-600 text-white border-success-700'
                        : isStageActive
                        ? 'bg-primary-600 text-white border-primary-700'
                        : 'bg-white text-surface-600 border-surface-300'
                    }`}
                  >
                    {isStageComplete ? (
                      <Check className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      stageIdx + 1
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-surface-900">
                        {cleanStageHeading(stageGroup.stageName)}
                      </h3>
                      {isStageActive && (
                        <span className="bg-warning-100 text-warning-900 border border-warning-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          Current Stage
                        </span>
                      )}
                      {isStageComplete && (
                        <span className="bg-success-50 text-success-800 border border-success-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 tabular-nums">
                      Phase {stageIdx + 1} of {dynamicStageGroups.length} • {completedInGroup} of{' '}
                      {totalInGroup} completed
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-surface-500 shrink-0">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-5 h-5" aria-hidden="true" />
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="p-4 sm:p-5 border-t border-surface-200 bg-surface-50/50 space-y-3">
                  {stageGroup.steps.map((step, stepIdx) => {
                    const isCompleted = step.status === 'COMPLETED';
                    const isInProgress =
                      step.status === 'IN_PROGRESS' || step.status === 'ACTION_REQUIRED';
                    const outcomeBadge = step.decisionBranch
                      ? CLINICAL_OUTCOME_LABELS[step.decisionBranch]
                      : null;

                    return (
                      <div
                        key={step.id || stepIdx}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          isInProgress
                            ? 'bg-white border-primary-300 shadow-xs'
                            : isCompleted
                            ? 'bg-white border-surface-200'
                            : 'bg-white/80 border-surface-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs tabular-nums shrink-0 ${
                                isCompleted
                                  ? 'bg-success-100 text-success-800 border border-success-200'
                                  : isInProgress
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-surface-100 text-surface-600 border border-surface-200'
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                stepIdx + 1
                              )}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-surface-900 leading-snug">
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
                            {outcomeBadge && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${outcomeBadge.style}`}
                              >
                                <Award className="w-3.5 h-3.5" aria-hidden="true" />
                                {outcomeBadge.label}
                              </span>
                            )}

                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-success-50 text-success-800 border-success-200'
                                  : isInProgress
                                  ? 'bg-warning-50 text-warning-800 border-warning-200'
                                  : 'bg-surface-100 text-surface-600 border-surface-200'
                              }`}
                            >
                              {!isCompleted && <Clock className="w-3 h-3" aria-hidden="true" />}
                              {STEP_STATUS_LABELS[step.status] || step.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {(step.doctorNotes || step.actionType) && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-surface-100">
                            {step.doctorNotes ? (
                              <p className="text-xs text-surface-700 leading-relaxed">
                                <strong className="text-surface-900 font-semibold">
                                  Care Team Note:
                                </strong>{' '}
                                {step.doctorNotes}
                              </p>
                            ) : (
                              <span className="text-xs text-surface-500">
                                {isInProgress
                                  ? 'Action available for this step'
                                  : 'Linked care resource'}
                              </span>
                            )}

                            {renderActionButton(step)}
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
