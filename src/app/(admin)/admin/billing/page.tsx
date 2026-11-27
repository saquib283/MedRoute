'use client';

/**
 * MediRoute India — Master Billing & Commission Engine Command Center
 * Comprehensive financial management with dynamic commission rules and partner settlements.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  PlusCircle,
  Settings,
  Scale,
} from 'lucide-react';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  milestoneName: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  case?: { patient?: { nationality: string; user?: { fullName: string } } };
  hospital?: { name: string };
  commissionAmount: number | null;
}

interface CommissionRuleItem {
  id: string;
  ruleName: string;
  category: string;
  partnerName: string | null;
  ratePercent: number;
  flatFee: number | null;
  isActive: boolean;
  notes: string | null;
}

interface SettlementItem {
  id: string;
  settlementNumber: string;
  partnerType: string;
  partnerName: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netPayable: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  createdAt: string;
  invoice?: { invoiceNumber: string; case?: { patient?: { user?: { fullName: string } } } };
}

export default function AdminBillingMasterPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Invoices State
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSummary, setInvoiceSummary] = useState<{ totalBilled: number; totalPaid: number; totalOutstanding: number; totalCommission: number } | null>(null);

  // Commission Rules State
  const [rules, setRules] = useState<CommissionRuleItem[]>([]);
  const [partners, setPartners] = useState<{ hospitals: { id: string; name: string }[]; hostels: { id: string; name: string }[] }>({ hospitals: [], hostels: [] });
  const [, setLoadingRules] = useState(false);

  // New Rule Form State
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState('HOSPITAL_SURGICAL');
  const [ruleRate, setRuleRate] = useState('12.5');
  const [rulePartnerId, setRulePartnerId] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  // Settlements State
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const res = await fetch('/api/v1/finance/invoices');
      const d = await res.json();
      if (d.success && d.data) {
        setInvoices(d.data.invoices);
        setInvoiceSummary(d.data.summary);
      }
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // Fetch Rules
  const fetchRules = useCallback(async () => {
    try {
      setLoadingRules(true);
      const res = await fetch('/api/v1/finance/commission-rules');
      const d = await res.json();
      if (d.success && d.data) {
        setRules(d.data.rules);
        setPartners(d.data.partners);
      }
    } catch {
      toast.error('Failed to load commission rules');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // Fetch Settlements
  const fetchSettlements = useCallback(async () => {
    try {
      setLoadingSettlements(true);
      const res = await fetch('/api/v1/finance/settlements');
      const d = await res.json();
      if (d.success && d.data) {
        setSettlements(d.data.settlements);
      }
    } catch {
      toast.error('Failed to load settlements');
    } finally {
      setLoadingSettlements(false);
    }
  }, []);

  const [settlementModalId, setSettlementModalId] = useState<string | null>(null);
  const [utrReference, setUtrReference] = useState('');
  const [processingSettlement, setProcessingSettlement] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      fetchInvoices();
      fetchRules();
      fetchSettlements();
    });
  }, [fetchInvoices, fetchRules, fetchSettlements]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleRate) {
      toast.error('Please fill required rule fields');
      return;
    }

    try {
      setSavingRule(true);
      let selectedPartnerName: string | undefined;
      if (rulePartnerId) {
        const h = partners.hospitals.find((p) => p.id === rulePartnerId);
        const hst = partners.hostels.find((p) => p.id === rulePartnerId);
        selectedPartnerName = h?.name || hst?.name;
      }

      const res = await fetch('/api/v1/finance/commission-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleName,
          category: ruleCategory,
          partnerId: rulePartnerId || null,
          partnerName: selectedPartnerName || null,
          ratePercent: parseFloat(ruleRate),
        }),
      });

      const d = await res.json();
      if (d.success) {
        toast.success('Commission rule saved successfully!');
        setShowAddRule(false);
        setRuleName('');
        fetchRules();
      } else {
        toast.error(d.error || 'Failed to save rule');
      }
    } catch {
      toast.error('Network error creating rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleProcessSettlement = (id: string) => {
    setSettlementModalId(id);
    setUtrReference('');
  };

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementModalId || !utrReference.trim()) {
      toast.error('Please enter transfer reference number');
      return;
    }

    setProcessingSettlement(true);
    try {
      const res = await fetch('/api/v1/finance/settlements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settlementModalId, status: 'PROCESSED', paymentReference: utrReference.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success('Partner payout marked as processed');
        setSettlementModalId(null);
        setUtrReference('');
        fetchSettlements();
      } else {
        toast.error(d.error || 'Failed to process settlement');
      }
    } catch {
      toast.error('Failed to process settlement');
    } finally {
      setProcessingSettlement(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader
        title="Billing &amp; Commission Engine"
        subtitle="Multi-party split invoices, partner commission rules, and payout settlements"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Billing & Commissions' },
        ]}
      />

      {/* High-Level Revenue Header */}
      {invoiceSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block">Total Patient Billings</span>
            <span className="text-2xl font-bold text-surface-900 font-mono block">
              ₹{invoiceSummary.totalBilled.toLocaleString()}
            </span>
            <span className="text-xs text-surface-500 block">All international packages</span>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block">Platform Commission</span>
            <span className="text-2xl font-bold text-primary-800 font-mono block">
              ₹{invoiceSummary.totalCommission.toLocaleString()}
            </span>
            <span className="text-xs text-surface-500 block">Net retained platform margin</span>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block">Collections Realized</span>
            <span className="text-2xl font-bold text-success-700 font-mono block">
              ₹{invoiceSummary.totalPaid.toLocaleString()}
            </span>
            <span className="text-xs text-surface-500 block">Settled via wire transfers</span>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block">Outstanding Balance</span>
            <span className="text-2xl font-bold text-warning-700 font-mono block">
              ₹{invoiceSummary.totalOutstanding.toLocaleString()}
            </span>
            <span className="text-xs text-surface-500 block">Awaiting milestone settlement</span>
          </Card>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs
          tabs={[
            { id: 'overview', label: 'All Invoices & Milestones', icon: <Receipt className="w-4 h-4" /> },
            { id: 'rules', label: 'Commission Rules Configurator', icon: <Settings className="w-4 h-4" /> },
            { id: 'settlements', label: 'Partner Payout Settlements', icon: <Scale className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <Link href="/admin/billing/create">
          <Button size="sm" className="!text-xs shrink-0 shadow-sm">
            <PlusCircle className="w-4 h-4 mr-1.5" /> Create Master Split Invoice
          </Button>
        </Link>
      </div>

      {/* Tab 1: All Invoices & Milestones */}
      {activeTab === 'overview' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
            <div className="pb-3 border-b border-surface-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-surface-900">Master Patient Invoices & Milestone Installments</h3>
                <p className="text-xs text-surface-500">Multi-currency invoices with automatic partner split calculations.</p>
              </div>
            </div>

            {loadingInvoices ? (
              <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center text-xs text-surface-400">No invoices generated yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Invoice No</th>
                      <th className="pb-2.5 px-3">Patient & Country</th>
                      <th className="pb-2.5 px-3">Milestone / Type</th>
                      <th className="pb-2.5 px-3">Total Amount</th>
                      <th className="pb-2.5 px-3">MedRoute Cut</th>
                      <th className="pb-2.5 px-3">Status</th>
                      <th className="pb-2.5 px-3 text-right">Issued Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-900 block">{inv.case?.patient?.user?.fullName || 'Patient'}</span>
                          <span className="text-[10px] text-surface-500">{inv.case?.patient?.nationality}</span>
                        </td>
                        <td className="py-3 px-3">
                          {inv.milestoneName ? (
                            <span className="font-semibold text-primary-800 text-[11px] block">{inv.milestoneName}</span>
                          ) : (
                            <span className="uppercase text-[10px] font-bold text-surface-600">{inv.invoiceType}</span>
                          )}
                          <span className="text-[10px] text-surface-400 font-mono">Hospital: {inv.hospital?.name || 'MedRoute Network'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-surface-900">
                          {inv.currency} {Number(inv.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">
                          {inv.currency} {Number(inv.commissionAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                        <td className="py-3 px-3 text-right text-surface-600">
                          {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      {/* Tab 2: Commission Rules Configurator */}
      {activeTab === 'rules' && (
        <TabPanel>
          <div className="space-y-6">
            <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-100">
                <div>
                  <h3 className="text-base font-bold text-surface-900">Configurable Commission Rules Matrix</h3>
                  <p className="text-xs text-surface-500">
                    Define global category percentages or partner-specific override rates for Hospitals and Hotels.
                  </p>
                </div>

                <Button size="sm" onClick={() => setShowAddRule(!showAddRule)} className="!text-xs">
                  <PlusCircle className="w-3.5 h-3.5 mr-1" /> {showAddRule ? 'Close Form' : 'Add Custom Rule'}
                </Button>
              </div>

              {/* Add Rule Inline Form */}
              {showAddRule && (
                <form onSubmit={handleCreateRule} className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3 text-xs animate-scale-in">
                  <span className="font-bold text-surface-900 text-sm block">Create New Commission Rule</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-surface-700 mb-1">Rule Name</label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="e.g. Fortis Cardiac Commission"
                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-surface-700 mb-1">Category</label>
                      <select
                        value={ruleCategory}
                        onChange={(e) => setRuleCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                      >
                        <option value="HOSPITAL_SURGICAL">Hospital Surgical Packages</option>
                        <option value="HOTEL_ACCOMMODATION">Hotel / Guest House Stays</option>
                        <option value="LOGISTICS_TRANSFER">Airport Transfers & Logistics</option>
                        <option value="FACILITATION_FEE">Platform Facilitation Margin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-surface-700 mb-1">Specific Partner (Optional)</label>
                      <select
                        value={rulePartnerId}
                        onChange={(e) => setRulePartnerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                      >
                        <option value="">Global Category Default (All Partners)</option>
                        <optgroup label="Hospitals">
                          {partners.hospitals.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Hotels & Hostels">
                          {partners.hostels.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-surface-700 mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ruleRate}
                        onChange={(e) => setRuleRate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddRule(false)}>Cancel</Button>
                    <Button type="submit" size="sm" isLoading={savingRule} disabled={savingRule}>Save Rule</Button>
                  </div>
                </form>
              )}

              {/* Rules Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Rule Name</th>
                      <th className="pb-2.5 px-3">Category</th>
                      <th className="pb-2.5 px-3">Scope / Partner</th>
                      <th className="pb-2.5 px-3">Commission Cut (%)</th>
                      <th className="pb-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {rules.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-bold text-surface-900">{r.ruleName}</td>
                        <td className="py-3 px-3 uppercase text-[10px] font-bold text-primary-800">{r.category.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 font-medium text-surface-700">
                          {r.partnerName ? (
                            <span className="font-bold text-surface-900">{r.partnerName}</span>
                          ) : (
                            <span className="text-surface-400 italic">Global Default</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-primary-700 text-sm">{r.ratePercent}%</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-success-700 font-bold text-[10px] px-2 py-0.5 rounded bg-success-50 border border-success-200">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabPanel>
      )}

      {/* Tab 3: Partner Settlements & Payouts */}
      {activeTab === 'settlements' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
            <div className="pb-3 border-b border-surface-100">
              <h3 className="text-base font-bold text-surface-900">B2B Partner Settlement & Payout Vouchers</h3>
              <p className="text-xs text-surface-500">
                Disbursements owed to Hospitals and Guest Houses after deducting MedRoute facilitation cuts.
              </p>
            </div>

            {loadingSettlements ? (
              <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : settlements.length === 0 ? (
              <div className="py-16 text-center text-xs text-surface-400">No partner settlements pending.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Voucher No</th>
                      <th className="pb-2.5 px-3">Partner & Type</th>
                      <th className="pb-2.5 px-3">Gross Billed</th>
                      <th className="pb-2.5 px-3">MedRoute Cut</th>
                      <th className="pb-2.5 px-3">Net Payout to Partner</th>
                      <th className="pb-2.5 px-3">Status</th>
                      <th className="pb-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">{s.settlementNumber}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-900 block">{s.partnerName}</span>
                          <span className="text-[10px] text-surface-400 uppercase font-mono">{s.partnerType}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-surface-800">₹{Number(s.grossAmount).toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-primary-800">
                          ₹{Number(s.commissionAmount).toLocaleString()} ({s.commissionRate}%)
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-success-700 text-sm">
                          ₹{Number(s.netPayable).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={s.status} />
                          {s.paymentReference && (
                            <span className="block text-[10px] font-mono text-surface-400 mt-0.5">Ref: {s.paymentReference}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {s.status !== 'PROCESSED' && (
                            <Button size="sm" onClick={() => handleProcessSettlement(s.id)} className="!text-xs">
                              Record Payout UTR
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      <Modal
        open={!!settlementModalId}
        onClose={() => {
          setSettlementModalId(null);
          setUtrReference('');
        }}
        title="Record Partner Payout UTR"
        subtitle="Confirm bank settlement reference for partner reconciliation"
        maxWidth="md"
      >
        <form onSubmit={submitSettlement} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-surface-700">
              Bank UTR / Remittance Reference Number *
            </label>
            <input
              type="text"
              required
              value={utrReference}
              onChange={(e) => setUtrReference(e.target.value)}
              placeholder="e.g. HDFC524891003421"
              className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSettlementModalId(null);
                setUtrReference('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={processingSettlement}>
              Confirm Settlement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
