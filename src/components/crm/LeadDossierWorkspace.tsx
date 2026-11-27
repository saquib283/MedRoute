'use client';

/**
 * Afzal Healthcare — Omnichannel Lead Dossier Workspace
 * Displays scoring breakdown, live SLA badge, duplicate patient/lead banner,
 * WhatsApp deep-link, activity quick-log & follow-up checklist, right-rail triage/quote editor,
 * and 1-click Patient & Case conversion modal.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  LEAD_LOST_REASON_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  MVT_SPECIALTY_OPTIONS,
} from '@/lib/constants';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import {
  LEAD_LOST_REASONS,
  LEAD_STATUSES,
  LEAD_URGENCY_LEVELS,
  PREFERRED_TRAVEL_WINDOWS,
  buildWhatsAppFollowUpUrl,
  validateLeadStatusTransition,
} from '@/lib/validation/leads-crm-schemas';
import { ConvertLeadModal } from './ConvertLeadModal';
import {
  ACTIVITY_TYPE_LABELS,
  LeadSlaBadge,
  LeadStatusBadge,
  LeadTemperatureBadge,
  TRAVEL_WINDOW_LABELS,
  formatCurrencyUsd,
  formatDateTimeShort,
  toDateTimeLocalInput,
  type CoordinatorOption,
  type DoctorDirectoryItem,
  type DuplicateMatchItem,
  type HospitalDirectoryItem,
  type LeadRecord,
  type ReferralPartnerOption,
} from './crm-helpers';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';

export interface LeadDossierWorkspaceProps {
  leadId: string;
  role: 'MANAGER' | 'ADMIN';
  backHref: string;
}

type HydrateScope = 'ALL' | 'NONE';

type RightRailField =
  | 'status'
  | 'targetHospitalId'
  | 'targetDoctorId'
  | 'specialtyInterest'
  | 'urgencyLevel'
  | 'preferredTravelWindow'
  | 'preliminaryQuoteUsd'
  | 'preliminaryQuoteNotes'
  | 'referralPartnerId'
  | 'assignedManagerId'
  | 'hasDiagnosticReports'
  | 'passportReady'
  | 'nextFollowUpAt'
  | 'lostReason'
  | 'lostNotes';

const COMPOSER_TYPES = [
  { value: 'WHATSAPP', label: 'WhatsApp', Icon: MessageCircle },
  { value: 'PHONE_CALL', label: 'Phone Call', Icon: Phone },
  { value: 'EMAIL', label: 'Email', Icon: Mail },
  { value: 'QUOTE_ESTIMATE', label: 'Quote Estimate', Icon: Receipt },
  { value: 'FOLLOW_UP_SCHEDULED', label: 'Follow-Up', Icon: CalendarClock },
  { value: 'NOTE', label: 'Note', Icon: FileText },
] as const;

const QUICK_SUMMARY_TEMPLATES: Record<string, string[]> = {
  WHATSAPP: [
    'Sent WhatsApp intro and requested recent diagnostic reports',
    'Shared hospital estimate & visa checklist on WhatsApp',
  ],
  PHONE_CALL: [
    'Spoke with patient/family to confirm clinical timeline',
    'No answer on initial call — left WhatsApp follow-up message',
  ],
  EMAIL: [
    'Emailed preliminary treatment quote and doctor profile',
    'Requested DICOM/pathology reports via email',
  ],
  QUOTE_ESTIMATE: ['Shared preliminary USD surgical package estimate'],
  FOLLOW_UP_SCHEDULED: ['Follow up on diagnostic report upload'],
  NOTE: ['Reviewed clinical history with medical triage desk'],
};

export function LeadDossierWorkspace({ leadId, role, backHref }: LeadDossierWorkspaceProps) {
  const basePath = role === 'ADMIN' ? '/admin/leads' : '/manager/leads';
  const caseBasePath = role === 'ADMIN' ? '/admin/cases' : '/manager/cases';

  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatchItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalDirectoryItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorDirectoryItem[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorOption[]>([]);
  const [partners, setPartners] = useState<ReferralPartnerOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  // Right-rail triage & quote form state (per-field dirty tracking across activity refreshes)
  const dirtyFieldsRef = useRef<Set<RightRailField>>(new Set());
  const [dirtyCount, setDirtyCount] = useState(0);
  const [targetStatus, setTargetStatus] = useState('NEW');
  const [targetHospitalId, setTargetHospitalId] = useState('');
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [specialtyInterest, setSpecialtyInterest] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('ROUTINE');
  const [preferredTravelWindow, setPreferredTravelWindow] = useState('');
  const [preliminaryQuoteUsd, setPreliminaryQuoteUsd] = useState('');
  const [preliminaryQuoteNotes, setPreliminaryQuoteNotes] = useState('');
  const [referralPartnerId, setReferralPartnerId] = useState('');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [hasDiagnosticReports, setHasDiagnosticReports] = useState(false);
  const [passportReady, setPassportReady] = useState(false);
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [lostNotes, setLostNotes] = useState('');

  // Composer state
  const [activityType, setActivityType] = useState<string>('WHATSAPP');
  const [activitySummary, setActivitySummary] = useState('');
  const [activityDueAt, setActivityDueAt] = useState('');
  const [markResponded, setMarkResponded] = useState(false);

  // Action busy flags
  const [claiming, setClaiming] = useState(false);
  const [savingTriage, setSavingTriage] = useState(false);
  const [loggingActivity, setLoggingActivity] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Convert Modal state
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertInitialMode, setConvertInitialMode] = useState<'NEW_PATIENT' | 'EXISTING_PATIENT'>(
    'NEW_PATIENT'
  );
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | undefined>(undefined);

  const hydrateRightRail = useCallback((loaded: LeadRecord, forceAll: boolean) => {
    const dirty = dirtyFieldsRef.current;
    const shouldSync = (field: RightRailField) => forceAll || !dirty.has(field);

    if (shouldSync('status')) setTargetStatus(loaded.status);
    if (shouldSync('targetHospitalId')) setTargetHospitalId(loaded.targetHospitalId || '');
    if (shouldSync('targetDoctorId')) setTargetDoctorId(loaded.targetDoctorId || '');
    if (shouldSync('specialtyInterest')) setSpecialtyInterest(loaded.specialtyInterest || '');
    if (shouldSync('urgencyLevel')) setUrgencyLevel(loaded.urgencyLevel || 'ROUTINE');
    if (shouldSync('preferredTravelWindow')) {
      setPreferredTravelWindow(loaded.preferredTravelWindow || '');
    }
    if (shouldSync('preliminaryQuoteUsd')) {
      setPreliminaryQuoteUsd(
        loaded.preliminaryQuoteUsd !== null && loaded.preliminaryQuoteUsd !== undefined
          ? String(loaded.preliminaryQuoteUsd)
          : ''
      );
    }
    if (shouldSync('preliminaryQuoteNotes')) {
      setPreliminaryQuoteNotes(loaded.preliminaryQuoteNotes || '');
    }
    if (shouldSync('referralPartnerId')) setReferralPartnerId(loaded.referralPartnerId || '');
    if (shouldSync('assignedManagerId')) setAssignedManagerId(loaded.assignedManagerId || '');
    if (shouldSync('hasDiagnosticReports')) {
      setHasDiagnosticReports(Boolean(loaded.hasDiagnosticReports));
    }
    if (shouldSync('passportReady')) setPassportReady(Boolean(loaded.passportReady));
    if (shouldSync('nextFollowUpAt')) {
      setNextFollowUpAt(toDateTimeLocalInput(loaded.nextFollowUpAt));
    }
    if (shouldSync('lostReason')) setLostReason(loaded.lostReason || '');
    if (shouldSync('lostNotes')) setLostNotes(loaded.lostNotes || '');

    if (forceAll) {
      dirtyFieldsRef.current.clear();
      setDirtyCount(0);
    }
  }, []);

  const fetchDossier = useCallback(
    async (options: { hydrateScope: HydrateScope; silent?: boolean } = { hydrateScope: 'ALL' }) => {
      if (!options.silent) setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/v1/leads/${leadId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          const msg = json?.error?.message || 'Failed to load lead dossier.';
          setLoadError(msg);
          return;
        }

        const loadedLead = json.data.lead as LeadRecord;
        setLead(loadedLead);
        setDuplicates((json.data.potentialDuplicates || []) as DuplicateMatchItem[]);
        setHospitals((json.data.availableHospitals || []) as HospitalDirectoryItem[]);
        setDoctors((json.data.availableDoctors || []) as DoctorDirectoryItem[]);
        setCoordinators((json.data.availableCoordinators || []) as CoordinatorOption[]);

        hydrateRightRail(loadedLead, options.hydrateScope === 'ALL');
      } catch {
        setLoadError('Network error loading lead dossier.');
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [leadId, hydrateRightRail]
  );

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/referral-partners?activeOnly=true');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setPartners(json.data?.partners || []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDossier({ hydrateScope: 'ALL' });
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDossier]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPartners();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPartners]);

  useEffect(() => {
    const initTimer = setTimeout(() => setNowMs(Date.now()), 0);
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  const duplicatePatients = useMemo(
    () => duplicates.filter((d) => d.kind === 'PATIENT'),
    [duplicates]
  );
  const duplicateLeads = useMemo(
    () => duplicates.filter((d) => d.kind === 'LEAD'),
    [duplicates]
  );

  const whatsappHref = useMemo(() => {
    if (!lead) return null;
    const candidate =
      lead.whatsappUrl ||
      buildWhatsAppFollowUpUrl({
        phone: lead.whatsappNumber || lead.phone,
        fullName: lead.fullName,
        referenceNo: lead.referenceNo,
        coordinatorName: lead.assignedManager?.fullName,
        specialty: lead.specialtyInterest,
      });
    if (candidate && candidate.startsWith('https://wa.me/')) {
      return candidate;
    }
    return null;
  }, [lead]);

  const filteredDoctors = useMemo(() => {
    if (!targetHospitalId) return doctors;
    return doctors.filter((d) => d.hospitalId === targetHospitalId);
  }, [doctors, targetHospitalId]);

  const hospitalOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Unassigned Hospital' },
      ...hospitals.map((h) => ({
        value: h.id,
        label: h.name,
        description: [h.city, h.accreditation].filter(Boolean).join(' · ') || undefined,
      })),
    ],
    [hospitals]
  );

  const doctorOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Unassigned Specialist' },
      ...filteredDoctors.map((d) => ({
        value: d.id,
        label: formatDoctorDisplayName(d.fullName),
        description: [d.specialisation?.name, d.qualification].filter(Boolean).join(' · ') || undefined,
      })),
    ],
    [filteredDoctors]
  );

  const partnerOptions: SelectOption[] = useMemo(() => {
    const options: SelectOption[] = partners.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.code})`,
    }));

    const assignedPartner = lead?.referralPartner;
    if (assignedPartner && !partners.some((p) => p.id === assignedPartner.id)) {
      options.unshift({
        value: assignedPartner.id,
        label: `${assignedPartner.name} (${assignedPartner.code} — Inactive)`,
      });
    }

    return [{ value: '', label: 'Direct / No Partner' }, ...options];
  }, [partners, lead?.referralPartner]);

  const statusOptions: SelectOption[] = useMemo(
    () =>
      LEAD_STATUSES.filter((s) => s !== 'CONVERTED' || lead?.status === 'CONVERTED').map((s) => ({
        value: s,
        label: LEAD_STATUS_LABELS[s] || s,
      })),
    [lead?.status]
  );

  const transitionGuard = useMemo(() => {
    if (!lead || targetStatus === lead.status) return { allowed: true as const };
    const parsedQuote = preliminaryQuoteUsd.trim() ? Number(preliminaryQuoteUsd) : null;
    return validateLeadStatusTransition({
      currentStatus: lead.status,
      nextStatus: targetStatus,
      lostReason: lostReason || null,
      preliminaryQuoteUsd: parsedQuote !== null && Number.isFinite(parsedQuote) ? parsedQuote : null,
      targetHospitalId: targetHospitalId || null,
    });
  }, [lead, targetStatus, lostReason, preliminaryQuoteUsd, targetHospitalId]);

  const handleClaim = async () => {
    if (!lead) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLAIM' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Unable to claim lead.');
        return;
      }
      toast.success('Lead claimed into your pipeline.');
      await fetchDossier({ hydrateScope: 'NONE', silent: true });
    } catch (err) {
      toast.apiError(err, 'Network error claiming lead.');
    } finally {
      setClaiming(false);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (activitySummary.trim().length < 2) {
      toast.error('Please enter an activity summary (at least 2 characters).');
      return;
    }

    setLoggingActivity(true);
    try {
      const dueIso = activityDueAt ? new Date(activityDueAt).toISOString() : null;
      const res = await fetch(`/api/v1/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType,
          summary: activitySummary.trim(),
          ...(dueIso ? { dueAt: dueIso, nextFollowUpAt: dueIso } : {}),
          ...(markResponded ? { markResponded: true } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to log touchpoint.');
        return;
      }

      toast.success('Activity logged to timeline.');
      setActivitySummary('');
      setActivityDueAt('');
      setMarkResponded(false);
      await fetchDossier({ hydrateScope: 'NONE', silent: true });
    } catch (err) {
      toast.apiError(err, 'Network error logging activity.');
    } finally {
      setLoggingActivity(false);
    }
  };

  const handleCompleteFollowUp = async (activityId: string) => {
    if (!lead) return;
    setCompletingId(activityId);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to complete follow-up.');
        return;
      }
      toast.success('Follow-up task marked completed.');
      await fetchDossier({ hydrateScope: 'NONE', silent: true });
    } catch (err) {
      toast.apiError(err, 'Network error completing follow-up.');
    } finally {
      setCompletingId(null);
    }
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!transitionGuard.allowed) {
      toast.error(transitionGuard.reason, 'Stage Guardrail');
      return;
    }

    const dirty = dirtyFieldsRef.current;
    if (dirty.size === 0) {
      toast.info('No unsaved changes');
      return;
    }

    const payload: Record<string, unknown> = {};
    if (dirty.has('status')) payload.status = targetStatus;
    if (dirty.has('targetHospitalId')) payload.targetHospitalId = targetHospitalId || null;
    if (dirty.has('targetDoctorId')) payload.targetDoctorId = targetDoctorId || null;
    if (dirty.has('specialtyInterest')) payload.specialtyInterest = specialtyInterest || null;
    if (dirty.has('urgencyLevel')) payload.urgencyLevel = urgencyLevel;
    if (dirty.has('preferredTravelWindow')) {
      payload.preferredTravelWindow = preferredTravelWindow || null;
    }
    if (dirty.has('preliminaryQuoteUsd')) {
      payload.preliminaryQuoteUsd = preliminaryQuoteUsd.trim() ? Number(preliminaryQuoteUsd) : null;
    }
    if (dirty.has('preliminaryQuoteNotes')) {
      payload.preliminaryQuoteNotes = preliminaryQuoteNotes.trim() || null;
    }
    if (dirty.has('referralPartnerId')) payload.referralPartnerId = referralPartnerId || null;
    if (role === 'ADMIN' && dirty.has('assignedManagerId')) {
      payload.assignedManagerId = assignedManagerId || null;
    }
    if (dirty.has('hasDiagnosticReports')) payload.hasDiagnosticReports = hasDiagnosticReports;
    if (dirty.has('passportReady')) payload.passportReady = passportReady;
    if (dirty.has('nextFollowUpAt')) {
      payload.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null;
    }
    if (dirty.has('lostReason') || (dirty.has('status') && targetStatus === 'LOST')) {
      payload.lostReason = targetStatus === 'LOST' ? lostReason || null : null;
    }
    if (dirty.has('lostNotes') || (dirty.has('status') && targetStatus === 'LOST')) {
      payload.lostNotes = targetStatus === 'LOST' ? lostNotes.trim() || null : null;
    }

    if (Object.keys(payload).length === 0) {
      toast.info('No unsaved changes');
      return;
    }

    setSavingTriage(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to save lead triage & quote.');
        return;
      }

      dirtyFieldsRef.current.clear();
      setDirtyCount(0);
      toast.success('Lead triage, quote, and stage saved.', 'Dossier Updated');
      await fetchDossier({ hydrateScope: 'ALL', silent: true });
    } catch (err) {
      toast.apiError(err, 'Network error saving lead.');
    } finally {
      setSavingTriage(false);
    }
  };

  const markFieldDirty = (field: RightRailField) => {
    if (!dirtyFieldsRef.current.has(field)) {
      dirtyFieldsRef.current.add(field);
      setDirtyCount(dirtyFieldsRef.current.size);
    }
  };

  if (loading) {
    return (
      <Card className="py-20 text-center">
        <div className="inline-flex items-center gap-2.5 text-xs text-surface-500">
          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading lead dossier...</span>
        </div>
      </Card>
    );
  }

  if (loadError || !lead) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-sm font-medium text-danger-700">{loadError || 'Lead not found.'}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-md bg-white border border-surface-300 text-xs font-medium text-surface-700 hover:bg-surface-50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Leads Pipeline</span>
        </Link>
      </Card>
    );
  }

  const isLockedConverted = lead.status === 'CONVERTED';

  return (
    <div className="space-y-6">
      {/* ─── Dossier Header ─────────────────────────────────────────── */}
      <div className="pb-5 border-b border-surface-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 min-h-11 px-2.5 -ml-2.5 rounded-md text-xs font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Pipeline</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {!lead.assignedManagerId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={claiming}
                onClick={() => void handleClaim()}
              >
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                <span>Claim Lead</span>
              </Button>
            )}

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-11 px-3.5 rounded-md bg-success-600 hover:bg-success-700 text-white text-xs font-medium border border-success-700/20 shadow-2xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Open WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}

            {isLockedConverted && lead.convertedCaseId ? (
              <Link
                href={`${caseBasePath}/${lead.convertedCaseId}`}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 shadow-2xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>View Converted Case</span>
              </Link>
            ) : (
              lead.status !== 'LOST' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setConvertInitialMode('NEW_PATIENT');
                    setPreselectedPatientId(undefined);
                    setConvertModalOpen(true);
                  }}
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Convert to Patient &amp; Case</span>
                </Button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200 font-mono text-xs text-surface-700">
                {lead.referenceNo}
              </span>
              <LeadStatusBadge status={lead.status} />
              <LeadTemperatureBadge temperature={lead.temperature} score={lead.leadScore} />
              <LeadSlaBadge
                firstResponseDueAt={lead.firstResponseDueAt}
                firstRespondedAt={lead.firstRespondedAt}
                status={lead.status}
                slaState={lead.slaState}
                nowMs={nowMs}
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 mt-2">
              {lead.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-surface-500 mt-0.5">
              {lead.nationality}
              {lead.countryOfResidence ? ` (Resides in ${lead.countryOfResidence})` : ''}
              {lead.preferredLanguage ? ` · Language: ${lead.preferredLanguage}` : ''}
              {lead.assignedManager ? ` · Coordinator: ${lead.assignedManager.fullName}` : ' · Unassigned Pool'}
            </p>
          </div>

          {lead.scoreBreakdown && lead.scoreBreakdown.length > 0 && (
            <button
              type="button"
              onClick={() => setShowScoreBreakdown((prev) => !prev)}
              className="self-start inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md bg-white border border-surface-200 hover:border-surface-300 text-xs font-medium text-surface-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{showScoreBreakdown ? 'Hide Score Breakdown' : 'Score Breakdown'}</span>
            </button>
          )}
        </div>

        {showScoreBreakdown && lead.scoreBreakdown && (
          <Card padding="sm" className="bg-surface-50">
            <p className="text-xs font-semibold text-surface-800 mb-2">
              Deterministic Lead Score Factors ({lead.leadScore}/100)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.scoreBreakdown.map((item) => (
                <Badge key={item} variant="default" size="sm">
                  {item}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ─── Duplicate Detection Banner ─────────────────────────────── */}
      {(duplicatePatients.length > 0 || duplicateLeads.length > 0) && (
        <Card className="border-warning-300 bg-warning-50/40 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-warning-900">
                Potential Duplicate Records Found
              </h2>
              <p className="text-xs text-warning-800 mt-0.5">
                Matching email or last-9 phone digits detected. Review before creating a duplicate patient account.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {duplicatePatients.map((pat) => (
              <div
                key={`pat-${pat.id}`}
                className="p-3 rounded-md bg-white border border-warning-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">
                      Existing Patient
                    </Badge>
                    <span className="font-semibold text-surface-900">{pat.fullName}</span>
                    <span className="text-surface-500">({pat.status})</span>
                  </div>
                  <p className="text-surface-600 mt-1">
                    {[pat.maskedEmail, pat.maskedPhone].filter(Boolean).join(' · ')} · Matched by{' '}
                    {pat.matchedBy.join(' & ')}
                  </p>
                </div>

                {!isLockedConverted && lead.status !== 'LOST' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setConvertInitialMode('EXISTING_PATIENT');
                      setPreselectedPatientId(pat.id);
                      setConvertModalOpen(true);
                    }}
                  >
                    Convert Under Existing Patient
                  </Button>
                )}
              </div>
            ))}

            {duplicateLeads.map((dupLead) => (
              <div
                key={`lead-${dupLead.id}`}
                className="p-3 rounded-md bg-white border border-warning-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" size="sm">
                      Related Lead
                    </Badge>
                    <span className="font-mono text-surface-600">{dupLead.referenceNo}</span>
                    <span className="font-semibold text-surface-900">{dupLead.fullName}</span>
                    <span className="text-surface-500">({dupLead.status})</span>
                  </div>
                  <p className="text-surface-600 mt-1">
                    {[dupLead.maskedEmail, dupLead.maskedPhone].filter(Boolean).join(' · ')} · Matched
                    by {dupLead.matchedBy.join(' & ')}
                  </p>
                </div>

                <Link
                  href={`${basePath}/${dupLead.id}`}
                  className="inline-flex items-center justify-center min-h-11 px-3 rounded-md bg-white border border-surface-300 hover:bg-surface-50 text-xs font-medium text-surface-700 shrink-0"
                >
                  Open Lead
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Main 2/3 + 1/3 Dossier Grid ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Intake Summary + Composer + Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Clinical Summary */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-200">
              <h2 className="text-base font-semibold text-surface-900">
                Patient Inquiry &amp; Intake Profile
              </h2>
              <div className="flex items-center gap-1.5">
                <Badge variant="default" size="sm">
                  {LEAD_SOURCE_LABELS[lead.source] || lead.source}
                </Badge>
                {lead.referralPartner && (
                  <Badge variant="primary" size="sm">
                    {lead.referralPartner.name} ({lead.referralPartner.code})
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-surface-500 font-medium">Email</p>
                <p className="text-surface-900 mt-0.5 break-all">{lead.email || '—'}</p>
              </div>
              <div>
                <p className="text-surface-500 font-medium">Phone</p>
                <p className="text-surface-900 mt-0.5 tabular-nums">{lead.phone || '—'}</p>
              </div>
              <div>
                <p className="text-surface-500 font-medium">WhatsApp</p>
                <p className="text-surface-900 mt-0.5 tabular-nums">
                  {lead.whatsappNumber || lead.phone || '—'}
                </p>
              </div>
              <div>
                <p className="text-surface-500 font-medium">Declared Budget</p>
                <p className="text-surface-900 mt-0.5 tabular-nums">
                  {formatCurrencyUsd(lead.estimatedBudgetUsd)}
                </p>
              </div>
              <div>
                <p className="text-surface-500 font-medium">Preliminary Quote</p>
                <p className="text-primary-800 font-medium mt-0.5 tabular-nums">
                  {formatCurrencyUsd(lead.preliminaryQuoteUsd)}
                </p>
              </div>
              <div>
                <p className="text-surface-500 font-medium">Created</p>
                <p className="text-surface-900 mt-0.5 tabular-nums">
                  {formatDateTimeShort(lead.createdAt)}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 space-y-2">
              <p className="text-xs font-medium text-surface-500">Medical Condition Summary</p>
              <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">
                {lead.medicalCondition}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={lead.hasDiagnosticReports ? 'success' : 'default'} size="sm">
                  {lead.hasDiagnosticReports ? 'Diagnostics Ready' : 'Diagnostics Pending'}
                </Badge>
                <Badge variant={lead.passportReady ? 'success' : 'default'} size="sm">
                  {lead.passportReady ? 'Passport Ready' : 'Passport Pending'}
                </Badge>
                {lead.preferredTravelWindow && (
                  <Badge variant="info" size="sm">
                    {TRAVEL_WINDOW_LABELS[lead.preferredTravelWindow] || lead.preferredTravelWindow}
                  </Badge>
                )}
              </div>
            </div>

            {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
              <p className="text-[11px] text-surface-500">
                Attribution UTM:{' '}
                {[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ')}
              </p>
            )}
          </Card>

          {/* Omnichannel Quick-Log Composer */}
          <Card className="space-y-4">
            <div className="pb-3 border-b border-surface-200">
              <h2 className="text-base font-semibold text-surface-900">
                Log Omnichannel Touchpoint
              </h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Outbound WhatsApp, calls, emails, or quotes automatically stamp first-response SLA and advance NEW inquiries to CONTACTED.
              </p>
            </div>

            <form onSubmit={handleLogActivity} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMPOSER_TYPES.map((item) => {
                  const Icon = item.Icon;
                  const active = activityType === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActivityType(item.value)}
                      className={`min-h-11 px-3 rounded-md border text-xs font-medium flex items-center gap-2 transition-colors ${
                        active
                          ? 'bg-primary-50 border-primary-300 text-primary-900'
                          : 'bg-white border-surface-200 text-surface-700 hover:bg-surface-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {(QUICK_SUMMARY_TEMPLATES[activityType] || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(QUICK_SUMMARY_TEMPLATES[activityType] || []).map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setActivitySummary(tpl)}
                      className="inline-flex items-center min-h-11 px-2.5 py-1 rounded-md bg-surface-100 hover:bg-surface-200 text-[11px] font-medium text-surface-700 transition-colors"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              )}

              <Input
                label="Touchpoint Summary"
                required
                value={activitySummary}
                onChange={(e) => setActivitySummary(e.target.value)}
                placeholder="Summarize call outcome, WhatsApp discussion, or follow-up action..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <Input
                  label={
                    activityType === 'FOLLOW_UP_SCHEDULED'
                      ? 'Follow-Up Due Date & Time'
                      : 'Schedule Next Follow-Up (Optional)'
                  }
                  type="datetime-local"
                  value={activityDueAt}
                  onChange={(e) => setActivityDueAt(e.target.value)}
                />

                {(activityType === 'NOTE' || activityType === 'FOLLOW_UP_SCHEDULED') &&
                !lead.firstRespondedAt ? (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-surface-700 min-h-11 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markResponded}
                      onChange={(e) => setMarkResponded(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary-600"
                    />
                    <span>Also mark SLA first response completed</span>
                  </label>
                ) : (
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={loggingActivity} className="w-full sm:w-auto">
                      Log Touchpoint
                    </Button>
                  </div>
                )}
              </div>

              {(activityType === 'NOTE' || activityType === 'FOLLOW_UP_SCHEDULED') &&
                !lead.firstRespondedAt && (
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={loggingActivity}>
                      Log Touchpoint
                    </Button>
                  </div>
                )}
            </form>
          </Card>

          {/* Activity & Follow-Up Checklist Timeline */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-200">
              <h2 className="text-base font-semibold text-surface-900">
                Activity &amp; Follow-Up Timeline
              </h2>
              <Badge variant="default" className="tabular-nums">
                {(lead.activities || []).length} events
              </Badge>
            </div>

            {!lead.activities || lead.activities.length === 0 ? (
              <p className="text-xs text-surface-500 py-6 text-center">
                No activities recorded yet. Log the first outreach touchpoint above.
              </p>
            ) : (
              <div className="space-y-3">
                {lead.activities.map((act) => {
                  const hasFollowUpTask = Boolean(act.dueAt);
                  const isCompleted = Boolean(act.completedAt);

                  return (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-lg border border-surface-200 bg-white space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              act.activityType === 'CONVERSION'
                                ? 'success'
                                : act.activityType === 'FOLLOW_UP_SCHEDULED'
                                ? 'warning'
                                : 'primary'
                            }
                            size="sm"
                          >
                            {ACTIVITY_TYPE_LABELS[act.activityType] || act.activityType}
                          </Badge>
                          <span className="text-xs font-medium text-surface-700">
                            {act.actor?.fullName || 'System'}
                          </span>
                        </div>
                        <span className="text-[11px] text-surface-500 tabular-nums">
                          {formatDateTimeShort(act.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-surface-900">{act.summary}</p>

                      {hasFollowUpTask && (
                        <div className="pt-2 border-t border-surface-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-surface-600 tabular-nums">
                            Due: {formatDateTimeShort(act.dueAt)}
                            {isCompleted && act.completedAt
                              ? ` · Completed ${formatDateTimeShort(act.completedAt)}`
                              : ''}
                          </span>
                          {isCompleted ? (
                            <Badge variant="success" size="sm">
                              Completed
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              isLoading={completingId === act.id}
                              onClick={() => void handleCompleteFollowUp(act.id)}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Rail: Clinical Triage, Preliminary Quote & Stage Editor */}
        <div className="lg:col-span-1 space-y-5">
          <Card className="space-y-4">
            <div className="pb-3 border-b border-surface-200">
              <h2 className="text-base font-semibold text-surface-900">
                Triage, Quote &amp; Pipeline Stage
              </h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Assign hospital/doctor targets, prepare preliminary quotes, and manage stage guardrails.
              </p>
            </div>

            {isLockedConverted && (
              <div className="p-3 rounded-md bg-success-50 border border-success-200 text-xs text-success-900">
                This lead has been converted to an active Patient &amp; Case and is locked from pre-conversion pipeline moves.
              </div>
            )}

            <form onSubmit={handleSaveTriage} className="space-y-3.5">
              <Select
                label="Pipeline Stage"
                value={targetStatus}
                onChange={(val) => {
                  markFieldDirty('status');
                  setTargetStatus(val);
                }}
                options={statusOptions}
                disabled={isLockedConverted}
              />

              {targetStatus === 'LOST' && (
                <div className="p-3 rounded-md bg-danger-50/50 border border-danger-200 space-y-3">
                  <Select
                    label="Lost Reason"
                    required
                    value={lostReason}
                    onChange={(val) => {
                      markFieldDirty('lostReason');
                      setLostReason(val);
                    }}
                    options={[
                      { value: '', label: 'Select reason...' },
                      ...LEAD_LOST_REASONS.map((r) => ({
                        value: r,
                        label: LEAD_LOST_REASON_LABELS[r] || r,
                      })),
                    ]}
                    disabled={isLockedConverted}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="lost-notes"
                      className="block text-xs font-medium text-surface-700"
                    >
                      Lost Notes (Optional)
                    </label>
                    <textarea
                      id="lost-notes"
                      rows={2}
                      value={lostNotes}
                      onChange={(e) => {
                        markFieldDirty('lostNotes');
                        setLostNotes(e.target.value);
                      }}
                      disabled={isLockedConverted}
                      className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                    />
                  </div>
                </div>
              )}

              <Select
                label="Target Partner Hospital"
                value={targetHospitalId}
                onChange={(val) => {
                  markFieldDirty('targetHospitalId');
                  setTargetHospitalId(val);
                  if (
                    val &&
                    targetDoctorId &&
                    !doctors.some((d) => d.id === targetDoctorId && d.hospitalId === val)
                  ) {
                    markFieldDirty('targetDoctorId');
                    setTargetDoctorId('');
                  }
                }}
                options={hospitalOptions}
                searchable
                disabled={isLockedConverted}
              />

              <Select
                label="Target Attending Doctor"
                value={targetDoctorId}
                onChange={(val) => {
                  markFieldDirty('targetDoctorId');
                  setTargetDoctorId(val);
                }}
                options={doctorOptions}
                searchable
                disabled={isLockedConverted}
              />

              <Input
                label="Preliminary Quote Estimate (USD)"
                type="number"
                min="0"
                value={preliminaryQuoteUsd}
                onChange={(e) => {
                  markFieldDirty('preliminaryQuoteUsd');
                  setPreliminaryQuoteUsd(e.target.value);
                }}
                placeholder="e.g. 11500"
                disabled={isLockedConverted}
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="quote-notes"
                  className="block text-xs font-medium text-surface-700"
                >
                  Quote Breakdown &amp; Inclusions
                </label>
                <textarea
                  id="quote-notes"
                  rows={2}
                  value={preliminaryQuoteNotes}
                  onChange={(e) => {
                    markFieldDirty('preliminaryQuoteNotes');
                    setPreliminaryQuoteNotes(e.target.value);
                  }}
                  disabled={isLockedConverted}
                  placeholder="e.g. 7d ICU/ward stay, pre-op workup, airport transfer..."
                  className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <Select
                  label="Specialty Interest"
                  value={specialtyInterest}
                  onChange={(val) => {
                    markFieldDirty('specialtyInterest');
                    setSpecialtyInterest(val);
                  }}
                  options={[
                    { value: '', label: 'General / Unspecified' },
                    ...MVT_SPECIALTY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                  ]}
                  disabled={isLockedConverted}
                />

                <Select
                  label="Urgency Level"
                  value={urgencyLevel}
                  onChange={(val) => {
                    markFieldDirty('urgencyLevel');
                    setUrgencyLevel(val);
                  }}
                  options={LEAD_URGENCY_LEVELS.map((u) => ({ value: u, label: u }))}
                  disabled={isLockedConverted}
                />

                <Select
                  label="Preferred Travel Window"
                  value={preferredTravelWindow}
                  onChange={(val) => {
                    markFieldDirty('preferredTravelWindow');
                    setPreferredTravelWindow(val);
                  }}
                  options={[
                    { value: '', label: 'Not Specified' },
                    ...PREFERRED_TRAVEL_WINDOWS.map((w) => ({
                      value: w,
                      label: TRAVEL_WINDOW_LABELS[w] || w,
                    })),
                  ]}
                  disabled={isLockedConverted}
                />

                <Select
                  label="B2B Referral Partner"
                  value={referralPartnerId}
                  onChange={(val) => {
                    markFieldDirty('referralPartnerId');
                    setReferralPartnerId(val);
                  }}
                  options={partnerOptions}
                  searchable
                  disabled={isLockedConverted}
                />

                {role === 'ADMIN' && (
                  <Select
                    label="Assigned Coordinator"
                    value={assignedManagerId}
                    onChange={(val) => {
                      markFieldDirty('assignedManagerId');
                      setAssignedManagerId(val);
                    }}
                    options={[
                      { value: '', label: 'Unassigned Pool' },
                      ...coordinators.map((c) => ({ value: c.id, label: c.fullName })),
                    ]}
                    searchable
                    disabled={isLockedConverted}
                  />
                )}
              </div>

              <Input
                label="Next Follow-Up Date & Time"
                type="datetime-local"
                value={nextFollowUpAt}
                onChange={(e) => {
                  markFieldDirty('nextFollowUpAt');
                  setNextFollowUpAt(e.target.value);
                }}
                disabled={isLockedConverted}
              />

              <div className="space-y-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-surface-700 min-h-11 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDiagnosticReports}
                    onChange={(e) => {
                      markFieldDirty('hasDiagnosticReports');
                      setHasDiagnosticReports(e.target.checked);
                    }}
                    disabled={isLockedConverted}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span>Diagnostic reports uploaded / verified</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-surface-700 min-h-11 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passportReady}
                    onChange={(e) => {
                      markFieldDirty('passportReady');
                      setPassportReady(e.target.checked);
                    }}
                    disabled={isLockedConverted}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span>Valid passport ready (6m+ validity)</span>
                </label>
              </div>

              {!transitionGuard.allowed && (
                <div className="p-3 rounded-md bg-warning-50 border border-warning-200 text-xs text-warning-900">
                  {transitionGuard.reason}
                </div>
              )}

              {!isLockedConverted && (
                <div className="flex items-center gap-2">
                  {dirtyCount > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => hydrateRightRail(lead, true)}
                      disabled={savingTriage}
                    >
                      Reset
                    </Button>
                  )}
                  <Button
                    type="submit"
                    fullWidth
                    isLoading={savingTriage}
                    disabled={!transitionGuard.allowed}
                  >
                    Save Triage &amp; Quote
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>

      {/* ─── 1-Click Conversion Modal ───────────────────────────────── */}
      <ConvertLeadModal
        open={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        role={role}
        lead={lead}
        duplicatePatients={duplicatePatients}
        hospitals={hospitals}
        doctors={doctors}
        initialMode={convertInitialMode}
        preselectedPatientId={preselectedPatientId}
      />
    </div>
  );
}
