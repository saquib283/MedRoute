'use client';

/**
 * Afzal Healthcare — Manager Chat Inbox Page
 * Renders list of assigned patient conversation threads with messaging feeds.
 */

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ChatThread {
  patientUserId: string;
  fullName: string;
  email: string;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
}

export default function ChatCenter() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Poll for thread changes and message logs
  useEffect(() => {
    async function loadThreads() {
      try {
        const res = await fetch('/api/v1/manager/chat');
        if (res.ok) {
          const data = await res.json();
          setThreads(data.threads);
        }
      } catch (err) {
        console.error('Failed to load chat threads:', err);
      } finally {
        setLoadingThreads(false);
      }
    }

    loadThreads();
    const interval = setInterval(loadThreads, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll messages for selected thread
  useEffect(() => {
    if (!selectedThread) return;
    const threadId = selectedThread.patientUserId;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/v1/manager/chat?patientUserId=${threadId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }

    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [selectedThread]);

  useEffect(() => {
    lastMessageIdRef.current = null;
  }, [selectedThread?.patientUserId]);

  useEffect(() => {
    const latestId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (latestId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = latestId;
      if (latestId) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  const handleSelectThread = async (t: ChatThread) => {
    lastMessageIdRef.current = null;
    setSelectedThread(t);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/manager/chat?patientUserId=${t.patientUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        
        // Reset unread count locally
        setThreads((prev) =>
          prev.map((thread) => (thread.patientUserId === t.patientUserId ? { ...thread, unreadCount: 0 } : thread))
        );
      }
    } catch (err) {
      console.error('Failed to load thread messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !inputText.trim() || sending) return;

    const bodyText = inputText;
    setInputText('');
    setSending(true);

    try {
      const res = await fetch('/api/v1/manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientUserId: selectedThread.patientUserId,
          body: bodyText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        
        // Update threads list locally
        setThreads((prev) =>
          prev.map((t) =>
            t.patientUserId === selectedThread.patientUserId
              ? { ...t, lastMessage: bodyText, lastMessageTime: new Date().toISOString() }
              : t
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loadingThreads) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-surface-500">Loading chat inbox...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Coordination Chat Center</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Unified secure communications hub to check in and converse with your cohort.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px] items-stretch text-xs">
        {/* Threads Side Panel */}
        <Card className="!p-0 overflow-hidden flex flex-col md:col-span-1">
          <div className="px-4 py-3.5 border-b border-surface-200 bg-surface-50">
            <h2 className="font-semibold text-surface-900 text-sm">Patient Threads</h2>
          </div>
          <div className="divide-y divide-surface-200 flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-surface-500 font-medium">
                No active patient channels.
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.patientUserId}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-4 cursor-pointer transition-colors flex justify-between items-start gap-3 hover:bg-surface-50 ${
                    selectedThread?.patientUserId === thread.patientUserId ? 'bg-primary-50/40' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-surface-900 truncate text-sm">{thread.fullName}</p>
                      {thread.unreadCount > 0 && (
                        <span className="bg-primary-600 text-white font-medium text-[11px] px-1.5 py-0.5 rounded tabular-nums shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 truncate mt-0.5">{thread.email}</p>
                    {thread.lastMessage && (
                      <p className="text-xs text-surface-600 mt-1.5 truncate">
                        {thread.lastMessage}
                      </p>
                    )}
                  </div>
                  {thread.lastMessageTime && (
                    <span className="text-[11px] text-surface-500 whitespace-nowrap tabular-nums">
                      {new Date(thread.lastMessageTime).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Message Feed Display */}
        <Card className="!p-0 flex flex-col md:col-span-2 h-full overflow-hidden">
          {selectedThread ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-100 text-surface-700 border border-surface-200 flex items-center justify-center font-semibold text-xs shrink-0">
                  {selectedThread.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-surface-900 text-sm truncate">{selectedThread.fullName}</h2>
                  <p className="text-xs text-surface-500 truncate">{selectedThread.email}</p>
                </div>
              </div>

              {/* Feed logs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50/30">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-surface-500 font-medium">
                    No conversation history. Send a secure greeting below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId !== selectedThread.patientUserId;
                    return (
                      <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] p-3 rounded-lg border text-xs leading-relaxed ${
                            isSelf
                              ? 'bg-primary-600 text-white border-primary-700'
                              : 'bg-white text-surface-800 border-surface-200'
                          }`}
                        >
                          <p>{msg.body}</p>
                          <p
                            className={`text-[11px] mt-1 text-right block tabular-nums ${
                              isSelf ? 'text-primary-100' : 'text-surface-500'
                            }`}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input section */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-surface-200 bg-white flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder={`Send a secure coordination update to ${selectedThread.fullName}...`}
                  className="flex-1 px-3.5 py-2 rounded-md border border-surface-300 bg-white text-surface-900 focus:outline-none focus:border-primary-600 text-xs"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sending}
                  required
                />
                <Button type="submit" size="sm" disabled={sending || !inputText.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <svg className="w-10 h-10 text-surface-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <h2 className="text-sm font-semibold text-surface-700 mb-1">No Conversation Active</h2>
              <p className="text-xs text-surface-500 max-w-xs mx-auto">
                Select a patient record from the sidebar list to retrieve conversation history and respond to diagnostic inquiries.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
