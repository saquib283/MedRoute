'use client';

/**
 * MediRoute India — Admin Email Campaigns
 * Create & send campaigns using templates, target specific audiences,
 * view campaign history with status tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

interface Campaign {
  id: string;
  name: string;
  templateId: string;
  targetRole: string;
  status: string;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  template: { name: string; subject: string; category: string };
}

const STATUS_VARIANTS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  DRAFT: 'default',
  QUEUED: 'warning',
  SENT: 'success',
  FAILED: 'danger',
};

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'PATIENT', label: 'All Patients' },
  { value: 'MANAGER', label: 'All Managers' },
  { value: 'DOCTOR', label: 'All Doctors' },
  { value: 'ADMIN', label: 'All Admins' },
];

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // New Campaign modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', templateId: '', targetRole: 'ALL', scheduledAt: '' });
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Detail view
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/admin/email-campaigns?${params}`);
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data.campaigns);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/v1/admin/email-templates?limit=100');
      const data = await res.json();
      if (data.success) setTemplates(data.data.templates);
    } catch {
      toast.error('Failed to load templates');
    }
  };

  const openNewCampaign = () => {
    setForm({ name: '', templateId: '', targetRole: 'ALL', scheduledAt: '' });
    setSelectedTemplate(null);
    fetchTemplates();
    setShowModal(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    setForm({ ...form, templateId });
    const tpl = templates.find((t) => t.id === templateId) || null;
    setSelectedTemplate(tpl);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.templateId) {
      toast.error('Please select a template');
      return;
    }
    setSending(true);
    try {
      const payload = {
        ...form,
        scheduledAt: form.scheduledAt || null,
      };
      const res = await fetch('/api/v1/admin/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Campaign failed');
        return;
      }
      
      if (data.data.campaign.scheduledAt) {
        toast.success('Campaign scheduled successfully!');
      } else {
        toast.success(`Campaign sent immediately to ${data.data.campaign.sentCount} recipients!`);
      }
      
      setShowModal(false);
      fetchCampaigns(pagination.page);
    } catch {
      toast.error('An error occurred while sending.');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to cancel and delete the scheduled campaign "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/email-campaigns?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Campaign cancelled successfully');
        fetchCampaigns(pagination.page);
      } else {
        toast.error(data.error?.message || 'Cancellation failed');
      }
    } catch {
      toast.error('Failed to cancel campaign');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Email Campaigns</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200">Admin</span>
          </div>
          <p className="text-sm text-surface-500">Send targeted email campaigns to platform users using templates.</p>
        </div>
        <Button onClick={openNewCampaign}>+ New Campaign</Button>
      </div>

      <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'QUEUED', label: 'Queued' },
            { value: 'SENT', label: 'Sent' },
            { value: 'FAILED', label: 'Failed' }
          ]}
          placeholder="All Statuses"
          className="w-full sm:w-48"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchCampaigns()}>Refresh</Button>
      </Card>

      {/* Table */}
      <Card className="bg-white border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Campaign</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Template</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Audience</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Sent</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {campaigns.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-surface-500">No campaigns yet. Create your first campaign to get started.</td></tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-surface-900">{c.name}</td>
                      <td className="px-5 py-3.5 text-surface-600">{c.template.name}</td>
                      <td className="px-5 py-3.5"><Badge variant="default">{c.targetRole}</Badge></td>
                      <td className="px-5 py-3.5"><Badge variant={STATUS_VARIANTS[c.status] || 'default'} dot>{c.status}</Badge></td>
                      <td className="px-5 py-3.5 text-surface-600 font-medium">{c.sentCount}</td>
                      <td className="px-5 py-3.5 text-surface-500 text-xs">
                        {c.sentAt ? new Date(c.sentAt).toLocaleString() : c.scheduledAt ? `Scheduled: ${new Date(c.scheduledAt).toLocaleString()}` : new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewingCampaign(c)}>View</Button>
                          {c.status === 'QUEUED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-600 hover:text-danger-700"
                              onClick={() => handleCancel(c.id, c.name)}
                            >
                              Cancel
                            </Button>
                          )}
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
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
            <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchCampaigns(pagination.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchCampaigns(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] bg-surface-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-scale-up my-8">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900">New Email Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  placeholder="e.g., July Welcome Campaign"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Template *"
                  value={form.templateId}
                  onChange={handleTemplateSelect}
                  options={[
                    { value: '', label: 'Select a template...' },
                    ...templates.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))
                  ]}
                  required
                  helperText={templates.length === 0 ? "No templates available. Create one first." : undefined}
                />

                <Select
                  label="Target Audience *"
                  value={form.targetRole}
                  onChange={(val) => setForm({ ...form, targetRole: val })}
                  options={AUDIENCE_OPTIONS}
                  required
                />
              </div>

              <DatePicker
                label="Scheduled Send Time (Optional)"
                value={form.scheduledAt}
                onChange={(scheduledAt) => setForm({ ...form, scheduledAt })}
                showTimePicker={true}
                placeholder="Leave blank to send immediately"
                helperText="Leave blank to send this campaign immediately."
              />

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="border border-surface-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-surface-700">Template Preview</span>
                    <Badge variant="primary" size="sm">{selectedTemplate.category}</Badge>
                  </div>
                  <div className="px-4 py-2 border-b border-surface-100 bg-white">
                    <p className="text-xs text-surface-500">Subject: <span className="font-semibold text-surface-800">{selectedTemplate.subject}</span></p>
                  </div>
                  <div className="p-4 bg-white max-h-[200px] overflow-y-auto text-sm">
                    <div dangerouslySetInnerHTML={{ __html: selectedTemplate.body }} />
                  </div>
                </div>
              )}

              <div className="bg-warning-50 border border-warning-200 rounded-lg px-4 py-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-warning-800">
                    {form.scheduledAt ? 'Campaign will be scheduled' : 'Campaign will be sent immediately'}
                  </p>
                  <p className="text-[11px] text-warning-600 mt-0.5">
                    {form.scheduledAt 
                      ? `This will queue the campaign to process automatically at ${new Date(form.scheduledAt).toLocaleString()}.` 
                      : 'This will create email notifications for all active users matching the target audience. The campaign cannot be undone.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={sending}>
                  {form.scheduledAt ? 'Schedule Campaign' : 'Send Campaign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Detail View */}
      {viewingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-scale-up">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900">Campaign Details</h3>
              <button onClick={() => setViewingCampaign(null)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Campaign Name</p>
                  <p className="text-sm font-semibold text-surface-900 mt-0.5">{viewingCampaign.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Template</p>
                    <p className="text-sm text-surface-700 mt-0.5">{viewingCampaign.template.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Audience</p>
                    <p className="text-sm text-surface-700 mt-0.5">{viewingCampaign.targetRole}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surface-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-surface-900">{viewingCampaign.sentCount}</p>
                    <p className="text-[10px] text-surface-500 font-semibold">Sent</p>
                  </div>
                  <div className="p-3 bg-surface-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-surface-900">{viewingCampaign.failedCount}</p>
                    <p className="text-[10px] text-surface-500 font-semibold">Failed</p>
                  </div>
                  <div className="p-3 bg-surface-50 rounded-lg text-center">
                    <Badge variant={STATUS_VARIANTS[viewingCampaign.status] || 'default'} dot>{viewingCampaign.status}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Sent At</p>
                  <p className="text-sm text-surface-700 mt-0.5">
                    {viewingCampaign.sentAt ? new Date(viewingCampaign.sentAt).toLocaleString() : 'Not yet sent'}
                  </p>
                </div>
              </div>
              <Button variant="secondary" fullWidth onClick={() => setViewingCampaign(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
