'use client';

/**
 * MediRoute India — Patient Invoicing & Milestone Checkout Hub
 * Clean, transparent milestone billing with multi-currency view and cryptographic receipts.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  milestoneName: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  status: string;
  dueDate: string | null;
  issuedAt: string | null;
  notes: string | null;
  hospital?: { name: string; city: string };
  lineItems: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: string;
  }[];
  payments: {
    id: string;
    amount: number;
    referenceNo: string;
    paidAt: string;
    paymentMethod: string;
  }[];
}

interface BillingSummary {
  totalBilled: number;
  totalPaid: number;
  totalBalanceDue: number;
  currency: string;
  paidMilestonesCount: number;
  totalMilestonesCount: number;
  progressPercent: number;
}

export default function PatientBillingPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/patient/billing');
      const json = await res.json();
      if (json.success && json.data) {
        setInvoices(json.data.invoices);
        setSummary(json.data.summary);
      }
    } catch {
      toast.error('Failed to load your billing ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchBilling());
  }, [fetchBilling]);

  const handlePayInvoice = async (invoice: InvoiceItem) => {
    try {
      setPayingId(invoice.id);
      const res = await fetch('/api/v1/patient/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: invoice.balanceDue,
          paymentMethod: 'INTERNATIONAL_WIRE',
          notes: `Settlement for ${invoice.milestoneName || invoice.invoiceNumber}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Payment of ${invoice.currency} ${invoice.balanceDue.toLocaleString()} verified! Proof Code: ${json.data.proofReceipt.verificationCode}`);
        fetchBilling();
      } else {
        toast.error(json.error || 'Payment failed');
      }
    } catch {
      toast.error('Network error processing payment');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing &amp; Milestone Invoices"
        subtitle="Review hospital invoices, milestone installment schedules, and verified payment receipts"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Billing & Payments' },
        ]}
      />

      {/* Milestone Progress Card */}
      {summary && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-surface-900">Treatment Milestone Progress</h2>
              <p className="text-xs text-surface-500">
                {summary.paidMilestonesCount} of {summary.totalMilestonesCount} milestones settled ({summary.progressPercent}%)
              </p>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-xs font-medium text-surface-500 block">Balance Due</span>
              <span className="text-xl font-bold font-mono text-surface-900">
                {summary.currency} {summary.totalBalanceDue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-primary-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* Invoices List */}
      {loading ? (
        <div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="No invoices issued yet"
            description="Your case coordinator will issue your milestone invoice once the treatment plan is confirmed."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <Card key={inv.id} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-primary-700">{inv.invoiceNumber}</span>
                    {inv.installmentNumber && (
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                        Milestone {inv.installmentNumber} of {inv.totalInstallments}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-surface-900 text-sm">{inv.milestoneName || 'Treatment Package Invoice'}</h3>
                  <p className="text-xs text-surface-500">
                    Hospital: {inv.hospital?.name || 'Partner Hospital'} · Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'Upon Admission'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right space-y-1">
                    <span className="text-base font-bold font-mono text-surface-900 block">
                      {inv.currency} {Number(inv.totalAmount).toLocaleString()}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>

                  {inv.status !== 'PAID' && (
                    <Button
                      size="sm"
                      onClick={() => handlePayInvoice(inv)}
                      isLoading={payingId === inv.id}
                      disabled={payingId === inv.id}
                    >
                      <CreditCard className="w-4 h-4" /> Pay {inv.currency} {Number(inv.balanceDue).toLocaleString()}
                    </Button>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2 text-xs">
                <span className="font-semibold text-surface-500 text-[11px] uppercase block">Itemized Breakdown</span>
                <div className="divide-y divide-surface-200 bg-surface-50 rounded-lg p-3 border border-surface-200">
                  {inv.lineItems.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-medium text-surface-800 block">{item.description}</span>
                        <span className="text-[11px] uppercase font-mono text-surface-500">Qty: {item.quantity} · {item.category}</span>
                      </div>
                      <span className="font-mono font-semibold text-surface-900 shrink-0">
                        {inv.currency} {Number(item.totalPrice).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Proof Receipts */}
              {inv.payments.length > 0 && (
                <div className="p-3 bg-success-50 rounded-lg border border-success-200 flex flex-wrap items-center justify-between gap-2 text-xs text-success-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                    <span>
                      Paid: <strong>{inv.currency} {Number(inv.payments[0].amount).toLocaleString()}</strong> on {new Date(inv.payments[0].paidAt).toLocaleDateString()} (Ref: {inv.payments[0].referenceNo})
                    </span>
                  </div>
                  <Link href="/patient/privacy" className="text-primary-700 font-semibold hover:underline inline-flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" /> View Consents &amp; Proofs
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
