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
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import {
  Scale,
  Send,
  Clock,
  CheckCircle2,
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
    queueMicrotask(() => fetchGrievances());
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Grievance Redressal"
        subtitle="Submit clinical, coordination, or billing concerns under the NABH 2nd Edition Patient Rights Framework"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Grievance Desk' },
        ]}
      />

      {/* Statutory SLA Notice */}
      <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Scale className="w-5 h-5 text-primary-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-primary-950">Response &amp; Resolution SLA</h2>
            <p className="text-xs text-primary-800 mt-0.5">
              48-hour acknowledgement target and 7-day dispute resolution under NABH MVTF guidelines.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-primary-200 text-primary-800 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-primary-700" />
          <span>Tracked Ticket SLA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Grievance Submission Form */}
        <Card className="space-y-4 lg:col-span-1">
          <h3 className="text-base font-semibold text-surface-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-700" /> Submit New Concern
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-surface-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg text-surface-900 focus:border-primary-600 transition-colors"
              >
                <option value="CLINICAL_COORDINATION">Clinical &amp; Doctor Coordination</option>
                <option value="BILLING_TRANSPARENCY">Billing &amp; Financial Transparency</option>
                <option value="ACCOMMODATION_TRANSPORT">Accommodation &amp; Transfers</option>
                <option value="VISA_DELAYS">Visa &amp; FRRO Support</option>
                <option value="STAFF_CONDUCT">Staff Conduct &amp; Facilitation</option>
                <option value="PRIVACY_DATA">Data Privacy &amp; Medical Records</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg text-surface-900 focus:border-primary-600 transition-colors"
              >
                <option value="LOW">Low (General Query / Clarification)</option>
                <option value="MEDIUM">Medium (Service Delay)</option>
                <option value="HIGH">High (Urgent Escalation)</option>
                <option value="CRITICAL">Critical (Clinical Emergency)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your concern..."
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg text-surface-900 focus:border-primary-600 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what happened, relevant dates, hospital name, and requested resolution..."
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg text-surface-900 focus:border-primary-600 transition-colors resize-none"
                required
              />
            </div>

            <Button type="submit" fullWidth isLoading={submitting} disabled={submitting} size="sm">
              <Send className="w-3.5 h-3.5" /> Submit Ticket
            </Button>
          </form>
        </Card>

        {/* Right Column: Active Grievances Table */}
        <Card className="space-y-4 lg:col-span-2">
          <h3 className="text-base font-semibold text-surface-900">Your Registered Tickets</h3>

          {loading ? (
            <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : grievances.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-success-600" />}
              title="No active grievances"
              description="Submitted tickets and compliance team responses will appear here."
              className="py-10"
            />
          ) : (
            <div className="space-y-3">
              {grievances.map((g) => (
                <div key={g.id} className="p-4 bg-surface-50 rounded-lg border border-surface-200 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-primary-700">{g.ticketNumber}</span>
                      <span className="font-semibold text-[11px] uppercase px-2 py-0.5 rounded bg-primary-50 text-primary-800 border border-primary-200">
                        {g.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>

                  <p className="font-semibold text-surface-900 text-sm">{g.subject}</p>
                  <p className="text-surface-600 leading-relaxed">{g.description}</p>

                  {g.resolutionNotes && (
                    <div className="p-3 bg-success-50 rounded-lg border border-success-200 text-success-900 mt-2">
                      <span className="font-semibold block text-[11px]">Resolution Summary:</span>
                      <p className="mt-0.5">{g.resolutionNotes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-surface-200 flex items-center justify-between text-[11px] text-surface-500">
                    <span>Filed: {new Date(g.createdAt).toLocaleDateString()}</span>
                    <span>
                      {g.acknowledgedAt ? (
                        <span className="text-success-700 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                        </span>
                      ) : (
                        <span className="text-warning-700 font-semibold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Awaiting 48h Acknowledgement
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
