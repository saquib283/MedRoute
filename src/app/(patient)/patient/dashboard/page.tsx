'use client';

/**
 * MediRoute India — Patient Dashboard Page
 * Clinical light-mode layout showing active case status, assigned coordinator, and KPI indicators.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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

const statusSteps = [
  { status: 'INQUIRY_RECEIVED', label: 'Inquiry Received', desc: 'Consultation request filed' },
  { status: 'UNDER_REVIEW', label: 'Under Review', desc: 'Medical files in coordinator assessment' },
  { status: 'PLAN_CONFIRMED', label: 'Plan Confirmed', desc: 'Travel and clinical roadmap confirmed' },
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
        const token = localStorage.getItem('accessToken');
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // 1. Fetch cases
        const casesRes = await fetch('/api/v1/patient/cases', { headers });
        const casesData = await casesRes.json();
        if (casesData.success && casesData.data?.cases?.length > 0) {
          // Select latest active case
          setActiveCase(casesData.data.cases[0]);
        }

        // 2. Fetch appointments meta
        const appRes = await fetch('/api/v1/patient/appointments', { headers });
        const appData = await appRes.json();
        if (appData.success && appData.data?.appointments) {
          // Count upcoming
          const upcoming = appData.data.appointments.filter(
            (a: any) => new Date(a.scheduledAt) > new Date() && a.status !== 'CANCELLED'
          );
          setAppointmentsCount(upcoming.length);
        }

        // 3. Fetch documents count
        const docRes = await fetch('/api/v1/patient/documents', { headers });
        const docData = await docRes.json();
        if (docData.success && docData.data?.documents) {
          setDocumentsCount(docData.data.documents.length);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard overview data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStepIndex = (status: string) => {
    return statusSteps.findIndex((s) => s.status === status);
  };

  const activeIndex = activeCase ? getStepIndex(activeCase.status) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Loading your care workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ─── Header Overview ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">Portal Overview</h1>
          <p className="text-xs text-surface-500 mt-1">Track treatment milestones and access medical files.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/patient/profile">
            <Button variant="secondary" size="sm">Edit Medical Profile</Button>
          </Link>
          <Link href="/patient/documents">
            <Button size="sm">Upload Report</Button>
          </Link>
        </div>
      </div>

      {/* ─── Metric widgets grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-surface-500">Upcoming Appointments</p>
              <p className="text-lg font-bold text-surface-900 mt-0.5">{appointmentsCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-info-50 border border-info-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-surface-500">Uploaded Documents</p>
              <p className="text-lg font-bold text-surface-900 mt-0.5">{documentsCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-success-50 border border-success-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-surface-500">Case Coordinator</p>
              <p className="text-sm font-bold text-surface-900 truncate mt-0.5">
                {activeCase?.manager?.fullName || 'Awaiting assignment'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Case Timeline / Stepper ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-surface-900">Treatment Roadmap & Case Status</h2>
            {activeCase && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500">Current Phase:</span>
                <Badge variant={activeCase.status === 'CLOSED' ? 'default' : 'primary'} dot>
                  {statusSteps[activeIndex]?.label || activeCase.status}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {activeCase ? (
          <div className="relative pl-6 sm:pl-0">
            {/* Horizontal Timeline Bar for Larger Screens */}
            <div className="hidden sm:block absolute top-[18px] left-[5%] right-[5%] h-0.5 bg-surface-200 -z-10" />

            {/* Vertical timeline line for mobile */}
            <div className="sm:hidden absolute left-[11px] top-4 bottom-4 w-0.5 bg-surface-200" />

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-6 sm:gap-4">
              {statusSteps.map((step, idx) => {
                const isPassed = idx < activeIndex;
                const isActive = idx === activeIndex;
                return (
                  <div key={step.status} className="flex sm:flex-col sm:items-center sm:text-center gap-3 sm:gap-2 relative">
                    {/* Circle Node */}
                    <div
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 text-xs font-semibold transition-colors
                        ${
                          isPassed
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : isActive
                              ? 'bg-white border-primary-600 text-primary-600'
                              : 'bg-white border-surface-300 text-surface-400'
                        }
                      `}
                    >
                      {isPassed ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {/* Step label / details */}
                    <div>
                      <p
                        className={`text-xs font-semibold ${
                          isActive ? 'text-primary-700' : isPassed ? 'text-surface-900' : 'text-surface-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[10px] text-surface-400 mt-0.5 leading-normal max-w-[140px] sm:mx-auto">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manager Notes */}
            {activeCase.notes && (
              <div className="mt-8 p-4 bg-surface-100 rounded-lg border border-surface-200">
                <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">Coordinator Comments</span>
                <p className="text-xs text-surface-700 mt-1.5 leading-relaxed">{activeCase.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-surface-500">No active medical coordinator case found for your profile.</p>
            <p className="text-[11px] text-surface-400 mt-1">Please register details or submit an inquiry to assign a coordinator.</p>
          </div>
        )}
      </Card>

      {/* ─── Split coordinator card / appointments list ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinator Info */}
        <Card className="lg:col-span-1">
          <div className="border-b border-surface-100 pb-3 mb-4">
            <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Your Coordinator</h3>
          </div>
          {activeCase?.manager ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary-50 text-primary-700 border border-primary-100 rounded-full flex items-center justify-center font-bold text-sm">
                  {activeCase.manager.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-900">{activeCase.manager.fullName}</p>
                  <p className="text-xs text-surface-500">Assigned Case Manager</p>
                </div>
              </div>
              <div className="space-y-2 border-t border-surface-100 pt-3 text-xs text-surface-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span className="truncate">{activeCase.manager.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.14-4.117-6.942-6.942l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <span>{activeCase.manager.phone || 'No phone provided'}</span>
                </div>
              </div>
              <div className="pt-2">
                <Link href="/patient/messages">
                  <Button fullWidth size="sm">Send Direct Message</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-surface-500">
              Your account has not been assigned a coordinator yet. Once assigned, their contact options will display here.
            </div>
          )}
        </Card>

        {/* Quick appointments overview */}
        <Card className="lg:col-span-2">
          <div className="border-b border-surface-100 pb-3 mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Action Required / Upcoming</h3>
            <Link href="/patient/appointments" className="text-xs text-primary-600 hover:text-primary-700 font-semibold">
              View All
            </Link>
          </div>
          <div className="space-y-3.5">
            <div className="p-3 border border-surface-200 rounded-md bg-surface-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-surface-900">Upload Current Medical Reports</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Please share recent ECG, MRI, or lab details for review.</p>
              </div>
              <Link href="/patient/documents">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">Upload files</Button>
              </Link>
            </div>

            <div className="p-3 border border-surface-200 rounded-md bg-surface-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-surface-900">Verify Passport Validity</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Required for visa confirmation and flight itinerary setup.</p>
              </div>
              <Link href="/patient/documents">
                <Button variant="secondary" size="sm" className="self-start sm:self-auto">Upload passport</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
