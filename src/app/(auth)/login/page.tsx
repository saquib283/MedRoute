'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  User,
  Briefcase,
  Shield,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Patient', email: 'patient@mediroute.in', pass: 'Patient@123', icon: User },
  { role: 'Manager', email: 'manager@mediroute.in', pass: 'Manager@123', icon: Briefcase },
  { role: 'Hospital IPS', email: 'fortis.ips@mediroute.in', pass: 'Hospital@123', icon: Building2 },
  { role: 'Admin', email: 'admin@mediroute.in', pass: 'Admin@123', icon: Shield },
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
  const [isFetchingSecret, setIsFetchingSecret] = useState(false);
  const [copied, setCopied] = useState(false);

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
        setError(data.error?.message || 'Invalid email or password.');
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
        case 'MANAGER':
          router.push('/manager/dashboard');
          break;
        case 'HOSPITAL':
          router.push('/hospital/dashboard');
          break;
        case 'DOCTOR':
          setError('Doctor portal login has been disabled.');
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
      queueMicrotask(() => fetch2FASecret());
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
        case 'PATIENT':
          router.push('/patient/dashboard');
          break;
        case 'MANAGER':
          router.push('/manager/dashboard');
          break;
        case 'HOSPITAL':
          router.push('/hospital/dashboard');
          break;
        case 'DOCTOR':
          setError('Doctor portal login has been disabled.');
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
    <div className="space-y-6">
      {/* STEP 1: Credentials */}
      {step === 'credentials' && (
        <>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Sign in</h1>
            <p className="text-sm text-surface-600">
              Access patient cases, schedules, and clinical records.
            </p>
          </div>

          {/* Quick Demo Credentials Selector */}
          <div className="space-y-2 bg-surface-100 p-3 rounded-xl border border-surface-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 block px-0.5">
              Demo Accounts
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemoAccount(acc.email, acc.pass)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors text-left flex items-center gap-1.5 ${
                      email === acc.email
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-surface-700 hover:bg-surface-50 border-surface-200'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{acc.role}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="name@mediroute.in"
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
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                icon={<Lock className="w-4 h-4 text-surface-400" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-[38px] text-surface-400 hover:text-surface-700 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-surface-600">
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
                className="font-bold text-primary-600 hover:text-primary-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Sign In
            </Button>
          </form>
        </>
      )}

      {/* STEP 2: 2FA TOTP Verification */}
      {step === '2fa' && (
        <div className="space-y-6 animate-fade-in text-center">
          <div className="w-12 h-12 bg-primary-50 border border-primary-200 rounded-xl flex items-center justify-center mx-auto text-primary-700">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-surface-900 tracking-tight">Two-Factor Authentication</h1>
            <p className="text-sm text-surface-600 mt-1">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <form onSubmit={handle2FAVerify} className="space-y-4">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-surface-700 text-center">6-Digit Code</label>
              <input
                type="text"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="w-full h-12 text-center text-2xl font-mono tracking-[0.5em] font-bold bg-surface-50 border border-surface-300 rounded-lg focus:border-primary-600 focus:bg-white transition-colors"
                maxLength={6}
              />
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Verify &amp; Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setError('');
                setTotpCode('');
              }}
              className="text-xs font-semibold text-surface-500 hover:text-surface-900 transition-colors pt-2 mx-auto flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: 2FA Setup Form */}
      {step === '2fa-setup' && (
        <div className="space-y-6 animate-fade-in text-center">
          <div className="w-12 h-12 bg-warning-50 border border-warning-200 rounded-xl flex items-center justify-center mx-auto text-warning-700">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-surface-900 tracking-tight">Set Up Two-Factor Authentication</h1>
            <p className="text-sm text-surface-600 mt-1 max-w-xs mx-auto leading-relaxed">
              Required for your role per HIPAA § 164.312(d). Add this key to your authenticator app.
            </p>
          </div>

          {isFetchingSecret ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-surface-600 font-medium">Generating setup key...</p>
            </div>
          ) : (
            <form onSubmit={handle2FAVerify} className="space-y-4 text-left">
              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {totpSecret && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Authenticator Setup Key</label>
                  <div className="bg-surface-50 border border-surface-200 p-3 rounded-lg flex items-center justify-between font-mono text-sm tracking-wider text-surface-800">
                    <span className="select-all break-all pr-2">{totpSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors shrink-0"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-surface-700 text-center">6-Digit Verification Code</label>
                <input
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="w-full h-12 text-center text-2xl font-mono tracking-[0.5em] font-bold bg-surface-50 border border-surface-300 rounded-lg focus:border-primary-600 focus:bg-white transition-colors"
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
                className="text-xs font-semibold text-surface-500 hover:text-surface-900 transition-colors pt-2 mx-auto flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
