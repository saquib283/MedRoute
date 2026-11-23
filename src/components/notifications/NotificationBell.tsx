'use client';

/**
 * Afzal Healthcare — Universal In-App Notification Bell & Drawer
 * Polls GET /api/v1/notifications?limit=15 and supports click-to-mark-read
 * and mark-all-read across Patient, Manager, Doctor, and Admin portals.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCheck, Mail, MessageSquare, BellRing } from 'lucide-react';

interface NotificationRecord {
  id: string;
  channel: string;
  title: string;
  body: string;
  isRead: boolean;
  sentAt: string;
  triggerEvent?: string | null;
}

const POLL_INTERVAL_MS = 30_000;

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getChannelBadge(channel: string) {
  switch (channel) {
    case 'EMAIL':
      return {
        label: 'EMAIL',
        className: 'bg-info-50 text-info-700 border-info-200',
        Icon: Mail,
      };
    case 'SMS':
      return {
        label: 'SMS',
        className: 'bg-warning-50 text-warning-700 border-warning-100',
        Icon: MessageSquare,
      };
    default:
      return {
        label: 'IN_APP',
        className: 'bg-primary-50 text-primary-700 border-primary-200',
        Icon: BellRing,
      };
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications?limit=15');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(Array.isArray(json.data.notifications) ? json.data.notifications : []);
        setUnreadCount(typeof json.data.unreadCount === 'number' ? json.data.unreadCount : 0);
      }
    } catch {
      // Fail quietly during background polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const safeLoad = async () => {
      if (cancelled) return;
      await loadNotifications();
    };

    const initialTimer = setTimeout(() => {
      void safeLoad();
    }, 0);

    const pollInterval = setInterval(() => {
      void safeLoad();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      void loadNotifications();
    }
  };

  const handleMarkOneRead = async (item: NotificationRecord) => {
    if (item.isRead) return;

    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: item.id }),
      });
      if (!res.ok) return;
      const json = await res.json();
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      if (typeof json.data?.unreadCount === 'number') {
        setUnreadCount(json.data.unreadCount);
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore transient network errors on mark-read
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) return;
      const json = await res.json();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (typeof json.data?.unreadCount === 'number') {
        setUnreadCount(json.data.unreadCount);
      } else {
        setUnreadCount(0);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setMarkingAll(false);
    }
  };

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl border border-surface-200 bg-white text-surface-600 hover:text-surface-900 hover:bg-surface-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-xs">
            {badgeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications drawer"
          className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white rounded-2xl border border-surface-200 shadow-md z-50 overflow-hidden animate-scale-in"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-surface-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-surface-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-[11px] font-bold">
                  {badgeLabel} unread
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || markingAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 disabled:text-surface-400 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Mark all read</span>
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-surface-100">
            {loading && notifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-surface-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-6 h-6 text-surface-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs font-semibold text-surface-700">No notifications yet</p>
                <p className="text-[11px] text-surface-400 mt-0.5">
                  Updates on your cases and appointments will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const channelMeta = getChannelBadge(item.channel);
                const ChannelIcon = channelMeta.Icon;
                const previewText = stripHtmlTags(item.body);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleMarkOneRead(item)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                      item.isRead
                        ? 'bg-white hover:bg-surface-50'
                        : 'bg-primary-50/40 hover:bg-primary-50/70'
                    }`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        item.isRead ? 'bg-transparent' : 'bg-info-600'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${channelMeta.className}`}
                        >
                          <ChannelIcon className="w-2.5 h-2.5" aria-hidden="true" />
                          {channelMeta.label}
                        </span>
                        <span className="text-[11px] text-surface-400 shrink-0">
                          {formatTimestamp(item.sentAt)}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate ${
                          item.isRead
                            ? 'font-semibold text-surface-700'
                            : 'font-bold text-surface-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      {previewText && (
                        <p className="text-xs text-surface-600 line-clamp-2 leading-relaxed">
                          {previewText}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
