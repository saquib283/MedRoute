'use client';

/**
 * Afzal Healthcare — Patient Medical Billing & Receipts
 * Clean 8px/6px clinical invoice layout, container-adaptive mobile table, and restrained typography.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  CreditCard,
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
        return <Badge variant="success" dot>Settled in Full</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="info" dot>Deposit Received</Badge>;
      case 'OVERDUE':
        return <Badge variant="danger" dot>Payment Overdue</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="warning" dot>Pending Payment</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-64 rounded-lg bg-surface-200/70 animate-pulse" />
        <div className="h-96 rounded-lg bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  const modalTotal = paymentModalBill ? Number(paymentModalBill.totalAmount) || 0 : 0;
  const modalPaid = paymentModalBill ? Number(paymentModalBill.paidAmount) || 0 : 0;
  const modalDue = Math.max(0, Math.round((modalTotal - modalPaid) * 100) / 100);

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Flat Aligned Page Header */}
      <div className="pb-5 border-b border-surface-200">
        <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
          Medical Billing &amp; Receipts
        </h1>
        <p className="text-xs sm:text-sm text-surface-500 mt-1 max-w-2xl">
          Review verified hospital statements, inspect itemized department charges, and download official tax receipts.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Could not load your invoices</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchPatientBills()}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      ) : bills.length === 0 ? (
        <Card className="p-10 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-md bg-surface-100 text-surface-500 border border-surface-200 flex items-center justify-center mx-auto">
            <Receipt className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold text-surface-900">No hospital invoices issued yet</h2>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
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
              <Card key={bill.id} className="p-5 sm:p-6 space-y-5">
                {/* Bill Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-surface-200 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-medium text-surface-700 bg-surface-100 border border-surface-200 px-2 py-0.5 rounded tabular-nums">
                        {bill.billNumber}
                      </span>
                      {renderStatusBadge(bill.status)}
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-surface-900 pt-0.5">
                      {bill.title}
                    </h2>
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
                    <p className="text-xs font-medium text-surface-500">Total Invoice</p>
                    <p className="text-2xl font-semibold tracking-tight text-surface-900 mt-0.5 tabular-nums">
                      ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {bill.currency}
                    </p>
                    {due > 0 ? (
                      <p className="text-xs font-medium text-warning-700 mt-0.5 tabular-nums">
                        Balance due: ${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                        {bill.currency}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-success-700 mt-0.5 tabular-nums">
                        Paid in full ($0.00 due)
                      </p>
                    )}
                  </div>
                </div>

                {/* Settlement Progress */}
                <div className="bg-surface-50 px-4 py-3 rounded-md border border-surface-200 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-medium text-surface-600">Settlement Progress</span>
                    <span className="font-medium text-surface-900 tabular-nums">
                      {paidPercent}% settled ($
                      {paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
                      {total.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-[width] duration-300"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                </div>

                {/* Container-Adaptive Itemized Breakdown Table */}
                <div className="space-y-2.5">
                  <h3 id={breakdownHeadingId} className="text-xs font-medium text-surface-600">
                    Itemized Department Charges
                  </h3>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby={breakdownHeadingId}
                    className="invoice-table-region border border-surface-200 rounded-lg bg-white"
                  >
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50 border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                        <tr>
                          <th scope="col" className="px-4 py-3">
                            Description
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Department
                          </th>
                          <th scope="col" className="px-4 py-3 text-center">
                            Qty
                          </th>
                          <th scope="col" className="px-4 py-3 text-right">
                            Unit Rate
                          </th>
                          <th scope="col" className="px-4 py-3 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {bill.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50/60">
                            <th scope="row" className="px-4 py-3 font-medium text-surface-900">
                              {item.description}
                            </th>
                            <td data-label="Department" className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 bg-surface-100 text-surface-700 border border-surface-200 rounded text-[11px] font-medium">
                                {formatBillCategory(item.category)}
                              </span>
                            </td>
                            <td
                              data-label="Qty"
                              className="px-4 py-3 text-center text-surface-700 tabular-nums"
                            >
                              {item.quantity}
                            </td>
                            <td
                              data-label="Unit Rate"
                              className="px-4 py-3 text-right text-surface-600 tabular-nums"
                            >
                              ${Number(item.unitPrice).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td
                              data-label="Amount"
                              className="px-4 py-3 text-right font-semibold text-surface-900 tabular-nums"
                            >
                              ${Number(item.amount).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface-50 border-t border-surface-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 sm:text-right font-medium text-surface-600 text-xs">
                            Net Invoiced Total
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-surface-900 font-semibold tabular-nums">
                            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            {bill.currency}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Hospital & Billing Note */}
                {(bill.hospital || bill.notes) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-surface-600 bg-surface-50 px-3.5 py-2.5 rounded-md border border-surface-200">
                    {bill.hospital && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-surface-800">
                        <Building2 className="w-3.5 h-3.5 text-surface-500 shrink-0" aria-hidden="true" />
                        <span>
                          {bill.hospital.name} ({bill.hospital.city})
                        </span>
                      </span>
                    )}
                    {bill.notes && (
                      <p className="text-surface-600">
                        <span className="font-medium text-surface-800">Note:</span> {bill.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-surface-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                    <span>Official hospital statement — receipts update upon settlement</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {bill.fileUrl && (
                      <a
                        href={bill.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-11 px-3.5 bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 font-medium rounded-md text-xs transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download PDF Invoice</span>
                      </a>
                    )}

                    {bill.status !== 'CANCELLED' && due > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openPaymentModal(bill)}
                      >
                        <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Pay Balance</span>
                      </Button>
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
        icon={<CreditCard className="w-4 h-4" />}
      >
        {paymentModalBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="px-3.5 py-3 bg-surface-50 rounded-md border border-surface-200 flex items-center justify-between text-xs">
              <span className="font-medium text-surface-600">Remaining Balance Due</span>
              <span className="text-base font-semibold text-surface-900 tabular-nums">
                ${modalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                {paymentModalBill.currency}
              </span>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-surface-700">Payment Amount</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('FULL');
                    setCustomAmount(modalDue.toFixed(2));
                  }}
                  className={`min-h-14 p-3 rounded-md border text-left transition-colors ${
                    paymentMode === 'FULL'
                      ? 'border-primary-600 bg-primary-50/70 text-surface-900'
                      : 'border-surface-300 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <span className="text-xs font-medium block">Full Remaining Balance</span>
                  <span className="text-xs text-primary-700 mt-0.5 block tabular-nums font-medium">
                    ${modalDue.toFixed(2)} {paymentModalBill.currency}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('CUSTOM')}
                  className={`min-h-14 p-3 rounded-md border text-left transition-colors ${
                    paymentMode === 'CUSTOM'
                      ? 'border-primary-600 bg-primary-50/70 text-surface-900'
                      : 'border-surface-300 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <span className="text-xs font-medium block">Custom Deposit</span>
                  <span className="text-xs text-surface-500 mt-0.5 block">
                    Enter partial installment
                  </span>
                </button>
              </div>

              {paymentMode === 'CUSTOM' && (
                <div className="pt-1">
                  <label
                    htmlFor="custom-payment-amount"
                    className="block text-xs font-medium text-surface-700 mb-1"
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
                    className="w-full min-h-11 px-3 bg-white border border-surface-300 rounded-md text-sm text-surface-900 tabular-nums focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              )}
            </fieldset>

            <Select
              label="Settlement Method"
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethodOption)}
              required
            />

            {paymentMethod === 'WIRE_TRANSFER' && (
              <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-700 space-y-2">
                <div className="flex items-center gap-2 font-medium text-surface-900">
                  <Landmark className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                  <span>International Wire Beneficiary Details</span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div>
                    <dt className="text-surface-500">Beneficiary</dt>
                    <dd className="font-medium text-surface-900">Afzal Healthcare Escrow</dd>
                  </div>
                  <div>
                    <dt className="text-surface-500">Bank &amp; Branch</dt>
                    <dd className="font-medium text-surface-900">HDFC Bank, Fort Mumbai</dd>
                  </div>
                  <div>
                    <dt className="text-surface-500">SWIFT / BIC Code</dt>
                    <dd className="font-mono font-medium text-surface-900">HDFCINBBXXX</dd>
                  </div>
                  <div>
                    <dt className="text-surface-500">Escrow Account</dt>
                    <dd className="font-mono font-medium text-surface-900 tabular-nums">
                      50200078419204
                    </dd>
                  </div>
                </dl>
                <p className="text-[11px] text-surface-600 pt-1.5 border-t border-surface-200">
                  Include invoice reference <strong className="font-medium text-surface-900">{paymentModalBill.billNumber}</strong> in the transfer memo, then enter your bank UTR/SWIFT reference below.
                </p>
              </div>
            )}

            {paymentMethod === 'INSURANCE_DIRECT' && (
              <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-700 flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  Enter your insurer&apos;s Guarantee of Payment (GOP) or pre-authorization claim number below so hospital billing can reconcile coverage directly.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="payment-reference-input"
                className="text-xs font-medium text-surface-700 block"
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
                className="w-full min-h-11 px-3 bg-white border border-surface-300 rounded-md text-sm text-surface-900 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPaymentModalBill(null)}
                disabled={isPaying}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isPaying}>
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isPaying ? 'Recording…' : 'Record Payment'}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
