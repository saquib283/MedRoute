'use client';

/**
 * MediRoute India — Hospital International Patient Services (IPS) Command Center
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  Plane,
  Receipt,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Stethoscope,
  Building2,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
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
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-surface-500 font-semibold">Loading Hospital IPS Command Center...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-white border border-surface-200 rounded-2xl">
        <p className="text-sm font-bold text-surface-800">No hospital account associated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary-700 block">
            International Patient Services (IPS) Desk
          </span>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">{data.hospital.name}</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            {data.hospital.city} · {data.hospital.accreditation || 'NABH / JCI Accredited'} · B2B Partner Portal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/hospital/cases">
            <Button size="sm" className="!text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Incoming Referrals ({data.stats.pendingQuotes} Pending)
            </Button>
          </Link>
          <Link href="/hospital/visa">
            <Button size="sm" variant="secondary" className="!text-xs">
              <Plane className="w-3.5 h-3.5 mr-1.5" /> Issue Visa Letter
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Total Quotes Submitted</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-surface-900 font-mono">{data.stats.totalQuotes}</span>
            <span className="text-xs font-bold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
              {data.stats.acceptedQuotes} Accepted
            </span>
          </div>
          <span className="text-[11px] text-surface-500 block">{data.stats.pendingQuotes} awaiting patient decision</span>
        </div>

        <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Visa Letters (VIL) Issued</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-primary-700 font-mono">{data.stats.visaLettersIssued}</span>
            <Plane className="w-4 h-4 text-primary-500" />
          </div>
          <span className="text-[11px] text-surface-500 block">Official Embassy-Stamped VILs</span>
        </div>

        <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Gross Hospital Billing</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-surface-900 font-mono">
              ₹{data.stats.grossHospitalBilled.toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-surface-500 block">International patient billings</span>
        </div>

        <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">MedRoute Facilitation Fee</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-primary-800 font-mono">
              ₹{data.stats.commissionDueToMedroute.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
              {data.stats.commissionRate || 10}% Rate
            </span>
          </div>
          <span className="text-[11px] text-surface-500 block">Contracted B2B facilitation cut</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Quotes Pipeline */}
        <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div>
              <h3 className="text-base font-bold text-surface-900">Hospital Medical Opinions & Surgical Estimates</h3>
              <p className="text-xs text-surface-500">Latest itemized quotes submitted by your clinical team.</p>
            </div>
            <Link href="/hospital/cases">
              <Button size="sm" variant="ghost" className="!text-xs">
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {data.recentQuotes.length === 0 ? (
            <div className="py-12 text-center text-xs text-surface-400">
              No quotes submitted yet. Open incoming referrals to submit quotes.
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {data.recentQuotes.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-0.5 max-w-sm">
                    <span className="font-bold text-surface-900 block truncate">{q.title}</span>
                    <p className="text-surface-500 text-[11px]">
                      Patient: {q.case?.patient?.user?.fullName || 'International Guest'} ({q.case?.patient?.nationality}) · Operating: Dr. {q.doctor?.fullName || 'Senior Consultant'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-surface-900 text-sm block">
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
        <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <h3 className="text-base font-bold text-surface-900">Incoming Foreign Inquiries</h3>
            <Link href="/hospital/cases">
              <Button size="sm" variant="ghost" className="!text-xs">All</Button>
            </Link>
          </div>

          <div className="space-y-3">
            {data.recentReferrals.map((r) => {
              const hasQuote = r.hospitalQuotes.length > 0;
              return (
                <div key={r.id} className="p-3 bg-surface-50 rounded-xl border border-surface-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-surface-900">{r.patient?.user?.fullName || 'Patient'}</span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary-100 text-primary-800">
                      {r.patient?.nationality}
                    </span>
                  </div>
                  <p className="text-surface-500 text-[11px] truncate">Ref: {r.id}</p>
                  <div className="pt-1 flex items-center justify-between">
                    {hasQuote ? (
                      <span className="text-success-700 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Quote Provided
                      </span>
                    ) : (
                      <span className="text-warning-700 font-bold text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Opinion Pending
                      </span>
                    )}
                    <Link href={`/hospital/cases`}>
                      <span className="text-primary-600 font-bold text-[11px] hover:underline">Review &rarr;</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
