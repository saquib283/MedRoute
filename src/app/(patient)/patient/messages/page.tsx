'use client';

/**
 * MediRoute India — Secure Messaging page
 * Chat-style secure communication with the assigned Case Coordinator.
 */

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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

export default function SecureMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [manager, setManager] = useState<Manager | null>(null);
  const [patientUserId, setPatientUserId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine the current patient's User ID to orient message bubbles (left vs. right)
    const fetchMe = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/v1/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success && data.data?.user) {
          setPatientUserId(data.data.user.id);
        }
      } catch (err) {
        console.error('Failed to resolve current patient ID', err);
      }
    };

    fetchMe();
    fetchMessages();

    // Auto poll every 10 seconds for messaging convenience
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/patient/messages', { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setMessages(data.data.messages || []);
        setManager(data.data.manager || null);
      }
    } catch (err) {
      console.error('Failed to load message history', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!inputMessage.trim()) return;
    if (!manager) {
      setErrorMsg('No coordinator assigned yet. You cannot send messages.');
      return;
    }

    setIsSending(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/patient/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: inputMessage }),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Connecting to secure medical feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Messages layout wrapper */}
      <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative">
        {/* Manager Header Details */}
        <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-3 shrink-0 bg-white">
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
            {manager ? manager.fullName.charAt(0) : '?'}
          </div>
          <div>
            <h2 className="text-sm font-bold text-surface-900">
              {manager ? manager.fullName : 'Awaiting coordinator assignment'}
            </h2>
            <p className="text-[10px] text-surface-500 mt-0.5">
              {manager ? `Assigned Coordinator (${manager.email})` : 'Messages will connect here once assigned.'}
            </p>
          </div>
        </div>

        {/* Message Feed Area */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-50/50"
        >
          {messages.map((msg) => {
            const isMe = msg.senderId === patientUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[70%] rounded-lg p-3 text-xs leading-relaxed border shadow-xs
                    ${
                      isMe
                        ? 'bg-primary-600 border-primary-700 text-white'
                        : 'bg-white border-surface-200 text-surface-800'
                    }
                  `}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <span
                    className={`
                      text-[9px] block text-right mt-1.5 font-medium
                      ${isMe ? 'text-primary-100' : 'text-surface-400'}
                    `}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg className="w-12 h-12 text-surface-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <h3 className="text-xs font-semibold text-surface-700">No Messages Yet</h3>
              <p className="text-[11px] text-surface-400 mt-1 max-w-[280px]">
                Ask questions regarding clinical schedule, accommodation options, or medical visa status.
              </p>
            </div>
          )}
        </div>

        {/* Message Input Controls */}
        <div className="p-4 border-t border-surface-100 bg-white shrink-0">
          <form onSubmit={handleSend} className="space-y-3">
            {errorMsg && (
              <p className="text-[11px] text-danger-600 font-semibold">{errorMsg}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={manager ? "Write a coordination request..." : "No coordinator assigned"}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={!manager || isSending}
                className="flex-1 min-h-[44px] px-4 border border-surface-200 rounded-md text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white disabled:bg-surface-50 disabled:cursor-not-allowed"
              />
              <Button type="submit" isLoading={isSending} disabled={!manager || !inputMessage.trim()}>
                Send Message
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
