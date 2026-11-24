'use client';

/**
 * Afzal Healthcare — Doctor Clinical Case Workspace
 * Displays patient ePHI allergy/medication safety strip, Fit-to-Fly Travel Clearance
 * certification form + downloadable certificate, Doctor Milestone Sign-offs, and
 * Hospital Clinical Certificate / Opinion / Prescription issuance.
 */

import { use, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge, CaseStatusBadge, UrgencyBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { CaseDocumentsManagerPanel } from '@/components/clinical/CaseDocumentsManagerPanel';
import {
  ArrowLeft,
  AlertTriangle,
  Pill,
  HeartPulse,
  Droplets,
  Plane,
  CheckCircle2,
  Download,
  Upload,
  Save,
  Lock,
  Layers,
  X,
} from 'lucide-react';

interface ClinicalStepItem {
  id: string;
  stageName: string;
  stageOrder: number;
  stepOrder: number;
  title: string;
  category: string;
  status: string;
  decisionBranch: string | null;
  doctorNotes: string | null;
  actionType: string | null;
  requiredRole: string | null;
  completedAt: string | null;
}

interface FitToFlyClearanceItem {
  id: string;
  isCleared: boolean;
  clearedBy: string | null;
  clearanceDate: string | null;
  restrictions: string | null;
  reEvalDate: string | null;
}

interface CertificateDocItem {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

interface CaseDetail {
  id: string;
  status: string;
  isUrgent: boolean;
  notes: string | null;
  patient: {
    id: string;
    nationality: string;
    passportNo: string;
    bloodGroup: string | null;
    medicalCondition: string | null;
    urgencyLevel: string;
    user: {
      fullName: string;
      email: string;
      phone: string | null;
    };
    medicalProfile?: {
      allergies?: unknown[];
      medications?: unknown[];
      surgeries?: unknown[];
      chronicConditions?: unknown[];
    } | null;
  };
  clinicalSteps: ClinicalStepItem[];
  fitToFlyClearance: FitToFlyClearanceItem | null;
}

interface StepDraft {
  status: string;
  decisionBranch: string;
  doctorNotes: string;
}

const STEP_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACTION_REQUIRED', label: 'Action Required' },
];

const DECISION_BRANCH_OPTIONS = [
  { value: '', label: 'None / Standard' },
  { value: 'APPROVED_FOR_SURGERY', label: 'MDT Board Cleared' },
  { value: 'FIT_FOR_ANESTHESIA', label: 'PAC Anesthesia Fit' },
  { value: 'UNCOMPLICATED_PROCEDURE', label: 'Intervention Successful' },
  { value: 'STABLE_STEARN_HEMODYNAMICS', label: 'Hemodynamics Stable' },
  { value: 'NORMAL_RECOVERY_TRACK', label: 'Standard Recovery Track' },
  { value: 'FIT_TO_FLY_GRANTED', label: 'Fit-to-Fly Certified' },
];

const DOCTOR_ISSUE_CATEGORIES = [
  { value: 'MEDICAL_OPINION', label: 'Hospital Medical Opinion' },
  { value: 'PRESCRIPTION', label: 'Doctor Prescription' },
  { value: 'MEDICAL_REPORT', label: 'Medical Diagnostic Report' },
];

function formatProfileItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const name = obj.name || obj.title || obj.condition || '';
    const extra = [obj.dosage, obj.frequency, obj.date, obj.notes]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' • ');
    if (name && extra) return `${String(name)} (${extra})`;
    if (name) return String(name);
    return JSON.stringify(item);
  }
  return String(item ?? '');
}

function normalizeList(items: unknown[] | undefined | null): string[] {
  if (!Array.isArray(items)) return [];
  return items.map(formatProfileItem).filter((v) => v.trim().length > 0);
}

