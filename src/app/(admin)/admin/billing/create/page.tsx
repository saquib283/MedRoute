'use client';

/**
 * MediRoute India — Dedicated Master Split Invoice Builder
 * Full page for creating multi-party split invoices or 3-stage milestone installments.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Receipt,
  Scale,
  Building2,
  Hotel,
  Layers,
  Send,
  DollarSign,
  Calculator,
} from 'lucide-react';

interface CaseOption {
  id: string;
  patient: {
    nationality: string;
    user: { fullName: string; email: string };
  };
}

interface HospitalOption {
  id: string;
  name: string;
  commissionRate: number | null;
}

interface HostelOption {
  id: string;
  name: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

export default function CreateMasterInvoicePage() {
  const router = useRouter();

  const [cases, setCases] = useState<CaseOption[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isMilestoneMode, setIsMilestoneMode] = useState(false);
  const [procedureTitle, setProcedureTitle] = useState('Comprehensive Surgical & Hospital Package');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: 'Hospital Surgical & OT Charges (Includes Surgeon & Anaesthetist Fees)', quantity: 1, unitPrice: 5000, category: 'PROCEDURE' },
    { description: 'Medical Guest House Deluxe Accommodation (7 Nights + Cardiac Diet)', quantity: 7, unitPrice: 80, category: 'ROOM' },
    { description: 'Airport Stretcher & Specialized Ambulance Transfer', quantity: 2, unitPrice: 60, category: 'TRANSPORT' },
    { description: 'MediRoute Technology Platform & Visa Facilitation Fee', quantity: 1, unitPrice: 300, category: 'FEE' },
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingInitial(true);
        const [casesRes, rulesRes] = await Promise.all([
          fetch('/api/v1/manager/cases'),
          fetch('/api/v1/finance/commission-rules'),
        ]);

        const casesData = await casesRes.json();
        const rulesData = await rulesRes.json();

        if (casesData.success && casesData.data?.cases) {
          setCases(casesData.data.cases);
          if (casesData.data.cases.length > 0) setSelectedCaseId(casesData.data.cases[0].id);
        }

        if (rulesData.success && rulesData.data?.partners) {
          setHospitals(rulesData.data.partners.hospitals);
          setHostels(rulesData.data.partners.hostels);
          if (rulesData.data.partners.hospitals.length > 0) {
            setSelectedHospitalId(rulesData.data.partners.hospitals[0].id);
          }
          if (rulesData.data.partners.hostels.length > 0) {
            setSelectedHostelId(rulesData.data.partners.hostels[0].id);
          }
        }
      } catch {
        toast.error('Failed to load initial form data');
      } finally {
        setLoadingInitial(false);
      }
    };
    loadData();
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, category: 'PROCEDURE' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setLineItems(updated);
  };

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.unitPrice) * (item.quantity || 1), 0);

  // Split calculations
  const hospitalGross = lineItems.filter((i) => i.category === 'PROCEDURE').reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const hotelGross = lineItems.filter((i) => i.category === 'ROOM').reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const logisticsGross = lineItems.filter((i) => i.category === 'TRANSPORT').reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const facilitationGross = lineItems.filter((i) => i.category === 'FEE').reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);

  const hospitalComm = hospitalGross * 0.125; // 12.5%
  const hotelComm = hotelGross * 0.15; // 15%
  const logisticsComm = logisticsGross * 0.20; // 20%
  const totalMedRouteMargin = hospitalComm + hotelComm + logisticsComm + facilitationGross;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) {
      toast.error('Please select a patient case');
      return;
    }

    try {
      setSubmitting(true);

      if (isMilestoneMode) {
        // Generate 3-Stage Milestone Installments
        const res = await fetch('/api/v1/finance/invoices/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId: selectedCaseId,
            hospitalId: selectedHospitalId || null,
            hostelId: selectedHostelId || null,
            totalPackageCost: subtotal,
            currency,
            procedureTitle,
          }),
        });

        const d = await res.json();
        if (d.success) {
          toast.success(`Generated 3-Stage Milestone Installments successfully!`);
          router.push('/admin/billing');
        } else {
          toast.error(d.error || 'Failed to generate milestone invoices');
        }
      } else {
        // Generate Single Consolidated Master Invoice
        const res = await fetch('/api/v1/finance/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId: selectedCaseId,
            hospitalId: selectedHospitalId || null,
            hostelId: selectedHostelId || null,
            invoiceType: 'TREATMENT',
            currency,
            dueDate: dueDate || undefined,
            notes: notes || undefined,
            lineItems,
          }),
        });

        const d = await res.json();
        if (d.success) {
          toast.success(`Invoice ${d.data.invoice.invoiceNumber} created with automated partner splits!`);
          router.push('/admin/billing');
        } else {
          toast.error(d.error || 'Failed to create invoice');
        }
      }
    } catch {
      toast.error('Network error creating invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Link href="/admin/billing">
          <Button variant="ghost" size="sm" className="!p-2 text-surface-600">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <PageHeader
          title="Master Split Invoice Builder"
          subtitle="Generate itemized multi-party invoices with automated partner commission splits and milestone installments"
          breadcrumbs={[
            { label: 'Admin', href: '/admin/dashboard' },
            { label: 'Billing & Commissions', href: '/admin/billing' },
            { label: 'Create Invoice' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4 lg:col-span-2">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary-600" /> Patient & Partner Association
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-surface-700 mb-1">Patient Case Reference</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-medium"
                  required
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.patient?.user?.fullName} ({c.patient?.nationality}) — Case: {c.id.slice(0, 10)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Billing Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-bold"
                >
                  <option value="USD">USD ($) — International Standard</option>
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                  <option value="AED">AED (د.إ) — UAE Dirham</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Operating Hospital</label>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.commissionRate || 12.5}% Cut)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Recovery Accommodation</label>
                <select
                  value={selectedHostelId}
                  onChange={(e) => setSelectedHostelId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                >
                  {hostels.map((hst) => (
                    <option key={hst.id} value={hst.id}>
                      {hst.name} (15% Cut)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invoicing Mode Switch */}
            <div className="p-4 bg-primary-50 rounded-2xl border border-primary-200/80 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-primary-950 block">Generate 3-Stage Milestone Installments?</span>
                <p className="text-primary-800/80 text-[11px]">
                  Automatically creates linked 20% Deposit, 50% Admission, and 30% Discharge invoices with statutory due dates.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isMilestoneMode}
                  onChange={(e) => setIsMilestoneMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-900"></div>
              </label>
            </div>
          </Card>

          {/* Live Commission Margins Widget */}
          <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-3 lg:col-span-1">
            <h3 className="text-sm font-bold text-surface-900 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-primary-600" /> Live Revenue Split Preview
            </h3>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between py-1 border-b border-surface-100">
                <span className="text-surface-600">Hospital Gross ({currency})</span>
                <span className="font-mono font-bold text-surface-900">{hospitalGross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-100 text-primary-700 font-medium">
                <span>&rarr; MedRoute Hospital Cut (12.5%)</span>
                <span className="font-mono font-bold">+{hospitalComm.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-100 text-emerald-700">
                <span>&rarr; Net Hospital Payout</span>
                <span className="font-mono font-bold">{(hospitalGross - hospitalComm).toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-surface-100 pt-2">
                <span className="text-surface-600">Hotel Gross ({currency})</span>
                <span className="font-mono font-bold text-surface-900">{hotelGross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-100 text-primary-700 font-medium">
                <span>&rarr; MedRoute Hotel Cut (15%)</span>
                <span className="font-mono font-bold">+{hotelComm.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-surface-100">
                <span className="text-surface-600">Platform Facilitation Fee</span>
                <span className="font-mono font-bold text-primary-800">+{facilitationGross.toLocaleString()}</span>
              </div>

              <div className="p-3 bg-gradient-to-r from-primary-900 to-primary-800 text-white rounded-xl mt-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-primary-200 block">Total MedRoute Net Margin</span>
                <span className="text-lg font-black font-mono block">
                  {currency} {totalMedRouteMargin.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Line Items Card */}
        <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div>
              <h3 className="text-base font-bold text-surface-900">Itemized Clinical & Concierge Charges</h3>
              <p className="text-xs text-surface-500">Categorize each item to trigger appropriate automated partner commission calculations.</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addLineItem} className="!text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
            </Button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-surface-50 rounded-xl border border-surface-200/80 grid grid-cols-12 gap-3 items-center text-xs">
                <div className="col-span-5">
                  <label className="block text-[10px] font-bold text-surface-500 mb-1">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg outline-none focus:border-primary-500 font-medium"
                    required
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-surface-500 mb-1">Category</label>
                  <select
                    value={item.category}
                    onChange={(e) => updateLineItem(idx, 'category', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg outline-none focus:border-primary-500 font-bold text-primary-800"
                  >
                    <option value="PROCEDURE">Surgical / Hospital Package (12.5%)</option>
                    <option value="ROOM">Accommodation & Recovery (15%)</option>
                    <option value="TRANSPORT">Logistics & Transfers (20%)</option>
                    <option value="FEE">Platform Facilitation Fee (100%)</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-surface-500 mb-1">Qty</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1.5 bg-white border border-surface-200 rounded-lg outline-none focus:border-primary-500 font-mono text-center"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-surface-500 mb-1">Unit Price ({currency})</label>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg outline-none focus:border-primary-500 font-mono font-bold"
                    required
                  />
                </div>

                <div className="col-span-1 flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-1.5 text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-surface-200 flex items-center justify-between">
            <span className="text-sm font-bold text-surface-800">Total Patient Package Amount</span>
            <span className="text-2xl font-black text-surface-900 font-mono">
              {currency} {subtotal.toLocaleString()}
            </span>
          </div>
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200">
          <Link href="/admin/billing">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" isLoading={submitting} disabled={submitting} size="lg" className="shadow-lg">
            <Save className="w-4 h-4 mr-2" />
            {isMilestoneMode ? 'Generate 3-Stage Milestone Invoices' : 'Issue Consolidated Master Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
