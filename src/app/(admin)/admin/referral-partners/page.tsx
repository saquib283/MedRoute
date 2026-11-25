'use client';

/**
 * Afzal Healthcare — Admin B2B Referral Partners Console
 * Manage facilitator agencies, referring physicians, embassies, and corporate insurers,
 * including commission percentages, active toggles, and 1-click /inquiry?ref=CODE attribution links.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  REFERRAL_PARTNER_TYPES,
  type ReferralPartnerTypeValue,
} from '@/lib/validation/leads-crm-schemas';
import {
  Building2,
  Check,
  Copy,
  Globe,
  Handshake,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface ReferralPartnerRecord {
  id: string;
  name: string;
  code: string;
  partnerType: ReferralPartnerTypeValue | string;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionPercent: number | string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  _count?: {
    leads: number;
    cases: number;
  };
}

interface PartnerFormState {
  name: string;
  code: string;
  partnerType: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  commissionPercent: string;
  isActive: boolean;
  notes: string;
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  FACILITATOR_AGENCY: 'Facilitator Agency',
  REFERRING_PHYSICIAN: 'Referring Physician',
  EMBASSY_MINISTRY: 'Embassy / Ministry',
  CORPORATE_INSURER: 'Corporate / Insurer',
};

const PARTNER_TYPE_BADGE: Record<string, 'primary' | 'info' | 'warning' | 'default'> = {
  FACILITATOR_AGENCY: 'primary',
  REFERRING_PHYSICIAN: 'info',
  EMBASSY_MINISTRY: 'warning',
  CORPORATE_INSURER: 'default',
};

const EMPTY_FORM: PartnerFormState = {
  name: '',
  code: '',
  partnerType: 'FACILITATOR_AGENCY',
  country: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  commissionPercent: '10',
  isActive: true,
  notes: '',
};

export default function ReferralPartnersPage() {
  const [partners, setPartners] = useState<ReferralPartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ReferralPartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/referral-partners');
      const json = await res.json();
      if (json.success) {
        setPartners(json.data?.partners ?? []);
      } else {
        toast.error(json.error?.message || 'Failed to load referral partners');
      }
    } catch (err) {
      console.error('Failed to fetch referral partners:', err);
      toast.error('Failed to load referral partners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPartners();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPartners]);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((partner) => {
      if (typeFilter && partner.partnerType !== typeFilter) return false;
      if (statusFilter === 'ACTIVE' && !partner.isActive) return false;
      if (statusFilter === 'INACTIVE' && partner.isActive) return false;
      if (!q) return true;
      return (
        partner.name.toLowerCase().includes(q) ||
        partner.code.toLowerCase().includes(q) ||
        partner.country.toLowerCase().includes(q) ||
        (partner.contactName ?? '').toLowerCase().includes(q)
      );
    });
  }, [partners, search, typeFilter, statusFilter]);

  const summaryStats = useMemo(() => {
    let activeCount = 0;
    let totalLeads = 0;
    let totalCases = 0;
    for (const p of partners) {
      if (p.isActive) activeCount += 1;
      totalLeads += p._count?.leads ?? 0;
      totalCases += p._count?.cases ?? 0;
    }
    return {
      total: partners.length,
      active: activeCount,
      leads: totalLeads,
      cases: totalCases,
    };
  }, [partners]);

  const openCreateModal = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (partner: ReferralPartnerRecord) => {
    setEditingPartner(partner);
    setForm({
      name: partner.name,
      code: partner.code,
      partnerType: partner.partnerType,
      country: partner.country,
      contactName: partner.contactName ?? '',
      contactEmail: partner.contactEmail ?? '',
      contactPhone: partner.contactPhone ?? '',
      commissionPercent: String(partner.commissionPercent ?? 10),
      isActive: partner.isActive,
      notes: partner.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const commissionNum = Number(form.commissionPercent);
      const basePayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        partnerType: form.partnerType,
        country: form.country.trim(),
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        commissionPercent: Number.isFinite(commissionNum) ? commissionNum : 10,
        isActive: form.isActive,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/v1/referral-partners', {
        method: editingPartner ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingPartner ? { id: editingPartner.id, ...basePayload } : basePayload
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to save referral partner');
        return;
      }

      toast.success(
        editingPartner
          ? `Updated partner ${basePayload.name}`
          : `Created partner ${basePayload.name}`
      );
      setModalOpen(false);
      await loadPartners();
    } catch (err) {
      console.error('Save partner error:', err);
      toast.error('Failed to save referral partner');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (partner: ReferralPartnerRecord) => {
    setTogglingId(partner.id);
    try {
      const res = await fetch('/api/v1/referral-partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: partner.id,
          isActive: !partner.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to update partner status');
        return;
      }
      toast.success(
        `${partner.name} ${!partner.isActive ? 'activated' : 'deactivated'}`
      );
      await loadPartners();
    } catch {
      toast.error('Failed to update partner status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopyReferralLink = async (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const referralUrl = `${origin}/inquiry?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedCode(code);
      toast.success(`Copied referral link: /inquiry?ref=${code}`);
      setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
      }, 2000);
    } catch {
      toast.error('Unable to copy link to clipboard');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">
            B2B Referral Partners
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Manage international facilitator agencies, referring physicians, embassies, and attribution links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadPartners()}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Partner
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-xs font-medium text-surface-500">Total partners</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">
            {summaryStats.total}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-surface-500">Active partners</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-primary-700 mt-1">
            {summaryStats.active}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-surface-500">Attributed leads</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1">
            {summaryStats.leads}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-surface-500">Converted cases</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-success-700 mt-1">
            {summaryStats.cases}
          </p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card padding="sm" className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partner name, code, country, or contact..."
            aria-label="Search referral partners"
            className="w-full min-h-11 pl-9 pr-3 py-2 bg-white border border-surface-300 rounded-md text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
          />
        </div>

        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'All Partner Types' },
            ...REFERRAL_PARTNER_TYPES.map((t) => ({
              value: t,
              label: PARTNER_TYPE_LABELS[t] || t,
            })),
          ]}
          className="w-full md:w-56"
        />

        <div className="inline-flex rounded-md border border-surface-200 bg-surface-100 p-1 shrink-0">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => {
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`min-h-11 px-3 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-surface-900 border border-surface-200 shadow-2xs'
                    : 'text-surface-600 hover:text-surface-900 border border-transparent'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Partners Table */}
      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Partner &amp; Contact
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Type &amp; Country
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Attribution Link
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Commission
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Leads / Cases
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-surface-500">
                      {partners.length === 0
                        ? 'No referral partners registered yet. Add your first B2B partner.'
                        : 'No referral partners match your current filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const leadsCount = partner._count?.leads ?? 0;
                    const casesCount = partner._count?.cases ?? 0;
                    const comm = Number(partner.commissionPercent ?? 0);
                    const isCopied = copiedCode === partner.code;

                    return (
                      <tr key={partner.id} className="hover:bg-surface-100/60 transition-colors">
                        <td className="px-5 py-3.5 align-top">
                          <div className="font-medium text-surface-900">{partner.name}</div>
                          {partner.contactName && (
                            <p className="text-xs text-surface-600 mt-0.5">{partner.contactName}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-surface-500">
                            {partner.contactEmail && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3" aria-hidden="true" />
                                {partner.contactEmail}
                              </span>
                            )}
                            {partner.contactPhone && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Phone className="w-3 h-3" aria-hidden="true" />
                                {partner.contactPhone}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 align-top">
                          <Badge variant={PARTNER_TYPE_BADGE[partner.partnerType] || 'default'}>
                            {PARTNER_TYPE_LABELS[partner.partnerType] || partner.partnerType}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-surface-600 mt-1.5">
                            <Globe className="w-3.5 h-3.5 text-surface-400" aria-hidden="true" />
                            <span>{partner.country}</span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 align-top">
                          <div className="flex flex-col items-start gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200 font-mono text-xs font-medium text-surface-800">
                              {partner.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopyReferralLink(partner.code)}
                              className="inline-flex items-center gap-1.5 px-2.5 min-h-11 rounded-md border border-surface-300 bg-white hover:bg-surface-50 text-xs font-medium text-surface-700 transition-colors"
                              title={`Copy /inquiry?ref=${partner.code}`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
                                  <span className="text-success-700">Copied link</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
                                  <span>/inquiry?ref={partner.code}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 align-top text-right">
                          <span className="text-sm font-semibold tabular-nums text-surface-900">
                            {comm.toFixed(1)}%
                          </span>
                        </td>

                        <td className="px-5 py-3.5 align-top text-right">
                          <div className="text-sm font-semibold tabular-nums text-surface-900">
                            {leadsCount} <span className="text-xs font-normal text-surface-500">leads</span>
                          </div>
                          <div className="text-xs font-medium tabular-nums text-primary-700 mt-0.5">
                            {casesCount} {casesCount === 1 ? 'case' : 'cases'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 align-top">
                          <Badge variant={partner.isActive ? 'success' : 'default'} dot>
                            {partner.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td className="px-5 py-3.5 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleToggleActive(partner)}
                              isLoading={togglingId === partner.id}
                              aria-label={
                                partner.isActive
                                  ? `Deactivate ${partner.name}`
                                  : `Activate ${partner.name}`
                              }
                            >
                              {partner.isActive ? (
                                <>
                                  <ToggleRight className="w-4 h-4 text-success-600" aria-hidden="true" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-4 h-4 text-surface-400" aria-hidden="true" />
                                  Enable
                                </>
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(partner)}
                              aria-label={`Edit ${partner.name}`}
                            >
                              <Pencil className="w-4 h-4" aria-hidden="true" />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Referral Partner Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPartner ? 'Edit Referral Partner' : 'Register Referral Partner'}
        subtitle="Partners receive unique /inquiry?ref=CODE attribution links for B2B lead tracking and commission ROI."
        icon={<Handshake className="w-4 h-4" />}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Partner Organization / Physician Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Gulf MedConnect Muscat"
              icon={<Building2 className="w-4 h-4" />}
            />

            <Input
              label="Attribution Code"
              required
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                })
              }
              placeholder="e.g., GULF-MUSCAT"
              helperText="Used in /inquiry?ref=CODE links"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Partner Type"
              required
              value={form.partnerType}
              onChange={(val) => setForm({ ...form, partnerType: val })}
              options={REFERRAL_PARTNER_TYPES.map((t) => ({
                value: t,
                label: PARTNER_TYPE_LABELS[t] || t,
              }))}
              className="sm:col-span-1"
            />

            <Input
              label="Country"
              required
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="e.g., Oman"
            />

            <Input
              label="Commission (%)"
              type="number"
              min={0}
              max={50}
              step="0.5"
              required
              value={form.commissionPercent}
              onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
              className="tabular-nums"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Primary Contact Name"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder="e.g., Dr. Tariq Al-Lawati"
            />
            <Input
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="referrals@partner.org"
            />
            <Input
              label="Contact Phone"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="+96891234567"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="partner-notes" className="block text-xs font-medium text-surface-700">
              Agreement Notes
            </label>
            <textarea
              id="partner-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contractual SLA terms, preferred specialties, or billing notes..."
              className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-md text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
            />
          </div>

          <label className="flex items-center gap-2.5 min-h-11 px-3 rounded-md border border-surface-200 bg-surface-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 accent-primary-600 rounded"
            />
            <span className="text-xs font-medium text-surface-800">
              Active partner (accepting attributed inquiries via /inquiry?ref=CODE)
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingPartner ? 'Save Changes' : 'Create Partner'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
