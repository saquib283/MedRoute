'use client';

/**
 * MediRoute India — Patient Privacy, Consent & DSAR Data Portability Hub
 * Implements DPDP Act 2023, HIPAA § 164.524 Right of Access, and GDPR Article 15 DSAR Export.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import {
  ShieldCheck,
  Lock,
  Download,
  ExternalLink,
  Eye,
  Database,
} from 'lucide-react';

interface ConsentRecord {
  id: string;
  verificationCode: string;
  consentType: string;
  statement: string;
  documentHash: string;
  signedAt: string;
  ipAddress: string | null;
}

export default function PatientPrivacyPage() {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchConsents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/legal/consents');
      const d = await res.json();
      if (d.success && d.data?.consents) {
        setConsents(d.data.consents);
      }
    } catch {
      toast.error('Failed to load your privacy consents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchConsents());
  }, [fetchConsents]);

  const handleDownloadDsar = async () => {
    try {
      setDownloading(true);
      toast.success('Generating DSAR export packet...');
      window.location.href = '/api/v1/patient/privacy/export';
    } catch {
      toast.error('Failed to export privacy records');
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Privacy, Consent &amp; Data Export"
        subtitle="Review signed consents and export your records under the DPDP Act 2023 and HIPAA § 164.524"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Privacy & Data' },
        ]}
        actions={
          <Button
            onClick={handleDownloadDsar}
            isLoading={downloading}
            disabled={downloading}
            size="sm"
          >
            <Download className="w-4 h-4" /> Download DSAR Packet
          </Button>
        }
      />

      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary-50 border-primary-200">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-primary-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>DPDP Act 2023 &amp; HIPAA § 164.524 Data Rights</span>
          </div>
          <p className="text-xs text-primary-900 leading-relaxed">
            You have the right to access, rectify, export, or request revocation of consent for your personal and health data. Documents are encrypted with AES-256-GCM.
          </p>
        </div>
      </Card>

      {/* Privacy Safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <Card className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-surface-900">AES-256 Encryption</h3>
          <p className="text-surface-600 leading-relaxed">
            Passport records and sensitive fields are encrypted at rest with per-record initialization vectors.
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-surface-900">Access Audit Trail</h3>
          <p className="text-surface-600 leading-relaxed">
            Clinical views, consultations, and file downloads are recorded in an audit log per HIPAA § 164.312(b).
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-surface-900">Hospital-Scoped Sharing</h3>
          <p className="text-surface-600 leading-relaxed">
            Medical records are shared only with partner hospitals and coordinators assigned to your care.
          </p>
        </Card>
      </div>

      {/* Signed Consent History */}
      <Card className="space-y-4">
        <div className="pb-3 border-b border-surface-200">
          <h2 className="text-base font-semibold text-surface-900">Signed Consents &amp; Proofs</h2>
          <p className="text-xs text-surface-500">
            Electronic authorizations attested during your care journey
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : consents.length === 0 ? (
          <EmptyState
            title="No signed consents on file"
            description="Digital consent records will appear here once signed."
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-surface-200">
            {consents.map((c) => (
              <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-primary-700">{c.verificationCode}</span>
                    <span className="font-semibold text-[11px] uppercase px-2 py-0.5 rounded bg-primary-50 text-primary-800 border border-primary-200">
                      {c.consentType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-surface-700 font-serif">&ldquo;{c.statement}&rdquo;</p>
                  <p className="text-[11px] text-surface-500 font-mono">
                    Signed: {new Date(c.signedAt).toLocaleDateString()} · SHA-256: {c.documentHash.slice(0, 20)}...
                  </p>
                </div>

                <Link href={`/verify/${c.verificationCode}`} target="_blank" className="shrink-0">
                  <Button size="sm" variant="secondary">
                    <ExternalLink className="w-3.5 h-3.5" /> Verify Proof
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* DPO Contact Card */}
      <Card className="bg-surface-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <h3 className="font-semibold text-surface-900 text-sm">Consent Revocation &amp; Privacy Requests</h3>
          <p className="text-surface-600">
            Contact our Data Protection Officer at <a href="mailto:privacy@mediroute.in" className="text-primary-700 underline font-semibold">privacy@mediroute.in</a> or message your assigned coordinator.
          </p>
        </div>
        <Link href="/privacy">
          <Button variant="ghost" size="sm">
            Privacy Policy
          </Button>
        </Link>
      </Card>
    </div>
  );
}
