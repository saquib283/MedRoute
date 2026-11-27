'use client';

/**
 * MediRoute India — Manager Case Files Pipeline Board
 * Drag-and-drop or tab-filtered interface for patient treatment steps.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Case Pipeline"
        subtitle="Manage patient stages, update clinical notes, and flag urgent cases"
      />

      {/* Tabs navigation */}
      <div className="border-b border-surface-200 bg-white rounded-t-xl overflow-x-auto flex">
        {tabs.map((tab) => {
          const count = cases.filter((c) => c.status === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.value
                  ? 'border-primary-600 text-primary-700 bg-primary-50/40'
                  : 'border-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-50'
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 text-[11px] rounded-full font-semibold ${
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
            <Card>
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                title="No cases in this stage"
                description="Cases moved into this pipeline stage will appear here."
                className="py-10"
              />
            </Card>
          ) : (
            filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCaseForEdit(c)}
                className="cursor-pointer block"
              >
                <Card hover className="p-5 space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900 text-base">{c.patient.user.fullName}</h3>
                        {c.isUrgent && (
                          <Badge variant="danger" size="sm">Urgent</Badge>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {c.patient.nationality} · DOB:{' '}
                        {new Date(c.patient.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-surface-500">Updated</p>
                      <p className="text-xs text-surface-700 mt-0.5 font-medium">
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
                    <div className="bg-surface-50 p-3 rounded-lg border border-surface-200 text-xs text-surface-700 leading-relaxed">
                      {c.notes}
                    </div>
                  )}

                  {c.escalationNote && (
                    <div className="bg-danger-50 p-3 rounded-lg border border-danger-200 text-xs text-danger-700 flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Escalation Note</p>
                        <p className="mt-0.5">{c.escalationNote}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-surface-200 text-xs">
                    <span className="text-surface-500 font-mono truncate">Case: {c.id}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/manager/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-700 font-semibold hover:underline px-2 py-1"
                      >
                        Open Workspace
                      </Link>
                      <Button size="sm" variant="ghost">
                        Quick Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>

        {/* Case Actions Form panel */}
        <div className="xl:col-span-1">
          {editingCase ? (
            <Card className="p-6 space-y-5 sticky top-20 animate-slide-up">
              <div className="flex justify-between items-center pb-3 border-b border-surface-200">
                <h2 className="font-semibold text-surface-900 text-base">Update Case</h2>
                <button
                  type="button"
                  onClick={() => setEditingCase(null)}
                  className="text-surface-500 hover:text-surface-700 text-xs font-semibold"
                >
                  Clear
                </button>
              </div>

              <form onSubmit={handleUpdateCase} className="space-y-4 text-xs">
                <div className="bg-surface-50 p-3 rounded-lg border border-surface-200">
                  <p className="text-surface-500 font-medium">Patient</p>
                  <p className="text-sm font-semibold text-surface-900 mt-0.5">{editingCase.patient.user.fullName}</p>
                </div>

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

                <div className="space-y-1.5">
                  <label htmlFor="notes" className="block font-semibold text-surface-700">Case Notes</label>
                  <textarea
                    id="notes"
                    rows={4}
                    className="w-full p-2.5 rounded-lg border border-surface-300 focus:border-primary-600"
                    placeholder="Diagnostic review, partner response, itinerary details..."
                    value={caseNotes}
                    onChange={(e) => setCaseNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="isUrgent"
                    className="w-4 h-4 accent-primary-600"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                  />
                  <label htmlFor="isUrgent" className="font-semibold text-surface-800 cursor-pointer">
                    Flag case as urgent
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="escalation" className="block font-semibold text-danger-700">Escalation Note (Optional)</label>
                  <textarea
                    id="escalation"
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-danger-200 bg-danger-50/40 text-danger-800 focus:border-danger-500"
                    placeholder="Reason for urgent attention..."
                    value={escalationNote}
                    onChange={(e) => setEscalationNote(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Case'}
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card className="bg-surface-50 border-dashed text-center py-12 px-6 sticky top-20">
              <FileText className="w-8 h-8 text-surface-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-surface-700 mb-1">No Case Selected</h3>
              <p className="text-xs text-surface-500 max-w-xs mx-auto">
                Select a case from the list to update its pipeline stage, notes, or escalation flag.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
