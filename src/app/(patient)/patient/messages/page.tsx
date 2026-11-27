'use client';

/**
 * MediRoute India — Patient Secure Messaging Portal
 * Real-time encrypted messaging interface with Lucide SVG icons and prompt chips.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Calendar,
  Plane,
  Home,
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
  { label: 'Check Appointment Status', icon: Calendar, prompt: 'Hi, could you please provide an update on my scheduled doctor appointment status?' },
  { label: 'Medical Visa Assistance', icon: Plane, prompt: 'Hi, I need assistance with my medical visa recommendation letter for India.' },
  { label: 'Hostel & Stay Query', icon: Home, prompt: 'Hi, I have a question regarding my accommodation check-in details and airport transfer.' },
  { label: 'Clinical Report Review', icon: FileSearch, prompt: 'Hi, I have uploaded new lab test reports to my vault. Could the doctor review them?' },
];

export default function SecureMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [manager, setManager] = useState<Manager | null>(null);
  const [patientUserId, setPatientUserId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();
        if (data.success && data.data?.user) {
          setPatientUserId(data.data.user.id);
        }
      } catch (err) {
        console.error('Failed to resolve patient identity', err);
      }
    };
    fetchMe();
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/patient/messages');
      const data = await res.json();
      if (data.success && data.data) {
        setMessages(data.data.messages || []);
        setManager(data.data.manager || null);
      }
    } catch (err) {
      console.error('Failed to load message history', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchMessages();
    });
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchMessages();
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!inputMessage.trim()) return;
    if (!manager) {
      setErrorMsg('No coordinator assigned yet. You cannot send messages.');
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
        fetchMessages();
      } else {
        setErrorMsg(data.error?.message || 'Failed to dispatch message.');
      }
    } catch {
      setErrorMsg('Network error dispatching message.');
    } finally {
      setIsSending(false);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach((msg) => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString(undefined, {
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Connecting to secure medical feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-120px)] flex flex-col px-4 py-2 animate-fade-in">
      <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative rounded-2xl border border-surface-200 shadow-sm bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between gap-4 shrink-0 bg-white shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-100 text-primary-800 border border-primary-200 flex items-center justify-center font-bold text-base shadow-xs">
                {manager ? manager.fullName.charAt(0) : '?'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  manager ? 'bg-success-500' : 'bg-surface-300'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-surface-900 truncate">
                  {manager ? manager.fullName : 'Awaiting Case Coordinator'}
                </h2>
                {manager && (
                  <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-bold rounded-md border border-primary-100">
                    Assigned
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 truncate mt-0.5">
                {manager
                  ? `Clinical Coordinator • ${manager.email}`
                  : 'Messages will connect here once a coordinator is assigned to your case.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-surface-100 border border-surface-200 px-3 py-1.5 rounded-xl text-[11px] font-medium text-surface-600">
              <Lock className="w-3.5 h-3.5 text-success-600" />
              <span>HIPAA Encrypted Channel</span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              className={`p-2 rounded-xl border border-surface-200 text-surface-600 hover:text-surface-900 hover:bg-surface-50 transition-all ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh Message Feed"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Feed */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-50/60"
        >
          {groupedMessages.map((group) => (
            <div key={group.date} className="space-y-4">
              <div className="flex items-center justify-center my-2">
                <span className="px-3 py-1 bg-white border border-surface-200 text-surface-500 rounded-full text-[10px] font-bold shadow-2xs">
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
                      <div className="w-7 h-7 rounded-xl bg-primary-100 text-primary-800 font-bold text-[10px] flex items-center justify-center shrink-0 mb-1 border border-primary-200">
                        {manager ? manager.fullName.charAt(0) : 'C'}
                      </div>
                    )}

                    <div
                      className={`
                        max-w-[80%] sm:max-w-[70%] p-4 text-xs leading-relaxed shadow-xs transition-all
                        ${
                          isMe
                            ? 'bg-primary-600 text-white rounded-2xl rounded-br-xs shadow-xs'
                            : 'bg-white border border-surface-200 text-surface-900 rounded-2xl rounded-bl-xs shadow-xs'
                        }
                      `}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>

                      <div
                        className={`
                          flex items-center justify-end gap-1 text-[9px] mt-2 font-medium
                          ${isMe ? 'text-primary-100' : 'text-surface-400'}
                        `}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-primary-200" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-surface-200 shadow-xs flex items-center justify-center text-primary-600">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-surface-900">Secure Direct Message Channel</h3>
              <p className="text-xs text-surface-500 max-w-sm">
                Send a coordination request regarding your medical itinerary, doctor consultation schedule, or hostel booking.
              </p>
            </div>
          )}
        </div>

        {/* Footer Prompt Chips & Input */}
        <div className="p-4 border-t border-surface-100 bg-white shrink-0 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 shrink-0">Quick Prompts:</span>
            {QUICK_PROMPTS.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInputMessage(item.prompt)}
                  disabled={!manager}
                  className="px-3 py-1.5 bg-surface-100 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 border border-surface-200 rounded-xl text-xs font-semibold text-surface-700 whitespace-nowrap transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconComponent className="w-3.5 h-3.5 text-primary-600" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSend} className="space-y-2">
            {errorMsg && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  manager
                    ? 'Write a coordination request or medical inquiry...'
                    : 'Awaiting case coordinator assignment...'
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={!manager || isSending}
                className="flex-1 min-h-[46px] px-4 bg-surface-50 border border-surface-300 rounded-xl text-xs text-surface-900 font-medium focus:outline-none focus:border-primary-600 focus:bg-white transition-all disabled:bg-surface-100 disabled:cursor-not-allowed"
              />
              <Button
                type="submit"
                isLoading={isSending}
                disabled={!manager || !inputMessage.trim()}
                size="md"
              >
                <Send className="w-4 h-4 mr-1" /> Send
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
