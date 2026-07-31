'use client';

/**
 * Afzal Healthcare — Forgot Password Page
 * OTP-based password reset flow.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
    <div>
      {step === 'email' && (
        <>
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-surface-900">Reset your password</h2>
            <p className="text-sm text-surface-500 mt-1.5">
              Enter your email and we&apos;ll send you a verification code
            </p>
          </div>

          <form onSubmit={handleRequestOTP} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 text-sm text-danger-700 animate-slide-down">
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
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-surface-900">Enter code & new password</h2>
            <p className="text-sm text-surface-500 mt-1.5">
              We sent a 6-digit code to <span className="text-surface-700 font-medium">{email}</span>
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            <Input
              label="Verification Code"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="text-center text-xl tracking-[0.4em] font-mono"
            />

            <Input
              label="New Password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              helperText="Must include uppercase, lowercase, number, and special character"
            />

            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 text-sm text-danger-700 animate-slide-down">
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
        <div className="text-center">
          <div className="w-12 h-12 bg-success-50 border border-success-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-1">Password Reset!</h2>
          <p className="text-sm text-surface-500 mb-6">
            Your password has been successfully updated.
          </p>
          <Link href="/login">
            <Button fullWidth size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
