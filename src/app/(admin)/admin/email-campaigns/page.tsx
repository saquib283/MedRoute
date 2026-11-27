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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { AlertTriangle } from 'lucide-react';

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
  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [cancelling, setCancelling] = useState(false);

  const fetchCampaigns = useCallback(async (page = 1) => {
    await Promise.resolve();
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

  useEffect(() => {
    queueMicrotask(() => {
      void fetchCampaigns();
    });
  }, [fetchCampaigns]);

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

  const handleCancel = (id: string, name: string) => {
    setCancelConfirm({ open: true, id, name });
  };

  const confirmCancelCampaign = async () => {
    if (!cancelConfirm.id) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/admin/email-campaigns?id=${cancelConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Campaign cancelled successfully');
        setCancelConfirm({ open: false, id: '', name: '' });
        fetchCampaigns(pagination.page);
      } else {
        toast.error(data.error?.message || 'Cancellation failed');
      }
    } catch {
      toast.error('Failed to cancel campaign');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="mb-1">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Email Campaigns</h1>
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
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Email Campaign"
        maxWidth="2xl"
      >
        <form onSubmit={handleSend} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-surface-700">Campaign Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              placeholder="e.g., Patient Onboarding Follow-up"
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

          <div className="bg-warning-50 border border-warning-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
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
      </Modal>

      {/* Campaign Detail View */}
      <Modal
        open={!!viewingCampaign}
        onClose={() => setViewingCampaign(null)}
        title="Campaign Details"
        maxWidth="md"
        footer={
          <Button variant="secondary" fullWidth onClick={() => setViewingCampaign(null)}>
            Close
          </Button>
        }
      >
        {viewingCampaign && (
          <div className="space-y-4">
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
                <div className="p-3 bg-surface-50 rounded-lg text-center flex items-center justify-center">
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
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={cancelConfirm.open}
        title="Cancel Scheduled Campaign"
        message={`Are you sure you want to cancel and delete "${cancelConfirm.name}"?`}
        confirmLabel="Cancel Campaign"
        variant="danger"
        loading={cancelling}
        onConfirm={confirmCancelCampaign}
        onCancel={() => setCancelConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
