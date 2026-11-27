'use client';

/**
 * MediRoute India — Manager Case Workspace
 * Comprehensive case detail page with tabbed sections replacing all modals.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Timeline } from '@/components/ui/Timeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { PriceTag } from '@/components/ui/PriceTag';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import { CASE_STATUS_LABELS, TRANSFER_TYPE_LABELS, FOLLOW_UP_TYPE_LABELS } from '@/lib/constants';
import {
  FileText, Calendar, Plane, Hotel, Receipt, MessageSquare, FolderLock,
  Stethoscope, ClipboardList, ArrowRight, Clock, MapPin, User, Phone,
  CheckCircle2, AlertCircle, DollarSign, Send, Plus
} from 'lucide-react';

interface CaseDetailData {
  id: string;
  status: string;
  notes: string | null;
  isUrgent: boolean;
  arrivalDate: string | null;
  departureDate: string | null;
  totalEstimatedCost: string | null;
  totalBilledAmount: string | null;
  totalPaidAmount: string | null;
  createdAt: string;
  patient: {
    id: string;
    nationality: string;
    dob: string;
    bloodGroup: string | null;
    user: { fullName: string; email: string; phone: string | null };
  };
  manager: { fullName: string; email: string } | null;
  treatmentPlans: TreatmentPlan[];
  visaAssistances: VisaAssistance[];
  transferBookings: TransferBooking[];
  accommodationBookings: AccommodationBooking[];
  appointments: Appointment[];
  dischargeSummaries: DischargeSummary[];
  followUps: FollowUpRecord[];
  invoices: InvoiceRecord[];
}

interface TreatmentPlan {
  id: string; title: string; status: string; totalEstimatedCost: string | null;
  estimatedDuration: string | null; createdAt: string;
  items: { description: string; itemType: string; totalCost: string; hospital?: { name: string } | null; doctor?: { fullName: string } | null }[];
}
interface VisaAssistance {
  id: string; status: string; patientFullName: string; nationality: string;
  estimatedArrival: string | null; estimatedDeparture: string | null; frroRequired: boolean;
  hospital?: { name: string } | null;
}
interface TransferBooking {
  id: string; transferType: string; status: string; scheduledAt: string;
  pickupLocation: string; dropLocation: string; driverName: string | null; driverPhone: string | null;
}
interface AccommodationBooking {
  id: string; status: string; checkIn: string; checkOut: string; roomType: string;
  totalAmount: string | null; hostel: { name: string; city: string };
}
interface Appointment {
  id: string; appointmentType: string; status: string; scheduledAt: string;
  hospital: { name: string }; doctor: { fullName: string; specialisation?: { name: string } };
}
interface DischargeSummary {
  id: string; diagnosis: string; conditionAtDischarge: string | null;
  dischargeDate: string; fitToTravel: boolean; doctor: { fullName: string };
}
interface FollowUpRecord {
  id: string; followUpType: string; status: string; scheduledAt: string;
  doctor?: { fullName: string } | null;
}
interface InvoiceRecord {
  id: string; invoiceNumber: string; invoiceType: string; status: string;
  totalAmount: string; paidAmount: string; balanceDue: string;
}

export default function CaseWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { format } = useCurrency();
  const [caseId, setCaseId] = useState('');
  const [caseData, setCaseData] = useState<CaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');

  useEffect(() => {
    params.then(p => setCaseId(p.id));
  }, [params]);

  const fetchCase = useCallback(async () => {
    if (!caseId) return;
    try {
      // Fetch case with all relations from the admin cases endpoint
      const res = await fetch(`/api/v1/admin/cases?id=${caseId}`);
      const data = await res.json();
      if (data.success && data.data?.case) {
        setCaseData(data.data.case);
        setTargetStatus(data.data.case.status);
      } else {
        // Fallback: try manager endpoint
        const res2 = await fetch(`/api/v1/manager/cases`);
        const data2 = await res2.json();
        const found = data2.cases?.find((c: CaseDetailData) => c.id === caseId);
        if (found) setCaseData(found);
      }
    } catch (err) {
      console.error('Failed to load case:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  // Fetch journey-related data
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([]);
  const [visaRecords, setVisaRecords] = useState<VisaAssistance[]>([]);
  const [transfers, setTransfers] = useState<TransferBooking[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  useEffect(() => {
    if (!caseId) return;
    // Fetch treatment plans
    fetch(`/api/v1/manager/treatment-plans?caseId=${caseId}`).then(r => r.json()).then(d => {
      if (d.success) setTreatmentPlans(d.data.treatmentPlans);
    }).catch(() => {});
    // Fetch visa
    fetch(`/api/v1/manager/visa-assistance?caseId=${caseId}`).then(r => r.json()).then(d => {
      if (d.success) setVisaRecords(d.data.visaAssistances);
    }).catch(() => {});
    // Fetch transfers
    fetch(`/api/v1/manager/transfers?caseId=${caseId}`).then(r => r.json()).then(d => {
      if (d.success) setTransfers(d.data.transfers);
    }).catch(() => {});
    // Fetch follow-ups
    fetch(`/api/v1/manager/follow-ups?caseId=${caseId}`).then(r => r.json()).then(d => {
      if (d.success) setFollowUps(d.data.followUps);
    }).catch(() => {});
    // Fetch invoices
    fetch(`/api/v1/manager/invoices?caseId=${caseId}`).then(r => r.json()).then(d => {
      if (d.success) setInvoices(d.data.invoices);
    }).catch(() => {});
  }, [caseId]);

  const handleStatusUpdate = async () => {
    if (!targetStatus || !caseId) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/v1/manager/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, status: targetStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Case status updated');
        fetchCase();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Error updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <EmptyState
        title="Case Not Found"
        description="This case doesn't exist or you don't have access to it."
        action={<Button onClick={() => router.push('/manager/cases')}>Back to Cases</Button>}
      />
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'treatment', label: 'Treatment Plan', icon: <Stethoscope className="w-4 h-4" />, badge: treatmentPlans.length },
    { id: 'visa', label: 'Visa & Travel', icon: <Plane className="w-4 h-4" />, badge: visaRecords.length + transfers.length },
    { id: 'accommodation', label: 'Accommodation', icon: <Hotel className="w-4 h-4" />, badge: caseData.accommodationBookings?.length || 0 },
    { id: 'billing', label: 'Billing', icon: <Receipt className="w-4 h-4" />, badge: invoices.length },
    { id: 'appointments', label: 'Appointments', icon: <Calendar className="w-4 h-4" />, badge: caseData.appointments?.length || 0 },
    { id: 'followups', label: 'Follow-ups', icon: <Phone className="w-4 h-4" />, badge: followUps.length },
  ];

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Case: ${caseData.patient?.user?.fullName || 'Patient'}`}
        subtitle={`${caseData.patient?.nationality || ''} · Case ID: ${caseId.slice(0, 8)}...`}
        breadcrumbs={[
          { label: 'Cases', href: '/manager/cases' },
          { label: caseData.patient?.user?.fullName || 'Case Detail' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={caseData.status} size="md" />
            {caseData.isUrgent && (
              <span className="px-2 py-1 bg-danger-50 text-danger-700 text-xs font-bold rounded-lg border border-danger-200">
                ⚡ URGENT
              </span>
            )}
          </div>
        }
      />

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Estimated Cost"
          value={caseData.totalEstimatedCost ? format(caseData.totalEstimatedCost) : '—'}
          icon={<DollarSign className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="Total Billed"
          value={caseData.totalBilledAmount ? format(caseData.totalBilledAmount) : '—'}
          icon={<Receipt className="w-5 h-5" />}
          variant="warning"
        />
        <StatCard
          title="Total Paid"
          value={caseData.totalPaidAmount ? format(caseData.totalPaidAmount) : '—'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="Appointments"
          value={caseData.appointments?.length || 0}
          subtitle={`${caseData.appointments?.filter(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length || 0} upcoming`}
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-1">
        {activeTab === 'overview' && (
          <TabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Patient Info */}
              <Card className="p-5 bg-white border border-surface-200 space-y-4">
                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600" /> Patient Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div><span className="text-surface-500 text-xs font-medium">Name</span><p className="font-semibold text-surface-900">{caseData.patient?.user?.fullName}</p></div>
                  <div><span className="text-surface-500 text-xs font-medium">Email</span><p className="text-surface-700">{caseData.patient?.user?.email}</p></div>
                  <div><span className="text-surface-500 text-xs font-medium">Nationality</span><p className="text-surface-700">{caseData.patient?.nationality}</p></div>
                  <div><span className="text-surface-500 text-xs font-medium">Blood Group</span><p className="text-surface-700">{caseData.patient?.bloodGroup || '—'}</p></div>
                  <div><span className="text-surface-500 text-xs font-medium">Date of Birth</span><p className="text-surface-700">{formatDate(caseData.patient?.dob)}</p></div>
                </div>
              </Card>

              {/* Status & Actions */}
              <Card className="p-5 bg-white border border-surface-200 space-y-4">
                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary-600" /> Case Status
                </h3>
                <div className="space-y-3">
                  <Select
                    label="Update Status"
                    value={targetStatus}
                    onChange={setTargetStatus}
                    options={Object.entries(CASE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  />
                  <Button
                    onClick={handleStatusUpdate}
                    isLoading={updatingStatus}
                    disabled={targetStatus === caseData.status}
                    className="w-full"
                  >
                    Update Status
                  </Button>
                </div>
                <div className="border-t border-surface-100 pt-3 space-y-2 text-sm">
                  <div><span className="text-surface-500 text-xs">Arrival</span><p className="font-semibold">{formatDate(caseData.arrivalDate)}</p></div>
                  <div><span className="text-surface-500 text-xs">Departure</span><p className="font-semibold">{formatDate(caseData.departureDate)}</p></div>
                  <div><span className="text-surface-500 text-xs">Case Created</span><p className="text-surface-600">{formatDate(caseData.createdAt)}</p></div>
                </div>
              </Card>

              {/* Notes & Manager */}
              <Card className="p-5 bg-white border border-surface-200 space-y-4">
                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-600" /> Coordinator
                </h3>
                {caseData.manager ? (
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-surface-900">{caseData.manager.fullName}</p>
                    <p className="text-surface-600">{caseData.manager.email}</p>
                  </div>
                ) : (
                  <p className="text-sm text-surface-400">No manager assigned</p>
                )}
                {caseData.notes && (
                  <div className="border-t border-surface-100 pt-3">
                    <p className="text-xs text-surface-500 font-medium mb-1">Case Notes</p>
                    <p className="text-sm text-surface-700 whitespace-pre-wrap">{caseData.notes}</p>
                  </div>
                )}
              </Card>
            </div>
          </TabPanel>
        )}

        {activeTab === 'treatment' && (
          <TabPanel>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900">Treatment Plans</h3>
                <Link href={`/manager/cases/${caseId}/treatment-plan`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Plan</Button>
                </Link>
              </div>
              {treatmentPlans.length === 0 ? (
                <EmptyState
                  icon={<Stethoscope className="w-8 h-8" />}
                  title="No Treatment Plans"
                  description="Create a treatment plan with cost estimates for this patient."
                  action={
                    <Link href={`/manager/cases/${caseId}/treatment-plan`}>
                      <Button>Create Treatment Plan</Button>
                    </Link>
                  }
                />
              ) : (
                treatmentPlans.map(plan => (
                  <Card key={plan.id} className="p-5 bg-white border border-surface-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-surface-900">{plan.title}</h4>
                        <p className="text-xs text-surface-500 mt-0.5">Created {formatDate(plan.createdAt)} · {plan.estimatedDuration || '—'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={plan.status} />
                        {plan.totalEstimatedCost && (
                          <PriceTag amountInINR={plan.totalEstimatedCost} size="lg" showOriginalINR className="text-primary-700 font-bold" />
                        )}
                      </div>
                    </div>
                    <div className="border-t border-surface-100 pt-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-surface-500 uppercase">
                            <th className="text-left pb-2 font-bold">Item</th>
                            <th className="text-left pb-2 font-bold">Type</th>
                            <th className="text-right pb-2 font-bold">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.items.map((item, i) => (
                            <tr key={i} className="border-t border-surface-50">
                              <td className="py-2 text-surface-900">{item.description}</td>
                              <td className="py-2 text-surface-600">{item.itemType}</td>
                              <td className="py-2 text-right font-semibold">
                                <PriceTag amountInINR={item.totalCost} size="sm" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {plan.status === 'DRAFT' && (
                      <div className="flex justify-end mt-3 pt-3 border-t border-surface-100">
                        <Button size="sm" onClick={async () => {
                          const res = await fetch(`/api/v1/manager/treatment-plans/${plan.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'SENT_TO_PATIENT' }),
                          });
                          const d = await res.json();
                          if (d.success) { toast.success('Plan sent to patient'); fetchCase(); }
                        }}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Send to Patient
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'visa' && (
          <TabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Visa Assistance */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-600" /> Visa Assistance
                </h3>
                {visaRecords.length === 0 ? (
                  <Card className="p-5 bg-white border border-surface-200">
                    <EmptyState
                      title="No Visa Records"
                      description="Request a medical invitation letter for the patient's visa application."
                      action={
                        <Link href={`/manager/cases/${caseId}/visa`}>
                          <Button size="sm">Request Visa Letter</Button>
                        </Link>
                      }
                    />
                  </Card>
                ) : (
                  visaRecords.map(v => (
                    <Card key={v.id} className="p-5 bg-white border border-surface-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-surface-900">{v.patientFullName}</p>
                          <p className="text-xs text-surface-500">{v.nationality} · Hospital: {v.hospital?.name || '—'}</p>
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-surface-500 text-xs">Est. Arrival</span><p>{formatDate(v.estimatedArrival)}</p></div>
                        <div><span className="text-surface-500 text-xs">Est. Departure</span><p>{formatDate(v.estimatedDeparture)}</p></div>
                      </div>
                      {v.frroRequired && (
                        <div className="flex items-center gap-2 text-xs text-warning-700 bg-warning-50 p-2 rounded-lg">
                          <AlertCircle className="w-4 h-4" /> FRRO registration required (stay exceeds 180 days)
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Transfers */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" /> Transfer Bookings
                </h3>
                {transfers.length === 0 ? (
                  <Card className="p-5 bg-white border border-surface-200">
                    <EmptyState
                      title="No Transfers"
                      description="Book airport pickups, drops, and inter-facility transfers."
                    />
                  </Card>
                ) : (
                  transfers.map(t => (
                    <Card key={t.id} className="p-4 bg-white border border-surface-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                            {TRANSFER_TYPE_LABELS[t.transferType] || t.transferType}
                          </span>
                          <StatusBadge status={t.status} />
                        </div>
                        <span className="text-xs text-surface-500">{formatDate(t.scheduledAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-surface-700 mt-2">
                        <span>{t.pickupLocation}</span>
                        <ArrowRight className="w-3 h-3 text-surface-400" />
                        <span>{t.dropLocation}</span>
                      </div>
                      {t.driverName && (
                        <p className="text-xs text-surface-500 mt-1">Driver: {t.driverName} · {t.driverPhone}</p>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabPanel>
        )}

        {activeTab === 'accommodation' && (
          <TabPanel>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900">Accommodation Bookings</h3>
                <Link href={`/manager/accommodations`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Book Accommodation</Button>
                </Link>
              </div>
              {(!caseData.accommodationBookings || caseData.accommodationBookings.length === 0) ? (
                <EmptyState icon={<Hotel className="w-8 h-8" />} title="No Bookings" description="Book accommodation near the partner hospital." />
              ) : (
                caseData.accommodationBookings.map(b => (
                  <Card key={b.id} className="p-5 bg-white border border-surface-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-surface-900">{b.hostel.name}</h4>
                        <p className="text-xs text-surface-500">{b.hostel.city} · {b.roomType} Room</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm border-t border-surface-100 pt-3">
                      <div><span className="text-surface-500 text-xs">Check-in</span><p className="font-semibold">{formatDate(b.checkIn)}</p></div>
                      <div><span className="text-surface-500 text-xs">Check-out</span><p className="font-semibold">{formatDate(b.checkOut)}</p></div>
                      <div><span className="text-surface-500 text-xs">Total</span><p className="font-bold text-primary-700"><PriceTag amountInINR={b.totalAmount} size="sm" /></p></div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'billing' && (
          <TabPanel>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900">Invoices & Payments</h3>
                <Link href={`/manager/cases/${caseId}/billing`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Create Invoice</Button>
                </Link>
              </div>
              {invoices.length === 0 ? (
                <EmptyState icon={<Receipt className="w-8 h-8" />} title="No Invoices" description="Create invoices for treatment, accommodation, and logistics." />
              ) : (
                <div className="space-y-3">
                  {invoices.map(inv => (
                    <Card key={inv.id} className="p-4 bg-white border border-surface-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-surface-900">{inv.invoiceNumber}</p>
                          <p className="text-xs text-surface-500">{inv.invoiceType}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={inv.status} />
                          <div className="text-right">
                            <p className="font-bold text-surface-900"><PriceTag amountInINR={inv.totalAmount} size="sm" /></p>
                            {Number(inv.balanceDue) > 0 && (
                              <p className="text-xs text-danger-600">Due: <PriceTag amountInINR={inv.balanceDue} size="xs" className="text-danger-600" /></p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'appointments' && (
          <TabPanel>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-surface-900">Appointments</h3>
              {(!caseData.appointments || caseData.appointments.length === 0) ? (
                <EmptyState icon={<Calendar className="w-8 h-8" />} title="No Appointments" description="Schedule consultations, pre-op assessments, and surgeries." />
              ) : (
                caseData.appointments.map(a => (
                  <Card key={a.id} className="p-4 bg-white border border-surface-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-surface-900">{a.appointmentType.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-surface-500">Dr. {a.doctor.fullName} · {a.hospital.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={a.status} />
                        <p className="text-xs text-surface-500 mt-1">{formatDate(a.scheduledAt)}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'followups' && (
          <TabPanel>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900">Follow-ups</h3>
              </div>
              {followUps.length === 0 ? (
                <EmptyState icon={<Phone className="w-8 h-8" />} title="No Follow-ups" description="Schedule post-discharge follow-ups after the patient's treatment." />
              ) : (
                followUps.map(f => (
                  <Card key={f.id} className="p-4 bg-white border border-surface-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-info-50 flex items-center justify-center text-info-600">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-surface-900">{FOLLOW_UP_TYPE_LABELS[f.followUpType] || f.followUpType}</p>
                          <p className="text-xs text-surface-500">{f.doctor?.fullName ? `Dr. ${f.doctor.fullName}` : 'Doctor TBD'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={f.status} />
                        <p className="text-xs text-surface-500 mt-1">{formatDate(f.scheduledAt)}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  );
}
