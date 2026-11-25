'use client';

/**
 * Afzal Healthcare — Coordinator & Admin Leads Pipeline Workspace
 * Supports Kanban Board & Triage Table views, 6-metric SLA & KPI Bar,
 * + Log Inquiry modal, 1-click Claim, and Admin CSV Export / Bulk Import.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select, type SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  COMMON_LANGUAGES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  MVT_SPECIALTY_OPTIONS,
} from '@/lib/constants';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
  LEAD_URGENCY_LEVELS,
  PREFERRED_TRAVEL_WINDOWS,
} from '@/lib/validation/leads-crm-schemas';
import {
  LeadSlaBadge,
  LeadStatusBadge,
  LeadTemperatureBadge,
  TRAVEL_WINDOW_LABELS,
  formatCurrencyUsd,
  formatDateTimeShort,
  type CoordinatorOption,
  type DuplicateMatchItem,
  type LeadRecord,
  type LeadsKpiSummary,
  type ReferralPartnerOption,
} from './crm-helpers';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Kanban,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Upload,
  UserCheck,
} from 'lucide-react';

export interface LeadsPipelineWorkspaceProps {
  role: 'MANAGER' | 'ADMIN';
}

function parseCsvRecords(rawCsv: string): string[][] {
  const input = rawCsv.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        records.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      records.push(currentRow);
    }
  }

  return records;
}

function parseCsvToObjects(rawCsv: string): Record<string, string>[] {
  const records = parseCsvRecords(rawCsv);
  if (records.length < 2) return [];
  const headers = records[0];
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const values = records[i];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) {
        row[h] = values[idx] ?? '';
      }
    });
    rows.push(row);
  }
  return rows;
}

const DEFAULT_KPIS: LeadsKpiSummary = {
  newUnclaimed: 0,
  slaAttention: 0,
  followUpsDue: 0,
  hotCount: 0,
  quoteSharedCount: 0,
  convertedCount: 0,
};

const INITIAL_NEW_LEAD = {
  fullName: '',
  nationality: '',
  countryOfResidence: '',
  preferredLanguage: 'English',
  phone: '',
  whatsappNumber: '',
  email: '',
  medicalCondition: '',
  specialtyInterest: '',
  urgencyLevel: 'ROUTINE',
  source: 'PHONE_CALL',
  preferredTravelWindow: '',
  estimatedBudgetUsd: '',
  referralPartnerId: '',
  assignedManagerId: '',
  hasDiagnosticReports: false,
  passportReady: false,
};

export function LeadsPipelineWorkspace({ role }: LeadsPipelineWorkspaceProps) {
  const basePath = role === 'ADMIN' ? '/admin/leads' : '/manager/leads';

  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('KANBAN');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [kpis, setKpis] = useState<LeadsKpiSummary>(DEFAULT_KPIS);
  const [meta, setMeta] = useState({ page: 1, limit: 100, total: 0 });
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [followUpsDueOnly, setFollowUpsDueOnly] = useState(false);

  const fetchSeqRef = useRef(0);

  // Supporting metadata
  const [partners, setPartners] = useState<ReferralPartnerOption[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorOption[]>([]);

  // + Log Inquiry Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdDuplicateInfo, setCreatedDuplicateInfo] = useState<{
    leadId: string;
    referenceNo: string;
    duplicates: DuplicateMatchItem[];
  } | null>(null);
  const [newLead, setNewLead] = useState(INITIAL_NEW_LEAD);

  // Admin CSV Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    skippedCount: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLeads = useCallback(
    async (page = 1) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      try {
        const limit = viewMode === 'KANBAN' ? 100 : 25;
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        if (statusFilter) params.set('status', statusFilter);
        if (temperatureFilter) params.set('temperature', temperatureFilter);
        if (slaFilter) params.set('slaState', slaFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (specialtyFilter) params.set('specialtyInterest', specialtyFilter);
        if (partnerFilter) params.set('referralPartnerId', partnerFilter);
        if (assignedFilter) params.set('assignedManagerId', assignedFilter);
        if (followUpsDueOnly) params.set('followUpsDue', 'true');

        const res = await fetch(`/api/v1/leads?${params.toString()}`);
        const json = await res.json();
        if (seq !== fetchSeqRef.current) return;
        if (!res.ok || !json.success) {
          toast.apiError(json, 'Failed to load leads pipeline.');
          return;
        }
        setLeads(json.data?.leads || []);
        setKpis(json.data?.kpis || DEFAULT_KPIS);
        setMeta(json.meta || { page, limit, total: 0 });
      } catch (err) {
        if (seq !== fetchSeqRef.current) return;
        toast.apiError(err, 'Network error loading leads.');
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [
      viewMode,
      debouncedSearch,
      statusFilter,
      temperatureFilter,
      slaFilter,
      sourceFilter,
      specialtyFilter,
      partnerFilter,
      assignedFilter,
      followUpsDueOnly,
    ]
  );

  const fetchReferenceData = useCallback(async () => {
    try {
      const partnerRes = await fetch('/api/v1/referral-partners');
      if (partnerRes.ok) {
        const partnerJson = await partnerRes.json();
        if (partnerJson.success) {
          setPartners(partnerJson.data?.partners || []);
        }
      }
      if (role === 'ADMIN') {
        const mgrRes = await fetch('/api/v1/admin/users?role=MANAGER&limit=100');
        if (mgrRes.ok) {
          const mgrJson = await mgrRes.json();
          if (mgrJson.success) {
            setCoordinators(
              (mgrJson.data?.users || []).map((u: { id: string; fullName: string; email: string }) => ({
                id: u.id,
                fullName: u.fullName,
                email: u.email,
              }))
            );
          }
        }
      }
    } catch {
      // Non-fatal metadata load failure
    }
  }, [role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLeads(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchReferenceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReferenceData]);

  useEffect(() => {
    const initTimer = setTimeout(() => setNowMs(Date.now()), 0);
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, LeadRecord[]> = {};
    for (const s of LEAD_STATUSES) {
      grouped[s] = [];
    }
    for (const lead of leads) {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    }
    return grouped;
  }, [leads]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter ||
      temperatureFilter ||
      slaFilter ||
      sourceFilter ||
      specialtyFilter ||
      partnerFilter ||
      assignedFilter ||
      followUpsDueOnly
  );

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTemperatureFilter('');
    setSlaFilter('');
    setSourceFilter('');
    setSpecialtyFilter('');
    setPartnerFilter('');
    setAssignedFilter('');
    setFollowUpsDueOnly(false);
  };

  const openCreateModal = () => {
    setCreateError(null);
    setCreatedDuplicateInfo(null);
    setNewLead(INITIAL_NEW_LEAD);
    setIsCreateOpen(true);
  };

  const handleClaimLead = async (leadId: string) => {
    setClaimingId(leadId);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLAIM' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Unable to claim lead.');
        return;
      }
      toast.success('Lead claimed and assigned to your pipeline.', 'Lead Claimed');
      await fetchLeads(meta.page);
    } catch (err) {
      toast.apiError(err, 'Network error claiming lead.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createdDuplicateInfo) return;
    setCreateError(null);
    setCreatedDuplicateInfo(null);

    if (!newLead.email.trim() && !newLead.phone.trim() && !newLead.whatsappNumber.trim()) {
      setCreateError('Provide at least a phone number, WhatsApp number, or email address.');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: newLead.fullName.trim(),
        nationality: newLead.nationality.trim(),
        countryOfResidence: newLead.countryOfResidence.trim() || null,
        preferredLanguage: newLead.preferredLanguage || null,
        phone: newLead.phone.trim() || null,
        whatsappNumber: newLead.whatsappNumber.trim() || null,
        email: newLead.email.trim() || null,
        medicalCondition: newLead.medicalCondition.trim(),
        specialtyInterest: newLead.specialtyInterest || null,
        urgencyLevel: newLead.urgencyLevel,
        source: newLead.source,
        preferredTravelWindow: newLead.preferredTravelWindow || null,
        estimatedBudgetUsd: newLead.estimatedBudgetUsd ? Number(newLead.estimatedBudgetUsd) : null,
        referralPartnerId: newLead.referralPartnerId || null,
        hasDiagnosticReports: newLead.hasDiagnosticReports,
        passportReady: newLead.passportReady,
      };
      if (role === 'ADMIN' && newLead.assignedManagerId) {
        payload.assignedManagerId = newLead.assignedManagerId;
      }

      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json?.error?.message || 'Failed to log inquiry.';
        setCreateError(msg);
        toast.apiError(json, msg);
        return;
      }

      const createdLead = json.data?.lead as LeadRecord;
      const duplicates = (json.data?.potentialDuplicates || []) as DuplicateMatchItem[];
      toast.success(`Inquiry ${createdLead.referenceNo} logged (Score ${createdLead.leadScore}/100).`);
      setNewLead(INITIAL_NEW_LEAD);
      await fetchLeads(1);

      if (duplicates.length > 0) {
        setCreatedDuplicateInfo({
          leadId: createdLead.id,
          referenceNo: createdLead.referenceNo,
          duplicates,
        });
      } else {
        setIsCreateOpen(false);
      }
    } catch (err) {
      toast.apiError(err, 'Network error logging inquiry.');
    } finally {
      setCreating(false);
    }
  };

  const handleAdminExportCsv = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    if (temperatureFilter) params.set('temperature', temperatureFilter);
    if (partnerFilter) params.set('referralPartnerId', partnerFilter);
    const qs = params.toString();
    window.open(`/api/v1/admin/export/leads${qs ? `?${qs}` : ''}`, '_blank');
    toast.success('Leads CSV export started.');
  };

  const parsedImportRows = useMemo(() => parseCsvToObjects(csvText), [csvText]);

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === 'string' ? reader.result : '');
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedImportRows.length === 0) {
      toast.error('Upload or paste a valid CSV with at least one data row.');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'BULK_IMPORT', rows: parsedImportRows }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.apiError(json, 'Bulk CSV import failed.');
        return;
      }
      setImportResult(json.data);
      toast.success(
        `Imported ${json.data.createdCount} leads (${json.data.skippedCount} skipped).`,
        'Bulk Import Complete'
      );
      await fetchLeads(1);
    } catch (err) {
      toast.apiError(err, 'Network error importing CSV.');
    } finally {
      setImporting(false);
    }
  };

  const statusFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Stages' },
      ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] || s })),
    ],
    []
  );

  const temperatureOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Temperatures' },
      ...LEAD_TEMPERATURES.map((t) => ({ value: t, label: t })),
    ],
    []
  );

  const slaOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All SLA States' },
      { value: 'ATTENTION', label: 'Breached / Due Soon' },
      { value: 'BREACHED', label: 'SLA Breached Only' },
      { value: 'DUE_SOON', label: 'Due Within 15m' },
    ],
    []
  );

  const sourceOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Sources' },
      ...LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] || s })),
    ],
    []
  );

  const specialtyOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Specialties' },
      ...MVT_SPECIALTY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    ],
    []
  );

  const partnerOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All B2B Partners' },
      ...partners.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.code})`,
        description: p.country,
      })),
    ],
    [partners]
  );

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 25)));

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">
            International Patient Leads CRM
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            {role === 'ADMIN'
              ? 'Platform-wide inquiry triage, speed-to-lead SLAs, B2B partner attribution, and 1-click case conversion.'
              : 'Manage assigned inquiries, claim unassigned pool leads, log omnichannel touchpoints, and convert qualified patients.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchLeads(meta.page)}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </Button>

          {role === 'ADMIN' && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setImportResult(null);
                  setIsImportOpen(true);
                }}
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Import CSV</span>
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleAdminExportCsv}>
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Log Inquiry</span>
          </Button>
        </div>
      </div>

      {/* ─── 6-Metric KPI & SLA Alert Bar ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setStatusFilter('NEW');
            setAssignedFilter('UNASSIGNED');
          }}
          className={`text-left p-4 rounded-lg border bg-white transition-colors min-h-11 ${
            statusFilter === 'NEW' && assignedFilter === 'UNASSIGNED'
              ? 'border-primary-500 bg-primary-50/40'
              : 'border-surface-200 hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wide">
            New Unclaimed
          </p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {kpis.newUnclaimed}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setSlaFilter('ATTENTION');
          }}
          className={`text-left p-4 rounded-lg border transition-colors min-h-11 ${
            slaFilter === 'ATTENTION'
              ? 'border-danger-400 bg-danger-50/50'
              : kpis.slaAttention > 0
              ? 'border-danger-200 bg-danger-50/20 hover:border-danger-300'
              : 'border-surface-200 bg-white hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-danger-700 uppercase tracking-wide flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>SLA Breached / Soon</span>
          </p>
          <p className="text-2xl font-semibold text-danger-700 mt-1 tabular-nums">
            {kpis.slaAttention}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setFollowUpsDueOnly(true);
          }}
          className={`text-left p-4 rounded-lg border bg-white transition-colors min-h-11 ${
            followUpsDueOnly
              ? 'border-warning-400 bg-warning-50/40'
              : 'border-surface-200 hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wide flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-warning-600" aria-hidden="true" />
            <span>Follow-Ups Due</span>
          </p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {kpis.followUpsDue}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setTemperatureFilter('HOT');
          }}
          className={`text-left p-4 rounded-lg border bg-white transition-colors min-h-11 ${
            temperatureFilter === 'HOT'
              ? 'border-danger-400 bg-danger-50/30'
              : 'border-surface-200 hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wide flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-danger-600" aria-hidden="true" />
            <span>Hot Leads</span>
          </p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {kpis.hotCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setStatusFilter('QUOTE_SHARED');
          }}
          className={`text-left p-4 rounded-lg border bg-white transition-colors min-h-11 ${
            statusFilter === 'QUOTE_SHARED'
              ? 'border-primary-500 bg-primary-50/40'
              : 'border-surface-200 hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wide">
            Quotes Shared
          </p>
          <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">
            {kpis.quoteSharedCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllFilters();
            setStatusFilter('CONVERTED');
          }}
          className={`text-left p-4 rounded-lg border bg-white transition-colors min-h-11 ${
            statusFilter === 'CONVERTED'
              ? 'border-success-500 bg-success-50/40'
              : 'border-surface-200 hover:border-surface-300'
          }`}
        >
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
            <span>Converted</span>
          </p>
          <p className="text-2xl font-semibold text-success-700 mt-1 tabular-nums">
            {kpis.convertedCount}
          </p>
        </button>
      </div>

      {/* ─── Filter & View Toolbar ──────────────────────────────────── */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference no, patient name, phone, email, nationality, or condition..."
              className="w-full min-h-11 pl-9 pr-3 py-2 text-sm bg-white border border-surface-300 rounded-md text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-1 rounded-md bg-surface-100 border border-surface-200">
              <button
                type="button"
                onClick={() => setViewMode('KANBAN')}
                className={`min-h-11 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'KANBAN'
                    ? 'bg-white text-primary-900 border border-surface-200 shadow-2xs'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Kanban Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`min-h-11 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-primary-900 border border-surface-200 shadow-2xs'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Triage Table</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <Select value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} />
          <Select value={temperatureFilter} onChange={setTemperatureFilter} options={temperatureOptions} />
          <Select value={slaFilter} onChange={setSlaFilter} options={slaOptions} />
          <Select value={sourceFilter} onChange={setSourceFilter} options={sourceOptions} />
          <Select value={specialtyFilter} onChange={setSpecialtyFilter} options={specialtyOptions} />
          <Select
            value={partnerFilter}
            onChange={setPartnerFilter}
            options={partnerOptions}
            searchable
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-surface-600">
            <span className="tabular-nums">
              Showing {leads.length} of {meta.total} lead{meta.total === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-primary-700 hover:text-primary-800 font-medium min-h-11 px-2"
            >
              Clear all filters
            </button>
          </div>
        )}
      </Card>

      {/* ─── Pipeline Content ───────────────────────────────────────── */}
      {loading ? (
        <Card className="py-16 text-center">
          <div className="inline-flex items-center gap-2.5 text-xs text-surface-500">
            <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading leads pipeline...</span>
          </div>
        </Card>
      ) : viewMode === 'KANBAN' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {LEAD_STATUSES.map((colStatus) => {
            const columnLeads = leadsByStatus[colStatus] || [];
            return (
              <div
                key={colStatus}
                className="w-80 shrink-0 rounded-lg border border-surface-200 bg-surface-50/70 flex flex-col max-h-[72vh]"
              >
                <div className="px-3.5 py-3 border-b border-surface-200 bg-white rounded-t-lg flex items-center justify-between gap-2 shrink-0">
                  <span className="text-xs font-semibold text-surface-900 truncate">
                    {LEAD_STATUS_LABELS[colStatus] || colStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200 text-[11px] font-medium text-surface-700 tabular-nums">
                    {columnLeads.length}
                  </span>
                </div>

                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                  {columnLeads.length === 0 ? (
                    <div className="py-8 px-3 text-center text-[11px] text-surface-400">
                      No leads in stage
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-lg border border-surface-200 bg-white p-3.5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] text-surface-500">
                            {lead.referenceNo}
                          </span>
                          <LeadTemperatureBadge
                            temperature={lead.temperature}
                            score={lead.leadScore}
                          />
                        </div>

                        <div>
                          <Link
                            href={`${basePath}/${lead.id}`}
                            className="text-sm font-semibold text-surface-900 hover:text-primary-700 transition-colors block truncate"
                          >
                            {lead.fullName}
                          </Link>
                          <p className="text-xs text-surface-500 mt-0.5 truncate">
                            {lead.nationality}
                            {lead.preferredLanguage ? ` · ${lead.preferredLanguage}` : ''}
                          </p>
                        </div>

                        <p className="text-xs text-surface-700 line-clamp-2 leading-relaxed">
                          {lead.medicalCondition}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <LeadSlaBadge
                            firstResponseDueAt={lead.firstResponseDueAt}
                            firstRespondedAt={lead.firstRespondedAt}
                            status={lead.status}
                            slaState={lead.slaState}
                            nowMs={nowMs}
                          />
                          <Badge variant="default" size="sm">
                            {LEAD_SOURCE_LABELS[lead.source] || lead.source}
                          </Badge>
                          {lead.referralPartner && (
                            <Badge variant="primary" size="sm">
                              {lead.referralPartner.code}
                            </Badge>
                          )}
                        </div>

                        {(lead.preliminaryQuoteUsd || lead.specialtyInterest) && (
                          <div className="text-[11px] text-surface-600 flex items-center justify-between gap-2 pt-1 border-t border-surface-100 tabular-nums">
                            <span className="truncate">{lead.specialtyInterest || 'General'}</span>
                            {lead.preliminaryQuoteUsd && (
                              <span className="font-medium text-surface-800">
                                {formatCurrencyUsd(lead.preliminaryQuoteUsd)}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-surface-100">
                          {!lead.assignedManagerId ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              isLoading={claimingId === lead.id}
                              onClick={() => void handleClaimLead(lead.id)}
                              className="flex-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Claim</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-surface-500 truncate flex-1">
                              {lead.assignedManager?.fullName || 'Assigned'}
                            </span>
                          )}

                          <Link
                            href={`${basePath}/${lead.id}`}
                            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 transition-colors shrink-0"
                          >
                            Open Dossier
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="p-0! overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Lead &amp; Nationality
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Clinical &amp; Quote
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    SLA &amp; Follow-Up
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Stage &amp; Source
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Coordinator
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-xs text-surface-500">
                      No leads match your current filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-mono text-[11px] text-surface-500">{lead.referenceNo}</p>
                        <Link
                          href={`${basePath}/${lead.id}`}
                          className="font-semibold text-surface-900 hover:text-primary-700"
                        >
                          {lead.fullName}
                        </Link>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {lead.nationality}
                          {lead.preferredLanguage ? ` · ${lead.preferredLanguage}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-top max-w-xs">
                        <p className="text-xs font-medium text-surface-800">
                          {lead.specialtyInterest || 'General Inquiry'}
                        </p>
                        <p className="text-xs text-surface-500 line-clamp-2 mt-0.5">
                          {lead.medicalCondition}
                        </p>
                        {lead.preliminaryQuoteUsd && (
                          <p className="text-xs font-medium text-primary-800 mt-1 tabular-nums">
                            Est: {formatCurrencyUsd(lead.preliminaryQuoteUsd)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <LeadTemperatureBadge
                          temperature={lead.temperature}
                          score={lead.leadScore}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-top space-y-1">
                        <LeadSlaBadge
                          firstResponseDueAt={lead.firstResponseDueAt}
                          firstRespondedAt={lead.firstRespondedAt}
                          status={lead.status}
                          slaState={lead.slaState}
                          nowMs={nowMs}
                        />
                        {lead.nextFollowUpAt && (
                          <p className="text-[11px] text-surface-500 tabular-nums">
                            Next: {formatDateTimeShort(lead.nextFollowUpAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top space-y-1">
                        <div>
                          <LeadStatusBadge status={lead.status} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="default" size="sm">
                            {LEAD_SOURCE_LABELS[lead.source] || lead.source}
                          </Badge>
                          {lead.referralPartner && (
                            <Badge variant="primary" size="sm">
                              {lead.referralPartner.code}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs text-surface-700">
                        {lead.assignedManager?.fullName || (
                          <Badge variant="warning" size="sm">
                            Unclaimed Pool
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {!lead.assignedManagerId && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              isLoading={claimingId === lead.id}
                              onClick={() => void handleClaimLead(lead.id)}
                            >
                              Claim
                            </Button>
                          )}
                          <Link
                            href={`${basePath}/${lead.id}`}
                            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 transition-colors whitespace-nowrap"
                          >
                            Open Dossier
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-xs text-surface-600">
              <span className="tabular-nums">
                Page {meta.page} of {totalPages} ({meta.total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => void fetchLeads(meta.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={meta.page >= totalPages}
                  onClick={() => void fetchLeads(meta.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─── + Log Inquiry Modal ────────────────────────────────────── */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Log New Patient Inquiry"
        subtitle="Creates a scored CRM lead with automatic SLA countdown and duplicate detection."
        maxWidthClass="max-w-2xl"
      >
        {createdDuplicateInfo ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-md bg-warning-50 border border-warning-200 text-xs text-warning-900 space-y-2">
              <p className="font-semibold">
                Inquiry {createdDuplicateInfo.referenceNo} logged — Potential Duplicate(s) Detected
              </p>
              <ul className="space-y-1 text-warning-800">
                {createdDuplicateInfo.duplicates.map((dup) => (
                  <li key={`${dup.kind}-${dup.id}`}>
                    {dup.kind}: {dup.fullName} ({dup.matchedBy.join(' & ')}) · {dup.status}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-surface-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCreatedDuplicateInfo(null);
                  setCreateError(null);
                  setNewLead(INITIAL_NEW_LEAD);
                }}
              >
                Log Another Inquiry
              </Button>
              <Link
                href={`${basePath}/${createdDuplicateInfo.leadId}`}
                className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium border border-primary-700/20 shadow-2xs transition-colors"
              >
                Open Lead Dossier
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateLead} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Patient Full Name"
              required
              value={newLead.fullName}
              onChange={(e) => setNewLead((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="e.g. Tariq Al-Said"
            />
            <Input
              label="Nationality"
              required
              value={newLead.nationality}
              onChange={(e) => setNewLead((p) => ({ ...p, nationality: e.target.value }))}
              placeholder="e.g. Oman"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="Phone Number"
              type="tel"
              value={newLead.phone}
              onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+968 9123 4567"
            />
            <Input
              label="WhatsApp Number"
              type="tel"
              value={newLead.whatsappNumber}
              onChange={(e) => setNewLead((p) => ({ ...p, whatsappNumber: e.target.value }))}
              placeholder="+968 9123 4567"
            />
            <Input
              label="Email Address"
              type="email"
              value={newLead.email}
              onChange={(e) => setNewLead((p) => ({ ...p, email: e.target.value }))}
              placeholder="patient@example.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Select
              label="Preferred Language"
              value={newLead.preferredLanguage}
              onChange={(val) => setNewLead((p) => ({ ...p, preferredLanguage: val }))}
              options={COMMON_LANGUAGES.map((l) => ({ value: l, label: l }))}
            />
            <Select
              label="Inquiry Source"
              value={newLead.source}
              onChange={(val) => setNewLead((p) => ({ ...p, source: val }))}
              options={LEAD_SOURCES.map((s) => ({
                value: s,
                label: LEAD_SOURCE_LABELS[s] || s,
              }))}
            />
            <Select
              label="Urgency Level"
              value={newLead.urgencyLevel}
              onChange={(val) => setNewLead((p) => ({ ...p, urgencyLevel: val }))}
              options={LEAD_URGENCY_LEVELS.map((u) => ({ value: u, label: u }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Select
              label="Specialty Interest"
              value={newLead.specialtyInterest}
              onChange={(val) => setNewLead((p) => ({ ...p, specialtyInterest: val }))}
              options={[
                { value: '', label: 'Select Specialty...' },
                ...MVT_SPECIALTY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ]}
            />
            <Select
              label="Travel Window"
              value={newLead.preferredTravelWindow}
              onChange={(val) => setNewLead((p) => ({ ...p, preferredTravelWindow: val }))}
              options={[
                { value: '', label: 'Not Specified' },
                ...PREFERRED_TRAVEL_WINDOWS.map((w) => ({
                  value: w,
                  label: TRAVEL_WINDOW_LABELS[w] || w,
                })),
              ]}
            />
            <Input
              label="Est. Budget (USD)"
              type="number"
              min="0"
              value={newLead.estimatedBudgetUsd}
              onChange={(e) => setNewLead((p) => ({ ...p, estimatedBudgetUsd: e.target.value }))}
              placeholder="15000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="B2B Referral Partner (Optional)"
              value={newLead.referralPartnerId}
              onChange={(val) => setNewLead((p) => ({ ...p, referralPartnerId: val }))}
              options={[
                { value: '', label: 'Direct / No Partner' },
                ...partners
                  .filter((p) => p.isActive !== false)
                  .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
              ]}
              searchable
            />
            {role === 'ADMIN' ? (
              <Select
                label="Assign Coordinator (Optional)"
                value={newLead.assignedManagerId}
                onChange={(val) => setNewLead((p) => ({ ...p, assignedManagerId: val }))}
                options={[
                  { value: '', label: 'Auto-Route by Language & Workload' },
                  ...coordinators.map((c) => ({ value: c.id, label: c.fullName })),
                ]}
                searchable
              />
            ) : (
              <Input
                label="Country of Residence (Optional)"
                value={newLead.countryOfResidence}
                onChange={(e) =>
                  setNewLead((p) => ({ ...p, countryOfResidence: e.target.value }))
                }
                placeholder="e.g. UAE"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-lead-condition" className="block text-xs font-medium text-surface-700">
              Medical Condition &amp; Inquiry Details <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="new-lead-condition"
              required
              rows={3}
              value={newLead.medicalCondition}
              onChange={(e) => setNewLead((p) => ({ ...p, medicalCondition: e.target.value }))}
              placeholder="Describe diagnosis, requested procedure, symptoms, and companion count..."
              className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-surface-700 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={newLead.hasDiagnosticReports}
                onChange={(e) =>
                  setNewLead((p) => ({ ...p, hasDiagnosticReports: e.target.checked }))
                }
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span>Diagnostic reports available</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-surface-700 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={newLead.passportReady}
                onChange={(e) => setNewLead((p) => ({ ...p, passportReady: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span>Valid passport ready</span>
            </label>
          </div>

          {createError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-danger-50 border border-danger-200 text-xs font-medium text-danger-800"
            >
              {createError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={creating}>
              Save &amp; Score Lead
            </Button>
          </div>
          </form>
        )}
      </Modal>

      {/* ─── Admin CSV Bulk Import Modal ────────────────────────────── */}
      {role === 'ADMIN' && (
        <Modal
          open={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Bulk Import Leads from CSV"
          subtitle="Validates up to 500 rows with per-row Zod schema checks and auto-routing."
          maxWidthClass="max-w-2xl"
        >
          <form onSubmit={handleBulkImportSubmit} className="space-y-4">
            <div className="p-3 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-600 space-y-1">
              <p className="font-medium text-surface-800">Supported CSV Headers</p>
              <p className="font-mono text-[11px] break-all">
                fullName,nationality,phone,whatsappNumber,email,medicalCondition,specialtyInterest,urgencyLevel,preferredLanguage,source,preferredTravelWindow,estimatedBudgetUsd,hasDiagnosticReports,passportReady
              </p>
            </div>

            <div>
              <label
                htmlFor="csv-upload-input"
                className="block text-xs font-medium text-surface-700 mb-1.5"
              >
                Upload CSV File
              </label>
              <input
                id="csv-upload-input"
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="block w-full text-xs text-surface-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-surface-300 file:text-xs file:font-medium file:bg-white file:text-surface-700 hover:file:bg-surface-50 min-h-11"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="csv-paste-area" className="block text-xs font-medium text-surface-700">
                Or Paste CSV Content ({parsedImportRows.length} data row
                {parsedImportRows.length === 1 ? '' : 's'} detected)
              </label>
              <textarea
                id="csv-paste-area"
                rows={6}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setImportResult(null);
                }}
                placeholder={`fullName,nationality,phone,medicalCondition,source\nTariq Al-Said,Oman,+96891234567,Coronary bypass evaluation,WHATSAPP`}
                className="w-full p-2.5 rounded-md border border-surface-300 bg-white font-mono text-xs text-surface-900 focus:outline-none focus:border-primary-600"
              />
            </div>

            {importResult && (
              <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 text-xs space-y-2">
                <p className="font-semibold text-surface-900 tabular-nums">
                  Created: {importResult.createdCount} · Skipped: {importResult.skippedCount}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="max-h-32 overflow-y-auto space-y-1 text-danger-700">
                    {importResult.errors.map((errItem) => (
                      <li key={errItem.row}>
                        Row {errItem.row}: {errItem.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsImportOpen(false)}
                disabled={importing}
              >
                Close
              </Button>
              <Button type="submit" isLoading={importing} disabled={parsedImportRows.length === 0}>
                Import {parsedImportRows.length > 0 ? `${parsedImportRows.length} Rows` : 'CSV'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
