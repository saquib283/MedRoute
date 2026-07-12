'use client';

/**
 * MediRoute India — Patient Registration Page
 * Guided onboarding: Personal info → submit (FR-PAT-01).
 * Medical history and document upload happen post-registration.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    nationality: '',
    passportNo: '',
    dob: '',
    primaryLanguage: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          nationality: form.nationality,
          passportNo: form.passportNo,
          dob: form.dob,
          primaryLanguage: form.primaryLanguage || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.error?.details) {
          // Format validation errors
          const messages = Object.values(data.error.details as Record<string, string[]>)
            .flat()
            .join('. ');
          setError(messages);
        } else {
          setError(data.error?.message || 'Registration failed');
        }
        return;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);

      // Redirect to patient dashboard (onboarding continues there)
      router.push('/patient/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-surface-900">Create your account</h2>
        <p className="text-sm text-surface-500 mt-1.5">
          Start your medical tourism journey with us
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="Enter your full name"
          value={form.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          required
          autoComplete="name"
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="+971 50 123 4567"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          autoComplete="tel"
          helperText="Include country code"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nationality"
            type="text"
            placeholder="e.g., UAE"
            value={form.nationality}
            onChange={(e) => updateField('nationality', e.target.value)}
            required
          />
          <Input
            label="Passport Number"
            type="text"
            placeholder="A12345678"
            value={form.passportNo}
            onChange={(e) => updateField('passportNo', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(e) => updateField('dob', e.target.value)}
            required
          />
          <Input
            label="Primary Language"
            type="text"
            placeholder="e.g., Arabic"
            value={form.primaryLanguage}
            onChange={(e) => updateField('primaryLanguage', e.target.value)}
          />
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          required
          autoComplete="new-password"
          helperText="Must include uppercase, lowercase, number, and special character"
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your password"
          value={form.confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 flex items-start gap-2 animate-slide-down">
            <svg className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-danger-700">{error}</span>
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" fullWidth isLoading={isLoading} size="lg">
            Create Account
          </Button>
        </div>

        <p className="text-xs text-surface-500 text-center">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">
            Privacy Policy
          </a>
        </p>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-surface-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
