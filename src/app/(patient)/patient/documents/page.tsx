'use client';

/**
 * Afzal Healthcare — Travel & Medical Document Vault
 * High-contrast travel readiness checklist, keyboard-accessible file uploader,
 * 44px touch controls, and ConfirmDialog deletion guardrail.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import {
  matchesPatientDocumentCategoryFilter,
  canPatientDeleteDocument,
} from '@/lib/validation/document-vault-helpers';
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
  Plane,
  Building2,
  Clock,
  FileCheck,
  FolderLock,
  XCircle,
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
];

const REQUIRED_TRAVEL_DOCS = [
  { key: 'PASSPORT', label: 'Passport Copy', role: 'Patient Upload', uploadable: true },
  {
    key: 'VISA_INVITATION_LETTER',
    label: 'Visa Invitation Letter (VIL)',
    role: 'Hospital Issued',
    uploadable: false,
  },
  {
    key: 'PROFORMA_INVOICE',
    label: 'Treatment Cost Estimate',
    role: 'Hospital Issued',
    uploadable: false,
  },
  {
    key: 'MEDICAL_REPORT',
    label: 'Diagnostic Reports',
    role: 'Patient Upload',
    uploadable: true,
  },
  { key: 'VISA', label: 'Medical Visa / e-Visa', role: 'Patient Upload', uploadable: true },
];

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Upload Form state
  const [selectedCategory, setSelectedCategory] = useState('PASSPORT');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Deletion confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters & Views
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
      const res = await fetch('/api/v1/patient/documents');
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setDocuments(data.data.documents || []);
      } else {
        setLoadError(data?.error?.message || 'Unable to load your document vault.');
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

  // Travel Readiness Calculation
  const readinessMetrics = useMemo(() => {
    const verifiedOrIssued = documents.filter(
      (d) => d.verificationStatus === 'VERIFIED' || d.verificationStatus === 'ISSUED_BY_HOSPITAL'
    );
    const uploadedCategories = new Set(verifiedOrIssued.map((d) => d.category));

    let count = 0;
    REQUIRED_TRAVEL_DOCS.forEach((req) => {
      if (uploadedCategories.has(req.key)) count++;
    });

    const percent = Math.round((count / REQUIRED_TRAVEL_DOCS.length) * 100);
    return { count, total: REQUIRED_TRAVEL_DOCS.length, percent, uploadedCategories };
  }, [documents]);

  // Filtered Documents
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
        return (
          <span className="inline-flex items-center gap-1 bg-info-50 text-info-800 border border-info-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
            <Building2 className="w-3 h-3 text-info-600" aria-hidden="true" />
            Hospital Official
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-success-50 text-success-800 border border-success-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3 text-success-600" aria-hidden="true" />
            Verified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-danger-50 text-danger-800 border border-danger-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
            <XCircle className="w-3 h-3 text-danger-600" aria-hidden="true" />
            Re-upload Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-warning-50 text-warning-800 border border-warning-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
            <Clock className="w-3 h-3 text-warning-600" aria-hidden="true" />
            Under Review
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 py-2">
        <div className="h-40 rounded-3xl bg-primary-900/90 animate-pulse" />
        <div className="h-44 rounded-3xl bg-white border border-surface-200 animate-pulse" />
        <div className="h-72 rounded-3xl bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ─── High-Contrast Hero Banner (Fixed to-primary-800 token) ─────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800 p-6 sm:p-8 rounded-3xl text-white shadow-md">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Travel &amp; Medical Document Vault
          </h1>
          <p className="text-xs sm:text-sm text-primary-100 leading-relaxed">
            Upload your passport, diagnostic scans, and prescriptions, and download official Visa Invitation Letters and Fit-to-Fly certificates issued by your hospital.
          </p>
        </div>

        <div className="flex items-center gap-4 p-4 bg-primary-900/80 border border-primary-700 rounded-2xl self-start md:self-auto shrink-0">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="currentColor"
                strokeWidth="4"
                className="text-primary-950"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="currentColor"
                strokeWidth="4"
                className="text-success-400 transition-all duration-500"
                fill="transparent"
                strokeDasharray={113.1}
                strokeDashoffset={113.1 - (113.1 * readinessMetrics.percent) / 100}
              />
            </svg>
            <span className="absolute text-[11px] font-extrabold text-white tabular-nums">
              {readinessMetrics.percent}%
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-200">Travel Clearance</p>
            <p className="text-sm font-bold text-white tabular-nums">
              {readinessMetrics.count} of {readinessMetrics.total} Ready
            </p>
          </div>
        </div>
      </div>

      {/* ─── Error Recovery Banner ──────────────────────────────────────── */}
      {loadError && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Could not load your documents</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void fetchDocuments()}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* ─── Pre-Travel Clearance Checklist ─────────────────────────────── */}
      <Card className="p-6 rounded-3xl border border-surface-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary-600" aria-hidden="true" />
            <span>Pre-Travel Document Checklist</span>
          </h2>
          <span className="text-xs font-medium text-surface-500">
            Required for Indian Medical Visa (M-Visa) &amp; hospital admission
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {REQUIRED_TRAVEL_DOCS.map((doc) => {
            const isVerified = readinessMetrics.uploadedCategories.has(doc.key);
            const canQuickSelect = !isVerified && doc.uploadable;

            if (canQuickSelect) {
              return (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => handleSelectChecklistCategory(doc.key)}
                  className="p-4 rounded-2xl border border-warning-200 bg-warning-50/50 hover:bg-warning-50 hover:border-warning-300 text-left flex flex-col justify-between space-y-3 transition-colors min-h-[108px]"
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className="text-[11px] font-semibold text-surface-600">{doc.role}</span>
                    <AlertCircle className="w-4 h-4 text-warning-600 shrink-0" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-surface-900 leading-snug">
                      {DOCUMENT_CATEGORY_LABELS[doc.key] || doc.label}
                    </h3>
                    <p className="text-xs font-semibold text-primary-700 mt-1">
                      Select to upload →
                    </p>
                  </div>
                </button>
              );
            }

            return (
              <div
                key={doc.key}
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 min-h-[108px] ${
                  isVerified
                    ? 'bg-success-50/60 border-success-200'
                    : 'bg-surface-50 border-surface-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold text-surface-600">{doc.role}</span>
                  {isVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="w-4 h-4 text-surface-400 shrink-0" aria-hidden="true" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-surface-900 leading-snug">
                    {DOCUMENT_CATEGORY_LABELS[doc.key] || doc.label}
                  </h3>
                  <p className="text-xs text-surface-600 mt-1">
                    {isVerified ? 'Verified & Ready' : 'Issued by hospital'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ─── Keyboard-Accessible Document Upload Card ───────────────────── */}
      <div ref={uploadCardRef} id="document-upload-section">
        <Card className="p-6 rounded-3xl border border-surface-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary-600" aria-hidden="true" />
              <span>Upload a Document</span>
            </h2>
            <p className="text-xs text-surface-600 mt-0.5">
              Files are encrypted automatically and reviewed by your case coordinator.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-2">
                <Select
                  label="Document Type"
                  options={UPLOAD_CATEGORY_OPTIONS}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  helperText="Choose the matching category so your coordinator can verify it quickly."
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <span className="text-xs font-bold text-surface-700 block">Document File</span>
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
                    className="border-2 border-success-500 bg-success-50/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white border border-success-200 text-success-700 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-surface-900 truncate">
                          {fileToUpload.name}
                        </p>
                        <p className="text-xs text-surface-600 tabular-nums">
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
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                      w-full min-h-[140px] border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer
                      transition-colors flex flex-col items-center justify-center gap-3
                      ${
                        dragActive
                          ? 'border-primary-600 bg-primary-50/70 ring-4 ring-primary-100'
                          : 'border-surface-300 hover:border-primary-500 bg-surface-50/60 hover:bg-white'
                      }
                    `}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-surface-900 block">
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
                size="md"
                isLoading={isUploading}
                disabled={isUploading || !fileToUpload}
              >
                <FileCheck className="w-4 h-4" aria-hidden="true" />
                <span>{isUploading ? 'Encrypting & Uploading…' : 'Upload for Verification'}</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* ─── Vault Explorer & Filters ───────────────────────────────────── */}
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
                className={`min-h-11 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                  activeCategoryFilter === cat.id
                    ? 'bg-primary-700 text-white border-primary-700 shadow-2xs'
                    : 'bg-white text-surface-700 hover:bg-surface-50 border-surface-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative flex-1 sm:flex-initial">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search vault documents"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-60 min-h-11 pl-10 pr-4 bg-white border border-surface-200 rounded-xl text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div
              role="group"
              aria-label="Document list layout"
              className="flex items-center bg-surface-100 p-1 rounded-xl border border-surface-200 shrink-0"
            >
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-primary-700 shadow-2xs'
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
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-primary-700 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                <Table className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Files Grid / Table ──────────────────────────────────────── */}
        {filteredDocuments.length === 0 ? (
          <Card className="p-12 text-center rounded-3xl border border-surface-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 text-surface-500 flex items-center justify-center mx-auto">
              <FolderLock className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-surface-900">No documents match this view</h3>
            <p className="text-xs text-surface-600 max-w-sm mx-auto">
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
                className="p-5 rounded-3xl border border-surface-200 hover:border-primary-300 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 bg-primary-50 rounded-2xl text-primary-700 border border-primary-200 shrink-0">
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </div>
                    {renderStatusBadge(doc.verificationStatus)}
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-surface-500">
                      {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <h3
                      className="text-sm font-bold text-surface-900 truncate mt-0.5"
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </h3>
                    <p className="text-xs text-surface-500 mt-1 tabular-nums">
                      {formatFileSize(doc.fileSize)} •{' '}
                      {new Date(doc.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {doc.verificationNotes && (
                    <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs text-surface-700">
                      <strong className="text-surface-900">Coordinator Note:</strong>{' '}
                      {doc.verificationNotes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-surface-100 flex items-center justify-between gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-800 border border-primary-200 text-xs font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Download</span>
                  </a>

                  {canPatientDeleteDocument(doc.verificationStatus) && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: doc.id, name: doc.fileName })}
                      className="inline-flex items-center justify-center w-11 h-11 text-surface-500 hover:text-danger-700 hover:bg-danger-50 rounded-xl transition-colors"
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
          <Card className="p-0 rounded-3xl border border-surface-200 overflow-hidden shadow-xs">
            <div
              tabIndex={0}
              role="region"
              aria-label="Uploaded documents table"
              className="overflow-x-auto"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="p-4">
                      Document Name
                    </th>
                    <th scope="col" className="p-4">
                      Category
                    </th>
                    <th scope="col" className="p-4">
                      Status
                    </th>
                    <th scope="col" className="p-4">
                      Size
                    </th>
                    <th scope="col" className="p-4">
                      Uploaded
                    </th>
                    <th scope="col" className="p-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="p-4 font-bold text-surface-900">
                        <div className="flex items-center gap-2">
                          <FileText
                            className="w-4 h-4 text-primary-600 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate max-w-xs">{doc.fileName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-surface-700">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </td>
                      <td className="p-4">{renderStatusBadge(doc.verificationStatus)}</td>
                      <td className="p-4 text-surface-600 tabular-nums">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="p-4 text-surface-600 tabular-nums">
                        {new Date(doc.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-11 h-11 text-primary-700 hover:bg-primary-50 rounded-xl transition-colors"
                            aria-label={`Download ${doc.fileName}`}
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </a>
                          {canPatientDeleteDocument(doc.verificationStatus) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: doc.id, name: doc.fileName })}
                              className="inline-flex items-center justify-center w-11 h-11 text-surface-500 hover:text-danger-700 hover:bg-danger-50 rounded-xl transition-colors"
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

      {/* ─── Document Deletion Confirmation Dialog ──────────────────────── */}
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
