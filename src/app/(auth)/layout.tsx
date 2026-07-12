import type { Metadata } from 'next';
import Image from 'next/image';
import logoImg from '../../../public/assets/logo.png';
export const metadata: Metadata = {
  title: 'Sign In — MediRoute India',
  description: 'Sign in to your MediRoute India account to manage your medical tourism journey.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-100 p-4 sm:p-6 lg:p-8 relative">
      {/* Subtle background medical grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-primary-600) 1.5px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="w-full max-w-[480px] bg-white border border-surface-200 shadow-sm rounded-lg p-6 sm:p-10 z-10 animate-fade-in">
        {/* Unified Clinical Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-3.5 mb-2.5 h-8">
            <div className="flex items-center h-8">
              <Image 
                src={logoImg} 
                alt="Afzal Logo" 
                height={26} 
                className="w-auto object-contain" 
                priority 
              />
            </div>
            <div className="h-5 w-px bg-surface-200 self-center" />
            <span className="text-xl font-bold text-surface-900 tracking-tight leading-none">MediRoute India</span>
          </div>
          <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">Secure Operations & Care Portal</p>
        </div>

        {children}
      </div>

      {/* Tiny footer at bottom of viewport */}
      <p className="text-xs text-surface-400 mt-6 z-10">
        © 2026 MediRoute India. All rights reserved.
      </p>
    </div>
  );
}
