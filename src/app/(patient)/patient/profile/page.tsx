'use client';

/**
 * Afzal Healthcare — Patient Medical Profile
 * Clean architectural 8px/6px tabbed clinical record aligned to the shared portal grid.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { Select, SelectOption } from '@/components/ui/Select';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { isPassportValidForMedicalVisa } from '@/lib/validation/booking-helpers';
import {
  User,
  PhoneCall,
  AlertTriangle,
  Pill,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Heart,
  Bone,
  Activity,
  Brain,
  Eye,
  Sparkles,
  Baby,
  Dna,
  Scissors,
  Plus,
  Trash2,
  X,
  Lock,
  Globe,
  Smile,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

interface Surgery {
  name: string;
  date: string;
  notes: string;
}

const SPECIALISATION_OPTIONS = [
  { name: 'Cardiology', icon: Heart },
  { name: 'Orthopaedics', icon: Bone },
  { name: 'Oncology', icon: Activity },
  { name: 'Neurology', icon: Brain },
  { name: 'Ophthalmology', icon: Eye },
  { name: 'Cosmetic Surgery', icon: Sparkles },
  { name: 'Dental', icon: Smile },
  { name: 'Fertility', icon: Baby },
  { name: 'Gastroenterology', icon: Stethoscope },
  { name: 'Urology', icon: Dna },
  { name: 'Nephrology', icon: Activity },
  { name: 'Pulmonology', icon: Activity },
  { name: 'Dermatology', icon: Sparkles },
  { name: 'ENT', icon: Stethoscope },
  { name: 'General Surgery', icon: Scissors },
];

const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  { value: 'A+', label: 'A Positive (A+)' },
  { value: 'A-', label: 'A Negative (A-)' },
  { value: 'B+', label: 'B Positive (B+)' },
  { value: 'B-', label: 'B Negative (B-)' },
  { value: 'AB+', label: 'AB Positive (AB+)' },
  { value: 'AB-', label: 'AB Negative (AB-)' },
  { value: 'O+', label: 'O Positive (O+)' },
  { value: 'O-', label: 'O Negative (O-)' },
];

const SECTIONS = [
  { id: 'demographics', label: 'Demographics', icon: User },
  { id: 'emergency', label: 'Emergency Contact', icon: PhoneCall },
  { id: 'conditions', label: 'Allergies & Conditions', icon: AlertTriangle },
  { id: 'medications', label: 'Medications & Surgeries', icon: Pill },
  { id: 'specialties', label: 'Care Specialties', icon: Stethoscope },
];

export default function PatientProfilePage() {
  const [activeTab, setActiveTab] = useState('demographics');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const tablistRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [dob, setDob] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');

  const [bloodGroup, setBloodGroup] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('');

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyCountryCode, setEmergencyCountryCode] = useState('+971');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');

  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');

  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');

  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [surgName, setSurgName] = useState('');
  const [surgDate, setSurgDate] = useState('');
  const [surgNotes, setSurgNotes] = useState('');

  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/v1/patient/profile');
      const data = await res.json();

      if (res.ok && data.success && data.data?.patient) {
        const pat = data.data.patient;
        setFullName(pat.user.fullName || '');
        setEmail(pat.user.email || '');
        setPhone(pat.user.phone || '');
        setNationality(pat.nationality || '');
        setDob(pat.dob ? new Date(pat.dob).toISOString().split('T')[0] : '');
        setPassportExpiry(
          pat.passportExpiry ? new Date(pat.passportExpiry).toISOString().split('T')[0] : ''
        );

        setBloodGroup(pat.bloodGroup || '');
        setPrimaryLanguage(pat.primaryLanguage || '');

        if (pat.emergencyContact) {
          setEmergencyName(pat.emergencyContact.name || '');
          setEmergencyCountryCode(pat.emergencyContact.countryCode || '+971');
          setEmergencyPhone(pat.emergencyContact.phone || '');
          setEmergencyRelation(pat.emergencyContact.relation || '');
        }

        if (pat.medicalProfile) {
          const med = pat.medicalProfile;
          setAllergies(Array.isArray(med.allergies) ? med.allergies : []);
          setConditions(Array.isArray(med.chronicConditions) ? med.chronicConditions : []);
          setMedications(Array.isArray(med.medications) ? med.medications : []);
          setSurgeries(Array.isArray(med.surgeries) ? med.surgeries : []);
          setSelectedSpecs(
            Array.isArray(med.specialisationsRequired) ? med.specialisationsRequired : []
          );
        }
      } else {
        setLoadError(data?.error?.message || 'Unable to load your medical profile.');
      }
    } catch (err) {
      console.error('Failed to load profile details', err);
      setLoadError('Could not connect to load your medical profile. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const scroller = tablistRef.current;
    if (!scroller) return;
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()')) {
      return;
    }

    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          scroller.classList.toggle(
            target === first ? 'more-start' : 'more-end',
            intersectionRatio < 1
          );
        }
      },
      { root: scroller, threshold: 1, rootMargin: '1px' }
    );

    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, [isLoading]);

  const selectTab = (tabId: string, focusButton = false) => {
    setActiveTab(tabId);
    const btn = tabButtonRefs.current[tabId];
    if (btn) {
      if (focusButton) btn.focus();
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = SECTIONS.findIndex((s) => s.id === activeTab);
    if (currentIdx < 0) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = SECTIONS[(currentIdx + 1) % SECTIONS.length];
      selectTab(next.id, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = SECTIONS[(currentIdx - 1 + SECTIONS.length) % SECTIONS.length];
      selectTab(prev.id, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab(SECTIONS[0].id, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab(SECTIONS[SECTIONS.length - 1].id, true);
    }
  };

  const completionPercentage = useMemo(() => {
    let score = 0;
    if (fullName) score += 15;
    if (bloodGroup) score += 15;
    if (primaryLanguage) score += 15;
    if (emergencyName && emergencyPhone) score += 15;
    if (allergies.length > 0 || conditions.length > 0) score += 15;
    if (medications.length > 0 || surgeries.length > 0) score += 15;
    if (selectedSpecs.length > 0) score += 10;
    return Math.min(100, score);
  }, [
    fullName,
    bloodGroup,
    primaryLanguage,
    emergencyName,
    emergencyPhone,
    allergies,
    conditions,
    medications,
    surgeries,
    selectedSpecs,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const hasEmergencyContact =
        Boolean(emergencyName.trim()) ||
        Boolean(emergencyPhone.trim()) ||
        Boolean(emergencyRelation.trim());

      const res = await fetch('/api/v1/patient/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroup: bloodGroup || undefined,
          primaryLanguage: primaryLanguage.trim() || undefined,
          passportExpiry: passportExpiry.trim() ? passportExpiry.trim() : null,
          ...(hasEmergencyContact
            ? {
                emergencyContact: {
                  name: emergencyName.trim(),
                  countryCode: emergencyCountryCode,
                  phone: emergencyPhone.trim(),
                  relation: emergencyRelation.trim(),
                },
              }
            : {}),
          allergies,
          medications,
          surgeries,
          chronicConditions: conditions,
          specialisationsRequired: selectedSpecs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Your medical profile changes have been saved securely.');
        toast.success('Your medical profile changes have been saved securely.', 'Profile Updated');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errMsg = data.error?.message || 'Failed to save medical profile.';
        setErrorMsg(errMsg);
        toast.apiError(data, 'Failed to save medical profile.', 'Save Error');
      }
    } catch (err) {
      setErrorMsg('Network error occurred. Please try again.');
      toast.apiError(err, 'Network error occurred. Please try again.', 'Connection Error');
    } finally {
      setIsSaving(false);
    }
  };

  const addAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };
  const removeAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    if (conditionInput.trim() && !conditions.includes(conditionInput.trim())) {
      setConditions([...conditions, conditionInput.trim()]);
      setConditionInput('');
    }
  };
  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addMedication = () => {
    if (medName.trim()) {
      setMedications([
        ...medications,
        { name: medName.trim(), dosage: medDosage.trim(), frequency: medFreq.trim() },
      ]);
      setMedName('');
      setMedDosage('');
      setMedFreq('');
    }
  };
  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const addSurgery = () => {
    if (surgName.trim()) {
      setSurgeries([
        ...surgeries,
        { name: surgName.trim(), date: surgDate, notes: surgNotes.trim() },
      ]);
      setSurgName('');
      setSurgDate('');
      setSurgNotes('');
    }
  };
  const removeSurgery = (index: number) => {
    setSurgeries(surgeries.filter((_, i) => i !== index));
  };

  const toggleSpecialisation = (spec: string) => {
    if (selectedSpecs.includes(spec)) {
      setSelectedSpecs(selectedSpecs.filter((s) => s !== spec));
    } else {
      setSelectedSpecs([...selectedSpecs, spec]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-lg bg-white border border-surface-200 animate-pulse" />
        <div className="h-11 rounded-md bg-surface-200/70 animate-pulse" />
        <div className="h-80 rounded-lg bg-white border border-surface-200 animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-20 animate-fade-in">
      {/* Patient Identity Summary Header Card */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-800 border border-primary-200 flex items-center justify-center font-semibold text-base shrink-0">
              {fullName ? fullName.charAt(0) : 'P'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-surface-900 tracking-tight">
                  {fullName || 'Medical Profile'}
                </h1>
                <Badge variant="default">{nationality || 'International Patient'}</Badge>
              </div>
              <p className="text-xs text-surface-500 mt-0.5 truncate tabular-nums">
                {email} • {phone || 'Phone not provided'}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-3 py-1.5 rounded-md text-xs font-medium text-surface-700 self-start md:self-auto shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-success-600 shrink-0" aria-hidden="true" />
            <span>Encrypted Medical Record</span>
          </div>
        </div>

        <div className="border-t border-surface-100 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-surface-600">Profile Completeness</span>
              <span className="font-semibold text-surface-900 tabular-nums">
                {completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-surface-150 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary-600 h-full rounded-full transition-[width] duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-surface-500">
            Complete clinical details help your doctors prepare safely before travel.
          </p>
        </div>
      </Card>

      {/* Alerts & Error Recovery */}
      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Unable to load your medical profile</h2>
              <p className="text-xs text-danger-800 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadProfile()}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="bg-success-50 border border-success-200 text-success-800 p-3.5 rounded-lg text-xs font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="bg-danger-50 border border-danger-200 text-danger-800 p-3.5 rounded-lg text-xs font-medium flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Accessible Edge-Faded Tablist */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Medical profile sections"
        onKeyDown={handleTabKeyDown}
        {...({ focusgroup: 'tablist nomemory' } as Record<string, unknown>)}
        className="edge-fade-scroller flex items-center gap-1.5 pb-2 border-b border-surface-200"
      >
        {SECTIONS.map((sec) => {
          const IconComp = sec.icon;
          const isSelected = activeTab === sec.id;
          return (
            <button
              key={sec.id}
              ref={(el) => {
                tabButtonRefs.current[sec.id] = el;
              }}
              id={`profile-tab-${sec.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(sec.id)}
              className="clinical-tab flex-none min-h-11 px-3.5 rounded-md border border-surface-200 bg-white hover:bg-surface-50 text-surface-600 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 scroll-snap-align-start"
            >
              <IconComp
                className={`w-3.5 h-3.5 shrink-0 ${
                  isSelected ? 'text-primary-700' : 'text-surface-400'
                }`}
                aria-hidden="true"
              />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB PANEL 1: Demographics */}
      <div
        role="tabpanel"
        aria-labelledby="profile-tab-demographics"
        hidden={activeTab !== 'demographics'}
      >
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-surface-900">Passport &amp; Account Identity</h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Locked to match your passport for official Visa Invitation Letters and hospital admission.
                </p>
              </div>
              <Link
                href="/patient/messages"
                className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md bg-white hover:bg-surface-100 text-surface-700 border border-surface-300 text-xs font-medium transition-colors self-start sm:self-auto shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5 text-surface-500" aria-hidden="true" />
                <span>Request Correction</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name (as on Passport)" type="text" value={fullName} disabled />
              <Input label="Email Address" type="email" value={email} disabled />
              <Input label="Phone Number" type="text" value={phone} disabled />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nationality" type="text" value={nationality} disabled />
                <Input label="Date of Birth" type="text" value={dob} disabled />
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-surface-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <Input
                    label="Passport Expiry Date"
                    type="date"
                    value={passportExpiry}
                    onChange={(e) => setPassportExpiry(e.target.value)}
                    helperText="Must be valid for at least 6 months for Indian Medical Visa sponsorship."
                  />
                </div>
                <div className="pb-1">
                  {passportExpiry ? (
                    isPassportValidForMedicalVisa(passportExpiry) ? (
                      <Badge variant="success" dot>
                        6-Month Medical Visa Rule Met
                      </Badge>
                    ) : (
                      <Badge variant="danger" dot>
                        Less than 6 Months Validity
                      </Badge>
                    )
                  ) : (
                    <Badge variant="warning" dot>
                      Passport Expiry Needed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Clinical &amp; Language Details</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Used to arrange hospital blood-bank readiness and medical interpreter support.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Blood Group"
                options={BLOOD_GROUP_OPTIONS}
                value={bloodGroup}
                onChange={setBloodGroup}
                placeholder="Select blood group..."
                icon={<Activity className="w-4 h-4" />}
              />
              <Input
                label="Preferred Language for Care"
                type="text"
                placeholder="e.g. Arabic, English, French"
                value={primaryLanguage}
                onChange={(e) => setPrimaryLanguage(e.target.value)}
                icon={<Globe className="w-4 h-4" />}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* TAB PANEL 2: Emergency Contact */}
      <div
        role="tabpanel"
        aria-labelledby="profile-tab-emergency"
        hidden={activeTab !== 'emergency'}
      >
        <div>
          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Emergency Contact</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Designated family member or travel companion we should reach in an emergency while you are in India.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Contact Full Name"
                type="text"
                placeholder="e.g. Sarah Mansoor"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
              <PhoneInput
                label="Contact Phone"
                countryCode={emergencyCountryCode}
                onCountryCodeChange={setEmergencyCountryCode}
                phoneNumber={emergencyPhone}
                onPhoneNumberChange={setEmergencyPhone}
                placeholder="50 123 4567"
              />
              <Input
                label="Relationship"
                type="text"
                placeholder="e.g. Spouse / Sibling"
                value={emergencyRelation}
                onChange={(e) => setEmergencyRelation(e.target.value)}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* TAB PANEL 3: Allergies & Conditions */}
      <div
        role="tabpanel"
        aria-labelledby="profile-tab-conditions"
        hidden={activeTab !== 'conditions'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-600" aria-hidden="true" />
                <span>Known Drug or Food Allergies</span>
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Add Allergy"
                    type="text"
                    placeholder="e.g. Penicillin, Latex"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAllergy();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addAllergy} className="shrink-0">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-danger-50 border border-danger-200 text-danger-900 text-xs pl-3 pr-1 min-h-11 rounded-md font-medium"
                  >
                    <span>{allergy}</span>
                    <button
                      type="button"
                      onClick={() => removeAllergy(idx)}
                      aria-label={`Remove allergy ${allergy}`}
                      className="inline-flex items-center justify-center w-8 h-8 text-danger-600 hover:text-danger-800 hover:bg-danger-100 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {allergies.length === 0 && (
                  <p className="text-xs text-surface-500">No known allergies recorded.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-warning-600" aria-hidden="true" />
                <span>Chronic Medical Conditions</span>
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Add Condition"
                    type="text"
                    placeholder="e.g. Hypertension, Type 2 Diabetes"
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCondition();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addCondition} className="shrink-0">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {conditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-warning-50 border border-warning-200 text-warning-900 text-xs pl-3 pr-1 min-h-11 rounded-md font-medium"
                  >
                    <span>{cond}</span>
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      aria-label={`Remove condition ${cond}`}
                      className="inline-flex items-center justify-center w-8 h-8 text-warning-700 hover:text-warning-900 hover:bg-warning-100 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {conditions.length === 0 && (
                  <p className="text-xs text-surface-500">No chronic conditions recorded.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* TAB PANEL 4: Medications & Surgeries */}
      <div
        role="tabpanel"
        aria-labelledby="profile-tab-medications"
        hidden={activeTab !== 'medications'}
      >
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Current Medications</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Input
                label="Medication Name"
                placeholder="e.g. Metformin"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
              />
              <Input
                label="Dosage"
                placeholder="e.g. 500 mg"
                value={medDosage}
                onChange={(e) => setMedDosage(e.target.value)}
              />
              <Input
                label="Schedule"
                placeholder="e.g. Twice daily"
                value={medFreq}
                onChange={(e) => setMedFreq(e.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addMedication} fullWidth>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Medication</span>
              </Button>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-label="Current medications table"
              className="border border-surface-200 rounded-lg overflow-x-auto text-xs bg-white"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    <th scope="col" className="px-4 py-3">
                      Medication
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Dosage
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Schedule
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {medications.map((med, idx) => (
                    <tr key={idx} className="hover:bg-surface-50/70">
                      <td className="px-4 py-3 font-medium text-surface-900">{med.name}</td>
                      <td className="px-4 py-3">{med.dosage || '—'}</td>
                      <td className="px-4 py-3">{med.frequency || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeMedication(idx)}
                          className="inline-flex items-center justify-center gap-1 min-h-11 px-3 rounded-md text-danger-700 hover:bg-danger-50 font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {medications.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-surface-500">
                        No ongoing medications listed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Previous Surgeries</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Input
                label="Procedure Name"
                placeholder="e.g. Knee Arthroscopy"
                value={surgName}
                onChange={(e) => setSurgName(e.target.value)}
              />
              <DatePicker
                label="Date"
                value={surgDate}
                onChange={setSurgDate}
                placeholder="Select surgery date"
              />
              <Input
                label="Notes"
                placeholder="e.g. Left knee, full recovery"
                value={surgNotes}
                onChange={(e) => setSurgNotes(e.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addSurgery} fullWidth>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Surgery</span>
              </Button>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-label="Previous surgeries table"
              className="border border-surface-200 rounded-lg overflow-x-auto text-xs bg-white"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                    <th scope="col" className="px-4 py-3">
                      Procedure
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Notes
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {surgeries.map((surg, idx) => (
                    <tr key={idx} className="hover:bg-surface-50/70">
                      <td className="px-4 py-3 font-medium text-surface-900">{surg.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{surg.date || '—'}</td>
                      <td className="px-4 py-3">{surg.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeSurgery(idx)}
                          className="inline-flex items-center justify-center gap-1 min-h-11 px-3 rounded-md text-danger-700 hover:bg-danger-50 font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {surgeries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-surface-500">
                        No previous surgeries listed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* TAB PANEL 5: Care Specialties */}
      <div
        role="tabpanel"
        aria-labelledby="profile-tab-specialties"
        hidden={activeTab !== 'specialties'}
      >
        <div>
          <Card className="p-5 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-sm font-semibold text-surface-900">Medical Specialties Needed</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Select all specialties relevant to your upcoming evaluation or procedure.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {SPECIALISATION_OPTIONS.map((spec) => {
                const isChecked = selectedSpecs.includes(spec.name);
                const IconComponent = spec.icon;
                return (
                  <button
                    key={spec.name}
                    type="button"
                    aria-pressed={isChecked}
                    onClick={() => toggleSpecialisation(spec.name)}
                    className={`flex items-center gap-2.5 px-3 min-h-11 rounded-md border text-xs font-medium transition-colors text-left ${
                      isChecked
                        ? 'border-primary-600 bg-primary-50/70 text-primary-900'
                        : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isChecked ? 'text-primary-700' : 'text-surface-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{spec.name}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Restrained Sticky Save Bar */}
      <div className="sticky bottom-3 z-30 bg-white p-3 sm:px-5 sm:py-3 rounded-lg border border-surface-200 shadow-sm flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-surface-500">
          <Lock className="w-3.5 h-3.5 text-primary-600 shrink-0" aria-hidden="true" />
          <span>Protected with end-to-end clinical encryption</span>
        </div>

        <Button type="submit" isLoading={isSaving} size="md" className="w-full sm:w-auto">
          {isSaving ? 'Saving Changes…' : 'Save Medical Profile'}
        </Button>
      </div>
    </form>
  );
}
