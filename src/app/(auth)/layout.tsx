import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ClipboardList, Lock } from 'lucide-react';
import logoImg from '../../../public/assets/logo.png';

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
      {/* Left side panel - clinical overview (desktop) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[48%] bg-primary-950 flex-col justify-between p-12 text-white">
        <div>
          <Image
            src={logoImg}
            alt="MediRoute India"
            height={28}
            className="h-7 w-auto object-contain brightness-0 invert"
            priority
          />
        </div>

        <div className="my-auto max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-white">
              Coordinated medical travel and care operations.
            </h1>
            <p className="text-sm text-primary-100/80 leading-relaxed">
              Manage international patient inquiries, clinical reviews, visa documentation, and hospital schedules in one workspace.
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/15">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-md bg-primary-900 border border-primary-800 text-primary-300 shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Hospital &amp; Coordinator Channels</h2>
                <p className="text-xs text-primary-100/75 mt-0.5">
                  Shared case workflows across coordinators, partner hospitals, and clinicians.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-md bg-primary-900 border border-primary-800 text-primary-300 shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">HIPAA &amp; DPDP Access Controls</h2>
                <p className="text-xs text-primary-100/75 mt-0.5">
                  Role-based permissions, encrypted passport records, and two-factor sign-in.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-md bg-primary-900 border border-primary-800 text-primary-300 shrink-0">
                <ClipboardList className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Milestone &amp; Billing Tracking</h2>
                <p className="text-xs text-primary-100/75 mt-0.5">
                  Itemized estimates, e-signed treatment plans, and invoice ledgers through discharge.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/15 pt-5 text-xs text-primary-100/70">
          <span>Partner Hospitals Across India</span>
          <span>Encrypted Portal</span>
        </div>
      </div>

      {/* Right side panel - form container */}
      <div className="w-full lg:w-[55%] xl:w-[52%] flex flex-col justify-between bg-surface-100 p-6 sm:p-12 overflow-y-auto min-h-screen">
        <div className="my-auto w-full flex justify-center">
          <div className="w-full max-w-[460px] bg-white border border-surface-200 shadow-sm rounded-xl p-6 sm:p-9">
            <div className="flex flex-col items-center mb-7">
              <Image
                src={logoImg}
                alt="MediRoute India"
                height={32}
                className="h-8 w-auto object-contain mb-3"
                priority
              />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 text-surface-600 text-xs font-medium border border-surface-200">
                <Lock className="w-3.5 h-3.5 text-primary-700" />
                <span>Encrypted Portal</span>
              </div>
            </div>

            {children}
          </div>
        </div>

        <div className="text-xs text-center text-surface-500 mt-8 space-y-1">
          <p>© 2026 MediRoute India Pvt. Ltd. All rights reserved.</p>
          <div className="flex items-center justify-center gap-3 text-surface-500">
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
    </div>
  );
}
