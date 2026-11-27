'use client';

/**
 * MediRoute India — Patient Overview Dashboard
 * High-impact clinical dashboard with Lucide icons and treatment roadmap.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import {
  Calendar,
  FolderLock,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  FileText,
  Stethoscope,
  Home,
} from 'lucide-react';

interface Coordinator {
  fullName: string;
  email: string;
  phone: string;
}

interface Case {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  manager: Coordinator | null;
}

const STATUS_STEPS = [
  { status: 'INQUIRY_RECEIVED', label: 'Inquiry Received', desc: 'Consultation request filed' },
  { status: 'UNDER_REVIEW', label: 'Under Review', desc: 'Medical files in coordinator assessment' },
  { status: 'PLAN_CONFIRMED', label: 'Plan Confirmed', desc: 'Travel & clinical roadmap confirmed' },
  { status: 'IN_TREATMENT', label: 'In Treatment', desc: 'Admitted to partner medical center' },
  { status: 'POST_TREATMENT', label: 'Post-Treatment', desc: 'Discharged & recuperation monitoring' },
  { status: 'CLOSED', label: 'Closed', desc: 'Journey concluded successfully' },
];

export default function PatientDashboard() {
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const casesRes = await fetch('/api/v1/patient/cases');
        const casesData = await casesRes.json();
        if (casesData.success && casesData.data?.cases?.length > 0) {
          setActiveCase(casesData.data.cases[0]);
        }

        const appRes = await fetch('/api/v1/patient/appointments');
        const appData = await appRes.json();
        if (appData.success && appData.data?.appointments) {
          const upcoming = appData.data.appointments.filter(
            (a: { scheduledAt: string; status: string }) => new Date(a.scheduledAt) > new Date() && a.status !== 'CANCELLED'
          );
          setAppointmentsCount(upcoming.length);
        }

        const docRes = await fetch('/api/v1/patient/documents');
        const docData = await docRes.json();
        if (docData.success && docData.data?.documents) {
          setDocumentsCount(docData.data.documents.length);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeIndex = useMemo(() => {
    if (!activeCase) return 0;
    const idx = STATUS_STEPS.findIndex((s) => s.status === activeCase.status);
    return idx >= 0 ? idx : 0;
  }, [activeCase]);

  const progressPercentage = useMemo(() => {
    return Math.round(((activeIndex + 1) / STATUS_STEPS.length) * 100);
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-700">Loading your medical care workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Care Overview"
        subtitle="Track treatment milestones, appointments, uploaded reports, and coordinator updates"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/patient/profile">
              <Button variant="secondary" size="sm">Edit Profile</Button>
            </Link>
            <Link href="/patient/documents">
              <Button size="sm">Upload Document</Button>
            </Link>
          </div>
        }
      />

      {/* Metric KPI Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Upcoming Consults"
          value={appointmentsCount}
          subtitle="Scheduled visits"
          variant="primary"
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          title="Document Vault"
          value={documentsCount}
          subtitle="Encrypted files"
          variant="default"
          icon={<FolderLock className="w-5 h-5" />}
        />
        <StatCard
          title="Case Coordinator"
          value={activeCase?.manager?.fullName || 'Pending'}
          subtitle="Assigned liaison"
          variant="success"
          icon={<UserCheck className="w-5 h-5" />}
        />
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-surface-500">Case Progress</span>
            <span className="font-bold text-primary-700">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-surface-100 h-2.5 rounded-full overflow-hidden my-2">
            <div
              className="bg-primary-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs text-surface-500">
            Step {activeIndex + 1} of {STATUS_STEPS.length}: {STATUS_STEPS[activeIndex]?.label}
          </span>
        </Card>
      </div>

      {/* Treatment Roadmap & Case Stepper */}
      <Card className="space-y-6">
        <div className="border-b border-surface-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-surface-900">Treatment Roadmap</h2>
            <p className="text-xs text-surface-500 mt-0.5">Clinical milestones from initial inquiry through recovery</p>
          </div>

          {activeCase && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-500">Current Stage:</span>
              <Badge variant={activeCase.status === 'CLOSED' ? 'default' : 'primary'} dot>
                {STATUS_STEPS[activeIndex]?.label || activeCase.status}
              </Badge>
            </div>
          )}
        </div>

        {activeCase ? (
          <div className="relative pl-6 sm:pl-0 py-2">
            <div className="hidden sm:block absolute top-7 left-[8%] right-[8%] h-0.5 bg-surface-200 -z-10" />
            <div className="sm:hidden absolute left-3.5 top-4 bottom-4 w-0.5 bg-surface-200" />

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-6 sm:gap-3">
              {STATUS_STEPS.map((step, idx) => {
                const isPassed = idx < activeIndex;
                const isActive = idx === activeIndex;

                return (
                  <div
                    key={step.status}
                    className="flex sm:flex-col sm:items-center sm:text-center gap-3.5 sm:gap-2.5 relative"
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs transition-all shadow-xs
                        ${
                          isPassed
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : isActive
                            ? 'bg-white border-primary-600 text-primary-600 ring-4 ring-primary-100'
                            : 'bg-white border-surface-300 text-surface-400'
                        }
                      `}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div>
                      <p
                        className={`text-xs font-bold ${
                          isActive ? 'text-primary-700' : isPassed ? 'text-surface-900' : 'text-surface-600'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5 leading-tight max-w-[130px] sm:mx-auto">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeCase.notes && (
              <div className="mt-8 p-4 bg-surface-50 rounded-2xl border border-surface-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-surface-600 tracking-wider">Coordinator Note</span>
                  <p className="text-sm font-medium text-surface-800 mt-1 leading-relaxed">{activeCase.notes}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm font-bold text-surface-800">No active medical care case found.</p>
            <p className="text-sm text-surface-600 max-w-sm mx-auto">
              Register your profile details or submit a treatment inquiry to get assigned a case coordinator.
            </p>
          </div>
        )}
      </Card>

      {/* ─── Split Section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinator Contact Card */}
        <Card className="lg:col-span-1 p-6 rounded-2xl shadow-xs border border-surface-200 space-y-5">
          <div className="border-b border-surface-100 pb-3">
            <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Assigned Coordinator</h3>
          </div>

          {activeCase?.manager ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-primary-100 text-primary-800 border border-primary-200 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                  {activeCase.manager.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-surface-900 truncate">{activeCase.manager.fullName}</h4>
                  <p className="text-sm text-surface-600">Clinical Case Manager</p>
                </div>
              </div>

              <Link href="/patient/messages" className="block pt-1">
                <Button fullWidth size="md">
                  <MessageSquare className="w-4 h-4 mr-1.5" /> Send Direct Message
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-surface-600 space-y-2">
              <p>Your account is currently waiting for a coordinator assignment.</p>
            </div>
          )}
        </Card>

        {/* Action Checklist */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="border-b border-surface-200 pb-3">
            <h3 className="text-xs font-semibold text-surface-900 uppercase tracking-wider">Next Steps &amp; Shortcuts</h3>
          </div>

          <div className="space-y-3">
            <div className="p-4 border border-surface-200 rounded-lg bg-surface-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Upload Recent Lab Reports &amp; Scans</p>
                  <p className="text-xs text-surface-600 mt-0.5">Needed by partner specialists prior to scheduling.</p>
                </div>
              </div>
              <Link href="/patient/documents">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  Upload Files
                </Button>
              </Link>
            </div>

            <div className="p-4 border border-surface-200 rounded-lg bg-surface-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Update Medical History &amp; Specialties</p>
                  <p className="text-xs text-surface-600 mt-0.5">Keep allergies, medications, and specialty preferences current.</p>
                </div>
              </div>
              <Link href="/patient/profile">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  Edit Profile
                </Button>
              </Link>
            </div>

            <div className="p-4 border border-surface-200 rounded-lg bg-surface-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Browse Recovery Accommodations</p>
                  <p className="text-xs text-surface-600 mt-0.5">View verified nearby stays for your treatment dates.</p>
                </div>
              </div>
              <Link href="/patient/accommodations">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  View Stays
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
