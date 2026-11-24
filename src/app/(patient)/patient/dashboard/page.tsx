'use client';

/**
 * Afzal Healthcare — Patient Care Overview & Stage-Aware Care Hub
 * Clean, flat institutional header, neutral metric summary, dynamic Next Actions,
 * Care Team (Coordinator, Assigned Hospital, Attending Specialist), and Care Roadmap.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePatientSession } from '../patient-session-context';
import {
  Calendar,
  FolderLock,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  Stethoscope,
  Building2,
  ArrowRight,
  Phone,
  Mail,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ClinicalRoadmapTree,
  ClinicalStepData,
  FitToFlyData,
} from '@/components/clinical/ClinicalRoadmapTree';
import { PatientNextActionCard } from '@/components/clinical/PatientNextActionCard';
import { CASE_PHASE_GROUPS, CASE_STATUS_LABELS, getCasePhaseIndex } from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import type {
  FollowUpMilestone,
  PatientDocumentSummary,
  TravelLogisticsPayload,
  TreatmentPlanPayload,
} from '@/lib/validation/lifecycle-schemas';

interface Coordinator {
  fullName: string;
  email: string;
  phone: string;
}

interface HospitalSummary {
  id: string;
  name: string;
  city?: string | null;
  accreditation?: string | null;
}

interface PrimaryDoctorSummary {
  id: string;
  fullName: string;
  qualification?: string | null;
  specialisation?: {
    id: string;
    name: string;
  } | null;
}

interface CaseRecord {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  manager: Coordinator | null;
  hospital?: HospitalSummary | null;
  primaryDoctor?: PrimaryDoctorSummary | null;
  clinicalSteps?: ClinicalStepData[];
  fitToFlyClearance?: FitToFlyData | null;
  treatmentPlan?: TreatmentPlanPayload | null;
  travelLogistics?: TravelLogisticsPayload | null;
  postReturnFollowUps?: FollowUpMilestone[] | null;
}

interface LifecycleSnapshotResponse {
  case?: Partial<CaseRecord>;
  hospital?: HospitalSummary | null;
  primaryDoctor?: PrimaryDoctorSummary | null;
  treatmentPlan?: TreatmentPlanPayload | null;
  travelLogistics?: TravelLogisticsPayload | null;
  postReturnFollowUps?: FollowUpMilestone[];
  unpaidBillCount?: number;
  documents?: PatientDocumentSummary[];
}

export default function PatientDashboard() {
  const { fullName } = usePatientSession();
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [lifecycleSnapshot, setLifecycleSnapshot] =
    useState<LifecycleSnapshotResponse | null>(null);
  const [documentsList, setDocumentsList] = useState<PatientDocumentSummary[]>([]);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestedModal, setRequestedModal] = useState<
    'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL' | null
  >(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [casesRes, appRes, docRes] = await Promise.all([
        fetch('/api/v1/patient/cases'),
        fetch('/api/v1/patient/appointments'),
        fetch('/api/v1/patient/documents'),
      ]);

      if (!casesRes.ok && !appRes.ok && !docRes.ok) {
        throw new Error('Unable to reach your care portal right now.');
      }

      const [casesData, appData, docData] = await Promise.all([
        casesRes.json(),
        appRes.json(),
        docRes.json(),
      ]);

      const primaryCase: CaseRecord | null =
        casesData.success && casesData.data?.cases?.length > 0
          ? casesData.data.cases[0]
          : null;
      setActiveCase(primaryCase);

      if (appData.success && Array.isArray(appData.data?.appointments)) {
        const upcoming = appData.data.appointments.filter(
          (a: { scheduledAt: string; status: string }) =>
            new Date(a.scheduledAt) > new Date() && a.status !== 'CANCELLED'
        );
        setAppointmentsCount(upcoming.length);
      }

      if (docData.success && Array.isArray(docData.data?.documents)) {
        setDocumentsList(docData.data.documents as PatientDocumentSummary[]);
        setDocumentsCount(docData.data.documents.length);
      } else {
        setDocumentsList([]);
      }

      if (primaryCase?.id) {
        try {
          const lifecycleRes = await fetch(`/api/v1/cases/${primaryCase.id}/lifecycle`);
          if (lifecycleRes.ok) {
            const lifecycleJson = await lifecycleRes.json();
            if (lifecycleJson.success && lifecycleJson.data) {
              setLifecycleSnapshot(lifecycleJson.data as LifecycleSnapshotResponse);
            }
          }
        } catch (lifecycleErr) {
          console.error('Failed to fetch case lifecycle snapshot', lifecycleErr);
        }
      } else {
        setLifecycleSnapshot(null);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      setLoadError(
        'We could not load your care overview due to a connection interruption. Your medical records are safe — please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleLifecycleUpdated = useCallback((snapshotRaw: Record<string, unknown>) => {
    const snapshot = snapshotRaw as LifecycleSnapshotResponse;
    setLifecycleSnapshot(snapshot);
    setActiveCase((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(snapshot.case?.status ? { status: snapshot.case.status } : {}),
        ...(Array.isArray(snapshot.case?.clinicalSteps)
          ? { clinicalSteps: snapshot.case.clinicalSteps }
          : {}),
        ...(snapshot.hospital !== undefined ? { hospital: snapshot.hospital } : {}),
        ...(snapshot.primaryDoctor !== undefined
          ? { primaryDoctor: snapshot.primaryDoctor }
          : {}),
        ...(snapshot.treatmentPlan !== undefined
          ? { treatmentPlan: snapshot.treatmentPlan }
          : {}),
        ...(snapshot.travelLogistics !== undefined
          ? { travelLogistics: snapshot.travelLogistics }
          : {}),
        ...(snapshot.postReturnFollowUps !== undefined
          ? { postReturnFollowUps: snapshot.postReturnFollowUps }
          : {}),
      };
    });
  }, []);

  const effectiveCaseStatus =
    lifecycleSnapshot?.case?.status || activeCase?.status || 'INQUIRY_RECEIVED';
  const effectiveHospital = lifecycleSnapshot?.hospital ?? activeCase?.hospital ?? null;
  const effectiveDoctor =
    lifecycleSnapshot?.primaryDoctor ?? activeCase?.primaryDoctor ?? null;
  const effectiveTreatmentPlan =
    lifecycleSnapshot?.treatmentPlan ?? activeCase?.treatmentPlan ?? null;
  const effectiveTravelLogistics =
    lifecycleSnapshot?.travelLogistics ?? activeCase?.travelLogistics ?? null;
  const effectiveFollowUps = useMemo(
    () =>
      lifecycleSnapshot?.postReturnFollowUps ?? activeCase?.postReturnFollowUps ?? [],
    [lifecycleSnapshot?.postReturnFollowUps, activeCase?.postReturnFollowUps]
  );
  const effectiveDocuments = useMemo(
    () => lifecycleSnapshot?.documents ?? documentsList,
    [lifecycleSnapshot?.documents, documentsList]
  );
  const effectiveUnpaidBillCount = lifecycleSnapshot?.unpaidBillCount ?? 0;
  const effectiveSteps =
    (lifecycleSnapshot?.case?.clinicalSteps as ClinicalStepData[] | undefined) ??
    activeCase?.clinicalSteps ??
    [];

  const issuedDocCategories = useMemo(() => {
    return new Set(
      effectiveDocuments
        .filter(
          (doc) =>
            doc.verificationStatus === 'ISSUED_BY_HOSPITAL' ||
            doc.verificationStatus === 'VERIFIED'
        )
        .map((doc) => doc.category)
    );
  }, [effectiveDocuments]);

  const hasPendingFollowUp = useMemo(
    () => effectiveFollowUps.some((m) => m.status === 'PENDING'),
    [effectiveFollowUps]
  );

  const activeIndex = useMemo(() => {
    if (!activeCase) return 0;
    return getCasePhaseIndex(effectiveCaseStatus);
  }, [activeCase, effectiveCaseStatus]);

  const progressPercentage = useMemo(() => {
    return Math.round(((activeIndex + 1) / CASE_PHASE_GROUPS.length) * 100);
  }, [activeIndex]);

  const firstName = useMemo(() => {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
  }, [fullName]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-16 rounded-lg bg-surface-200/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-lg bg-white border border-surface-200 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-lg bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* ─── Clean Flat Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : 'Care Overview'}
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Review your care milestones, share medical records, and stay connected with your
            coordinator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/patient/profile"
            className="inline-flex items-center justify-center min-h-11 px-3.5 bg-white hover:bg-surface-100 border border-surface-300 text-surface-700 rounded-md text-xs font-medium transition-colors shadow-2xs"
          >
            Medical Profile
          </Link>
          <Link
            href="/patient/documents"
            className="inline-flex items-center justify-center min-h-11 px-3.5 bg-primary-600 hover:bg-primary-700 text-white border border-primary-700/20 rounded-md text-xs font-medium transition-colors shadow-2xs"
          >
            Upload Records
          </Link>
        </div>
      </div>

      {/* ─── Network Error Recovery Banner ───────────────────────────────── */}
      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Unable to load your latest care updates</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* ─── Restrained Neutral Summary Row ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">Upcoming Consultations</p>
            <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
              {appointmentsCount}
            </p>
            <Link
              href="/patient/appointments"
              className="text-xs font-medium text-primary-700 hover:text-primary-800 mt-1 min-h-11 inline-flex items-center gap-1"
            >
              <span>View schedule</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-surface-500">Uploaded Documents</p>
            <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
              {documentsCount}
            </p>
            <Link
              href="/patient/documents"
              className="text-xs font-medium text-primary-700 hover:text-primary-800 mt-1 min-h-11 inline-flex items-center gap-1"
            >
              <span>Open vault</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <FolderLock className="w-4 h-4" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-surface-500">Case Coordinator</p>
            <p className="text-base font-semibold text-surface-900 mt-1.5 truncate">
              {activeCase?.manager?.fullName || 'Assigning shortly'}
            </p>
            <Link
              href="/patient/messages"
              className="text-xs font-medium text-primary-700 hover:text-primary-800 mt-1.5 min-h-11 inline-flex items-center gap-1"
            >
              <span>Message coordinator</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-surface-500">Care Progress</span>
            <span className="font-semibold text-surface-900 tabular-nums">
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-surface-150 h-2 rounded-full overflow-hidden my-3">
            <div
              className="bg-primary-600 h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs text-surface-600 tabular-nums truncate">
            Stage {activeIndex + 1} of {CASE_PHASE_GROUPS.length}:{' '}
            {activeCase
              ? CASE_STATUS_LABELS[effectiveCaseStatus] || effectiveCaseStatus
              : CASE_PHASE_GROUPS[0].label}
          </span>
        </Card>
      </div>

      {/* ─── Treatment Roadmap ───────────────────────────────────────────── */}
      {!loadError && effectiveSteps.length > 0 ? (
        <ClinicalRoadmapTree
          steps={effectiveSteps}
          fitToFly={activeCase?.fitToFlyClearance}
          currentStatus={effectiveCaseStatus}
          issuedDocCategories={issuedDocCategories}
          unpaidBillCount={effectiveUnpaidBillCount}
          hasTreatmentPlan={Boolean(effectiveTreatmentPlan?.procedureName)}
          treatmentPlanAccepted={Boolean(effectiveTreatmentPlan?.consentAcceptedAt)}
          hasPendingFollowUp={hasPendingFollowUp}
          onOpenAction={(modal) => setRequestedModal(modal)}
        />
      ) : !loadError ? (
        <Card className="p-5 space-y-5">
          <div className="border-b border-surface-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-surface-900">Your Care Journey</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Progress across each stage from initial review through recovery and return home.
              </p>
            </div>

            {activeCase && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500">Current stage:</span>
                <Badge variant={effectiveCaseStatus === 'CLOSED' ? 'default' : 'primary'} dot>
                  {CASE_STATUS_LABELS[effectiveCaseStatus] || effectiveCaseStatus}
                </Badge>
              </div>
            )}
          </div>

          {activeCase ? (
            <div className="relative pl-6 sm:pl-0 py-2">
              <div className="hidden sm:block absolute top-6 left-[8%] right-[8%] h-px bg-surface-200 -z-10" />
              <div className="sm:hidden absolute left-3 top-4 bottom-4 w-px bg-surface-200" />

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-5 sm:gap-3">
                {CASE_PHASE_GROUPS.map((step, idx) => {
                  const isPassed = idx < activeIndex;
                  const isActive = idx === activeIndex;

                  return (
                    <div
                      key={step.key}
                      className="flex sm:flex-col sm:items-center sm:text-center gap-3 sm:gap-2 relative"
                    >
                      <div
                        className={`
                          w-7 h-7 rounded-md flex items-center justify-center shrink-0 border font-semibold text-xs tabular-nums
                          ${
                            isPassed
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : isActive
                              ? 'bg-primary-50 border-primary-600 text-primary-800'
                              : 'bg-white border-surface-300 text-surface-500'
                          }
                        `}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      <div>
                        <p
                          className={`text-xs font-medium ${
                            isActive
                              ? 'text-primary-800 font-semibold'
                              : isPassed
                              ? 'text-surface-900'
                              : 'text-surface-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-surface-500 mt-0.5 leading-snug max-w-[140px] sm:mx-auto">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeCase.notes && (
                <div className="mt-6 p-4 bg-surface-50 rounded-md border border-surface-200 flex items-start gap-3">
                  <MessageSquare
                    className="w-4 h-4 text-primary-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-medium text-surface-900">Coordinator Update</p>
                    <p className="text-xs text-surface-600 mt-0.5 leading-relaxed">
                      {activeCase.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm font-medium text-surface-800">
                Your clinical case is being prepared
              </p>
              <p className="text-xs text-surface-500 max-w-md mx-auto">
                Upload your recent medical reports or complete your medical profile so our care team
                can assign a specialist plan.
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {/* ─── Care Team (Coordinator + Hospital + Specialist) & Dynamic Next Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Assigned Care Team</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Your coordinator, partner hospital, and attending specialist.
              </p>
            </div>

            {activeCase?.manager ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 text-primary-800 border border-primary-200 rounded-full flex items-center justify-center font-semibold text-sm shrink-0">
                    {activeCase.manager.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-surface-900 truncate">
                      {activeCase.manager.fullName}
                    </h3>
                    <p className="text-xs text-surface-500">Case Coordinator</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  {activeCase.manager.phone && (
                    <a
                      href={`tel:${activeCase.manager.phone}`}
                      className="flex items-center gap-2 px-3 min-h-11 rounded-md bg-surface-50 hover:bg-surface-100 border border-surface-200 text-surface-700 font-medium transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-surface-500 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums truncate">{activeCase.manager.phone}</span>
                    </a>
                  )}
                  {activeCase.manager.email && (
                    <a
                      href={`mailto:${activeCase.manager.email}`}
                      className="flex items-center gap-2 px-3 min-h-11 rounded-md bg-surface-50 hover:bg-surface-100 border border-surface-200 text-surface-700 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-surface-500 shrink-0" aria-hidden="true" />
                      <span className="truncate">{activeCase.manager.email}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-2 text-xs text-surface-500 leading-relaxed">
                A dedicated care coordinator is being assigned to your case.
              </p>
            )}

            {/* Assigned Hospital & Primary Attending Specialist */}
            <div className="pt-3 border-t border-surface-100 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-surface-500 block">
                    Assigned Hospital
                  </span>
                  <span className="text-xs font-semibold text-surface-900 block truncate">
                    {effectiveHospital?.name || 'Evaluating hospital match'}
                  </span>
                  {effectiveHospital?.city && (
                    <span className="text-[11px] text-surface-500 block">
                      {effectiveHospital.city}
                      {effectiveHospital.accreditation
                        ? ` • ${effectiveHospital.accreditation}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-surface-500 block">
                    Attending Specialist
                  </span>
                  <span className="text-xs font-semibold text-surface-900 block truncate">
                    {effectiveDoctor
                      ? formatDoctorDisplayName(effectiveDoctor.fullName)
                      : 'Assigning specialist'}
                  </span>
                  {effectiveDoctor?.specialisation?.name && (
                    <span className="text-[11px] text-surface-500 block truncate">
                      {effectiveDoctor.specialisation.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/patient/messages"
            className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 shadow-2xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Coordinator Chat</span>
          </Link>
        </Card>

        <PatientNextActionCard
          caseId={activeCase?.id}
          caseStatus={effectiveCaseStatus}
          treatmentPlan={effectiveTreatmentPlan}
          postReturnFollowUps={effectiveFollowUps}
          documents={effectiveDocuments}
          travelLogistics={effectiveTravelLogistics}
          unpaidBillCount={effectiveUnpaidBillCount}
          hospitalName={effectiveHospital?.name}
          doctorName={
            effectiveDoctor ? formatDoctorDisplayName(effectiveDoctor.fullName) : null
          }
          externalModal={requestedModal}
          onExternalModalClose={() => setRequestedModal(null)}
          onUpdated={handleLifecycleUpdated}
        />
      </div>
    </div>
  );
}
