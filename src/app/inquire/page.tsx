'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import logoImg from '../../../public/assets/logo.png';
import {
  Shield,
  Globe,
  Phone,
  Mail,
  User,
  MapPin,
  Stethoscope,
  Send,
  CheckCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  Building2,
  IndianRupee,
  MessageSquare,
} from 'lucide-react';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import { getCountryForNationality } from '@/lib/currency/currencies';

const INDIAN_CITIES = [
  'New Delhi',
  'Mumbai',
  'Chennai',
  'Bengaluru',
  'Hyderabad',
  'Kolkata',
  'Pune',
  'Gurugram',
  'Ahmedabad',
  'Jaipur',
];

const SOURCE_OPTIONS = [
  { value: 'google_ads', label: 'Google Search' },
  { value: 'facebook', label: 'Social Media (Facebook/Instagram)' },
  { value: 'referral', label: 'Friend or Family Referral' },
  { value: 'hospital_referral', label: 'Hospital / Doctor Referral' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'news', label: 'News / Article' },
  { value: 'other', label: 'Other' },
];

const COORDINATION_PILLARS = [
  { icon: Building2, value: 'JCI & NABH', label: 'Accredited Partner Hospitals' },
  { icon: Clock, value: '24 Hours', label: 'Coordinator Response Target' },
  { icon: Shield, value: 'HIPAA & DPDP', label: 'Encrypted Record Handling' },
  { icon: Globe, value: 'Multi-Currency', label: 'Itemized Treatment Estimates' },
];

const FEATURES = [
  {
    icon: Shield,
    title: 'Accredited Partner Hospitals',
    desc: 'Referrals are routed only to participating JCI and NABH accredited Indian healthcare facilities.',
  },
  {
    icon: Clock,
    title: '24-Hour Coordinator Review',
    desc: 'Assigned medical coordinators contact you within 24 hours of receiving your inquiry.',
  },
  {
    icon: Building2,
    title: 'Visa & Logistics Support',
    desc: 'Assistance with Hospital Visa Invitation Letters, airport transfers, and medical stays.',
  },
  {
    icon: IndianRupee,
    title: 'Transparent Estimates',
    desc: 'Receive itemized pre-travel treatment estimates viewed in your local currency.',
  },
];

