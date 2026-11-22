'use client';

/**
 * Afzal Healthcare — Platform Settings
 * Global system configurations, restricted to Admin only.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { toast } from '@/components/ui/Toast';

interface SystemSettings {
  maxPatientsPerManager: number;
  defaultCommissionRate: number;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  maintenanceStart: string;
  maintenanceEnd: string;
  alertBannerText: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    // Check permission
    fetch('/api/v1/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const role = d.data?.user?.role;
          setUserRole(role);
          if (role === 'ADMIN') {
            fetchSettings();
          } else {
            setLoading(false);
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data.settings);
      }
    } catch {
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save settings.');
        return;
      }
      toast.success('System settings updated successfully.');
    } catch {
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (userRole !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-surface-900">Access Denied</h2>
        <p className="text-sm text-surface-500 mt-2">Only Administrators are authorized to view or edit system settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Settings</h1>
        <p className="text-sm text-surface-500 mt-1">Configure global application variables, business limits, and deployment states.</p>
      </div>

      {settings && (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6 bg-white border border-surface-200 space-y-6">
            <h2 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-3">Operational Thresholds</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-surface-700 uppercase">Max Patients Per Manager</label>
                <input
                  type="number"
                  required
                  value={settings.maxPatientsPerManager}
                  onChange={(e) => setSettings({ ...settings, maxPatientsPerManager: parseInt(e.target.value, 10) })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                />
                <p className="text-[11px] text-surface-400">Hard limit on total patients assignable to an operations manager.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-surface-700 uppercase">Default Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settings.defaultCommissionRate}
                  onChange={(e) => setSettings({ ...settings, defaultCommissionRate: parseFloat(e.target.value) })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                />
                <p className="text-[11px] text-surface-400">Default rate applied to new hospital bookings if no custom commission is set.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border border-surface-200 space-y-6">
            <h2 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-3">Security & Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-surface-700 uppercase">Session Idle Timeout (Minutes)</label>
                <input
                  type="number"
                  required
                  value={settings.sessionTimeoutMinutes}
                  onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                />
                <p className="text-[11px] text-surface-400">Idle duration before active JSON Web Tokens are invalidated.</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-50 border border-surface-200 rounded-lg">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-surface-900">System Maintenance Mode</p>
                  <p className="text-xs text-surface-500">Locks login and APIs for regular users.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-5 h-5 accent-primary-600 rounded-md cursor-pointer"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border border-surface-200 space-y-6">
            <h2 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-3">Scheduled Maintenance & Alert Banner</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-surface-700 uppercase">Global Alert Banner Text</label>
                <input
                  type="text"
                  value={settings.alertBannerText}
                  onChange={(e) => setSettings({ ...settings, alertBannerText: e.target.value })}
                  className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                  placeholder="e.g., Scheduled maintenance this Sunday from 2 AM to 4 AM IST."
                />
                <p className="text-[11px] text-surface-400">If set, this warning message will be rendered as a global header alert across all admin dashboards.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DatePicker
                  label="Maintenance Start Time"
                  value={settings.maintenanceStart ? settings.maintenanceStart.substring(0, 16) : ''}
                  onChange={(val) => setSettings({ ...settings, maintenanceStart: val })}
                  showTimePicker={true}
                  placeholder="Pick start time"
                  helperText="Date/Time when system access restrictions automatically apply."
                />

                <DatePicker
                  label="Maintenance End Time"
                  value={settings.maintenanceEnd ? settings.maintenanceEnd.substring(0, 16) : ''}
                  onChange={(val) => setSettings({ ...settings, maintenanceEnd: val })}
                  showTimePicker={true}
                  placeholder="Pick end time"
                  helperText="Date/Time when system access automatic restrictions lift."
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={saving} className="px-8">
              Save Global Configuration
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
