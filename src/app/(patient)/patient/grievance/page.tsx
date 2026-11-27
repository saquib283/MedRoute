'use client';

/**
 * MediRoute India — Patient Grievance & Quality Feedback Portal
 * Implements NABH Medical Value Travel Facilitator (MVTF) Statutory Grievance Redressal.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  Scale,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface GrievanceItem {
  id: string;
  ticketNumber: string;
  category: string;
  severity: string;
  subject: string;
  description: string;
  status: string;
  acknowledgedAt: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  ackRemainingHours: number;
  resRemainingHours: number;
}

export default function PatientGrievancePage() {
  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [category, setCategory] = useState('CLINICAL_COORDINATION');
  const [severity, setSeverity] = useState('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const fetchGrievances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/compliance/grievances');
      const d = await res.json();
      if (d.success && d.data?.grievances) {
        setGrievances(d.data.grievances);
      }
    } catch {
      toast.error('Failed to load your grievances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Please enter subject and description');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/compliance/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          severity,
          subject,
          description,
        }),
      });

      const d = await res.json();
      if (d.success) {
        toast.success(`Grievance registered. Ticket: ${d.data.grievance.ticketNumber}`);
        setSubject('');
        setDescription('');
        fetchGrievances();
      } else {
        toast.error(d.error || 'Failed to submit grievance');
      }
    } catch {
      toast.error('Network error registering grievance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Grievance Redressal & Quality Portal"
        subtitle="Report any clinical, concierge, or billing concerns under the NABH 2nd Edition Patient Rights Framework"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Grievance Redressal' },
        ]}
      />

      {/* Statutory SLA Commitment Card */}
      <div className="p-5 bg-gradient-to-r from-primary-900 to-primary-800 text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-primary-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">NABH Statutory Time-Bound Resolution Standard</h3>
            <p className="text-xs text-primary-200/80 mt-0.5">
              48-hour mandatory acknowledgement · 7-day complete dispute resolution.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 border border-white/20">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span>NABH Certified Facilitator</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Grievance Submission Form */}
        <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" /> Submit New Concern
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-surface-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 outline-none focus:border-primary-500 transition-colors"
              >
                <option value="CLINICAL_COORDINATION">Clinical & Doctor Coordination</option>
                <option value="BILLING_TRANSPARENCY">Billing & Financial Transparency</option>
                <option value="ACCOMMODATION_TRANSPORT">Accommodation & Transfers</option>
                <option value="VISA_DELAYS">Visa & FRRO Support</option>
                <option value="STAFF_CONDUCT">Staff Conduct & Facilitation</option>
                <option value="PRIVACY_DATA">Data Privacy & Medical Records</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-surface-700 mb-1">Urgency Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 outline-none focus:border-primary-500 transition-colors"
              >
                <option value="LOW">Low (General Query / Clarification)</option>
                <option value="MEDIUM">Medium (Service Delay)</option>
                <option value="HIGH">High (Urgent Escalation)</option>
                <option value="CRITICAL">Critical (Clinical Emergency)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-surface-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your concern..."
                className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 outline-none focus:border-primary-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-surface-700 mb-1">Description & Evidence</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Please describe what happened, dates, hospital name, and requested resolution..."
                className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 outline-none focus:border-primary-500 transition-colors resize-none"
                required
              />
            </div>

            <Button type="submit" fullWidth isLoading={submitting} disabled={submitting} size="sm">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Grievance Ticket
            </Button>
          </form>
        </Card>

        {/* Right Column: Active Grievances Table */}
        <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-base font-bold text-surface-900">Your Registered Grievances & SLA Status</h3>

          {loading ? (
            <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : grievances.length === 0 ? (
            <div className="py-16 text-center text-surface-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-success-500" />
              <p className="text-sm font-semibold text-surface-700">No active grievances or complaints filed.</p>
              <p className="text-xs text-surface-400">All services are currently operating smoothly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grievances.map((g) => (
                <div key={g.id} className="p-4 bg-surface-50 rounded-xl border border-surface-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary-700">{g.ticketNumber}</span>
                      <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-primary-100 text-primary-800">
                        {g.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>

                  <p className="font-bold text-surface-900 text-sm">{g.subject}</p>
                  <p className="text-surface-600 leading-relaxed">{g.description}</p>

                  {g.resolutionNotes && (
                    <div className="p-3 bg-success-50 rounded-lg border border-success-200 text-success-900 mt-2">
                      <span className="font-bold block text-[11px]">Official Resolution Summary:</span>
                      <p className="mt-0.5">{g.resolutionNotes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-surface-200/60 flex items-center justify-between text-[11px] text-surface-500">
                    <span>Filed: {new Date(g.createdAt).toLocaleDateString()}</span>
                    <span>
                      {g.acknowledgedAt ? (
                        <span className="text-success-700 font-bold">✓ Acknowledged by Compliance Team</span>
                      ) : (
                        <span className="text-warning-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Awaiting 48h Statutory Ack
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
