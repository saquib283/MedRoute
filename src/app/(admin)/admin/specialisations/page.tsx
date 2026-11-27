'use client';

/**
 * Afzal Healthcare — Admin Specialisations Management
 * CRUD for specialisations with search, deactivation guards, and toast notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';

interface Specialisation {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { doctors: number };
}

export default function AdminSpecialisationsPage() {
  const [specs, setSpecs] = useState<Specialisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Specialisation | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [saving, setSaving] = useState(false);

  // Deactivate confirmation
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [deactivating, setDeactivating] = useState(false);

  const fetchSpecs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/specialisations');
      const data = await res.json();
      if (data.success) {
        let list: Specialisation[] = data.data.specialisations;
        if (search) {
          list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
        }
        setSpecs(list);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load specialisations');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSpecs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSpecs]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (s: Specialisation) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', isActive: s.isActive });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description || undefined,
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;

      const res = await fetch('/api/v1/admin/specialisations', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save specialisation');
        return;
      }
      toast.success(editing ? 'Specialisation updated successfully' : 'Specialisation created successfully');
      setShowModal(false);
      fetchSpecs();
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/v1/admin/specialisations?id=${deactivateConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to deactivate specialisation');
        return;
      }
      toast.success('Specialisation deactivated successfully');
      setDeactivateConfirm({ open: false, id: '', name: '' });
      fetchSpecs();
    } catch {
      toast.error('An error occurred.');
    } finally {
      setDeactivating(false);
    }
  };

  const startDeactivate = (s: Specialisation) => {
    if (s._count.doctors > 0) {
      toast.error('Cannot deactivate a specialisation that has active associated doctors.');
      return;
    }
    setDeactivateConfirm({ open: true, id: s.id, name: s.name });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Specialisations</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">Manage medical classifications used across partner hospitals and doctors.</p>
        </div>
        <Button onClick={openCreate}>+ Add Specialisation</Button>
      </div>

      {/* Filter */}
      <Card padding="sm" className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search specialisation name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
        />
        <Button variant="secondary" size="sm" onClick={() => fetchSpecs()}>
          Search
        </Button>
      </Card>

      <Card className="p-0! overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {specs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-surface-500">No specialisations found.</div>
            ) : (
              specs.map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-surface-100/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 bg-surface-100 border border-surface-200 rounded-md flex items-center justify-center text-surface-600 font-semibold text-xs shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{s.name}</p>
                      <p className="text-xs text-surface-500 truncate">
                        {s.description || 'No description'} • <span className="tabular-nums">{s._count.doctors}</span> doctor
                        {s._count.doctors !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={s.isActive ? 'success' : 'danger'} dot>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                      {s.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:text-danger-700"
                          onClick={() => startDeactivate(s)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40">
          <div className="bg-white rounded-lg shadow-md border border-surface-200 w-full max-w-sm animate-scale-in">
            <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm sm:text-base font-semibold text-surface-900">{editing ? 'Edit specialisation' : 'Add specialisation'}</h3>
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
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 border border-surface-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="specActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded accent-primary-600"
                  />
                  <label htmlFor="specActive" className="text-sm font-medium text-surface-700">
                    Active
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={saving}>
                  {editing ? 'Save' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Deactivation */}
      <ConfirmDialog
        open={deactivateConfirm.open}
        title="Deactivate Specialisation"
        message={`Are you sure you want to deactivate "${deactivateConfirm.name}"?`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm({ open: false, id: '', name: '' })}
      />
    </div>
  );
}
