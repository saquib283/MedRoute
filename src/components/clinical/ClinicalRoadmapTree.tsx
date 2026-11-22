'use client';

/**
 * Afzal Healthcare — Master Visual Stage & Tree Graph Pathway Architecture
 * Interactive Tree Hierarchy with Stage Trunk Nodes, Visual Branch Elbow Connectors (├──, └──), and Leaf Action Buttons.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Activity,
  Plane,
  ShieldCheck,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Award,
  Bed,
  CalendarCheck,
  Sparkles,
  GitBranch,
  GitCommit,
  Download,
  CreditCard,
  UploadCloud,
  FileCheck,
  Check,
  CornerDownRight,
  FolderTree,
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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PRE_OP: Stethoscope,
  TREATMENT: HeartPulse,
  POST_OP: Bed,
  DISCHARGE: Plane,
  REHAB: Activity,
};

const BRANCH_LABELS: Record<string, { label: string; style: string }> = {
  APPROVED_FOR_SURGERY: { label: 'MDT Board Cleared', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  FIT_FOR_ANESTHESIA: { label: 'PAC Anesthesia Fit', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  UNCOMPLICATED_PROCEDURE: { label: 'Intervention Successful', style: 'bg-sky-100 text-sky-800 border-sky-200' },
  STABLE_STEARN_HEMODYNAMICS: { label: 'Hemodynamics Stable', style: 'bg-purple-100 text-purple-800 border-purple-200' },
  NORMAL_RECOVERY_TRACK: { label: 'Standard Recovery Track', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  FIT_TO_FLY_GRANTED: { label: 'Fit-to-Fly Certified', style: 'bg-sky-100 text-sky-800 border-sky-200' },
};

export function ClinicalRoadmapTree({ steps, fitToFly, currentStatus }: ClinicalRoadmapTreeProps) {
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const totalCount = steps.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Group steps by stageName & stageOrder
  const dynamicStageGroups = useMemo(() => {
    const map = new Map<string, { stageName: string; stageOrder: number; steps: ClinicalStepData[] }>();

    steps.forEach((s) => {
      const name = s.stageName || (
        s.category === 'PRE_OP' ? 'Stage 1: Pre-Procedure Triage & Clearance' :
        s.category === 'TREATMENT' ? 'Stage 2: Active Surgical Intervention' :
        s.category === 'POST_OP' ? 'Stage 3: Ward & CCU Recovery' : 'Stage 4: Fit-to-Fly & Discharge'
      );
      const order = s.stageOrder || (
        s.category === 'PRE_OP' ? 1 : s.category === 'TREATMENT' ? 2 : s.category === 'POST_OP' ? 3 : 4
      );

      if (!map.has(name)) {
        map.set(name, { stageName: name, stageOrder: order, steps: [] });
      }
      map.get(name)!.steps.push(s);
    });

    return Array.from(map.values()).sort((a, b) => a.stageOrder - b.stageOrder);
  }, [steps]);

  // Default open state: open active stage or stage 1
  const [openStages, setOpenStages] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    dynamicStageGroups.forEach((group, idx) => {
      const hasActive = group.steps.some((s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED');
      if (hasActive || idx === 0) {
        initial[group.stageName] = true;
      }
    });
    return initial;
  });

  const toggleStage = (stageName: string) => {
    setOpenStages((prev) => ({
      ...prev,
      [stageName]: !prev[stageName],
    }));
  };

  // Helper to render Stage Action Buttons
  const renderActionButton = (step: ClinicalStepData) => {
    if (!step.actionType) return null;

    switch (step.actionType) {
      case 'ISSUE_VIL':
        return (
          <Link href="/patient/documents" className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
            <Download className="w-3 h-3" /> Download VIL
          </Link>
        );
      case 'SIGN_FIT_TO_FLY':
        return (
          <Link href="/patient/documents" className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
            <ShieldCheck className="w-3 h-3" /> Fit-to-Fly Cert
          </Link>
        );
      case 'ISSUE_PROFORMA':
      case 'SETTLE_BILL':
        return (
          <Link href="/patient/billing" className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
            <CreditCard className="w-3 h-3" /> View Invoice
          </Link>
        );
      case 'UPLOAD_DOCS':
        return (
          <Link href="/patient/documents" className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
            <UploadCloud className="w-3 h-3" /> Upload Scans
          </Link>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Header Summary ────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-surface-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-primary-100 text-primary-800 rounded-md text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5 text-primary-600" /> Stage Tree Architecture
            </span>
            <span className="text-xs text-surface-500 font-bold">
              Status: <strong className="text-primary-700 font-extrabold capitalize">{currentStatus.replace(/_/g, ' ')}</strong>
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-surface-900 mt-1.5">
            Clinical Staging & Decision Tree Map
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Hierarchical treatment tree structure showing stage nodes and decision branch leaves.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-surface-50 p-3.5 rounded-2xl border border-surface-200">
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-surface-500">Total Milestones</p>
            <p className="text-sm font-black text-surface-900">{completedCount} of {totalCount} Done</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-primary-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
            {progressPercent}%
          </div>
        </div>
      </div>

      {/* ─── Fit-to-Fly Clearance Card ────────────────────────────────── */}
      {fitToFly && (
        <div
          className={`p-5 rounded-3xl border transition-all ${
            fitToFly.isCleared
              ? 'bg-gradient-to-r from-sky-900 to-sky-950 text-white border-sky-800 shadow-md'
              : 'bg-amber-50 text-amber-950 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 ${fitToFly.isCleared ? 'bg-sky-800 text-sky-200 border border-sky-700' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
              <Plane className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-extrabold flex items-center gap-2">
                  Fit-to-Fly International Travel Clearance
                  {fitToFly.isCleared && (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-2.5 py-0.5 rounded-md">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Certified
                    </span>
                  )}
                </h3>
                {fitToFly.clearanceDate && (
                  <span className="text-xs font-semibold opacity-90 flex items-center gap-1">
                    <CalendarCheck className="w-3.5 h-3.5" /> Effective: {new Date(fitToFly.clearanceDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {fitToFly.isCleared ? (
                <div className="text-xs leading-relaxed text-sky-100 space-y-1 mt-1.5">
                  <p><strong>Signed By:</strong> {fitToFly.clearedBy || 'Senior Specialist Physician'}</p>
                  {fitToFly.restrictions && (
                    <p className="p-2.5 bg-sky-900/60 rounded-xl border border-sky-800 text-sky-200 font-medium">
                      <strong>Travel Instructions:</strong> {fitToFly.restrictions}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-800 font-medium mt-1">
                  Outpatient wound assessment pending. Fit-to-Fly travel certificate will be issued upon final physician review.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── VISUAL STAGES & TREE GRAPH HIERARCHY ─────────────────────── */}
      <div className="space-y-6">
        {dynamicStageGroups.map((stageGroup, stageIdx) => {
          const isOpen = !!openStages[stageGroup.stageName];
          const completedInGroup = stageGroup.steps.filter((s) => s.status === 'COMPLETED').length;
          const totalInGroup = stageGroup.steps.length;
          const isStageComplete = totalInGroup > 0 && completedInGroup === totalInGroup;
          const isStageActive = stageGroup.steps.some((s) => s.status === 'IN_PROGRESS' || s.status === 'ACTION_REQUIRED');
          const CategoryIcon = CATEGORY_ICONS[stageGroup.steps[0]?.category] || Stethoscope;

          return (
            <div key={stageIdx} className="relative">
              {/* Vertical Connector Pipeline Line between Stages */}
              {stageIdx < dynamicStageGroups.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-surface-200 z-0" />
              )}

              {/* Stage Trunk Node Card */}
              <div
                className={`
                  relative z-10 rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs
                  ${
                    isStageActive
                      ? 'bg-white border-amber-400 ring-2 ring-amber-400/40'
                      : isStageComplete
                      ? 'bg-white border-emerald-200 shadow-2xs'
                      : 'bg-surface-50/80 border-surface-200'
                  }
                `}
              >
                {/* Stage Header Trunk Bar */}
                <button
                  type="button"
                  onClick={() => toggleStage(stageGroup.stageName)}
                  className={`
                    w-full p-4 text-left flex items-center justify-between gap-4 transition-colors select-none
                    ${isStageActive ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-surface-50'}
                  `}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Stage Number Node Badge */}
                    <div
                      className={`
                        w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border shadow-2xs
                        ${
                          isStageComplete
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : isStageActive
                            ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                            : 'bg-white text-surface-600 border-surface-300'
                        }
                      `}
                    >
                      {isStageComplete ? <Check className="w-5 h-5" /> : `S${stageIdx + 1}`}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                          Stage Trunk Node 0{stageIdx + 1}
                        </span>
                        {isStageActive && (
                          <span className="bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                            Active Stage Focus
                          </span>
                        )}
                        {isStageComplete && (
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-200">
                            100% Cleared
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-surface-900 truncate mt-0.5">{stageGroup.stageName}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-surface-700 bg-white px-3 py-1 rounded-xl border border-surface-200 shadow-2xs">
                      {completedInGroup}/{totalInGroup} Branches Cleared
                    </span>
                    <div className="p-1.5 text-surface-400 hover:text-surface-800 rounded-lg">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </button>

                {/* Sub-Tree Branches Container */}
                {isOpen && (
                  <div className="p-5 pt-2 border-t border-surface-100 bg-surface-50/50 space-y-3">
                    <div className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1.5 mb-2 pl-2">
                      <GitBranch className="w-3.5 h-3.5 text-primary-600" /> Decision & Milestone Sub-Branches
                    </div>

                    {/* Sub-Tree Branch Nodes with visual Elbow lines (├──, └──) */}
                    <div className="space-y-3 pl-2">
                      {stageGroup.steps.map((step, stepIdx) => {
                        const isCompleted = step.status === 'COMPLETED';
                        const isInProgress = step.status === 'IN_PROGRESS' || step.status === 'ACTION_REQUIRED';
                        const isLastBranch = stepIdx === stageGroup.steps.length - 1;
                        const branchInfo = step.decisionBranch ? BRANCH_LABELS[step.decisionBranch] : null;

                        return (
                          <div key={step.id || stepIdx} className="relative flex items-start gap-3 group">
                            {/* Visual Tree Connector Branch Line (Corner Elbow) */}
                            <div className="flex items-center gap-2 text-surface-300 pt-3 shrink-0 select-none font-mono text-xs">
                              <CornerDownRight className={`w-4 h-4 ${isCompleted ? 'text-emerald-600' : isInProgress ? 'text-amber-500' : 'text-surface-300'}`} />
                            </div>

                            {/* Sub-Tree Branch Leaf Card */}
                            <div
                              className={`
                                flex-1 p-4 rounded-2xl border transition-all space-y-2 shadow-2xs
                                ${
                                  isInProgress
                                    ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-400/40'
                                    : isCompleted
                                    ? 'bg-white border-surface-200'
                                    : 'bg-white/70 border-surface-200 opacity-80'
                                }
                              `}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`
                                      w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0
                                      ${
                                        isCompleted
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : isInProgress
                                          ? 'bg-amber-500 text-white'
                                          : 'bg-surface-100 text-surface-600 border border-surface-200'
                                      }
                                    `}
                                  >
                                    {stageIdx + 1}.{stepIdx + 1}
                                  </span>
                                  <h4 className="text-xs font-extrabold text-surface-900 leading-snug">{step.title}</h4>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {branchInfo && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${branchInfo.style}`}>
                                      <Award className="w-3 h-3" />
                                      {branchInfo.label}
                                    </span>
                                  )}

                                  <span
                                    className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                      isCompleted
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isInProgress
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-surface-200 text-surface-600'
                                    }`}
                                  >
                                    {step.status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>

                              {/* Clinical Note & Action Buttons */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-surface-100">
                                {step.doctorNotes ? (
                                  <p className="text-xs text-surface-700 font-medium">
                                    <strong className="text-surface-900 font-bold">Clinical Note:</strong> {step.doctorNotes}
                                  </p>
                                ) : (
                                  <span className="text-xs text-surface-500 font-medium">Tree Branch Active</span>
                                )}

                                {renderActionButton(step)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
