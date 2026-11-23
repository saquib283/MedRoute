'use client';

/**
 * Afzal Healthcare — Admin Notification Management
 * Draft and send broadcast notifications (email/SMS/in-app) to platform roles, view history logs.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  channel: string;
  isRead: boolean;
  sentAt: string;
  triggerEvent: string | null;
  user: { fullName: string; role: string; email: string };
}

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'PATIENT', label: 'Patients Only' },
  { value: 'MANAGER', label: 'Managers Only' },
  { value: 'DOCTOR', label: 'Doctors Only' },
  { value: 'ADMIN', label: 'Admins Only' },
];

const CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: 'In-App Notification' },
  { value: 'EMAIL', label: 'Email Broadcast' },
  { value: 'SMS', label: 'SMS Alert' },
];

export default function AdminNotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('ALL');
  const [channel, setChannel] = useState('IN_APP');
  const [sending, setSending] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/v1/admin/notifications?page=${page}&limit=15`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.notifications);
        setPagination(data.data.pagination);
      }
    } catch {
      toast.error('Failed to load notification logs');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/v1/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: message,
          channel,
          targetRole,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error?.message || 'Failed to send broadcast');
        return;
      }
      toast.success(`Broadcast successfully sent to ${data.data.sentCount} active users.`);
      setTitle('');
      setMessage('');
      fetchLogs(1);
    } catch {
      toast.error('An error occurred while sending broadcast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Broadcast Form */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Notification Center</h1>
          <p className="text-sm text-surface-500 mt-1">Send platform-wide broadcast alerts or check delivery status.</p>
        </div>

        <Card className="p-6 bg-white border border-surface-200">
          <h2 className="text-sm font-bold text-surface-900 mb-4">Send Role-Based Broadcast</h2>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <Select
              label="Target Audience"
              value={targetRole}
              onChange={setTargetRole}
              options={ROLE_OPTIONS}
              required
            />

            <Select
              label="Delivery Channel"
              value={channel}
              onChange={setChannel}
              options={CHANNEL_OPTIONS}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-surface-700 uppercase">Alert Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Important Announcement..."
                className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-surface-700 uppercase">Message Content</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full p-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
              />
            </div>

            <Button type="submit" className="w-full" isLoading={sending}>
              Send Broadcast Alert
            </Button>
          </form>
        </Card>
      </div>

      {/* Broadcast History logs */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-surface-900 tracking-tight">Notification History Logs</h2>
          <p className="text-sm text-surface-500 mt-1">Chronological delivery history of system-generated and broadcast notifications.</p>
        </div>

        <Card className="bg-white border border-surface-200 overflow-hidden">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-surface-500">
              No notification logs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {logs.map((log) => (
                <div key={log.id} className="p-5 flex items-start gap-4 hover:bg-surface-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-600 font-bold text-xs shrink-0 mt-0.5">
                    {log.user.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-surface-900">{log.title}</p>
                      <Badge variant="default" className="text-xs">
                        {log.channel}
                      </Badge>
                      {log.triggerEvent && (
                        <Badge variant="primary" className="text-xs">
                          {log.triggerEvent}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-surface-600 mt-1.5 line-clamp-2" title={log.body}>
                      {log.body}
                    </p>
                    <p className="text-xs text-surface-500 mt-2">
                      To: <span className="font-semibold">{log.user.fullName}</span> ({log.user.role}) •{' '}
                      {new Date(log.sentAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={log.isRead ? 'success' : 'default'} className="text-xs shrink-0">
                    {log.isRead ? 'Read' : 'Delivered'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {pagination.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-sm bg-surface-50">
              <span className="text-surface-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} logs)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
