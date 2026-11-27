'use client';

/**
 * MediRoute India — Hospital International Patient Services (IPS) Command Center
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceTag } from '@/components/ui/PriceTag';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  Plane,
  Receipt,
  CheckCircle2,
  Clock,
  ArrowRight,
  Percent,
} from 'lucide-react';

interface HospitalDashboardData {
  hospital: {
    id: string;
    name: string;
    city: string;
    accreditation: string | null;
    commissionRate: number | null;
  };
  stats: {
    totalQuotes: number;
    acceptedQuotes: number;
    pendingQuotes: number;
    activeInpatients: number;
    visaLettersIssued: number;
    grossHospitalBilled: number;
    commissionDueToMedroute: number;
    commissionRate: number | null;
  };
  recentQuotes: {
    id: string;
    title: string;
    estimatedCost: number;
    currency: string;
    status: string;
    createdAt: string;
    case?: { patient?: { nationality: string; user?: { fullName: string } } };
    doctor?: { fullName: string };
  }[];
  recentReferrals: {
    id: string;
    status: string;
    createdAt: string;
    patient?: { nationality: string; user?: { fullName: string; email: string } };
    hospitalQuotes: { id: string; status: string }[];
  }[];
}

export default function HospitalDashboardPage() {
  const [data, setData] = useState<HospitalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/hospital/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        toast.error(json.error || 'Failed to load hospital dashboard');
      }
    } catch {
      toast.error('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchDashboard());
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-surface-500 font-medium">Loading hospital overview...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <EmptyState
          title="No hospital account linked"
          description="Contact your administrator to associate a hospital partner profile with this login."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={data.hospital.name}
        subtitle={`${data.hospital.city} · ${data.hospital.accreditation || 'Accredited Partner Hospital'} · International Patient Services`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/hospital/cases">
              <Button size="sm">
                <FileSpreadsheet className="w-4 h-4" /> Referrals ({data.stats.pendingQuotes} Pending)
              </Button>
            </Link>
            <Link href="/hospital/visa">
              <Button size="sm" variant="secondary">
                <Plane className="w-4 h-4" /> Issue Visa Letter
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Quotes Submitted"
          value={data.stats.totalQuotes}
          subtitle={`${data.stats.acceptedQuotes} accepted · ${data.stats.pendingQuotes} pending`}
          variant="default"
          icon={<FileSpreadsheet className="w-5 h-5" />}
        />
        <StatCard
          title="Visa Letters Issued"
          value={data.stats.visaLettersIssued}
          subtitle="Hospital invitation letters"
          variant="primary"
          icon={<Plane className="w-5 h-5" />}
        />
        <StatCard
          title="Gross Hospital Billing"
          value={<PriceTag amountInINR={data.stats.grossHospitalBilled} /> as unknown as string}
          subtitle="International patient billings"
          variant="success"
          icon={<Receipt className="w-5 h-5" />}
        />
        <StatCard
          title="Facilitation Fee"
          value={<PriceTag amountInINR={data.stats.commissionDueToMedroute} /> as unknown as string}
          subtitle={
            data.stats.commissionRate != null
              ? `${data.stats.commissionRate}% contracted rate`
              : 'Per partner agreement'
          }
          variant="warning"
          icon={<Percent className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Quotes Pipeline */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-200">
            <div>
              <h2 className="text-base font-semibold text-surface-900">Medical Opinions &amp; Surgical Estimates</h2>
              <p className="text-xs text-surface-500">Latest itemized quotes submitted by your team</p>
            </div>
            <Link href="/hospital/cases">
              <Button size="sm" variant="ghost">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {data.recentQuotes.length === 0 ? (
            <EmptyState
              title="No quotes submitted yet"
              description="Open incoming referrals to submit an initial treatment estimate."
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-surface-200">
              {data.recentQuotes.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-surface-900 block truncate">{q.title}</span>
                    <p className="text-surface-500 text-xs">
                      Patient: {q.case?.patient?.user?.fullName || 'Patient'}
                      {q.case?.patient?.nationality ? ` (${q.case.patient.nationality})` : ''}
                      {q.doctor?.fullName ? ` · Dr. ${q.doctor.fullName}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="font-mono font-semibold text-surface-900 text-sm block">
                      {q.currency} {q.estimatedCost.toLocaleString()}
                    </span>
                    <StatusBadge status={q.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Col: Quick Referral Inflow */}
        <Card className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-200">
            <h2 className="text-base font-semibold text-surface-900">Incoming Referrals</h2>
            <Link href="/hospital/cases">
              <Button size="sm" variant="ghost">All</Button>
            </Link>
          </div>

          {data.recentReferrals.length === 0 ? (
            <p className="text-xs text-surface-500 py-6 text-center">No recent referrals.</p>
          ) : (
            <div className="space-y-3">
              {data.recentReferrals.map((r) => {
                const hasQuote = r.hospitalQuotes.length > 0;
                return (
                  <div key={r.id} className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-surface-900 truncate">{r.patient?.user?.fullName || 'Patient'}</span>
                      {r.patient?.nationality && (
                        <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200 shrink-0">
                          {r.patient.nationality}
                        </span>
                      )}
                    </div>
                    <p className="text-surface-500 font-mono text-[11px] truncate">Ref: {r.id}</p>
                    <div className="pt-1 flex items-center justify-between">
                      {hasQuote ? (
                        <span className="text-success-700 font-semibold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Quote Provided
                        </span>
                      ) : (
                        <span className="text-warning-700 font-semibold text-[11px] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Opinion Pending
                        </span>
                      )}
                      <Link href="/hospital/cases" className="text-primary-700 font-semibold text-xs hover:underline">
                        Review
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
