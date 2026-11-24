'use client';

/**
 * Afzal Healthcare — Admin Email Templates
 * Full CRUD for email templates with live HTML preview,
 * placeholder hints, category filtering, and search.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { sanitizeEmailHtml } from '@/lib/validation/email-sanitizer';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  placeholders: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['general', 'marketing', 'operational', 'onboarding', 'reminder', 'transactional'];
const PLACEHOLDER_HINTS = ['{{fullName}}', '{{email}}', '{{role}}', '{{nationality}}', '{{caseStatus}}', '{{portalUrl}}', '{{supportEmail}}'];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '', category: 'general', placeholders: '' });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTemplates = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/v1/admin/email-templates?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', subject: '', body: '', category: 'general', placeholders: '' });
    setShowPreview(false);
    setShowModal(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      category: t.category,
      placeholders: (t.placeholders || []).join(', '),
    });
    setShowPreview(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const placeholdersArr = form.placeholders
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      if (editing) {
        const res = await fetch('/api/v1/admin/email-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form, placeholders: placeholdersArr }),
        });
        const data = await res.json();
        if (!data.success) { toast.error(data.error?.message || 'Update failed'); return; }
        toast.success('Template updated successfully');
      } else {
        const res = await fetch('/api/v1/admin/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, placeholders: placeholdersArr }),
        });
        const data = await res.json();
        if (!data.success) { toast.error(data.error?.message || 'Creation failed'); return; }
        toast.success('Template created successfully');
      }
      setShowModal(false);
      fetchTemplates(pagination.page);
    } catch {
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/email-templates?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Delete failed'); return; }
      toast.success(`Template "${deleteTarget.name}" deleted.`);
      setDeleteTarget({ open: false, id: '', name: '' });
      fetchTemplates(pagination.page);
    } catch {
      toast.error('Failed to delete template.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Email Templates</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Create and manage reusable email templates for automated and broadcast campaigns.</p>
        </div>
        <Button onClick={openCreate}>+ New Template</Button>
      </div>

      {/* Filters */}
      <Card padding="sm" className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
        />
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: '', label: 'All Categories' },
            ...CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
          ]}
          placeholder="All Categories"
          className="w-full sm:w-48"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchTemplates()}>Search</Button>
      </Card>

      {/* Table */}
      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Name</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Subject</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Category</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-surface-500">Updated</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-surface-500">No templates found. Create your first template to get started.</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-100/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-surface-900">{t.name}</td>
                      <td className="px-5 py-3.5 text-surface-600 max-w-[240px] truncate">{t.subject}</td>
                      <td className="px-5 py-3.5"><Badge variant="primary">{t.category}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-500 text-xs tabular-nums">{new Date(t.updatedAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger-600 hover:text-danger-700"
                            onClick={() => setDeleteTarget({ open: true, id: t.id, name: t.name })}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-surface-500 tabular-nums">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchTemplates(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchTemplates(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] bg-surface-900/40 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-3xl animate-scale-in my-8">
            <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-semibold text-surface-900">{editing ? 'Edit template' : 'Create new template'}</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 p-1 rounded-md hover:bg-surface-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-surface-700">Template Name *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600" placeholder="e.g., Welcome Email" />
                </div>
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val })}
                  options={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700">Subject Line *</label>
                <input type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600" placeholder="e.g., Welcome to Afzal Healthcare, {{fullName}}" />
              </div>

              {/* Placeholder Hints */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs font-medium text-surface-500 self-center mr-1">Placeholders:</span>
                {PLACEHOLDER_HINTS.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setForm({ ...form, body: form.body + ph })}
                    className="px-2 py-1 bg-surface-100 text-surface-700 border border-surface-200 rounded-md text-xs font-mono font-medium hover:bg-surface-200 transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-surface-700">Email Body (HTML) *</label>
                  <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                    {showPreview ? '← Back to Editor' : 'Preview →'}
                  </button>
                </div>
                {showPreview ? (
                  <div className="w-full min-h-[200px] max-h-[400px] overflow-auto p-4 border border-surface-300 rounded-md bg-white text-sm">
                    <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(form.body) }} />
                  </div>
                ) : (
                  <textarea
                    required
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={10}
                    className="w-full p-3 border border-surface-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 resize-y"
                    placeholder="<h1>Hello {{fullName}},</h1><p>Welcome to Afzal Healthcare...</p>"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700">Tracked Placeholders (comma-separated)</label>
                <input type="text" value={form.placeholders} onChange={(e) => setForm({ ...form, placeholders: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600" placeholder="fullName, email, caseStatus, portalUrl" />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={saving}>{editing ? 'Save Changes' : 'Create Template'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget.open}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
