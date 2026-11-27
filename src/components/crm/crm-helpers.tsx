'use client';

/**
 * Afzal Healthcare — Shared Client-Safe Leads CRM UI Types & Badges
 * Zero `@/lib/services/*` or Prisma runtime imports.
 */

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { LEAD_STATUS_LABELS } from '@/lib/constants';
import {
  computeLeadSlaState,
  type LeadSlaState,
} from '@/lib/validation/leads-crm-schemas';

export interface ReferralPartnerOption {
  id: string;
  name: string;
  code: string;
  partnerType: string;
  country: string;
  isActive?: boolean;
  commissionPercent?: number | string;
}

export interface HospitalDirectoryItem {
  id: string;
  name: string;
  city: string;
  accreditation?: string | null;
}

export interface DoctorDirectoryItem {
  id: string;
  fullName: string;
  hospitalId: string;
  qualification?: string | null;
  specialisation?: { id: string; name: string } | null;
}

export interface CoordinatorOption {
  id: string;
  fullName: string;
  email: string;
}

export interface LeadActivityItem {
  id: string;
  leadId: string;
  actorId: string | null;
  activityType: string;
  summary: string;
  details?: Record<string, unknown> | null;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
}

export interface DuplicateMatchItem {
  kind: 'LEAD' | 'PATIENT';
  id: string;
  referenceNo?: string;
  fullName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  status: string;
  matchedBy: ('EMAIL' | 'PHONE')[];
  createdAt: string;
}

export interface LeadRecord {
  id: string;
  referenceNo: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  nationality: string;
  countryOfResidence: string | null;
  preferredLanguage: string | null;
  medicalCondition: string;
  specialtyInterest: string | null;
  urgencyLevel: string;
  hasDiagnosticReports: boolean;
  passportReady: boolean;
  preferredTravelWindow: string | null;
  estimatedBudgetUsd: number | string | null;
  preliminaryQuoteUsd: number | string | null;
  preliminaryQuoteNotes: string | null;
  targetHospitalId: string | null;
  targetDoctorId: string | null;
  status: string;
  source: string;
  leadScore: number;
  temperature: string;
  assignedManagerId: string | null;
  referralPartnerId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstResponseDueAt: string;
  firstRespondedAt: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  lostNotes: string | null;
  convertedPatientId: string | null;
  convertedCaseId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedManager?: { id: string; fullName: string; email: string } | null;
  referralPartner?: ReferralPartnerOption | null;
  _count?: { activities: number };
  activities?: LeadActivityItem[];
  slaState?: LeadSlaState;
  scoreBreakdown?: string[];
  whatsappUrl?: string | null;
}

export interface LeadsKpiSummary {
  newUnclaimed: number;
  slaAttention: number;
  followUpsDue: number;
  hotCount: number;
  quoteSharedCount: number;
  convertedCount: number;
}

export const TRAVEL_WINDOW_LABELS: Record<string, string> = {
  IMMEDIATE_7D: 'Immediate (Within 7 Days)',
  WITHIN_30D: 'Within 30 Days',
  WITHIN_90D: 'Within 90 Days',
  EXPLORING: 'Exploring Options',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  PHONE_CALL: 'Phone Call',
  EMAIL: 'Email',
  QUOTE_ESTIMATE: 'Quote Estimate',
  FOLLOW_UP_SCHEDULED: 'Follow-Up Task',
  NOTE: 'Internal Note',
  STATUS_CHANGE: 'Stage Change',
  CONVERSION: 'Conversion',
};

export function formatCurrencyUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`;
}

export function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    NEW: 'info',
    CONTACTED: 'primary',
    MEDICAL_RECORDS_REQUESTED: 'warning',
    CLINICAL_REVIEW: 'info',
    QUOTE_SHARED: 'primary',
    NURTURING: 'default',
    QUALIFIED: 'success',
    CONVERTED: 'success',
    LOST: 'danger',
  };

  return (
    <Badge variant={variantMap[status] || 'default'} dot>
      {LEAD_STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function LeadTemperatureBadge({
  temperature,
  score,
}: {
  temperature: string;
  score: number;
}) {
  const variantMap: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
    HOT: 'danger',
    WARM: 'warning',
    COLD: 'info',
  };

  return (
    <Badge variant={variantMap[temperature] || 'default'} className="tabular-nums">
      {temperature} · {score}/100
    </Badge>
  );
}

function formatDurationMinutes(totalMinutes: number): string {
  const abs = Math.max(1, Math.round(Math.abs(totalMinutes)));
  if (abs < 60) return `${abs}m`;
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function LeadSlaBadge({
  firstResponseDueAt,
  firstRespondedAt,
  status,
  slaState,
  nowMs,
}: {
  firstResponseDueAt: string;
  firstRespondedAt?: string | null;
  status: string;
  slaState?: LeadSlaState;
  nowMs?: number | null;
}) {
  if (status === 'CONVERTED' || status === 'LOST') {
    if (firstRespondedAt) {
      const state = computeLeadSlaState({ firstResponseDueAt, firstRespondedAt, status });
      return (
        <Badge variant={state === 'RESPONDED_ON_TIME' ? 'success' : 'default'} size="sm">
          {state === 'RESPONDED_ON_TIME' ? 'SLA Met' : 'Responded Late'}
        </Badge>
      );
    }
    return (
      <Badge variant="default" size="sm">
        Closed
      </Badge>
    );
  }

  const effectiveState =
    nowMs !== null && nowMs !== undefined
      ? computeLeadSlaState({
          firstResponseDueAt,
          firstRespondedAt,
          status,
          now: new Date(nowMs),
        })
      : slaState || computeLeadSlaState({ firstResponseDueAt, firstRespondedAt, status });

  if (effectiveState === 'RESPONDED_ON_TIME') {
    return (
      <Badge variant="success" size="sm" dot>
        Responded On Time
      </Badge>
    );
  }
  if (effectiveState === 'RESPONDED_LATE') {
    return (
      <Badge variant="warning" size="sm" dot>
        Responded Late
      </Badge>
    );
  }

  const dueMs = new Date(firstResponseDueAt).getTime();
  const diffLabel =
    nowMs !== null && nowMs !== undefined && Number.isFinite(dueMs)
      ? formatDurationMinutes((dueMs - nowMs) / 60_000)
      : null;

  if (effectiveState === 'BREACHED') {
    return (
      <Badge variant="danger" size="sm" dot className="tabular-nums">
        {diffLabel ? `SLA Breached (${diffLabel})` : 'SLA Breached'}
      </Badge>
    );
  }
  if (effectiveState === 'DUE_SOON') {
    return (
      <Badge variant="warning" size="sm" dot className="tabular-nums">
        {diffLabel ? `SLA Due in ${diffLabel}` : 'SLA Due Soon'}
      </Badge>
    );
  }

  return (
    <Badge variant="info" size="sm" dot className="tabular-nums">
      {diffLabel ? `SLA ${diffLabel} left` : 'Active SLA'}
    </Badge>
  );
}
