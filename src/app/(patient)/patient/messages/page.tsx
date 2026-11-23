'use client';

/**
 * Afzal Healthcare — Coordinator Chat
 * Mobile-safe responsive chat layout with full coordinator name visibility,
 * edge-faded 44px quick-prompt chips, and unclipped compose input on 320px–375px screens.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePatientSession } from '../patient-session-context';
import {
  Calendar,
  Plane,
  FileSearch,
  Lock,
  RefreshCw,
  Send,
  CheckCheck,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
}

interface Manager {
  id: string;
  fullName: string;
  email: string;
}

const QUICK_PROMPTS = [
  {
    label: 'Check Appointment Status',
    icon: Calendar,
    prompt:
      'Hi, could you please share an update on my scheduled specialist appointment?',
  },
  {
    label: 'Medical Visa Letter',
    icon: Plane,
    prompt:
      'Hi, I need assistance with my Indian Medical Visa Invitation Letter (VIL).',
  },
  {
    label: 'Review Uploaded Reports',
    icon: FileSearch,
    prompt:
      'Hi, I have uploaded new medical reports to my Document Vault. Could the doctor review them?',
  },
];

export default function SecureMessagesPage() {
  const session = usePatientSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [manager, setManager] = useState<Manager | null>(null);
  const [fallbackUserId, setFallbackUserId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const promptScrollerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const patientUserId = session.userId || fallbackUserId;

  useEffect(() => {
    if (session.userId || session.isLoading) return;
    let cancelled = false;
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();
        if (!cancelled && data.success && data.data?.user?.id) {
          setFallbackUserId(data.data.user.id);
        }
      } catch (err) {
        console.error('Failed to resolve patient identity', err);
      }
    };
    void fetchMe();
    return () => {
      cancelled = true;
    };
  }, [session.userId, session.isLoading]);

  const fetchMessages = useCallback(async (background = false) => {
    if (!background) {
      setLoadError(null);
    }
    try {
      const res = await fetch('/api/v1/patient/messages');
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setMessages(data.data.messages || []);
        setManager(data.data.manager || null);
        setLoadError(null);
      } else if (!background) {
        setLoadError(data?.error?.message || 'Unable to load your conversation history.');
      }
    } catch (err) {
      console.error('Failed to load message history', err);
      if (!background) {
        setLoadError('Could not connect to Coordinator Chat. Please check your connection and retry.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchMessages(false);
    }, 0);
    const interval = setInterval(() => {
      void fetchMessages(true);
    }, 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchMessages]);

  // IntersectionObserver fallback for Quick Prompts edge fade
  useEffect(() => {
    const scroller = promptScrollerRef.current;
    if (!scroller) return;
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()')) {
      return;
    }

    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          scroller.classList.toggle(
            target === first ? 'more-start' : 'more-end',
            intersectionRatio < 1
          );
        }
      },
      { root: scroller, threshold: 1, rootMargin: '1px' }
    );

    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, [isLoading]);

  useEffect(() => {
    const latestId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (latestId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = latestId;
      if (latestId && feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }
  }, [messages]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    void fetchMessages(false);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!inputMessage.trim()) return;
    if (!manager) {
      setErrorMsg('A care coordinator has not been assigned yet.');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/v1/patient/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setInputMessage('');
        void fetchMessages(true);
      } else {
        setErrorMsg(data.error?.message || 'Failed to send message.');
      }
    } catch {
      setErrorMsg('Network error sending message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach((msg) => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const existing = groups.find((g) => g.date === dateStr);
      if (existing) {
        existing.msgs.push(msg);
      } else {
        groups.push({ date: dateStr, msgs: [msg] });
      }
    });
    return groups;
  }, [messages]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto h-[calc(100dvh-8.5rem)] min-h-[30rem] flex flex-col">
        <div className="flex-1 rounded-3xl bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100dvh-8.5rem)] min-h-[30rem] flex flex-col">
      <Card
        padding="sm"
        className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative rounded-3xl border border-surface-200 shadow-xs bg-white"
      >
        {/* ─── Responsive Coordinator Header (No name crushing on 375px) ─── */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-surface-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-100 text-primary-800 border border-primary-200 flex items-center justify-center font-bold text-base shadow-2xs">
                {manager ? manager.fullName.charAt(0) : '?'}
              </div>
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  manager ? 'bg-success-500' : 'bg-surface-300'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-surface-900">
                  {manager ? manager.fullName : 'Awaiting Care Coordinator'}
                </h1>
                {manager && (
                  <span className="px-2 py-0.5 bg-primary-50 text-primary-800 text-[11px] font-semibold rounded-md border border-primary-200 shrink-0">
                    Assigned
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 truncate mt-0.5">
                {manager
                  ? `Case Coordinator • ${manager.email}`
                  : 'Your coordinator will connect here as soon as assigned.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-3 py-1.5 rounded-xl text-xs font-medium text-surface-600">
              <Lock className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
              <span>Private Care Channel</span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              aria-label="Refresh messages"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-surface-200 text-surface-600 hover:text-surface-900 hover:bg-surface-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* ─── Message Feed ─────────────────────────────────────────────── */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-surface-50/60"
        >
          {loadError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs font-medium">{loadError}</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void fetchMessages(false)}
              >
                Retry
              </Button>
            </div>
          )}

          {groupedMessages.map((group) => (
            <div key={group.date} className="space-y-4">
              <div className="flex items-center justify-center my-2">
                <span className="px-3 py-1 bg-white border border-surface-200 text-surface-600 rounded-full text-xs font-semibold shadow-2xs">
                  {group.date}
                </span>
              </div>

              {group.msgs.map((msg) => {
                const isMe = msg.senderId === patientUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-800 font-bold text-xs flex items-center justify-center shrink-0 mb-1 border border-primary-200">
                        {manager ? manager.fullName.charAt(0) : 'C'}
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[70%] p-4 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                        isMe
                          ? 'bg-primary-600 text-white rounded-2xl rounded-br-sm'
                          : 'bg-white border border-surface-200 text-surface-900 rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>

                      <div
                        className={`flex items-center justify-end gap-1 text-[11px] mt-2 font-medium tabular-nums ${
                          isMe ? 'text-primary-100' : 'text-surface-500'
                        }`}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMe && (
                          <CheckCheck className="w-3.5 h-3.5 text-primary-200" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {!loadError && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-surface-200 shadow-2xs flex items-center justify-center text-primary-600">
                <MessageSquare className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-surface-900">
                Message Your Care Coordinator
              </h2>
              <p className="text-xs text-surface-600 max-w-sm leading-relaxed">
                Ask questions about your treatment schedule, medical visa invitation letter, airport pickup, or hospital preparation.
              </p>
            </div>
          )}
        </div>

        {/* ─── Footer Quick Prompts & Mobile-Safe Compose Bar ───────────── */}
        <div className="p-3.5 sm:p-4 border-t border-surface-200 bg-white shrink-0 space-y-3">
          <div
            ref={promptScrollerRef}
            role="group"
            aria-label="Suggested message starters"
            className="edge-fade-scroller flex items-center gap-2"
          >
            {QUICK_PROMPTS.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInputMessage(item.prompt)}
                  disabled={!manager}
                  className="flex-none min-h-11 px-3.5 bg-surface-50 hover:bg-primary-50 hover:text-primary-800 hover:border-primary-200 border border-surface-200 rounded-xl text-xs font-semibold text-surface-700 whitespace-nowrap transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconComponent
                    className="w-3.5 h-3.5 text-primary-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSend} className="space-y-2">
            {errorMsg && (
              <div
                role="alert"
                className="bg-danger-50 border border-danger-200 text-danger-800 p-2.5 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <input
                type="text"
                aria-label="Write a message to your care coordinator"
                placeholder={
                  manager
                    ? 'Message your coordinator...'
                    : 'Awaiting coordinator assignment...'
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={!manager || isSending}
                className="flex-1 min-w-0 min-h-11 px-3.5 sm:px-4 bg-surface-50 border border-surface-300 rounded-xl text-xs sm:text-sm text-surface-900 font-medium placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-colors disabled:bg-surface-100 disabled:cursor-not-allowed"
              />
              <Button
                type="submit"
                isLoading={isSending}
                disabled={!manager || !inputMessage.trim()}
                size="md"
                className="shrink-0"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Send</span>
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