export default function InquirePage() {
  const { format, currentCurrency, setCountry } = useCurrency();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationality: '',
    city: '',
    medicalCondition: '',
    preferredHospitalCity: '',
    estimatedBudget: '',
    source: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState('');

  // Read UTM source from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('source') || params.get('utm_source');
    if (utmSource) {
      queueMicrotask(() => {
        setFormData((prev) => ({ ...prev, source: utmSource }));
      });
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');

    // If nationality changed, auto-suggest country and currency
    if (name === 'nationality' && value.length >= 3) {
      const matched = getCountryForNationality(value);
      if (matched) {
        setCountry(matched.code);
      }
    }
  };

  // Dynamic budget ranges in active currency
  const dynamicBudgetRanges = [
    `Under ${format(200000)}`,
    `${format(200000)} – ${format(500000)}`,
    `${format(500000)} – ${format(1000000)}`,
    `${format(1000000)} – ${format(2500000)}`,
    `${format(2500000)}+`,
    'Need cost estimate',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Something went wrong. Please try again.');
        return;
      }

      setReferenceId(data.data.referenceId);
      setSubmitted(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-100 font-sans antialiased">
      {/* ── Sticky Navigation Bar ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoImg} alt="MediRoute India" height={32} className="h-8 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            <CurrencySelector variant="header" />
            <a
              href="tel:+911234567890"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-surface-700 hover:text-primary-700 transition-colors"
            >
              <Phone className="w-4 h-4" />
              +91 123 456 7890
            </a>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="bg-primary-950 text-white border-b border-primary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 border border-white/15 text-xs font-semibold text-primary-100 mb-5">
              <Shield className="w-3.5 h-3.5 text-primary-300" />
              International Patient Facilitation Desk
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Medical Treatment Coordination in India
            </h1>

            <p className="mt-4 text-base sm:text-lg text-primary-100/85 max-w-2xl leading-relaxed">
              Request a clinical review and itemized treatment estimate from participating JCI and NABH accredited Indian hospitals.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#inquiry-form"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-primary-950 font-semibold rounded-lg hover:bg-primary-50 transition-colors text-sm sm:text-base"
              >
                Request Treatment Estimate
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="tel:+911234567890"
                className="inline-flex items-center gap-2 px-5 py-3 bg-primary-900 border border-white/20 text-white font-semibold rounded-lg hover:bg-primary-800 transition-colors text-sm sm:text-base"
              >
                <Phone className="w-4 h-4" />
                Call Desk
              </a>
            </div>
          </div>
        </div>

        {/* Coordination Summary Bar */}
        <div className="border-t border-white/15 bg-primary-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {COORDINATION_PILLARS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary-200" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{item.value}</div>
                      <div className="text-xs text-primary-100/75">{item.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Care Process Highlights ───────────────────────────────────── */}
      <section className="py-14 bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-surface-900 tracking-tight">
              What MediRoute Coordinates
            </h2>
            <p className="mt-1.5 text-sm text-surface-600 max-w-xl">
              Structured support from remote medical evaluation through hospital discharge and follow-up.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-surface-50 border border-surface-200 rounded-xl p-5"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center mb-3.5">
                    <Icon className="w-5 h-5 text-primary-700" />
                  </div>
                  <h3 className="font-semibold text-surface-900 text-sm">{feat.title}</h3>
                  <p className="mt-1.5 text-xs text-surface-600 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Inquiry Form Section ──────────────────────────────────────── */}
      <section id="inquiry-form" className="py-14 sm:py-16 bg-surface-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-12">
            {/* Left column — summary */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-200 mb-3">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Initial Inquiry
                </span>
                <h2 className="text-2xl font-bold text-surface-900 tracking-tight">
                  Share Your Treatment Requirements
                </h2>
                <p className="mt-2.5 text-sm text-surface-600 leading-relaxed">
                  Complete this form and an assigned coordinator will contact you within 24 hours with hospital options, clinical review steps, and an itemized cost estimate.
                </p>
              </div>

              {/* Process steps */}
              <div className="space-y-4">
                {[
                  { step: 1, title: 'Submit Your Inquiry', desc: 'Share your clinical needs and preferred destination.' },
                  { step: 2, title: 'Hospital Review', desc: 'Partner specialists review your uploaded reports.' },
                  { step: 3, title: 'Treatment Estimate', desc: 'Receive a structured care plan and fee breakdown.' },
                  { step: 4, title: 'Travel Coordination', desc: 'Visa letter, stay arrangements, and hospital scheduling.' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-surface-900">{item.title}</h3>
                      <p className="text-xs text-surface-600 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contact card */}
              <div className="bg-white border border-surface-200 rounded-2xl p-5 space-y-3 mt-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-surface-500">
                  Prefer to talk directly?
                </h4>
                <a
                  href="tel:+911234567890"
                  className="flex items-center gap-2.5 text-sm font-semibold text-surface-800 hover:text-primary-700 transition-colors"
                >
                  <Phone className="w-4 h-4 text-primary-600" />
                  +91 123 456 7890
                </a>
                <a
                  href="mailto:care@mediroute.in"
                  className="flex items-center gap-2.5 text-sm font-semibold text-surface-800 hover:text-primary-700 transition-colors"
                >
                  <Mail className="w-4 h-4 text-primary-600" />
                  care@mediroute.in
                </a>
              </div>
            </div>

            {/* Right column — form */}
            <div className="lg:col-span-3">
              {submitted ? (
                /* ── Success State ──────────────────────────────────────── */
                <div className="bg-white border border-surface-200 rounded-2xl p-8 sm:p-10 text-center space-y-5 animate-fade-in shadow-sm">
                  <div className="w-16 h-16 bg-success-50 border border-success-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-success-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-surface-900">
                      Inquiry Submitted Successfully!
                    </h3>
                    <p className="mt-2 text-sm text-surface-600 leading-relaxed max-w-md mx-auto">
                      Thank you for reaching out. Our medical coordinator will review your case
                      and contact you within <strong>24 hours</strong>.
                    </p>
                  </div>
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 inline-block">
                    <span className="text-xs font-bold text-surface-500 block">Reference ID</span>
                    <span className="text-sm font-mono font-extrabold text-surface-900 mt-0.5 block">
                      {referenceId}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500">
                    Save this reference ID for future correspondence.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors text-sm"
                  >
                    Return to Home
                  </Link>
                </div>
              ) : (
                /* ── Inquiry Form ──────────────────────────────────────── */
                <form
                  onSubmit={handleSubmit}
                  className="bg-white border border-surface-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 pb-3 border-b border-surface-200">
                    <Stethoscope className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-extrabold text-surface-900">
                      Medical Inquiry Form
                    </h3>
                  </div>

                  {error && (
                    <div className="bg-danger-50 border border-danger-200 text-danger-700 p-3 rounded-xl text-xs font-medium animate-slide-down">
                      {error}
                    </div>
                  )}

                  {/* Personal Details */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      label="Full Name"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Your full name"
                      icon={<User className="w-4 h-4" />}
                      required
                    />
                    <FormField
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      icon={<Mail className="w-4 h-4" />}
                      required
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      label="Phone Number"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 234 567 8900"
                      icon={<Phone className="w-4 h-4" />}
                      required
                    />
                    <FormField
                      label="Nationality"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      placeholder="e.g., United States"
                      icon={<Globe className="w-4 h-4" />}
                      required
                    />
                  </div>

                  {/* Medical Details */}
                  <div>
                    <label className="block text-xs font-bold text-surface-700 mb-1.5">
                      Medical Condition / Treatment Sought <span className="text-danger-500">*</span>
                    </label>
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-3 w-4 h-4 text-surface-400" />
                      <textarea
                        name="medicalCondition"
                        value={formData.medicalCondition}
                        onChange={handleChange}
                        required
                        rows={3}
                        placeholder="Describe your condition, diagnosis, or the treatment you're seeking..."
                        className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormSelect
                      label="Preferred City in India"
                      name="preferredHospitalCity"
                      value={formData.preferredHospitalCity}
                      onChange={handleChange}
                      icon={<MapPin className="w-4 h-4" />}
                      options={INDIAN_CITIES.map((c) => ({ value: c, label: c }))}
                      placeholder="Select city"
                    />
                    <FormSelect
                      label="Estimated Budget"
                      name="estimatedBudget"
                      value={formData.estimatedBudget}
                      onChange={handleChange}
                      icon={<IndianRupee className="w-4 h-4" />}
                      options={dynamicBudgetRanges.map((b) => ({ value: b, label: b }))}
                      placeholder={`Select range (${currentCurrency})`}
                    />
                  </div>

                  <FormSelect
                    label="How did you hear about us?"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    icon={<Globe className="w-4 h-4" />}
                    options={SOURCE_OPTIONS}
                    placeholder="Select source"
                  />

                  {/* Additional message */}
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                      Additional Message <span className="text-surface-400">(optional)</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Any additional details, questions, or preferred dates..."
                      className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-lg text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-600 focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm shadow-xs"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Medical Inquiry
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-surface-500 text-center leading-relaxed">
                    By submitting this form, you agree to our{' '}
                    <Link href="/terms" className="text-primary-600 font-semibold underline hover:text-primary-700">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-primary-600 font-semibold underline hover:text-primary-700">
                      Privacy Policy
                    </Link>
                    . Your medical data is encrypted (AES-256) and used strictly to coordinate hospital care.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-surface-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src={logoImg} alt="MediRoute" height={24} className="h-6 w-auto brightness-0 invert" />
              <span className="text-xs text-surface-400">
                © 2026 MediRoute India Pvt. Ltd. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-surface-400">
              <Link href="/terms" className="hover:text-white transition-colors underline">
                Terms of Service
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-white transition-colors underline">
                Privacy Policy
              </Link>
              <span>•</span>
              <span>JCI Accredited Networks</span>
              <span>•</span>
              <span>HIPAA Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable Form Components ─────────────────────────────────────── */

function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-700 mb-1.5">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-surface-50 border border-surface-300 rounded-lg text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-600 focus:bg-white transition-colors`}
        />
      </div>
    </div>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  icon,
  options,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-700 mb-1.5">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
            {icon}
          </span>
        )}
        <select
          name={name}
          value={value}
          onChange={onChange}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-10 py-2.5 bg-surface-50 border border-surface-300 rounded-lg text-sm text-surface-900 focus:border-primary-600 focus:bg-white transition-colors appearance-none`}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
      </div>
    </div>
  );
}
