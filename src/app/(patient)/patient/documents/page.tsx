'use client';

/**
 * Afzal Healthcare — Travel & Medical Document Vault
 * Flat institutional header, crisp 8px/6px document cards, keyboard-accessible dropzone,
 * and ConfirmDialog deletion guardrail.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import {
  matchesPatientDocumentCategoryFilter,
  canPatientDeleteDocument,
} from '@/lib/validation/document-vault-helpers';
import { VisaAndTravelConciergeCard } from '@/components/clinical/VisaAndTravelConciergeCard';
import type { TravelLogisticsPayload } from '@/lib/validation/lifecycle-schemas';
import {
  UploadCloud,
  FileText,
  Search,
  LayoutGrid,
  Table,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck,
  FolderLock,
  RefreshCw,
} from 'lucide-react';

interface DocumentItem {
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

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'TRAVEL_VERIFICATION', label: 'Visa & Travel' },
  { id: 'HOSPITAL_OFFICIAL', label: 'Hospital Letters' },
  { id: 'DIAGNOSTICS', label: 'Diagnostics & Scans' },
  { id: 'PRESCRIPTION', label: 'Prescriptions' },
  { id: 'INSURANCE', label: 'Insurance' },
];

const UPLOAD_CATEGORY_OPTIONS: SelectOption[] = [
  {
    value: 'PASSPORT',
    label: 'Passport Copy (Identity Page)',
    description: 'Valid for at least 6 months with 2 blank pages',
  },
  {
    value: 'VISA',
    label: 'Approved Medical Visa / e-Visa',
    description: 'Indian Medical Visa (M-Visa) copy',
  },
  {
    value: 'MEDICAL_REPORT',
    label: 'Medical Diagnostic Report / Scan',
    description: 'MRI, CT Scan, Angiography, ECG, or Lab Panel',
  },
  {
    value: 'PRESCRIPTION',
    label: 'Doctor Prescription',
    description: 'Current medication schedule',
  },
  {
    value: 'INSURANCE',
    label: 'Medical Travel Insurance Policy',
    description: 'International coverage certificate',
  },
  {
    value: 'FRRO_REGISTRATION',
    label: 'FRRO / Form C Registration',
    description: 'Bureau of Immigration arrival registration proof',
  },
];

const PRE_TRAVEL_DOCS = [
  { key: 'PASSPORT', label: 'Passport Copy', role: 'Patient upload', uploadable: true },
  {
    key: 'VISA_INVITATION_LETTER',
    label: 'Visa Invitation Letter (VIL)',
    role: 'Hospital issued',
    uploadable: false,
  },
  {
    key: 'PROFORMA_INVOICE',
    label: 'Treatment Cost Estimate',
    role: 'Hospital issued',
    uploadable: false,
  },
  {
    key: 'MEDICAL_REPORT',
    label: 'Diagnostic Reports',
    role: 'Patient upload',
    uploadable: true,
  },
  { key: 'VISA', label: 'Medical Visa / e-Visa', role: 'Patient upload', uploadable: true },
];

const DISCHARGE_RETURN_DOCS = [
  {
    key: 'DISCHARGE_SUMMARY',
    label: 'Hospital Discharge Summary',
    role: 'Hospital issued',
    uploadable: false,
  },
  {
    key: 'PRESCRIPTION',
    label: 'Discharge Prescription',
    role: 'Patient / Hospital',
    uploadable: true,
  },
  {
    key: 'FIT_TO_FLY_CERTIFICATE',
    label: 'Fit-to-Fly Certificate',
    role: 'Hospital issued',
    uploadable: false,
  },
  {
    key: 'FRRO_REGISTRATION',
    label: 'FRRO / Form C Registration',
    role: 'Coordinator / Patient',
    uploadable: true,
  },
];

const DISCHARGE_PHASE_STATUSES = new Set([
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED',
]);

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [passportExpiry, setPassportExpiry] = useState<string | null>(null);
  const [travelLogistics, setTravelLogistics] = useState<TravelLogisticsPayload | null>(null);
  const [checklistTab, setChecklistTab] = useState<'PRE_TRAVEL' | 'DISCHARGE_RETURN'>('PRE_TRAVEL');
  const hasAutoSelectedTabRef = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState('PASSPORT');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCardRef = useRef<HTMLDivElement>(null);
  const dropzoneBtnRef = useRef<HTMLButtonElement>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [docsRes, casesRes] = await Promise.all([
        fetch('/api/v1/patient/documents'),
        fetch('/api/v1/patient/cases'),
      ]);
      const data = await docsRes.json();
      if (docsRes.ok && data.success && data.data) {
        setDocuments(data.data.documents || []);
      } else {
        setLoadError(data?.error?.message || 'Unable to load your document vault.');
      }

      if (casesRes.ok) {
        const casesJson = await casesRes.json();
        const casesList = Array.isArray(casesJson?.data?.cases) ? casesJson.data.cases : [];
        const targetCase =
          casesList.find((c: { status: string }) => c.status !== 'CLOSED') || casesList[0];

        if (targetCase?.id) {
          setActiveCaseId(targetCase.id);
          if (!hasAutoSelectedTabRef.current) {
            hasAutoSelectedTabRef.current = true;
            if (DISCHARGE_PHASE_STATUSES.has(targetCase.status)) {
              setChecklistTab('DISCHARGE_RETURN');
            }
          }

          const lifecycleRes = await fetch(`/api/v1/cases/${targetCase.id}/lifecycle`);
          if (lifecycleRes.ok) {
            const lifecycleJson = await lifecycleRes.json();
            const snapshot = lifecycleJson?.data;
            if (snapshot) {
              setTravelLogistics(snapshot.travelLogistics ?? null);
              setPassportExpiry(snapshot.case?.patient?.passportExpiry ?? null);
            }
          } else if (targetCase.travelLogistics) {
            setTravelLogistics(targetCase.travelLogistics);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load documents list', err);
      setLoadError('Could not connect to the document vault. Please check your connection and retry.');
      toast.apiError(err, 'Failed to load documents vault', 'Fetch Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    if (window.location.hash === '#travel-concierge') {
      const timer = setTimeout(() => {
        document.getElementById('travel-concierge')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading]);

  const handleSelectChecklistCategory = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    uploadCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      dropzoneBtnRef.current?.focus();
    }, 250);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFileToUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      toast.error('Please select a file to upload.', 'Validation Error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('category', selectedCategory);

      const res = await fetch('/api/v1/patient/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          `'${fileToUpload.name}' uploaded. Your coordinator has been notified for verification.`,
          'Document Uploaded'
        );
        setFileToUpload(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        void fetchDocuments();
      } else {
        toast.apiError(data, 'Failed to upload document.', 'Upload Failed');
      }
    } catch (err) {
      toast.apiError(err, 'Network error uploading document.', 'Connection Error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/patient/documents?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`'${deleteTarget.name}' removed from your vault.`, 'Document Removed');
        setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.apiError(data, 'Failed to delete document.', 'Delete Failed');
      }
    } catch (err) {
      toast.apiError(err, 'Network error deleting document.', 'Connection Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeChecklistDocs = useMemo(
    () => (checklistTab === 'DISCHARGE_RETURN' ? DISCHARGE_RETURN_DOCS : PRE_TRAVEL_DOCS),
    [checklistTab]
  );

  const readinessMetrics = useMemo(() => {
    const verifiedOrIssued = documents.filter(
      (d) => d.verificationStatus === 'VERIFIED' || d.verificationStatus === 'ISSUED_BY_HOSPITAL'
    );
    const uploadedCategories = new Set(verifiedOrIssued.map((d) => d.category));

    let count = 0;
    activeChecklistDocs.forEach((req) => {
      if (uploadedCategories.has(req.key)) count++;
    });

    const percent = Math.round((count / activeChecklistDocs.length) * 100);
    return { count, total: activeChecklistDocs.length, percent, uploadedCategories };
  }, [documents, activeChecklistDocs]);

  const rejectedDocuments = useMemo(
    () => documents.filter((d) => d.verificationStatus === 'REJECTED'),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (!matchesPatientDocumentCategoryFilter(doc.category, activeCategoryFilter)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catLabel = (DOCUMENT_CATEGORY_LABELS[doc.category] || '').toLowerCase();
        return doc.fileName.toLowerCase().includes(q) || catLabel.includes(q);
      }

      return true;
    });
  }, [documents, activeCategoryFilter, searchQuery]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED_BY_HOSPITAL':
        return <Badge variant="info" dot>Hospital Official</Badge>;
      case 'VERIFIED':
        return <Badge variant="success" dot>Verified</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" dot>Re-upload Needed</Badge>;
      default:
        return <Badge variant="warning" dot>Under Review</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-16 rounded-lg bg-surface-200/70 animate-pulse" />
        <div className="h-36 rounded-lg bg-white border border-surface-200 animate-pulse" />
        <div className="h-64 rounded-lg bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* ─── Clean Flat Page Header with Compact Readiness Meter ────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div className="max-w-2xl">
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
            Travel &amp; Medical Document Vault
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Upload your passport, diagnostic scans, and prescriptions, and download official Visa Invitation Letters and Fit-to-Fly certificates.
          </p>
        </div>

        <div className="bg-white border border-surface-200 rounded-lg px-4 py-3 shadow-2xs shrink-0 sm:min-w-[220px]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-surface-600">Travel Clearance</span>
            <span className="font-semibold text-surface-900 tabular-nums">
              {readinessMetrics.count} of {readinessMetrics.total} ready
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-[width] duration-300"
              style={{ width: `${readinessMetrics.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Error Recovery Banner */}
      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Could not load your documents</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchDocuments()}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Rejected Document Action Banner */}
      {rejectedDocuments.length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-danger-200 bg-danger-50 text-danger-900 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">
                Action Required: Replace Rejected Document{rejectedDocuments.length > 1 ? 's' : ''}
              </h2>
              <p className="text-xs font-normal text-danger-800 mt-0.5">
                Your coordinator flagged {rejectedDocuments.length}{' '}
                {rejectedDocuments.length === 1 ? 'document' : 'documents'} for re-upload before clearance can proceed.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {rejectedDocuments.map((rej) => (
              <div
                key={rej.id}
                className="p-3 rounded-md bg-white border border-danger-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-surface-900">
                      {DOCUMENT_CATEGORY_LABELS[rej.category] || rej.category}
                    </span>
                    <span className="text-xs text-surface-500 truncate">{rej.fileName}</span>
                  </div>
                  <p className="text-xs font-normal text-danger-800 mt-0.5">
                    {rej.verificationNotes
                      ? rej.verificationNotes
                      : 'Please upload a clearer, uncropped scan for coordinator review.'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleSelectChecklistCategory(rej.category)}
                  className="self-start sm:self-auto shrink-0"
                >
                  Replace Document
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase-Adaptive Document Checklist */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-900">
              {checklistTab === 'PRE_TRAVEL'
                ? 'Pre-Travel & Medical Visa Checklist'
                : 'Hospital Discharge & Return Travel Pack'}
            </h2>
            <span className="text-xs text-surface-500">
              {checklistTab === 'PRE_TRAVEL'
                ? 'Required for Indian Medical Visa (M-Visa) & hospital admission'
                : 'Required for inpatient discharge, FRRO exit compliance, and return flight'}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Checklist phase view"
            className="inline-flex p-1 bg-surface-100 border border-surface-200 rounded-md self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={checklistTab === 'PRE_TRAVEL'}
              onClick={() => setChecklistTab('PRE_TRAVEL')}
              className={`min-h-11 px-3 rounded-md text-xs font-medium transition-colors ${
                checklistTab === 'PRE_TRAVEL'
                  ? 'bg-white text-surface-900 shadow-2xs'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              Pre-Travel &amp; Visa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={checklistTab === 'DISCHARGE_RETURN'}
              onClick={() => setChecklistTab('DISCHARGE_RETURN')}
              className={`min-h-11 px-3 rounded-md text-xs font-medium transition-colors ${
                checklistTab === 'DISCHARGE_RETURN'
                  ? 'bg-white text-surface-900 shadow-2xs'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              Discharge &amp; Return Pack
            </button>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            checklistTab === 'PRE_TRAVEL' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          } gap-3`}
        >
          {activeChecklistDocs.map((doc) => {
            const isVerified = readinessMetrics.uploadedCategories.has(doc.key);
            const canQuickSelect = !isVerified && doc.uploadable;

            if (canQuickSelect) {
              return (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => handleSelectChecklistCategory(doc.key)}
                  className="p-3.5 rounded-md border border-warning-200 bg-warning-50/40 hover:bg-warning-50/80 text-left flex flex-col justify-between space-y-2.5 transition-colors min-h-[96px]"
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className="text-[11px] text-surface-500">{doc.role}</span>
                    <AlertCircle className="w-3.5 h-3.5 text-warning-600 shrink-0" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-surface-900 leading-snug">
                      {DOCUMENT_CATEGORY_LABELS[doc.key] || doc.label}
                    </h3>
                    <p className="text-[11px] font-medium text-primary-700 mt-0.5">
                      Select to upload →
                    </p>
                  </div>
                </button>
              );
            }

            return (
              <div
                key={doc.key}
                className={`p-3.5 rounded-md border flex flex-col justify-between space-y-2.5 min-h-[96px] ${
                  isVerified
                    ? 'bg-surface-50 border-surface-200'
                    : 'bg-white border-surface-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] text-surface-500">{doc.role}</span>
                  {isVerified ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-surface-400 shrink-0" aria-hidden="true" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-medium text-surface-900 leading-snug">
                    {DOCUMENT_CATEGORY_LABELS[doc.key] || doc.label}
                  </h3>
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    {isVerified ? 'Verified' : 'Issued by hospital'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Visa, MED-X Attendant & Travel Concierge Vault */}
      <VisaAndTravelConciergeCard
        caseId={activeCaseId}
        passportExpiry={passportExpiry}
        travelLogistics={travelLogistics}
        role="PATIENT"
        onSaved={(snapshot) => {
          const updatedLogistics = snapshot.travelLogistics as TravelLogisticsPayload | undefined;
          const updatedCase = snapshot.case as { patient?: { passportExpiry?: string | null } } | undefined;
          if (updatedLogistics !== undefined) {
            setTravelLogistics(updatedLogistics);
          }
          if (updatedCase?.patient?.passportExpiry !== undefined) {
            setPassportExpiry(updatedCase.patient.passportExpiry);
          }
        }}
      />

      {/* Keyboard-Accessible Document Upload Card */}
      <div ref={uploadCardRef} id="document-upload-section">
        <Card className="p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-surface-900">Upload a Document</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Files are encrypted automatically and reviewed by your case coordinator.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-1">
                <Select
                  label="Document Type"
                  options={UPLOAD_CATEGORY_OPTIONS}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  helperText="Choose the matching category for faster verification."
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <span className="text-xs font-medium text-surface-700 block">Document File</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="sr-only"
                  tabIndex={-1}
                />

                {fileToUpload ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className="border border-primary-300 bg-primary-50/40 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-white border border-surface-200 text-primary-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-900 truncate">
                          {fileToUpload.name}
                        </p>
                        <p className="text-xs text-surface-500 tabular-nums">
                          {formatFileSize(fileToUpload.size)} • Ready to upload
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change File
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFileToUpload(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-danger-700 hover:bg-danger-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    ref={dropzoneBtnRef}
                    type="button"
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      w-full min-h-[124px] border border-dashed rounded-md p-5 text-center cursor-pointer
                      transition-colors flex flex-col items-center justify-center gap-2
                      ${
                        dragActive
                          ? 'border-primary-600 bg-primary-50/50'
                          : 'border-surface-300 hover:border-surface-400 bg-surface-50/50 hover:bg-surface-50'
                      }
                    `}
                  >
                    <div className="w-9 h-9 rounded-md bg-white text-surface-600 border border-surface-200 flex items-center justify-center">
                      <UploadCloud className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-surface-900 block">
                        Browse files or drag &amp; drop here
                      </span>
                      <span className="text-xs text-surface-500 mt-0.5 block">
                        PDF, PNG, or JPG up to 25 MB
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                isLoading={isUploading}
                disabled={isUploading || !fileToUpload}
              >
                <FileCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isUploading ? 'Uploading…' : 'Upload for Verification'}</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Vault Explorer & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter documents by category"
            className="edge-fade-scroller flex items-center gap-1.5"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                aria-pressed={activeCategoryFilter === cat.id}
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`min-h-11 px-3.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                  activeCategoryFilter === cat.id
                    ? 'bg-primary-50 text-primary-900 border-primary-300'
                    : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 sm:flex-initial">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search vault documents"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 min-h-11 pl-9 pr-3 bg-white border border-surface-300 rounded-md text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div
              role="group"
              aria-label="Document list layout"
              className="flex items-center bg-surface-100 p-0.5 rounded-md border border-surface-200 shrink-0"
            >
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`w-11 h-11 rounded flex items-center justify-center transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-surface-900 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Table view"
                aria-pressed={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`w-11 h-11 rounded flex items-center justify-center transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-surface-900 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                <Table className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Files Grid / Table */}
        {filteredDocuments.length === 0 ? (
          <Card className="p-10 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-md bg-surface-100 text-surface-500 border border-surface-200 flex items-center justify-center mx-auto">
              <FolderLock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-surface-900">No documents match this view</h3>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try clearing your search filter or switching categories.'
                : 'Upload your passport or diagnostic scans above to begin travel verification.'}
            </p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                hover
                className="p-4 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 bg-surface-100 rounded-md text-surface-600 border border-surface-200 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                    </div>
                    {renderStatusBadge(doc.verificationStatus)}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-surface-500">
                      {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <h3
                      className="text-sm font-medium text-surface-900 truncate mt-0.5"
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </h3>
                    <p className="text-xs text-surface-500 mt-0.5 tabular-nums">
                      {formatFileSize(doc.fileSize)} •{' '}
                      {new Date(doc.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {doc.verificationNotes && (
                    <div className="p-2.5 bg-surface-50 rounded-md border border-surface-200 text-xs text-surface-600">
                      <span className="font-medium text-surface-800">Note:</span>{' '}
                      {doc.verificationNotes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-surface-100 flex items-center justify-between gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </a>

                  {canPatientDeleteDocument(doc.verificationStatus) && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: doc.id, name: doc.fileName })}
                      className="inline-flex items-center justify-center w-11 h-11 text-surface-400 hover:text-danger-700 hover:bg-danger-50 rounded-md transition-colors"
                      aria-label={`Delete ${doc.fileName}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div
              tabIndex={0}
              role="region"
              aria-label="Uploaded documents table"
              className="overflow-x-auto"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Document Name
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Size
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Uploaded
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-surface-900">
                        <div className="flex items-center gap-2">
                          <FileText
                            className="w-4 h-4 text-surface-400 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate max-w-xs">{doc.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-surface-600">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </td>
                      <td className="px-4 py-3.5">{renderStatusBadge(doc.verificationStatus)}</td>
                      <td className="px-4 py-3.5 text-surface-500 tabular-nums">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="px-4 py-3.5 text-surface-500 tabular-nums">
                        {new Date(doc.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-11 h-11 text-surface-600 hover:text-primary-700 hover:bg-surface-100 rounded-md transition-colors"
                            aria-label={`Download ${doc.fileName}`}
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </a>
                          {canPatientDeleteDocument(doc.verificationStatus) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: doc.id, name: doc.fileName })}
                              className="inline-flex items-center justify-center w-11 h-11 text-surface-400 hover:text-danger-700 hover:bg-danger-50 rounded-md transition-colors"
                              aria-label={`Delete ${doc.fileName}`}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove document from vault?"
        message={
          deleteTarget
            ? `'${deleteTarget.name}' will be permanently removed from your document vault.`
            : ''
        }
        cancelLabel="Keep Document"
        confirmLabel="Remove Document"
        variant="danger"
        loading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
