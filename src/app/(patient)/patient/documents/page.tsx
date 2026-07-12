'use client';

/**
 * MediRoute India — Patient Document Vault Page
 * Manage personal passports, medical records, and travel documents under clinical standards.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';

interface Document {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
}

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState('MEDICAL_REPORT');
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/patient/documents', { headers });
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!file) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    // Limit client-side file size verification (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg('File size exceeds the 25MB system limit.');
      return;
    }

    setIsUploading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/patient/documents', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`"${file.name}" uploaded successfully.`);
        setFile(null);
        // Clear input element
        const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
        
        fetchDocuments();
      } else {
        setErrorMsg(data.error?.message || 'Upload failed.');
      }
    } catch {
      setErrorMsg('Network error uploading file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to permanently delete this document?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/v1/patient/documents?id=${docId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        fetchDocuments();
      } else {
        alert(data.error?.message || 'Failed to delete file.');
      }
    } catch {
      alert('Network error deleting document.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'PASSPORT':
        return 'primary';
      case 'MEDICAL_REPORT':
        return 'success';
      case 'PRESCRIPTION':
        return 'info';
      case 'INSURANCE':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Loading document vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Overview Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-900 tracking-tight">Document Vault</h1>
        <p className="text-xs text-surface-500 mt-1">Upload and manage identity proofs, visa attachments, and medical records securely.</p>
      </div>

      {/* Upload and list section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form Card */}
        <Card className="lg:col-span-1 h-fit">
          <div className="border-b border-surface-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Upload New Attachment</h2>
          </div>
          <form onSubmit={handleUpload} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 p-2.5 rounded-md">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-success-50 border border-success-200 text-success-700 p-2.5 rounded-md">
                {successMsg}
              </div>
            )}

            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-surface-600">Document Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-surface-200 rounded-md text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="PASSPORT">Passport Copy</option>
                <option value="MEDICAL_REPORT">Medical Report</option>
                <option value="INSURANCE">Insurance Card</option>
                <option value="VISA">Visa Document</option>
                <option value="PRESCRIPTION">Prescription File</option>
              </select>
            </div>

            {/* File Input */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-surface-600">Select File (PDF, PNG, JPG)</label>
              <div className="border-2 border-dashed border-surface-200 hover:border-surface-300 rounded-lg p-4 text-center cursor-pointer relative bg-surface-50 transition-colors">
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
                <svg className="w-8 h-8 text-surface-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p className="text-[11px] font-medium text-surface-700">
                  {file ? file.name : 'Click to select or drag file here'}
                </p>
                <p className="text-[10px] text-surface-400 mt-1">Maximum file size: 25MB</p>
              </div>
            </div>

            <Button type="submit" fullWidth isLoading={isUploading}>
              Upload Document
            </Button>
          </form>
        </Card>

        {/* Uploaded Documents List Table */}
        <Card className="lg:col-span-2">
          <div className="border-b border-surface-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">File Repository</h2>
          </div>
          <div className="border border-surface-200 rounded-md overflow-hidden text-xs bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold">
                  <th className="p-3">File Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Upload Date</th>
                  <th className="p-3 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-50">
                    <td className="p-3 font-medium text-surface-900 max-w-[200px] truncate" title={doc.fileName}>
                      {doc.fileName}
                    </td>
                    <td className="p-3">
                      <Badge variant={getCategoryBadgeVariant(doc.category)}>
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatBytes(doc.fileSize)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right space-x-3">
                      <a
                        href={doc.fileUrl}
                        download={doc.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 hover:text-primary-700 font-semibold"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="text-danger-600 hover:text-danger-700 font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-surface-400">Your Document Vault is empty.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
