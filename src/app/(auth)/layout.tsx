import type { Metadata } from 'next';

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
    <div className="min-h-screen flex">
      {/* Left Panel — Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-surface-900 to-primary-900" />
        
        {/* Animated geometric shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-soft [animation-delay:1s]" />
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl animate-pulse-soft [animation-delay:2s]" />
        </div>

        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-glow">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text">MediRoute India</span>
          </div>

          {/* Hero text */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Your Gateway to
              <span className="gradient-text block mt-1">World-Class Healthcare</span>
            </h1>
            <p className="text-surface-300 text-lg leading-relaxed">
              Seamlessly coordinate your medical journey to India. From consultation 
              booking to accommodation — all in one platform.
            </p>

            {/* Stats */}
            <div className="flex gap-8 mt-10">
              <div>
                <div className="text-3xl font-bold text-primary-400">500+</div>
                <div className="text-sm text-surface-400 mt-1">Partner Hospitals</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-accent-400">50K+</div>
                <div className="text-sm text-surface-400 mt-1">Patients Served</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary-300">98%</div>
                <div className="text-sm text-surface-400 mt-1">Satisfaction Rate</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-surface-500">
            © 2026 MediRoute India. Trusted by patients worldwide.
          </p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
