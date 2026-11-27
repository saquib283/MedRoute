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
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Building2,
  Download,
  DollarSign,
  AlertCircle,
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
    fetchBilling();
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
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Billing, Invoices & Milestone Payments"
        subtitle="Review transparent multi-hospital treatment billing, milestone installment schedules, and official payment proof receipts"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Billing & Payments' },
        ]}
      />

      {/* Milestone Progress Bar Card */}
      {summary && (
        <Card className="p-6 bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800 text-white rounded-2xl shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary-300 block">
                Statutory Financial Transparency
              </span>
              <h2 className="text-xl font-black text-white">Treatment Milestone Progress</h2>
              <p className="text-xs text-primary-200/80">
                {summary.paidMilestonesCount} of {summary.totalMilestonesCount} milestones settled ({summary.progressPercent}% Completed)
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-primary-300 block">Total Package Balance Due</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {summary.currency} {summary.totalBalanceDue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/15 rounded-full h-3 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* Invoices List */}
      {loading ? (
        <div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : invoices.length === 0 ? (
        <div className="p-12 text-center bg-white border border-surface-200 rounded-2xl text-surface-400 space-y-2">
          <Receipt className="w-10 h-10 mx-auto text-surface-300" />
          <p className="text-sm font-bold text-surface-700">No active invoices issued yet.</p>
          <p className="text-xs text-surface-400">Your Case Coordinator will issue your treatment plan invoice once hospital evaluations are finalized.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <Card key={inv.id} className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-100">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary-700">{inv.invoiceNumber}</span>
                    {inv.installmentNumber && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary-50 text-primary-800 border border-primary-100">
                        Milestone {inv.installmentNumber} of {inv.totalInstallments}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-surface-900 text-sm">{inv.milestoneName || 'Surgical Treatment Package'}</h3>
                  <p className="text-[11px] text-surface-500">
                    Hospital: {inv.hospital?.name || 'MedRoute Partner Hospital'} · Due Date: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'Upon Admission'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-surface-900 block">
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
                      className="!text-xs shadow-sm shrink-0"
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay {inv.currency} {Number(inv.balanceDue).toLocaleString()}
                    </Button>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-surface-400 text-[10px] uppercase block">Itemized Inclusions</span>
                <div className="divide-y divide-surface-100 bg-surface-50 rounded-xl p-3 border border-surface-200/80">
                  {inv.lineItems.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-surface-800 block">{item.description}</span>
                        <span className="text-[10px] uppercase font-mono text-surface-400">Qty: {item.quantity} · Cat: {item.category}</span>
                      </div>
                      <span className="font-mono font-bold text-surface-900">
                        {inv.currency} {Number(item.totalPrice).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Proof Receipts */}
              {inv.payments.length > 0 && (
                <div className="p-3 bg-success-50 rounded-xl border border-success-200 flex items-center justify-between text-xs text-success-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                    <span>
                      Payment Verified: <strong>{inv.currency} {Number(inv.payments[0].amount).toLocaleString()}</strong> on {new Date(inv.payments[0].paidAt).toLocaleDateString()} (Ref: {inv.payments[0].referenceNo})
                    </span>
                  </div>
                  <Link href="/patient/privacy">
                    <span className="text-primary-700 font-bold hover:underline text-[11px] flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> Proof Sealed
                    </span>
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
