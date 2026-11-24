'use client';

/**
 * Afzal Healthcare — Dynamic Stage-Aware Patient Next Action Card
 * Surfaces the top 1–3 stage-gated patient actions and embeds native <Modal> dialogs
 * for Informed Treatment Plan Acceptance and Post-Return Recovery Check-Ins.
 * IMPORTANT: Imports pure helpers ONLY from `@/lib/validation/lifecycle-schemas` (never Prisma).
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, type SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { FOLLOW_UP_MILESTONE_LABELS } from '@/lib/constants';
import {
  derivePatientNextActions,
  type FollowUpMilestone,
  type PatientDocumentSummary,
  type PatientNextActionItem,
  type TravelLogisticsPayload,
  type TreatmentPlanPayload,
} from '@/lib/validation/lifecycle-schemas';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  Plane,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';

export interface PatientNextActionCardProps {
  caseId?: string | null;
  caseStatus: string;
  treatmentPlan?: TreatmentPlanPayload | null;
  postReturnFollowUps?: FollowUpMilestone[] | null;
  documents: PatientDocumentSummary[];
  travelLogistics?: TravelLogisticsPayload | null;
  unpaidBillCount: number;
  hospitalName?: string | null;
  doctorName?: string | null;
  externalModal?: 'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL' | null;
  onExternalModalClose?: () => void;
  onUpdated?: (snapshot: Record<string, unknown>) => void;
}

const WOUND_STATUS_OPTIONS: SelectOption[] = [
  {
    value: 'CLEAN_DRY',
    label: 'Clean, dry & healing well',
    description: 'No redness, swelling, or discharge around incision',
  },
  {
    value: 'MILD_SWELLING',
    label: 'Mild swelling or tenderness',
    description: 'Expected post-op soreness without fever',
  },
  {
    value: 'REDNESS_WARMTH',
    label: 'Noticeable redness or warmth',
    description: 'Requires specialist review of incision site',
  },
  {
    value: 'DRAINAGE_FEVER',
    label: 'Discharge, bleeding, or fever (Urgent)',
    description: 'Immediate coordinator and clinical team attention',
  },
  {
    value: 'NOT_APPLICABLE',
    label: 'Not applicable (non-surgical recovery)',
    description: 'Medical / oncology / conservative follow-up',
  },
];

function getActionIcon(action: PatientNextActionItem) {
  switch (action.key) {
    case 'REUPLOAD_REJECTED_DOC':
      return <AlertCircle className="w-4 h-4 text-danger-600" aria-hidden="true" />;
    case 'ACCEPT_TREATMENT_PLAN':
      return <ClipboardCheck className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'UPLOAD_DIAGNOSTICS':
    case 'UPLOAD_PASSPORT':
    case 'UPLOAD_APPROVED_VISA':
      return <UploadCloud className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'SUBMIT_FLIGHT_DETAILS':
      return <Plane className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'SETTLE_HOSPITAL_BILLS':
      return <CreditCard className="w-4 h-4 text-warning-700" aria-hidden="true" />;
    case 'COMPLETE_FOLLOW_UP_CHECKIN':
      return <HeartPulse className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    default:
      return <FileText className="w-4 h-4 text-surface-600" aria-hidden="true" />;
  }
}

export function PatientNextActionCard({
  caseId,
  caseStatus,
  treatmentPlan,
  postReturnFollowUps,
  documents,
  travelLogistics,
  unpaidBillCount,
  hospitalName,
  doctorName,
  externalModal = null,
  onExternalModalClose,
  onUpdated,
}: PatientNextActionCardProps) {
  const [internalModal, setInternalModal] = useState<
    'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL' | null
  >(null);

  // Treatment Plan Consent Modal state
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentNotes, setConsentNotes] = useState('');
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [consentError, setConsentError] = useState('');

  // Post-Return Recovery Check-In Modal state
  const [selectedMilestone, setSelectedMilestone] = useState<
    'DAY_7' | 'DAY_30' | 'DAY_90' | null
  >(null);
  const [painScore, setPainScore] = useState<number>(2);
  const [woundStatus, setWoundStatus] = useState<string>('CLEAN_DRY');
  const [recoveryNotes, setRecoveryNotes] = useState<string>('');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState('');

  const activeModal = externalModal ?? internalModal;

  const allActions = useMemo(
    () =>
      derivePatientNextActions({
        caseStatus,
        documents,
        treatmentPlan: treatmentPlan ?? null,
        travelLogistics: travelLogistics ?? null,
        unpaidBillCount,
        postReturnFollowUps: postReturnFollowUps ?? [],
      }),
    [caseStatus, documents, treatmentPlan, travelLogistics, unpaidBillCount, postReturnFollowUps]
  );

  const topActions = useMemo(() => allActions.slice(0, 3), [allActions]);

  const pendingFollowUp = useMemo(
    () => (postReturnFollowUps || []).find((m) => m.status === 'PENDING') ?? null,
    [postReturnFollowUps]
  );

  const activeMilestone: 'DAY_7' | 'DAY_30' | 'DAY_90' =
    selectedMilestone ?? pendingFollowUp?.milestone ?? 'DAY_7';

  const milestoneOptions: SelectOption[] = useMemo(
    () =>
      (['DAY_7', 'DAY_30', 'DAY_90'] as const).map((code) => {
        const record = (postReturnFollowUps || []).find((m) => m.milestone === code);
        const statusSuffix =
          record?.status === 'REVIEWED'
            ? 'Reviewed by Doctor'
            : record?.status === 'SUBMITTED'
            ? 'Submitted'
            : 'Pending Check-In';
        return {
          value: code,
          label: FOLLOW_UP_MILESTONE_LABELS[code],
          description: statusSuffix,
        };
      }),
    [postReturnFollowUps]
  );

  const closeModal = () => {
    setInternalModal(null);
    setConsentError('');
    setFollowUpError('');
    onExternalModalClose?.();
  };

  const openModal = (modalAction: 'TREATMENT_PLAN_MODAL' | 'FOLLOW_UP_MODAL') => {
    setConsentError('');
    setFollowUpError('');
    if (modalAction === 'TREATMENT_PLAN_MODAL') {
      setConsentChecked(false);
      setConsentNotes('');
    } else if (pendingFollowUp) {
      setSelectedMilestone(pendingFollowUp.milestone);
    }
    setInternalModal(modalAction);
  };

  const handleAcceptTreatmentPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;
    if (!consentChecked) {
      setConsentError('Please confirm informed consent before accepting the treatment plan.');
      return;
    }

    setConsentError('');
    setIsSubmittingConsent(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPT_TREATMENT_PLAN',
          informedConsentAccepted: true,
          patientNotes: consentNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Could not confirm treatment plan consent.';
        setConsentError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Treatment plan accepted! Your coordinator can now issue your Visa Letter.');
      onUpdated?.(json.data as Record<string, unknown>);
      closeModal();
    } catch {
      const msg = 'Network error while accepting treatment plan. Please try again.';
      setConsentError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  const handleSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;

    setFollowUpError('');
    setIsSubmittingFollowUp(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_FOLLOW_UP',
          milestone: activeMilestone,
          painScore,
          woundStatus,
          patientNotes: recoveryNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Unable to submit recovery check-in.';
        setFollowUpError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        `${FOLLOW_UP_MILESTONE_LABELS[activeMilestone]} submitted for your specialist's review.`
      );
      setRecoveryNotes('');
      onUpdated?.(json.data as Record<string, unknown>);
      closeModal();
    } catch {
      const msg = 'Network error while submitting recovery check-in. Please try again.';
      setFollowUpError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const hasCriticalAction = topActions.some((a) => a.priority === 'CRITICAL');

  return (
    <div id="treatment-plan" className="lg:col-span-2">
      <Card className="p-5 space-y-4 h-full">
        <div className="border-b border-surface-100 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-surface-900">Your Next Care Actions</h2>
            <p className="text-xs font-normal text-surface-500 mt-0.5">
              Stage-specific actions to keep your visa, hospital scheduling, and recovery on track.
            </p>
          </div>
          <Badge
            variant={
              hasCriticalAction ? 'danger' : topActions.length > 0 ? 'primary' : 'success'
            }
            dot
          >
            {topActions.length > 0 ? (
              <span className="tabular-nums">
                {topActions.length} Action{topActions.length === 1 ? '' : 's'} Needed
              </span>
            ) : (
              'Up to Date'
            )}
          </Badge>
        </div>

        {topActions.length > 0 ? (
          <div className="divide-y divide-surface-100">
            {topActions.map((action, idx) => (
              <div
                key={`${action.key}-${idx}`}
                className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${
                      action.priority === 'CRITICAL'
                        ? 'bg-danger-50 border-danger-200'
                        : action.priority === 'HIGH'
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-surface-100 border-surface-200'
                    }`}
                  >
                    {getActionIcon(action)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-surface-900">{action.title}</h3>
                      {action.priority === 'CRITICAL' && (
                        <Badge variant="danger" size="sm">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-normal text-surface-500 mt-0.5 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>

                {action.modalAction && caseId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={action.priority === 'NORMAL' ? 'secondary' : 'primary'}
                    onClick={() => openModal(action.modalAction!)}
                    className="self-start sm:self-auto shrink-0"
                  >
                    <span>{action.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                ) : action.href ? (
                  <Link
                    href={action.href}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 rounded-md border text-xs font-medium transition-colors self-start sm:self-auto shrink-0 ${
                      action.priority === 'CRITICAL'
                        ? 'bg-danger-600 hover:bg-danger-700 text-white border-danger-700/20'
                        : action.priority === 'HIGH'
                        ? 'bg-primary-600 hover:bg-primary-700 text-white border-primary-700/20'
                        : 'bg-white hover:bg-surface-100 text-surface-700 border-surface-300'
                    }`}
                  >
                    <span>{action.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-5 px-4 rounded-md bg-surface-50 border border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-success-50 text-success-700 border border-success-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-surface-900">
                  All current patient milestones are up to date
                </h3>
                <p className="text-xs font-normal text-surface-500 mt-0.5 leading-relaxed">
                  {caseStatus === 'CLOSED'
                    ? 'Your medical journey has concluded. Your documents remain safely accessible in your vault.'
                    : 'Your clinical team and case coordinator are actively reviewing the next stage of your care.'}
                </p>
              </div>
            </div>

            {treatmentPlan?.publishedAt ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openModal('TREATMENT_PLAN_MODAL')}
                className="self-start sm:self-auto shrink-0"
              >
                View Treatment Plan
              </Button>
            ) : (
              <Link
                href="/patient/profile"
                className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-md bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 text-xs font-medium transition-colors self-start sm:self-auto shrink-0"
              >
                Medical Profile
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* ─── Modal 1: Review & Accept Treatment Plan & All-In Estimate ─────── */}
      <Modal
        open={activeModal === 'TREATMENT_PLAN_MODAL'}
        onClose={closeModal}
        title="Hospital Treatment Plan & Cost Estimate"
        subtitle="Review your clinical diagnosis, expected stay, and all-in estimate prior to Visa Letter issuance."
        icon={<ShieldCheck className="w-5 h-5" />}
        maxWidthClass="max-w-xl"
      >
        {treatmentPlan ? (
          <form onSubmit={handleAcceptTreatmentPlan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-surface-50 border border-surface-200 text-xs">
              <div>
                <span className="font-medium text-surface-500 block">Partner Hospital</span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {hospitalName || 'Assigned Partner Hospital'}
                </span>
              </div>
              <div>
                <span className="font-medium text-surface-500 block">Attending Specialist</span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {doctorName || 'Assigned Specialist Physician'}
                </span>
              </div>
              <div>
                <span className="font-medium text-surface-500 block">Clinical Diagnosis</span>
                <span className="font-medium text-surface-900 mt-0.5 block">
                  {treatmentPlan.diagnosis}
                </span>
              </div>
              <div>
                <span className="font-medium text-surface-500 block">Proposed Procedure</span>
                <span className="font-medium text-surface-900 mt-0.5 block">
                  {treatmentPlan.procedureName}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-surface-200 bg-white">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Hospital Stay
                </span>
                <span className="text-base font-semibold text-surface-900 tabular-nums mt-0.5 block">
                  {treatmentPlan.hospitalLosDays} nights
                </span>
              </div>
              <div className="p-3 rounded-lg border border-surface-200 bg-white">
                <span className="text-[11px] font-medium text-surface-500 block">
                  Hotel / Recovery Stay
                </span>
                <span className="text-base font-semibold text-surface-900 tabular-nums mt-0.5 block">
                  {treatmentPlan.recoveryStayDays} nights
                </span>
              </div>
              <div className="p-3 rounded-lg border border-primary-200 bg-primary-50/60">
                <span className="text-[11px] font-medium text-primary-800 block">
                  All-In Estimate
                </span>
                <span className="text-base font-semibold text-primary-900 tabular-nums mt-0.5 block">
                  {treatmentPlan.currency || 'USD'}{' '}
                  {Number(treatmentPlan.estimatedCostUsd || 0).toLocaleString()}
                </span>
                {typeof treatmentPlan.depositRequiredUsd === 'number' &&
                  treatmentPlan.depositRequiredUsd > 0 && (
                    <span className="text-[11px] font-normal text-primary-700 tabular-nums block mt-0.5">
                      Booking deposit: {treatmentPlan.currency || 'USD'}{' '}
                      {treatmentPlan.depositRequiredUsd.toLocaleString()}
                    </span>
                  )}
              </div>
            </div>

            {((treatmentPlan.inclusions && treatmentPlan.inclusions.length > 0) ||
              (treatmentPlan.exclusions && treatmentPlan.exclusions.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {treatmentPlan.inclusions && treatmentPlan.inclusions.length > 0 && (
                  <div className="p-3 rounded-lg border border-surface-200 bg-white space-y-1.5">
                    <p className="font-medium text-surface-900">Package Inclusions</p>
                    <ul className="list-disc pl-4 space-y-1 text-surface-600 font-normal">
                      {treatmentPlan.inclusions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {treatmentPlan.exclusions && treatmentPlan.exclusions.length > 0 && (
                  <div className="p-3 rounded-lg border border-surface-200 bg-white space-y-1.5">
                    <p className="font-medium text-surface-900">Exclusions</p>
                    <ul className="list-disc pl-4 space-y-1 text-surface-600 font-normal">
                      {treatmentPlan.exclusions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {treatmentPlan.doctorOpinionNotes && (
              <div className="p-3 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-700">
                <span className="font-medium text-surface-900 block mb-0.5">
                  Specialist Clinical Notes
                </span>
                <p className="font-normal leading-relaxed">{treatmentPlan.doctorOpinionNotes}</p>
              </div>
            )}

            {treatmentPlan.consentAcceptedAt ? (
              <div className="p-3.5 rounded-md bg-success-50 border border-success-200 text-xs text-success-900 flex items-start gap-2.5">
                <CheckCircle2
                  className="w-4 h-4 text-success-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">Informed Consent Confirmed</p>
                  <p className="font-normal text-success-800 mt-0.5 tabular-nums">
                    Accepted on{' '}
                    {new Date(treatmentPlan.consentAcceptedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    . Your case coordinator can now issue your Hospital Visa Invitation Letter.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {consentError && (
                  <div
                    role="alert"
                    className="p-3 rounded-md bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                    <span>{consentError}</span>
                  </div>
                )}

                <label className="flex items-start gap-3 p-3 min-h-11 rounded-md border border-surface-300 bg-white hover:bg-surface-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => {
                      setConsentChecked(e.target.checked);
                      if (consentError) setConsentError('');
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-600"
                  />
                  <span className="text-xs font-normal text-surface-700 leading-relaxed">
                    I have reviewed the clinical diagnosis, proposed procedure, expected hospital
                    and recovery stay durations, and all-in estimate, and I provide informed
                    pre-travel consent to proceed.
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label
                    htmlFor="consent-patient-notes"
                    className="block text-xs font-medium text-surface-700"
                  >
                    Questions or scheduling preferences (optional)
                  </label>
                  <textarea
                    id="consent-patient-notes"
                    rows={2}
                    placeholder="Preferred travel dates, dietary requirements, or questions for your doctor..."
                    value={consentNotes}
                    onChange={(e) => setConsentNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-surface-300 hover:border-surface-400 rounded-md text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 transition-colors"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-surface-100">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Close
              </Button>
              {!treatmentPlan.consentAcceptedAt && (
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingConsent}
                  disabled={!consentChecked}
                >
                  Accept Treatment Plan
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs text-surface-600">
            <p>
              Your assigned specialist has not published a structured treatment plan yet. Your case
              coordinator will notify you as soon as it is ready.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal 2: Post-Return Recovery Check-In (Day 7 / 30 / 90) ──────── */}
      <Modal
        open={activeModal === 'FOLLOW_UP_MODAL'}
        onClose={closeModal}
        title="Post-Return Recovery Check-In"
        subtitle="Share your recovery progress with your treating specialist after returning home."
        icon={<HeartPulse className="w-5 h-5" />}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmitFollowUp} className="space-y-4">
          {followUpError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
              <span>{followUpError}</span>
            </div>
          )}

          <Select
            label="Recovery Milestone"
            options={milestoneOptions}
            value={activeMilestone}
            onChange={(val) => setSelectedMilestone(val as 'DAY_7' | 'DAY_30' | 'DAY_90')}
            required
          />

          <div className="space-y-2 p-3.5 rounded-lg border border-surface-200 bg-surface-50">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="recovery-pain-scale" className="font-medium text-surface-700">
                Current Pain Level (0 = None, 10 = Severe)
              </label>
              <span className="px-2 py-0.5 rounded-md bg-white border border-surface-200 font-semibold text-surface-900 tabular-nums">
                {painScore} / 10
              </span>
            </div>
            <input
              id="recovery-pain-scale"
              type="range"
              min={0}
              max={10}
              step={1}
              value={painScore}
              onChange={(e) => setPainScore(Number(e.target.value))}
              className="w-full accent-primary-600 min-h-11 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-surface-500 tabular-nums">
              <span>0 (No pain)</span>
              <span>5 (Moderate)</span>
              <span>10 (Severe)</span>
            </div>
          </div>

          <Select
            label="Surgical Site / Wound Healing Status"
            options={WOUND_STATUS_OPTIONS}
            value={woundStatus}
            onChange={setWoundStatus}
            required
          />

          <div className="space-y-1.5">
            <label
              htmlFor="recovery-patient-notes"
              className="block text-xs font-medium text-surface-700"
            >
              Recovery Notes &amp; Mobility Update
            </label>
            <textarea
              id="recovery-patient-notes"
              rows={3}
              placeholder="Describe how you are feeling, mobility progress, appetite, medications, or any questions for your specialist..."
              value={recoveryNotes}
              onChange={(e) => setRecoveryNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-surface-300 hover:border-surface-400 rounded-md text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 transition-colors"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-surface-100">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingFollowUp}>
              Submit Recovery Check-In
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
