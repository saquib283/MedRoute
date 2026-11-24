'use client';

/**
 * Afzal Healthcare — Manager Case Files Pipeline Board
 * Drag-and-drop or tab-filtered interface for patient treatment steps.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { CaseStatusBadge } from '@/components/ui/Badge';
import { CaseDocumentsManagerPanel } from '@/components/clinical/CaseDocumentsManagerPanel';
import { CASE_STATUS_ORDER, CASE_STATUS_LABELS, CASE_PHASE_GROUPS } from '@/lib/constants';

interface Case {
  id: string;
  patientId: string;
  managerId: string | null;
  status: string;
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
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  // Form fields
  const [caseNotes, setCaseNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');
  const [targetStatus, setTargetStatus] = useState<string>('INQUIRY_RECEIVED');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setErrorMsg(null);
  };

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    setSubmitting(true);
    setErrorMsg(null);

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

      const data = await res.json();
      if (res.ok) {
        // Update local state
        setCases((prev) =>
          prev.map((c) => (c.id === editingCase.id ? { ...c, ...data.case } : c))
        );
        setEditingCase(null);
      } else {
        setErrorMsg(data.error || 'Failed to update case file');
      }
    } catch (err) {
      console.error('Failed to update case file:', err);
      setErrorMsg('Failed to update case file');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { key: string; label: string; statuses: readonly string[] | null }[] = [
    { key: 'ALL', label: 'All Cases', statuses: null },
    ...CASE_PHASE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      statuses: g.statuses,
    })),
  ];

  const activePhase = CASE_PHASE_GROUPS.find((g) => g.key === activeTab);
  const filteredCases = activePhase
    ? cases.filter((c) => (activePhase.statuses as readonly string[]).includes(c.status))
    : cases;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-surface-500">Loading cases pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Case Files Pipeline</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Review active inquiries, treatment status progress, and coordinate escalations.
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-surface-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const count = tab.statuses
            ? cases.filter((c) => tab.statuses!.includes(c.status)).length
            : cases.length;
          return (
            <button
              key={tab.key}
              type="button"
              className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-surface-500 hover:text-surface-800'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 text-[11px] rounded font-medium tabular-nums ${
                  activeTab === tab.key
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'bg-surface-100 text-surface-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Cases List */}
        <div className="xl:col-span-2 space-y-3.5">
          {filteredCases.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-xs text-surface-500 font-medium">No patient cases are currently at this stage.</p>
            </Card>
          ) : (
            filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCaseForEdit(c)}
                className="cursor-pointer block"
              >
                <Card
                  className={`p-5 transition-colors ${
                    c.isUrgent
                      ? 'border-red-300 bg-red-50/20'
                      : editingCase?.id === c.id
                      ? 'border-primary-400'
                      : 'hover:border-surface-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h2 className="font-semibold text-surface-900 text-sm sm:text-base">{c.patient.user.fullName}</h2>
                        <CaseStatusBadge status={c.status} />
                        {c.isUrgent && (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[11px] px-2 py-0.5 rounded font-medium">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-1">
                        Nationality: {c.patient.nationality} • DOB:{' '}
                        {new Date(c.patient.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-surface-500 font-medium">Last Action</p>
                      <p className="text-xs text-surface-700 mt-0.5 font-medium tabular-nums">
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
                    <div className="mt-3 bg-surface-50 p-3 rounded-md border border-surface-200 text-xs text-surface-700 leading-relaxed">
                      {c.notes}
                    </div>
                  )}

                  {c.escalationNote && (
                    <div className="mt-2 bg-red-50/50 p-3 rounded-md border border-red-200 text-xs text-red-700 flex gap-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Escalation Tag Notes</p>
                        <p className="mt-0.5">{c.escalationNote}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-surface-200 text-xs gap-2 flex-wrap">
                    <span className="text-surface-500 font-mono text-[11px]">Case ID: {c.id}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/manager/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center min-h-11 px-3.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 border border-primary-700/20 shadow-2xs transition-colors"
                      >
                        Open Case Workspace
                      </Link>
                      <Link
                        href={`/manager/cases/${c.id}/pathway`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center min-h-11 px-3 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors"
                      >
                        Configure Pathway
                      </Link>
                      <Button size="sm" variant="ghost">
                        Manage Step &amp; Notes
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>

        {/* Case Actions Form panel */}
        <div className="xl:col-span-1 space-y-5">
          {editingCase ? (
            <>
              <Card className="p-5 space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-surface-200">
                  <h2 className="font-semibold text-surface-900 text-sm sm:text-base">Modify Case File</h2>
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="text-surface-500 hover:text-surface-800 text-xs font-medium"
                  >
                    Clear Selection
                  </button>
                </div>

                <form onSubmit={handleUpdateCase} className="space-y-4 text-xs">
                  {/* Patient Name banner */}
                  <div className="bg-surface-50 p-3 rounded-md border border-surface-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-surface-500 font-medium">Patient</p>
                      <p className="text-sm font-semibold text-surface-900 mt-0.5 truncate">
                        {editingCase.patient.user.fullName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Link
                        href={`/manager/cases/${editingCase.id}`}
                        className="inline-flex items-center justify-center min-h-11 px-3 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 border border-primary-700/20 shadow-2xs transition-colors shrink-0"
                      >
                        Open Case Workspace
                      </Link>
                      <Link
                        href={`/manager/cases/${editingCase.id}/pathway`}
                        className="inline-flex items-center justify-center min-h-11 px-3 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors shrink-0"
                      >
                        Configure Pathway
                      </Link>
                    </div>
                  </div>

                  {/* Case Status Dropdown */}
                  <Select
                    label="Pipeline Stage"
                    value={targetStatus}
                    onChange={(val) => setTargetStatus(val)}
                    options={CASE_STATUS_ORDER.map((s) => ({
                      value: s,
                      label: CASE_STATUS_LABELS[s] || s,
                    }))}
                    required
                  />

                  {/* notes */}
                  <div className="space-y-1">
                    <label htmlFor="notes" className="font-medium text-surface-700 block">
                      Case Assessment Notes
                    </label>
                    <textarea
                      id="notes"
                      rows={4}
                      className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-surface-900 focus:border-primary-600 focus:outline-none"
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
                      className="w-4 h-4 rounded accent-primary-600"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                    />
                    <label htmlFor="isUrgent" className="font-medium text-surface-800 cursor-pointer">
                      Flag case file as urgent
                    </label>
                  </div>

                  {/* Escalation Note */}
                  <div className="space-y-1">
                    <label htmlFor="escalation" className="font-medium text-red-700 block">
                      Escalation Tag Notes (Optional)
                    </label>
                    <textarea
                      id="escalation"
                      rows={2}
                      className="w-full p-2.5 rounded-md border border-red-200 bg-red-50/40 text-red-800 focus:border-red-400 focus:outline-none"
                      placeholder="Explain emergency conditions, critical treatment delays..."
                      value={escalationNote}
                      onChange={(e) => setEscalationNote(e.target.value)}
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      {errorMsg}
                    </div>
                  )}

                  <div className="pt-1">
                    <Button className="w-full" type="submit" disabled={submitting}>
                      {submitting ? 'Saving modifications...' : 'Save Case File'}
                    </Button>
                  </div>
                </form>
              </Card>

              <CaseDocumentsManagerPanel key={editingCase.id} caseId={editingCase.id} canVerify />
            </>
          ) : (
            <Card className="bg-surface-50 border border-dashed border-surface-300 text-center py-16 px-6 shadow-none sticky top-6">
              <svg className="w-9 h-9 text-surface-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h2 className="text-sm font-semibold text-surface-700 mb-1">No Case Selected</h2>
              <p className="text-xs text-surface-500 max-w-xs mx-auto">
                Select a patient case file from the tabs pipeline list to edit notes, flag urgency levels, or route status updates.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
