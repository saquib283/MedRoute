'use client';

/**
 * MediRoute India — Hospital Referral Inbox & Medical Opinion / Quotation Builder
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  PlusCircle,
  FileText,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Send,
  Download,
  Calendar,
  X,
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
  const [inclusionsText, setInclusionsText] = useState('Surgeon fees, Operating Theatre charges, 1 ICU day, 4 Ward days, Routine pre-op investigations, Post-op nursing');
  const [exclusionsText, setExclusionsText] = useState('Specialized non-standard implants, Blood transfusions, Unrelated specialist cross-consultations');

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
          setDoctorId(docJson.data.doctors[0].id);
        }
      }
    } catch {
      toast.error('Failed to load referred cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleOpenQuoteModal = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setTitle(`Surgical Management Package for ${caseItem.patient.user.fullName}`);
    setDescription(`Official clinical opinion and surgical management package prepared for ${caseItem.patient.user.fullName} (${caseItem.patient.nationality}).`);
    setEstimatedCost('5500');
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
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <PageHeader
        title="International Referral Inbox & Medical Opinions"
        subtitle="Review foreign clinical records, inspect diagnostic MRI/CT reports, and provide official itemized surgical treatment estimates"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Referrals & Opinions' },
        ]}
      />

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <div className="p-12 text-center bg-white border border-surface-200 rounded-2xl text-surface-400">
          No foreign patient referrals currently pending.
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const hasQuote = c.hospitalQuotes.length > 0;
            return (
              <Card key={c.id} className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-surface-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-base text-surface-900">{c.patient.user.fullName}</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary-50 text-primary-800 border border-primary-100">
                        {c.patient.nationality}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                        Urgency: {c.patient.urgencyLevel}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500">
                      Referred: {new Date(c.createdAt).toLocaleDateString()} · Case Ref: <span className="font-mono">{c.id}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasQuote ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success-50 text-success-800 border border-success-200 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-success-600" /> Quote Submitted
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleOpenQuoteModal(c)} className="!text-xs">
                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Provide Medical Opinion & Quote
                      </Button>
                    )}
                  </div>
                </div>

                {/* Patient Clinical Presentation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-surface-50 rounded-xl border border-surface-200/80 space-y-1">
                    <span className="font-bold text-surface-400 text-[10px] uppercase block">Condition / Chief Complaint</span>
                    <p className="text-surface-800 font-medium">{c.patient.medicalCondition || 'Cardiac bypass surgery evaluation'}</p>
                  </div>

                  <div className="p-3 bg-surface-50 rounded-xl border border-surface-200/80 space-y-1">
                    <span className="font-bold text-surface-400 text-[10px] uppercase block">Allergies & Current Medications</span>
                    <p className="text-surface-800 font-medium">
                      Allergies: {c.patient.medicalProfile?.allergies?.join(', ') || 'NKDA'} · Meds: {c.patient.medicalProfile?.currentMedications?.join(', ') || 'Ecosprin 75mg'}
                    </p>
                  </div>

                  <div className="p-3 bg-surface-50 rounded-xl border border-surface-200/80 space-y-1">
                    <span className="font-bold text-surface-400 text-[10px] uppercase block">Uploaded Diagnostic Scans</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {c.patient.documents && c.patient.documents.length > 0 ? (
                        c.patient.documents.map((d) => (
                          <a
                            key={d.id}
                            href={d.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200 hover:bg-primary-100 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> {d.fileName}
                          </a>
                        ))
                      ) : (
                        <span className="text-surface-400 italic">No direct scans uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submitted Quotes by this hospital for this case */}
                {c.hospitalQuotes.length > 0 && (
                  <div className="p-3.5 bg-primary-50/50 rounded-xl border border-primary-100 space-y-2 text-xs">
                    <span className="font-bold text-primary-900 block text-[11px]">Active Hospital Quotations:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {c.hospitalQuotes.map((q) => (
                        <div key={q.id} className="p-3 bg-white rounded-lg border border-primary-200/80 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-surface-900 block">{q.title}</span>
                            <span className="text-[11px] text-surface-500">Dr. {q.doctor?.fullName || 'Assigned Surgeon'} · {q.estimatedStayDays} Days Stay</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-primary-800 text-sm block">{q.currency} {q.estimatedCost.toLocaleString()}</span>
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

      {/* ─── Medical Opinion & Quotation Modal ───────────────────────── */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <div>
                <h3 className="text-base font-bold text-surface-900">Submit Official Hospital Surgical Quote</h3>
                <p className="text-xs text-surface-500">
                  Patient: {selectedCase.patient.user.fullName} ({selectedCase.patient.nationality})
                </p>
              </div>
              <button onClick={handleCloseQuoteModal} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuote} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-surface-700 mb-1">Package Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">Operating Surgeon</label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.fullName} ({d.specialisation?.name || 'Specialist'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-surface-700 mb-1">Total Stay (Days)</label>
                  <input
                    type="number"
                    value={estimatedStayDays}
                    onChange={(e) => setEstimatedStayDays(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">ICU Days</label>
                  <input
                    type="number"
                    value={icuDays}
                    onChange={(e) => setIcuDays(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">Room Category</label>
                  <select
                    value={roomCategory}
                    onChange={(e) => setRoomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                  >
                    <option value="DELUXE_SINGLE">Deluxe Single Room</option>
                    <option value="EXECUTIVE_SUITE">Executive Suite</option>
                    <option value="TWIN_SHARING">Twin Sharing Room</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-surface-700 mb-1">Estimated Cost</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="5500"
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono font-bold text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">Quotation Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-bold"
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
                <label className="block font-bold text-surface-700 mb-1">Package Inclusions (comma-separated)</label>
                <textarea
                  rows={2}
                  value={inclusionsText}
                  onChange={(e) => setInclusionsText(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Package Exclusions (comma-separated)</label>
                <textarea
                  rows={2}
                  value={exclusionsText}
                  onChange={(e) => setExclusionsText(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-surface-100 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={handleCloseQuoteModal} size="sm">
                  Cancel
                </Button>
                <Button type="submit" isLoading={submittingQuote} disabled={submittingQuote} size="sm">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Official Hospital Quote
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
