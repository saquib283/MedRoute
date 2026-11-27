'use client';

/**
 * MediRoute India — Global & Indian Statutory Compliance Hub
 * Unified compliance command center covering NABH MVTF, e-FRRO Form 'C', THOTA Transplants,
 * DPDP/HIPAA Cryptographic Audit Chains, and FEMA Remittances.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  Lock,
  FileCheck2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Heart,
  Scale,
  Receipt,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface ConsentRecord {
  id: string;
  verificationCode: string;
  consentType: string;
  signerFullName: string;
  signerEmail: string;
  signerRole: string;
  documentHash: string;
  statement: string;
  ipAddress: string | null;
  geoCountry: string | null;
  signedAt: string;
}

interface FormCRecord {
  id: string;
  caseId: string;
  hostelName: string;
  guestFullName: string;
  nationality: string;
  passportNumber: string;
  visaNumber: string;
  arrivalDate: string;
  deadline: string;
  status: string;
  remainingHours: number;
  isOverdue: boolean;
  urgency: string;
  formCApplicationNumber?: string;
}

interface TransplantRecord {
  id: string;
  caseId: string;
  organType: string;
  donorFullName: string;
  donorNationality: string;
  donorRelation: string;
  approvalStatus: string;
  form21EmbassyNocUrl?: string;
  form11JointApplicationUrl?: string;
  committeeNocNumber?: string;
  case?: { patient?: { nationality: string; user?: { fullName: string } } };
}

interface GrievanceItem {
  id: string;
  ticketNumber: string;
  category: string;
  severity: string;
  subject: string;
  description: string;
  status: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  slaStatus: string;
  ackRemainingHours: number;
  resRemainingHours: number;
  patient?: { user?: { fullName: string; email: string } };
  createdAt: string;
}

interface FemaItem {
  id: string;
  swiftReference: string;
  fircNumber: string | null;
  remittingBank: string;
  remittingCountry: string;
  foreignCurrency: string;
  foreignAmount: number;
  inrRealizedAmount: number;
  realizedAt: string;
  invoice?: { invoiceNumber: string };
}

interface VerificationReport {
  isValid: boolean;
  totalChecked: number;
  unbrokenCount: number;
  tamperedCount: number;
  tamperedLogs: { id: string; action: string; expectedHash: string; actualHash: string; createdAt: string }[];
  verifiedAt: string;
}

export default function ComprehensiveComplianceHub() {
  const [activeTab, setActiveTab] = useState('audit');

  // Audit State
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);

  // Consents State
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);

  // Form C State
  const [formCRecords, setFormCRecords] = useState<FormCRecord[]>([]);
  const [loadingFormC, setLoadingFormC] = useState(false);

  // THOTA State
  const [transplants, setTransplants] = useState<TransplantRecord[]>([]);
  const [loadingTransplants, setLoadingTransplants] = useState(false);

  // Grievances State
  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [loadingGrievances, setLoadingGrievances] = useState(false);

  // FEMA State
  const [femaList, setFemaList] = useState<FemaItem[]>([]);
  const [loadingFema, setLoadingFema] = useState(false);

  // Fetch Consents
  const fetchConsents = useCallback(async () => {
    try {
      setLoadingConsents(true);
      const res = await fetch('/api/v1/admin/compliance/consents');
      const d = await res.json();
      if (d.success) setConsents(d.data.consents);
    } catch {
      toast.error('Failed to load consents');
    } finally {
      setLoadingConsents(false);
    }
  }, []);

  // Fetch Form C Records
  const fetchFormC = useCallback(async () => {
    try {
      setLoadingFormC(true);
      const res = await fetch('/api/v1/compliance/form-c');
      const d = await res.json();
      if (d.success) setFormCRecords(d.data.formCRecords);
    } catch {
      toast.error('Failed to load Form C records');
    } finally {
      setLoadingFormC(false);
    }
  }, []);

  // Fetch THOTA Transplants
  const fetchTransplants = useCallback(async () => {
    try {
      setLoadingTransplants(true);
      const res = await fetch('/api/v1/compliance/thota');
      const d = await res.json();
      if (d.success) setTransplants(d.data.transplantRecords);
    } catch {
      toast.error('Failed to load THOTA records');
    } finally {
      setLoadingTransplants(false);
    }
  }, []);

  // Fetch Grievances
  const fetchGrievances = useCallback(async () => {
    try {
      setLoadingGrievances(true);
      const res = await fetch('/api/v1/compliance/grievances');
      const d = await res.json();
      if (d.success) setGrievances(d.data.grievances);
    } catch {
      toast.error('Failed to load grievances');
    } finally {
      setLoadingGrievances(false);
    }
  }, []);

  // Fetch FEMA
  const fetchFema = useCallback(async () => {
    try {
      setLoadingFema(true);
      const res = await fetch('/api/v1/compliance/fema');
      const d = await res.json();
      if (d.success) setFemaList(d.data.remittances);
    } catch {
      toast.error('Failed to load FEMA remittances');
    } finally {
      setLoadingFema(false);
    }
  }, []);

  const [resolveGrievanceModal, setResolveGrievanceModal] = useState<{ open: boolean; id: string; notes: string }>({
    open: false,
    id: '',
    notes: '',
  });
  const [resolvingGrievance, setResolvingGrievance] = useState(false);
  const [formCModal, setFormCModal] = useState<{ open: boolean; id: string; appNo: string }>({
    open: false,
    id: '',
    appNo: '',
  });
  const [submittingFormC, setSubmittingFormC] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (activeTab === 'audit') {
        // ready
      } else if (activeTab === 'consents') {
        void fetchConsents();
      } else if (activeTab === 'form-c') {
        void fetchFormC();
      } else if (activeTab === 'thota') {
        void fetchTransplants();
      } else if (activeTab === 'grievances') {
        void fetchGrievances();
      } else if (activeTab === 'fema') {
        void fetchFema();
      }
    });
  }, [activeTab, fetchConsents, fetchFormC, fetchTransplants, fetchGrievances, fetchFema]);

  const handleVerifyChain = async () => {
    try {
      setVerifyingChain(true);
      const res = await fetch('/api/v1/admin/compliance/audit-verify', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.verification) {
        setVerificationReport(json.data.verification);
        if (json.data.verification.isValid) {
          toast.success(`Audit chain verified: ${json.data.verification.totalChecked} records intact.`);
        } else {
          toast.error(`ALERT: ${json.data.verification.tamperedCount} tampered records detected!`);
        }
      }
    } catch {
      toast.error('Error verifying audit chain');
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleAcknowledgeGrievance = async (id: string) => {
    try {
      const res = await fetch('/api/v1/compliance/grievances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actionType: 'ACKNOWLEDGE' }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success('Grievance statutory acknowledgement recorded within 48h SLA');
        fetchGrievances();
      }
    } catch {
      toast.error('Failed to acknowledge grievance');
    }
  };

  const handleResolveGrievance = (id: string) => {
    setResolveGrievanceModal({ open: true, id, notes: '' });
  };

  const submitResolveGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveGrievanceModal.notes.trim()) return;
    setResolvingGrievance(true);
    try {
      const res = await fetch('/api/v1/compliance/grievances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolveGrievanceModal.id,
          status: 'RESOLVED',
          resolutionNotes: resolveGrievanceModal.notes.trim(),
        }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success('Grievance marked RESOLVED under NABH SLA');
        setResolveGrievanceModal({ open: false, id: '', notes: '' });
        fetchGrievances();
      } else {
        toast.error(d.error?.message || 'Failed to resolve grievance');
      }
    } catch {
      toast.error('Failed to resolve grievance');
    } finally {
      setResolvingGrievance(false);
    }
  };

  const handleMarkFormCSubmitted = (id: string) => {
    setFormCModal({ open: true, id, appNo: '' });
  };

  const submitFormC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCModal.appNo.trim()) return;
    setSubmittingFormC(true);
    try {
      const res = await fetch('/api/v1/compliance/form-c', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formCModal.id,
          status: 'SUBMITTED_TO_BOI',
          formCApplicationNumber: formCModal.appNo.trim(),
        }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success('Form C statutory submission recorded successfully');
        setFormCModal({ open: false, id: '', appNo: '' });
        fetchFormC();
      } else {
        toast.error(d.error?.message || 'Failed to update Form C');
      }
    } catch {
      toast.error('Failed to update Form C');
    } finally {
      setSubmittingFormC(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Statutory Compliance Oversight"
        subtitle="Unified compliance management for NABH MVTF, e-FRRO Form 'C', THOTA Transplants, DPDP/HIPAA Cryptographic Chains, and FEMA Remittances"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Compliance & Legal' },
        ]}
      />

      {/* High-Level Statutory Metric Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Audit Security</span>
          <span className="text-sm font-extrabold text-primary-700 block mt-0.5">SHA-256 Chained</span>
        </div>
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Immigration BoI</span>
          <span className="text-sm font-extrabold text-success-700 block mt-0.5">Form &apos;C&apos; 24h SLA</span>
        </div>
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Clinical Ethics</span>
          <span className="text-sm font-extrabold text-primary-700 block mt-0.5">NMC Anti-Fee Split</span>
        </div>
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Organ Transplants</span>
          <span className="text-sm font-extrabold text-warning-700 block mt-0.5">THOTA Form 21</span>
        </div>
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Quality Standard</span>
          <span className="text-sm font-extrabold text-success-700 block mt-0.5">NABH MVTF 2nd Ed.</span>
        </div>
        <div className="p-3.5 bg-white border border-surface-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Tax & Forex</span>
          <span className="text-sm font-extrabold text-primary-700 block mt-0.5">FEMA & GST LUT</span>
        </div>
      </div>

      {/* Compliance Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'audit', label: 'Cryptographic Audit Trail', icon: <Lock className="w-4 h-4" /> },
          { id: 'consents', label: 'Signed Consent Ledger', icon: <FileCheck2 className="w-4 h-4" /> },
          { id: 'form-c', label: 'e-FRRO Form \'C\' Desk', icon: <Building2 className="w-4 h-4" /> },
          { id: 'thota', label: 'THOTA Transplant NOCs', icon: <Heart className="w-4 h-4" /> },
          { id: 'grievances', label: 'NABH Grievance Desk', icon: <Scale className="w-4 h-4" /> },
          { id: 'fema', label: 'FEMA & Remittance Vault', icon: <Receipt className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab 1: Cryptographic Audit Chain */}
      {activeTab === 'audit' && (
        <TabPanel>
          <div className="space-y-6">
            <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div>
                  <h3 className="text-base font-bold text-surface-900">Cryptographic Blockchain-Style Audit Trail</h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Merkle hash chain where every mutation depends on SHA-256 of previous block. Any database alteration breaks verification.
                  </p>
                </div>
                <Button onClick={handleVerifyChain} isLoading={verifyingChain} disabled={verifyingChain}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Validate Entire Audit Chain
                </Button>
              </div>

              {verificationReport ? (
                <div className={`p-5 rounded-2xl border-2 ${verificationReport.isValid ? 'bg-success-50/60 border-success-400' : 'bg-danger-50 border-danger-400'} space-y-3`}>
                  <div className="flex items-center gap-3">
                    {verificationReport.isValid ? (
                      <CheckCircle2 className="w-6 h-6 text-success-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-danger-600 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-surface-900">
                        {verificationReport.isValid ? '100% Cryptographic Integrity Confirmed' : 'Tampering Detected in Database Logs'}
                      </h4>
                      <p className="text-xs text-surface-600">
                        Validated {verificationReport.totalChecked} sequential log blocks against SHA-256 roots.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-semibold">
                    <div className="bg-white p-3 rounded-xl border border-surface-200">
                      <span className="text-[10px] text-surface-400 block uppercase">Total Evaluated</span>
                      <span className="text-base font-mono font-bold text-surface-900">{verificationReport.totalChecked}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-surface-200">
                      <span className="text-[10px] text-surface-400 block uppercase">Unbroken Blocks</span>
                      <span className="text-base font-mono font-bold text-success-700">{verificationReport.unbrokenCount}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-surface-200">
                      <span className="text-[10px] text-surface-400 block uppercase">Tampered Blocks</span>
                      <span className={`text-base font-mono font-bold ${verificationReport.tamperedCount > 0 ? 'text-danger-600' : 'text-surface-400'}`}>
                        {verificationReport.tamperedCount}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-surface-50 rounded-2xl border border-surface-200 text-surface-500 space-y-2">
                  <Lock className="w-8 h-8 mx-auto text-surface-400" />
                  <p className="text-xs font-semibold">Click &ldquo;Validate Entire Audit Chain&rdquo; to execute live SHA-256 verification across all database records.</p>
                </div>
              )}
            </Card>
          </div>
        </TabPanel>
      )}

      {/* Tab 2: Signed Consents */}
      {activeTab === 'consents' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
            <div className="pb-3 border-b border-surface-100">
              <h3 className="text-base font-bold text-surface-900">Signed Consent & Legal Proof Ledger</h3>
              <p className="text-xs text-surface-500">
                Immutably recorded e-signatures complying with IT Act § 10A, HIPAA, and DPDP Act 2023.
              </p>
            </div>

            {loadingConsents ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : consents.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400">No consents recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Verification Code</th>
                      <th className="pb-2.5 px-3">Type</th>
                      <th className="pb-2.5 px-3">Signer</th>
                      <th className="pb-2.5 px-3">Timestamp & IP</th>
                      <th className="pb-2.5 px-3">SHA-256 Digest</th>
                      <th className="pb-2.5 px-3 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {consents.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">
                          <Link href={`/verify/${c.verificationCode}`} target="_blank" className="hover:underline flex items-center gap-1">
                            {c.verificationCode} <ExternalLink className="w-3 h-3 text-primary-500" />
                          </Link>
                        </td>
                        <td className="py-3 px-3 uppercase font-bold text-surface-700 text-[10px]">{c.consentType.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 font-bold text-surface-900">{c.signerFullName}</td>
                        <td className="py-3 px-3 text-surface-600">{new Date(c.signedAt).toLocaleDateString()} ({c.ipAddress || '—'})</td>
                        <td className="py-3 px-3 font-mono text-[10px] text-surface-400 truncate max-w-xs">{c.documentHash.slice(0, 16)}...</td>
                        <td className="py-3 px-3 text-right">
                          <Link href={`/verify/${c.verificationCode}`} target="_blank">
                            <Button size="sm" variant="secondary" className="!text-xs">View Proof</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      {/* Tab 3: e-FRRO Form 'C' Desk */}
      {activeTab === 'form-c' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-100">
              <div>
                <h3 className="text-base font-bold text-surface-900">e-FRRO Form &apos;C&apos; Statutory Compliance Desk</h3>
                <p className="text-xs text-surface-500">
                  Mandatory submission to Bureau of Immigration (BoI) within <strong>24 hours</strong> of foreign national arrival.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-50 text-warning-800 text-xs font-bold border border-warning-200">
                <Clock className="w-3.5 h-3.5 text-warning-700" />
                <span>Statutory 24-Hour BoI SLA</span>
              </div>
            </div>

            {loadingFormC ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : formCRecords.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400">No Form C accommodation records pending.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Guest / Patient</th>
                      <th className="pb-2.5 px-3">Passport & Visa</th>
                      <th className="pb-2.5 px-3">Accommodation</th>
                      <th className="pb-2.5 px-3">Arrival Date</th>
                      <th className="pb-2.5 px-3">24h Deadline / Urgency</th>
                      <th className="pb-2.5 px-3">BoI Status</th>
                      <th className="pb-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {formCRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-bold text-surface-900">
                          {r.guestFullName}
                          <span className="block text-[10px] font-normal text-surface-500">{r.nationality}</span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {r.passportNumber}
                          <span className="block text-[10px] text-surface-400">Visa: {r.visaNumber}</span>
                        </td>
                        <td className="py-3 px-3 font-medium text-surface-800">{r.hostelName}</td>
                        <td className="py-3 px-3 text-surface-600">{new Date(r.arrivalDate).toLocaleDateString()}</td>
                        <td className="py-3 px-3">
                          {r.status === 'SUBMITTED_TO_BOI' || r.status === 'ACKNOWLEDGED' ? (
                            <span className="inline-flex items-center gap-1 text-success-700 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Filed in Time
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded ${
                              r.urgency === 'OVERDUE' ? 'bg-danger-100 text-danger-800' :
                              r.urgency === 'CRITICAL_URGENT' ? 'bg-warning-100 text-warning-900 animate-pulse' :
                              'bg-primary-50 text-primary-800'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {r.isOverdue ? 'OVERDUE' : `${r.remainingHours}h remaining`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={r.status} />
                          {r.formCApplicationNumber && (
                            <span className="block text-[10px] font-mono text-surface-500 mt-0.5">Ref: {r.formCApplicationNumber}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {r.status === 'PENDING_SUBMISSION' && (
                            <Button size="sm" onClick={() => handleMarkFormCSubmitted(r.id)} className="!text-xs">
                              Record BoI Ref No
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      {/* Tab 4: THOTA Organ Transplants */}
      {activeTab === 'thota' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
            <div className="pb-3 border-b border-surface-100">
              <h3 className="text-base font-bold text-surface-900">THOTA 1994 Statutory Organ Transplant Desk</h3>
              <p className="text-xs text-surface-500">
                Statutory compliance gatekeeper requiring <strong>Form 21 (Embassy Relationship Certificate)</strong> & Authorisation Committee NOC for foreign nationals.
              </p>
            </div>

            {loadingTransplants ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : transplants.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400">No active organ transplant cases.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Organ Type</th>
                      <th className="pb-2.5 px-3">Patient</th>
                      <th className="pb-2.5 px-3">Donor & Relationship</th>
                      <th className="pb-2.5 px-3">Embassy Form 21 NOC</th>
                      <th className="pb-2.5 px-3">Statutory Status</th>
                      <th className="pb-2.5 px-3">Authorisation Committee NOC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {transplants.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-bold text-primary-700">{t.organType}</td>
                        <td className="py-3 px-3 font-medium text-surface-900">{t.case?.patient?.user?.fullName || 'Patient'}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-800">{t.donorFullName}</span>
                          <span className="block text-[10px] text-surface-500 font-mono">Relation: {t.donorRelation} ({t.donorNationality})</span>
                        </td>
                        <td className="py-3 px-3">
                          {t.form21EmbassyNocUrl ? (
                            <span className="inline-flex items-center gap-1 text-success-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Embassy Form 21 Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-warning-700 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" /> Form 21 Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={t.approvalStatus} />
                        </td>
                        <td className="py-3 px-3 font-mono text-surface-700">
                          {t.committeeNocNumber || 'Awaiting Committee Hearing'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      {/* Tab 5: NABH Grievance Desk */}
      {activeTab === 'grievances' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-100">
              <div>
                <h3 className="text-base font-bold text-surface-900">NABH Quality Grievance Redressal Desk</h3>
                <p className="text-xs text-surface-500">
                  Statutory SLA: <strong>48 hours</strong> acknowledgement · <strong>7 days</strong> complete resolution.
                </p>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-800 font-bold border border-primary-200">
                  NABH 2nd Ed. MVT Standard
                </span>
              </div>
            </div>

            {loadingGrievances ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : grievances.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400">No active grievances filed.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">Ticket #</th>
                      <th className="pb-2.5 px-3">Category & Severity</th>
                      <th className="pb-2.5 px-3">Patient & Subject</th>
                      <th className="pb-2.5 px-3">NABH SLA Timeline</th>
                      <th className="pb-2.5 px-3">Status</th>
                      <th className="pb-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {grievances.map((g) => (
                      <tr key={g.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">{g.ticketNumber}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-800 uppercase text-[10px] block">{g.category.replace(/_/g, ' ')}</span>
                          <span className={`text-[10px] font-bold ${g.severity === 'CRITICAL' ? 'text-danger-600' : 'text-surface-500'}`}>{g.severity}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-900">{g.subject}</span>
                          <span className="block text-[10px] text-surface-500 truncate max-w-xs">{g.description}</span>
                        </td>
                        <td className="py-3 px-3">
                          {!g.acknowledgedAt ? (
                            <span className="text-warning-700 font-bold text-[11px] block">
                              Ack SLA: {g.ackRemainingHours > 0 ? `${g.ackRemainingHours}h left` : 'BREACHED'}
                            </span>
                          ) : (
                            <span className="text-success-700 font-bold text-[11px] block">
                              ✓ Acknowledged
                            </span>
                          )}
                          <span className="text-[10px] text-surface-400 font-mono">
                            Resolution SLA: {g.resRemainingHours > 0 ? `${g.resRemainingHours}h left` : 'BREACHED'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={g.status} />
                        </td>
                        <td className="py-3 px-3 text-right space-x-1">
                          {!g.acknowledgedAt && (
                            <Button size="sm" variant="secondary" onClick={() => handleAcknowledgeGrievance(g.id)} className="!text-xs">
                              Acknowledge
                            </Button>
                          )}
                          {g.status !== 'RESOLVED' && (
                            <Button size="sm" onClick={() => handleResolveGrievance(g.id)} className="!text-xs">
                              Resolve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      {/* Tab 6: FEMA & Remittances */}
      {activeTab === 'fema' && (
        <TabPanel>
          <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
            <div className="pb-3 border-b border-surface-100">
              <h3 className="text-base font-bold text-surface-900">FEMA & Inward Foreign Remittance Vault</h3>
              <p className="text-xs text-surface-500">
                Foreign Inward Remittance Certificates (FIRC) and SWIFT inward reference numbers for GST zero-rated Export of Services under LUT.
              </p>
            </div>

            {loadingFema ? (
              <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : femaList.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400">No foreign inward remittances recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                      <th className="pb-2.5 px-3">SWIFT / UTR Code</th>
                      <th className="pb-2.5 px-3">FIRC Certificate #</th>
                      <th className="pb-2.5 px-3">Remitting Bank & Country</th>
                      <th className="pb-2.5 px-3">Foreign Amount</th>
                      <th className="pb-2.5 px-3">INR Realized</th>
                      <th className="pb-2.5 px-3">GST LUT Export Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {femaList.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-50">
                        <td className="py-3 px-3 font-mono font-bold text-primary-700">{f.swiftReference}</td>
                        <td className="py-3 px-3 font-mono text-surface-800">{f.fircNumber || 'Pending Issuance'}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-surface-900">{f.remittingBank}</span>
                          <span className="block text-[10px] text-surface-500">{f.remittingCountry}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-surface-900">{f.foreignCurrency} {Number(f.foreignAmount).toLocaleString()}</td>
                        <td className="py-3 px-3 font-bold text-success-700">₹{Number(f.inrRealizedAmount).toLocaleString()}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-success-700 font-bold text-[10px] px-2 py-0.5 rounded bg-success-50 border border-success-200">
                            <CheckCircle2 className="w-3 h-3" /> Zero-Rated LUT
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>
      )}

      <Modal
        open={resolveGrievanceModal.open}
        onClose={() => setResolveGrievanceModal({ open: false, id: '', notes: '' })}
        title="Resolve Statutory Grievance"
        subtitle="Record resolution notes per NABH SLA requirements"
        maxWidth="md"
      >
        <form onSubmit={submitResolveGrievance} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-surface-700">
              Statutory Resolution Summary *
            </label>
            <textarea
              rows={4}
              required
              value={resolveGrievanceModal.notes}
              onChange={(e) =>
                setResolveGrievanceModal((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Enter resolution summary and corrective actions taken..."
              className="w-full p-2.5 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResolveGrievanceModal({ open: false, id: '', notes: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={resolvingGrievance}>
              Mark Resolved
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={formCModal.open}
        onClose={() => setFormCModal({ open: false, id: '', appNo: '' })}
        title="Record e-FRRO Form C Submission"
        subtitle="Enter the Bureau of Immigration reference number"
        maxWidth="md"
      >
        <form onSubmit={submitFormC} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-surface-700">
              BoI Form C Application Reference Number *
            </label>
            <input
              type="text"
              required
              value={formCModal.appNo}
              onChange={(e) => setFormCModal((prev) => ({ ...prev, appNo: e.target.value }))}
              placeholder="e.g. DL/BOI/2026/001234"
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormCModal({ open: false, id: '', appNo: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submittingFormC}>
              Confirm Submission
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
