'use client';

/**
 * MediRoute India — Manager Case Files Pipeline Board
 * Drag-and-drop or tab-filtered interface for patient treatment steps.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

enum CaseStatus {
  INQUIRY_RECEIVED = 'INQUIRY_RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PLAN_CONFIRMED = 'PLAN_CONFIRMED',
  IN_TREATMENT = 'IN_TREATMENT',
  POST_TREATMENT = 'POST_TREATMENT',
  CLOSED = 'CLOSED',
}

interface Case {
  id: string;
  patientId: string;
  managerId: string | null;
  status: CaseStatus;
  notes: string | null;
  isUrgent: boolean;
  escalationNote: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  patient: {
    dob: string;
    nationality: string;
    user: {
      fullName: string;
      email: string;
    };
  };
}

export default function CasesPipeline() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaseStatus>(CaseStatus.INQUIRY_RECEIVED);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  // Form fields
  const [caseNotes, setCaseNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');
  const [targetStatus, setTargetStatus] = useState<CaseStatus>(CaseStatus.INQUIRY_RECEIVED);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch('/api/v1/manager/cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases);
        }
      } catch (err) {
        console.error('Failed to load cases:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

  const selectCaseForEdit = (c: Case) => {
    setEditingCase(c);
    setCaseNotes(c.notes || '');
    setIsUrgent(c.isUrgent);
    setEscalationNote(c.escalationNote || '');
    setTargetStatus(c.status);
  };

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/manager/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: editingCase.id,
          status: targetStatus,
          notes: caseNotes,
          isUrgent,
          escalationNote,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state
        setCases((prev) =>
          prev.map((c) => (c.id === editingCase.id ? { ...c, ...data.case } : c))
        );
        setEditingCase(null);
      }
    } catch (err) {
      console.error('Failed to update case file:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { label: string; value: CaseStatus }[] = [
    { label: 'Inquiry Received', value: CaseStatus.INQUIRY_RECEIVED },
    { label: 'Under Review', value: CaseStatus.UNDER_REVIEW },
    { label: 'Plan Confirmed', value: CaseStatus.PLAN_CONFIRMED },
    { label: 'In Treatment', value: CaseStatus.IN_TREATMENT },
    { label: 'Post Treatment', value: CaseStatus.POST_TREATMENT },
    { label: 'Closed', value: CaseStatus.CLOSED },
  ];

  const filteredCases = cases.filter((c) => c.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading cases pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[500px]">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Case Files Pipeline</h1>
        <p className="text-sm text-surface-500 mt-1">Review active inquiries, treatment status progress, and coordinate escalations.</p>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-surface-200 bg-white rounded-t-lg overflow-x-auto flex">
        {tabs.map((tab) => {
          const count = cases.filter((c) => c.status === tab.value).length;
          return (
            <button
              key={tab.value}
              className={`px-5 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.value
                  ? 'border-primary-600 text-primary-700 bg-primary-50/20'
                  : 'border-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-50'
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                activeTab === tab.value ? 'bg-primary-100 text-primary-800' : 'bg-surface-100 text-surface-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Cases List */}
        <div className="xl:col-span-2 space-y-4">
          {filteredCases.length === 0 ? (
            <Card className="bg-white p-12 text-center border border-surface-200/80">
              <p className="text-sm text-surface-400 font-medium">No patient cases are currently at this stage.</p>
            </Card>
          ) : (
            filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCaseForEdit(c)}
                className="cursor-pointer block"
              >
                <Card
                  className={`bg-white p-5 border transition-all ${
                    c.isUrgent ? 'border-l-4 border-l-red-500 border-surface-200' : 'border-surface-200/80'
                  } hover:shadow-sm`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-surface-900 text-base">{c.patient.user.fullName}</h3>
                        {c.isUrgent && (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Nationality: {c.patient.nationality} • DOB:{' '}
                        {new Date(c.patient.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-surface-400 font-medium">Last Action</p>
                      <p className="text-xs text-surface-600 mt-0.5 font-semibold">
                        {new Date(c.lastUpdatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {c.notes && (
                    <div className="mt-3.5 bg-surface-50 p-3 rounded border border-surface-200/20 text-xs text-surface-700 leading-relaxed font-medium">
                      {c.notes}
                    </div>
                  )}

                  {c.escalationNote && (
                    <div className="mt-2 bg-red-50/40 p-3 rounded border border-red-200/40 text-xs text-red-700 font-medium flex gap-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Escalation Tag Notes:</p>
                        <p className="mt-0.5">{c.escalationNote}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-surface-100 text-xs">
                    <span className="text-surface-400 font-mono">Case ID: {c.id}</span>
                    <Button size="sm" variant="ghost">
                      Manage Step & Notes
                    </Button>
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>

        {/* Case Actions Form panel */}
        <div className="xl:col-span-1">
          {editingCase ? (
            <Card className="bg-white border border-surface-200/80 p-6 space-y-6 sticky top-6 animate-slide-up">
              <div className="flex justify-between items-center pb-3 border-b border-surface-100">
                <h3 className="font-bold text-surface-900 text-base">Modify Case File</h3>
                <button
                  onClick={() => setEditingCase(null)}
                  className="text-surface-400 hover:text-surface-600 text-sm font-semibold"
                >
                  Clear Selection
                </button>
              </div>

              <form onSubmit={handleUpdateCase} className="space-y-4 text-xs">
                {/* Patient Name banner */}
                <div className="bg-surface-50 p-3 rounded border border-surface-200/40">
                  <p className="text-surface-400 font-medium">Patient</p>
                  <p className="text-sm font-bold text-surface-900 mt-0.5">{editingCase.patient.user.fullName}</p>
                </div>

                {/* Case Status Dropdown */}
                <Select
                  label="Pipeline Stage"
                  value={targetStatus}
                  onChange={(val) => setTargetStatus(val as CaseStatus)}
                  options={[
                    { value: CaseStatus.INQUIRY_RECEIVED, label: 'Inquiry Received' },
                    { value: CaseStatus.UNDER_REVIEW, label: 'Under Review' },
                    { value: CaseStatus.PLAN_CONFIRMED, label: 'Plan Confirmed' },
                    { value: CaseStatus.IN_TREATMENT, label: 'In Treatment' },
                    { value: CaseStatus.POST_TREATMENT, label: 'Post Treatment' },
                    { value: CaseStatus.CLOSED, label: 'Closed' }
                  ]}
                  required
                />

                {/* notes */}
                <div className="space-y-1">
                  <label htmlFor="notes" className="font-semibold text-surface-700">Case Assessment Notes</label>
                  <textarea
                    id="notes"
                    rows={4}
                    className="w-full p-2.5 rounded border border-surface-300 font-medium"
                    placeholder="Enter diagnostic review, partner response status, flight details, or notes..."
                    value={caseNotes}
                    onChange={(e) => setCaseNotes(e.target.value)}
                  />
                </div>

                {/* Urgent Checkbox */}
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="isUrgent"
                    className="w-4 h-4 accent-primary-600"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                  />
                  <label htmlFor="isUrgent" className="font-semibold text-surface-800 cursor-pointer">
                    Flag case file as URGENT
                  </label>
                </div>

                {/* Escalation Note */}
                <div className="space-y-1">
                  <label htmlFor="escalation" className="font-semibold text-surface-700 text-red-700">Escalation Tag Notes (Optional)</label>
                  <textarea
                    id="escalation"
                    rows={2}
                    className="w-full p-2.5 rounded border border-red-300 bg-red-50/20 font-medium text-red-800"
                    placeholder="Explain emergency conditions, critical treatment delays..."
                    value={escalationNote}
                    onChange={(e) => setEscalationNote(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Saving modifications...' : 'Save Case File'}
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card className="bg-surface-50/50 border border-dashed border-surface-300 text-center py-20 px-6 rounded-lg sticky top-6">
              <svg className="w-10 h-10 text-surface-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h3 className="text-sm font-semibold text-surface-700 mb-1">No Case Selected</h3>
              <p className="text-xs text-surface-400 max-w-xs mx-auto">
                Select a patient case file from the tabs pipeline list to edit notes, flag urgency levels, or route status updates.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
