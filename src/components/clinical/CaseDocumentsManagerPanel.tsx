'use client';

/**
 * Afzal Healthcare — Case Documents Verification & Official Certificate Issuance Panel
 * Reusable across Manager, Admin, and Doctor case workspaces.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import {
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FilePlus2,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
} from 'lucide-react';

export interface IssueCategoryOption {
  value: string;
  label: string;
}

export interface CaseDocumentsManagerPanelProps {
  caseId: string;
  canVerify?: boolean;
  issueCategories?: IssueCategoryOption[];
  onDocumentIssued?: () => void;
}

interface CaseDocumentItem {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ISSUED_BY_HOSPITAL' | string;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

const DEFAULT_ISSUE_CATEGORIES: IssueCategoryOption[] = [
  {
    value: 'VISA_INVITATION_LETTER',
    label: DOCUMENT_CATEGORY_LABELS.VISA_INVITATION_LETTER || 'Visa Invitation Letter (VIL)',
  },
  {
    value: 'PROFORMA_INVOICE',
    label: DOCUMENT_CATEGORY_LABELS.PROFORMA_INVOICE || 'Pro-Forma Cost Estimate',
  },
  {
    value: 'MEDICAL_OPINION',
    label: DOCUMENT_CATEGORY_LABELS.MEDICAL_OPINION || 'Hospital Medical Opinion',
  },
  {
    value: 'FRRO_REGISTRATION',
    label: DOCUMENT_CATEGORY_LABELS.FRRO_REGISTRATION || 'FRRO Registration',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaseDocumentsManagerPanel({
  caseId,
  canVerify = false,
  issueCategories,
  onDocumentIssued,
}: CaseDocumentsManagerPanelProps) {
  const [documents, setDocuments] = useState<CaseDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Verification actions
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Official document issuance form
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('VISA_INVITATION_LETTER');
  const [issueNotes, setIssueNotes] = useState('');
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedIssueCategories = useMemo(
    () =>
      issueCategories && issueCategories.length > 0
        ? issueCategories
        : DEFAULT_ISSUE_CATEGORIES,
    [issueCategories]
  );

  const effectiveCategory = useMemo(() => {
    if (resolvedIssueCategories.some((opt) => opt.value === selectedCategory)) {
      return selectedCategory;
    }
    return resolvedIssueCategories[0]?.value || 'VISA_INVITATION_LETTER';
  }, [resolvedIssueCategories, selectedCategory]);

  const fetchDocuments = useCallback(async (targetCaseId: string, isCancelled?: () => boolean) => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const res = await fetch(`/api/v1/cases/${targetCaseId}/documents`);
      const data = await res.json();
      if (isCancelled?.()) return;

      if (!res.ok || !data.success) {
        const message = data?.error?.message || 'Failed to load case documents';
        setLoadError(message);
        setDocuments([]);
        return;
      }

      setDocuments(data.data?.documents || []);
    } catch (err) {
      if (isCancelled?.()) return;
      console.error('Failed to fetch case documents:', err);
      setLoadError('Network error loading case documents');
    } finally {
      if (!isCancelled?.()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setRejectingDocId(null);
      setRejectReason('');
      void fetchDocuments(caseId, () => cancelled);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [caseId, fetchDocuments]);

  const handleVerify = async (
    docId: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    verificationNotes?: string
  ) => {
    const trimmedNotes = verificationNotes?.trim() || '';
    if (verificationStatus === 'REJECTED' && !trimmedNotes) {
      toast.error('Please enter a reason before rejecting this document.', 'Reason Required');
      return;
    }

    setVerifyingDocId(docId);
    try {
      const res = await fetch(`/api/v1/documents/${docId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus,
          verificationNotes: trimmedNotes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.apiError(data, 'Failed to update document verification status', 'Verification Failed');
        return;
      }

      const updatedDoc = data.data?.document as CaseDocumentItem | undefined;
      if (updatedDoc) {
        setDocuments((prev) => prev.map((d) => (d.id === docId ? updatedDoc : d)));
      } else {
        await fetchDocuments(caseId);
      }

      if (verificationStatus === 'REJECTED') {
        setRejectingDocId(null);
        setRejectReason('');
        toast.success('Document rejected with feedback for patient.', 'Document Rejected');
      } else {
        toast.success('Document approved and verified.', 'Document Verified');
      }
    } catch (err) {
      toast.apiError(err, 'Network error verifying document', 'Connection Error');
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsIssuing(true);
    try {
      const formData = new FormData();
      formData.append('category', effectiveCategory);
      if (issueNotes.trim()) {
        formData.append('notes', issueNotes.trim());
      }
      if (issueFile) {
        formData.append('file', issueFile);
      }

      const res = await fetch(`/api/v1/cases/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.apiError(data, 'Failed to issue official document', 'Issuance Failed');
        return;
      }

      toast.success(
        `${DOCUMENT_CATEGORY_LABELS[effectiveCategory] || effectiveCategory} issued successfully.`,
        'Document Issued'
      );
      setIssueNotes('');
      setIssueFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowIssueForm(false);
      await fetchDocuments(caseId);
      onDocumentIssued?.();
    } catch (err) {
      toast.apiError(err, 'Network error issuing official document', 'Connection Error');
    } finally {
      setIsIssuing(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED_BY_HOSPITAL':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <Building2 className="w-3 h-3 text-sky-600" /> Hospital Official
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Review
          </span>
        );
    }
  };

  return (
    <Card className="bg-white border border-surface-200/80 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-100">
        <div>
          <h3 className="font-bold text-surface-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" />
            Case Documents & Official Certificates
          </h3>
          <p className="text-xs text-surface-500 mt-0.5">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} linked to patient vault
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={showIssueForm ? 'secondary' : 'primary'}
          onClick={() => setShowIssueForm((prev) => !prev)}
          className="text-xs"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span>Issue Official Document</span>
          {showIssueForm ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {showIssueForm && (
        <form
          onSubmit={handleIssueSubmit}
          className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3 text-xs"
        >
          <Select
            label="Certificate / Document Category"
            value={effectiveCategory}
            onChange={(val) => setSelectedCategory(val)}
            options={resolvedIssueCategories}
            required
          />

          <div className="space-y-1">
            <label className="block font-semibold text-surface-700">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              placeholder="Add hospital details, visa reference, or clinical notes..."
              className="w-full p-2.5 rounded-lg border border-surface-200 bg-white text-surface-800 focus:border-primary-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-surface-700">
              Attachment (Optional PDF/JPG/PNG)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setIssueFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-surface-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-surface-200 file:text-xs file:font-semibold file:bg-white file:text-surface-700 hover:file:bg-surface-100"
              />
              {issueFile && (
                <button
                  type="button"
                  onClick={() => {
                    setIssueFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-surface-500 hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" /> Clear file
                </button>
              )}
            </div>
            <p className="text-[11px] text-surface-500 flex items-center gap-1">
              <Upload className="w-3 h-3 shrink-0" />
              Leave file blank to auto-generate official PDF certificate
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowIssueForm(false)}
              disabled={isIssuing}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isIssuing}>
              {isIssuing ? 'Issuing...' : 'Issue Document'}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-surface-500">
          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading case documents...</span>
        </div>
      ) : loadError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void fetchDocuments(caseId)}
          >
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-surface-50 border border-dashed border-surface-200 text-xs text-surface-500">
          No documents uploaded or issued for this case yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => {
            const isVerifyingThis = verifyingDocId === doc.id;
            const isRejectingThis = rejectingDocId === doc.id;
            const canModerate = canVerify && doc.verificationStatus !== 'ISSUED_BY_HOSPITAL';

            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-surface-200 bg-surface-50/40 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary-50 text-primary-700 border border-primary-200">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      {renderStatusBadge(doc.verificationStatus)}
                    </div>
                    <p className="text-xs font-bold text-surface-900 truncate" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <p className="text-[11px] text-surface-500">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary-700 bg-white border border-surface-200 hover:bg-primary-50 hover:border-primary-200 transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>

                {doc.verificationNotes && (
                  <div className="p-2 rounded-lg bg-white border border-surface-200/80 text-[11px] text-surface-600">
                    <span className="font-semibold text-surface-700">Note:</span>{' '}
                    {doc.verificationNotes}
                  </div>
                )}

                {canModerate && (
                  <div className="pt-2 border-t border-surface-200/70 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isVerifyingThis || doc.verificationStatus === 'VERIFIED'}
                        onClick={() => void handleVerify(doc.id, 'VERIFIED')}
                        className="text-xs !min-h-[30px] !px-2.5 !py-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isVerifyingThis}
                        onClick={() => {
                          if (isRejectingThis) {
                            setRejectingDocId(null);
                            setRejectReason('');
                          } else {
                            setRejectingDocId(doc.id);
                            setRejectReason('');
                          }
                        }}
                        className="text-xs !min-h-[30px] !px-2.5 !py-1 text-rose-700 border-rose-200 hover:bg-rose-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </Button>
                    </div>

                    {isRejectingThis && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Required rejection reason (e.g. blurry scan)..."
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-rose-300 bg-white text-surface-800 focus:outline-none focus:border-rose-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            isLoading={isVerifyingThis}
                            disabled={!rejectReason.trim() || isVerifyingThis}
                            onClick={() => void handleVerify(doc.id, 'REJECTED', rejectReason)}
                            className="text-xs !min-h-[30px] !px-2.5 !py-1"
                          >
                            Confirm Reject
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isVerifyingThis}
                            onClick={() => {
                              setRejectingDocId(null);
                              setRejectReason('');
                            }}
                            className="text-xs !min-h-[30px] !px-2 !py-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
