'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import logoImg from '../../../public/assets/logo.png';
import {
  Heart,
  Shield,
  Globe,
  Phone,
  Mail,
  User,
  MapPin,
  Stethoscope,
  Send,
  CheckCircle,
  Star,
  Award,
  Clock,
  ArrowRight,
  ChevronDown,
  Sparkles,
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

const BUDGET_RANGES = [
  'Under ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  '₹5,00,000 – ₹10,00,000',
  '₹10,00,000 – ₹25,00,000',
  '₹25,00,000+',
  'Need cost estimate',
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

const TRUST_STATS = [
  { icon: Heart, value: '15,000+', label: 'Patients Treated' },
  { icon: Building2, value: '50+', label: 'Partner Hospitals' },
  { icon: Globe, value: '45+', label: 'Countries Served' },
  { icon: Star, value: '4.9/5', label: 'Patient Rating' },
];

const FEATURES = [
  {
    icon: Shield,
    title: 'JCI & NABH Accredited',
    desc: 'All partner hospitals meet international healthcare quality standards.',
  },
  {
    icon: Clock,
    title: 'Response within 24 Hours',
    desc: 'Our medical coordinators will contact you within 24 hours of inquiry.',
  },
  {
    icon: Award,
    title: 'End-to-End Care',
    desc: 'From airport pickup to post-treatment follow-up — we manage everything.',
  },
  {
    icon: IndianRupee,
    title: 'Up to 70% Cost Savings',
    desc: 'World-class treatment at a fraction of the cost compared to the US, UK & Europe.',
  },
];

export default function InquirePage() {
  const { format, currentCurrency, setCurrency, setCountry } = useCurrency();
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
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-200/60">
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
              className="px-4 py-2 text-sm font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl border border-primary-200/50 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 text-white">
        {/* Background effects */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1.5px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-[-30%] right-[-15%] w-[60%] h-[80%] rounded-full bg-primary-500/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-500/8 blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            {/* Trust pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold uppercase tracking-widest text-primary-200 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Trusted by 15,000+ International Patients
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1]">
              World-Class Medical{' '}
              <span className="bg-gradient-to-r from-primary-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                Treatment in India
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-primary-200/80 max-w-2xl leading-relaxed font-light">
              Get a free personalised treatment plan from India&apos;s top JCI & NABH accredited
              hospitals. Save up to 70% on medical costs with no compromise on quality.
            </p>

            {/* CTA arrow */}
            <div className="mt-8 flex items-center gap-3">
              <a
                href="#inquiry-form"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-900 font-bold rounded-xl hover:bg-primary-50 transition-all shadow-lg text-sm sm:text-base"
              >
                Get Free Consultation
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="tel:+911234567890"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold rounded-xl hover:bg-white/15 transition-all text-sm sm:text-base"
              >
                <Phone className="w-4 h-4" />
                Call Now
              </a>
            </div>
          </div>
        </div>

        {/* Trust Stats Bar */}
        <div className="relative border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {TRUST_STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary-300" />
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-white">{stat.value}</div>
                      <div className="text-xs text-primary-300/70 font-medium">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why MediRoute Features ────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
              Why Choose MediRoute India?
            </h2>
            <p className="mt-2 text-sm text-surface-600 max-w-xl mx-auto">
              We simplify your entire medical journey — from initial consultation to recovery.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="group bg-surface-50 border border-surface-200 rounded-2xl p-6 hover:shadow-md hover:border-primary-200 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
                    <Icon className="w-5 h-5 text-primary-700" />
                  </div>
                  <h3 className="font-bold text-surface-900 text-sm">{feat.title}</h3>
                  <p className="mt-1.5 text-xs text-surface-600 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Inquiry Form Section ──────────────────────────────────────── */}
      <section id="inquiry-form" className="py-16 sm:py-20 bg-surface-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-14">
            {/* Left column — pitch */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-[10px] font-extrabold uppercase tracking-widest border border-primary-100/50 mb-4">
                  <MessageSquare className="w-3 h-3" />
                  Free Consultation
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
                  Tell Us About Your{' '}
                  <span className="text-primary-700">Medical Needs</span>
                </h2>
                <p className="mt-3 text-sm text-surface-600 leading-relaxed">
                  Fill out this form and our dedicated medical coordinator will contact you within
                  24 hours with a personalised treatment plan, cost estimate, and hospital
                  recommendations.
                </p>
              </div>

              {/* Process steps */}
              <div className="space-y-4">
                {[
                  { step: 1, title: 'Submit Your Inquiry', desc: 'Share your medical condition and preferences.' },
                  { step: 2, title: 'Expert Review', desc: 'Our team reviews your case with partner hospitals.' },
                  { step: 3, title: 'Personalised Plan', desc: 'Receive a detailed treatment plan and cost estimate.' },
                  { step: 4, title: 'Begin Your Journey', desc: 'We handle visa, travel, accommodation & treatment.' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-surface-900">{item.title}</h4>
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
                    icon={<Sparkles className="w-4 h-4" />}
                    options={SOURCE_OPTIONS}
                    placeholder="Select source"
                  />

                  {/* Additional message */}
                  <div>
                    <label className="block text-xs font-bold text-surface-700 mb-1.5">
                      Additional Message <span className="text-surface-400">(optional)</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Any additional details, questions, or preferred dates..."
                      className="w-full px-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm shadow-sm"
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
      <label className="block text-xs font-bold text-surface-700 mb-1.5">
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
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600 focus:bg-white transition-all`}
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
      <label className="block text-xs font-bold text-surface-700 mb-1.5">{label}</label>
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
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-10 py-2.5 bg-surface-50 border border-surface-300 rounded-xl text-sm text-surface-900 focus:outline-none focus:border-primary-600 focus:bg-white transition-all appearance-none`}
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
