'use client';

/**
 * Afzal Healthcare — Patient Medical Billing & Receipts
 * Container-adaptive responsive invoice breakdown, humanized clinical charge categories,
 * accessible native <dialog> payment flow, and beneficiary wire-transfer instructions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Layers,
  ShieldCheck,
  CreditCard,
  Percent,
  Ban,
  Landmark,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

interface BillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category?: string | null;
}

interface MedicalBill {
  id: string;
  billNumber: string;
  title: string;
  category: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | string;
  dueDate?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  notes?: string | null;
  createdAt: string;
  hospital?: {
    name: string;
    city: string;
  } | null;
  items: BillItem[];
}

type PaymentMethodOption = 'CARD' | 'WIRE_TRANSFER' | 'INSURANCE_DIRECT';

const BILL_CATEGORY_LABELS: Record<string, string> = {
  SURGERY_OT: 'Surgery & Operating Theatre',
  BED_RENT: 'Hospital Room & Nursing',
  ICU_CARE: 'ICU & Critical Monitoring',
  CONSULTATION: 'Specialist Consultation',
  DIAGNOSTICS: 'Diagnostics & Imaging',
  LABS: 'Laboratory Diagnostics',
  PHARMACY: 'Pharmacy & Medications',
  IMPLANT: 'Medical Implants & Devices',
  ANESTHESIA: 'Anesthesia Care',
  REHAB: 'Physiotherapy & Rehab',
  ACCOMMODATION: 'Recovery Stay',
  GENERAL: 'Hospital Care',
};

function formatBillCategory(raw?: string | null): string {
  if (!raw) return 'Hospital Care';
  if (BILL_CATEGORY_LABELS[raw]) return BILL_CATEGORY_LABELS[raw];
  return raw
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  {
    value: 'CARD',
    label: 'International Card (Credit / Debit)',
    description: 'Visa, Mastercard, or Amex settlement',
  },
  {
    value: 'WIRE_TRANSFER',
    label: 'Bank Wire Transfer (SWIFT / IBAN)',
    description: 'International bank transfer to hospital escrow',
  },
  {
    value: 'INSURANCE_DIRECT',
    label: 'Insurance Direct Settlement',
    description: 'Pre-authorized insurer guarantee letter',
  },
];

export default function PatientBillingPage() {
  const [bills, setBills] = useState<MedicalBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Payment Modal State
  const [paymentModalBill, setPaymentModalBill] = useState<MedicalBill | null>(null);
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption>('CARD');
  const [referenceNo, setReferenceNo] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const fetchPatientBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/v1/patient/billing');
      const data = await res.json();
      if (res.ok && data.success) {
        setBills(data.data.bills || []);
      } else {
        const msg = data?.error?.message || 'Unable to load your hospital invoices.';
        setLoadError(msg);
        toast.apiError(data, 'Failed to fetch medical bills', 'Fetch Error');
      }
    } catch (err) {
      console.error('Error loading patient bills', err);
      setLoadError('Could not connect to the billing service. Please check your connection and retry.');
      toast.apiError(err, 'Failed to connect to billing server', 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPatientBills();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPatientBills]);

  const openPaymentModal = (bill: MedicalBill) => {
    const total = Number(bill.totalAmount) || 0;
    const paid = Number(bill.paidAmount) || 0;
    const due = Math.max(0, Math.round((total - paid) * 100) / 100);
    setPaymentModalBill(bill);
    setPaymentMode('FULL');
    setCustomAmount(due.toFixed(2));
    setPaymentMethod('CARD');
    setReferenceNo('');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalBill) return;

    const total = Number(paymentModalBill.totalAmount) || 0;
    const paid = Number(paymentModalBill.paidAmount) || 0;
    const remainingDue = Math.max(0, Math.round((total - paid) * 100) / 100);
    const amount = paymentMode === 'FULL' ? remainingDue : parseFloat(customAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount greater than zero.', 'Validation Error');
      return;
    }

    if (amount > remainingDue + 0.005) {
      toast.error(
        `Payment amount cannot exceed remaining balance ($${remainingDue.toFixed(2)}).`,
        'Validation Error'
      );
      return;
    }

    setIsPaying(true);
    try {
      const res = await fetch('/api/v1/patient/billing/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: paymentModalBill.id,
          amount,
          paymentMethod,
          ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Payment of $${amount.toFixed(2)} ${paymentModalBill.currency} recorded for ${paymentModalBill.billNumber}.`,
          'Payment Recorded'
        );
        setPaymentModalBill(null);
        await fetchPatientBills();
      } else {
        toast.apiError(data, 'Failed to process medical bill payment', 'Payment Error');
      }
    } catch (err) {
      toast.apiError(err, 'Network error while submitting payment', 'Connection Error');
    } finally {
      setIsPaying(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 bg-success-50 text-success-800 border border-success-200 px-3 py-1 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
            Settled in Full
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1.5 bg-info-50 text-info-800 border border-info-200 px-3 py-1 rounded-full text-xs font-semibold">
            <Percent className="w-3.5 h-3.5 text-info-600" aria-hidden="true" />
            Deposit Received
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 bg-danger-50 text-danger-800 border border-danger-200 px-3 py-1 rounded-full text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-danger-600" aria-hidden="true" />
            Payment Overdue
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-surface-100 text-surface-700 border border-surface-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Ban className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-warning-50 text-warning-800 border border-warning-200 px-3 py-1 rounded-full text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-warning-600" aria-hidden="true" />
            Pending Payment
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-2">
        <div className="h-16 w-72 rounded-2xl bg-surface-200/70 animate-pulse" />
        <div className="h-96 rounded-3xl bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  const modalTotal = paymentModalBill ? Number(paymentModalBill.totalAmount) || 0 : 0;
  const modalPaid = paymentModalBill ? Number(paymentModalBill.paidAmount) || 0 : 0;
  const modalDue = Math.max(0, Math.round((modalTotal - modalPaid) * 100) / 100);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Single Authoritative Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
          Medical Billing &amp; Receipts
        </h1>
        <p className="text-xs sm:text-sm text-surface-600 mt-1 max-w-2xl">
          Review verified hospital invoices, inspect itemized care charges, and download official receipts for insurance or foreign-exchange clearance.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Could not load your invoices</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchPatientBills()}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      ) : bills.length === 0 ? (
        <Card className="p-12 text-center space-y-3 rounded-3xl border border-surface-200">
          <div className="w-12 h-12 rounded-2xl bg-surface-100 text-surface-500 flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-surface-900">No hospital invoices issued yet</h2>
          <p className="text-xs text-surface-600 max-w-sm mx-auto">
            Your case coordinator will post pro-forma cost estimates and itemized hospital bills here as your care plan is finalized.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {bills.map((bill) => {
            const total = Number(bill.totalAmount) || 0;
            const paid = Number(bill.paidAmount) || 0;
            const due = Math.max(0, total - paid);
            const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const breakdownHeadingId = `invoice-breakdown-${bill.id}`;

            return (
              <Card
                key={bill.id}
                className="p-5 sm:p-6 rounded-3xl border border-surface-200 shadow-xs space-y-6"
              >
                {/* Bill Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-surface-100 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary-800 bg-primary-50 border border-primary-200 px-2.5 py-0.5 rounded-lg tabular-nums">
                        {bill.billNumber}
                      </span>
                      {renderStatusBadge(bill.status)}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-surface-900">{bill.title}</h2>
                    <p className="text-xs text-surface-500 tabular-nums">
                      Issued{' '}
                      {new Date(bill.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="sm:text-right sm:border-l sm:border-surface-200 sm:pl-6">
                    <p className="text-xs font-semibold text-surface-500">Total Invoice</p>
                    <p className="text-2xl font-extrabold text-surface-900 mt-0.5 tabular-nums">
                      ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {bill.currency}
                    </p>
                    {due > 0 ? (
                      <p className="text-xs font-semibold text-warning-700 mt-0.5 tabular-nums">
                        Balance due: ${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                        {bill.currency}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-success-700 mt-0.5 tabular-nums">
                        Paid in full ($0.00 due)
                      </p>
                    )}
                  </div>
                </div>

                {/* Settlement Progress */}
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-surface-700">Settlement Progress</span>
                    <span className="font-bold text-primary-800 tabular-nums">
                      {paidPercent}% settled ($
                      {paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
                      {total.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="h-2.5 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success-600 rounded-full transition-[width] duration-300"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                </div>

                {/* Container-Adaptive Itemized Breakdown Table */}
                <div className="space-y-3">
                  <h3
                    id={breakdownHeadingId}
                    className="text-xs font-bold uppercase tracking-wider text-surface-700 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-primary-600" aria-hidden="true" />
                    <span>Itemized Charges</span>
                  </h3>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby={breakdownHeadingId}
                    className="invoice-table-region border border-surface-200 rounded-2xl bg-white"
                  >
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="p-3.5">
                            Description
                          </th>
                          <th scope="col" className="p-3.5">
                            Department / Category
                          </th>
                          <th scope="col" className="p-3.5 text-center">
                            Qty
                          </th>
                          <th scope="col" className="p-3.5 text-right">
                            Unit Rate
                          </th>
                          <th scope="col" className="p-3.5 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {bill.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50/70">
                            <th scope="row" className="p-3.5 font-bold text-surface-900">
                              {item.description}
                            </th>
                            <td data-label="Category" className="p-3.5">
                              <span className="inline-flex items-center px-2.5 py-0.5 bg-surface-100 text-surface-700 border border-surface-200 rounded-md text-xs font-medium">
                                {formatBillCategory(item.category)}
                              </span>
                            </td>
                            <td
                              data-label="Quantity"
                              className="p-3.5 text-center font-semibold text-surface-800 tabular-nums"
                            >
                              {item.quantity}
                            </td>
                            <td
                              data-label="Unit Rate"
                              className="p-3.5 text-right font-medium text-surface-700 tabular-nums"
                            >
                              ${Number(item.unitPrice).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td
                              data-label="Amount"
                              className="p-3.5 text-right font-bold text-surface-900 tabular-nums"
                            >
                              ${Number(item.amount).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface-50 font-bold border-t border-surface-200">
                        <tr>
                          <td colSpan={4} className="p-3.5 sm:text-right text-surface-600 text-xs">
                            Net Invoiced Total
                          </td>
                          <td className="p-3.5 text-right text-sm text-primary-800 font-extrabold tabular-nums">
                            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            {bill.currency}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Hospital & Coordinator Note */}
                {(bill.hospital || bill.notes) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-surface-700 bg-surface-50 px-4 py-3 rounded-2xl border border-surface-200">
                    {bill.hospital && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-surface-800">
                        <Building2 className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                        <span>
                          {bill.hospital.name} ({bill.hospital.city})
                        </span>
                      </span>
                    )}
                    {bill.notes && (
                      <p className="text-surface-600">
                        <strong className="text-surface-800">Billing Note:</strong> {bill.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="text-xs text-surface-600 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
                    <span>Verified hospital statement — receipts update automatically after settlement</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {bill.status !== 'CANCELLED' && due > 0 && (
                      <Button
                        type="button"
                        size="md"
                        onClick={() => openPaymentModal(bill)}
                        className="bg-success-600 hover:bg-success-700 text-white"
                      >
                        <CreditCard className="w-4 h-4" aria-hidden="true" />
                        <span>Pay Balance</span>
                      </Button>
                    )}

                    {bill.fileUrl && (
                      <a
                        href={bill.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 bg-primary-600 hover:bg-primary-700 active:scale-[0.96] text-white font-semibold rounded-xl text-xs transition-[background-color,transform] duration-150 shadow-2xs"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span>Download Tax Invoice PDF</span>
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Accessible Native <dialog> Payment Modal */}
      <Modal
        open={Boolean(paymentModalBill)}
        onClose={() => setPaymentModalBill(null)}
        preventClose={isPaying}
        title="Settle Hospital Invoice"
        subtitle={
          paymentModalBill
            ? `${paymentModalBill.billNumber} • ${paymentModalBill.title}`
            : undefined
        }
        icon={<CreditCard className="w-5 h-5" />}
      >
        {paymentModalBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-surface-600">Remaining Balance Due</span>
              <span className="text-base font-extrabold text-surface-900 tabular-nums">
                ${modalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                {paymentModalBill.currency}
              </span>
            </div>

            {/* Amount Selection */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-bold text-surface-700">Payment Amount</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('FULL');
                    setCustomAmount(modalDue.toFixed(2));
                  }}
                  className={`min-h-14 p-3.5 rounded-2xl border text-left transition-colors ${
                    paymentMode === 'FULL'
                      ? 'border-primary-600 bg-primary-50 text-primary-950 ring-1 ring-primary-600'
                      : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <span className="text-xs font-bold block">Full Remaining Balance</span>
                  <span className="text-xs font-semibold text-primary-700 mt-0.5 block tabular-nums">
                    ${modalDue.toFixed(2)} {paymentModalBill.currency}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('CUSTOM')}
                  className={`min-h-14 p-3.5 rounded-2xl border text-left transition-colors ${
                    paymentMode === 'CUSTOM'
                      ? 'border-primary-600 bg-primary-50 text-primary-950 ring-1 ring-primary-600'
                      : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <span className="text-xs font-bold block">Custom Deposit</span>
                  <span className="text-xs text-surface-500 mt-0.5 block">
                    Enter partial installment
                  </span>
                </button>
              </div>

              {paymentMode === 'CUSTOM' && (
                <div className="pt-1">
                  <label
                    htmlFor="custom-payment-amount"
                    className="block text-xs font-semibold text-surface-700 mb-1"
                  >
                    Installment Amount ({paymentModalBill.currency})
                  </label>
                  <input
                    id="custom-payment-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={modalDue.toFixed(2)}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Up to ${modalDue.toFixed(2)}`}
                    className="w-full min-h-11 px-3.5 bg-white border border-surface-300 rounded-xl text-xs font-bold text-surface-900 tabular-nums focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              )}
            </fieldset>

            {/* Custom Select for Payment Method */}
            <Select
              label="Settlement Method"
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethodOption)}
              required
            />

            {/* Contextual Wire Transfer / Insurance Guidance */}
            {paymentMethod === 'WIRE_TRANSFER' && (
              <div className="p-4 rounded-2xl bg-info-50 border border-info-200 text-xs text-info-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Landmark className="w-4 h-4 text-info-700 shrink-0" aria-hidden="true" />
                  <span>International Wire Beneficiary Details</span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div>
                    <dt className="text-info-700 font-medium">Beneficiary</dt>
                    <dd className="font-bold text-surface-900">Afzal Healthcare Escrow</dd>
                  </div>
                  <div>
                    <dt className="text-info-700 font-medium">Bank &amp; Branch</dt>
                    <dd className="font-bold text-surface-900">HDFC Bank, Fort Mumbai</dd>
                  </div>
                  <div>
                    <dt className="text-info-700 font-medium">SWIFT / BIC Code</dt>
                    <dd className="font-mono font-bold text-surface-900">HDFCINBBXXX</dd>
                  </div>
                  <div>
                    <dt className="text-info-700 font-medium">Escrow Account</dt>
                    <dd className="font-mono font-bold text-surface-900 tabular-nums">
                      50200078419204
                    </dd>
                  </div>
                </dl>
                <p className="text-[11px] text-info-800 pt-1 border-t border-info-200/70">
                  Include invoice reference <strong>{paymentModalBill.billNumber}</strong> in the transfer memo, then enter your bank UTR/SWIFT reference below.
                </p>
              </div>
            )}

            {paymentMethod === 'INSURANCE_DIRECT' && (
              <div className="p-3.5 rounded-2xl bg-primary-50 border border-primary-200 text-xs text-primary-900 flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  Enter your insurer&apos;s Guarantee of Payment (GOP) or pre-authorization claim number below so hospital billing can reconcile coverage directly.
                </p>
              </div>
            )}

            {/* Payment Reference */}
            <div className="space-y-1.5">
              <label
                htmlFor="payment-reference-input"
                className="text-xs font-bold text-surface-700 block"
              >
                {paymentMethod === 'WIRE_TRANSFER'
                  ? 'SWIFT / Bank Wire Reference'
                  : paymentMethod === 'INSURANCE_DIRECT'
                  ? 'Policy / Pre-Authorization Claim Number'
                  : 'Payment Reference (Optional)'}
              </label>
              <input
                id="payment-reference-input"
                type="text"
                maxLength={120}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={
                  paymentMethod === 'WIRE_TRANSFER'
                    ? 'e.g. SWIFT-882190'
                    : paymentMethod === 'INSURANCE_DIRECT'
                    ? 'e.g. GOP-AXA-44109'
                    : 'Optional card receipt or authorization code'
                }
                className="w-full min-h-11 px-3.5 bg-white border border-surface-300 rounded-xl text-xs font-medium text-surface-900 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentModalBill(null)}
                disabled={isPaying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isPaying}
                className="bg-success-600 hover:bg-success-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{isPaying ? 'Recording…' : 'Record Payment'}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
