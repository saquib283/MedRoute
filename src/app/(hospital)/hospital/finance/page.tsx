'use client';

/**
 * MediRoute India — Hospital B2B Billing, Settlement & Commission Reconciliation
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  Receipt,
  Download,
  Building2,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  TrendingUp,
  Percent,
  FileSpreadsheet,
} from 'lucide-react';

interface FinanceSummary {
  totalInvoices: number;
  totalGross: number;
  totalCommission: number;
  totalNetHospital: number;
  commissionRate: number;
}

interface LedgerItem {
  id: string;
  invoiceNumber: string;
  patientName: string;
  patientNationality: string;
  grossAmount: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  netPayableToHospital: number;
  status: string;
  issuedAt: string | null;
  paidAt: string | null;
  settlementStatus: string;
}

export default function HospitalFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchFinance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/hospital/finance');
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data.summary);
        setLedger(json.data.ledger);
      }
    } catch {
      toast.error('Failed to load finance ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance]);

  const filteredLedger = ledger.filter((item) => {
    if (filter === 'SETTLED') return item.settlementStatus === 'SETTLED';
    if (filter === 'PENDING') return item.settlementStatus === 'PENDING_COLLECTION';
    return true;
  });

  const handleExportCsv = () => {
    toast.success('Downloading B2B commission settlement statement...');
    const headers = ['Invoice No', 'Patient', 'Nationality', 'Gross Billed', 'Commission %', 'MedRoute Commission', 'Net Hospital Payout', 'Status'];
    const rows = filteredLedger.map((l) => [
      l.invoiceNumber,
      l.patientName,
      l.patientNationality,
      l.grossAmount,
      `${l.commissionRate}%`,
      l.commissionAmount,
      l.netPayableToHospital,
      l.settlementStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `B2B-Hospital-Settlement-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <PageHeader
        title="B2B Billing & Commission Reconciliation"
        subtitle="Reconcile international patient hospital billing, contracted MedRoute facilitation fees, and net hospital payouts"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'B2B Billing & Commission' },
        ]}
      />

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Gross Patient Billings</span>
            <span className="text-xl font-black text-surface-900 font-mono block">
              ₹{summary.totalGross.toLocaleString()}
            </span>
            <span className="text-[11px] text-surface-500 block">{summary.totalInvoices} Invoices Processed</span>
          </div>

          <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">MedRoute Facilitation Fee</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-primary-800 font-mono">
                ₹{summary.totalCommission.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                {summary.commissionRate}%
              </span>
            </div>
            <span className="text-[11px] text-surface-500 block">Contracted B2B facilitation cut</span>
          </div>

          <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Net Hospital Realization</span>
            <span className="text-xl font-black text-success-700 font-mono block">
              ₹{summary.totalNetHospital.toLocaleString()}
            </span>
            <span className="text-[11px] text-surface-500 block">Direct hospital revenue retained</span>
          </div>

          <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">B2B Settlement Status</span>
            <span className="text-sm font-extrabold text-primary-900 block mt-1">NMC Compliant Billing</span>
            <span className="text-[11px] text-surface-500 block">Transparent facilitation classification</span>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-100">
          <div>
            <h3 className="text-base font-bold text-surface-900">Patient Billing & Reconciliation Ledger</h3>
            <p className="text-xs text-surface-500">Real-time accounting of patient payments and facilitation fees.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-surface-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-colors ${filter === 'ALL' ? 'bg-white text-surface-900 shadow-2xs' : 'text-surface-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('SETTLED')}
                className={`px-3 py-1 rounded-lg transition-colors ${filter === 'SETTLED' ? 'bg-white text-surface-900 shadow-2xs' : 'text-surface-600'}`}
              >
                Settled
              </button>
              <button
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1 rounded-lg transition-colors ${filter === 'PENDING' ? 'bg-white text-surface-900 shadow-2xs' : 'text-surface-600'}`}
              >
                Pending
              </button>
            </div>

            <Button size="sm" variant="secondary" onClick={handleExportCsv} className="!text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV Statement
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredLedger.length === 0 ? (
          <div className="py-16 text-center text-xs text-surface-400">No invoices match the selected filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                  <th className="pb-2.5 px-3">Invoice No</th>
                  <th className="pb-2.5 px-3">Patient & Country</th>
                  <th className="pb-2.5 px-3">Gross Billed</th>
                  <th className="pb-2.5 px-3">Commission ({summary?.commissionRate}%)</th>
                  <th className="pb-2.5 px-3">Net Hospital Realization</th>
                  <th className="pb-2.5 px-3">Invoice Status</th>
                  <th className="pb-2.5 px-3 text-right">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-50">
                    <td className="py-3.5 px-3 font-mono font-bold text-primary-700">{item.invoiceNumber}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-surface-900 block">{item.patientName}</span>
                      <span className="text-[10px] text-surface-500 font-normal">{item.patientNationality}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-surface-900">
                      ₹{item.grossAmount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold text-primary-800">
                      ₹{item.commissionAmount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-success-700">
                      ₹{item.netPayableToHospital.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3"><StatusBadge status={item.status} /></td>
                    <td className="py-3.5 px-3 text-right">
                      {item.settlementStatus === 'SETTLED' ? (
                        <span className="inline-flex items-center gap-1 text-success-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning-700 font-bold text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> Pending Collection
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
