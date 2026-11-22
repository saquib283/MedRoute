'use client';

/**
 * Afzal Healthcare — Configurable Patient Clinical Pathway & Action Orchestration Builder
 * Admins & Managers can apply 7-stage specialty presets (Cardiology, Oncology, Orthopedics) or configure custom stages & action buttons.
 */

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import {
  Stethoscope,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  MoveUp,
  MoveDown,
  Layers,
  FileText,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  User,
  HeartPulse,
  Bed,
  Plane,
  Activity,
  Wand2,
  Download,
  CreditCard,
  UploadCloud,
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
  { value: 'SIGN_PAC', label: 'Sign Pre-Anesthesia Fitness (PAC)' },
  { value: 'OPERATIVE_SUMMARY', label: 'Record Surgical Operative Summary' },
];

export default function ConfigurablePathwayBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [presetTemplates, setPresetTemplates] = useState<any[]>([]);

  // Builder State
  const [stages, setStages] = useState<StageGroup[]>([
    {
      stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance',
      stageOrder: 1,
      steps: [
        { stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance', stageOrder: 1, stepOrder: 1, title: 'Inquiry & Initial Medical File Review', category: 'PRE_OP', status: 'COMPLETED', doctorNotes: 'Medical records reviewed by lead case physician.', actionType: 'UPLOAD_DOCS' },
        { stageName: 'Stage 1: Pre-Procedure Triage & Medical Clearance', stageOrder: 1, stepOrder: 2, title: 'Multi-Disciplinary Team (MDT) Board Clearance', category: 'PRE_OP', status: 'COMPLETED', decisionBranch: 'APPROVED_FOR_SURGERY', doctorNotes: 'MDT board approved surgical intervention.' },
      ],
    },
  ]);

  useEffect(() => {
    fetchCasePathway();
    fetchPresetTemplates();
  }, [caseId]);

  const fetchPresetTemplates = async () => {
    try {
      const res = await fetch('/api/v1/admin/pathway-templates');
      const data = await res.json();
      if (data.success && data.data?.templates) {
        setPresetTemplates(data.data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch pathway templates', err);
    }
  };

  const fetchCasePathway = async () => {
    try {
      const res = await fetch(`/api/v1/admin/cases/${caseId}/pathway`);
      const data = await res.json();
      if (data.success && data.data?.case) {
        setCaseDetails(data.data.case);
        const steps: ClinicalStepConfig[] = data.data.case.clinicalSteps || [];

        if (steps.length > 0) {
          const map = new Map<string, { stageName: string; stageOrder: number; steps: ClinicalStepConfig[] }>();
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
      toast.apiError(err, 'Failed to load case pathway', 'Load Error');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply a Specialty Preset Template
  const applyPresetTemplate = (template: any) => {
    const presetSteps: ClinicalStepConfig[] = template.steps || [];
    const map = new Map<string, { stageName: string; stageOrder: number; steps: ClinicalStepConfig[] }>();
    
    presetSteps.forEach((s) => {
      if (!map.has(s.stageName)) {
        map.set(s.stageName, { stageName: s.stageName, stageOrder: s.stageOrder, steps: [] });
      }
      map.get(s.stageName)!.steps.push({ ...s });
    });

    const grouped = Array.from(map.values()).sort((a, b) => a.stageOrder - b.stageOrder);
    setStages(grouped);
    toast.success(`Applied ${template.specialtyName} (${grouped.length} Stages, ${presetSteps.length} Milestones)!`, 'Preset Applied');
  };

  // Add a new custom Stage with optional custom title & category
  const addCustomStage = (customTitle?: string, customCategory: string = 'PRE_OP', customNotes?: string) => {
    const nextOrder = stages.length + 1;
    const newStageName = customTitle ? `Stage ${nextOrder}: ${customTitle}` : `Stage ${nextOrder}: Custom Medical Stage`;
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
            title: customTitle ? `${customTitle} Evaluation Milestone` : 'Initial Stage Evaluation Milestone',
            category: customCategory,
            status: 'PENDING',
            doctorNotes: customNotes || 'Added by Case Manager/Admin for medical situation.',
          },
        ],
      },
    ]);
    toast.info(`Added stage: ${newStageName}`, 'Stage Added');
  };

  // Move Stage Up
  const moveStageUp = (stageIdx: number) => {
    if (stageIdx === 0) return;
    const updated = [...stages];
    const temp = updated[stageIdx];
    updated[stageIdx] = updated[stageIdx - 1];
    updated[stageIdx - 1] = temp;
    // Update stage orders
    updated.forEach((st, idx) => {
      st.stageOrder = idx + 1;
      st.steps.forEach((step) => (step.stageOrder = idx + 1));
    });
    setStages(updated);
  };

  // Move Stage Down
  const moveStageDown = (stageIdx: number) => {
    if (stageIdx === stages.length - 1) return;
    const updated = [...stages];
    const temp = updated[stageIdx];
    updated[stageIdx] = updated[stageIdx + 1];
    updated[stageIdx + 1] = temp;
    // Update stage orders
    updated.forEach((st, idx) => {
      st.stageOrder = idx + 1;
      st.steps.forEach((step) => (step.stageOrder = idx + 1));
    });
    setStages(updated);
  };

  // Add Sub-Step to a Stage
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
    });

    setStages(updated);
  };

  // Update Stage Title
  const updateStageName = (stageIdx: number, newName: string) => {
    const updated = [...stages];
    updated[stageIdx].stageName = newName;
    updated[stageIdx].steps.forEach((s) => (s.stageName = newName));
    setStages(updated);
  };

  // Remove Stage
  const removeStage = (stageIdx: number) => {
    if (stages.length === 1) {
      toast.error('At least 1 stage is required for a patient pathway.', 'Action Blocked');
      return;
    }
    setStages(stages.filter((_, idx) => idx !== stageIdx));
  };

  // Update Sub-Step Field
  const updateSubStep = (stageIdx: number, stepIdx: number, field: keyof ClinicalStepConfig, value: any) => {
    const updated = [...stages];
    const targetStep = updated[stageIdx].steps[stepIdx];
    (targetStep as any)[field] = value;
    setStages(updated);
  };

  // Remove Sub-Step
  const removeSubStep = (stageIdx: number, stepIdx: number) => {
    const updated = [...stages];
    if (updated[stageIdx].steps.length === 1) {
      toast.error('Each stage must have at least 1 sub-step.', 'Action Blocked');
      return;
    }
    updated[stageIdx].steps = updated[stageIdx].steps.filter((_, idx) => idx !== stepIdx);
    setStages(updated);
  };

  // Save Custom Pathway to Database
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
          });
        });
      });

      const res = await fetch(`/api/v1/admin/cases/${caseId}/pathway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: allSteps }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully saved ${allSteps.length} milestones across ${stages.length} custom stages!`, 'Pathway Saved');
        fetchCasePathway();
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading Clinical Pathway Builder...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/manager/appointments" className="inline-flex items-center gap-1 text-xs font-bold text-surface-500 hover:text-surface-900 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Operations
          </Link>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary-600" />
            Configurable Patient Pathway & Action Builder
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Patient: <strong className="text-surface-900">{caseDetails?.patient?.user?.fullName}</strong> ({caseDetails?.patient?.user?.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => addCustomStage()}
            variant="secondary"
            className="px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-primary-600" /> Add Custom Stage
          </Button>
          <Button
            onClick={handleSavePathway}
            disabled={isSaving}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Pathway...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Patient Pathway</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Specialty Preset Template & Situational Stage Toolbar ───── */}
      <Card className="p-5 rounded-3xl border border-primary-200 bg-gradient-to-r from-primary-50/80 to-white shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary-600 animate-pulse" />
            <h3 className="text-sm font-extrabold text-surface-900">Apply Specialty Preset Templates or Add Situational Stages</h3>
          </div>
          <span className="text-xs font-bold text-surface-500">Configurable by Admin & Case Manager</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presetTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyPresetTemplate(tpl)}
              className="p-3.5 rounded-2xl bg-white border border-surface-200 hover:border-primary-400 text-left transition-all shadow-2xs hover:shadow-xs space-y-1"
            >
              <h4 className="text-xs font-extrabold text-primary-800">{tpl.specialtyName}</h4>
              <p className="text-[11px] text-surface-500 line-clamp-2 leading-relaxed">{tpl.description}</p>
            </button>
          ))}
        </div>

        {/* Quick Add Situational Stage Pills */}
        <div className="pt-2 border-t border-primary-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-surface-700 uppercase tracking-wider">Quick-Add Situational Stage:</span>
          <button
            type="button"
            onClick={() => addCustomStage('Emergency Complication Triage', 'PRE_OP', 'Added for unexpected complication triage.')}
            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-colors border border-amber-300"
          >
            🚨 Emergency Complication Stage
          </button>
          <button
            type="button"
            onClick={() => addCustomStage('Secondary Chemotherapy Cycle', 'TREATMENT', 'Added for additional chemotherapy cycle.')}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl text-xs font-bold transition-colors border border-rose-300"
          >
            🧪 Secondary Chemotherapy Stage
          </button>
          <button
            type="button"
            onClick={() => addCustomStage('Revision Surgical Procedure', 'TREATMENT', 'Added for secondary revision procedure.')}
            className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-bold transition-colors border border-purple-300"
          >
            🔄 Revision Surgery Stage
          </button>
          <button
            type="button"
            onClick={() => addCustomStage('Extended ICU Care Stay', 'POST_OP', 'Added for extended CCU/ICU telemetry monitoring.')}
            className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-900 rounded-xl text-xs font-bold transition-colors border border-sky-300"
          >
            🏥 Extended ICU Telemetry Stage
          </button>
        </div>
      </Card>

      {/* ─── Configurable Stage Folders Builder ──────────────────────── */}
      <div className="space-y-6">
        {stages.map((stage, stageIdx) => (
          <Card key={stageIdx} className="p-6 rounded-3xl border border-surface-200 shadow-xs space-y-6 bg-white">
            {/* Stage Title Editor Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-100 pb-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="w-8 h-8 rounded-xl bg-primary-100 text-primary-800 font-black text-xs flex items-center justify-center shrink-0">
                  {stageIdx + 1}
                </span>
                <div className="flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-surface-600 block mb-1">
                    Stage Name (Editable)
                  </label>
                  <input
                    type="text"
                    value={stage.stageName}
                    onChange={(e) => updateStageName(stageIdx, e.target.value)}
                    className="w-full text-sm font-extrabold text-surface-900 bg-surface-50 border border-surface-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-600"
                    placeholder="Enter stage title (e.g. Stage 1: Pre-Procedure Triage)"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Move Stage Up/Down Buttons */}
                <button
                  type="button"
                  onClick={() => moveStageUp(stageIdx)}
                  disabled={stageIdx === 0}
                  className="p-1.5 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-lg disabled:opacity-30"
                  title="Move Stage Up"
                >
                  <MoveUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStageDown(stageIdx)}
                  disabled={stageIdx === stages.length - 1}
                  className="p-1.5 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-lg disabled:opacity-30"
                  title="Move Stage Down"
                >
                  <MoveDown className="w-4 h-4" />
                </button>

                <Button
                  type="button"
                  onClick={() => addSubStepToStage(stageIdx)}
                  variant="secondary"
                  className="px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-primary-600" /> Add Milestone
                </Button>
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStage(stageIdx)}
                    className="p-2 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Stage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Steps Builder Tree */}
            <div className="space-y-4 relative border-l-2 border-primary-200 ml-4 pl-4 pt-2">
              {stage.steps.map((step, stepIdx) => (
                <div key={stepIdx} className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3 relative">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Milestone Title</label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-extrabold text-surface-900 focus:outline-none focus:border-primary-600"
                        placeholder="e.g. MDT Board Clearance"
                        required
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Category</label>
                      <select
                        value={step.category}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'category', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Milestone Status</label>
                      <select
                        value={step.status}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'status', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS (Active)</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ACTION_REQUIRED">ACTION REQUIRED</option>
                      </select>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-end pt-4">
                      {stage.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubStep(stageIdx, stepIdx)}
                          className="p-1.5 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Decision Branch & Action Type */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-surface-200/60">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Decision Clearance Tag</label>
                      <select
                        value={step.decisionBranch || ''}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'decisionBranch', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-medium focus:outline-none"
                      >
                        {DECISION_BRANCHES.map((b) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Interactive Action Button</label>
                      <select
                        value={step.actionType || ''}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'actionType', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-bold text-primary-700 focus:outline-none"
                      >
                        {ACTION_TYPES.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-surface-600 block">Doctor's Clinical Notes</label>
                      <input
                        type="text"
                        value={step.doctorNotes || ''}
                        onChange={(e) => updateSubStep(stageIdx, stepIdx, 'doctorNotes', e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-surface-300 rounded-xl text-xs font-medium focus:outline-none"
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
