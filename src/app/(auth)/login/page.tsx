'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import {
  User,
  Briefcase,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Patient', email: 'patient@afzalhealthcare.in', pass: 'Patient@123', icon: User },
  { role: 'Manager', email: 'manager@afzalhealthcare.in', pass: 'Manager@123', icon: Briefcase },
  { role: 'Admin', email: 'admin@afzalhealthcare.in', pass: 'Admin@123', icon: ShieldCheck },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | '2fa' | '2fa-setup'>('credentials');
  const [totpCode, setTotpCode] = useState('');
  const [tempSessionId, setTempSessionId] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [isFetchingSecret, setIsFetchingSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [reasonNotice, setReasonNotice] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get('reason');
      if (reason === 'maintenance') {
        setReasonNotice(
          'System is currently undergoing scheduled maintenance. Only administrators may sign in at this time.'
        );
      } else if (reason === 'timeout') {
        setReasonNotice(
          'You were automatically signed out due to session inactivity (HIPAA § 164.312). Please sign in again.'
        );
      } else if (reason === 'expired') {
        setReasonNotice('Your session has expired. Please sign in again to continue.');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        const errMsg = data.error?.message || 'Invalid email or password.';
        setError(errMsg);
        toast.apiError(data, 'Invalid email or password.', 'Authentication Failed');
        return;
      }

      if (data.data.requires2FA) {
        setTempSessionId(data.data.tempSessionId);
        setStep('2fa');
        return;
      }

      if (data.data.requires2FASetup) {
        setTempSessionId(data.data.tempSessionId);
        setStep('2fa-setup');
        return;
      }

      const role = data.data.user.role;
      switch (role) {
        case 'PATIENT':
          router.push('/patient/dashboard');
          break;
        case 'DOCTOR':
          router.push('/doctor/dashboard');
          break;
        case 'MANAGER':
          router.push('/manager/dashboard');
          break;
        case 'ADMIN':
          router.push('/admin/dashboard');
          break;
        default:
          router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetch2FASecret = useCallback(async () => {
    setIsFetchingSecret(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempSessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setTotpSecret(data.data.secret);
        setTotpUri(data.data.totpUri || '');
      } else {
        setError(data.error?.message || 'Failed to initialize 2FA secret.');
      }
    } catch {
      setError('Network error initializing 2FA setup.');
    } finally {
      setIsFetchingSecret(false);
    }
  }, [tempSessionId]);

  useEffect(() => {
    if (step === '2fa-setup' && tempSessionId) {
      const timer = setTimeout(() => {
        void fetch2FASecret();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [step, tempSessionId, fetch2FASecret]);

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempSessionId, code: totpCode }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || '2FA verification code is invalid.');
        return;
      }

      const role = data.data.user.role;
      switch (role) {
        case 'MANAGER':
          router.push('/manager/dashboard');
          break;
        case 'DOCTOR':
          router.push('/doctor/dashboard');
          break;
        case 'ADMIN':
          router.push('/admin/dashboard');
          break;
        default:
          router.push('/login');
      }
    } catch {
      setError('Network error during 2FA verification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* STEP 1: Credentials */}
      {step === 'credentials' && (
        <>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Sign in</h2>
            <p className="text-sm text-surface-500">
              Access patient care cases, clinical schedules, and medical records.
            </p>
          </div>

          {/* Demo Role Credentials Selector */}
          <div className="space-y-2 bg-surface-50 p-2.5 sm:p-3 rounded-lg border border-surface-200">
            <span className="text-xs font-medium text-surface-600 block">
              Demo test accounts
            </span>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const IconComponent = acc.icon;
                const isSelected = email === acc.email;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemoAccount(acc.email, acc.pass)}
                    className={`min-h-11 px-1.5 sm:px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center justify-center gap-1 sm:gap-1.5 ${
                      isSelected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-surface-700 hover:bg-surface-100 border-surface-200'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span>{acc.role}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {reasonNotice && (
              <div className="bg-warning-50 border border-warning-200 text-warning-900 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
                <span>{reasonNotice}</span>
              </div>
            )}

            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              placeholder="name@afzalhealthcare.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              icon={<Mail className="w-4 h-4 text-surface-400" />}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                icon={<Lock className="w-4 h-4 text-surface-400" />}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center text-surface-400 hover:text-surface-700 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="min-h-9 inline-flex items-center gap-2 cursor-pointer font-medium text-surface-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 bg-white text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                />
                <span>Keep session active</span>
              </label>
              <Link
                href="/forgot-password"
                className="min-h-9 inline-flex items-center font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Sign In to Care Portal
            </Button>

            <p className="text-xs text-center text-surface-500 pt-1">
              New international patient?{' '}
              <Link href="/register" className="font-medium text-primary-600 hover:text-primary-700 transition-colors">
                Create an account
              </Link>
            </p>

            <div className="bg-surface-50 border border-surface-200 rounded-lg p-3">
              <Link
                href="/inquiry"
                className="min-h-11 flex items-center justify-between gap-2 text-xs font-medium text-surface-700 hover:text-primary-700 transition-colors"
              >
                <span className="leading-relaxed">
                  Exploring treatment options or don&apos;t have your passport yet?{' '}
                  <span className="text-primary-600 font-semibold">
                    Request a Free Medical Opinion &amp; Cost Estimate &rarr;
                  </span>
                </span>
              </Link>
            </div>
          </form>
        </>
      )}

      {/* STEP 2: 2FA TOTP Verification */}
      {step === '2fa' && (
        <div className="space-y-5 animate-fade-in">
          <div className="w-10 h-10 bg-surface-100 border border-surface-200 rounded-lg flex items-center justify-center text-primary-600">
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Two-factor authentication</h2>
            <p className="text-sm text-surface-500 mt-1">
              Enter the 6-digit verification code from your authenticator application.
            </p>
          </div>

          <form onSubmit={handle2FAVerify} className="space-y-4">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="totp-verify-input" className="block text-xs font-medium text-surface-700">
                6-digit verification code
              </label>
              <input
                id="totp-verify-input"
                type="text"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="w-full h-12 text-center text-xl font-mono tracking-[0.4em] font-semibold bg-white border border-surface-300 rounded-md focus:outline-none focus:border-primary-600 transition-colors tabular-nums"
                maxLength={6}
              />
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Verify Code &amp; Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setError('');
                setTotpCode('');
              }}
              className="min-h-9 text-xs font-medium text-surface-600 hover:text-surface-900 transition-colors mx-auto flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to credentials login
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: 2FA Setup Form */}
      {step === '2fa-setup' && (
        <div className="space-y-5 animate-fade-in">
          <div className="w-10 h-10 bg-warning-50 border border-warning-200 rounded-lg flex items-center justify-center text-warning-700">
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Two-factor setup required</h2>
            <p className="text-sm text-surface-500 mt-1 leading-relaxed">
              Per HIPAA § 164.312(d), two-factor authentication is required for your role. Add the secret key below to your authenticator app.
            </p>
          </div>

          {isFetchingSecret ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-surface-500 font-medium">Generating secure 2FA secret...</p>
            </div>
          ) : (
            <form onSubmit={handle2FAVerify} className="space-y-4">
              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down">
                  <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {totpSecret && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-surface-700">2FA secret key</label>
                  <div className="bg-surface-50 border border-surface-200 p-3 rounded-md flex items-center justify-between font-mono text-xs tracking-wider text-surface-800">
                    <span className="select-all break-all pr-2">{totpSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="min-h-8 px-2 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors shrink-0"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {totpUri && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-surface-700">Authenticator setup URI</label>
                  <div className="bg-surface-50 border border-surface-200 p-3 rounded-md flex items-center justify-between gap-2 text-xs">
                    <a
                      href={totpUri}
                      className="font-mono text-primary-600 hover:text-primary-700 underline break-all"
                    >
                      {totpUri}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpUri);
                        setCopiedUri(true);
                        setTimeout(() => setCopiedUri(false), 2000);
                      }}
                      className="min-h-8 px-2 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors shrink-0"
                    >
                      {copiedUri ? 'Copied' : 'Copy URI'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="totp-setup-input" className="block text-xs font-medium text-surface-700">
                  Verify 6-digit code
                </label>
                <input
                  id="totp-setup-input"
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="w-full h-12 text-center text-xl font-mono tracking-[0.4em] font-semibold bg-white border border-surface-300 rounded-md focus:outline-none focus:border-primary-600 transition-colors tabular-nums"
                  maxLength={6}
                />
              </div>

              <Button type="submit" fullWidth isLoading={isLoading} size="lg">
                Verify &amp; Enable 2FA
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError('');
                  setTotpCode('');
                }}
                className="min-h-9 text-xs font-medium text-surface-600 hover:text-surface-900 transition-colors mx-auto flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to sign in
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
