'use client';

/**
 * MediRoute India — Forgot Password Page
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
      {/* Mobile Logo */}
      <div className="flex items-center gap-3 mb-8 lg:hidden">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-glow">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <span className="text-xl font-bold gradient-text">MediRoute India</span>
      </div>

      {step === 'email' && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Reset your password</h2>
            <p className="text-surface-400 mt-2">
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
              <div className="bg-danger-700/20 border border-danger-700/30 rounded-xl px-4 py-3 text-sm text-danger-500 animate-slide-down">
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
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Enter code & new password</h2>
            <p className="text-surface-400 mt-2">
              We sent a 6-digit code to <span className="text-surface-200">{email}</span>
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
              <div className="bg-danger-700/20 border border-danger-700/30 rounded-xl px-4 py-3 text-sm text-danger-500 animate-slide-down">
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
          <div className="w-16 h-16 bg-success-700/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
          <p className="text-surface-400 mb-8">
            Your password has been successfully updated.
          </p>
          <Link href="/login">
            <Button fullWidth size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
