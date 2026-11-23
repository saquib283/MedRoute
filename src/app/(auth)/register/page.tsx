'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
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
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    nationality: '',
    passportNo: '',
    dob: '',
    primaryLanguage: '',
    medicalCondition: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        nationality: formData.nationality.trim(),
        passportNo: formData.passportNo.trim(),
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
        const errMsg = fieldErrors[0] || data.error?.message || 'Registration failed. Please verify your details.';
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
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-surface-900 tracking-tight">Patient Registration</h2>
        <p className="text-xs text-surface-500">
          Create your Afzal Healthcare account to start your medical care inquiry.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-slide-down">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Full Name"
          type="text"
          placeholder="Sara Ali"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          required
          autoComplete="name"
          icon={<User className="w-4 h-4 text-surface-400" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Email Address"
            type="email"
            placeholder="patient@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            autoComplete="email"
            icon={<Mail className="w-4 h-4 text-surface-400" />}
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="+96891234567"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            autoComplete="tel"
            icon={<Phone className="w-4 h-4 text-surface-400" />}
          />
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="Min 8 chars (upper, lower, number, symbol)"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          autoComplete="new-password"
          icon={<Lock className="w-4 h-4 text-surface-400" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Nationality"
            type="text"
            placeholder="Oman"
            value={formData.nationality}
            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
            required
            icon={<Globe className="w-4 h-4 text-surface-400" />}
          />

          <Input
            label="Passport Number"
            type="text"
            placeholder="OM998877"
            value={formData.passportNo}
            onChange={(e) => setFormData({ ...formData, passportNo: e.target.value })}
            required
            icon={<FileText className="w-4 h-4 text-surface-400" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Date of Birth"
            type="date"
            value={formData.dob}
            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            required
            icon={<Calendar className="w-4 h-4 text-surface-400" />}
          />

          <Input
            label="Primary Language"
            type="text"
            placeholder="Arabic / English"
            value={formData.primaryLanguage}
            onChange={(e) => setFormData({ ...formData, primaryLanguage: e.target.value })}
            icon={<Languages className="w-4 h-4 text-surface-400" />}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="medical-condition" className="block text-sm font-medium text-surface-700">
            Medical Condition / Inquiry Notes
          </label>
          <textarea
            id="medical-condition"
            rows={3}
            placeholder="Briefly describe your symptoms, diagnosis, or desired treatment..."
            value={formData.medicalCondition}
            onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-surface-200 hover:border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-primary-600 transition-colors"
          />
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} size="lg">
          Create Patient Account
        </Button>

        <p className="text-xs text-center text-surface-500 pt-1">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
            Sign in here
          </Link>
        </p>
      </form>
    </div>
  );
}
