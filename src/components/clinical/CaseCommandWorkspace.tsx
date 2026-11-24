'use client';

/**
 * Afzal Healthcare — Unified Coordinator & Admin Case Command Workspace
 * Organizes the complete single-case MVT lifecycle across 5 tabs:
 * 1. Triage & Specialist Assignment
 * 2. Treatment Plan & Cost Estimate
 * 3. Visa (VIL), FRRO Form C & Travel Concierge
 * 4. Clinical Pathway & Recovery Stay
 * 5. Discharge, Fit-to-Fly & Remote Follow-Up
 *
 * IMPORTANT: Never imports `@/lib/services/*` — uses only `@/lib/validation/*` and `@/lib/constants`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, CaseStatusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { VisaAndTravelConciergeCard } from '@/components/clinical/VisaAndTravelConciergeCard';
import { CaseDocumentsManagerPanel } from '@/components/clinical/CaseDocumentsManagerPanel';
import { PathwayBuilderEditor } from '@/components/clinical/PathwayBuilderEditor';
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  FOLLOW_UP_MILESTONE_LABELS,
  FOLLOW_UP_MILESTONES,
  SSR_ASSISTANCE_LABELS,
} from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import {
  CLEAN_PRESET_TEMPLATES,
  computeFormCSlaStatus,
  validateCaseStatusTransition,
  type FitToFlyChecklistPayload,
  type FollowUpMilestone,
  type FormCSlaStatus,
  type TravelLogisticsPayload,
  type TreatmentPlanPayload,
} from '@/lib/validation/lifecycle-schemas';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Hotel,
  Plane,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

export interface CaseCommandWorkspaceProps {
  caseId: string;
  role: 'MANAGER' | 'ADMIN';
  backHref: string;
}

type WorkspaceTabKey =
  | 'triage'
  | 'treatment_plan'
  | 'visa_travel'
  | 'pathway_stay'
  | 'discharge_followup';

type FormHydrationScope = 'ALL' | 'TRIAGE' | 'PLAN' | 'FORMC' | 'NONE';

interface HospitalDirectoryItem {
  id: string;
  name: string;
  city: string;
  accreditation?: string | null;
}

interface DoctorDirectoryItem {
  id: string;
  fullName: string;
  hospitalId: string;
  qualification?: string | null;
  specialisation?: { id: string; name: string } | null;
}

interface CaseDocumentSummary {
  id: string;
  category: string;
  fileName: string;
  fileUrl: string;
  verificationStatus: string;
  verificationNotes?: string | null;
  createdAt: string;
}

interface MedicalBillSummary {
  id: string;
  billNumber: string;
  title: string;
  category: string;
  totalAmount: number | string;
  paidAmount: number | string;
  currency: string;
  status: string;
  dueDate?: string | null;
  fileUrl?: string | null;
  createdAt: string;
  hospital?: { name: string; city: string } | null;
}

interface HotelBookingSummary {
  id: string;
  bookingNo: string;
  roomType: string;
  numGuests: number;
  numNights: number;
  totalAmountUsd: number | string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  specialRequests?: string | null;
  hotel?: {
    id: string;
    name: string;
    city: string;
    distanceKm?: number;
  } | null;
}

interface FitToFlyRecord {
  id: string;
  isCleared: boolean;
  clearedBy?: string | null;
  clearanceDate?: string | null;
  restrictions?: string | null;
  reEvalDate?: string | null;
  checklist?: FitToFlyChecklistPayload | null;
  ssrCode?: string | null;
  requiresMedif?: boolean;
  flightNumber?: string | null;
  departureDate?: string | null;
}

interface CaseRecord {
  id: string;
  patientId: string;
  managerId: string | null;
  hospitalId: string | null;
  primaryDoctorId: string | null;
  status: string;
  notes: string | null;
  isUrgent: boolean;
  escalationNote: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  patient: {
    id: string;
    dob: string;
    nationality: string;
    passportNo: string;
    passportExpiry?: string | null;
    urgencyLevel?: string;
    user: {
      fullName: string;
      email: string;
      phone?: string | null;
    };
  };
  fitToFlyClearance?: FitToFlyRecord | null;
}

interface LifecycleSnapshotData {
  case: CaseRecord;
  hospital: HospitalDirectoryItem | null;
  primaryDoctor: DoctorDirectoryItem | null;
  treatmentPlan: TreatmentPlanPayload | null;
  travelLogistics: TravelLogisticsPayload | null;
  postReturnFollowUps: FollowUpMilestone[];
  formCSlaStatus: FormCSlaStatus;
  unpaidBillCount: number;
  documents: CaseDocumentSummary[];
  medicalBills: MedicalBillSummary[];
  hotelBookings: HotelBookingSummary[];
  availableHospitals?: HospitalDirectoryItem[];
  availableDoctors?: DoctorDirectoryItem[];
}

const WORKSPACE_TABS: Array<{
  key: WorkspaceTabKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'triage', label: 'Triage & Specialist', Icon: UserCheck },
  { key: 'treatment_plan', label: 'Treatment Plan & Quote', Icon: FileText },
  { key: 'visa_travel', label: 'Visa, Form C & Travel', Icon: Plane },
  { key: 'pathway_stay', label: 'Pathway & Recovery Stay', Icon: Hotel },
  { key: 'discharge_followup', label: 'Discharge, Fit-to-Fly & Follow-Up', Icon: ClipboardCheck },
];

const FORM_C_SLA_BADGE: Record<
  FormCSlaStatus,
  { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }
> = {
  NOT_ARRIVED: { variant: 'default', label: 'Awaiting Arrival' },
  DUE_WITHIN_24H: { variant: 'warning', label: 'Form C Due (<24h)' },
  OVERDUE_STATUTORY: { variant: 'danger', label: 'Form C Overdue (>24h)' },
  SUBMITTED_ON_TIME: { variant: 'success', label: 'Form C Filed (<24h)' },
  SUBMITTED_LATE: { variant: 'warning', label: 'Form C Filed (Late)' },
};

function toDateInputValue(val?: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(val?: string | null): string {
  if (!val) return '';
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate()
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function formatDateTime(val?: string | null): string {
  if (!val) return '—';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(val?: string | null): string {
  if (!val) return '—';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CaseCommandWorkspace({
  caseId,
  role,
  backHref,
}: CaseCommandWorkspaceProps) {
  const [snapshot, setSnapshot] = useState<LifecycleSnapshotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('triage');

  // Tab 1 — Triage & Specialist Assignment state
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isAssigningTeam, setIsAssigningTeam] = useState(false);

  // Tab 1 — Case Status, Urgency & Escalation state
  const [targetStatus, setTargetStatus] = useState('INQUIRY_RECEIVED');
  const [isUrgent, setIsUrgent] = useState(false);
  const [caseNotes, setCaseNotes] = useState('');
  const [escalationNote, setEscalationNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Tab 2 — Treatment Plan & Quote state
  const [diagnosis, setDiagnosis] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [planSpecialty, setPlanSpecialty] = useState('');
  const [hospitalLosDays, setHospitalLosDays] = useState('3');
  const [recoveryStayDays, setRecoveryStayDays] = useState('5');
  const [estimatedCostUsd, setEstimatedCostUsd] = useState('');
  const [depositRequiredUsd, setDepositRequiredUsd] = useState('');
  const [inclusionsText, setInclusionsText] = useState('');
  const [exclusionsText, setExclusionsText] = useState('');
  const [doctorOpinionNotes, setDoctorOpinionNotes] = useState('');
  const [isPublishingPlan, setIsPublishingPlan] = useState(false);

  // Tab 3 — Statutory FRRO Form C state
  const [formCSubmittedAtInput, setFormCSubmittedAtInput] = useState('');
  const [frroNumberInput, setFrroNumberInput] = useState('');
  const [formCVisaExpiryInput, setFormCVisaExpiryInput] = useState('');
  const [isRecordingFormC, setIsRecordingFormC] = useState(false);

  const hydrateFormsFromSnapshot = useCallback(
    (data: LifecycleSnapshotData, scope: FormHydrationScope = 'ALL') => {
      if (scope === 'NONE') return;

      if (scope === 'ALL' || scope === 'TRIAGE') {
        const c = data.case;
        setSelectedHospitalId(c.hospitalId || '');
        setSelectedDoctorId(c.primaryDoctorId || '');
        setTargetStatus(c.status || 'INQUIRY_RECEIVED');
        setIsUrgent(Boolean(c.isUrgent));
        setCaseNotes(c.notes || '');
        setEscalationNote(c.escalationNote || '');
        setOverrideReason('');
      }

      if (scope === 'ALL' || scope === 'PLAN') {
        const plan = data.treatmentPlan;
        setDiagnosis(plan?.diagnosis || '');
        setProcedureName(plan?.procedureName || '');
        setPlanSpecialty(plan?.specialty || '');
        setHospitalLosDays(String(plan?.hospitalLosDays ?? 3));
        setRecoveryStayDays(String(plan?.recoveryStayDays ?? 5));
        setEstimatedCostUsd(
          plan?.estimatedCostUsd !== undefined && plan?.estimatedCostUsd !== null
            ? String(plan.estimatedCostUsd)
            : ''
        );
        setDepositRequiredUsd(
          plan?.depositRequiredUsd !== undefined && plan?.depositRequiredUsd !== null
            ? String(plan.depositRequiredUsd)
            : ''
        );
        setInclusionsText(Array.isArray(plan?.inclusions) ? plan.inclusions.join('\n') : '');
        setExclusionsText(Array.isArray(plan?.exclusions) ? plan.exclusions.join('\n') : '');
        setDoctorOpinionNotes(plan?.doctorOpinionNotes || '');
      }

      if (scope === 'ALL' || scope === 'FORMC') {
        const logistics = data.travelLogistics;
        setFormCSubmittedAtInput(toDateTimeLocalValue(logistics?.formCSubmittedAt));
        setFrroNumberInput(logistics?.frroNumber || '');
        setFormCVisaExpiryInput(toDateInputValue(logistics?.visaExpiryDate));
      }
    },
    []
  );

  const fetchLifecycle = useCallback(
    async (options?: {
      silent?: boolean;
      hydrateScope?: FormHydrationScope;
      isCancelled?: () => boolean;
    }) => {
      const silent = Boolean(options?.silent);
      const hydrateScope = options?.hydrateScope ?? 'ALL';
      const isCancelled = options?.isCancelled;
      try {
        if (!silent) {
          setLoadError(null);
        }
        const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`);
        const json = await res.json();
        if (isCancelled?.()) return;

        if (!res.ok || !json.success || !json.data) {
          const msg = json.error?.message || 'Unable to load case workspace.';
          if (silent) {
            toast.error(msg, 'Refresh Failed');
          } else {
            setLoadError(msg);
          }
          return;
        }

        const data = json.data as LifecycleSnapshotData;
        setSnapshot(data);
        hydrateFormsFromSnapshot(data, hydrateScope);
      } catch (err) {
        if (isCancelled?.()) return;
        console.error('Failed to load case lifecycle:', err);
        if (silent) {
          toast.apiError(err, 'Unable to refresh case workspace.', 'Refresh Failed');
        } else {
          setLoadError('Network error loading case workspace.');
        }
      } finally {
        if (!silent && !isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [caseId, hydrateFormsFromSnapshot]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchLifecycle({ hydrateScope: 'ALL', isCancelled: () => cancelled });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchLifecycle]);

  const hospitalOptions: SelectOption[] = useMemo(() => {
    const list = snapshot?.availableHospitals || [];
    return list.map((h) => ({
      value: h.id,
      label: `${h.name} (${h.city})`,
      description: h.accreditation || undefined,
    }));
  }, [snapshot?.availableHospitals]);

  const filteredDoctors = useMemo(() => {
    const allDoctors = snapshot?.availableDoctors || [];
    if (!selectedHospitalId) return allDoctors;
    return allDoctors.filter((d) => d.hospitalId === selectedHospitalId);
  }, [snapshot?.availableDoctors, selectedHospitalId]);

  const doctorOptions: SelectOption[] = useMemo(() => {
    return filteredDoctors.map((d) => ({
      value: d.id,
      label: formatDoctorDisplayName(d.fullName),
      description: [d.specialisation?.name, d.qualification].filter(Boolean).join(' • ') || undefined,
    }));
  }, [filteredDoctors]);

  const specialtyPresetOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'Keep Current Pathway Steps' },
      ...CLEAN_PRESET_TEMPLATES.map((tpl) => ({
        value: tpl.id,
        label: tpl.specialtyName,
      })),
    ];
  }, []);

  const hasVerifiedPassport = useMemo(() => {
    return (snapshot?.documents || []).some(
      (d) => d.category === 'PASSPORT' && d.verificationStatus === 'VERIFIED'
    );
  }, [snapshot?.documents]);

  const hasClearedFitToFly = Boolean(snapshot?.case?.fitToFlyClearance?.isCleared === true);
  const unpaidBillCount = snapshot?.unpaidBillCount ?? 0;

  const currentCaseStatus = snapshot?.case?.status ?? '';

  const liveTransitionGuard = useMemo(() => {
    if (!currentCaseStatus) return { ok: true as const };
    if (currentCaseStatus === 'CLOSED' && role === 'MANAGER' && targetStatus !== 'CLOSED') {
      return {
        ok: false as const,
        message: 'Closed cases are locked and can only be reopened by a Super Admin.',
      };
    }
    return validateCaseStatusTransition({
      currentStatus: currentCaseStatus,
      nextStatus: targetStatus,
      hasVerifiedPassport,
      hasClearedFitToFly,
      unpaidBillCount,
      overrideReason: overrideReason.trim() || escalationNote.trim() || null,
    });
  }, [
    currentCaseStatus,
    role,
    targetStatus,
    hasVerifiedPassport,
    hasClearedFitToFly,
    unpaidBillCount,
    overrideReason,
    escalationNote,
  ]);

  const liveFormCSlaStatus = useMemo(() => {
    return computeFormCSlaStatus(
      snapshot?.travelLogistics?.arrivalAt ?? null,
      snapshot?.travelLogistics?.formCSubmittedAt ?? null
    );
  }, [snapshot?.travelLogistics?.arrivalAt, snapshot?.travelLogistics?.formCSubmittedAt]);

  const arrivalDeadlineLabel = useMemo(() => {
    const arrivalAt = snapshot?.travelLogistics?.arrivalAt;
    if (!arrivalAt) return null;
    const dt = new Date(arrivalAt);
    if (Number.isNaN(dt.getTime())) return null;
    return formatDateTime(new Date(dt.getTime() + 24 * 60 * 60 * 1000).toISOString());
  }, [snapshot?.travelLogistics?.arrivalAt]);

  const billMetrics = useMemo(() => {
    const bills = (snapshot?.medicalBills || []).filter((b) => b.status !== 'CANCELLED');
    const totalAmount = bills.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const paidAmount = bills.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0);
    const remaining = Math.max(0, totalAmount - paidAmount);
    return {
      count: snapshot?.medicalBills?.length || 0,
      activeCount: bills.length,
      totalAmount,
      paidAmount,
      remaining,
    };
  }, [snapshot?.medicalBills]);

  const handleAssignClinicalTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId || !selectedDoctorId) {
      toast.error('Please select both a partner hospital and a primary attending specialist.', 'Selection Required');
      return;
    }

    setIsAssigningTeam(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ASSIGN_CLINICAL_TEAM',
          hospitalId: selectedHospitalId,
          primaryDoctorId: selectedDoctorId,
          ...(selectedSpecialtyId ? { specialtyId: selectedSpecialtyId } : {}),
          ...(assignmentNotes.trim() ? { notes: assignmentNotes.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to assign clinical team.', 'Assignment Error');
        return;
      }

      toast.success('Partner hospital and attending specialist assigned to case.', 'Team Assigned');
      setAssignmentNotes('');
      setSelectedSpecialtyId('');
      await fetchLifecycle({ silent: true, hydrateScope: 'TRIAGE' });
    } catch (err) {
      toast.apiError(err, 'Network error assigning clinical team.', 'Connection Error');
    } finally {
      setIsAssigningTeam(false);
    }
  };

  const handleSaveCaseStatusAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot?.case) return;

    if (!liveTransitionGuard.ok) {
      toast.error(liveTransitionGuard.message, 'Stage-Gate Guardrail');
      return;
    }

    setIsSavingStatus(true);
    try {
      const endpoint = role === 'ADMIN' ? '/api/v1/admin/cases' : '/api/v1/manager/cases';
      const bodyPayload =
        role === 'ADMIN'
          ? {
              id: caseId,
              status: targetStatus,
              notes: caseNotes,
              isUrgent,
              escalationNote: escalationNote.trim() || null,
              ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
            }
          : {
              caseId,
              status: targetStatus,
              notes: caseNotes,
              isUrgent,
              escalationNote: escalationNote.trim() || null,
              ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
            };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();

      if (!res.ok || (role === 'ADMIN' && !json.success)) {
        const message =
          json?.error?.message ||
          (typeof json?.error === 'string' ? json.error : null) ||
          'Failed to update case status.';
        toast.error(message, 'Transition Blocked');
        return;
      }

      toast.success(
        `Case updated (${CASE_STATUS_LABELS[targetStatus] || targetStatus}).`,
        'Case Updated'
      );
      setOverrideReason('');
      await fetchLifecycle({ silent: true, hydrateScope: 'TRIAGE' });
    } catch (err) {
      toast.apiError(err, 'Network error updating case status.', 'Connection Error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handlePublishTreatmentPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim() || !procedureName.trim()) {
      toast.error('Diagnosis and proposed procedure are required.', 'Validation Error');
      return;
    }

    const parsedCost = Number(estimatedCostUsd);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.error('Enter a valid all-in cost estimate in USD.', 'Validation Error');
      return;
    }

    const inclusions = inclusionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const exclusions = exclusionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedDeposit = depositRequiredUsd.trim() ? Number(depositRequiredUsd) : null;
    if (parsedDeposit !== null && (!Number.isFinite(parsedDeposit) || parsedDeposit < 0)) {
      toast.error('Enter a valid deposit amount in USD.', 'Validation Error');
      return;
    }

    setIsPublishingPlan(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PUBLISH_TREATMENT_PLAN',
          diagnosis: diagnosis.trim(),
          procedureName: procedureName.trim(),
          specialty: planSpecialty.trim() || null,
          hospitalLosDays: Number(hospitalLosDays) || 0,
          recoveryStayDays: Number(recoveryStayDays) || 0,
          estimatedCostUsd: parsedCost,
          depositRequiredUsd: parsedDeposit,
          currency: 'USD',
          inclusions,
          exclusions,
          doctorOpinionNotes: doctorOpinionNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to publish treatment plan.', 'Publish Failed');
        return;
      }

      toast.success(
        'Structured treatment plan & cost estimate published to patient portal.',
        'Treatment Plan Published'
      );
      await fetchLifecycle({ silent: true, hydrateScope: 'PLAN' });
    } catch (err) {
      toast.apiError(err, 'Network error publishing treatment plan.', 'Connection Error');
    } finally {
      setIsPublishingPlan(false);
    }
  };

  const handleRecordFormC = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecordingFormC(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECORD_FORM_C',
          formCSubmittedAt: formCSubmittedAtInput
            ? new Date(formCSubmittedAtInput).toISOString()
            : new Date().toISOString(),
          frroNumber: frroNumberInput.trim() || null,
          visaExpiryDate: formCVisaExpiryInput.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to record FRRO Form C submission.', 'Compliance Error');
        return;
      }

      toast.success('Statutory FRRO Form C filing recorded on case timeline.', 'Form C Recorded');
      await fetchLifecycle({ silent: true, hydrateScope: 'FORMC' });
    } catch (err) {
      toast.apiError(err, 'Network error recording Form C filing.', 'Connection Error');
    } finally {
      setIsRecordingFormC(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-surface-500">Loading Case Command Workspace…</p>
      </div>
    );
  }

  if (loadError || !snapshot) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-medium text-surface-600 hover:text-surface-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Cases</span>
        </Link>
        <Card className="p-6 border-danger-200 bg-danger-50 text-center space-y-2">
          <h1 className="text-base font-semibold text-danger-900">
            Unable to Load Case Command Workspace
          </h1>
          <p className="text-xs font-normal text-danger-700">
            {loadError || 'Case record could not be retrieved.'}
          </p>
        </Card>
      </div>
    );
  }

  const c = snapshot.case;
  const isClosed = c.status === 'CLOSED';
  const formCBadge = FORM_C_SLA_BADGE[liveFormCSlaStatus];
  const dischargeDoc = snapshot.documents.find(
    (d) => d.category === 'DISCHARGE_SUMMARY' && d.verificationStatus !== 'REJECTED'
  );
  const fitToFlyDoc = snapshot.documents.find(
    (d) => d.category === 'FIT_TO_FLY_CERTIFICATE' && d.verificationStatus !== 'REJECTED'
  );
  const ftf = c.fitToFlyClearance ?? null;
  const checklist = ftf?.checklist ?? null;
  const followUps: FollowUpMilestone[] =
    snapshot.postReturnFollowUps && snapshot.postReturnFollowUps.length > 0
      ? snapshot.postReturnFollowUps
      : FOLLOW_UP_MILESTONES.map((milestone) => ({
          milestone,
          dueAt: '',
          status: 'PENDING',
        }));

  const accommodationsHref =
    role === 'ADMIN' ? '/admin/accommodations' : '/manager/accommodations';

  return (
    <div className="space-y-6">
      {/* ─── Command Workspace Header ──────────────────────────────────── */}
      <div className="space-y-4 pb-5 border-b border-surface-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 min-h-11 px-2 -ml-2 rounded-md text-xs font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{role === 'ADMIN' ? 'Back to All Cases' : 'Back to Case Pipeline'}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={
                role === 'ADMIN'
                  ? `/admin/cases/${caseId}/pathway`
                  : `/manager/cases/${caseId}/pathway`
              }
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Full Pathway View</span>
            </Link>
            <Link
              href="/manager/billing"
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Billing Desk</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-surface-900">
                {c.patient.user.fullName}
              </h1>
              <CaseStatusBadge status={c.status} />
              {c.isUrgent && (
                <Badge variant="danger" dot>
                  Urgent
                </Badge>
              )}
              <Badge variant={formCBadge.variant} dot>
                {formCBadge.label}
              </Badge>
            </div>
            <p className="text-xs font-normal text-surface-600 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
              <span>{c.patient.user.email}</span>
              <span>•</span>
              <span>Nationality: {c.patient.nationality}</span>
              <span>•</span>
              <span>Passport: {c.patient.passportNo}</span>
              <span>•</span>
              <span className="font-mono text-[11px] text-surface-500">Case: {c.id}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="px-3.5 py-2.5 rounded-lg bg-white border border-surface-200">
              <p className="text-[11px] font-medium text-surface-500">Hospital</p>
              <p className="text-xs font-semibold text-surface-900 mt-0.5 truncate max-w-[160px]">
                {snapshot.hospital?.name || 'Unassigned'}
              </p>
            </div>
            <div className="px-3.5 py-2.5 rounded-lg bg-white border border-surface-200">
              <p className="text-[11px] font-medium text-surface-500">Attending Specialist</p>
              <p className="text-xs font-semibold text-surface-900 mt-0.5 truncate max-w-[160px]">
                {snapshot.primaryDoctor
                  ? formatDoctorDisplayName(snapshot.primaryDoctor.fullName)
                  : 'Unassigned'}
              </p>
            </div>
            <div className="px-3.5 py-2.5 rounded-lg bg-white border border-surface-200 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-medium text-surface-500">Unpaid Invoices</p>
              <p className="text-xs font-semibold text-surface-900 mt-0.5 tabular-nums">
                {unpaidBillCount === 0 ? 'All Settled (0)' : `${unpaidBillCount} Pending`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5-Tab Horizontal Navigation (2px underline, min-h-11) ──────── */}
      <div
        role="tablist"
        aria-label="Case Command Workspace sections"
        className="border-b border-surface-200 flex items-center gap-1 overflow-x-auto"
      >
        {WORKSPACE_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.Icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 min-h-11 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-surface-600 hover:text-surface-900'
              }`}
            >
              <TabIcon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-primary-600' : 'text-surface-400'
                }`}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Tab 1: Triage & Specialist Assignment ─────────────────────── */}
      {activeTab === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Card 1A: Partner Hospital & Primary Specialist Assignment */}
          <Card className="p-5 space-y-5">
            <div className="pb-3 border-b border-surface-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Partner Hospital &amp; Attending Specialist</span>
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  Assigning a hospital and lead specialist advances an open inquiry to Under Review and notifies both doctor and patient.
                </p>
              </div>
            </div>

            <form onSubmit={handleAssignClinicalTeam} className="space-y-4">
              <Select
                label="Partner Hospital"
                searchable
                required
                options={hospitalOptions}
                value={selectedHospitalId}
                onChange={(val) => {
                  setSelectedHospitalId(val);
                  const stillValid = (snapshot.availableDoctors || []).some(
                    (d) => d.id === selectedDoctorId && d.hospitalId === val
                  );
                  if (!stillValid) setSelectedDoctorId('');
                }}
                placeholder="Select active partner hospital…"
                disabled={isClosed}
              />

              <Select
                label="Primary Attending Doctor"
                searchable
                required
                options={doctorOptions}
                value={selectedDoctorId}
                onChange={setSelectedDoctorId}
                placeholder={
                  selectedHospitalId
                    ? 'Select specialist at chosen hospital…'
                    : 'Select a hospital first…'
                }
                helperText={
                  selectedHospitalId && doctorOptions.length === 0
                    ? 'No active doctors found for this hospital.'
                    : 'Only active doctors affiliated with the selected hospital are listed.'
                }
                disabled={isClosed || !selectedHospitalId}
              />

              <Select
                label="Seed 7-Stage MVT Pathway Preset (Optional)"
                options={specialtyPresetOptions}
                value={selectedSpecialtyId}
                onChange={setSelectedSpecialtyId}
                helperText="Only replaces pathway steps if no milestones have been completed yet."
                disabled={isClosed}
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="triage-assignment-notes"
                  className="block text-xs font-medium text-surface-700"
                >
                  Clinical Handoff Notes (Optional)
                </label>
                <textarea
                  id="triage-assignment-notes"
                  rows={3}
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  disabled={isClosed}
                  placeholder="Summarize chief complaint, DICOM findings, or priority clinical triage instructions…"
                  className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                />
              </div>

              <div className="pt-2 border-t border-surface-100 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isAssigningTeam}
                  disabled={isClosed || !selectedHospitalId || !selectedDoctorId}
                >
                  {isAssigningTeam ? 'Assigning Clinical Team…' : 'Assign Hospital & Specialist'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Card 1B: Pipeline Status, Stage-Gate Guardrails & Escalation */}
          <Card className="p-5 space-y-5">
            <div className="pb-3 border-b border-surface-200">
              <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary-600" aria-hidden="true" />
                <span>Case Status, Guardrails &amp; Escalation</span>
              </h2>
              <p className="text-xs font-normal text-surface-500 mt-1">
                Stage transitions validate verified passport status, Fit-to-Fly medical sign-off, and unpaid hospital invoices.
              </p>
            </div>

            {/* Readiness Gate Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Passport Gate
                </span>
                <Badge variant={hasVerifiedPassport ? 'success' : 'warning'} dot size="sm">
                  {hasVerifiedPassport ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Fit-to-Fly Gate
                </span>
                <Badge variant={hasClearedFitToFly ? 'success' : 'default'} dot size="sm">
                  {hasClearedFitToFly ? 'Cleared' : 'Pending'}
                </Badge>
              </div>
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Billing Gate
                </span>
                <Badge
                  variant={unpaidBillCount === 0 ? 'success' : 'warning'}
                  dot
                  size="sm"
                >
                  {unpaidBillCount === 0 ? 'Settled' : `${unpaidBillCount} Unpaid`}
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSaveCaseStatusAndNotes} className="space-y-4">
              <Select
                label="Case Lifecycle Status"
                required
                value={targetStatus}
                onChange={setTargetStatus}
                disabled={isClosed && role === 'MANAGER'}
                helperText={
                  isClosed && role === 'MANAGER'
                    ? 'Closed cases are locked and can only be reopened by a Super Admin.'
                    : undefined
                }
                options={CASE_STATUS_ORDER.map((s) => ({
                  value: s,
                  label: CASE_STATUS_LABELS[s] || s,
                }))}
              />

              {!liveTransitionGuard.ok && (
                <div
                  role="alert"
                  className="p-3 rounded-md bg-warning-50 border border-warning-200 text-warning-900 text-xs flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium">Stage-Gate Guardrail Active</p>
                    <p className="font-normal text-warning-800">{liveTransitionGuard.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="case-triage-notes"
                  className="block text-xs font-medium text-surface-700"
                >
                  Coordinator Case Assessment Notes
                </label>
                <textarea
                  id="case-triage-notes"
                  rows={3}
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  placeholder="Enter clinical coordination progress, partner hospital remarks, or patient follow-up notes…"
                  className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-600"
                />
                <span className="text-xs font-medium text-surface-800">
                  Flag case as clinically urgent (prioritize coordinator &amp; specialist queue)
                </span>
              </label>

              <div className="space-y-1.5">
                <label
                  htmlFor="case-escalation-note"
                  className="block text-xs font-medium text-danger-700"
                >
                  Escalation Note (Optional — surfaced in Admin Escalations)
                </label>
                <textarea
                  id="case-escalation-note"
                  rows={2}
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  placeholder="Document critical delays, ICU escalation, or exceptional closure rationale…"
                  className="w-full p-2.5 rounded-md border border-danger-200 bg-danger-50/40 text-xs text-danger-900 focus:border-danger-400 focus:outline-none"
                />
              </div>

              {!(isClosed && role === 'MANAGER') && (
                <Input
                  label="Administrative Override Reason (Optional)"
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Required only when overriding passport or billing closure gates"
                  helperText="Logged immutably in the HIPAA audit trail if used."
                />
              )}

              <div className="pt-2 border-t border-surface-100 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSavingStatus}
                  disabled={!liveTransitionGuard.ok}
                >
                  {isSavingStatus ? 'Saving Case Status…' : 'Save Status & Triage Notes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── Tab 2: Treatment Plan & Cost Estimate ─────────────────────── */}
      {activeTab === 'treatment_plan' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-5">
            {/* Live Patient Consent Status Banner */}
            <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {snapshot.treatmentPlan?.consentAcceptedAt ? (
                  <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <Clock className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <h2 className="text-sm font-semibold text-surface-900">
                    {snapshot.treatmentPlan?.consentAcceptedAt
                      ? 'Patient Informed Consent Accepted'
                      : snapshot.treatmentPlan?.publishedAt
                      ? 'Awaiting Patient Informed Consent'
                      : 'Treatment Plan Not Yet Published'}
                  </h2>
                  <p className="text-xs font-normal text-surface-600 mt-0.5 tabular-nums">
                    {snapshot.treatmentPlan?.consentAcceptedAt
                      ? `Accepted on ${formatDateTime(snapshot.treatmentPlan.consentAcceptedAt)}. Re-publishing a revised quote resets consent until the patient re-confirms.`
                      : snapshot.treatmentPlan?.publishedAt
                      ? `Published on ${formatDateTime(snapshot.treatmentPlan.publishedAt)}. Patient must accept inside their dashboard to confirm the plan.`
                      : 'Publish a structured diagnosis, LOS window, and all-in USD quote below to request patient consent.'}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  snapshot.treatmentPlan?.consentAcceptedAt
                    ? 'success'
                    : snapshot.treatmentPlan?.publishedAt
                    ? 'warning'
                    : 'default'
                }
                dot
              >
                {snapshot.treatmentPlan?.consentAcceptedAt
                  ? 'Consent Signed'
                  : snapshot.treatmentPlan?.publishedAt
                  ? 'Pending Consent'
                  : 'Draft'}
              </Badge>
            </Card>

            {/* Structured Treatment Plan Form */}
            <Card className="p-5 space-y-5">
              <div className="pb-3 border-b border-surface-200">
                <h2 className="text-sm sm:text-base font-semibold text-surface-900">
                  Publish Structured Treatment Plan &amp; All-In Quote
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  Transparently communicates clinical diagnosis, proposed surgery/therapy, hospital stay length, recovery stay, and all-in package pricing in USD.
                </p>
              </div>

              <form onSubmit={handlePublishTreatmentPlan} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Confirmed Clinical Diagnosis"
                    type="text"
                    required
                    placeholder="e.g. Triple Vessel Coronary Artery Disease"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    disabled={isClosed}
                  />
                  <Input
                    label="Proposed Procedure / Intervention"
                    type="text"
                    required
                    placeholder="e.g. Off-Pump CABG / Drug-Eluting Stent PCI"
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    disabled={isClosed}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Clinical Specialty (Optional)"
                    type="text"
                    placeholder="e.g. Interventional Cardiology"
                    value={planSpecialty}
                    onChange={(e) => setPlanSpecialty(e.target.value)}
                    disabled={isClosed}
                  />
                  <Input
                    label="Hospital Inpatient LOS (Days)"
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={hospitalLosDays}
                    onChange={(e) => setHospitalLosDays(e.target.value)}
                    disabled={isClosed}
                    className="tabular-nums"
                  />
                  <Input
                    label="Post-Discharge Recovery Stay (Days)"
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={recoveryStayDays}
                    onChange={(e) => setRecoveryStayDays(e.target.value)}
                    disabled={isClosed}
                    className="tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="All-In Cost Estimate (USD)"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="e.g. 6850"
                    value={estimatedCostUsd}
                    onChange={(e) => setEstimatedCostUsd(e.target.value)}
                    disabled={isClosed}
                    className="tabular-nums"
                  />
                  <Input
                    label="Initial Admission Deposit Required (USD, Optional)"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={depositRequiredUsd}
                    onChange={(e) => setDepositRequiredUsd(e.target.value)}
                    disabled={isClosed}
                    className="tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="plan-inclusions"
                      className="block text-xs font-medium text-surface-700"
                    >
                      Package Inclusions (One item per line)
                    </label>
                    <textarea
                      id="plan-inclusions"
                      rows={4}
                      value={inclusionsText}
                      onChange={(e) => setInclusionsText(e.target.value)}
                      disabled={isClosed}
                      placeholder={'Operating theater & anesthesia\n3 days private ICU/ward stay\nAirport pickup & Arabic/French interpreter'}
                      className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="plan-exclusions"
                      className="block text-xs font-medium text-surface-700"
                    >
                      Package Exclusions (One item per line)
                    </label>
                    <textarea
                      id="plan-exclusions"
                      rows={4}
                      value={exclusionsText}
                      onChange={(e) => setExclusionsText(e.target.value)}
                      disabled={isClosed}
                      placeholder={'International airfare & visa fees\nExtended ICU stay beyond package window\nOutpatient hotel meals'}
                      className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="plan-doctor-opinion"
                    className="block text-xs font-medium text-surface-700"
                  >
                    Specialist Clinical Opinion Notes (Optional)
                  </label>
                  <textarea
                    id="plan-doctor-opinion"
                    rows={3}
                    value={doctorOpinionNotes}
                    onChange={(e) => setDoctorOpinionNotes(e.target.value)}
                    disabled={isClosed}
                    placeholder="Pre-travel diagnostic prerequisites, medication hold instructions (e.g. anticoagulants), or surgical approach summary…"
                    className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:border-primary-600 focus:outline-none disabled:bg-surface-100"
                  />
                </div>

                <div className="pt-2 border-t border-surface-100 flex justify-end">
                  <Button type="submit" size="sm" isLoading={isPublishingPlan} disabled={isClosed}>
                    {isPublishingPlan ? 'Publishing Treatment Plan…' : 'Publish Treatment Plan & Quote'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Right Column: Formal MedicalBill Quick-Link & Case Invoice Summary */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200">
              <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary-600" aria-hidden="true" />
                <span>Formal Hospital Billing</span>
              </h3>
              <p className="text-xs font-normal text-surface-500 mt-1">
                Convert the approved estimate into an itemized hospital invoice for deposit or final settlement.
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Invoices on Case</span>
                <span className="font-semibold text-surface-900">{billMetrics.count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Total Billed</span>
                <span className="font-semibold text-surface-900">
                  ${billMetrics.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Outstanding</span>
                <span className="font-semibold text-danger-700">
                  ${billMetrics.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Link
              href={`/manager/billing?caseId=${caseId}`}
              className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 shadow-2xs transition-colors"
            >
              <Receipt className="w-4 h-4" aria-hidden="true" />
              <span>Issue Formal Medical Bill</span>
            </Link>
          </Card>
        </div>
      )}

      {/* ─── Tab 3: Visa (VIL), FRRO Form C & Travel Concierge ─────────── */}
      {activeTab === 'visa_travel' && (
        <div className="space-y-6">
          {/* Statutory Form C (<24h SLA) Compliance Card */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Statutory Indian FRRO Form C Compliance (&lt;24h SLA)</span>
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  Indian Foreigners Regional Registration Office regulations require Form C filing within 24 hours of international patient arrival.
                </p>
              </div>
              <Badge variant={formCBadge.variant} dot>
                {formCBadge.label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tabular-nums">
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Inbound Arrival Timestamp
                </span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {formatDateTime(snapshot.travelLogistics?.arrivalAt)}
                </span>
              </div>
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200">
                <span className="text-[11px] font-medium text-surface-500 block">
                  24-Hour Statutory Deadline
                </span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {arrivalDeadlineLabel || 'Pending Arrival Schedule'}
                </span>
              </div>
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200">
                <span className="text-[11px] font-medium text-surface-500 block">
                  MED-X Attendants On File
                </span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {snapshot.travelLogistics?.attendants?.length || 0} / 2 Companions
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordFormC} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Form C Submission Timestamp"
                  type="datetime-local"
                  value={formCSubmittedAtInput}
                  onChange={(e) => setFormCSubmittedAtInput(e.target.value)}
                  disabled={isClosed}
                  helperText="Leave blank to stamp current submission time."
                />
                <Input
                  label="FRRO / Form C Reference Number"
                  type="text"
                  placeholder="e.g. FRRO-DEL-2026-88412"
                  value={frroNumberInput}
                  onChange={(e) => setFrroNumberInput(e.target.value)}
                  disabled={isClosed}
                />
                <Input
                  label="Approved Medical Visa Expiry"
                  type="date"
                  value={formCVisaExpiryInput}
                  onChange={(e) => setFormCVisaExpiryInput(e.target.value)}
                  disabled={isClosed}
                />
              </div>

              <div className="pt-2 border-t border-surface-100 flex justify-end">
                <Button type="submit" size="sm" isLoading={isRecordingFormC} disabled={isClosed}>
                  {isRecordingFormC ? 'Recording Form C…' : 'Record Statutory Form C Filing'}
                </Button>
              </div>
            </form>
          </Card>

          {/* MED-X Attendants, Flights & Airport Pickup Confirmation */}
          <VisaAndTravelConciergeCard
            caseId={caseId}
            passportExpiry={c.patient.passportExpiry}
            travelLogistics={snapshot.travelLogistics}
            role="STAFF"
            onSaved={() => void fetchLifecycle({ silent: true, hydrateScope: 'NONE' })}
          />

          {/* Case Documents Verification & VIL / FRRO Certificate Issuance */}
          <CaseDocumentsManagerPanel
            caseId={caseId}
            canVerify
            onDocumentIssued={() => void fetchLifecycle({ silent: true, hydrateScope: 'NONE' })}
          />
        </div>
      )}

      {/* ─── Tab 4: Clinical Pathway & Recovery Stay ───────────────────── */}
      {activeTab === 'pathway_stay' && (
        <div className="space-y-6">
          <PathwayBuilderEditor
            caseId={caseId}
            backHref={backHref}
            backLabel="Back to Cases"
            embedded
          />

          {/* Linked HotelBooking Vouchers Summary */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Linked Recovery Hotel Vouchers ({snapshot.hotelBookings.length})</span>
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  Post-discharge hotel accommodations booked near the partner hospital for patient and MED-X attendants.
                </p>
              </div>
              <Link
                href={accommodationsHref}
                className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 transition-colors shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Manage Partner Hotels</span>
              </Link>
            </div>

            {snapshot.hotelBookings.length === 0 ? (
              <div className="p-6 rounded-lg bg-surface-50 border border-dashed border-surface-300 text-center text-xs text-surface-500">
                No recovery hotel bookings linked to this patient or case yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {snapshot.hotelBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-4 rounded-lg border border-surface-200 bg-surface-50/50 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] text-surface-500 block">
                          {booking.bookingNo}
                        </span>
                        <p className="text-sm font-semibold text-surface-900 mt-0.5">
                          {booking.hotel?.name || 'Partner Recovery Hotel'}
                        </p>
                        {booking.hotel?.city && (
                          <p className="text-[11px] text-surface-500">
                            {booking.hotel.city}
                            {booking.hotel.distanceKm !== undefined
                              ? ` • ${booking.hotel.distanceKm} km from hospital`
                              : ''}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN'
                            ? 'success'
                            : booking.status === 'CANCELLED'
                            ? 'danger'
                            : 'info'
                        }
                        dot
                      >
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-200 tabular-nums">
                      <div>
                        <span className="text-[11px] text-surface-500 block">Check-In</span>
                        <span className="font-medium text-surface-900">
                          {formatShortDate(booking.checkInDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-surface-500 block">Check-Out</span>
                        <span className="font-medium text-surface-900">
                          {formatShortDate(booking.checkOutDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-surface-500 block">Room &amp; Stay</span>
                        <span className="font-medium text-surface-900">
                          {booking.roomType} ({booking.numNights}n, {booking.numGuests} guests)
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-surface-500 block">Voucher Total</span>
                        <span className="font-semibold text-surface-900">
                          ${Number(booking.totalAmountUsd || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    {booking.specialRequests && (
                      <p className="text-[11px] text-surface-600 bg-white p-2 rounded-md border border-surface-200">
                        <span className="font-medium text-surface-700">Requests:</span>{' '}
                        {booking.specialRequests}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── Tab 5: Discharge, Fit-to-Fly & Remote Follow-Up ───────────── */}
      {activeTab === 'discharge_followup' && (
        <div className="space-y-6">
          {/* 5A. Hospital Bill Settlement Progress */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Hospital Bill Settlement Progress</span>
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  All non-cancelled invoices must be settled prior to routine case closure.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={unpaidBillCount === 0 ? 'success' : 'warning'} dot>
                  {unpaidBillCount === 0
                    ? 'All Bills Settled'
                    : `${unpaidBillCount} Unpaid Invoice${unpaidBillCount === 1 ? '' : 's'}`}
                </Badge>
                <Link
                  href={`/manager/billing?caseId=${caseId}`}
                  className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 transition-colors"
                >
                  <span>Open Billing Desk</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
              <div className="p-3.5 rounded-lg bg-surface-50 border border-surface-200">
                <span className="text-xs font-medium text-surface-500 block">Total Invoiced</span>
                <span className="text-lg font-semibold text-surface-900 mt-1 block">
                  ${billMetrics.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-surface-50 border border-surface-200">
                <span className="text-xs font-medium text-surface-500 block">Paid to Date</span>
                <span className="text-lg font-semibold text-success-700 mt-1 block">
                  ${billMetrics.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-surface-50 border border-surface-200">
                <span className="text-xs font-medium text-surface-500 block">Remaining Balance</span>
                <span className="text-lg font-semibold text-danger-700 mt-1 block">
                  ${billMetrics.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {snapshot.medicalBills.length === 0 ? (
              <div className="p-5 rounded-lg bg-surface-50 border border-dashed border-surface-300 text-center text-xs text-surface-500">
                No medical bills issued on this case yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {snapshot.medicalBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3.5 rounded-lg border border-surface-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-surface-500">
                          {bill.billNumber}
                        </span>
                        <Badge
                          variant={
                            bill.status === 'PAID'
                              ? 'success'
                              : bill.status === 'OVERDUE'
                              ? 'danger'
                              : bill.status === 'CANCELLED'
                              ? 'default'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {bill.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="font-semibold text-surface-900">{bill.title}</p>
                      <p className="text-[11px] text-surface-500 tabular-nums">
                        Issued {formatShortDate(bill.createdAt)}
                        {bill.dueDate ? ` • Due ${formatShortDate(bill.dueDate)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <div className="text-right">
                        <p className="font-semibold text-surface-900">
                          {bill.currency} {Number(bill.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-surface-500">
                          Paid: {bill.currency} {Number(bill.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {bill.fileUrl && (
                        <a
                          href={bill.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 min-h-11 px-3 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>PDF</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 5B. Discharge Summary & Fit-to-Fly / MEDIF Clearance Status */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Discharge Summary &amp; IATA Fit-to-Fly / MEDIF Clearance</span>
                </h2>
                <p className="text-xs font-normal text-surface-500 mt-1">
                  Clinical Fit-to-Fly certification and physiological safety verification signed by the treating specialist.
                </p>
              </div>
              <Badge variant={hasClearedFitToFly ? 'success' : 'warning'} dot>
                {hasClearedFitToFly ? 'Fit-to-Fly Cleared' : 'Clearance Pending'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-surface-900">Hospital Discharge Summary</span>
                  <Badge variant={dischargeDoc ? 'success' : 'default'} size="sm">
                    {dischargeDoc ? 'Issued' : 'Not Issued'}
                  </Badge>
                </div>
                {dischargeDoc ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-surface-600 truncate">{dischargeDoc.fileName}</span>
                    <a
                      href={dischargeDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 min-h-11 px-2.5 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-surface-500 font-normal">
                    Awaiting specialist or admin issuance of official Discharge Summary.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-surface-900">Fit-to-Fly Certificate</span>
                  <Badge variant={fitToFlyDoc ? 'success' : 'default'} size="sm">
                    {fitToFlyDoc ? 'Issued' : 'Not Issued'}
                  </Badge>
                </div>
                {fitToFlyDoc ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-surface-600 truncate">{fitToFlyDoc.fileName}</span>
                    <a
                      href={fitToFlyDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 min-h-11 px-2.5 rounded-md border border-surface-300 bg-white hover:bg-surface-100 text-xs font-medium text-surface-700 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-surface-500 font-normal">
                    Certificate is auto-generated when the attending physician signs Fit-to-Fly clearance.
                  </p>
                )}
              </div>
            </div>

            {ftf ? (
              <div className="p-4 rounded-lg border border-surface-200 bg-white space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 tabular-nums">
                  <div>
                    <span className="text-[11px] text-surface-500 block">Cleared Date</span>
                    <span className="font-medium text-surface-900">
                      {formatShortDate(ftf.clearanceDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-surface-500 block">Airline SSR Assistance</span>
                    <span className="font-medium text-surface-900">
                      {ftf.ssrCode && ftf.ssrCode in SSR_ASSISTANCE_LABELS
                        ? SSR_ASSISTANCE_LABELS[ftf.ssrCode as keyof typeof SSR_ASSISTANCE_LABELS]
                        : ftf.ssrCode || 'NONE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-surface-500 block">IATA MEDIF Status</span>
                    <Badge variant={ftf.requiresMedif ? 'warning' : 'success'} size="sm">
                      {ftf.requiresMedif ? 'MEDIF Required (48-72h)' : 'Not Required'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[11px] text-surface-500 block">Return Flight</span>
                    <span className="font-medium text-surface-900">
                      {ftf.flightNumber || snapshot.travelLogistics?.departureFlightNo || 'TBD'}
                    </span>
                  </div>
                </div>

                {checklist && (
                  <div className="pt-3 border-t border-surface-200 flex flex-wrap gap-2">
                    {[
                      { label: 'Wound Stable', ok: checklist.woundStable },
                      { label: 'No Trapped Gas Risk', ok: checklist.noTrappedGasRisk },
                      { label: 'Cardio-Resp Stable', ok: checklist.cardioRespiratoryStable },
                      { label: 'Hemoglobin Cleared', ok: checklist.hemoglobinCleared },
                      { label: 'DVT Prophylaxis Plan', ok: checklist.dvtProphylaxisPlan },
                    ].map((item) => (
                      <Badge key={item.label} variant={item.ok ? 'success' : 'danger'} size="sm">
                        {item.label}: {item.ok ? 'PASS' : 'PENDING'}
                      </Badge>
                    ))}
                  </div>
                )}

                {ftf.restrictions && (
                  <p className="p-2.5 rounded-md bg-surface-50 border border-surface-200 text-surface-700">
                    <span className="font-medium text-surface-900">Travel Restrictions:</span>{' '}
                    {ftf.restrictions}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 text-xs text-surface-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-surface-400 shrink-0" aria-hidden="true" />
                <span>
                  The treating physician has not yet logged a Fit-to-Fly safety checklist for this case.
                </span>
              </div>
            )}
          </Card>

          {/* 5C. Day-7 / Day-30 / Day-90 Post-Return Recovery Check-Ins */}
          <Card className="p-5 space-y-4">
            <div className="pb-3 border-b border-surface-200">
              <h2 className="text-sm sm:text-base font-semibold text-surface-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" aria-hidden="true" />
                <span>Post-Return Continuum Check-Ins (Day-7 / Day-30 / Day-90)</span>
              </h2>
              <p className="text-xs font-normal text-surface-500 mt-1">
                Monitor remote recovery check-ins submitted by the patient and reviewed by the treating specialist.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {followUps.map((item) => {
                const label = FOLLOW_UP_MILESTONE_LABELS[item.milestone] || item.milestone;
                return (
                  <div
                    key={item.milestone}
                    className="p-4 rounded-lg border border-surface-200 bg-surface-50/50 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-surface-900">{label}</p>
                        <p className="text-[11px] text-surface-500 tabular-nums mt-0.5">
                          Due: {item.dueAt ? formatShortDate(item.dueAt) : 'Upon Fit-to-Fly'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === 'REVIEWED'
                            ? 'success'
                            : item.status === 'SUBMITTED'
                            ? 'info'
                            : 'default'
                        }
                        size="sm"
                        dot
                      >
                        {item.status}
                      </Badge>
                    </div>

                    {item.painScore !== undefined && (
                      <p className="text-surface-700 tabular-nums">
                        <span className="font-medium text-surface-900">Pain Score:</span>{' '}
                        {item.painScore} / 10
                        {item.woundStatus ? ` • Wound: ${item.woundStatus}` : ''}
                      </p>
                    )}

                    {item.patientNotes && (
                      <p className="p-2.5 rounded-md bg-white border border-surface-200 text-surface-700">
                        <span className="font-medium text-surface-900 block mb-0.5">
                          Patient Report
                        </span>
                        {item.patientNotes}
                      </p>
                    )}

                    {item.doctorFeedback && (
                      <p className="p-2.5 rounded-md bg-success-50 border border-success-200 text-success-900">
                        <span className="font-medium block mb-0.5">Specialist Feedback</span>
                        {item.doctorFeedback}
                      </p>
                    )}

                    {!item.patientNotes && !item.doctorFeedback && (
                      <p className="text-[11px] text-surface-500 font-normal">
                        Awaiting patient post-return check-in submission.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
