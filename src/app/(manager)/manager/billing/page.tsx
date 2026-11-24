'use client';

/**
 * Afzal Healthcare — Manager Patient Billing & Invoicing Workspace
 * Upload medical bills, create itemized line-item breakdowns, track payment statuses, and attach receipts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import type { MultiPageOcrExtractionResult } from '@/lib/services/billing-ocr.service';
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Layers,
  X,
  CreditCard,
  Percent,
  UploadCloud,
  FileCheck2,
  Ban,
} from 'lucide-react';

interface BillItemData {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: string;
}

interface MedicalBillData {
  id: string;
  caseId?: string;
  hospitalId?: string | null;
  billNumber: string;
  title: string;
  category: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | string;
  dueDate?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  notes?: string | null;
  createdAt: string;
  patient: {
    id: string;
    user: {
      fullName: string;
      email: string;
    };
  };
  hospital?: {
    id?: string;
    name: string;
    city: string;
  } | null;
  items: BillItemData[];
}

interface CaseOption {
  caseId: string;
  patientId: string;
  patientName: string;
  caseStatus: string;
}

interface HospitalOption {
  id: string;
  name: string;
  city: string;
}

interface MetadataCaseItem {
  id: string;
  patientId: string;
  status: string;
  createdAt: string;
  patient?: {
    id: string;
    user?: {
      fullName?: string;
      email?: string;
    };
  };
}

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'HOSPITAL_SURGERY', label: 'Hospital & Surgery Bill', description: 'In-patient surgical procedures, OT, and bed charges' },
  { value: 'PHARMACY', label: 'Pharmacy & Implants', description: 'Medications, stents, prosthetics, and supplies' },
  { value: 'DIAGNOSTICS', label: 'Diagnostics & Radiology', description: 'MRI, CT, Angiography, Pathology panels' },
  { value: 'CONSULTATION', label: 'Doctor Consultation Fees', description: 'Specialist physician evaluation rounds' },
  { value: 'GENERAL', label: 'General Administrative Logistics', description: 'Visa assistance, transport, translation' },
];

const ITEM_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'SURGERY_OT', label: 'Surgery & OT Charges' },
  { value: 'BED_RENT', label: 'ICU / Ward Bed Rent' },
  { value: 'PHARMACY', label: 'Pharmacy & Implants' },
  { value: 'DIAGNOSTICS', label: 'Diagnostics & Imaging' },
  { value: 'CONSULTATION', label: 'Doctor Consultation' },
  { value: 'ADMIN_SERVICE', label: 'Administrative Service' },
];

export default function ManagerBillingPage() {
  const [bills, setBills] = useState<MedicalBillData[]>([]);
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Views
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<MedicalBillData | null>(null);

  // Settlement Drawer State (inside selectedBillForDetails modal)
  const [settlementPaymentAmount, setSettlementPaymentAmount] = useState('');
  const [settlementStatus, setSettlementStatus] = useState('PENDING');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isUpdatingBill, setIsUpdatingBill] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [billTitle, setBillTitle] = useState('');
  const [billCategory, setBillCategory] = useState('HOSPITAL_SURGERY');
  const [currency, setCurrency] = useState('USD');
  const [billStatus, setBillStatus] = useState('PENDING');
  const [paidAmountInput, setPaidAmountInput] = useState('0');
  const [dueDateInput, setDueDateInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [billFile, setBillFile] = useState<File | null>(null);

  // OCR Processing States
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrSuccessData, setOcrSuccessData] = useState<{
    confidence: number;
    extractionMode: 'PDF_TEXT' | 'SCANNED_FALLBACK';
    hospitalName?: string;
    invoiceNumber?: string;
    itemCount: number;
    pageCount: number;
    pages: { pageNumber: number; itemsFound: number; pageSubtotal: number }[];
  } | null>(null);

  const handleOcrFileUpload = async (filesInput: FileList | File[]) => {
    const files = Array.from(filesInput).filter((f) => f && f.size > 0);
    if (files.length === 0) return;

    setBillFile(files[0]);
    setIsOcrScanning(true);
    setOcrSuccessData(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/v1/manager/billing/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.data?.ocr) {
        const ocr = data.data.ocr as MultiPageOcrExtractionResult;
        setBillTitle(ocr.title || 'Multi-Page Hospital Medical Bill');
        setBillCategory(ocr.category || 'HOSPITAL_SURGERY');
        setCurrency(ocr.currency || 'USD');

        if (ocr.items && ocr.items.length > 0) {
          setLineItems(
            ocr.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              amount: it.amount,
              category: it.category,
            }))
          );
        }

        const confidencePct = Math.round((ocr.confidenceScore ?? 0.65) * 100);
        setOcrSuccessData({
          confidence: confidencePct,
          extractionMode: ocr.extractionMode,
          hospitalName: ocr.hospitalName,
          invoiceNumber: ocr.invoiceNumber,
          itemCount: ocr.items?.length || 0,
          pageCount: ocr.pageCount || 1,
          pages: ocr.pages || [],
        });

        if (ocr.extractionMode === 'SCANNED_FALLBACK') {
          toast.warning(
            'Scanned image fallback active — please verify and enter line-item amounts manually.',
            'Verify Line Items'
          );
        } else {
          toast.success(
            `Digital PDF text extracted ${ocr.items?.length || 0} line items across ${ocr.pageCount || 1} page(s).`,
            'PDF Extraction Complete'
          );
        }
      } else {
        toast.apiError(data, 'Failed to parse bill with OCR. You can enter items manually.', 'OCR Warning');
      }
    } catch (err) {
      console.error('Multi-Page OCR Error', err);
      toast.apiError(err, 'OCR Connection Error', 'Scan Failed');
    } finally {
      setIsOcrScanning(false);
    }
  };

  // Dynamic Line Items State
  const [lineItems, setLineItems] = useState<BillItemData[]>([
    { description: 'Operating Suite & Surgical Charges', quantity: 1, unitPrice: 1500, amount: 1500, category: 'SURGERY_OT' },
  ]);

  const fetchBillingData = async () => {
    try {
      const res = await fetch('/api/v1/manager/billing?meta=true');
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.apiError(data, 'Failed to load billing data', 'Fetch Error');
        return;
      }

      setBills(data.data.bills || []);

      const rawCases: MetadataCaseItem[] = data.data.metadata?.cases || [];
      const opts: CaseOption[] = rawCases.map((c) => ({
        caseId: c.id,
        patientId: c.patientId,
        patientName: c.patient?.user?.fullName || 'Patient',
        caseStatus: c.status,
      }));
      setCaseOptions(opts);

      const rawHospitals: HospitalOption[] = data.data.metadata?.hospitals || [];
      setHospitals(rawHospitals);

      if (opts.length > 0) {
        setSelectedCaseId((prev) =>
          opts.some((o) => o.caseId === prev) ? prev : opts[0].caseId
        );
      }
    } catch (err) {
      console.error('Failed to load billing workspace', err);
      toast.apiError(err, 'Failed to load billing data', 'Fetch Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchBillingData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openBillDetails = (bill: MedicalBillData) => {
    setSelectedBillForDetails(bill);
    setSettlementPaymentAmount('');
    setSettlementStatus(bill.status);
    setSettlementNotes(bill.notes || '');
  };

  const handleBillSettlement = async (markPaidInFull: boolean) => {
    if (!selectedBillForDetails) return;

    const totalAmount = Number(selectedBillForDetails.totalAmount) || 0;
    const paidAmount = Number(selectedBillForDetails.paidAmount) || 0;
    const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

    const payload: Record<string, unknown> = {
      billId: selectedBillForDetails.id,
    };

    if (markPaidInFull) {
      payload.paidAmount = totalAmount;
      payload.status = 'PAID';
      if (settlementNotes.trim() !== (selectedBillForDetails.notes || '').trim()) {
        payload.notes = settlementNotes.trim();
      }
    } else {
      const parsedIncrement = settlementPaymentAmount.trim()
        ? parseFloat(settlementPaymentAmount)
        : 0;

      if (settlementPaymentAmount.trim()) {
        if (!Number.isFinite(parsedIncrement) || parsedIncrement <= 0) {
          toast.error('Payment increment must be a positive amount.', 'Validation Error');
          return;
        }
        if (parsedIncrement > remaining + 0.005) {
          toast.error(`Payment increment cannot exceed remaining balance ($${remaining.toFixed(2)}).`, 'Validation Error');
          return;
        }
        payload.paymentAmount = parsedIncrement;
      }

      payload.status = settlementStatus;
      payload.notes = settlementNotes.trim();
    }

    setIsUpdatingBill(true);
    try {
      const res = await fetch('/api/v1/manager/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.bill) {
        const updatedBill = data.data.bill as MedicalBillData;
        setBills((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)));
        openBillDetails(updatedBill);
        toast.success(
          markPaidInFull
            ? `Invoice ${updatedBill.billNumber} marked as Paid in Full.`
            : `Invoice ${updatedBill.billNumber} updated (${updatedBill.status.replace(/_/g, ' ')}).`,
          'Bill Updated'
        );
      } else {
        toast.apiError(data, 'Failed to update medical bill', 'Update Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error updating medical bill', 'Connection Error');
    } finally {
      setIsUpdatingBill(false);
    }
  };

  // Line Item Handlers
  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: '', quantity: 1, unitPrice: 0, amount: 0, category: 'SURGERY_OT' },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof BillItemData, value: string | number) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? parseInt(String(value), 10) || 0 : item.quantity;
      const price = field === 'unitPrice' ? parseFloat(String(value)) || 0 : item.unitPrice;
      item.amount = qty * price;
    }

    updated[index] = item;
    setLineItems(updated);
  };

  const computedTotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (item.amount || 0), 0);
  }, [lineItems]);

  const selectedPatientId = useMemo(
    () => caseOptions.find((opt) => opt.caseId === selectedCaseId)?.patientId ?? '',
    [caseOptions, selectedCaseId]
  );

  const handleCaseSelectChange = (caseIdVal: string) => {
    setSelectedCaseId(caseIdVal);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedCaseId || !billTitle.trim()) {
      toast.error('Please complete all required fields.', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('caseId', selectedCaseId);
      formData.append('patientId', selectedPatientId);
      if (selectedHospitalId) formData.append('hospitalId', selectedHospitalId);
      formData.append('title', billTitle.trim());
      formData.append('category', billCategory);
      formData.append('currency', currency);
      formData.append('status', billStatus);
      formData.append('paidAmount', paidAmountInput || '0');
      if (dueDateInput) formData.append('dueDate', dueDateInput);
      if (notesInput) formData.append('notes', notesInput);
      formData.append('items', JSON.stringify(lineItems));
      if (billFile) formData.append('file', billFile);

      const res = await fetch('/api/v1/manager/billing', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Invoice ${data.data.bill.billNumber} created with ${lineItems.length} itemized breakdowns!`, 'Bill Created');
        setIsModalOpen(false);
        resetForm();
        void fetchBillingData();
      } else {
        toast.apiError(data, 'Failed to create medical bill', 'Creation Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error creating bill', 'Connection Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedHospitalId('');
    setBillTitle('');
    setBillCategory('HOSPITAL_SURGERY');
    setCurrency('USD');
    setBillStatus('PENDING');
    setPaidAmountInput('0');
    setDueDateInput('');
    setNotesInput('');
    setBillFile(null);
    setOcrSuccessData(null);
    setLineItems([{ description: 'Operating Suite & Surgical Charges', quantity: 1, unitPrice: 1500, amount: 1500, category: 'SURGERY_OT' }]);
  };

  // Metrics
  const metrics = useMemo(() => {
    const activeBills = bills.filter((b) => b.status !== 'CANCELLED');
    const totalRev = activeBills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
    const paidRev = activeBills.reduce((acc, b) => acc + (Number(b.paidAmount) || 0), 0);
    const pendingCount = bills.filter((b) => b.status === 'PENDING').length;
    const partialCount = bills.filter((b) => b.status === 'PARTIALLY_PAID').length;
    return { totalRev, paidRev, pendingCount, partialCount };
  }, [bills]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (activeStatusFilter !== 'ALL' && b.status !== activeStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const patientName = (b.patient?.user?.fullName || '').toLowerCase();
        return b.billNumber.toLowerCase().includes(q) || b.title.toLowerCase().includes(q) || patientName.includes(q);
      }
      return true;
    });
  }, [bills, activeStatusFilter, searchQuery]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid in Full
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <Percent className="w-3 h-3 text-sky-600" /> Partially Paid
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Overdue
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-surface-100 text-surface-700 border border-surface-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <Ban className="w-3 h-3 text-surface-500" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Payment
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-surface-500">Loading patient billing workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Title & Action Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">
            Patient Billing &amp; Itemized Invoicing Workspace
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Upload hospital invoices, configure itemized line-item breakdowns, and issue official financial receipts to international patients.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Medical Bill</span>
        </Button>
      </div>

      {/* ─── KPI Widgets ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Total Invoiced</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              ${metrics.totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-surface-500 mt-1">Across active patient cases</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Paid Amount</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              ${metrics.paidRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-surface-500 mt-1">Settled by patients</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Pending Invoices</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics.pendingCount}
            </p>
            <p className="text-xs text-surface-500 mt-1">Awaiting payment settlement</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-surface-500">Partially Paid</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900 mt-1.5">
              {metrics.partialCount}
            </p>
            <p className="text-xs text-surface-500 mt-1">Deposit received</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* ─── Search & Status Filters ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['ALL', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setActiveStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${
                activeStatusFilter === st
                  ? 'bg-surface-900 text-white border-surface-900'
                  : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
          <input
            type="text"
            placeholder="Search invoice #, title, or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-surface-300 rounded-md text-xs text-surface-900 placeholder-surface-400 focus:outline-none focus:border-primary-600 w-full sm:w-64"
          />
        </div>
      </div>

      {/* ─── Medical Bills Table ────────────────────────────────────────── */}
      <Card className="!p-0 overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-md bg-surface-100 text-surface-500 border border-surface-200 flex items-center justify-center mx-auto">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-surface-900">No medical bills found</h2>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              Click &lsquo;Create New Medical Bill&rsquo; to issue itemized hospital invoices for your patients.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Invoice # &amp; Title</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Itemized Breakdown</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Total Amount</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Paid Balance</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Status</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-mono font-medium text-surface-500 block">
                        {bill.billNumber}
                      </span>
                      <p className="text-xs font-semibold text-surface-900 mt-0.5" title={bill.title}>
                        {bill.title}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5 tabular-nums">
                        Issued: {new Date(bill.createdAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface-100 text-surface-700 border border-surface-200 font-semibold flex items-center justify-center text-xs shrink-0">
                          {bill.patient?.user?.fullName?.charAt(0) || 'P'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-surface-900 truncate">{bill.patient?.user?.fullName}</p>
                          <p className="text-xs text-surface-500 truncate">{bill.patient?.user?.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => openBillDetails(bill)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-50 hover:bg-surface-100 text-surface-700 rounded-md text-xs font-medium border border-surface-200 transition-colors tabular-nums"
                      >
                        <Layers className="w-3.5 h-3.5 text-surface-500" />
                        <span>{bill.items?.length || 0} Sub-Items</span>
                      </button>
                    </td>

                    <td className="px-4 py-3.5 font-semibold tabular-nums text-surface-900 text-sm">
                      ${Number(bill.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-[11px] font-normal text-surface-500 block">{bill.currency}</span>
                    </td>

                    <td className="px-4 py-3.5 tabular-nums">
                      <p className="font-medium text-emerald-700">
                        ${Number(bill.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-surface-500">
                        Due: ${Math.max(0, Number(bill.totalAmount) - Number(bill.paidAmount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">{renderStatusBadge(bill.status)}</td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bill.fileUrl && (
                          <a
                            href={bill.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-surface-600 hover:text-surface-900 hover:bg-surface-100 rounded-md transition-colors"
                            title="Download Hospital PDF Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openBillDetails(bill)}
                          className="px-2.5 py-1.5 bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 rounded-md text-xs font-medium transition-colors"
                        >
                          View &amp; Settle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Itemized Breakdown & Settlement Modal / Drawer ─────────────── */}
      {selectedBillForDetails && (
        <div className="fixed inset-0 z-50 bg-surface-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-md border border-surface-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-surface-500">
                    {selectedBillForDetails.billNumber}
                  </span>
                  {renderStatusBadge(selectedBillForDetails.status)}
                </div>
                <h2 className="text-base font-semibold text-surface-900 mt-1">
                  {selectedBillForDetails.title}
                </h2>
                <p className="text-xs text-surface-500 mt-0.5 flex flex-wrap items-center gap-3">
                  <span>
                    Patient: <span className="font-medium text-surface-800">{selectedBillForDetails.patient?.user?.fullName}</span>
                  </span>
                  {selectedBillForDetails.hospital && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-surface-400" />
                      {selectedBillForDetails.hospital.name} ({selectedBillForDetails.hospital.city})
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close bill details modal"
                onClick={() => setSelectedBillForDetails(null)}
                className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Balance Summary Strip */}
            <div className="grid grid-cols-3 gap-3 bg-surface-50 p-3.5 rounded-md border border-surface-200 text-xs">
              <div>
                <span className="text-surface-500 font-medium block">Invoice Total</span>
                <span className="font-semibold tabular-nums text-surface-900 text-sm mt-0.5 block">
                  ${Number(selectedBillForDetails.totalAmount).toFixed(2)} {selectedBillForDetails.currency}
                </span>
              </div>
              <div>
                <span className="text-surface-500 font-medium block">Paid So Far</span>
                <span className="font-semibold tabular-nums text-emerald-700 text-sm mt-0.5 block">
                  ${Number(selectedBillForDetails.paidAmount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-surface-500 font-medium block">Remaining Due</span>
                <span className="font-semibold tabular-nums text-surface-900 text-sm mt-0.5 block">
                  ${Math.max(0, Number(selectedBillForDetails.totalAmount) - Number(selectedBillForDetails.paidAmount)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-surface-900">
                Itemized Cost Breakdown
              </h3>

              <div className="border border-surface-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200">
                      <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-surface-500">Description</th>
                      <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-center">Category</th>
                      <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-center">Qty</th>
                      <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-right">Unit Price</th>
                      <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200">
                    {selectedBillForDetails.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-50">
                        <td className="px-3 py-2.5 font-medium text-surface-900">{item.description}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded text-[11px] font-medium border border-surface-200">
                            {item.category || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-surface-600 tabular-nums">${Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-surface-900">${Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface-50 border-t border-surface-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-right text-surface-600 font-medium text-xs">Net Invoice Total</td>
                      <td className="px-3 py-2.5 text-right text-sm text-surface-900 font-semibold tabular-nums">
                        ${Number(selectedBillForDetails.totalAmount).toFixed(2)} {selectedBillForDetails.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment & Status Settlement Panel */}
            <div className="p-4 bg-surface-50 rounded-lg border border-surface-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-surface-900">
                    Payment &amp; Status Settlement
                  </h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Record incremental payments, mark paid in full, or update status and notes.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleBillSettlement(true)}
                  disabled={
                    isUpdatingBill ||
                    selectedBillForDetails.status === 'PAID' ||
                    selectedBillForDetails.status === 'CANCELLED'
                  }
                  className="shrink-0 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Paid in Full</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">
                    Record Incremental Payment ({selectedBillForDetails.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={settlementPaymentAmount}
                    onChange={(e) => setSettlementPaymentAmount(e.target.value)}
                    disabled={selectedBillForDetails.status === 'CANCELLED' || isUpdatingBill}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Status</label>
                  <select
                    value={settlementStatus}
                    onChange={(e) => setSettlementStatus(e.target.value)}
                    disabled={isUpdatingBill}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-700 block">Billing / Settlement Notes</label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  disabled={isUpdatingBill}
                  placeholder="Add receipt reference, wire details, or coordinator remarks..."
                  className="w-full p-2.5 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleBillSettlement(false)}
                  disabled={isUpdatingBill}
                >
                  {isUpdatingBill ? 'Saving Changes...' : 'Save Settlement & Status'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {selectedBillForDetails.fileUrl ? (
                <a
                  href={selectedBillForDetails.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-white text-surface-700 hover:bg-surface-50 border border-surface-300 rounded-md text-xs font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Official PDF Invoice
                </a>
              ) : (
                <div />
              )}

              <Button
                type="button"
                size="sm"
                onClick={() => setSelectedBillForDetails(null)}
                variant="secondary"
              >
                Close Breakdown
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Medical Bill Modal ──────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 space-y-5 shadow-md border border-surface-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-surface-900">
                  Create Patient Medical Bill &amp; Invoice
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Issue an itemized hospital bill with cost breakdowns for international patients.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close create bill modal"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* ─── OCR Bill Auto-Scanner Dropzone ───────────────────────── */}
              <div className="p-4 bg-surface-50 border border-surface-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-white text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
                      <UploadCloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-surface-900 flex flex-wrap items-center gap-2">
                        <span>Smart OCR Bill Auto-Scanner</span>
                        <span className="bg-primary-50 text-primary-700 text-[11px] font-medium px-2 py-0.5 rounded border border-primary-200">
                          PDF Stream Extract
                        </span>
                      </h3>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Upload a hospital PDF invoice or scan to populate line-item breakdowns.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative border border-dashed border-surface-300 hover:border-primary-500 rounded-md p-3.5 bg-white transition-colors text-center cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleOcrFileUpload(e.target.files);
                      }
                    }}
                    disabled={isOcrScanning}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {isOcrScanning ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-primary-700 py-1">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      <span>Scanning multi-page medical bill...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-surface-600 py-1">
                      <UploadCloud className="w-4 h-4 text-surface-400" />
                      <span>Drop multi-page bill or batch files here (PDF/JPG/PNG) for OCR extraction</span>
                    </div>
                  )}
                </div>

                {ocrSuccessData && (
                  <div
                    className={`p-3 rounded-md border text-xs space-y-2 ${
                      ocrSuccessData.extractionMode === 'SCANNED_FALLBACK'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileCheck2
                          className={`w-4 h-4 shrink-0 ${
                            ocrSuccessData.extractionMode === 'SCANNED_FALLBACK'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        />
                        <div>
                          <p className="font-semibold text-surface-900">
                            {ocrSuccessData.extractionMode === 'SCANNED_FALLBACK'
                              ? 'Raster / Scanned Document Loaded'
                              : `Multi-Page OCR Stitched (${ocrSuccessData.confidence}% Confidence)`}
                          </p>
                          <p className="text-xs text-surface-600">
                            {ocrSuccessData.itemCount} sub-items across {ocrSuccessData.pageCount} page(s)
                            {ocrSuccessData.hospitalName ? ` (${ocrSuccessData.hospitalName})` : ''}.
                          </p>
                        </div>
                      </div>
                      {ocrSuccessData.extractionMode === 'SCANNED_FALLBACK' ? (
                        <span className="text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                          Scanned Image Fallback — Please verify line-item amounts
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                          Digital PDF Text Extracted
                        </span>
                      )}
                    </div>

                    {/* Page-by-Page Audit Tray */}
                    {ocrSuccessData.pages && ocrSuccessData.pages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-200">
                        {ocrSuccessData.pages.map((p) => (
                          <span
                            key={p.pageNumber}
                            className="bg-white text-surface-700 text-[11px] font-medium px-2 py-0.5 rounded border border-surface-200 flex items-center gap-1 tabular-nums"
                          >
                            <span>Page {p.pageNumber}:</span>
                            <span>{p.itemsFound} items</span>
                            <span className="font-semibold text-surface-900">
                              (${p.pageSubtotal.toFixed(2)})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Patient Case, Hospital & General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Select Patient &amp; Case</label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => handleCaseSelectChange(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  >
                    {caseOptions.length === 0 ? (
                      <option value="">No active cases available</option>
                    ) : (
                      caseOptions.map((opt) => (
                        <option key={opt.caseId} value={opt.caseId}>
                          {opt.patientName} — Case #{opt.caseId.slice(-6)} ({opt.caseStatus})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Partner Hospital (Optional)</label>
                  <select
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                  >
                    <option value="">None / Unspecified</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Invoice Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Surgical & Hospital Care Bill"
                    value={billTitle}
                    onChange={(e) => setBillTitle(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Bill Category</label>
                  <Select
                    options={CATEGORY_OPTIONS}
                    value={billCategory}
                    onChange={(val) => setBillCategory(val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Payment Status</label>
                  <select
                    value={billStatus}
                    onChange={(e) => setBillStatus(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
                  >
                    <option value="PENDING">PENDING (Unpaid)</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID (Deposit Received)</option>
                    <option value="PAID">PAID IN FULL</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Paid Deposit Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Due Date</label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-700 block">Billing Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="Payment instructions or invoice remarks"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>
              </div>

              {/* Dynamic Line-Item Breakdown Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-surface-900">
                    Itemized Sub-Charge Breakdowns
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addLineItem}
                    variant="secondary"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-surface-50 rounded-md border border-surface-200 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Sub-item description (e.g. Operating Theater)"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-md text-xs text-surface-900 focus:outline-none focus:border-primary-600"
                          required
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateLineItem(idx, 'category', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-md text-[11px] font-medium text-surface-900 focus:outline-none"
                        >
                          {ITEM_CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-1">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-center focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Price ($)"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-md text-xs font-medium tabular-nums text-right focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-between pl-2">
                        <span className="text-xs font-semibold tabular-nums text-surface-900">${(item.amount || 0).toFixed(2)}</span>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="p-1 text-surface-400 hover:text-rose-600 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-surface-50 rounded-md border border-surface-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-600">Total Calculated Invoice Amount</span>
                  <span className="text-base font-semibold tracking-tight tabular-nums text-surface-900">
                    ${computedTotal.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Upload PDF Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-700 block">
                  Attach Official Hospital PDF Invoice (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-surface-600 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-md file:border file:border-surface-300 file:text-xs file:font-medium file:bg-white file:text-surface-700 hover:file:bg-surface-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {!isSubmitting && <Receipt className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Creating Invoice...' : 'Issue Medical Bill'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
