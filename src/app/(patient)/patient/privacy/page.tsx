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
import { toast } from '@/components/ui/Toast';
import {
  ShieldCheck,
  Lock,
  Download,
  FileCheck2,
  ExternalLink,
  UserCheck,
  Eye,
  Database,
  Mail,
  CheckCircle2,
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
    fetchConsents();
  }, [fetchConsents]);

  const handleDownloadDsar = async () => {
    try {
      setDownloading(true);
      toast.success('Generating cryptographically signed DSAR evidentiary packet...');
      window.location.href = '/api/v1/patient/privacy/export';
    } catch {
      toast.error('Failed to export privacy records');
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Privacy, Consent & Data Portability Hub"
        subtitle="Manage your health data privacy rights, review digital consent proofs, and export your complete medical records packet under DPDP Act 2023 & HIPAA"
        breadcrumbs={[
          { label: 'Patient Portal', href: '/patient/dashboard' },
          { label: 'Privacy & Data Rights' },
        ]}
      />

      {/* Statutory Rights Banner */}
      <div className="p-6 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-bold border border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Digital Personal Data Protection (DPDP) & HIPAA Standards</span>
          </div>
          <h2 className="text-xl font-black text-white">Your Health Data. Your Legal Rights.</h2>
          <p className="text-xs text-primary-200/80 leading-relaxed font-light">
            You hold statutory rights to data access, portability, rectification, and consent revocation. Your files are encrypted using AES-256-GCM and streamed privately without public URLs.
          </p>
        </div>

        <Button
          onClick={handleDownloadDsar}
          isLoading={downloading}
          disabled={downloading}
          className="!bg-emerald-500 hover:!bg-emerald-600 text-white font-bold shrink-0 shadow-lg text-xs"
        >
          <Download className="w-4 h-4 mr-2" /> Download Full DSAR Export Packet
        </Button>
      </div>

      {/* Grid of Privacy Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <Card className="p-5 bg-white border border-surface-200 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
            <Lock className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-surface-900">AES-256 Encryption</h4>
          <p className="text-surface-600 leading-relaxed">
            Passport credentials and sensitive clinical data are encrypted at rest with dedicated cryptographic initialization vectors.
          </p>
        </Card>

        <Card className="p-5 bg-white border border-surface-200 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
            <Eye className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-surface-900">Access Disclosures Trail</h4>
          <p className="text-surface-600 leading-relaxed">
            Every clinical review, doctor consult, and document download is logged with immutable timestamps per HIPAA § 164.312(b).
          </p>
        </Card>

        <Card className="p-5 bg-white border border-surface-200 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
            <Database className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-surface-900">Cross-Border Data Safeguards</h4>
          <p className="text-surface-600 leading-relaxed">
            Health records are shared exclusively with NABH/JCI accredited partner hospitals participating directly in your care.
          </p>
        </Card>
      </div>

      {/* Signed Consent History */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
        <div className="pb-3 border-b border-surface-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-surface-900">Your Active Digital Consents & Proof Receipts</h3>
            <p className="text-xs text-surface-500">
              Verifiable electronic authorizations signed by you during your medical journey.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : consents.length === 0 ? (
          <div className="py-12 text-center text-xs text-surface-400">No signed legal consents on file.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {consents.map((c) => (
              <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary-700">{c.verificationCode}</span>
                    <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-primary-50 text-primary-800 border border-primary-100">
                      {c.consentType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-surface-700 italic font-serif">&ldquo;{c.statement}&rdquo;</p>
                  <p className="text-[11px] text-surface-400 font-mono">
                    Signed: {new Date(c.signedAt).toLocaleDateString()} · SHA-256: {c.documentHash.slice(0, 20)}...
                  </p>
                </div>

                <Link href={`/verify/${c.verificationCode}`} target="_blank" className="shrink-0">
                  <Button size="sm" variant="secondary" className="!text-xs">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View Proof Certificate
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* DPO Contact Card */}
      <Card className="p-6 bg-surface-50 border border-surface-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <h4 className="font-bold text-surface-900 text-sm">Need to revoke consent or modify data?</h4>
          <p className="text-surface-600">
            Contact our designated Data Protection Officer at <a href="mailto:privacy@mediroute.in" className="text-primary-600 underline font-semibold">privacy@mediroute.in</a> or speak directly with your Case Coordinator.
          </p>
        </div>
        <Link href="/privacy">
          <Button variant="ghost" size="sm" className="text-xs">
            Read Full Privacy Policy
          </Button>
        </Link>
      </Card>
    </div>
  );
}
