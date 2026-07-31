'use client';

/**
 * Afzal Healthcare — Admin User Management
 * Full CRUD with Admin guards, password reset, deactivate, toast feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = ['PATIENT', 'MANAGER', 'DOCTOR', 'ADMIN'];
const ROLE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  PATIENT: 'primary',
  MANAGER: 'warning',
  DOCTOR: 'success',
  ADMIN: 'danger',
  Admin: 'danger',
};

interface SourceCase {
  id: string;
  status: string;
  urgencyLevel?: string;
  isUrgent?: boolean;
  patient?: {
    user?: {
      fullName: string;
    };
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [currentUserRole, setCurrentUserRole] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ email: '', fullName: '', password: '', role: 'MANAGER', phone: '', isActive: true });
  const [saving, setSaving] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; userId: string; userName: string; action: 'deactivate' | 'delete' }>({ open: false, userId: '', userName: '', action: 'deactivate' });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Password reset
  const [resetResult, setResetResult] = useState<{ open: boolean; password: string; userName: string }>({ open: false, password: '', userName: '' });

  // Workload Reassignment Tab States
  const [activeTab, setActiveTab] = useState<'users' | 'reassign'>('users');
  const [managers, setManagers] = useState<User[]>([]);
  const [sourceManagerId, setSourceManagerId] = useState('');
  const [destinationManagerId, setDestinationManagerId] = useState('');
  const [sourceCases, setSourceCases] = useState<SourceCase[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Fetch managers list
  const fetchManagers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/users?role=MANAGER&limit=100');
      const data = await res.json();
      if (data.success) {
        setManagers(data.data.users);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch cases for source manager
  const fetchSourceCases = useCallback(async (managerId: string) => {
    if (!managerId) {
      setSourceCases([]);
      return;
    }
    setLoadingCases(true);
    try {
      const res = await fetch(`/api/v1/admin/cases?managerId=${managerId}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setSourceCases(data.data.cases);
        setSelectedCaseIds([]); // reset selection
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load manager cases');
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSourceCases(sourceManagerId);
  }, [sourceManagerId, fetchSourceCases]);

  const handleBulkReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCaseIds.length === 0) {
      toast.error('Please select at least one case to transfer');
      return;
    }
    if (!destinationManagerId) {
      toast.error('Please select a destination manager');
      return;
    }
    if (sourceManagerId === destinationManagerId) {
      toast.error('Source and destination managers must be different');
      return;
    }
    setTransferring(true);
    try {
      const res = await fetch('/api/v1/admin/cases/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseIds: selectedCaseIds,
          targetManagerId: destinationManagerId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully transferred ${data.data.reassignedCount} cases!`);
        fetchSourceCases(sourceManagerId); // refresh case list
      } else {
        toast.error(data.error?.message || 'Transfer failed');
      }
    } catch {
      toast.error('An error occurred during transfer.');
    } finally {
      setTransferring(false);
    }
  };

  // Fetch current user role
  useEffect(() => {
    fetch('/api/v1/auth/me').then(r => r.json()).then(d => {
      if (d.success) setCurrentUserRole(d.data?.user?.role || '');
    }).catch(() => {});
  }, []);

  const isSuperAdmin = currentUserRole === 'ADMIN';

  useEffect(() => {
    if (activeTab === 'reassign' && isSuperAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchManagers();
    }
  }, [activeTab, isSuperAdmin, fetchManagers]);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      const res = await fetch(`/api/v1/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ email: '', fullName: '', password: '', role: 'MANAGER', phone: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    // Non-super-admins can't edit admin-level users
    if ((user.role === 'ADMIN' || user.role === 'ADMIN') && !isSuperAdmin) {
      toast.error('Only Admin can edit admin-level users.');
      return;
    }
    setEditingUser(user);
    setFormData({ email: user.email, fullName: user.fullName, password: '', role: user.role, phone: user.phone || '', isActive: user.isActive });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch('/api/v1/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingUser.id, fullName: formData.fullName, email: formData.email, phone: formData.phone, role: formData.role, isActive: formData.isActive }),
        });
        const data = await res.json();
        if (!data.success) { toast.error(data.error?.message || 'Failed to update user'); return; }
        toast.success('User updated successfully');
      } else {
        const res = await fetch('/api/v1/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!data.success) { toast.error(data.error?.message || 'Failed to create user'); return; }
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers(pagination.page);
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setConfirmLoading(true);
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmAction.userId, isActive: false }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed to deactivate'); return; }
      toast.success(`${confirmAction.userName} has been deactivated.`);
      setConfirmAction({ open: false, userId: '', userName: '', action: 'deactivate' });
      fetchUsers(pagination.page);
    } catch {
      toast.error('Failed to deactivate user.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    if ((user.role === 'ADMIN' || user.role === 'ADMIN') && !isSuperAdmin) {
      toast.error('Only Admin can reset admin passwords.');
      return;
    }
    try {
      const res = await fetch('/api/v1/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error?.message || 'Failed to reset password'); return; }
      setResetResult({ open: true, password: data.data.temporaryPassword, userName: user.fullName });
    } catch {
      toast.error('Failed to reset password.');
    }
  };

  const canEditUser = (user: User) => {
    if (user.role === 'ADMIN' || user.role === 'ADMIN') return isSuperAdmin;
    return true;
  };

  // Filter role options for non-super-admins
  const availableRoles = isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter(r => r !== 'ADMIN' && r !== 'ADMIN');

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">User Management</h1>
          <p className="text-sm text-surface-500 mt-1">Create, edit, and manage all platform user accounts.</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button
              variant="secondary"
              onClick={() => {
                window.open(`/api/v1/admin/export/users?role=${roleFilter}`, '_blank');
                toast.success('Export started — check your downloads.');
              }}
            >
              ↓ Export CSV
            </Button>
          )}
          <Button onClick={openCreate}>+ Create User</Button>
        </div>
      </div>

      {/* Tabs */}
      {isSuperAdmin && (
        <div className="flex border-b border-surface-200 gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Users Directory
          </button>
          <button
            onClick={() => setActiveTab('reassign')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'reassign'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Workload Reassignment
          </button>
        </div>
      )}

      {activeTab === 'users' ? (
        <>
          {/* Filters */}
          <Card className="p-4 bg-white border border-surface-200 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: '', label: 'All Roles' },
                ...ROLE_OPTIONS.map((r) => ({ value: r, label: r }))
              ]}
              placeholder="All Roles"
              className="w-full sm:w-48"
            />
            <Select
              value={activeFilter}
              onChange={setActiveFilter}
              options={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' }
              ]}
              placeholder="All Status"
              className="w-full sm:w-48"
            />
            <Button variant="secondary" size="sm" onClick={() => fetchUsers()}>Search</Button>
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
                      <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Email</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Role</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">Joined</th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {users.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-surface-500">No users found.</td></tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-surface-900">{u.fullName}</td>
                          <td className="px-5 py-3.5 text-surface-600">{u.email}</td>
                          <td className="px-5 py-3.5"><Badge variant={ROLE_COLORS[u.role] || 'default'}>{u.role}</Badge></td>
                          <td className="px-5 py-3.5">
                            <Badge variant={u.isActive ? 'success' : 'danger'} dot>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-surface-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEditUser(u) && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u)}>Reset Pwd</Button>
                                  {u.isActive && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-danger-600 hover:text-danger-700"
                                      onClick={() => setConfirmAction({ open: true, userId: u.id, userName: u.fullName, action: 'deactivate' })}
                                    >
                                      Deactivate
                                    </Button>
                                  )}
                                </>
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
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm">
                <span className="text-surface-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        /* Workload Reassignment Panel */
        <form onSubmit={handleBulkReassign} className="space-y-6">
          <Card className="p-6 bg-white border border-surface-200 space-y-6">
            <h2 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-3 uppercase tracking-wider">Manager Load Balancer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="Source Manager (Transfer From)"
                value={sourceManagerId}
                onChange={setSourceManagerId}
                options={[
                  { value: '', label: 'Select source manager...' },
                  ...managers.map((m) => ({ value: m.id, label: `${m.fullName} (${m.email})` }))
                ]}
                helperText="Select the manager whose active cases you wish to transfer."
                required
              />

              <Select
                label="Destination Manager (Transfer To)"
                value={destinationManagerId}
                onChange={setDestinationManagerId}
                options={[
                  { value: '', label: 'Select destination manager...' },
                  ...managers.map((m) => ({ value: m.id, label: `${m.fullName} (${m.email})` }))
                ]}
                helperText="Select the manager who will receive the reassigned cases."
                required
              />
            </div>
          </Card>

          {sourceManagerId && (
            <Card className="p-6 bg-white border border-surface-200 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <h3 className="text-sm font-bold text-surface-900">Active Cases Assigned to Source Manager</h3>
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCaseIds(sourceCases.map((c) => c.id))}
                    className="text-primary-600 hover:text-primary-700 font-bold"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCaseIds([])}
                    className="text-surface-500 hover:text-surface-700 font-bold"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {loadingCases ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sourceCases.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-6">No active cases assigned to this manager.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                  {sourceCases.map((c) => {
                    const isChecked = selectedCaseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-surface-50 transition-colors ${
                          isChecked ? 'border-primary-500 bg-primary-50/20' : 'border-surface-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCaseIds([...selectedCaseIds, c.id]);
                            } else {
                              setSelectedCaseIds(selectedCaseIds.filter((id) => id !== c.id));
                            }
                          }}
                          className="mt-1 accent-primary-600 w-4 h-4 shrink-0"
                        />
                        <div className="text-xs">
                          <p className="font-bold text-surface-900">Case #{c.id.substring(0, 8)}</p>
                          <p className="text-surface-600 font-medium mt-0.5">Patient: {c.patient?.user?.fullName || 'Unknown'}</p>
                          <p className="text-[10px] text-surface-400 mt-0.5">Status: {c.status} • Urgency: {c.urgencyLevel || 'ROUTINE'}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedCaseIds.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-surface-100">
                  <Button type="submit" isLoading={transferring} className="px-8">
                    Transfer {selectedCaseIds.length} Selected Cases
                  </Button>
                </div>
              )}
            </Card>
          )}
        </form>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-scale-up">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900">{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 font-bold text-lg">Ã—</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Full Name</label>
                <input type="text" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700">Email</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Password</label>
                  <input type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="Min 8 characters" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val })}
                  options={availableRoles.map((r) => ({ value: r, label: r }))}
                  required
                  className="col-span-1"
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full p-2.5 border border-surface-300 rounded text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
              </div>
              {editingUser && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                  <label htmlFor="isActive" className="text-sm font-medium text-surface-700">Account Active</label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={saving}>{editingUser ? 'Save Changes' : 'Create User'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={confirmAction.open}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${confirmAction.userName}"? They will be logged out and unable to access the platform.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={confirmLoading}
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmAction({ open: false, userId: '', userName: '', action: 'deactivate' })}
      />

      {/* Password Reset Result */}
      {resetResult.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-scale-up p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-success-100 text-success-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-surface-900">Password Reset</h3>
              <p className="text-sm text-surface-600 mt-1">Temporary password for <strong>{resetResult.userName}</strong>:</p>
              <div className="mt-3 p-3 bg-surface-100 rounded-lg border border-surface-200">
                <code className="text-lg font-mono font-bold text-primary-700 select-all">{resetResult.password}</code>
              </div>
              <p className="text-xs text-surface-400 mt-2">This password is shown only once. Share it securely with the user.</p>
            </div>
            <Button className="w-full" onClick={() => setResetResult({ open: false, password: '', userName: '' })}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
