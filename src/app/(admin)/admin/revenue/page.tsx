'use client';

/**
 * MediRoute India — Admin Revenue Dashboard
 * Comprehensive revenue analytics with commission breakdowns.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/constants';
import {
  DollarSign, TrendingUp, Building2, Hotel, Receipt,
  PieChart, BarChart3, ArrowUpRight, CreditCard
} from 'lucide-react';

interface RevenueSummary {
  totalRevenue: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  hospitalCommission: number;
  hotelCommission: number;
  facilitationRevenue: number;
  logisticsRevenue: number;
}

interface HospitalRevenue {
  name: string;
  commission: number;
  billed: number;
}

interface InvoiceStatusCount {
  status: string;
  count: number;
}

export default function RevenueDashboardPage() {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [revenueByHospital, setRevenueByHospital] = useState<HospitalRevenue[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStatusCount[]>([]);
  const [caseStats, setCaseStats] = useState<{ total: number; active: number }>({ total: 0, active: 0 });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/v1/admin/revenue?period=${period}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.success) {
          setSummary(d.data.summary);
          setRevenueByHospital(d.data.revenueByHospital);
          setInvoiceStats(d.data.invoiceStatusDistribution);
          setCaseStats(d.data.cases);
        }
      })
      .catch(err => console.error('Revenue fetch failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const periodTabs = [
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Revenue Dashboard"
        subtitle="Track commission earnings, billing, and financial performance"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Revenue' },
        ]}
      />

      {/* Period Filter */}
      <Tabs tabs={periodTabs} activeTab={period} onChange={setPeriod} variant="pills" />

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !summary ? (
        <EmptyState title="No Revenue Data" description="Revenue data will appear once invoices are created." />
      ) : (
        <>
          {/* Primary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total MedRoute Revenue"
              value={formatCurrency(summary.totalRevenue)}
              subtitle="Commission earned"
              icon={<TrendingUp className="w-5 h-5" />}
              variant="success"
            />
            <StatCard
              title="Total Billed"
              value={formatCurrency(summary.totalBilled)}
              subtitle={`${caseStats.total} cases`}
              icon={<Receipt className="w-5 h-5" />}
              variant="primary"
            />
            <StatCard
              title="Total Collected"
              value={formatCurrency(summary.totalPaid)}
              icon={<CreditCard className="w-5 h-5" />}
            />
            <StatCard
              title="Outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              subtitle={`${caseStats.active} active cases`}
              icon={<DollarSign className="w-5 h-5" />}
              variant={summary.totalOutstanding > 0 ? 'warning' : 'default'}
            />
          </div>

          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commission Breakdown */}
            <Card className="p-6 bg-white border border-surface-200">
              <h3 className="text-sm font-bold text-surface-900 mb-5 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary-600" /> Commission Breakdown
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Hospital Commission', value: summary.hospitalCommission, color: 'bg-primary-500', icon: <Building2 className="w-4 h-4" /> },
                  { label: 'Hotel/Hostel Commission', value: summary.hotelCommission, color: 'bg-info-500', icon: <Hotel className="w-4 h-4" /> },
                  { label: 'Facilitation Fees', value: summary.facilitationRevenue, color: 'bg-success-500', icon: <Receipt className="w-4 h-4" /> },
                  { label: 'Logistics Revenue', value: summary.logisticsRevenue, color: 'bg-warning-500', icon: <ArrowUpRight className="w-4 h-4" /> },
                ].map((item, idx) => {
                  const pct = summary.totalRevenue > 0 ? (item.value / summary.totalRevenue * 100) : 0;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-surface-700 font-medium">
                          {item.icon} {item.label}
                        </span>
                        <span className="font-bold text-surface-900">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="w-full bg-surface-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-surface-400 text-right font-medium">{pct.toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Invoice Status Distribution */}
            <Card className="p-6 bg-white border border-surface-200">
              <h3 className="text-sm font-bold text-surface-900 mb-5 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-600" /> Invoice Status
              </h3>
              {invoiceStats.length === 0 ? (
                <EmptyState title="No invoices" description="Invoice stats will appear here." />
              ) : (
                <div className="space-y-3">
                  {invoiceStats.map((stat) => (
                    <div key={stat.status} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 hover:bg-surface-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={stat.status} size="md" />
                      </div>
                      <span className="text-lg font-extrabold text-surface-900">{stat.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Revenue by Hospital */}
          <Card className="p-6 bg-white border border-surface-200">
            <h3 className="text-sm font-bold text-surface-900 mb-5 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-600" /> Revenue by Hospital
            </h3>
            {revenueByHospital.length === 0 ? (
              <EmptyState title="No hospital revenue" description="Revenue will appear when treatment invoices are processed." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-surface-500 uppercase border-b border-surface-200">
                      <th className="text-left pb-3 font-bold">Hospital</th>
                      <th className="text-right pb-3 font-bold">Total Billed</th>
                      <th className="text-right pb-3 font-bold">Commission Earned</th>
                      <th className="text-right pb-3 font-bold">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByHospital.map((h, idx) => (
                      <tr key={idx} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                        <td className="py-3 font-semibold text-surface-900">{h.name}</td>
                        <td className="py-3 text-right text-surface-700">{formatCurrency(h.billed)}</td>
                        <td className="py-3 text-right font-bold text-success-700">{formatCurrency(h.commission)}</td>
                        <td className="py-3 text-right text-surface-500">{h.billed > 0 ? `${(h.commission / h.billed * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
