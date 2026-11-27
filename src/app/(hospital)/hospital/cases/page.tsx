'use client';

/**
 * MediRoute India — Hospital Referral Inbox & Medical Opinion / Quotation Builder
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  PlusCircle,
  FileText,
  CheckCircle2,
  Send,
} from 'lucide-react';

interface CaseItem {
  id: string;
  status: string;
  createdAt: string;
  patient: {
    id: string;
    nationality: string;
    bloodGroup: string | null;
    medicalCondition: string | null;
    urgencyLevel: string;
    user: { fullName: string; email: string; phone: string | null };
    medicalProfile?: {
      diagnosisSummary?: string;
      allergies?: string[];
      currentMedications?: string[];
    } | null;
    documents?: {
      id: string;
      category: string;
      fileName: string;
      fileUrl: string;
      createdAt: string;
    }[];
  };
  hospitalQuotes: {
    id: string;
    title: string;
    estimatedCost: number;
    currency: string;
    estimatedStayDays: number;
    status: string;
    doctor?: { fullName: string; specialisation?: { name: string } };
  }[];
}

interface DoctorItem {
  id: string;
  fullName: string;
  specialisation?: { name: string };
}

export default function HospitalCasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quote Modal State
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedStayDays, setEstimatedStayDays] = useState('5');
  const [icuDays, setIcuDays] = useState('1');
  const [roomCategory, setRoomCategory] = useState('DELUXE_SINGLE');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [inclusionsText, setInclusionsText] = useState('');
  const [exclusionsText, setExclusionsText] = useState('');

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const [caseRes, docRes] = await Promise.all([
        fetch('/api/v1/hospital/cases'),
        fetch('/api/v1/hospital/doctors'),
      ]);

      const caseJson = await caseRes.json();
      const docJson = await docRes.json();

      if (caseJson.success && caseJson.data?.cases) {
        setCases(caseJson.data.cases);
      }
      if (docJson.success && docJson.data?.doctors) {
        setDoctors(docJson.data.doctors);
        if (docJson.data.doctors.length > 0) {
          setDoctorId((prev) => prev || docJson.data.doctors[0].id);
        }
      }
    } catch {
      toast.error('Failed to load referred cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchCases());
  }, [fetchCases]);

  const handleOpenQuoteModal = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setTitle(`Treatment Package — ${caseItem.patient.user.fullName}`);
    setDescription('');
    setEstimatedCost('');
    setInclusionsText('');
    setExclusionsText('');
  };

  const handleCloseQuoteModal = () => {
    setSelectedCase(null);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !title || !estimatedCost) {
      toast.error('Please fill required quotation fields');
      return;
    }

    try {
      setSubmittingQuote(true);
      const inclusions = inclusionsText.split(',').map((s) => s.trim()).filter(Boolean);
      const exclusions = exclusionsText.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await fetch('/api/v1/hospital/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCase.id,
          doctorId: doctorId || null,
          title,
          description,
          estimatedStayDays: parseInt(estimatedStayDays, 10),
          icuDays: parseInt(icuDays, 10),
          roomCategory,
          estimatedCost: parseFloat(estimatedCost),
          currency,
          inclusions,
          exclusions,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Official hospital medical opinion & quote submitted successfully!');
        handleCloseQuoteModal();
        fetchCases();
      } else {
        toast.error(json.error || 'Failed to submit quotation');
      }
    } catch {
      toast.error('Network error submitting quotation');
    } finally {
      setSubmittingQuote(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Referrals &amp; Medical Opinions"
        subtitle="Review patient referrals, inspect uploaded reports, and submit itemized treatment estimates"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Referrals & Opinions' },
        ]}
      />

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet className="w-6 h-6" />}
            title="No pending referrals"
            description="Patient cases referred to your hospital will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const hasQuote = c.hospitalQuotes.length > 0;
            return (
              <Card key={c.id} className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-surface-200">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base text-surface-900">{c.patient.user.fullName}</span>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                        {c.patient.nationality}
                      </span>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                        Urgency: {c.patient.urgencyLevel}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500">
                      Referred: {new Date(c.createdAt).toLocaleDateString()} · Ref: <span className="font-mono">{c.id}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasQuote ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-50 text-success-700 border border-success-200 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-success-600" /> Quote Submitted
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleOpenQuoteModal(c)}>
                        <PlusCircle className="w-4 h-4" /> Submit Opinion &amp; Quote
                      </Button>
                    )}
                  </div>
                </div>

                {/* Patient Clinical Presentation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1">
                    <span className="font-semibold text-surface-500 text-[11px] uppercase block">Condition / Complaint</span>
                    <p className="text-surface-800 font-medium">{c.patient.medicalCondition || 'Not specified'}</p>
                  </div>

                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1">
                    <span className="font-semibold text-surface-500 text-[11px] uppercase block">Allergies &amp; Medications</span>
                    <p className="text-surface-800 font-medium">
                      Allergies: {c.patient.medicalProfile?.allergies?.length ? c.patient.medicalProfile.allergies.join(', ') : 'None reported'} · Meds:{' '}
                      {c.patient.medicalProfile?.currentMedications?.length ? c.patient.medicalProfile.currentMedications.join(', ') : 'None reported'}
                    </p>
                  </div>

                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1">
                    <span className="font-semibold text-surface-500 text-[11px] uppercase block">Diagnostic Documents</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {c.patient.documents && c.patient.documents.length > 0 ? (
                        c.patient.documents.map((d) => (
                          <a
                            key={d.id}
                            href={d.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200 hover:bg-primary-100 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> {d.fileName}
                          </a>
                        ))
                      ) : (
                        <span className="text-surface-400">No documents attached</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submitted Quotes by this hospital for this case */}
                {c.hospitalQuotes.length > 0 && (
                  <div className="p-3.5 bg-surface-50 rounded-lg border border-surface-200 space-y-2 text-xs">
                    <span className="font-semibold text-surface-700 block">Submitted Quotations</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {c.hospitalQuotes.map((q) => (
                        <div key={q.id} className="p-3 bg-white rounded-lg border border-surface-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-surface-900 block truncate">{q.title}</span>
                            <span className="text-[11px] text-surface-500">
                              {q.doctor?.fullName ? `Dr. ${q.doctor.fullName} · ` : ''}{q.estimatedStayDays} days stay
                            </span>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <span className="font-mono font-semibold text-primary-800 text-sm block">{q.currency} {q.estimatedCost.toLocaleString()}</span>
                            <StatusBadge status={q.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Medical Opinion & Quotation Modal */}
      <Modal
        open={Boolean(selectedCase)}
        onClose={handleCloseQuoteModal}
        title="Submit Hospital Estimate"
        subtitle={
          selectedCase
            ? `${selectedCase.patient.user.fullName} (${selectedCase.patient.nationality})`
            : undefined
        }
        maxWidth="2xl"
      >
        {selectedCase && (
          <form onSubmit={handleSubmitQuote} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-surface-700 mb-1">Package Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-surface-700 mb-1">Attending Specialist</label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.fullName} ({d.specialisation?.name || 'Specialist'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-surface-700 mb-1">Total Stay (Days)</label>
                <input
                  type="number"
                  value={estimatedStayDays}
                  onChange={(e) => setEstimatedStayDays(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-surface-700 mb-1">ICU Days</label>
                <input
                  type="number"
                  value={icuDays}
                  onChange={(e) => setIcuDays(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-surface-700 mb-1">Room Category</label>
                <select
                  value={roomCategory}
                  onChange={(e) => setRoomCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
                >
                  <option value="DELUXE_SINGLE">Deluxe Single Room</option>
                  <option value="EXECUTIVE_SUITE">Executive Suite</option>
                  <option value="TWIN_SHARING">Twin Sharing Room</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-surface-700 mb-1">Estimated Cost</label>
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="Enter estimated total"
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono font-semibold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-surface-700 mb-1">Quotation Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-semibold"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Clinical Opinion &amp; Notes</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize recommended procedure, pre-op workup, and expected recovery timeline..."
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Inclusions (comma-separated)</label>
              <textarea
                rows={2}
                value={inclusionsText}
                onChange={(e) => setInclusionsText(e.target.value)}
                placeholder="Surgeon fees, theatre charges, ward stay, routine investigations..."
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Exclusions (comma-separated)</label>
              <textarea
                rows={2}
                value={exclusionsText}
                onChange={(e) => setExclusionsText(e.target.value)}
                placeholder="Specialized implants, blood products, extended ICU stay..."
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-surface-200 flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleCloseQuoteModal} size="sm">
                Cancel
              </Button>
              <Button type="submit" isLoading={submittingQuote} disabled={submittingQuote} size="sm">
                <Send className="w-3.5 h-3.5" /> Submit Quote
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
