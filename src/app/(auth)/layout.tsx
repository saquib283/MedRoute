import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import logoImg from '../../../public/assets/logo.png';
import { ShieldCheck, Building2, ClipboardCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign In — MediRoute India',
  description: 'Sign in to your MediRoute India account to manage clinical coordination and care.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-surface-100 font-sans antialiased">
      {/* Left Column — Authentication Form */}
      <div className="w-full lg:w-[54%] xl:w-[50%] flex flex-col justify-between bg-surface-100 px-4 sm:px-10 py-8 min-h-screen">
        <div className="my-auto w-full flex justify-center">
          <div className="w-full max-w-[440px] bg-white border border-surface-200 shadow-xs rounded-lg p-6 sm:p-8">
            <div className="flex items-center justify-between pb-5 mb-6 border-b border-surface-200">
              <Image
                src={logoImg}
                alt="MediRoute India"
                height={30}
                className="h-7 w-auto object-contain"
                priority
              />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 text-surface-600 text-[11px] font-medium border border-surface-200">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                Care &amp; Operations Portal
              </span>
            </div>

            {children}
          </div>
        </div>

        <div className="text-xs text-center text-surface-500 mt-6 space-y-1">
          <p>© 2026 MediRoute India. All rights reserved.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/terms" className="hover:text-primary-700 transition-colors underline">
              Terms &amp; Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-primary-700 transition-colors underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column — Matte Institutional Clinical Summary */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[50%] bg-surface-900 border-l border-surface-800 flex-col justify-between p-12 text-white">
        <div className="flex items-center justify-between border-b border-surface-800 pb-6">
          <Image
            src={logoImg}
            alt="MediRoute India"
            height={28}
            className="h-7 w-auto object-contain brightness-0 invert opacity-95"
            priority
          />
          <span className="text-xs text-surface-400 font-medium">
            International Patient Operations
          </span>
        </div>

        <div className="my-auto max-w-md space-y-6">
          <h1 className="text-2xl xl:text-3xl font-semibold tracking-tight leading-snug text-white">
            Coordinated cross-border clinical care and hospital operations.
          </h1>
          <p className="text-sm text-surface-300 leading-relaxed">
            A unified workspace connecting international patients, case coordinators, and accredited hospital specialists from pre-travel review through discharge.
          </p>

          <div className="space-y-4 pt-2 border-t border-surface-800">
            <div className="flex items-start gap-3 pt-2">
              <div className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-md bg-surface-800 border border-surface-700 text-primary-300 shrink-0">
                <Building2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Accredited Hospital Network</h2>
                <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">
                  Direct scheduling and specialist review across JCI and NABH certified centers.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-md bg-surface-800 border border-surface-700 text-primary-300 shrink-0">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Encrypted Medical Records &amp; 2FA</h2>
                <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">
                  Field-level ePHI protection, role-based access control, and audit logging.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-md bg-surface-800 border border-surface-700 text-primary-300 shrink-0">
                <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Structured Milestone Tracking</h2>
                <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">
                  Clear visibility across visa letters, itemized invoices, recovery stays, and Fit-to-Fly sign-off.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-800 pt-5 text-xs text-surface-400">
          <span>JCI &amp; NABH Partner Network</span>
          <span>HIPAA § 164.312 Compliant</span>
        </div>
      </div>
    </div>
  );
}
