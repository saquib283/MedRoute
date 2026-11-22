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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectThread = async (t: ChatThread) => {
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
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading chat inbox...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative text-xs">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Coordination Chat Center</h1>
        <p className="text-sm text-surface-500 mt-1">Unified secure communications hub to check in and converse with your cohort.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px] items-stretch">
        {/* Threads Side Panel */}
        <Card className="bg-white overflow-y-auto border border-surface-200/80 p-0 flex flex-col md:col-span-1">
          <div className="p-4 border-b border-surface-100 bg-surface-50">
            <h3 className="font-bold text-surface-900 text-sm">Patient Threads</h3>
          </div>
          <div className="divide-y divide-surface-100 flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-surface-400 font-medium">
                No active patient channels.
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.patientUserId}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-4 cursor-pointer transition-colors flex justify-between items-start gap-3 hover:bg-surface-50/50 ${
                    selectedThread?.patientUserId === thread.patientUserId ? 'bg-primary-50/30' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-surface-900 truncate">{thread.fullName}</p>
                      {thread.unreadCount > 0 && (
                        <span className="bg-primary-600 text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 truncate mt-0.5">{thread.email}</p>
                    {thread.lastMessage && (
                      <p className="text-xs text-surface-600 mt-2 truncate font-medium">
                        {thread.lastMessage}
                      </p>
                    )}
                  </div>
                  {thread.lastMessageTime && (
                    <span className="text-xs text-surface-500 whitespace-nowrap">
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
        <Card className="bg-white border border-surface-200/80 p-0 flex flex-col md:col-span-2 h-full overflow-hidden">
          {selectedThread ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-surface-100 bg-surface-50 shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedThread.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 text-sm">{selectedThread.fullName}</h3>
                  <p className="text-xs text-surface-500">{selectedThread.email}</p>
                </div>
              </div>

              {/* Feed logs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-surface-50/20">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-surface-400 font-medium">
                    No conversation history. Send a secure greeting below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId !== selectedThread.patientUserId;
                    return (
                      <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] p-3.5 rounded-lg border text-xs leading-relaxed ${
                            isSelf
                              ? 'bg-primary-600 text-white border-primary-700 rounded-br-none'
                              : 'bg-white text-surface-800 border-surface-200 rounded-bl-none font-medium'
                          }`}
                        >
                          <p>{msg.body}</p>
                          <p
                            className={`text-xs mt-1 text-right block ${
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
              <form onSubmit={handleSendMessage} className="p-3 border-t border-surface-100 bg-white flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder={`Send a secure coordination update to ${selectedThread.fullName}...`}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 font-medium text-surface-800 focus:outline-none focus:border-primary-600 text-xs"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sending}
                  required
                />
                <Button type="submit" disabled={sending || !inputText.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <svg className="w-12 h-12 text-surface-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <h3 className="text-sm font-semibold text-surface-700 mb-1">No Conversation Active</h3>
              <p className="text-xs text-surface-400 max-w-xs mx-auto">
                Select a patient record from the sidebar list to retrieve conversation history and respond to diagnostic inquiries.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
