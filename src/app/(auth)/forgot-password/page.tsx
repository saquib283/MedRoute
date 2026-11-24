'use client';

/**
 * Afzal Healthcare — Forgot Password Page
 * OTP-based password reset flow.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to send OTP');
        return;
      }

      setStep('otp');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Password reset failed');
        return;
      }

      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {step === 'email' && (
        <>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Reset password</h2>
            <p className="text-sm text-surface-500">
              Enter your account email and we&apos;ll send a 6-digit verification code.
            </p>
          </div>

          <form onSubmit={handleRequestOTP} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-md px-3.5 py-3 text-xs text-danger-800 animate-slide-down">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Send Verification Code
            </Button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Enter verification code</h2>
            <p className="text-sm text-surface-500">
              We sent a 6-digit code to <span className="text-surface-800 font-medium">{email}</span>.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              label="Verification code"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="text-center text-lg tracking-[0.4em] font-mono tabular-nums"
            />

            <Input
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              helperText="Must include uppercase, lowercase, number, and special character"
            />

            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-md px-3.5 py-3 text-xs text-danger-800 animate-slide-down">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Reset Password
            </Button>
          </form>
        </>
      )}

      {step === 'success' && (
        <div className="space-y-4">
          <div className="w-10 h-10 bg-success-50 border border-success-200 rounded-lg flex items-center justify-center text-success-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">Password updated</h2>
            <p className="text-sm text-surface-500">
              Your account password has been reset. You may now sign in with your new credentials.
            </p>
          </div>
          <Link href="/login" className="block pt-1">
            <Button fullWidth size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      )}

      <div className="pt-1 border-t border-surface-100">
        <Link
          href="/login"
          className="min-h-9 inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 hover:text-surface-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
