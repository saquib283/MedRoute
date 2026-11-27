'use client';

/**
 * MediRoute India — Hospital B2B Billing, Settlement & Commission Reconciliation
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceTag } from '@/components/ui/PriceTag';
import { toast } from '@/components/ui/Toast';
import {
  Download,
  CheckCircle2,
  Clock,
  Receipt,
  Percent,
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
    queueMicrotask(() => fetchFinance());
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing &amp; Commission Reconciliation"
        subtitle="Reconcile patient hospital billings, facilitation fees, and net hospital payouts"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Billing & Commission' },
        ]}
      />

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Gross Patient Billings"
            value={<PriceTag amountInINR={summary.totalGross} /> as unknown as string}
            subtitle={`${summary.totalInvoices} invoices`}
            variant="default"
            icon={<Receipt className="w-5 h-5" />}
          />
          <StatCard
            title="Facilitation Fee"
            value={<PriceTag amountInINR={summary.totalCommission} /> as unknown as string}
            subtitle={`${summary.commissionRate}% contracted rate`}
            variant="primary"
            icon={<Percent className="w-5 h-5" />}
          />
          <StatCard
            title="Net Hospital Payout"
            value={<PriceTag amountInINR={summary.totalNetHospital} /> as unknown as string}
            subtitle="Retained hospital realization"
            variant="success"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            title="Invoice Filter"
            value={filteredLedger.length}
            subtitle={`Showing ${filter.toLowerCase()} records`}
            variant="default"
            icon={<Clock className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Ledger Table */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-200">
          <div>
            <h2 className="text-base font-semibold text-surface-900">Patient Billing &amp; Reconciliation Ledger</h2>
            <p className="text-xs text-surface-500">Patient payments, facilitation deductions, and settlement status</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-surface-100 p-1 text-xs font-semibold border border-surface-200">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-md transition-colors ${filter === 'ALL' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-600'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('SETTLED')}
                className={`px-3 py-1 rounded-md transition-colors ${filter === 'SETTLED' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-600'}`}
              >
                Settled
              </button>
              <button
                type="button"
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1 rounded-md transition-colors ${filter === 'PENDING' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-600'}`}
              >
                Pending
              </button>
            </div>

            <Button size="sm" variant="secondary" onClick={handleExportCsv}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredLedger.length === 0 ? (
          <EmptyState
            title="No invoices found"
            description="No ledger records match the selected settlement filter."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase text-surface-500 font-semibold border-b border-surface-200">
                  <th className="pb-2.5 px-3">Invoice No</th>
                  <th className="pb-2.5 px-3">Patient</th>
                  <th className="pb-2.5 px-3">Gross Billed</th>
                  <th className="pb-2.5 px-3">Fee ({summary?.commissionRate}%)</th>
                  <th className="pb-2.5 px-3">Net Hospital Payout</th>
                  <th className="pb-2.5 px-3">Invoice Status</th>
                  <th className="pb-2.5 px-3 text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-50">
                    <td className="py-3 px-3 font-mono font-semibold text-primary-700">{item.invoiceNumber}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-surface-900 block">{item.patientName}</span>
                      <span className="text-[11px] text-surface-500">{item.patientNationality}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-surface-900">
                      <PriceTag amountInINR={item.grossAmount} />
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-primary-800">
                      <PriceTag amountInINR={item.commissionAmount} />
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-success-700">
                      <PriceTag amountInINR={item.netPayableToHospital} />
                    </td>
                    <td className="py-3 px-3"><StatusBadge status={item.status} /></td>
                    <td className="py-3 px-3 text-right">
                      {item.settlementStatus === 'SETTLED' ? (
                        <span className="inline-flex items-center gap-1 text-success-700 font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning-700 font-semibold text-xs">
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
