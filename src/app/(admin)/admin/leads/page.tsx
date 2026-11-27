'use client';

/**
 * MediRoute India — Admin Lead Management
 * CRM-style dashboard for reviewing, contacting, and onboarding marketing campaign leads.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  Inbox,
  Phone,
  Mail,
  Globe,
  MapPin,
  Stethoscope,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  IndianRupee,
  Copy,
  TrendingUp,
  Users,
} from 'lucide-react';

interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  city: string | null;
  medicalCondition: string;
  preferredHospitalCity: string | null;
  estimatedBudget: string | null;
  source: string;
  message: string | null;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';
  adminNotes: string | null;
  convertedUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ManagerOption {
  id: string;
  fullName: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default'; icon: typeof Inbox }
> = {
  NEW: { label: 'New', variant: 'success', icon: Sparkles },
  CONTACTED: { label: 'Contacted', variant: 'warning', icon: Phone },
  CONVERTED: { label: 'Converted', variant: 'success', icon: CheckCircle },
  CLOSED: { label: 'Closed', variant: 'default', icon: XCircle },
};

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  facebook: 'Facebook / Instagram',
  referral: 'Friend / Family',
  hospital_referral: 'Hospital Referral',
  youtube: 'YouTube',
  news: 'News / Article',
  website: 'Website',
  other: 'Other',
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Onboard modal
  const [onboardLead, setOnboardLead] = useState<Lead | null>(null);
  const [onboardForm, setOnboardForm] = useState({
    password: '',
    passportNo: '',
    dob: '',
    assignedManagerId: '',
  });
  const [onboarding, setOnboarding] = useState(false);
  const [onboardResult, setOnboardResult] = useState<{
    email: string;
    password: string;
    fullName: string;
  } | null>(null);

  // Managers for assignment
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  // Stats
  const [stats, setStats] = useState({ total: 0, new: 0, contacted: 0, converted: 0, closed: 0 });

  const fetchLeads = useCallback(
    async (page = 1) => {
      await Promise.resolve();
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        const res = await fetch(`/api/v1/admin/leads?${params}`);
        const data = await res.json();
        if (data.success) {
          setLeads(data.data.leads);
          setPagination(data.data.pagination);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, sourceFilter]
  );

  // Fetch stats (all statuses)
  const fetchStats = useCallback(async () => {
    try {
      const statuses = ['', 'NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];
      const results = await Promise.all(
        statuses.map((s) => {
          const p = new URLSearchParams({ limit: '1' });
          if (s) p.set('status', s);
          return fetch(`/api/v1/admin/leads?${p}`).then((r) => r.json());
        })
      );
      setStats({
        total: results[0]?.data?.pagination?.total || 0,
        new: results[1]?.data?.pagination?.total || 0,
        contacted: results[2]?.data?.pagination?.total || 0,
        converted: results[3]?.data?.pagination?.total || 0,
        closed: results[4]?.data?.pagination?.total || 0,
      });
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLeads();
      fetchStats();
    });
  }, [fetchLeads, fetchStats]);

  // Fetch managers
  useEffect(() => {
    fetch('/api/v1/admin/users?role=MANAGER&limit=100')
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setManagers(
            d.data.users.map((u: { id: string; fullName: string }) => ({
              id: u.id,
              fullName: u.fullName,
            }))
          );
      })
      .catch(() => {});
  }, []);

  const updateLeadStatus = async (leadId: string, status: string) => {
    try {
      const res = await fetch('/api/v1/admin/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lead marked as ${status.toLowerCase()}`);
        fetchLeads(pagination.page);
        fetchStats();
        if (selectedLead?.id === leadId) {
          setSelectedLead({ ...selectedLead, status: status as Lead['status'] });
        }
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const saveAdminNotes = async () => {
    if (!selectedLead) return;
    setSavingNotes(true);
    try {
      const res = await fetch('/api/v1/admin/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, adminNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Notes saved');
        setSelectedLead({ ...selectedLead, adminNotes });
        fetchLeads(pagination.page);
      }
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const specials = '@#$!%';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    pwd += specials.charAt(Math.floor(Math.random() * specials.length));
    setOnboardForm((prev) => ({ ...prev, password: pwd }));
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardLead) return;
    setOnboarding(true);
    try {
      const res = await fetch('/api/v1/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: onboardLead.id,
          password: onboardForm.password,
          nationality: onboardLead.nationality,
          passportNo: onboardForm.passportNo,
          dob: onboardForm.dob,
          assignedManagerId: onboardForm.assignedManagerId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Patient onboarded successfully!');
        setOnboardResult({
          email: data.data.user.email,
          password: data.data.generatedPassword,
          fullName: data.data.user.fullName,
        });
        fetchLeads(pagination.page);
        fetchStats();
      } else {
        toast.error(data.error?.message || 'Failed to onboard');
      }
    } catch {
      toast.error('Failed to onboard patient');
    } finally {
      setOnboarding(false);
    }
  };

  const conversionRate =
    stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">
            Lead Queries
          </h1>
          <p className="text-sm text-surface-600 mt-0.5">
            Manage inquiries from marketing campaigns and onboard confirmed patients.
          </p>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Leads', value: stats.total, icon: Inbox, color: 'text-surface-700' },
          { label: 'New', value: stats.new, icon: Sparkles, color: 'text-emerald-600' },
          { label: 'Contacted', value: stats.contacted, icon: Phone, color: 'text-amber-600' },
          { label: 'Converted', value: stats.converted, icon: CheckCircle, color: 'text-primary-600' },
          { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-info-600' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white border border-surface-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div className={`w-9 h-9 rounded-lg bg-surface-50 flex items-center justify-center ${s.color}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-surface-900">{s.value}</div>
                <div className="text-[11px] font-medium text-surface-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, condition..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-700 focus:outline-none focus:border-primary-600 transition-all"
            >
              <option value="">All Status</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CONVERTED">Converted</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-700 focus:outline-none focus:border-primary-600 transition-all"
            >
              <option value="">All Sources</option>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ── Leads Table ─────────────────────────────────────────────────── */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <Inbox className="w-10 h-10 text-surface-300 mx-auto" />
            <p className="text-sm font-medium text-surface-500">No leads found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-surface-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {leads.map((lead) => {
                  const sc = STATUS_CONFIG[lead.status];
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-surface-50/50 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-bold text-surface-900">{lead.fullName}</div>
                          <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </div>
                          <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                            <span className="text-surface-300">•</span>
                            <Globe className="w-3 h-3" />
                            {lead.nationality}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-surface-700 max-w-[200px] truncate">
                          {lead.medicalCondition}
                        </p>
                        {lead.preferredHospitalCity && (
                          <span className="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {lead.preferredHospitalCity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-surface-600">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={sc.variant} size="sm">
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-surface-500">
                          {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setAdminNotes(lead.adminNotes || '');
                            }}
                            className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {lead.status === 'NEW' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'CONTACTED')}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-surface-500 hover:text-amber-600 transition-colors"
                              title="Mark as Contacted"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                          )}
                          {(lead.status === 'NEW' || lead.status === 'CONTACTED') && (
                            <button
                              onClick={() => {
                                setOnboardLead(lead);
                                setOnboardResult(null);
                                setOnboardForm({
                                  password: '',
                                  passportNo: '',
                                  dob: '',
                                  assignedManagerId: '',
                                });
                              }}
                              className="p-1.5 rounded-lg hover:bg-primary-50 text-surface-500 hover:text-primary-600 transition-colors"
                              title="Onboard as Patient"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          {lead.status !== 'CONVERTED' && lead.status !== 'CLOSED' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'CLOSED')}
                              className="p-1.5 rounded-lg hover:bg-danger-50 text-surface-500 hover:text-danger-600 transition-colors"
                              title="Close Lead"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200">
            <span className="text-xs text-surface-500">
              Showing {(pagination.page - 1) * 20 + 1}–
              {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => fetchLeads(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed text-surface-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchLeads(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed text-surface-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Lead Detail Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? selectedLead.fullName : 'Lead Details'}
        maxWidth="2xl"
      >
        {selectedLead && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-surface-100">
              <div className="w-9 h-9 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-600" />
              </div>
              <Badge variant={STATUS_CONFIG[selectedLead.status].variant} size="sm">
                {STATUS_CONFIG[selectedLead.status].label}
              </Badge>
            </div>
              {/* Contact Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <DetailField icon={<Mail className="w-4 h-4" />} label="Email" value={selectedLead.email} />
                <DetailField icon={<Phone className="w-4 h-4" />} label="Phone" value={selectedLead.phone} />
                <DetailField icon={<Globe className="w-4 h-4" />} label="Nationality" value={selectedLead.nationality} />
                <DetailField icon={<MapPin className="w-4 h-4" />} label="City" value={selectedLead.city || '—'} />
              </div>

              {/* Medical Details */}
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  Medical Details
                </h4>
                <p className="text-sm text-surface-800 leading-relaxed">
                  {selectedLead.medicalCondition}
                </p>
                {selectedLead.preferredHospitalCity && (
                  <div className="flex items-center gap-2 text-xs text-surface-600">
                    <MapPin className="w-3.5 h-3.5" />
                    Preferred City: <span className="font-semibold">{selectedLead.preferredHospitalCity}</span>
                  </div>
                )}
                {selectedLead.estimatedBudget && (
                  <div className="flex items-center gap-2 text-xs text-surface-600">
                    <IndianRupee className="w-3.5 h-3.5" />
                    Budget: <span className="font-semibold">{selectedLead.estimatedBudget}</span>
                  </div>
                )}
              </div>

              {/* Source & Message */}
              <div className="grid sm:grid-cols-2 gap-4">
                <DetailField
                  icon={<Globe className="w-4 h-4" />}
                  label="Source"
                  value={SOURCE_LABELS[selectedLead.source] || selectedLead.source}
                />
                <DetailField
                  icon={<Clock className="w-4 h-4" />}
                  label="Submitted"
                  value={new Date(selectedLead.createdAt).toLocaleString('en-IN')}
                />
              </div>

              {selectedLead.message && (
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-500 flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Additional Message
                  </h4>
                  <p className="text-sm text-surface-700 leading-relaxed">{selectedLead.message}</p>
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-surface-500">
                  Internal Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Add internal notes about this lead (call summary, follow-up actions, etc.)..."
                  className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all resize-none"
                />
                <Button size="sm" onClick={saveAdminNotes} isLoading={savingNotes}>
                  Save Notes
                </Button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-200">
                {selectedLead.status === 'NEW' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateLeadStatus(selectedLead.id, 'CONTACTED')}
                  >
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Mark as Contacted
                  </Button>
                )}
                {(selectedLead.status === 'NEW' || selectedLead.status === 'CONTACTED') && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setOnboardLead(selectedLead);
                        setOnboardResult(null);
                        setOnboardForm({ password: '', passportNo: '', dob: '', assignedManagerId: '' });
                        setSelectedLead(null);
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Onboard as Patient
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateLeadStatus(selectedLead.id, 'CLOSED')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Close Lead
                    </Button>
                  </>
                )}
              </div>
          </div>
        )}
      </Modal>

      {/* ── Onboard Patient Modal ──────────────────────────────────────── */}
      <Modal
        open={!!onboardLead}
        onClose={() => { if (!onboarding) setOnboardLead(null); }}
        title="Onboard Patient"
        maxWidth="lg"
      >
        {onboardLead && (
          <div>
              {onboardResult ? (
                /* ── Success ─────────────────────────────────────────── */
                <div className="text-center space-y-5 animate-fade-in">
                  <div className="w-14 h-14 bg-success-50 border border-success-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7 text-success-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-surface-900">
                      Patient Onboarded Successfully!
                    </h4>
                    <p className="text-sm text-surface-600 mt-1">
                      Share these credentials with the patient:
                    </p>
                  </div>

                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-surface-500">Name</span>
                      <span className="text-sm font-semibold text-surface-900">
                        {onboardResult.fullName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-surface-500">Email</span>
                      <span className="text-sm font-mono text-surface-900">{onboardResult.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-surface-500">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-primary-700">
                          {onboardResult.password}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(onboardResult.password);
                            toast.success('Password copied!');
                          }}
                          className="p-1 rounded hover:bg-surface-200 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-surface-500" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-warning-50 border border-warning-200 text-warning-800 p-3 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
                    <span>
                      Make sure to share these credentials securely with the patient.
                      They can change their password after first login.
                    </span>
                  </div>

                  <Button fullWidth onClick={() => setOnboardLead(null)}>
                    Done
                  </Button>
                </div>
              ) : (
                /* ── Form ────────────────────────────────────────────── */
                <form onSubmit={handleOnboard} className="space-y-5">
                  {/* Pre-filled info */}
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-500">
                      Lead Information (pre-filled)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-surface-500">Name:</span>
                      <span className="font-semibold text-surface-800">{onboardLead.fullName}</span>
                      <span className="text-surface-500">Email:</span>
                      <span className="font-semibold text-surface-800">{onboardLead.email}</span>
                      <span className="text-surface-500">Phone:</span>
                      <span className="font-semibold text-surface-800">{onboardLead.phone}</span>
                      <span className="text-surface-500">Nationality:</span>
                      <span className="font-semibold text-surface-800">{onboardLead.nationality}</span>
                    </div>
                  </div>

                  {/* Additional required fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-surface-700 mb-1.5">
                        Passport Number <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={onboardForm.passportNo}
                        onChange={(e) =>
                          setOnboardForm((prev) => ({ ...prev, passportNo: e.target.value }))
                        }
                        required
                        placeholder="e.g., A12345678"
                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-surface-700 mb-1.5">
                        Date of Birth <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={onboardForm.dob}
                        onChange={(e) =>
                          setOnboardForm((prev) => ({ ...prev, dob: e.target.value }))
                        }
                        required
                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 focus:outline-none focus:border-primary-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-surface-700 mb-1.5">
                        Assign Manager
                      </label>
                      <select
                        value={onboardForm.assignedManagerId}
                        onChange={(e) =>
                          setOnboardForm((prev) => ({
                            ...prev,
                            assignedManagerId: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 focus:outline-none focus:border-primary-600 focus:bg-white transition-all"
                      >
                        <option value="">No manager (assign later)</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-surface-700 mb-1.5">
                        Login Password <span className="text-danger-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={onboardForm.password}
                          onChange={(e) =>
                            setOnboardForm((prev) => ({ ...prev, password: e.target.value }))
                          }
                          required
                          placeholder="Enter or generate password"
                          className="flex-1 px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm font-mono text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all"
                        />
                        <Button type="button" variant="secondary" size="sm" onClick={generatePassword}>
                          Generate
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" fullWidth isLoading={onboarding} size="lg">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Patient Account
                  </Button>
                </form>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ── Detail Field Component ───────────────────────────────────────── */
function DetailField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-surface-400 mt-0.5">{icon}</span>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">
          {label}
        </span>
        <span className="text-sm font-medium text-surface-800">{value}</span>
      </div>
    </div>
  );
}
