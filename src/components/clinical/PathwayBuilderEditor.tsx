'use client';

/**
 * Afzal Healthcare — Shared Configurable Patient Clinical Pathway & Action Orchestration Builder
 * Admins & Managers can apply 7-stage specialty presets (Cardiology, Oncology, Orthopedics)
 * or configure custom stages, action buttons, and responsible roles.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  MoveUp,
  MoveDown,
} from 'lucide-react';

interface ClinicalStepConfig {
  id?: string;
  stageName: string;
  stageOrder: number;
  stepOrder: number;
  title: string;
  category: string;
  status: string;
  decisionBranch?: string | null;
  doctorNotes?: string | null;
  actionType?: string | null;
  requiredRole?: string | null;
  actionUrl?: string | null;
}

interface CaseDetails {
  id: string;
  status: string;
  patient: {
    user: {
      fullName: string;
      email: string;
    };
  };
  clinicalSteps: ClinicalStepConfig[];
}

interface StageGroup {
  stageName: string;
  stageOrder: number;
  steps: ClinicalStepConfig[];
}

interface PathwayTemplate {
  id?: string;
  specialtyName: string;
  description?: string;
  steps?: ClinicalStepConfig[];
}

interface PathwayBuilderEditorProps {
  caseId: string;
  backHref: string;
  backLabel: string;
  embedded?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'PRE_OP', label: 'Pre-Procedure & Triage' },
  { value: 'TREATMENT', label: 'Surgery & Intervention' },
  { value: 'POST_OP', label: 'Ward & CCU Recovery' },
  { value: 'DISCHARGE', label: 'Discharge & Fit-to-Fly' },
  { value: 'REHAB', label: 'Outpatient Follow-Up' },
];

const DECISION_BRANCHES = [
  { value: '', label: 'None' },
  { value: 'APPROVED_FOR_SURGERY', label: 'MDT Board Cleared' },
  { value: 'FIT_FOR_ANESTHESIA', label: 'PAC Anesthesia Fit' },
  { value: 'UNCOMPLICATED_PROCEDURE', label: 'Intervention Successful' },
  { value: 'STABLE_STEARN_HEMODYNAMICS', label: 'Hemodynamics Stable' },
  { value: 'NORMAL_RECOVERY_TRACK', label: 'Standard Recovery Track' },
  { value: 'FIT_TO_FLY_GRANTED', label: 'Fit-to-Fly Certified' },
];

const ACTION_TYPES = [
  { value: '', label: 'No Specific Action' },
  { value: 'ISSUE_VIL', label: 'Issue / Download Visa Invitation (VIL)' },
  { value: 'SIGN_FIT_TO_FLY', label: 'Issue / View Fit-to-Fly Certificate' },
  { value: 'ISSUE_PROFORMA', label: 'Pro-Forma Invoice & Billing Settlement' },
  { value: 'UPLOAD_DOCS', label: 'Upload Medical Scans & DICOM Files' },
  { value: 'RECORD_FORM_C', label: 'Statutory 24h FRRO Form C Filing' },
  { value: 'SIGN_PAC', label: 'Sign Pre-Anesthesia Fitness (PAC)' },
  { value: 'OPERATIVE_SUMMARY', label: 'Record Surgical Operative Summary' },
  { value: 'VOTE_MDT', label: 'MDT Board Consensus Vote' },
  { value: 'RESERVE_BED', label: 'Reserve Hospital Bed / OT' },
  { value: 'ARRANGE_LOGISTICS', label: 'Arrange Flight & Airport Transfer' },
  { value: 'HEMODYNAMICS_CLEARANCE', label: 'CCU Telemetry / Hemodynamics Clearance' },
  { value: 'DISCHARGE_SUMMARY', label: 'Issue / Download Discharge Summary' },
  { value: 'SETTLE_BILL', label: 'Discharge & Final Bill Settlement' },
  { value: 'SCHEDULE_TELE_REHAB', label: 'Schedule Outpatient Tele-Rehab' },
];

const ROLE_OPTIONS = [
  { value: '', label: 'Any Clinical / Staff Role' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'MANAGER', label: 'Case Manager' },
  { value: 'DOCTOR', label: 'Treating Doctor' },
  { value: 'ADMIN', label: 'Admin' },
];

export function PathwayBuilderEditor({
  caseId,
  backHref,
  backLabel,
  embedded = false,
}: PathwayBuilderEditorProps) {
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetTemplates, setPresetTemplates] = useState<PathwayTemplate[]>([]);

  const [stages, setStages] = useState<StageGroup[]>([
    {
      stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance',
      stageOrder: 1,
      steps: [
        {
          stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance',
          stageOrder: 1,
          stepOrder: 1,
          title: 'Inquiry & Initial Medical File Review',
          category: 'PRE_OP',
          status: 'COMPLETED',
          doctorNotes: 'Medical records reviewed by lead case physician.',
          actionType: 'UPLOAD_DOCS',
          requiredRole: 'PATIENT',
        },
        {
          stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance',
          stageOrder: 1,
          stepOrder: 2,
          title: 'Multi-Disciplinary Team (MDT) Board Clearance',
          category: 'PRE_OP',
          status: 'COMPLETED',
          decisionBranch: 'APPROVED_FOR_SURGERY',
          doctorNotes: 'MDT board approved surgical intervention.',
          actionType: 'VOTE_MDT',
          requiredRole: 'DOCTOR',
        },
      ],
    },
  ]);

  const fetchPresetTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/pathway-templates');
      const data = await res.json();
      if (data.success && data.data?.templates) {
        setPresetTemplates(data.data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch pathway templates', err);
    }
  }, []);

  const fetchCasePathway = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch(`/api/v1/cases/${caseId}/pathway`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data?.error?.message || 'Failed to load case pathway';
        setLoadError(msg);
        toast.apiError(data, msg, 'Load Error');
        return;
      }

      if (data.data?.case) {
        setCaseDetails(data.data.case);
        const steps: ClinicalStepConfig[] = data.data.case.clinicalSteps || [];

        if (steps.length > 0) {
          const map = new Map<
            string,
            { stageName: string; stageOrder: number; steps: ClinicalStepConfig[] }
          >();
          steps.forEach((s) => {
            const sName = s.stageName || 'Stage 1: Pre-Procedure Triage';
            const sOrder = s.stageOrder || 1;
            if (!map.has(sName)) {
              map.set(sName, { stageName: sName, stageOrder: sOrder, steps: [] });
            }
            map.get(sName)!.steps.push(s);
          });
          const grouped = Array.from(map.values()).sort((a, b) => a.stageOrder - b.stageOrder);
          setStages(grouped);
        }
      }
    } catch (err) {
      console.error('Failed to load pathway builder', err);
      setLoadError('Failed to load case pathway');
      toast.apiError(err, 'Failed to load case pathway', 'Load Error');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCasePathway();
      void fetchPresetTemplates();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCasePathway, fetchPresetTemplates]);

  const applyPresetTemplate = (template: PathwayTemplate) => {
    const presetSteps: ClinicalStepConfig[] = template.steps || [];
    const map = new Map<
      string,
      { stageName: string; stageOrder: number; steps: ClinicalStepConfig[] }
    >();

    presetSteps.forEach((s) => {
      if (!map.has(s.stageName)) {
        map.set(s.stageName, { stageName: s.stageName, stageOrder: s.stageOrder, steps: [] });
      }
      map.get(s.stageName)!.steps.push({ ...s });
    });

    const grouped = Array.from(map.values()).sort((a, b) => a.stageOrder - b.stageOrder);
    setStages(grouped);
    toast.success(
      `Applied ${template.specialtyName} (${grouped.length} Stages, ${presetSteps.length} Milestones)!`,
      'Preset Applied'
    );
  };

  const addCustomStage = (
    customTitle?: string,
    customCategory: string = 'PRE_OP',
    customNotes?: string
  ) => {
    const nextOrder = stages.length + 1;
    const newStageName = customTitle
      ? `Stage ${nextOrder}: ${customTitle}`
      : `Stage ${nextOrder}: Custom Medical Stage`;
    setStages([
      ...stages,
      {
        stageName: newStageName,
        stageOrder: nextOrder,
        steps: [
          {
            stageName: newStageName,
            stageOrder: nextOrder,
            stepOrder: 1,
            title: customTitle
              ? `${customTitle} Evaluation Milestone`
              : 'Initial Stage Evaluation Milestone',
            category: customCategory,
            status: 'PENDING',
            doctorNotes: customNotes || 'Added by Case Manager/Admin for medical situation.',
            requiredRole: '',
          },
        ],
      },
    ]);
    toast.info(`Added stage: ${newStageName}`, 'Stage Added');
  };

  const moveStageUp = (stageIdx: number) => {
    if (stageIdx === 0) return;
    const updated = [...stages];
    const temp = updated[stageIdx];
    updated[stageIdx] = updated[stageIdx - 1];
    updated[stageIdx - 1] = temp;
    updated.forEach((st, idx) => {
      st.stageOrder = idx + 1;
      st.steps.forEach((step) => {
        step.stageOrder = idx + 1;
      });
    });
    setStages(updated);
  };

  const moveStageDown = (stageIdx: number) => {
    if (stageIdx === stages.length - 1) return;
    const updated = [...stages];
    const temp = updated[stageIdx];
    updated[stageIdx] = updated[stageIdx + 1];
    updated[stageIdx + 1] = temp;
    updated.forEach((st, idx) => {
      st.stageOrder = idx + 1;
      st.steps.forEach((step) => {
        step.stageOrder = idx + 1;
      });
    });
    setStages(updated);
  };

  const addSubStepToStage = (stageIdx: number) => {
    const updated = [...stages];
    const targetStage = updated[stageIdx];
    const nextStepOrder = targetStage.steps.length + 1;

    targetStage.steps.push({
      stageName: targetStage.stageName,
      stageOrder: targetStage.stageOrder,
      stepOrder: nextStepOrder,
      title: `Sub-Step ${targetStage.stageOrder}.${nextStepOrder}: Clinical Milestone`,
      category: 'PRE_OP',
      status: 'PENDING',
      doctorNotes: '',
      requiredRole: '',
    });

    setStages(updated);
  };

  const updateStageName = (stageIdx: number, newName: string) => {
    const updated = [...stages];
    updated[stageIdx].stageName = newName;
    updated[stageIdx].steps.forEach((s) => {
      s.stageName = newName;
    });
    setStages(updated);
  };

  const removeStage = (stageIdx: number) => {
    if (stages.length === 1) {
      toast.error('At least 1 stage is required for a patient pathway.', 'Action Blocked');
      return;
    }
    setStages(stages.filter((_, idx) => idx !== stageIdx));
  };

  const updateSubStep = <K extends keyof ClinicalStepConfig>(
    stageIdx: number,
    stepIdx: number,
    field: K,
    value: ClinicalStepConfig[K]
  ) => {
    const updated = [...stages];
    const targetStep = updated[stageIdx].steps[stepIdx];
    targetStep[field] = value;
    setStages(updated);
  };

  const removeSubStep = (stageIdx: number, stepIdx: number) => {
    const updated = [...stages];
    if (updated[stageIdx].steps.length === 1) {
      toast.error('Each stage must have at least 1 sub-step.', 'Action Blocked');
      return;
    }
    updated[stageIdx].steps = updated[stageIdx].steps.filter((_, idx) => idx !== stepIdx);
    setStages(updated);
  };

  const handleSavePathway = async () => {
    setIsSaving(true);
    try {
      const allSteps: ClinicalStepConfig[] = [];
      stages.forEach((stage, sIdx) => {
        stage.steps.forEach((step, stIdx) => {
          allSteps.push({
            ...step,
            stageName: stage.stageName,
            stageOrder: sIdx + 1,
            stepOrder: stIdx + 1,
            requiredRole: step.requiredRole || null,
            actionType: step.actionType || null,
            decisionBranch: step.decisionBranch || null,
            actionUrl: step.actionUrl || null,
          });
        });
      });

      const res = await fetch(`/api/v1/cases/${caseId}/pathway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: allSteps }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          `Successfully saved ${allSteps.length} milestones across ${stages.length} custom stages!`,
          'Pathway Saved'
        );
        void fetchCasePathway();
      } else {
        toast.apiError(data, 'Failed to save patient pathway', 'Save Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error saving pathway', 'Connection Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-surface-500">Loading clinical pathway builder...</p>
      </div>
    );
  }

  if (loadError && !caseDetails) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
        </Link>
        <Card className="p-6 border-rose-200 bg-rose-50 text-center space-y-1.5">
          <h2 className="text-sm sm:text-base font-semibold text-rose-900">Unable to Open Pathway Builder</h2>
          <p className="text-xs text-rose-700">{loadError}</p>
        </Card>
      </div>
    );
  }

  const isClosed = caseDetails?.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-200">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-surface-900">
              Clinical Pathway &amp; Milestone Orchestration
            </h2>
            <p className="text-xs font-normal text-surface-500 mt-0.5">
              Apply specialty 7-stage presets or customize stage milestones and responsible clinical roles.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={() => addCustomStage()}
              variant="secondary"
              size="sm"
              disabled={isClosed}
            >
              <Plus className="w-4 h-4" /> Add Custom Stage
            </Button>
            <Button
              onClick={handleSavePathway}
              size="sm"
              isLoading={isSaving}
              disabled={isSaving || isClosed}
            >
              {!isSaving && <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving Pathway...' : 'Save Patient Pathway'}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-surface-900">
              Configurable Patient Pathway &amp; Action Builder
            </h1>
            <p className="text-xs sm:text-sm text-surface-500 mt-1">
              Patient: <span className="font-medium text-surface-900">{caseDetails?.patient?.user?.fullName}</span> (
              {caseDetails?.patient?.user?.email})
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={() => addCustomStage()}
              variant="secondary"
              size="sm"
              disabled={isClosed}
            >
              <Plus className="w-4 h-4" /> Add Custom Stage
            </Button>
            <Button
              onClick={handleSavePathway}
              size="sm"
              isLoading={isSaving}
              disabled={isSaving || isClosed}
            >
              {!isSaving && <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving Pathway...' : 'Save Patient Pathway'}</span>
            </Button>
          </div>
        </div>
      )}

      {isClosed && (
        <Card className="p-4 border-amber-200 bg-amber-50 text-xs font-medium text-amber-900">
          This case is closed. Pathway stages and milestones are read-only.
        </Card>
      )}

      <Card className="p-5 bg-surface-50 border-surface-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-semibold text-surface-900">
            Apply Specialty Preset Templates or Add Situational Stages
          </h2>
          <span className="text-xs font-medium text-surface-500">
            Configurable by Admin &amp; Case Manager
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presetTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              disabled={isClosed}
              onClick={() => applyPresetTemplate(tpl)}
              className="p-3.5 rounded-lg bg-white border border-surface-200 hover:border-primary-400 text-left transition-colors shadow-2xs space-y-1 disabled:opacity-50"
            >
              <h3 className="text-xs font-semibold text-surface-900">{tpl.specialtyName}</h3>
              <p className="text-[11px] text-surface-500 line-clamp-2 leading-relaxed">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-surface-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-surface-600">
            Quick-add stage:
          </span>
          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              addCustomStage(
                'Emergency Complication Triage',
                'PRE_OP',
                'Added for unexpected complication triage.'
              )
            }
            className="px-3 py-1.5 bg-white hover:bg-surface-100 text-surface-700 rounded-md text-xs font-medium transition-colors border border-surface-300 disabled:opacity-50"
          >
            Emergency Complication Stage
          </button>
          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              addCustomStage(
                'Secondary Chemotherapy Cycle',
                'TREATMENT',
                'Added for additional chemotherapy cycle.'
              )
            }
            className="px-3 py-1.5 bg-white hover:bg-surface-100 text-surface-700 rounded-md text-xs font-medium transition-colors border border-surface-300 disabled:opacity-50"
          >
            Secondary Chemotherapy Stage
          </button>
          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              addCustomStage(
                'Revision Surgical Procedure',
                'TREATMENT',
                'Added for secondary revision procedure.'
              )
            }
            className="px-3 py-1.5 bg-white hover:bg-surface-100 text-surface-700 rounded-md text-xs font-medium transition-colors border border-surface-300 disabled:opacity-50"
          >
            Revision Surgery Stage
          </button>
          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              addCustomStage(
                'Extended ICU Care Stay',
                'POST_OP',
                'Added for extended CCU/ICU telemetry monitoring.'
              )
            }
            className="px-3 py-1.5 bg-white hover:bg-surface-100 text-surface-700 rounded-md text-xs font-medium transition-colors border border-surface-300 disabled:opacity-50"
          >
            Extended ICU Telemetry Stage
          </button>
        </div>
      </Card>

      <div className="space-y-5">
        {stages.map((stage, stageIdx) => (
          <Card key={stageIdx} className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="w-8 h-8 rounded-md bg-surface-100 text-surface-700 border border-surface-200 font-semibold text-xs tabular-nums flex items-center justify-center shrink-0">
                  {stageIdx + 1}
                </span>
                <div className="flex-1">
                  <label className="text-xs font-medium text-surface-500 block mb-1">
                    Stage Name
                  </label>
                  <input
                    type="text"
                    value={stage.stageName}
                    onChange={(e) => updateStageName(stageIdx, e.target.value)}
                    disabled={isClosed}
                    className="w-full text-sm font-semibold text-surface-900 bg-white border border-surface-300 rounded-md px-3 py-1.5 focus:outline-none focus:border-primary-600 disabled:opacity-60"
                    placeholder="Enter stage title (e.g. Stage 1: Pre-Procedure Triage)"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveStageUp(stageIdx)}
                  disabled={stageIdx === 0 || isClosed}
                  className="p-1.5 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-md disabled:opacity-30"
                  title="Move Stage Up"
                >
                  <MoveUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStageDown(stageIdx)}
                  disabled={stageIdx === stages.length - 1 || isClosed}
                  className="p-1.5 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-md disabled:opacity-30"
                  title="Move Stage Down"
                >
                  <MoveDown className="w-4 h-4" />
                </button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => addSubStepToStage(stageIdx)}
                  variant="secondary"
                  disabled={isClosed}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Milestone
                </Button>
                {stages.length > 1 && !isClosed && (
                  <button
                    type="button"
                    onClick={() => removeStage(stageIdx)}
                    className="p-2 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Delete Stage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 relative border-l-2 border-surface-200 ml-4 pl-4">
              {stage.steps.map((step, stepIdx) => (
                <div
                  key={step.id || stepIdx}
                  className="p-4 bg-surface-50 rounded-lg border border-surface-200 space-y-3 relative"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Milestone Title
                      </label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'title', e.target.value)}
                        disabled={isClosed}
                        className="w-full px-3 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600 disabled:opacity-60"
                        placeholder="e.g. MDT Board Clearance"
                        required
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Category
                      </label>
                      <select
                        value={step.category}
                        onChange={(e) =>
                          updateSubStep(stageIdx, stepIdx, 'category', e.target.value)
                        }
                        disabled={isClosed}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none disabled:opacity-60"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Milestone Status
                      </label>
                      <select
                        value={step.status}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'status', e.target.value)}
                        disabled={isClosed}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none disabled:opacity-60"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS (Active)</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ACTION_REQUIRED">ACTION REQUIRED</option>
                      </select>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-end pt-4">
                      {stage.steps.length > 1 && !isClosed && (
                        <button
                          type="button"
                          onClick={() => removeSubStep(stageIdx, stepIdx)}
                          className="p-1.5 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-surface-200">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Decision Clearance Tag
                      </label>
                      <select
                        value={step.decisionBranch || ''}
                        onChange={(e) =>
                          updateSubStep(stageIdx, stepIdx, 'decisionBranch', e.target.value)
                        }
                        disabled={isClosed}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none disabled:opacity-60"
                      >
                        {DECISION_BRANCHES.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Interactive Action Button
                      </label>
                      <select
                        value={step.actionType || ''}
                        onChange={(e) =>
                          updateSubStep(stageIdx, stepIdx, 'actionType', e.target.value)
                        }
                        disabled={isClosed}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-primary-700 focus:outline-none disabled:opacity-60"
                      >
                        {ACTION_TYPES.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Responsible Role
                      </label>
                      <select
                        value={step.requiredRole || ''}
                        onChange={(e) =>
                          updateSubStep(stageIdx, stepIdx, 'requiredRole', e.target.value)
                        }
                        disabled={isClosed}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none disabled:opacity-60"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-surface-600 block">
                        Doctor&apos;s Clinical Notes
                      </label>
                      <input
                        type="text"
                        value={step.doctorNotes || ''}
                        onChange={(e) =>
                          updateSubStep(stageIdx, stepIdx, 'doctorNotes', e.target.value)
                        }
                        disabled={isClosed}
                        className="w-full px-3 py-1.5 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none disabled:opacity-60"
                        placeholder="Log clinical notes for patient view..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
