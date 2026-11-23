'use client';

/**
 * Afzal Healthcare — Patient Care Overview
 * Parallelized dashboard loading, retryable error recovery, direct coordinator contact,
 * and calm bedside concierge hierarchy.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePatientSession } from '../patient-session-context';
import {
  Calendar,
  FolderLock,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  FileText,
  Stethoscope,
  ArrowRight,
  Phone,
  Mail,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import {
  ClinicalRoadmapTree,
  ClinicalStepData,
  FitToFlyData,
} from '@/components/clinical/ClinicalRoadmapTree';
import { CASE_PHASE_GROUPS, CASE_STATUS_LABELS, getCasePhaseIndex } from '@/lib/constants';

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
  clinicalSteps?: ClinicalStepData[];
  fitToFlyClearance?: FitToFlyData | null;
}

export default function PatientDashboard() {
  const { fullName } = usePatientSession();
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [casesRes, appRes, docRes] = await Promise.all([
        fetch('/api/v1/patient/cases'),
        fetch('/api/v1/patient/appointments'),
        fetch('/api/v1/patient/documents'),
      ]);

      if (!casesRes.ok && !appRes.ok && !docRes.ok) {
        throw new Error('Unable to reach your care portal right now.');
      }

      const [casesData, appData, docData] = await Promise.all([
        casesRes.json(),
        appRes.json(),
        docRes.json(),
      ]);

      if (casesData.success && casesData.data?.cases?.length > 0) {
        setActiveCase(casesData.data.cases[0]);
      } else {
        setActiveCase(null);
      }

      if (appData.success && Array.isArray(appData.data?.appointments)) {
        const upcoming = appData.data.appointments.filter(
          (a: { scheduledAt: string; status: string }) =>
            new Date(a.scheduledAt) > new Date() && a.status !== 'CANCELLED'
        );
        setAppointmentsCount(upcoming.length);
      }

      if (docData.success && Array.isArray(docData.data?.documents)) {
        setDocumentsCount(docData.data.documents.length);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      setLoadError(
        'We could not load your care overview due to a connection interruption. Your medical records are safe — please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const activeIndex = useMemo(() => {
    if (!activeCase) return 0;
    return getCasePhaseIndex(activeCase.status);
  }, [activeCase]);

  const progressPercentage = useMemo(() => {
    return Math.round(((activeIndex + 1) / CASE_PHASE_GROUPS.length) * 100);
  }, [activeIndex]);

  const firstName = useMemo(() => {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
  }, [fullName]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 py-2">
        <div className="h-40 rounded-3xl bg-primary-900/90 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-2xl bg-white border border-surface-200 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-3xl bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-8 animate-fade-in">
      {/* ─── Welcome Concierge Banner ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800 p-6 sm:p-8 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="space-y-2 max-w-2xl relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome to Afzal Healthcare'}
          </h1>
          <p className="text-xs sm:text-sm text-primary-100 leading-relaxed">
            Follow your care milestones, share diagnostic records with your specialists, and stay in direct touch with your dedicated coordinator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <Link
            href="/patient/profile"
            className="inline-flex items-center justify-center min-h-11 px-4 bg-primary-800 hover:bg-primary-700 active:scale-[0.96] border border-primary-600 text-white rounded-xl text-xs font-semibold transition-[background-color,transform] duration-150"
          >
            Update Medical Profile
          </Link>
          <Link
            href="/patient/documents"
            className="inline-flex items-center justify-center min-h-11 px-4 bg-white hover:bg-primary-50 active:scale-[0.96] text-primary-950 rounded-xl text-xs font-semibold transition-[background-color,transform] duration-150 shadow-2xs"
          >
            Upload Medical Records
          </Link>
        </div>
      </div>

      {/* ─── Network Error Recovery Banner ───────────────────────────────── */}
      {loadError && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Unable to load your latest care updates</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* ─── Key Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-surface-600">Upcoming Consultations</p>
            <p className="text-2xl font-extrabold text-surface-900 mt-1 tabular-nums">
              {appointmentsCount}
            </p>
            <Link
              href="/patient/appointments"
              className="text-xs font-semibold text-primary-700 hover:text-primary-800 mt-1 min-h-11 inline-flex items-center gap-1"
            >
              <span>View schedule</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-surface-600">Uploaded Documents</p>
            <p className="text-2xl font-extrabold text-surface-900 mt-1 tabular-nums">
              {documentsCount}
            </p>
            <Link
              href="/patient/documents"
              className="text-xs font-semibold text-info-700 hover:text-info-800 mt-1 min-h-11 inline-flex items-center gap-1"
            >
              <span>Open vault</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-info-50 text-info-700 border border-info-200 flex items-center justify-center shrink-0">
            <FolderLock className="w-6 h-6" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-surface-600">Case Coordinator</p>
            <p className="text-base font-bold text-surface-900 mt-1 truncate">
              {activeCase?.manager?.fullName || 'Assigning shortly'}
            </p>
            <Link
              href="/patient/messages"
              className="text-xs font-semibold text-success-700 hover:text-success-800 mt-1 min-h-11 inline-flex items-center gap-1"
            >
              <span>Message coordinator</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-success-50 text-success-700 border border-success-200 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-surface-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-surface-600">Care Journey</span>
            <span className="font-bold text-primary-700 tabular-nums">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-surface-100 h-2.5 rounded-full overflow-hidden my-2.5">
            <div
              className="bg-primary-600 h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs text-surface-600 font-medium tabular-nums">
            Stage {activeIndex + 1} of {CASE_PHASE_GROUPS.length}:{' '}
            {activeCase
              ? CASE_STATUS_LABELS[activeCase.status] || activeCase.status
              : CASE_PHASE_GROUPS[0].label}
          </span>
        </Card>
      </div>

      {/* ─── Treatment Roadmap & Case Stepper ────────────────────────────── */}
      {!loadError && activeCase?.clinicalSteps && activeCase.clinicalSteps.length > 0 ? (
        <ClinicalRoadmapTree
          steps={activeCase.clinicalSteps}
          fitToFly={activeCase.fitToFlyClearance}
          currentStatus={activeCase.status}
        />
      ) : !loadError ? (
        <Card className="p-6 rounded-3xl shadow-xs border border-surface-200 space-y-6">
          <div className="border-b border-surface-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-surface-900 tracking-tight">
                Your Care Journey
              </h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Progress across each stage from initial review through recovery and safe return home.
              </p>
            </div>

            {activeCase && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-surface-500">Current Stage:</span>
                <Badge variant={activeCase.status === 'CLOSED' ? 'default' : 'primary'} dot>
                  {CASE_STATUS_LABELS[activeCase.status] || activeCase.status}
                </Badge>
              </div>
            )}
          </div>

          {activeCase ? (
            <div className="relative pl-6 sm:pl-0 py-2">
              <div className="hidden sm:block absolute top-7 left-[8%] right-[8%] h-0.5 bg-surface-200 -z-10" />
              <div className="sm:hidden absolute left-3.5 top-4 bottom-4 w-0.5 bg-surface-200" />

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-6 sm:gap-3">
                {CASE_PHASE_GROUPS.map((step, idx) => {
                  const isPassed = idx < activeIndex;
                  const isActive = idx === activeIndex;

                  return (
                    <div
                      key={step.key}
                      className="flex sm:flex-col sm:items-center sm:text-center gap-3.5 sm:gap-2.5 relative"
                    >
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs tabular-nums shadow-xs
                          ${
                            isPassed
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : isActive
                              ? 'bg-white border-primary-600 text-primary-700 ring-4 ring-primary-100'
                              : 'bg-white border-surface-300 text-surface-500'
                          }
                        `}
                      >
                        {isPassed ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : idx + 1}
                      </div>

                      <div>
                        <p
                          className={`text-xs font-bold ${
                            isActive
                              ? 'text-primary-700'
                              : isPassed
                              ? 'text-surface-900'
                              : 'text-surface-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-surface-500 mt-0.5 leading-snug max-w-[140px] sm:mx-auto">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeCase.notes && (
                <div className="mt-8 p-4 bg-surface-50 rounded-2xl border border-surface-200 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-surface-900">Coordinator Update</p>
                    <p className="text-xs text-surface-700 mt-1 leading-relaxed">
                      {activeCase.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm font-semibold text-surface-800">
                Your clinical case is being prepared
              </p>
              <p className="text-xs text-surface-500 max-w-md mx-auto">
                Upload your recent medical reports or complete your medical profile so our care team can assign a specialist plan.
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {/* ─── Coordinator Contact & Recommended Next Steps ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinator Contact Card */}
        <Card className="lg:col-span-1 p-6 rounded-3xl shadow-xs border border-surface-200 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-bold text-surface-900">Your Care Coordinator</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Direct assistance with hospital scheduling, visas, and arrival logistics.
              </p>
            </div>

            {activeCase?.manager ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-primary-100 text-primary-800 border border-primary-200 rounded-2xl flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                    {activeCase.manager.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-surface-900 truncate">
                      {activeCase.manager.fullName}
                    </h3>
                    <p className="text-xs text-surface-500">Dedicated Case Coordinator</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {activeCase.manager.phone && (
                    <a
                      href={`tel:${activeCase.manager.phone}`}
                      className="flex items-center gap-2.5 px-3.5 min-h-11 rounded-xl bg-surface-50 hover:bg-primary-50 border border-surface-200 hover:border-primary-200 text-surface-800 font-semibold transition-colors"
                    >
                      <Phone className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums truncate">{activeCase.manager.phone}</span>
                    </a>
                  )}
                  {activeCase.manager.email && (
                    <a
                      href={`mailto:${activeCase.manager.email}`}
                      className="flex items-center gap-2.5 px-3.5 min-h-11 rounded-xl bg-surface-50 hover:bg-primary-50 border border-surface-200 hover:border-primary-200 text-surface-800 font-medium transition-colors"
                    >
                      <Mail className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                      <span className="truncate">{activeCase.manager.email}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 text-xs text-surface-600 leading-relaxed">
                A dedicated care coordinator is being assigned to your case and will appear here shortly.
              </div>
            )}
          </div>

          <Link
            href="/patient/messages"
            className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.96] text-white text-sm font-semibold shadow-2xs transition-[background-color,transform] duration-150"
          >
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            <span>Open Coordinator Chat</span>
          </Link>
        </Card>

        {/* Recommended Next Steps */}
        <Card className="lg:col-span-2 p-6 rounded-3xl shadow-xs border border-surface-200 space-y-4">
          <div className="border-b border-surface-100 pb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Recommended Next Steps</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Keep these items updated to avoid delays in visa letters or specialist review.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary-800 bg-primary-50 px-2.5 py-1 rounded-full border border-primary-200 shrink-0">
              Pre-Travel Checklist
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 border border-surface-200 rounded-2xl bg-surface-50/70 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-800 border border-primary-200 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-surface-900">
                    Share Recent Lab Reports &amp; Scans
                  </h3>
                  <p className="text-xs text-surface-600 mt-0.5">
                    Allows your attending specialist in India to confirm your treatment plan before travel.
                  </p>
                </div>
              </div>
              <Link
                href="/patient/documents"
                className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-white hover:bg-surface-100 text-surface-800 border border-surface-300 text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
              >
                Upload Files
              </Link>
            </div>

            <div className="p-4 border border-surface-200 rounded-2xl bg-surface-50/70 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-success-100 text-success-800 border border-success-200 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-surface-900">
                    Verify Allergies, Medications &amp; Emergency Contact
                  </h3>
                  <p className="text-xs text-surface-600 mt-0.5">
                    Helps hospital admissions prepare safe anesthesia and recovery care on arrival.
                  </p>
                </div>
              </div>
              <Link
                href="/patient/profile"
                className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-white hover:bg-surface-100 text-surface-800 border border-surface-300 text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
              >
                Review Profile
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
