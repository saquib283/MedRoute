'use client';

/**
 * Afzal Healthcare — International Patient Document & Verification Hub
 * Complete pre-travel visa documentation, hospital-issued certificates (VIL, Pro-Forma), and verification status tracking.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plane,
  Building2,
  Clock,
  FileCheck,
  FolderLock,
  XCircle,
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
  { id: 'ALL', label: 'All Vault Documents' },
  { id: 'TRAVEL_VERIFICATION', label: 'Visa & Travel Verification' },
  { id: 'HOSPITAL_OFFICIAL', label: 'Hospital-Issued Certificates' },
  { id: 'DIAGNOSTICS', label: 'Medical Diagnostics & Imaging' },
  { id: 'PRESCRIPTION', label: 'Prescriptions' },
  { id: 'INSURANCE', label: 'Travel Insurance' },
];

const UPLOAD_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'PASSPORT', label: 'Passport Copy (Identity Proof)', description: 'Valid for at least 6 months with 2 blank pages' },
  { value: 'VISA', label: 'Approved Medical Visa / e-Visa', description: 'Indian Medical Visa (M-Visa) copy' },
  { value: 'MEDICAL_REPORT', label: 'Medical Diagnostic Report / Scan', description: 'MRI, CT Scan, Angiography, Lab Panel' },
  { value: 'PRESCRIPTION', label: 'Doctor Prescription', description: 'Current ongoing dosage schedule' },
  { value: 'INSURANCE', label: 'Medical Travel Insurance Policy', description: 'International emergency coverage' },
];

const REQUIRED_TRAVEL_DOCS = [
  { key: 'PASSPORT', label: 'International Passport Copy', role: 'Patient Upload' },
  { key: 'VISA_INVITATION_LETTER', label: 'Visa Invitation Letter (VIL)', role: 'Hospital Issued' },
  { key: 'PROFORMA_INVOICE', label: 'Pro-Forma Treatment Estimate', role: 'Hospital Issued' },
  { key: 'MEDICAL_REPORT', label: 'Pre-Op Medical Diagnostics', role: 'Patient Upload' },
  { key: 'VISA', label: 'Indian Medical Visa / e-Visa', role: 'Patient Upload' },
];

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload Form state
  const [selectedCategory, setSelectedCategory] = useState('PASSPORT');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filters & Views
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/v1/patient/documents');
      const data = await res.json();
      if (data.success && data.data) {
        setDocuments(data.data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents list', err);
      toast.apiError(err, 'Failed to load documents vault', 'Fetch Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
        toast.success(`'${fileToUpload.name}' uploaded successfully. Case manager notified for verification.`, 'Document Uploaded');
        setFileToUpload(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchDocuments();
      } else {
        toast.apiError(data, 'Failed to upload document.', 'Upload Failed');
      }
    } catch (err) {
      toast.apiError(err, 'Network error uploading document.', 'Connection Error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;

    try {
      const res = await fetch(`/api/v1/patient/documents?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`'${name}' deleted from vault.`, 'Document Deleted');
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } else {
        toast.apiError(data, 'Failed to delete document.', 'Delete Failed');
      }
    } catch (err) {
      toast.apiError(err, 'Network error deleting document.', 'Connection Error');
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

      // Search Query
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
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <Building2 className="w-3 h-3 text-sky-600" /> Hospital Official
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified & Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <XCircle className="w-3 h-3 text-rose-600" /> Re-upload Required
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Verification
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading document verification vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in">
      {/* ─── Hero / Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-primary-950 via-primary-900 to-primary-850 p-6 sm:p-8 rounded-3xl text-white shadow-md">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary-800/80 border border-primary-700/60 px-3 py-1 rounded-full text-[11px] font-semibold text-primary-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>HIPAA Compliant & Encrypted Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            International Travel & Document Verification Hub
          </h1>
          <p className="text-xs sm:text-sm text-primary-200 max-w-2xl leading-relaxed">
            Manage your pre-travel passports, medical reports, and download hospital-issued Visa Invitation Letters (VIL) & cost estimates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="p-4 bg-primary-800/70 border border-primary-700 rounded-2xl flex items-center gap-4">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" className="text-primary-900" fill="transparent" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-emerald-400 transition-all duration-500"
                  fill="transparent"
                  strokeDasharray={113.1}
                  strokeDashoffset={113.1 - (113.1 * readinessMetrics.percent) / 100}
                />
              </svg>
              <span className="absolute text-[11px] font-black text-white">{readinessMetrics.percent}%</span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-primary-300 tracking-wider">Travel Verification</p>
              <p className="text-sm font-extrabold text-white">
                {readinessMetrics.count} of {readinessMetrics.total} Verified
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mandatory International Travel Verification Grid ──────────── */}
      <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-extrabold text-surface-900 flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary-600" />
            Medical Visa & Pre-Travel Documentation Clearance
          </h2>
          <span className="text-xs font-semibold text-surface-500">
            Mandatory for Indian Medical Visa (M-Visa) Approval
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
          {REQUIRED_TRAVEL_DOCS.map((doc) => {
            const isVerified = readinessMetrics.uploadedCategories.has(doc.key);
            return (
              <div
                key={doc.key}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  isVerified ? 'bg-emerald-50/50 border-emerald-200' : 'bg-surface-50 border-surface-200/80 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-surface-500">{doc.role}</span>
                  {isVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-surface-900 leading-tight">
                    {DOCUMENT_CATEGORY_LABELS[doc.key] || doc.label}
                  </h4>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {isVerified ? 'Document Verified' : 'Action Required'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ─── Upload New Document Card ───────────────────────────────────── */}
      <Card className="p-6 rounded-2xl border border-surface-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-extrabold text-surface-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary-600" />
            Upload Verification Document
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Upload your international passport copy, medical diagnostic reports, or visa documents for coordinator review.
          </p>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-2">
              <label className="text-xs font-bold text-surface-700 block">Document Category</label>
              <Select
                options={UPLOAD_CATEGORY_OPTIONS}
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
              />
              <p className="text-[11px] text-surface-400 leading-normal">
                Select the exact category to ensure fast verification by your case manager.
              </p>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-surface-700 block">Select File or Drop Here</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3
                  ${
                    dragActive
                      ? 'border-primary-600 bg-primary-50/60 ring-4 ring-primary-100'
                      : fileToUpload
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-surface-300 hover:border-primary-500 bg-surface-50/50 hover:bg-white'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                />

                {fileToUpload ? (
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-200 shadow-xs max-w-md w-full">
                    <FileText className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-900 truncate">{fileToUpload.name}</p>
                      <p className="text-[11px] text-surface-500">{formatFileSize(fileToUpload.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToUpload(null);
                      }}
                      className="p-1 hover:bg-surface-100 text-surface-400 hover:text-surface-700 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-surface-900">
                        Click to browse or drag file here
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        Supports PDF, PNG, JPG (Max file size: 25 MB)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isUploading || !fileToUpload}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Encrypting & Uploading...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Submit for Verification</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* ─── Vault Explorer & Filters ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`
                  px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border
                  ${
                    activeCategoryFilter === cat.id
                      ? 'bg-primary-900 text-white border-primary-900 shadow-xs'
                      : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
                  }
                `}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search & View Mode Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
              <input
                type="text"
                placeholder="Search vault files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-surface-200 rounded-xl text-xs text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 w-48 sm:w-60"
              />
            </div>

            <div className="flex items-center bg-surface-100 p-1 rounded-xl border border-surface-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-primary-600 shadow-xs' : 'text-surface-500'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-primary-600 shadow-xs' : 'text-surface-500'}`}
              >
                <Table className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Files Grid / Table ──────────────────────────────────────── */}
        {filteredDocuments.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border border-surface-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <FolderLock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-surface-800">No documents found</h3>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              {searchQuery ? 'No documents match your search filter.' : 'Your document vault is currently empty.'}
            </p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                className="p-5 rounded-2xl border border-surface-200 hover:border-primary-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 bg-primary-50 rounded-xl text-primary-600 border border-primary-100 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    {renderStatusBadge(doc.verificationStatus)}
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
                      {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <h4 className="text-sm font-extrabold text-surface-900 truncate mt-0.5" title={doc.fileName}>
                      {doc.fileName}
                    </h4>
                    <p className="text-xs text-surface-500 mt-1">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {doc.verificationNotes && (
                    <div className="p-2.5 bg-surface-50 rounded-lg border border-surface-200/60 text-[11px] text-surface-600">
                      <strong>Verification Note:</strong> {doc.verificationNotes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>

                  {canPatientDeleteDocument(doc.verificationStatus) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id, doc.fileName)}
                      className="p-1.5 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border border-surface-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Document Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Verification Status</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Date Uploaded</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="p-4 font-bold text-surface-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary-600 shrink-0" />
                        <span className="truncate max-w-xs">{doc.fileName}</span>
                      </td>
                      <td className="p-4 text-surface-600">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </td>
                      <td className="p-4">{renderStatusBadge(doc.verificationStatus)}</td>
                      <td className="p-4 text-surface-500">{formatFileSize(doc.fileSize)}</td>
                      <td className="p-4 text-surface-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {canPatientDeleteDocument(doc.verificationStatus) && (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.fileName)}
                              className="p-1.5 text-surface-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
