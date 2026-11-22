'use client';

/**
 * Afzal Healthcare — Manager Patient Billing & Invoicing Workspace
 * Upload medical bills, create itemized line-item breakdowns, track payment statuses, and attach receipts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  Calendar,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  User,
  Layers,
  X,
  CreditCard,
  Percent,
  Sparkles,
  UploadCloud,
  ScanLine,
  FileCheck2,
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
    name: string;
    city: string;
  } | null;
  items: BillItemData[];
}

interface PatientOption {
  id: string;
  fullName: string;
  caseId: string;
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
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Views
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<MedicalBillData | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
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
      if (data.success && data.data?.ocr) {
        const ocr = data.data.ocr;
        setBillTitle(ocr.title || 'Multi-Page Hospital Medical Bill');
        setBillCategory(ocr.category || 'HOSPITAL_SURGERY');
        setCurrency(ocr.currency || 'USD');

        if (ocr.items && ocr.items.length > 0) {
          setLineItems(
            ocr.items.map((it: any) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              amount: it.amount,
              category: it.category,
            }))
          );
        }

        setOcrSuccessData({
          confidence: Math.round((ocr.confidenceScore || 0.97) * 100),
          hospitalName: ocr.hospitalName,
          invoiceNumber: ocr.invoiceNumber,
          itemCount: ocr.items?.length || 0,
          pageCount: ocr.pageCount || 1,
          pages: ocr.pages || [],
        });

        toast.success(
          `Multi-Page OCR Extracted ${ocr.items?.length || 0} Line-Item Breakdowns Across ${ocr.pageCount || 1} Pages with ${Math.round((ocr.confidenceScore || 0.97) * 100)}% Accuracy!`,
          'Multi-Page Scan Complete'
        );
      } else {
        toast.error('Failed to parse multi-page bill with OCR. You can enter items manually.', 'OCR Warning');
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

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const res = await fetch('/api/v1/manager/billing');
      const data = await res.json();
      if (data.success) {
        setBills(data.data.bills || []);
      }

      // Fetch patient list for select dropdown
      const casesRes = await fetch('/api/v1/patient/cases');
      const casesData = await casesRes.json();
      if (casesData.success && casesData.data?.cases) {
        const opts: PatientOption[] = casesData.data.cases.map((c: any) => ({
          id: c.patientId,
          fullName: c.patient?.user?.fullName || `Patient #${c.patientId.slice(0, 6)}`,
          caseId: c.id,
        }));
        setPatients(opts);
        if (opts.length > 0) {
          setSelectedPatientId(opts[0].id);
          setSelectedCaseId(opts[0].caseId);
        }
      }
    } catch (err) {
      console.error('Failed to load billing workspace', err);
      toast.apiError(err, 'Failed to load billing data', 'Fetch Error');
    } fontally: {
      setIsLoading(false);
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

  const updateLineItem = (index: number, field: keyof BillItemData, value: any) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? parseInt(value) || 0 : item.quantity;
      const price = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
      item.amount = qty * price;
    }

    updated[index] = item;
    setLineItems(updated);
  };

  const computedTotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (item.amount || 0), 0);
  }, [lineItems]);

  const handlePatientSelectChange = (patientIdVal: string) => {
    setSelectedPatientId(patientIdVal);
    const p = patients.find((opt) => opt.id === patientIdVal);
    if (p) setSelectedCaseId(p.caseId);
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
      if (data.success) {
        toast.success(`Invoice ${data.data.bill.billNumber} created with ${lineItems.length} itemized breakdowns!`, 'Bill Created');
        setIsModalOpen(false);
        resetForm();
        fetchBillingData();
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
    setBillTitle('');
    setBillCategory('HOSPITAL_SURGERY');
    setPaidAmountInput('0');
    setDueDateInput('');
    setNotesInput('');
    setBillFile(null);
    setLineItems([{ description: 'Operating Suite & Surgical Charges', quantity: 1, unitPrice: 1500, amount: 1500, category: 'SURGERY_OT' }]);
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalRev = bills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
    const paidRev = bills.reduce((acc, b) => acc + (Number(b.paidAmount) || 0), 0);
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
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid in Full
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold">
            <Percent className="w-3 h-3 text-sky-600" /> Partially Paid
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Payment
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading patient billing workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* ─── Page Title & Action Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary-600" />
            Patient Billing & Itemized Invoicing Workspace
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Upload hospital invoices, configure itemized line-item breakdowns, and issue official financial receipts to international patients.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Medical Bill</span>
        </Button>
      </div>

      {/* ─── KPI Widgets ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-surface-500">Total Invoiced</p>
            <h3 className="text-2xl font-extrabold text-surface-900 mt-1">${metrics.totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs font-medium text-surface-500 mt-0.5">Across active patient cases</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold text-xl shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-surface-500">Paid Amount</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">${metrics.paidRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs font-medium text-surface-500 mt-0.5">Settled by patients</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-xl shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-surface-500">Pending Invoices</p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{metrics.pendingCount}</h3>
            <p className="text-xs font-medium text-surface-500 mt-0.5">Awaiting payment settlement</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold text-xl shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-surface-500">Partially Paid</p>
            <h3 className="text-2xl font-extrabold text-sky-600 mt-1">{metrics.partialCount}</h3>
            <p className="text-xs font-medium text-surface-500 mt-0.5">Deposit received</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold text-xl shrink-0">
            <Percent className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* ─── Search & Status Filters ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['ALL', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setActiveStatusFilter(st)}
              className={`
                px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border
                ${
                  activeStatusFilter === st
                    ? 'bg-primary-900 text-white border-primary-900 shadow-xs'
                    : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
                }
              `}
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
            className="pl-9 pr-4 py-2 bg-white border border-surface-200 rounded-xl text-xs text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* ─── Medical Bills Table ────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-surface-200 overflow-hidden shadow-xs">
        {filteredBills.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-surface-800">No medical bills found</h3>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              Click 'Create New Medical Bill' to issue itemized hospital invoices for your patients.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Invoice # & Title</th>
                  <th className="p-4">Patient</th>
                  <th className="p-4">Itemized Breakdown</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Paid Balance</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="p-4">
                      <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block">
                        {bill.billNumber}
                      </span>
                      <h4 className="text-xs font-extrabold text-surface-900 mt-0.5" title={bill.title}>
                        {bill.title}
                      </h4>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Issued: {new Date(bill.createdAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center text-xs">
                          {bill.patient?.user?.fullName?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="font-extrabold text-surface-900">{bill.patient?.user?.fullName}</p>
                          <p className="text-xs text-surface-500">{bill.patient?.user?.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelectedBillForDetails(bill)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-100 hover:bg-surface-200 text-surface-800 rounded-lg text-xs font-bold border border-surface-200 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5 text-primary-600" />
                        <span>{bill.items?.length || 0} Sub-Items</span>
                      </button>
                    </td>

                    <td className="p-4 font-black text-surface-900 text-sm">
                      ${Number(bill.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-surface-500 block">{bill.currency}</span>
                    </td>

                    <td className="p-4">
                      <p className="font-extrabold text-emerald-600">
                        ${Number(bill.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-surface-500">
                        Due: ${Math.max(0, Number(bill.totalAmount) - Number(bill.paidAmount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </td>

                    <td className="p-4">{renderStatusBadge(bill.status)}</td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {bill.fileUrl && (
                          <a
                            href={bill.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Download Hospital PDF Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedBillForDetails(bill)}
                          className="px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors"
                        >
                          View Breakdown
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

      {/* ─── Itemized Breakdown Modal / Drawer ───────────────────────────── */}
      {selectedBillForDetails && (
        <div className="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-surface-200 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary-600">
                  {selectedBillForDetails.billNumber}
                </span>
                <h3 className="text-lg font-extrabold text-surface-900 mt-0.5">
                  {selectedBillForDetails.title}
                </h3>
                <p className="text-xs text-surface-500 mt-0.5">
                  Patient: <strong>{selectedBillForDetails.patient?.user?.fullName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBillForDetails(null)}
                className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary-600" /> Itemized Cost Breakdown
              </h4>

              <div className="border border-surface-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-center">Category</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {selectedBillForDetails.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-50">
                        <td className="p-3 font-extrabold text-surface-900">{item.description}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-xs font-semibold">
                            {item.category || 'GENERAL'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">{item.quantity}</td>
                        <td className="p-3 text-right font-medium">${Number(item.unitPrice).toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-surface-900">${Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface-50/80 font-extrabold border-t border-surface-200">
                    <tr>
                      <td colSpan={4} className="p-3 text-right uppercase text-surface-500 text-xs">Net Invoice Total:</td>
                      <td className="p-3 text-right text-sm text-primary-700 font-black">
                        ${Number(selectedBillForDetails.totalAmount).toFixed(2)} USD
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedBillForDetails.notes && (
              <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs text-surface-700">
                <strong>Billing Note:</strong> {selectedBillForDetails.notes}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {selectedBillForDetails.fileUrl ? (
                <a
                  href={selectedBillForDetails.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Official PDF Invoice
                </a>
              ) : <div />}

              <Button
                type="button"
                onClick={() => setSelectedBillForDetails(null)}
                variant="secondary"
                className="px-5 py-2 text-xs font-bold rounded-xl"
              >
                Close Breakdown
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Medical Bill Modal ──────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl border border-surface-200 animate-scale-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-surface-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary-600" /> Create Patient Medical Bill & Invoice
                </h3>
                <p className="text-xs text-surface-500 mt-0.5">Issue an itemized hospital bill with cost breakdowns for international patients.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* ─── AI OCR Bill Auto-Scanner Dropzone ───────────────────── */}
              <div className="p-4 bg-gradient-to-r from-primary-900 to-slate-900 rounded-2xl text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                        Smart OCR Bill Auto-Scanner
                        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">AI Instant Extract</span>
                      </h4>
                      <p className="text-xs text-slate-300">Upload a hospital bill scan or PDF to auto-extract itemized breakdowns instantly.</p>
                    </div>
                  </div>
                </div>

                <div className="relative border-2 border-dashed border-white/20 hover:border-emerald-400/60 rounded-xl p-3 bg-white/5 transition-colors text-center cursor-pointer group">
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
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-300 py-1">
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Scanning Multi-Page Medical Bill with OCR AI...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-200 group-hover:text-white py-1">
                      <UploadCloud className="w-4 h-4 text-emerald-400" />
                      <span>Drop multi-page bill / batch files here (PDF/JPG) for instant OCR stitching</span>
                    </div>
                  )}
                </div>

                {ocrSuccessData && (
                  <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-400/40 text-emerald-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white">Multi-Page OCR Stitched ({ocrSuccessData.confidence}% Accuracy)</p>
                          <p className="text-xs text-emerald-200">
                            {ocrSuccessData.itemCount} sub-items extracted across {ocrSuccessData.pageCount} pages ({ocrSuccessData.hospitalName || 'hospital bill'}).
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-md shrink-0">Stitched</span>
                    </div>

                    {/* Page-by-Page Audit Tray */}
                    {ocrSuccessData.pages && ocrSuccessData.pages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-emerald-400/20">
                        {ocrSuccessData.pages.map((p) => (
                          <span
                            key={p.pageNumber}
                            className="bg-white/10 text-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1"
                          >
                            <span>Page {p.pageNumber}:</span>
                            <span className="text-white">{p.itemsFound} items</span>
                            <span className="text-emerald-400 font-black">(${p.pageSubtotal.toFixed(2)})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Patient & General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Select Patient</label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handlePatientSelectChange(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Invoice Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Surgical & Hospital Care Bill"
                    value={billTitle}
                    onChange={(e) => setBillTitle(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Bill Category</label>
                  <Select
                    options={CATEGORY_OPTIONS}
                    value={billCategory}
                    onChange={(val) => setBillCategory(val)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Payment Status</label>
                  <select
                    value={billStatus}
                    onChange={(e) => setBillStatus(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                  >
                    <option value="PENDING">PENDING (Unpaid)</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID (Deposit Received)</option>
                    <option value="PAID">PAID IN FULL</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Paid Deposit Amount ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 block">Due Date</label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-50 border border-surface-300 rounded-xl text-xs font-bold text-surface-900 focus:outline-none focus:border-primary-600"
                  />
                </div>
              </div>

              {/* Dynamic Line-Item Breakdown Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-700 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-600" /> Itemized Sub-Charge Breakdowns
                  </h4>
                  <Button
                    type="button"
                    onClick={addLineItem}
                    variant="secondary"
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary-600" /> Add Line Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-surface-50 rounded-xl border border-surface-200 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Sub-item description (e.g. Operating Theater)"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-surface-300 rounded-lg text-xs font-medium focus:outline-none focus:border-primary-600"
                          required
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateLineItem(idx, 'category', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-lg text-[11px] font-bold focus:outline-none"
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
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-lg text-xs font-bold text-center focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Price ($)"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-300 rounded-lg text-xs font-bold text-right focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-between pl-2">
                        <span className="text-xs font-black text-surface-900">${(item.amount || 0).toFixed(2)}</span>
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

                <div className="p-3 bg-primary-50/60 rounded-xl border border-primary-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary-900">Total Calculated Invoice Amount:</span>
                  <span className="text-base font-black text-primary-900">${computedTotal.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Upload PDF Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-surface-700 block">Attach Official Hospital PDF Invoice (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-surface-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  variant="secondary"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Issue Medical Bill</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