export default function DoctorCaseWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [fitToFly, setFitToFly] = useState<FitToFlyClearanceItem | null>(null);
  const [certificateDoc, setCertificateDoc] = useState<CertificateDocItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step milestone drafts keyed by step.id
  const [stepDrafts, setStepDrafts] = useState<Record<string, StepDraft>>({});
  const [savingStepId, setSavingStepId] = useState<string | null>(null);

  // Fit-to-Fly form state
  const [isCleared, setIsCleared] = useState(true);
  const [restrictions, setRestrictions] = useState('');
  const [reEvalDate, setReEvalDate] = useState('');
  const [fitToFlyFile, setFitToFlyFile] = useState<File | null>(null);
  const [savingFitToFly, setSavingFitToFly] = useState(false);
  const fitToFlyFileInputRef = useRef<HTMLInputElement>(null);

  const syncStepDrafts = useCallback((steps: ClinicalStepItem[]) => {
    const nextDrafts: Record<string, StepDraft> = {};
    for (const step of steps) {
      nextDrafts[step.id] = {
        status: step.status,
        decisionBranch: step.decisionBranch || '',
        doctorNotes: step.doctorNotes || '',
      };
    }
    setStepDrafts(nextDrafts);
  }, []);

  const syncFitToFlyForm = useCallback((clearance: FitToFlyClearanceItem | null) => {
    setFitToFly(clearance);
    setIsCleared(clearance ? clearance.isCleared : true);
    setRestrictions(clearance?.restrictions || '');
    setReEvalDate(
      clearance?.reEvalDate ? new Date(clearance.reEvalDate).toISOString().slice(0, 10) : ''
    );
  }, []);

  const loadCaseWorkspace = useCallback(
    async (opts?: { silent?: boolean; isCancelled?: () => boolean }) => {
      const silent = Boolean(opts?.silent);
      const isCancelled = opts?.isCancelled;
      try {
        if (!silent) {
          setLoadError(null);
          setLoading(true);
        }
        const [pathwayRes, ftfRes] = await Promise.all([
          fetch(`/api/v1/cases/${caseId}/pathway`),
          fetch(`/api/v1/cases/${caseId}/fit-to-fly`),
        ]);

        const pathwayJson = await pathwayRes.json();
        const ftfJson = await ftfRes.json();

        if (isCancelled?.()) return;

        if (!pathwayRes.ok || !pathwayJson.success) {
          const message = pathwayJson?.error?.message || 'Failed to load clinical case';
          if (silent) {
            toast.error(message, 'Refresh Failed');
          } else {
            setLoadError(message);
          }
          return;
        }

        const loadedCase = pathwayJson.data?.case as CaseDetail;
        setCaseData(loadedCase);
        syncStepDrafts(loadedCase.clinicalSteps || []);

        if (ftfRes.ok && ftfJson.success) {
          syncFitToFlyForm(ftfJson.data?.fitToFlyClearance ?? loadedCase.fitToFlyClearance ?? null);
          setCertificateDoc(ftfJson.data?.certificateDocument ?? null);
        } else {
          syncFitToFlyForm(loadedCase.fitToFlyClearance ?? null);
        }
      } catch (err) {
        console.error('Failed to load doctor case workspace:', err);
        if (!isCancelled?.()) {
          if (silent) {
            toast.apiError(err, 'Failed to refresh clinical case workspace');
          } else {
            setLoadError('Network error loading clinical case workspace');
          }
        }
      } finally {
        if (!silent && !isCancelled?.()) {
          setLoading(false);
        }
      }
    },
    [caseId, syncFitToFlyForm, syncStepDrafts]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadCaseWorkspace({ isCancelled: () => cancelled });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadCaseWorkspace]);

  const stageGroups = useMemo(() => {
    if (!caseData?.clinicalSteps) return [];
    const grouped = new Map<
      number,
      { stageOrder: number; stageName: string; steps: ClinicalStepItem[] }
    >();
    for (const step of caseData.clinicalSteps) {
      const existing = grouped.get(step.stageOrder);
      if (existing) {
        existing.steps.push(step);
      } else {
        grouped.set(step.stageOrder, {
          stageOrder: step.stageOrder,
          stageName: step.stageName,
          steps: [step],
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.stageOrder - b.stageOrder);
  }, [caseData]);

  const handleSaveMilestone = async (stepId: string) => {
    const draft = stepDrafts[stepId];
    if (!draft) return;
    setSavingStepId(stepId);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/pathway`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          status: draft.status,
          decisionBranch: draft.decisionBranch || null,
          doctorNotes: draft.doctorNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to save milestone');
        return;
      }

      const updatedStep = json.data?.step as ClinicalStepItem | undefined;
      if (updatedStep) {
        setCaseData((prev) =>
          prev
            ? {
                ...prev,
                clinicalSteps: prev.clinicalSteps.map((s) =>
                  s.id === stepId ? updatedStep : s
                ),
              }
            : prev
        );
        setStepDrafts((prev) => ({
          ...prev,
          [stepId]: {
            status: updatedStep.status,
            decisionBranch: updatedStep.decisionBranch || '',
            doctorNotes: updatedStep.doctorNotes || '',
          },
        }));
      }
      toast.success('Clinical milestone updated.', 'Milestone Saved');
    } catch (err) {
      toast.apiError(err, 'Network error saving milestone');
    } finally {
      setSavingStepId(null);
    }
  };

  const handleFitToFlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFitToFly(true);
    try {
      const formData = new FormData();
      formData.append('isCleared', isCleared ? 'true' : 'false');
      if (restrictions.trim()) {
        formData.append('restrictions', restrictions.trim());
      }
      if (reEvalDate.trim()) {
        formData.append('reEvalDate', reEvalDate.trim());
      }
      if (fitToFlyFile) {
        formData.append('file', fitToFlyFile);
      }

      const res = await fetch(`/api/v1/cases/${caseId}/fit-to-fly`, {
        method: 'PUT',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to update Fit-to-Fly clearance');
        return;
      }

      syncFitToFlyForm(json.data?.fitToFlyClearance ?? null);
      setCertificateDoc(json.data?.certificateDocument ?? null);
      setFitToFlyFile(null);
      if (fitToFlyFileInputRef.current) {
        fitToFlyFileInputRef.current.value = '';
      }

      toast.success(
        isCleared
          ? 'Fit-to-Fly clearance certified and PDF certificate issued.'
          : 'Fit-to-Fly hold / re-evaluation recorded.',
        'Fit-to-Fly Updated'
      );

      await loadCaseWorkspace({ silent: true });
    } catch (err) {
      toast.apiError(err, 'Network error updating Fit-to-Fly clearance');
    } finally {
      setSavingFitToFly(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">
            Loading clinical case workspace...
          </span>
        </div>
      </div>
    );
  }

  if (loadError || !caseData) {
    return (
      <Card className="p-5 space-y-4 border-danger-200 bg-danger-50/50">
        <p className="text-sm font-medium text-danger-800">
          {loadError || 'Case not found'}
        </p>
        <div className="flex items-center gap-3">
          <Link href="/doctor/dashboard">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={() => void loadCaseWorkspace()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const isClosed = caseData.status === 'CLOSED';
  const allergies = normalizeList(caseData.patient.medicalProfile?.allergies);
  const medications = normalizeList(caseData.patient.medicalProfile?.medications);
  const chronicConditions = normalizeList(caseData.patient.medicalProfile?.chronicConditions);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/doctor/dashboard"
          className="min-h-9 inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 hover:text-surface-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to clinical overview
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <CaseStatusBadge status={caseData.status} />
          {caseData.isUrgent && (
            <Badge variant="danger">
              <AlertTriangle className="w-3.5 h-3.5" /> Urgent Case
            </Badge>
          )}
        </div>
      </div>

      {/* Patient Header + Clinical Safety Strip */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-surface-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
              {caseData.patient.user.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-surface-500 mt-0.5">
              {caseData.patient.nationality} • Passport: <span className="font-mono">{caseData.patient.passportNo || '—'}</span> • Case{' '}
              <span className="font-mono text-surface-700">{caseData.id}</span>
            </p>
            {caseData.patient.medicalCondition && (
              <p className="text-xs font-medium text-surface-700 mt-1">
                Presenting condition: {caseData.patient.medicalCondition}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UrgencyBadge level={caseData.patient.urgencyLevel} />
            {caseData.patient.bloodGroup && (
              <Badge variant="info">
                <Droplets className="w-3.5 h-3.5" /> Blood group: {caseData.patient.bloodGroup}
              </Badge>
            )}
          </div>
        </div>

        {/* Decrypted ePHI Clinical Safety Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div
            className={`p-3 rounded-md border ${
              allergies.length > 0
                ? 'bg-danger-50/70 border-danger-200 text-danger-900'
                : 'bg-surface-50 border-surface-200 text-surface-600'
            }`}
          >
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle
                className={`w-4 h-4 ${allergies.length > 0 ? 'text-danger-600' : 'text-surface-400'}`}
              />
              Allergy alert
            </p>
            {allergies.length > 0 ? (
              <p className="font-medium text-danger-800">{allergies.join(', ')}</p>
            ) : (
              <p className="text-surface-500">No allergies reported</p>
            )}
          </div>

          <div className="p-3 rounded-md bg-surface-50 border border-surface-200">
            <p className="font-semibold text-surface-700 flex items-center gap-1.5 mb-1">
              <Pill className="w-4 h-4 text-surface-500" />
              Active medications
            </p>
            <p className="text-surface-700">
              {medications.length > 0 ? medications.join(', ') : 'None listed'}
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-50 border border-surface-200">
            <p className="font-semibold text-surface-700 flex items-center gap-1.5 mb-1">
              <HeartPulse className="w-4 h-4 text-surface-500" />
              Chronic conditions
            </p>
            <p className="text-surface-700">
              {chronicConditions.length > 0 ? chronicConditions.join(', ') : 'None listed'}
            </p>
          </div>
        </div>
      </Card>

      {/* Main Two-Column Clinical Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left / Main: Clinical Pathway Milestone Sign-Offs */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-200">
              <div>
                <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-600" />
                  Clinical pathway milestone sign-offs
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Sign off physician-owned milestones, record decision branches, and add clinical notes.
                </p>
              </div>
              <span className="text-xs font-medium text-surface-500 tabular-nums">
                {caseData.clinicalSteps.length} steps
              </span>
            </div>

            {stageGroups.length === 0 ? (
              <div className="p-8 text-center rounded-md bg-surface-50 border border-dashed border-surface-200 text-sm text-surface-500">
                No clinical pathway stages have been configured for this case yet.
              </div>
            ) : (
              <div className="space-y-6">
                {stageGroups.map((stage) => (
                  <div key={stage.stageOrder} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-100 text-surface-700 border border-surface-200 tabular-nums">
                        Stage {stage.stageOrder}
                      </span>
                      <h3 className="text-sm font-semibold text-surface-900">{stage.stageName}</h3>
                    </div>

                    <div className="space-y-3 pl-3 border-l border-surface-200">
                      {stage.steps.map((step) => {
                        const canDoctorModify =
                          !isClosed && (!step.requiredRole || step.requiredRole === 'DOCTOR');
                        const draft = stepDrafts[step.id] ?? {
                          status: step.status,
                          decisionBranch: step.decisionBranch || '',
                          doctorNotes: step.doctorNotes || '',
                        };
                        const isSavingThis = savingStepId === step.id;

                        return (
                          <div
                            key={step.id}
                            className="p-4 rounded-lg border border-surface-200 bg-surface-50/50 space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-sm text-surface-900">
                                    {step.title}
                                  </span>
                                  <Badge variant="default" size="sm">
                                    {step.category}
                                  </Badge>
                                  {step.requiredRole && (
                                    <Badge
                                      variant={step.requiredRole === 'DOCTOR' ? 'primary' : 'default'}
                                      size="sm"
                                    >
                                      {step.requiredRole}
                                    </Badge>
                                  )}
                                </div>
                                {step.completedAt && (
                                  <p className="text-xs text-success-700 font-medium tabular-nums">
                                    Completed: {new Date(step.completedAt).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              <Badge
                                variant={
                                  step.status === 'COMPLETED'
                                    ? 'success'
                                    : step.status === 'ACTION_REQUIRED'
                                    ? 'danger'
                                    : step.status === 'IN_PROGRESS'
                                    ? 'warning'
                                    : 'default'
                                }
                                dot
                              >
                                {step.status}
                              </Badge>
                            </div>

                            {canDoctorModify ? (
                              <div className="space-y-3 pt-3 border-t border-surface-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <Select
                                    label="Milestone status"
                                    value={draft.status}
                                    onChange={(val) =>
                                      setStepDrafts((prev) => ({
                                        ...prev,
                                        [step.id]: { ...draft, status: val },
                                      }))
                                    }
                                    options={STEP_STATUS_OPTIONS}
                                    disabled={isSavingThis}
                                  />

                                  <Select
                                    label="Clinical decision branch"
                                    value={draft.decisionBranch}
                                    onChange={(val) =>
                                      setStepDrafts((prev) => ({
                                        ...prev,
                                        [step.id]: { ...draft, decisionBranch: val },
                                      }))
                                    }
                                    options={DECISION_BRANCH_OPTIONS}
                                    disabled={isSavingThis}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label htmlFor={`step-notes-${step.id}`} className="block text-xs font-medium text-surface-700">
                                    Doctor clinical notes
                                  </label>
                                  <textarea
                                    id={`step-notes-${step.id}`}
                                    rows={2}
                                    value={draft.doctorNotes}
                                    onChange={(e) =>
                                      setStepDrafts((prev) => ({
                                        ...prev,
                                        [step.id]: { ...draft, doctorNotes: e.target.value },
                                      }))
                                    }
                                    placeholder="Add clinical assessment, operative observations, or clearance remarks..."
                                    className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none"
                                  />
                                </div>

                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    isLoading={isSavingThis}
                                    onClick={() => void handleSaveMilestone(step.id)}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Save Milestone
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2.5 border-t border-surface-200 flex flex-wrap items-center justify-between gap-2 text-xs text-surface-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5" />
                                  {isClosed
                                    ? 'Case is closed — read-only'
                                    : `Managed by ${step.requiredRole || 'assigned staff'}`}
                                </span>
                                {step.doctorNotes && (
                                  <span className="text-surface-700">{step.doctorNotes}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Fit-to-Fly Clearance & Case Documents */}
        <div className="space-y-6">
          {/* Fit-to-Fly Travel Clearance Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-surface-200">
              <div>
                <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-primary-600" />
                  Fit-to-Fly clearance
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Certify medical fitness for international air travel
                </p>
              </div>
              {fitToFly?.isCleared ? (
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="w-3 h-3" /> Cleared
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Pending / Hold
                </Badge>
              )}
            </div>

            {fitToFly && (
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200 text-xs space-y-1">
                <p className="font-semibold text-surface-800">
                  Status: {fitToFly.isCleared ? 'Cleared for Air Travel' : 'Not Cleared / Re-evaluation'}
                </p>
                {fitToFly.clearedBy && (
                  <p className="text-surface-600">Signed by: {fitToFly.clearedBy}</p>
                )}
                {fitToFly.clearanceDate && (
                  <p className="text-surface-600 tabular-nums">
                    Cleared on: {new Date(fitToFly.clearanceDate).toLocaleDateString()}
                  </p>
                )}
                {fitToFly.restrictions && (
                  <p className="text-surface-700">
                    <span className="font-medium">Restrictions:</span> {fitToFly.restrictions}
                  </p>
                )}
                {fitToFly?.isCleared && certificateDoc?.fileUrl && (
                  <div className="pt-2">
                    <a
                      href={certificateDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary-700 bg-white border border-primary-200 hover:bg-primary-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Fit-to-Fly Certificate
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleFitToFlySubmit} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <span className="block font-medium text-surface-700">Clearance decision</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isClosed || savingFitToFly}
                    onClick={() => setIsCleared(true)}
                    className={`min-h-11 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      isCleared
                        ? 'bg-success-50 border-success-300 text-success-800'
                        : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    Cleared to Fly
                  </button>
                  <button
                    type="button"
                    disabled={isClosed || savingFitToFly}
                    onClick={() => setIsCleared(false)}
                    className={`min-h-11 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      !isCleared
                        ? 'bg-warning-50 border-warning-300 text-warning-800'
                        : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    Hold / Re-evaluate
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="ftf-restrictions" className="block font-medium text-surface-700">
                  Clinical travel restrictions / instructions
                </label>
                <textarea
                  id="ftf-restrictions"
                  rows={3}
                  disabled={isClosed || savingFitToFly}
                  value={restrictions}
                  onChange={(e) => setRestrictions(e.target.value)}
                  placeholder="e.g., Wheelchair assistance at airport, DVT compression stockings, continue dual antiplatelet therapy..."
                  className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ftf-reeval-date" className="block font-medium text-surface-700">
                  Re-evaluation date (optional)
                </label>
                <input
                  id="ftf-reeval-date"
                  type="date"
                  disabled={isClosed || savingFitToFly}
                  value={reEvalDate}
                  onChange={(e) => setReEvalDate(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 rounded-md border border-surface-300 bg-white text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ftf-cert-file" className="block font-medium text-surface-700">
                  Signed certificate attachment (optional PDF/JPG/PNG)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    id="ftf-cert-file"
                    ref={fitToFlyFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={isClosed || savingFitToFly}
                    onChange={(e) => setFitToFlyFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-surface-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-surface-300 file:text-xs file:font-medium file:bg-white file:text-surface-700 hover:file:bg-surface-50"
                  />
                  {fitToFlyFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setFitToFlyFile(null);
                        if (fitToFlyFileInputRef.current) fitToFlyFileInputRef.current.value = '';
                      }}
                      className="min-h-8 inline-flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-danger-600"
                    >
                      <X className="w-3.5 h-3.5" /> Clear file
                    </button>
                  )}
                </div>
                <p className="text-xs text-surface-500 flex items-center gap-1">
                  <Upload className="w-3 h-3 shrink-0" />
                  Leave blank to auto-generate official Fit-to-Fly PDF certificate when cleared.
                </p>
              </div>

              <Button
                type="submit"
                fullWidth
                size="sm"
                isLoading={savingFitToFly}
                disabled={isClosed}
              >
                {isCleared ? 'Certify Fit-to-Fly & Issue PDF' : 'Save Fit-to-Fly Hold'}
              </Button>
            </form>
          </Card>

          {/* Case Documents & Clinical Certificates */}
          <CaseDocumentsManagerPanel
            key={caseId}
            caseId={caseId}
            canVerify={false}
            issueCategories={DOCTOR_ISSUE_CATEGORIES}
            onDocumentIssued={() => void loadCaseWorkspace({ silent: true })}
          />
        </div>
      </div>
    </div>
  );
}
