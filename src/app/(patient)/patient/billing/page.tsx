'use client';

/**
 * Afzal Healthcare — Patient Billing & Itemized Receipts Overview
 * Allows patients to view medical bills, inspect itemized sub-charge breakdowns, and download official PDF tax invoices.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  DollarSign,
  Layers,
  FileText,
  ShieldCheck,
  CreditCard,
  Percent,
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

export default function PatientBillingPage() {
  const [bills, setBills] = useState<MedicalBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPatientBills();
  }, []);

  const fetchPatientBills = async () => {
    try {
      const res = await fetch('/api/v1/patient/billing');
      const data = await res.json();
      if (data.success) {
        setBills(data.data.bills || []);
      } else {
        toast.apiError(data, 'Failed to fetch medical bills', 'Fetch Error');
      }
    } catch (err) {
      console.error('Error loading patient bills', err);
      toast.apiError(err, 'Failed to connect to billing server', 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-extrabold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Settled in Full
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200 px-3 py-1 rounded-lg text-xs font-extrabold">
            <Percent className="w-3.5 h-3.5 text-sky-600" /> Deposit Received
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-lg text-xs font-extrabold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Payment Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-extrabold">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Payment
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading your medical bills & receipts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-2">
          <Receipt className="w-7 h-7 text-primary-600" />
          Patient Medical Billing & Itemized Receipts
        </h1>
        <p className="text-xs text-surface-500 mt-1">
          Review official hospital invoices, verify itemized cost breakdowns, and download tax receipts for foreign currency exchange.
        </p>
      </div>

      {bills.length === 0 ? (
        <Card className="p-12 text-center space-y-3 rounded-2xl border border-surface-200">
          <div className="w-12 h-12 rounded-2xl bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-surface-800">No medical bills generated yet</h3>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
            Your Case Manager will upload hospital invoices and cost breakdowns as your treatment progresses.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {bills.map((bill) => {
            const total = Number(bill.totalAmount) || 0;
            const paid = Number(bill.paidAmount) || 0;
            const due = Math.max(0, total - paid);
            const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

            return (
              <Card key={bill.id} className="p-6 rounded-3xl border border-surface-200 shadow-xs space-y-6">
                {/* Bill Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-100 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-100 px-2.5 py-0.5 rounded-md">
                        {bill.billNumber}
                      </span>
                      {renderStatusBadge(bill.status)}
                    </div>
                    <h2 className="text-lg font-extrabold text-surface-900 mt-1">{bill.title}</h2>
                    <p className="text-xs text-surface-400">
                      Issued: {new Date(bill.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:border-surface-100 sm:pl-6">
                    <p className="text-xs uppercase font-bold tracking-wider text-surface-500">Total Invoice Amount</p>
                    <p className="text-2xl font-black text-surface-900 mt-0.5">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {bill.currency}</p>
                    {due > 0 ? (
                      <p className="text-xs font-bold text-amber-600 mt-0.5">Remaining Balance: ${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    ) : (
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">Paid in Full ($0 balance)</p>
                    )}
                  </div>
                </div>

                {/* Payment Settlement Progress */}
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-surface-700">Payment Settlement Status</span>
                    <span className="font-extrabold text-primary-800">{paidPercent}% Paid (${paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                  </div>
                  <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                </div>

                {/* Itemized Breakdown Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-surface-700 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-600" /> Itemized Cost Breakdown
                  </h3>

                  <div className="border border-surface-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3.5">Sub-Item Description</th>
                          <th className="p-3.5 text-center">Category</th>
                          <th className="p-3.5 text-center">Qty</th>
                          <th className="p-3.5 text-right">Unit Price</th>
                          <th className="p-3.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 font-medium">
                        {bill.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50">
                            <td className="p-3.5 font-extrabold text-surface-900">{item.description}</td>
                            <td className="p-3.5 text-center">
                              <span className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-xs font-semibold">
                                {item.category || 'GENERAL'}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-bold">{item.quantity}</td>
                            <td className="p-3.5 text-right font-medium">${Number(item.unitPrice).toFixed(2)}</td>
                            <td className="p-3.5 text-right font-black text-surface-900">${Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface-50/80 font-extrabold border-t border-surface-200">
                        <tr>
                          <td colSpan={4} className="p-3.5 text-right uppercase text-surface-500 text-xs">Net Invoiced Amount:</td>
                          <td className="p-3.5 text-right text-sm text-primary-700 font-black">
                            ${total.toFixed(2)} {bill.currency}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Footer Actions & Note */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-xs text-surface-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Verified Hospital Invoice — Issued by Case Management Team</span>
                  </div>

                  {bill.fileUrl && (
                    <a
                      href={bill.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <Download className="w-4 h-4" /> Download Official Tax PDF Invoice
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
