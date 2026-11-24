'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import {
  validatePassportSixMonthValidity,
  validateRegistrationStepOne,
  type RegistrationStepOneField,
} from '@/lib/validation/lifecycle-schemas';
import {
  User,
  Mail,
  Lock,
  Phone,
  Globe,
  FileText,
  Calendar,
  Languages,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    nationality: '',
    passportNo: '',
    passportExpiry: '',
    dob: '',
    primaryLanguage: '',
    medicalCondition: '',
  });
  const [stepOneErrors, setStepOneErrors] = useState<
    Partial<Record<RegistrationStepOneField, string>>
  >({});
  const [stepTwoErrors, setStepTwoErrors] = useState<{
    nationality?: string;
    passportNo?: string;
    passportExpiry?: string;
    dob?: string;
  }>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdvanceToStepTwo = () => {
    setError('');
    const result = validateRegistrationStepOne({
      fullName: formData.fullName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
    });

    if (!result.ok) {
      setStepOneErrors(result.fieldErrors);
      setError(result.message);
      return;
    }

    setStepOneErrors({});
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleAdvanceToStepTwo();
      return;
    }

    setError('');
    const nextStepTwoErrors: typeof stepTwoErrors = {};
    if (formData.nationality.trim().length < 2) {
      nextStepTwoErrors.nationality = 'Nationality is required';
    }
    if (formData.passportNo.trim().length < 5) {
      nextStepTwoErrors.passportNo = 'Passport number must be at least 5 characters';
    }
    if (!formData.dob || Number.isNaN(Date.parse(formData.dob))) {
      nextStepTwoErrors.dob = 'Enter a valid date of birth';
    }
    const expiryCheck = validatePassportSixMonthValidity(formData.passportExpiry);
    if (!expiryCheck.ok) {
      nextStepTwoErrors.passportExpiry = expiryCheck.message;
    }

    if (Object.keys(nextStepTwoErrors).length > 0) {
      setStepTwoErrors(nextStepTwoErrors);
      setError(
        Object.values(nextStepTwoErrors)[0] || 'Please verify your passport and birth details.'
      );
      return;
    }

    setStepTwoErrors({});
    setIsLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        nationality: formData.nationality.trim(),
        passportNo: formData.passportNo.trim(),
        passportExpiry: formData.passportExpiry.trim() || undefined,
        dob: formData.dob,
        primaryLanguage: formData.primaryLanguage.trim() || undefined,
        medicalCondition: formData.medicalCondition.trim() || undefined,
      };

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        const fieldErrors = data.error?.details
          ? Object.values(data.error.details as Record<string, string[]>)
              .flat()
              .filter(Boolean)
          : [];
        const errMsg =
          fieldErrors[0] ||
          data.error?.message ||
          'Registration failed. Please verify your details.';
        setError(errMsg);
        toast.error(errMsg);
        return;
      }

      toast.success('Account created! Redirecting to your Care Portal...');
      router.push('/patient/dashboard');
    } catch {
      const msg = 'Network error during registration. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-surface-900 tracking-tight">
            Patient registration
          </h2>
          <span className="text-xs font-medium text-surface-500 tabular-nums">
            Step {step} of 2
          </span>
        </div>
        <p className="text-sm font-normal text-surface-500">
          Create your Afzal Healthcare account to begin your medical care inquiry.
        </p>
      </div>

      {/* ─── Clean 2-Step Institutional Progress Indicator ──────────────── */}
      <nav aria-label="Registration steps" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setError('');
            setStep(1);
          }}
          className={`min-h-11 px-3 py-2 rounded-md border text-left flex items-center gap-2 transition-colors ${
            step === 1
              ? 'bg-primary-50 border-primary-600 text-primary-900'
              : 'bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-md text-xs font-semibold tabular-nums flex items-center justify-center shrink-0 ${
              step === 2
                ? 'bg-success-600 text-white'
                : 'bg-primary-600 text-white'
            }`}
          >
            {step === 2 ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : '1'}
          </span>
          <span className="text-xs font-medium truncate">1. Account &amp; Contact</span>
        </button>

        <div
          className={`min-h-11 px-3 py-2 rounded-md border text-left flex items-center gap-2 ${
            step === 2
              ? 'bg-primary-50 border-primary-600 text-primary-900'
              : 'bg-white border-surface-200 text-surface-500'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-md text-xs font-semibold tabular-nums flex items-center justify-center shrink-0 ${
              step === 2
                ? 'bg-primary-600 text-white'
                : 'bg-surface-100 text-surface-500 border border-surface-200'
            }`}
          >
            2
          </span>
          <span className="text-xs font-medium truncate">2. Passport &amp; Inquiry</span>
        </div>
      </nav>

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {error && (
          <div
            role="alert"
            className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down"
          >
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-3.5">
            <Input
              label="Full name (as on passport)"
              type="text"
              placeholder="Sara Ali"
              value={formData.fullName}
              onChange={(e) => {
                setFormData({ ...formData, fullName: e.target.value });
                if (stepOneErrors.fullName) {
                  setStepOneErrors((prev) => ({ ...prev, fullName: undefined }));
                }
              }}
              error={stepOneErrors.fullName}
              required
              autoComplete="name"
              icon={<User className="w-4 h-4 text-surface-400" />}
            />

            <Input
              label="Email address"
              type="email"
              placeholder="patient@example.com"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (stepOneErrors.email) {
                  setStepOneErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              error={stepOneErrors.email}
              required
              autoComplete="email"
              icon={<Mail className="w-4 h-4 text-surface-400" />}
            />

            <Input
              label="Phone / WhatsApp number"
              type="tel"
              placeholder="+96891234567"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (stepOneErrors.phone) {
                  setStepOneErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              error={stepOneErrors.phone}
              helperText="Include country code for coordinator WhatsApp & arrival support"
              autoComplete="tel"
              icon={<Phone className="w-4 h-4 text-surface-400" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Min 8 chars (upper, lower, number, symbol)"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (stepOneErrors.password) {
                  setStepOneErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              error={stepOneErrors.password}
              required
              autoComplete="new-password"
              icon={<Lock className="w-4 h-4 text-surface-400" />}
            />

            <Button
              type="button"
              fullWidth
              size="lg"
              onClick={handleAdvanceToStepTwo}
            >
              <span>Continue to Passport &amp; Inquiry</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Nationality"
                type="text"
                placeholder="Oman"
                value={formData.nationality}
                onChange={(e) => {
                  setFormData({ ...formData, nationality: e.target.value });
                  if (stepTwoErrors.nationality) {
                    setStepTwoErrors((prev) => ({ ...prev, nationality: undefined }));
                  }
                }}
                error={stepTwoErrors.nationality}
                required
                icon={<Globe className="w-4 h-4 text-surface-400" />}
              />

              <Input
                label="Passport number"
                type="text"
                placeholder="OM998877"
                value={formData.passportNo}
                onChange={(e) => {
                  setFormData({ ...formData, passportNo: e.target.value });
                  if (stepTwoErrors.passportNo) {
                    setStepTwoErrors((prev) => ({ ...prev, passportNo: undefined }));
                  }
                }}
                error={stepTwoErrors.passportNo}
                required
                icon={<FileText className="w-4 h-4 text-surface-400" />}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Passport expiry date"
                type="date"
                value={formData.passportExpiry}
                onChange={(e) => {
                  setFormData({ ...formData, passportExpiry: e.target.value });
                  if (stepTwoErrors.passportExpiry) {
                    setStepTwoErrors((prev) => ({ ...prev, passportExpiry: undefined }));
                  }
                }}
                error={stepTwoErrors.passportExpiry}
                helperText="Recommended >= 6 months validity for Medical Visa"
                className="tabular-nums"
                icon={<Calendar className="w-4 h-4 text-surface-400" />}
              />

              <Input
                label="Date of birth"
                type="date"
                value={formData.dob}
                onChange={(e) => {
                  setFormData({ ...formData, dob: e.target.value });
                  if (stepTwoErrors.dob) {
                    setStepTwoErrors((prev) => ({ ...prev, dob: undefined }));
                  }
                }}
                error={stepTwoErrors.dob}
                required
                className="tabular-nums"
                icon={<Calendar className="w-4 h-4 text-surface-400" />}
              />
            </div>

            <Input
              label="Primary language"
              type="text"
              placeholder="Arabic / English"
              value={formData.primaryLanguage}
              onChange={(e) => setFormData({ ...formData, primaryLanguage: e.target.value })}
              icon={<Languages className="w-4 h-4 text-surface-400" />}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="medical-condition"
                className="block text-xs font-medium text-surface-700"
              >
                Medical condition / inquiry notes
              </label>
              <textarea
                id="medical-condition"
                rows={3}
                placeholder="Briefly describe your symptoms, diagnosis, or desired treatment..."
                value={formData.medicalCondition}
                onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-surface-300 hover:border-surface-400 rounded-md text-sm font-normal text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 transition-colors"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                className="sm:w-1/3"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </Button>
              <Button type="submit" isLoading={isLoading} size="lg" className="sm:flex-1">
                Create Patient Account
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-center text-surface-500 pt-1">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Sign in here
          </Link>
        </p>
      </form>
    </div>
  );
}
