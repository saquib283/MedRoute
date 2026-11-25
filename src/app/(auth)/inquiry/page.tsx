'use client';

/**
 * Afzal Healthcare — Public 60-Second Medical Opinion & Cost Estimate Portal
 * Low-friction international patient intake without requiring passport or portal registration upfront.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import {
  COMMON_LANGUAGES,
  MVT_SPECIALTY_OPTIONS,
  URGENCY_LEVEL_LABELS,
} from '@/lib/constants';
import {
  LEAD_URGENCY_LEVELS,
  PREFERRED_TRAVEL_WINDOWS,
  publicInquirySchema,
  type LeadTemperatureValue,
  type LeadUrgencyLevelValue,
  type PreferredTravelWindowValue,
} from '@/lib/validation/leads-crm-schemas';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Languages,
  Mail,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react';

const TRAVEL_WINDOW_LABELS: Record<PreferredTravelWindowValue, string> = {
  IMMEDIATE_7D: 'Immediate (Within 7 days)',
  WITHIN_30D: 'Within 30 days',
  WITHIN_90D: 'Within 90 days',
  EXPLORING: 'Exploring options / Flexible',
};

const LANGUAGE_OPTIONS = COMMON_LANGUAGES.map((lang) => ({
  value: lang,
  label: lang,
}));

const SPECIALTY_OPTIONS = MVT_SPECIALTY_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
}));

const TRAVEL_WINDOW_OPTIONS = PREFERRED_TRAVEL_WINDOWS.map((win) => ({
  value: win,
  label: TRAVEL_WINDOW_LABELS[win],
}));

const TEMPERATURE_STYLES: Record<LeadTemperatureValue, { label: string; className: string }> = {
  HOT: {
    label: 'Priority Triage',
    className: 'bg-danger-50 text-danger-700 border-danger-200',
  },
  WARM: {
    label: 'Expedited Review',
    className: 'bg-warning-50 text-warning-800 border-warning-200',
  },
  COLD: {
    label: 'Standard Review',
    className: 'bg-surface-100 text-surface-700 border-surface-200',
  },
};

function formatSlaLabel(slaMinutes: number): string {
  if (slaMinutes === 15) return '15 mins';
  if (slaMinutes === 60) return '60 mins';
  if (slaMinutes === 240) return '4 hours';
  if (slaMinutes >= 60 && slaMinutes % 60 === 0) {
    return `${slaMinutes / 60} hours`;
  }
  return `${slaMinutes} mins`;
}

interface InquiryReceipt {
  referenceNo: string;
  slaMinutes: number;
  temperature: LeadTemperatureValue;
}

interface InquiryFormState {
  fullName: string;
  countryCode: string;
  phoneNumber: string;
  email: string;
  nationality: string;
  preferredLanguage: string;
  specialtyInterest: string;
  urgencyLevel: LeadUrgencyLevelValue;
  preferredTravelWindow: string;
  hasDiagnosticReports: boolean;
  passportReady: boolean;
  medicalCondition: string;
  websiteUrl: string;
}

const INITIAL_FORM_STATE: InquiryFormState = {
  fullName: '',
  countryCode: '+971',
  phoneNumber: '',
  email: '',
  nationality: '',
  preferredLanguage: 'English',
  specialtyInterest: '',
  urgencyLevel: 'ROUTINE',
  preferredTravelWindow: '',
  hasDiagnosticReports: false,
  passportReady: false,
  medicalCondition: '',
  websiteUrl: '',
};

export default function PublicInquiryPage() {
  const [formData, setFormData] = useState<InquiryFormState>(INITIAL_FORM_STATE);
  const [attribution, setAttribution] = useState({
    referralCode: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<InquiryReceipt | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const referralCode = params.get('ref')?.trim() ?? '';
      const utmSource = params.get('utm_source')?.trim() ?? '';
      const utmMedium = params.get('utm_medium')?.trim() ?? '';
      const utmCampaign = params.get('utm_campaign')?.trim() ?? '';

      if (referralCode || utmSource || utmMedium || utmCampaign) {
        setAttribution({
          referralCode,
          utmSource,
          utmMedium,
          utmCampaign,
        });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const cleanedPhone = formData.phoneNumber.replace(/[^\d]/g, '');
    const combinedPhone = cleanedPhone.length > 0 ? `${formData.countryCode}${cleanedPhone}` : '';

    const rawPayload = {
      fullName: formData.fullName,
      phone: combinedPhone,
      whatsappNumber: combinedPhone,
      email: formData.email,
      nationality: formData.nationality,
      preferredLanguage: formData.preferredLanguage,
      specialtyInterest: formData.specialtyInterest,
      urgencyLevel: formData.urgencyLevel,
      preferredTravelWindow: formData.preferredTravelWindow,
      hasDiagnosticReports: formData.hasDiagnosticReports,
      passportReady: formData.passportReady,
      medicalCondition: formData.medicalCondition,
      referralCode: attribution.referralCode,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      websiteUrl: formData.websiteUrl,
    };

    const parsed = publicInquirySchema.safeParse(rawPayload);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      const nextErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(flattened)) {
        if (messages && messages.length > 0) {
          nextErrors[key] = messages[0];
        }
      }
      setFieldErrors(nextErrors);
      setFormError(parsed.error.issues[0]?.message || 'Please review the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/public/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawPayload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg =
          data.error?.message || 'Unable to submit your medical opinion request. Please try again.';
        setFormError(errMsg);
        toast.apiError(data, errMsg, 'Submission Failed');
        return;
      }

      setReceipt({
        referenceNo: data.data.referenceNo,
        slaMinutes: data.data.slaMinutes,
        temperature: data.data.temperature,
      });
      toast.success('Medical opinion request submitted.');
    } catch {
      const msg = 'Network error while submitting your inquiry. Please try again.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (receipt) {
    const tempMeta = TEMPERATURE_STYLES[receipt.temperature] ?? TEMPERATURE_STYLES.WARM;

    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-success-50 border border-success-200 rounded-lg flex items-center justify-center text-success-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-surface-900 tracking-tight">
              Medical opinion request received
            </h2>
            <p className="text-sm font-normal text-surface-500">
              An international patient coordinator has been assigned to review your case.
            </p>
          </div>
        </div>

        <Card padding="md" className="bg-surface-50 border-surface-200 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-200">
            <span className="text-xs font-medium text-surface-500">Inquiry reference</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${tempMeta.className}`}
            >
              {tempMeta.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-surface-200 rounded-md p-3">
              <span className="block text-[11px] font-medium text-surface-500">
                Reference number
              </span>
              <span className="mt-1 block text-base font-semibold font-mono text-surface-900 tabular-nums select-all">
                {receipt.referenceNo}
              </span>
            </div>

            <div className="bg-white border border-surface-200 rounded-md p-3">
              <span className="block text-[11px] font-medium text-surface-500">
                Guaranteed response SLA
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold text-primary-700 tabular-nums">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                {formatSlaLabel(receipt.slaMinutes)}
              </span>
            </div>
          </div>

          <p className="text-xs font-normal text-surface-600 leading-relaxed">
            Save your reference number <span className="font-mono font-medium tabular-nums text-surface-900">{receipt.referenceNo}</span>. Our clinical coordination desk will contact you within{' '}
            <span className="font-semibold text-surface-900 tabular-nums">
              {formatSlaLabel(receipt.slaMinutes)}
            </span>{' '}
            with preliminary specialist options and an itemized treatment estimate.
          </p>
        </Card>

        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-surface-900">
              Ready to upload diagnostic scans &amp; passport?
            </h3>
            <p className="text-xs font-normal text-surface-600 leading-relaxed">
              Create your encrypted patient portal account anytime to upload DICOM/PDF reports, track your visa invitation letter, and message your care team.
            </p>
          </div>
          <Link href="/register" className="block">
            <Button fullWidth size="lg">
              <span>Create Full Patient Portal Account</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-surface-100">
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              setFormData(INITIAL_FORM_STATE);
              setFieldErrors({});
              setFormError('');
            }}
            className="min-h-11 inline-flex items-center text-xs font-medium text-surface-600 hover:text-surface-900 transition-colors"
          >
            Submit another inquiry
          </button>

          <Link
            href="/login"
            className="min-h-11 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-surface-900 tracking-tight">
            60-second medical opinion
          </h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 border border-primary-200 text-primary-700 text-[11px] font-medium">
            <Clock className="w-3 h-3" aria-hidden="true" />
            Free Estimate
          </span>
        </div>
        <p className="text-sm font-normal text-surface-500">
          Request a specialist review and treatment cost estimate — no passport or account required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 relative" noValidate>
        {/* Accessible offscreen honeypot field for silent spam mitigation */}
        <div
          className="absolute -left-[9999px] w-px h-px overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor="inquiry-website-url">Website</label>
          <input
            id="inquiry-website-url"
            name="websiteUrl"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={formData.websiteUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))}
          />
        </div>

        {formError && (
          <div
            role="alert"
            className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-md text-xs flex items-start gap-2 animate-slide-down"
          >
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <Input
          label="Full name"
          type="text"
          placeholder="Fatima Al-Balushi"
          value={formData.fullName}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, fullName: e.target.value }));
            clearFieldError('fullName');
          }}
          error={fieldErrors.fullName}
          required
          autoComplete="name"
          icon={<User className="w-4 h-4 text-surface-400" />}
        />

        <PhoneInput
          label="WhatsApp / Phone"
          countryCode={formData.countryCode}
          onCountryCodeChange={(code) => {
            setFormData((prev) => ({ ...prev, countryCode: code }));
            clearFieldError('phone');
          }}
          phoneNumber={formData.phoneNumber}
          onPhoneNumberChange={(num) => {
            setFormData((prev) => ({ ...prev, phoneNumber: num }));
            clearFieldError('phone');
          }}
          placeholder="50 123 4567"
          error={fieldErrors.phone}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="patient@example.com (optional if phone provided)"
          value={formData.email}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, email: e.target.value }));
            clearFieldError('email');
          }}
          error={fieldErrors.email}
          autoComplete="email"
          icon={<Mail className="w-4 h-4 text-surface-400" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Nationality"
            type="text"
            placeholder="e.g., Oman, UAE, Kenya"
            value={formData.nationality}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, nationality: e.target.value }));
              clearFieldError('nationality');
            }}
            error={fieldErrors.nationality}
            required
            icon={<Globe className="w-4 h-4 text-surface-400" />}
          />

          <Select
            label="Preferred language"
            options={LANGUAGE_OPTIONS}
            value={formData.preferredLanguage}
            onChange={(val) => {
              setFormData((prev) => ({ ...prev, preferredLanguage: val }));
              clearFieldError('preferredLanguage');
            }}
            placeholder="Select language..."
            searchable
            error={fieldErrors.preferredLanguage}
            icon={<Languages className="w-4 h-4 text-surface-400" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="Medical specialty"
            options={SPECIALTY_OPTIONS}
            value={formData.specialtyInterest}
            onChange={(val) => {
              setFormData((prev) => ({ ...prev, specialtyInterest: val }));
              clearFieldError('specialtyInterest');
            }}
            placeholder="Select specialty..."
            error={fieldErrors.specialtyInterest}
            icon={<Stethoscope className="w-4 h-4 text-surface-400" />}
          />

          <Select
            label="Preferred travel window"
            options={TRAVEL_WINDOW_OPTIONS}
            value={formData.preferredTravelWindow}
            onChange={(val) => {
              setFormData((prev) => ({ ...prev, preferredTravelWindow: val }));
              clearFieldError('preferredTravelWindow');
            }}
            placeholder="Select timeframe..."
            error={fieldErrors.preferredTravelWindow}
            icon={<Calendar className="w-4 h-4 text-surface-400" />}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-surface-700">
            Clinical urgency
          </span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Clinical urgency">
            {LEAD_URGENCY_LEVELS.map((level) => {
              const isSelected = formData.urgencyLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setFormData((prev) => ({ ...prev, urgencyLevel: level }))}
                  className={`min-h-11 px-2.5 py-2 rounded-md border text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-surface-700 border-surface-300 hover:bg-surface-50 hover:border-surface-400'
                  }`}
                >
                  {URGENCY_LEVEL_LABELS[level] ?? level}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="inquiry-medical-condition"
            className="block text-xs font-medium text-surface-700"
          >
            Medical condition / treatment goal <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="inquiry-medical-condition"
            rows={3}
            placeholder="Describe your diagnosis, symptoms, or desired procedure (e.g., mitral valve repair, knee replacement, second opinion)..."
            value={formData.medicalCondition}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, medicalCondition: e.target.value }));
              clearFieldError('medicalCondition');
            }}
            required
            aria-invalid={fieldErrors.medicalCondition ? 'true' : 'false'}
            className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-normal text-surface-900 placeholder:text-surface-400 focus:outline-none transition-colors ${
              fieldErrors.medicalCondition
                ? 'border-danger-500 focus:border-danger-600'
                : 'border-surface-300 hover:border-surface-400 focus:border-primary-600'
            }`}
          />
          {fieldErrors.medicalCondition && (
            <p className="text-xs text-danger-600" role="alert">
              {fieldErrors.medicalCondition}
            </p>
          )}
        </div>

        <div className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2 space-y-1">
          <label className="min-h-11 flex items-center gap-2.5 cursor-pointer text-xs font-medium text-surface-700">
            <input
              type="checkbox"
              checked={formData.hasDiagnosticReports}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, hasDiagnosticReports: e.target.checked }))
              }
              className="w-4 h-4 rounded border-surface-300 bg-white text-primary-600 focus:ring-primary-500 focus:ring-offset-0 shrink-0"
            />
            <span>Diagnostic reports / recent scans ready</span>
          </label>

          <label className="min-h-11 flex items-center gap-2.5 cursor-pointer text-xs font-medium text-surface-700">
            <input
              type="checkbox"
              checked={formData.passportReady}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, passportReady: e.target.checked }))
              }
              className="w-4 h-4 rounded border-surface-300 bg-white text-primary-600 focus:ring-primary-500 focus:ring-offset-0 shrink-0"
            />
            <span>Valid passport ready for travel</span>
          </label>
        </div>

        <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
          <span>Request Free Medical Opinion &amp; Estimate</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] font-normal text-surface-500">
          <ShieldCheck className="w-3.5 h-3.5 text-primary-600 shrink-0" aria-hidden="true" />
          <span>Confidential clinical intake · Encrypted &amp; HIPAA-aligned</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-100 text-xs text-surface-500">
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center gap-1 font-medium text-surface-600 hover:text-surface-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign in</span>
          </Link>
          <Link
            href="/register"
            className="min-h-11 inline-flex items-center font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Have a passport? Full registration
          </Link>
        </div>
      </form>
    </div>
  );
}
