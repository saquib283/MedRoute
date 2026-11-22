import type { Metadata } from 'next';
import Image from 'next/image';
import logoImg from '../../../public/assets/logo.png';

export const metadata: Metadata = {
  title: 'Sign In — Afzal Healthcare',
  description: 'Sign in to your Afzal Healthcare account to manage your medical tourism journey.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-surface-100 font-sans antialiased">
      {/* Left side panel - Form container (First) */}
      <div className="w-full lg:w-[55%] xl:w-[50%] flex flex-col justify-between bg-surface-100 p-6 sm:p-12 relative overflow-y-auto min-h-screen">
        {/* Subtle background medical grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-primary-600) 1.5px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Center the card container */}
        <div className="my-auto w-full flex justify-center z-10">
          <div className="w-full max-w-[480px] bg-white border border-surface-200 shadow-md rounded-2xl p-6 sm:p-10 animate-fade-in">
            {/* Unified Clinical Logo Header - Modern redesign */}
            <div className="flex flex-col items-center mb-8">
              {/* Capsule Logo Branding */}
              <div className="inline-flex items-center px-5 py-2.5 bg-surface-50 border border-surface-200/80 rounded-full shadow-xs mb-4 hover:bg-surface-100 transition-colors select-none">
                <Image 
                  src={logoImg} 
                  alt="Afzal Logo" 
                  height={32} 
                  className="h-8 w-auto object-contain" 
                  priority 
                />
              </div>

              {/* Secure status pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-wider border border-primary-200">
                <svg className="w-3.5 h-3.5 text-primary-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Operations & Care Portal
              </div>
            </div>

            {children}
          </div>
        </div>

        {/* Mobile-only/Secondary tiny footer */}
        <p className="text-xs text-center text-surface-400 mt-8 z-10">
          © 2026 Afzal Healthcare. All rights reserved.
        </p>
      </div>

      {/* Right side panel - Pitch / Branding panel (Second) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 relative flex-col justify-between p-12 text-white overflow-hidden">
        {/* Glowing background shapes and medical grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-primary-300) 1.5px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-primary-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

        {/* Brand/Branding */}
        <div className="z-10 flex items-center bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/15 w-fit select-none">
          <Image 
            src={logoImg} 
            alt="Afzal Logo" 
            height={28} 
            className="h-7 w-auto object-contain brightness-0 invert" 
            priority 
          />
        </div>

        {/* Main Pitch */}
        <div className="z-10 my-auto max-w-lg space-y-8 animate-slide-up">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
            Bridging Borders, <br />
            <span className="text-primary-300">
              Simplifying Care.
            </span>
          </h1>
          <p className="text-base text-primary-200/80 leading-relaxed font-light">
            Experience India&apos;s most secure and integrated medical tourism portal. Seamlessly manage patient registrations, clinical operations, and hospital networks.
          </p>

          {/* Bullet benefits */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-primary-800/80 border border-primary-700 text-primary-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Direct Clinical Channels</h4>
                <p className="text-xs text-primary-200/60 mt-0.5">Direct communication lines to top accredited medical teams.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-primary-800/80 border border-primary-700 text-primary-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Full HIPAA & 2FA Security</h4>
                <p className="text-xs text-primary-200/60 mt-0.5">End-to-end encrypted file sharing and multi-factor auth validation.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-primary-800/80 border border-primary-700 text-primary-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Operation Transparency</h4>
                <p className="text-xs text-primary-200/60 mt-0.5">Real-time milestones tracking from inquiry to post-op discharge.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <span className="text-xs text-primary-200/50">JCI Accredited • NABH Certified Networks</span>
          <span className="text-xs text-primary-200/50">v1.2.0</span>
        </div>
      </div>
    </div>
  );
}
