'use client';

/**
 * MediRoute India — Patient Document Vault Page
 * HIPAA-compliant document management with category filtering, drag-and-drop dropzone, and Lucide icons.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, SelectOption } from '@/components/ui/Select';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import {
  UploadCloud,
  FileText,
  Lock,
  Search,
  LayoutGrid,
  Table,
  Download,
  Trash2,
  FolderLock,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

interface DocumentItem {
  id: string;
  category: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  uploadedAt: string;
}

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'PASSPORT', label: 'Passports & Visas' },
  { id: 'MEDICAL_REPORT', label: 'Medical Reports' },
  { id: 'PRESCRIPTION', label: 'Prescriptions' },
  { id: 'INSURANCE', label: 'Insurance Cards' },
  { id: 'VISA', label: 'Travel Visas' },
];

const CATEGORY_SELECT_OPTIONS: SelectOption[] = [
  { value: 'PASSPORT', label: 'Passport & Identity', description: 'National passport or ID copy' },
  { value: 'MEDICAL_REPORT', label: 'Medical Report / Imaging', description: 'ECG, MRI, CT Scan, or Lab Results' },
  { value: 'PRESCRIPTION', label: 'Doctor Prescription', description: 'Current dosage schedule' },
  { value: 'INSURANCE', label: 'Insurance Policy', description: 'International coverage letter' },
  { value: 'VISA', label: 'Travel Visa Document', description: 'Indian Medical Visa / e-Visa' },
];

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Upload Form state
  const [selectedCategory, setSelectedCategory] = useState('MEDICAL_REPORT');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filters & Views
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [dragActive, setDragActive] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/patient/documents');
      const data = await res.json();
      if (data.success && data.data) {
        setDocuments(data.data.documents || []);
        setActiveCaseId(data.data.activeCaseId || null);
      }
    } catch (err) {
      console.error('Failed to load documents list', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchDocuments();
    });
  }, [fetchDocuments]);

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
    setSuccessMsg('');
    setErrorMsg('');

    if (!fileToUpload) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    if (!activeCaseId) {
      setErrorMsg('No active care case found. Please contact your coordinator first.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('category', selectedCategory);
      formData.append('caseId', activeCaseId);

      const res = await fetch('/api/v1/patient/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`"${fileToUpload.name}" uploaded to secure vault successfully.`);
        setFileToUpload(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchDocuments();
      } else {
        setErrorMsg(data.error?.message || 'Failed to upload document.');
      }
    } catch {
      setErrorMsg('Network error uploading file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/patient/documents?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Document "${deleteTarget.name}" deleted.`);
        setDeleteTarget(null);
        fetchDocuments();
      } else {
        setErrorMsg(data.error?.message || 'Failed to delete file.');
      }
    } catch {
      setErrorMsg('Network error deleting document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesCategory =
        activeCategoryFilter === 'ALL' || doc.category === activeCategoryFilter;
      const matchesSearch =
        doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [documents, activeCategoryFilter, searchQuery]);

  const totalBytes = useMemo(() => {
    return documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
  }, [documents]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading your encrypted document vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Patient Document Vault</h1>
            <Badge variant="primary" dot>
              HIPAA Protected
            </Badge>
          </div>
          <p className="text-xs text-surface-500">
            Upload passports, clinical reports, and prescriptions for your India care team.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-success-50 border border-success-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-success-800 self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-success-600 shrink-0" />
          <span>HIPAA § 164.312 Encrypted Vault</span>
        </div>
      </div>

      {/* Analytics Meter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
            {documents.length}
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total Uploads</p>
            <p className="text-base font-bold text-surface-900 mt-0.5">Encrypted Documents</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-info-50 text-info-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
            {documents.filter((d) => d.category === 'MEDICAL_REPORT').length}
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Clinical Reports</p>
            <p className="text-base font-bold text-surface-900 mt-0.5">Lab & Imaging Files</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
            {documents.filter((d) => d.category === 'PASSPORT' || d.category === 'VISA').length}
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Passports & Visas</p>
            <p className="text-base font-bold text-surface-900 mt-0.5">Identity Documents</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-warning-50 text-warning-600 flex items-center justify-center shrink-0 shadow-xs">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Storage Usage</p>
            <p className="text-base font-bold text-surface-900 mt-0.5">{formatFileSize(totalBytes)} / 500 MB</p>
            <div className="w-full bg-surface-100 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-primary-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (totalBytes / (500 * 1024 * 1024)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form Card */}
        <Card className="lg:col-span-1 p-6 rounded-2xl shadow-xs border border-surface-200 space-y-5 self-start">
          <div className="border-b border-surface-100 pb-3">
            <h2 className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-primary-600" /> Upload Document to Vault
            </h2>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            {successMsg && (
              <div className="bg-success-50 border border-success-200 text-success-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-slide-down">
                <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Select
              label="Document Category"
              options={CATEGORY_SELECT_OPTIONS}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Select category..."
              required
            />

            {/* Drag & Drop Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2
                ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                    : fileToUpload
                    ? 'border-success-400 bg-success-50/30'
                    : 'border-surface-300 hover:border-primary-400 hover:bg-surface-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
              />

              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-1">
                <UploadCloud className="w-5 h-5" />
              </div>

              {fileToUpload ? (
                <div>
                  <p className="text-xs font-bold text-surface-900 truncate max-w-[200px]">
                    {fileToUpload.name}
                  </p>
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    {formatFileSize(fileToUpload.size)} • Click to replace
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-surface-800">
                    Click to browse or drag & drop file
                  </p>
                  <p className="text-[10px] text-surface-400">
                    Supports PDF, PNG, JPG (Max 25 MB)
                  </p>
                </>
              )}
            </div>

            <Button
              type="submit"
              fullWidth
              isLoading={isUploading}
              disabled={!fileToUpload || isUploading}
              size="lg"
            >
              Upload to Secure Vault
            </Button>
          </form>
        </Card>

        {/* Documents Repository List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search files by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-xs text-surface-900 focus:outline-none focus:border-primary-600"
              />
            </div>

            <div className="flex items-center bg-surface-100 p-1 rounded-xl border border-surface-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-white text-surface-900 shadow-xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-surface-900 shadow-xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategoryFilter === cat.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* View Mode 1: Grid */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => {
                const isPdf = doc.mimeType?.includes('pdf') || doc.fileName?.endsWith('.pdf');
                return (
                  <Card
                    key={doc.id}
                    className="p-4 rounded-2xl shadow-xs hover:shadow-md transition-all border border-surface-200 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isPdf ? 'bg-danger-50 text-danger-700 border border-danger-200' : 'bg-info-50 text-info-700 border border-info-200'
                      }`}>
                        {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Badge variant="info" className="mb-1 text-[9px]">
                          {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                        </Badge>
                        <h3 className="text-xs font-bold text-surface-900 truncate group-hover:text-primary-600 transition-colors">
                          {doc.originalName}
                        </h3>
                        <p className="text-[10px] text-surface-400 mt-0.5">
                          {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-surface-100 pt-3 text-xs">
                      <span className="text-[10px] text-success-700 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Encrypted Stream
                      </span>

                      <div className="flex items-center gap-1">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Download Document"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: doc.id, name: doc.originalName })}
                          className="p-1.5 rounded-lg text-danger-600 hover:bg-danger-50 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* View Mode 2: Table */}
          {viewMode === 'table' && (
            <Card className="p-0 rounded-2xl overflow-hidden border border-surface-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                      <th className="p-3.5">Filename</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Size</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 text-surface-700">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-surface-50 transition-colors">
                        <td className="p-3.5 font-bold text-surface-900 max-w-[180px] truncate">
                          {doc.originalName}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="info">
                            {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                          </Badge>
                        </td>
                        <td className="p-3.5">{formatFileSize(doc.fileSize)}</td>
                        <td className="p-3.5 whitespace-nowrap">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: doc.id, name: doc.originalName })}
                              className="text-danger-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {filteredDocuments.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-surface-200 text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
                <FolderLock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-surface-900">No Documents Found</h3>
              <p className="text-xs text-surface-500 max-w-sm mx-auto">
                No files match your search query or category filter. Upload your medical reports or passport to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Document"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}" from your document vault? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
