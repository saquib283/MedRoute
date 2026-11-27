'use client';

/**
 * MediRoute India — Patient Journey Page
 * Full journey timeline and details for the patient portal.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Timeline } from '@/components/ui/Timeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceTag } from '@/components/ui/PriceTag';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import { toast } from '@/components/ui/Toast';
import {
  CASE_STATUS_LABELS, TREATMENT_PLAN_STATUS_LABELS,
  FOLLOW_UP_TYPE_LABELS, TRANSFER_TYPE_LABELS
} from '@/lib/constants';
import {
  Stethoscope, Calendar, MapPin, Hotel, Receipt, Phone,
  CheckCircle2, Clock, Plane, FileText, Heart, Activity,
  ArrowRight, Shield, AlertCircle, Download
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JourneyCase = any;

export default function PatientJourneyPage() {
  const { format, currentCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<JourneyCase[]>([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [activeCase, setActiveCase] = useState<JourneyCase | null>(null);

  useEffect(() => {
    fetch('/api/v1/patient/journey')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.cases) {
          setCases(d.data.cases);
          if (d.data.cases.length > 0) setActiveCase(d.data.cases[0]);
        }
      })
      .catch(err => console.error('Journey fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const [signingPlan, setSigningPlan] = useState<any | null>(null);
  const [signerFullName, setSignerFullName] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [proofResult, setProofResult] = useState<{ verificationCode: string; verificationUrl: string } | null>(null);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handlePlanResponse = async (planId: string, action: 'ACCEPTED' | 'REJECTED', name?: string) => {
    try {
      setIsSubmittingConsent(true);
      const res = await fetch('/api/v1/patient/treatment-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          action,
          signerFullName: name || signerFullName,
        }),
      });
      const d = await res.json();
      if (d.success) {
        if (action === 'ACCEPTED') {
          toast.success('Treatment plan legally accepted and confirmed!');
          if (d.data?.verificationCode) {
            setProofResult({
              verificationCode: d.data.verificationCode,
              verificationUrl: d.data.verificationUrl,
            });
          }
          setSigningPlan(null);
        } else {
          toast.success('Treatment plan declined');
        }
        // Refresh journey
        const res2 = await fetch('/api/v1/patient/journey');
        const d2 = await res2.json();
        if (d2.success) {
          setCases(d2.data.cases);
          if (d2.data.cases.length > 0) setActiveCase(d2.data.cases[0]);
        }
      } else {
        toast.error(d.error || 'Action failed');
      }
    } catch {
      toast.error('Error processing your response');
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="My Journey" subtitle="Your medical tourism journey at a glance" />
        <EmptyState
          icon={<Heart className="w-8 h-8" />}
          title="No Active Cases"
          description="Your medical journey will appear here once a case is created for you."
        />
      </div>
    );
  }

  // Build timeline events from all data
  const buildTimelineEvents = () => {
    const events = [];

    // Case creation
    events.push({
      id: 'case-created',
      title: 'Case Opened',
      description: `Inquiry received and case created`,
      date: formatDate(activeCase.createdAt),
      status: 'completed' as const,
    });

    // Treatment plan
    if (activeCase.treatmentPlans?.length > 0) {
      const plan = activeCase.treatmentPlans[0];
      events.push({
        id: 'plan',
        title: `Treatment Plan: ${plan.title}`,
        description: plan.totalEstimatedCost ? `Estimated cost: ${format(plan.totalEstimatedCost)}` : undefined,
        date: formatDate(plan.createdAt),
        status: plan.status === 'ACCEPTED' ? 'completed' as const : plan.status === 'SENT_TO_PATIENT' ? 'active' as const : 'upcoming' as const,
      });
    }

    // Visa
    if (activeCase.visaAssistances?.length > 0) {
      const visa = activeCase.visaAssistances[0];
      events.push({
        id: 'visa',
        title: 'Visa Assistance',
        description: visa.hospital?.name ? `Letter from ${visa.hospital.name}` : 'Medical invitation letter',
        date: formatDate(visa.createdAt),
        status: visa.status === 'SENT' ? 'completed' as const : 'active' as const,
      });
    }

    // Transfers (sorted by scheduled date)
    for (const t of (activeCase.transferBookings || [])) {
      events.push({
        id: `transfer-${t.id}`,
        title: TRANSFER_TYPE_LABELS[t.transferType] || t.transferType,
        description: `${t.pickupLocation} → ${t.dropLocation}`,
        date: formatDateTime(t.scheduledAt),
        status: t.status === 'COMPLETED' ? 'completed' as const : t.status === 'CANCELLED' ? 'cancelled' as const : new Date(t.scheduledAt) <= new Date() ? 'active' as const : 'upcoming' as const,
        meta: t.driverName ? `Driver: ${t.driverName}` : undefined,
      });
    }

    // Appointments
    for (const a of (activeCase.appointments || [])) {
      events.push({
        id: `apt-${a.id}`,
        title: `${a.appointmentType.replace(/_/g, ' ')} — Dr. ${a.doctor?.fullName}`,
        description: a.hospital?.name || undefined,
        date: formatDateTime(a.scheduledAt),
        status: a.status === 'COMPLETED' ? 'completed' as const : a.status === 'CANCELLED' ? 'cancelled' as const : 'upcoming' as const,
      });
    }

    // Discharge
    if (activeCase.dischargeSummaries?.length > 0) {
      const ds = activeCase.dischargeSummaries[0];
      events.push({
        id: 'discharge',
        title: 'Discharged',
        description: `Condition: ${ds.conditionAtDischarge || 'N/A'} · Dr. ${ds.doctor?.fullName}`,
        date: formatDate(ds.dischargeDate),
        status: 'completed' as const,
        meta: ds.fitToTravel ? 'Cleared to travel' : 'Not cleared for travel',
      });
    }

    // Follow-ups
    for (const f of (activeCase.followUps || [])) {
      events.push({
        id: `followup-${f.id}`,
        title: `Follow-up: ${FOLLOW_UP_TYPE_LABELS[f.followUpType] || f.followUpType}`,
        description: f.doctor?.fullName ? `With Dr. ${f.doctor.fullName}` : undefined,
        date: formatDateTime(f.scheduledAt),
        status: f.status === 'COMPLETED' ? 'completed' as const : f.status === 'MISSED' ? 'cancelled' as const : 'upcoming' as const,
      });
    }

    // Sort by date
    events.sort((a, b) => {
      const dateA = new Date(a.date === '—' ? '2099-01-01' : a.date);
      const dateB = new Date(b.date === '—' ? '2099-01-01' : b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return events;
  };

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'treatment', label: 'Treatment Plan', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'travel', label: 'Visa & Travel', icon: <Plane className="w-4 h-4" /> },
    { id: 'billing', label: 'My Bills', icon: <Receipt className="w-4 h-4" /> },
    { id: 'discharge', label: 'Discharge', icon: <FileText className="w-4 h-4" /> },
  ];

  const totalBilled = activeCase.invoices?.reduce((sum: number, inv: JourneyCase) => sum + Number(inv.totalAmount), 0) || 0;
  const totalPaid = activeCase.invoices?.reduce((sum: number, inv: JourneyCase) => sum + Number(inv.paidAmount), 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Medical Journey"
        subtitle={`Status: ${CASE_STATUS_LABELS[activeCase.status] || activeCase.status}`}
        actions={<StatusBadge status={activeCase.status} size="md" />}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Journey Status"
          value={CASE_STATUS_LABELS[activeCase.status] || activeCase.status}
          icon={<Activity className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="Estimated Cost"
          value={activeCase.totalEstimatedCost ? format(activeCase.totalEstimatedCost) : '—'}
          icon={<Receipt className="w-5 h-5" />}
        />
        <StatCard
          title="Amount Paid"
          value={format(totalPaid)}
          subtitle={totalBilled > 0 ? `of ${format(totalBilled)}` : undefined}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="Coordinator"
          value={activeCase.manager?.fullName || 'Assigned soon'}
          subtitle={activeCase.manager?.email}
          icon={<Shield className="w-5 h-5" />}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-1">
        {activeTab === 'timeline' && (
          <TabPanel>
            <Card className="p-6 bg-white border border-surface-200">
              <h3 className="text-lg font-bold text-surface-900 mb-6">Your Journey Timeline</h3>
              <Timeline events={buildTimelineEvents()} />
            </Card>
          </TabPanel>
        )}

        {activeTab === 'treatment' && (
          <TabPanel>
            <div className="space-y-4">
              {(!activeCase.treatmentPlans || activeCase.treatmentPlans.length === 0) ? (
                <EmptyState
                  icon={<Stethoscope className="w-8 h-8" />}
                  title="Treatment Plan Pending"
                  description="Your coordinator is preparing a treatment plan with cost estimates. You'll be notified when it's ready for review."
                />
              ) : (
                activeCase.treatmentPlans.map((plan: JourneyCase) => (
                  <Card key={plan.id} className="p-6 bg-white border border-surface-200 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-surface-900">{plan.title}</h3>
                        <p className="text-sm text-surface-500 mt-1">{plan.estimatedDuration ? `Duration: ${plan.estimatedDuration}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={plan.status} size="md" />
                        {plan.totalEstimatedCost && (
                          <PriceTag amountInINR={plan.totalEstimatedCost} size="xl" showOriginalINR className="text-primary-700 font-extrabold" />
                        )}
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="border-t border-surface-100 pt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-surface-500 uppercase border-b border-surface-200">
                            <th className="text-left pb-2 font-bold">Description</th>
                            <th className="text-left pb-2 font-bold">Hospital</th>
                            <th className="text-left pb-2 font-bold">Doctor</th>
                            <th className="text-right pb-2 font-bold">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.items?.map((item: JourneyCase, i: number) => (
                            <tr key={i} className="border-b border-surface-50">
                              <td className="py-2.5 text-surface-900 font-medium">{item.description}</td>
                              <td className="py-2.5 text-surface-600">{item.hospital?.name || '—'}</td>
                              <td className="py-2.5 text-surface-600">{item.doctor?.fullName ? `Dr. ${item.doctor.fullName}` : '—'}</td>
                              <td className="py-2.5 text-right font-bold">
                                <PriceTag amountInINR={item.totalCost} size="sm" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-surface-200">
                            <td colSpan={3} className="pt-3 text-right font-bold text-surface-900 uppercase text-xs tracking-wider">Total Estimated Cost</td>
                            <td className="pt-3 text-right">
                              <PriceTag amountInINR={plan.totalEstimatedCost} size="xl" showOriginalINR className="text-primary-700" />
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Action buttons for plans awaiting response */}
                    {plan.status === 'SENT_TO_PATIENT' && (
                      <div className="border-t border-surface-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-surface-600">
                          <AlertCircle className="w-4 h-4 shrink-0 text-warning-600" />
                          <span>Formal review and legally binding acceptance required</span>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePlanResponse(plan.id, 'REJECTED')}
                            className="!text-danger-600 hover:!bg-danger-50 text-xs"
                          >
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSigningPlan(plan);
                              setConsent1(false);
                              setConsent2(false);
                              setConsent3(false);
                            }}
                            className="text-xs font-bold shadow-xs"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Sign & Accept Plan
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}

              {/* Verified Digital Proof Receipt Banner */}
              {proofResult && (
                <div className="p-5 bg-success-50 border-2 border-success-500 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-success-100 text-success-700 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-success-900">Treatment Plan Legally Accepted & Recorded</h4>
                      <p className="text-xs text-success-800 mt-0.5">
                        Your electronic signature and SHA-256 document digest have been permanently logged.
                      </p>
                      <p className="text-xs font-mono font-bold text-primary-700 mt-1">
                        Proof Code: {proofResult.verificationCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={proofResult.verificationUrl} target="_blank">
                      <Button size="sm" className="!bg-success-700 hover:!bg-success-800 text-white font-bold text-xs">
                        View Official Certificate
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setProofResult(null)} className="text-xs">
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {/* Digital E-Signature Acceptance Modal */}
              {signingPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
                  <div className="w-full max-w-lg bg-white rounded-2xl border border-surface-200 shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-in">
                    <div className="flex items-center justify-between pb-3 border-b border-surface-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-surface-900">Digital Acceptance & E-Signature</h3>
                          <p className="text-[11px] text-surface-500">Legal confirmation under IT Act § 10A & HIPAA Standards</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSigningPlan(null)}
                        className="text-surface-400 hover:text-surface-600 text-sm font-bold p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-3.5 bg-surface-50 rounded-xl border border-surface-200/80 text-xs space-y-1">
                      <p className="font-bold text-surface-900">Plan: {signingPlan.title}</p>
                      <p className="text-surface-600">
                        Total Estimated Cost:{' '}
                        <span className="font-bold text-primary-700">₹{Number(signingPlan.totalEstimatedCost).toLocaleString()}</span>
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-surface-700">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent1}
                          onChange={(e) => setConsent1(e.target.checked)}
                          className="mt-0.5 rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span>
                          I acknowledge that <strong>MediRoute India</strong> is a medical facilitator and concierge, and clinical responsibility rests solely with the treating hospital.
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent2}
                          onChange={(e) => setConsent2(e.target.checked)}
                          className="mt-0.5 rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span>
                          I authorize MediRoute India to transmit my medical records and diagnostic scans to the hospital medical board for clinical facilitation.
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent3}
                          onChange={(e) => setConsent3(e.target.checked)}
                          className="mt-0.5 rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span>
                          I agree to the estimated cost breakdown and understand final billing is determined after in-person hospital diagnostics per the{' '}
                          <Link href="/terms" target="_blank" className="text-primary-600 underline">Terms of Service</Link>.
                        </span>
                      </label>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-surface-100">
                      <label className="block text-xs font-bold text-surface-700">
                        Signer Full Legal Name <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={signerFullName}
                        onChange={(e) => setSignerFullName(e.target.value)}
                        placeholder="Type your full legal name to e-sign"
                        className="w-full px-3.5 py-2 text-sm bg-surface-50 border border-surface-300 rounded-xl focus:bg-white focus:border-primary-600 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <Button variant="ghost" size="sm" onClick={() => setSigningPlan(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!consent1 || !consent2 || !consent3 || !signerFullName.trim() || isSubmittingConsent}
                        isLoading={isSubmittingConsent}
                        onClick={() => handlePlanResponse(signingPlan.id, 'ACCEPTED', signerFullName)}
                        className="font-bold shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Sign & Confirm Acceptance
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'travel' && (
          <TabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Visa */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                  <Plane className="w-5 h-5 text-primary-600" /> Visa Status
                </h3>
                {(!activeCase.visaAssistances || activeCase.visaAssistances.length === 0) ? (
                  <Card className="p-5 bg-white border border-surface-200">
                    <EmptyState title="Visa Assistance Pending" description="Your coordinator will arrange the medical invitation letter." />
                  </Card>
                ) : (
                  activeCase.visaAssistances.map((v: JourneyCase) => (
                    <Card key={v.id} className="p-5 bg-white border border-surface-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-surface-900">Medical Invitation Letter</h4>
                        <StatusBadge status={v.status} size="md" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-surface-500 text-xs">Hospital</span><p className="font-semibold">{v.hospital?.name || '—'}</p></div>
                        <div><span className="text-surface-500 text-xs">Nationality</span><p>{v.nationality}</p></div>
                        <div><span className="text-surface-500 text-xs">Est. Arrival</span><p>{formatDate(v.estimatedArrival)}</p></div>
                        <div><span className="text-surface-500 text-xs">Est. Departure</span><p>{formatDate(v.estimatedDeparture)}</p></div>
                      </div>
                      {v.invitationLetterUrl && (
                        <Button size="sm" variant="secondary">
                          <Download className="w-3.5 h-3.5 mr-1" /> Download Letter
                        </Button>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Transfers */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" /> My Transfers
                </h3>
                {(!activeCase.transferBookings || activeCase.transferBookings.length === 0) ? (
                  <Card className="p-5 bg-white border border-surface-200">
                    <EmptyState title="No Transfers Yet" description="Airport pickups and transfers will appear here." />
                  </Card>
                ) : (
                  activeCase.transferBookings.map((t: JourneyCase) => (
                    <Card key={t.id} className="p-4 bg-white border border-surface-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                          {TRANSFER_TYPE_LABELS[t.transferType] || t.transferType}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-surface-700 mt-2">
                        <span>{t.pickupLocation}</span>
                        <ArrowRight className="w-3 h-3 text-surface-400" />
                        <span>{t.dropLocation}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-surface-500">
                        <span>{formatDateTime(t.scheduledAt)}</span>
                        {t.driverName && <span>Driver: {t.driverName} · {t.driverPhone}</span>}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabPanel>
        )}

        {activeTab === 'billing' && (
          <TabPanel>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-surface-900">My Bills & Payments</h3>
              {(!activeCase.invoices || activeCase.invoices.length === 0) ? (
                <EmptyState icon={<Receipt className="w-8 h-8" />} title="No Bills Yet" description="Your bills will appear here once treatment begins." />
              ) : (
                activeCase.invoices.map((inv: JourneyCase) => (
                  <Card key={inv.id} className="p-5 bg-white border border-surface-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-surface-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-surface-500 capitalize">{inv.invoiceType.toLowerCase().replace(/_/g, ' ')}</p>
                      </div>
                      <StatusBadge status={inv.status} size="md" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 border-t border-surface-100 pt-3">
                      <div><span className="text-surface-500 text-xs">Total</span><p className="font-bold text-lg"><PriceTag amountInINR={inv.totalAmount} size="lg" /></p></div>
                      <div><span className="text-surface-500 text-xs">Paid</span><p className="font-bold text-lg text-success-700"><PriceTag amountInINR={inv.paidAmount} size="lg" className="text-success-700" /></p></div>
                      <div><span className="text-surface-500 text-xs">Balance Due</span><p className="font-bold text-lg"><PriceTag amountInINR={inv.balanceDue} size="lg" className={Number(inv.balanceDue) > 0 ? '!text-danger-600' : '!text-surface-400'} /></p></div>
                    </div>
                    {inv.payments && inv.payments.length > 0 && (
                      <div className="border-t border-surface-100 pt-3 mt-3">
                        <p className="text-xs font-bold text-surface-500 uppercase mb-2">Payment History</p>
                        {inv.payments.map((p: JourneyCase) => (
                          <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-surface-50 last:border-0">
                            <span className="text-surface-700">{formatDate(p.paidAt)} · {p.paymentMethod.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-success-700"><PriceTag amountInINR={p.amount} size="sm" className="text-success-700" /></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'discharge' && (
          <TabPanel>
            <div className="space-y-4">
              {(!activeCase.dischargeSummaries || activeCase.dischargeSummaries.length === 0) ? (
                <EmptyState
                  icon={<FileText className="w-8 h-8" />}
                  title="Discharge Summary Not Available"
                  description="Your discharge summary will be available after treatment is completed."
                />
              ) : (
                activeCase.dischargeSummaries.map((ds: JourneyCase) => (
                  <Card key={ds.id} className="p-6 bg-white border border-surface-200 space-y-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold text-surface-900">Discharge Summary</h3>
                      <StatusBadge status={ds.conditionAtDischarge || 'STABLE'} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-surface-500 text-xs">Attending Doctor</span><p className="font-semibold">Dr. {ds.doctor?.fullName}</p></div>
                      <div><span className="text-surface-500 text-xs">Discharge Date</span><p className="font-semibold">{formatDate(ds.dischargeDate)}</p></div>
                    </div>

                    <div className="border-t border-surface-100 pt-4 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-surface-500 uppercase mb-1">Diagnosis</p>
                        <p className="text-sm text-surface-800">{ds.diagnosis}</p>
                      </div>
                      {ds.procedurePerformed && (
                        <div>
                          <p className="text-xs font-bold text-surface-500 uppercase mb-1">Procedure Performed</p>
                          <p className="text-sm text-surface-800">{ds.procedurePerformed}</p>
                        </div>
                      )}
                    </div>

                    {ds.dischargeMedications && Array.isArray(ds.dischargeMedications) && ds.dischargeMedications.length > 0 && (
                      <div className="border-t border-surface-100 pt-4">
                        <p className="text-xs font-bold text-surface-500 uppercase mb-2">Prescribed Medications</p>
                        <div className="space-y-2">
                          {ds.dischargeMedications.map((med: JourneyCase, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-surface-50 rounded-lg text-sm">
                              <span className="font-semibold text-surface-900">{med.name}</span>
                              <span className="text-surface-600">{med.dosage} · {med.frequency} · {med.duration}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-surface-100 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
                      {ds.dietaryInstructions && (
                        <div className="p-3 bg-info-50 rounded-lg">
                          <p className="text-xs font-bold text-info-700 mb-1">🍽️ Diet Instructions</p>
                          <p className="text-info-800">{ds.dietaryInstructions}</p>
                        </div>
                      )}
                      {ds.activityRestrictions && (
                        <div className="p-3 bg-warning-50 rounded-lg">
                          <p className="text-xs font-bold text-warning-700 mb-1">⚠️ Activity Restrictions</p>
                          <p className="text-warning-800">{ds.activityRestrictions}</p>
                        </div>
                      )}
                    </div>

                    {ds.fitToTravel && (
                      <div className="flex items-center gap-2 p-3 bg-success-50 border border-success-200 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-success-600" />
                        <span className="text-sm font-bold text-success-700">
                          Cleared for travel {ds.fitToTravelDate ? `from ${formatDate(ds.fitToTravelDate)}` : ''}
                        </span>
                      </div>
                    )}
                  </Card>
                ))
              )}

              {/* Follow-ups */}
              {activeCase.followUps && activeCase.followUps.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary-600" /> Scheduled Follow-ups
                  </h3>
                  {activeCase.followUps.map((f: JourneyCase) => (
                    <Card key={f.id} className="p-4 bg-white border border-surface-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-info-50 flex items-center justify-center text-info-600">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-surface-900">{FOLLOW_UP_TYPE_LABELS[f.followUpType] || f.followUpType}</p>
                            <p className="text-xs text-surface-500">{f.doctor?.fullName ? `With Dr. ${f.doctor.fullName}` : 'Doctor TBD'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={f.status} />
                          <p className="text-xs text-surface-500 mt-1">{formatDateTime(f.scheduledAt)}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  );
}
