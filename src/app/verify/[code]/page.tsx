'use client';

/**
 * MediRoute India — Public Digital Certificate of Proof Verification Portal
 * Verifies authenticity of legal consents, treatment plan e-signatures, and cross-border authorizations.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  Printer,
  Globe2,
  Building2,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface VerificationData {
  verificationCode: string;
  isValid: boolean;
  status: string;
  consentType: string;
  signerFullName: string;
  signerEmailMasked: string;
  signerRole: string;
  statement: string;
  documentHash: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddressMasked: string;
  geoCountry: string;
  signedAt: string;
  verifiedAt: string;
  issuer: {
    organization: string;
    jurisdiction: string;
    complianceStandard: string;
    registryUrl: string;
  };
}

export default function VerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then((p) => {
      setCode(p.code);
      fetch(`/api/v1/legal/verify/${p.code}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.verification) {
            setData(json.data.verification);
          } else {
            setError(json.error || 'Certificate not found. Invalid verification code.');
          }
        })
        .catch(() => setError('Error contacting verification registry.'))
        .finally(() => setLoading(false));
    });
  }, [params]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formatConsentType = (type: string) => {
    return type?.replace(/_/g, ' ') || 'LEGAL AGREEMENT';
  };

  return (
    <div className="min-h-screen bg-surface-100 font-sans text-surface-900 pb-16">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-surface-200 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoImg} alt="MediRoute India" height={32} className="h-8 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-50 text-success-700 text-xs font-bold border border-success-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Official Verification Registry</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        {loading ? (
          <Card className="p-12 text-center bg-white border border-surface-200">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-surface-600">Verifying digital certificate authenticity...</p>
            <p className="text-xs text-surface-400 font-mono mt-1">{code}</p>
          </Card>
        ) : error || !data ? (
          <Card className="p-8 text-center bg-white border border-danger-200">
            <div className="w-12 h-12 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-surface-900">Certificate Verification Failed</h2>
            <p className="text-sm text-surface-600 mt-1 max-w-md mx-auto">{error}</p>
            <p className="text-xs text-surface-400 font-mono mt-3">Code: {code}</p>
            <div className="mt-6">
              <Link href="/">
                <Button variant="secondary" size="sm">Return to Home</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Verification Banner Card */}
            <Card className="bg-white border border-success-500 p-6 sm:p-8 rounded-xl shadow-sm space-y-6">
              {/* Certificate Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success-50 text-success-700 text-xs font-semibold border border-success-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                    <span>Verified Record</span>
                  </div>
                  <h1 className="text-2xl font-bold text-surface-900 tracking-tight">
                    Certificate of Digital Proof
                  </h1>
                  <p className="text-xs text-surface-500">
                    Issued under the Information Technology Act (India, § 10A) &amp; HIPAA Security Standards
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block">Verification Code</span>
                  <span className="text-base font-mono font-bold text-primary-700">{data.verificationCode}</span>
                </div>
              </div>

              {/* Certificate Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-surface-50/80 p-4 rounded-xl border border-surface-200/80">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400 block mb-0.5">Authorized Signer</span>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary-600" />
                    <span className="font-bold text-surface-900">{data.signerFullName}</span>
                  </div>
                  <span className="text-xs text-surface-500 pl-6 block font-mono">{data.signerEmailMasked} ({data.signerRole})</span>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400 block mb-0.5">Signing Timestamp</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    <span className="font-bold text-surface-900">
                      {new Date(data.signedAt).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short',
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-surface-500 pl-6 block">IP: {data.ipAddressMasked} ({data.geoCountry})</span>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-surface-200/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400 block mb-0.5">Agreement Type</span>
                  <span className="font-bold text-primary-900 text-xs px-2.5 py-1 rounded bg-primary-50 border border-primary-200/60 inline-block uppercase tracking-wider">
                    {formatConsentType(data.consentType)}
                  </span>
                </div>
              </div>

              {/* Statement Body */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 block">
                  Attested Legal Statement
                </span>
                <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 text-xs sm:text-sm text-surface-700 leading-relaxed font-serif italic">
                  &ldquo;{data.statement}&rdquo;
                </div>
              </div>

              {/* Cryptographic SHA-256 Digest */}
              <div className="space-y-1.5 p-3.5 bg-surface-900 text-surface-100 rounded-xl text-xs">
                <div className="flex items-center justify-between text-surface-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Hash className="w-3.5 h-3.5 text-primary-400" />
                    <span>Cryptographic Document Integrity Digest (SHA-256)</span>
                  </div>
                  <span className="text-[10px] text-success-400 font-bold uppercase">Tamper Evident</span>
                </div>
                <p className="font-mono text-[11px] text-primary-300 break-all select-all pt-1">
                  {data.documentHash}
                </p>
              </div>

              {/* Issuer & Authority Footer */}
              <div className="pt-4 border-t border-surface-200 flex flex-col sm:flex-row items-center justify-between text-xs text-surface-500 gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-surface-400" />
                  <span>{data.issuer.organization} · {data.issuer.jurisdiction}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5 text-surface-400" />
                  <span>Verified at: {new Date(data.verifiedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between print:hidden">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  Back to Portal
                </Button>
              </Link>
              <Button onClick={handlePrint} variant="secondary" size="sm">
                <Printer className="w-4 h-4 mr-2" /> Print Official Certificate
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
