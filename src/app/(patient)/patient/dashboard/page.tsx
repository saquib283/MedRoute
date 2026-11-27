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
import {
  Calendar,
  FolderLock,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  FileText,
  ShieldCheck,
  Stethoscope,
  ArrowRight,
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
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in">
      {/* ─── Hero / Welcome Banner ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-950 p-6 sm:p-8 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-primary-800/80 border border-primary-700/60 px-3 py-1 rounded-full text-[11px] font-semibold text-primary-200">
            <ShieldCheck className="w-3.5 h-3.5 text-success-400" />
            <span>HIPAA Compliant Patient Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            Welcome to MediRoute India
          </h1>
          <p className="text-sm text-primary-200 leading-relaxed">
            Track your treatment roadmap, communicate directly with your case coordinator, and manage medical records securely.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <Link href="/patient/profile">
            <button
              type="button"
              className="px-4 py-2.5 bg-primary-800/80 hover:bg-primary-700/80 border border-primary-600/60 text-white rounded-xl text-xs font-bold transition-all"
            >
              Edit Profile
            </button>
          </Link>
          <Link href="/patient/documents">
            <button
              type="button"
              className="px-4 py-2.5 bg-white hover:bg-primary-50 text-primary-900 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Upload Medical Report
            </button>
          </Link>
        </div>
      </div>

      {/* ─── Metric KPI Widgets Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-600">Upcoming Consults</p>
            <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{appointmentsCount}</h3>
            <Link href="/patient/appointments" className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center gap-1">
              View Schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold text-xl shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </Card>

        {/* KPI 2 */}
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Document Vault</p>
            <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{documentsCount}</h3>
            <Link href="/patient/documents" className="text-[11px] font-semibold text-info-600 hover:text-info-700 mt-1 inline-flex items-center gap-1">
              Manage Vault <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-info-50 text-info-600 border border-info-100 flex items-center justify-center font-bold text-xl shrink-0">
            <FolderLock className="w-6 h-6" />
          </div>
        </Card>

        {/* KPI 3 */}
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Case Manager</p>
            <h3 className="text-base font-extrabold text-surface-900 mt-1 truncate">
              {activeCase?.manager?.fullName || 'Unassigned'}
            </h3>
            <Link href="/patient/messages" className="text-[11px] font-semibold text-success-600 hover:text-success-700 mt-1 inline-flex items-center gap-1">
              Open Chat <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-success-50 text-success-600 border border-success-100 flex items-center justify-center font-bold text-xl shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </Card>

        {/* KPI 4 */}
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-surface-600">Journey Progress</span>
            <span className="font-bold text-primary-700">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-surface-100 h-3 rounded-full overflow-hidden my-2">
            <div
              className="bg-primary-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs text-surface-500">
            Phase {activeIndex + 1} of {STATUS_STEPS.length}: {STATUS_STEPS[activeIndex]?.label}
          </span>
        </Card>
      </div>

      {/* ─── Treatment Roadmap & Case Stepper ─────────────────────────────── */}
      <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-6">
        <div className="border-b border-surface-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-surface-900 tracking-tight">Treatment Journey Roadmap</h2>
            <p className="text-xs text-surface-600 mt-0.5">Track your clinical milestones from inquiry to post-treatment recovery.</p>
          </div>

          {activeCase && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-surface-600">Current Phase:</span>
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

        {/* Action Required Checklist */}
        <Card className="lg:col-span-2 p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4">
          <div className="border-b border-surface-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Action Items & Shortcuts</h3>
            <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
              High Priority
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 border border-surface-200 rounded-xl bg-surface-50/60 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-800 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-surface-900">Upload Recent Lab Reports & ECG</p>
                  <p className="text-xs text-surface-600 mt-0.5">Required by Indian hospital specialists prior to confirmed scheduling.</p>
                </div>
              </div>
              <Link href="/patient/documents">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  Upload Files
                </Button>
              </Link>
            </div>

            <div className="p-4 border border-surface-200 rounded-xl bg-surface-50/60 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-success-100 text-success-800 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-surface-900">Review Care Specialties</p>
                  <p className="text-xs text-surface-600 mt-0.5">Select the medical specialties required for your treatment itinerary.</p>
                </div>
              </div>
              <Link href="/patient/profile">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  Edit Profile
                </Button>
              </Link>
            </div>

            <div className="p-4 border border-surface-200 rounded-xl bg-surface-50/60 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-surface-900">Reserve Recuperation Hostel</p>
                  <p className="text-xs text-surface-600 mt-0.5">Book verified local hostel lodging for your treatment and recovery timeline.</p>
                </div>
              </div>
              <Link href="/patient/accommodations">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">
                  Book Lodging
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
