'use client';

/**
 * MediRoute India — Patient Medical Profile Page
 * Tabbed clinical profile manager with Lucide icons and custom Select dropdown.
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectOption } from '@/components/ui/Select';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { DatePicker } from '@/components/ui/DatePicker';
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
  Lock,
  Globe,
  Smile,
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
  { id: 'medications', label: 'Meds & Surgeries', icon: Pill },
  { id: 'specialties', label: 'Care Specialties', icon: Stethoscope },
];

export default function PatientProfilePage() {
  const [activeTab, setActiveTab] = useState('demographics');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [dob, setDob] = useState('');

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/v1/patient/profile');
        const data = await res.json();

        if (data.success && data.data?.patient) {
          const pat = data.data.patient;
          setFullName(pat.user.fullName || '');
          setEmail(pat.user.email || '');
          setPhone(pat.user.phone || '');
          setNationality(pat.nationality || '');
          setDob(pat.dob ? new Date(pat.dob).toISOString().split('T')[0] : '');

          setBloodGroup(pat.bloodGroup || '');
          setPrimaryLanguage(pat.primaryLanguage || '');

          if (pat.emergencyContact) {
            setEmergencyName(pat.emergencyContact.name || '');
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
              Array.isArray(med.specialisationsRequired)
                ? med.specialisationsRequired
                : []
            );
          }
        }
      } catch (err) {
        console.error('Failed to load profile details', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

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
      const res = await fetch('/api/v1/patient/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroup,
          primaryLanguage,
          emergencyContact: {
            name: emergencyName,
            phone: emergencyPhone,
            relation: emergencyRelation,
          },
          allergies,
          medications,
          surgeries,
          chronicConditions: conditions,
          specialisationsRequired: selectedSpecs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Your medical profile has been encrypted and saved successfully.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMsg(data.error?.message || 'Failed to save medical profile.');
      }
    } catch {
      setErrorMsg('Network error occurred. Please try again.');
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-surface-600">Loading your encrypted medical profile...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Hero Header */}
      <div className="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-800 border border-primary-200 flex items-center justify-center font-bold text-xl shadow-xs">
              {fullName ? fullName.charAt(0) : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{fullName || 'Patient Profile'}</h1>
                <Badge variant="primary">{nationality || 'International'}</Badge>
              </div>
              <p className="text-xs text-surface-500 mt-1">{email} • {phone || 'Phone not provided'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-success-50 border border-success-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-success-800 self-start md:self-auto">
            <ShieldCheck className="w-4 h-4 text-success-600 shrink-0" />
            <span>AES-256-GCM Encrypted ePHI Record</span>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="border-t border-surface-100 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-surface-600">Clinical Profile Completion</span>
              <span className="font-bold text-primary-700">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-surface-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-surface-500">
            Completing your medical profile ensures accurate doctor consultations.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-success-50 border border-success-200 text-success-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-slide-down">
          <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-danger-50 border border-danger-200 text-danger-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-slide-down">
          <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-surface-200 scrollbar-none">
        {SECTIONS.map((sec) => {
          const IconComp = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveTab(sec.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === sec.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Demographics */}
      {activeTab === 'demographics' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Identity Information (Immutable)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name" type="text" value={fullName} disabled />
              <Input label="Email Address" type="email" value={email} disabled />
              <Input label="Phone Number" type="text" value={phone} disabled />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nationality" type="text" value={nationality} disabled />
                <Input label="Date of Birth" type="text" value={dob} disabled />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Editable Clinical Demographics</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Blood Group"
                options={BLOOD_GROUP_OPTIONS}
                value={bloodGroup}
                onChange={setBloodGroup}
                placeholder="Select blood group..."
                icon={<Activity className="w-4 h-4 text-primary-600" />}
              />
              <Input
                label="Primary Language"
                type="text"
                placeholder="e.g. Arabic, English, French"
                value={primaryLanguage}
                onChange={(e) => setPrimaryLanguage(e.target.value)}
                icon={<Globe className="w-4 h-4 text-primary-600" />}
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Emergency Contact */}
      {activeTab === 'emergency' && (
        <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4 animate-fade-in">
          <div className="border-b border-surface-100 pb-3">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Primary Emergency Contact</h2>
            <p className="text-xs text-surface-500 mt-0.5">Contact details for your designated next of kin during treatment in India.</p>
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
      )}

      {/* TAB 3: Allergies & Conditions */}
      {activeTab === 'conditions' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-danger-700 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-600" /> Known Allergies
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  label="Add Allergy Tag"
                  type="text"
                  placeholder="e.g. Penicillin, Latex"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" onClick={addAllergy} className="mt-[22px] px-4 shrink-0">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-danger-50 border border-danger-200 text-danger-800 text-xs px-3 py-1.5 rounded-xl font-semibold"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(idx)}
                      className="text-danger-400 hover:text-danger-700 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {allergies.length === 0 && (
                  <p className="text-xs text-surface-500 italic">No allergies recorded.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-warning-700 uppercase tracking-wider flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-warning-600" /> Chronic Conditions
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  label="Add Condition Tag"
                  type="text"
                  placeholder="e.g. Hypertension, Asthma"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" onClick={addCondition} className="mt-[22px] px-4 shrink-0">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {conditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-warning-50 border border-warning-200 text-warning-800 text-xs px-3 py-1.5 rounded-xl font-semibold"
                  >
                    {cond}
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      className="text-warning-400 hover:text-warning-700 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {conditions.length === 0 && (
                  <p className="text-xs text-surface-500 italic">No chronic conditions recorded.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Medications & Surgeries */}
      {activeTab === 'medications' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-5">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Current Prescribed Medications</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Input label="Medication Name" placeholder="e.g. Metformin" value={medName} onChange={(e) => setMedName(e.target.value)} />
              <Input label="Dosage" placeholder="e.g. 500mg" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} />
              <Input label="Frequency" placeholder="e.g. Twice daily" value={medFreq} onChange={(e) => setMedFreq(e.target.value)} />
              <Button type="button" onClick={addMedication} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Add Med
              </Button>
            </div>

            <div className="border border-surface-200 rounded-xl overflow-hidden text-xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">Medication</th>
                    <th className="p-3.5">Dosage</th>
                    <th className="p-3.5">Frequency</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {medications.map((med, idx) => (
                    <tr key={idx} className="hover:bg-surface-50">
                      <td className="p-3.5 font-bold text-surface-900">{med.name}</td>
                      <td className="p-3.5">{med.dosage || '—'}</td>
                      <td className="p-3.5">{med.frequency || '—'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeMedication(idx)}
                          className="text-danger-600 hover:text-danger-700 font-semibold flex items-center gap-1 justify-end ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {medications.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-surface-500">No active medications logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-5">
            <div className="border-b border-surface-100 pb-3">
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Past Surgical History</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Input label="Surgery Name" placeholder="e.g. Knee Replacement" value={surgName} onChange={(e) => setSurgName(e.target.value)} />
              <DatePicker label="Surgery Date" value={surgDate} onChange={setSurgDate} placeholder="Select surgery date" />
              <Input label="Notes" placeholder="e.g. Left knee" value={surgNotes} onChange={(e) => setSurgNotes(e.target.value)} />
              <Button type="button" onClick={addSurgery} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Add Surgery
              </Button>
            </div>

            <div className="border border-surface-200 rounded-xl overflow-hidden text-xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">Surgery Procedure</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Clinical Notes</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {surgeries.map((surg, idx) => (
                    <tr key={idx} className="hover:bg-surface-50">
                      <td className="p-3.5 font-bold text-surface-900">{surg.name}</td>
                      <td className="p-3.5 whitespace-nowrap">{surg.date || '—'}</td>
                      <td className="p-3.5">{surg.notes || '—'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeSurgery(idx)}
                          className="text-danger-600 hover:text-danger-700 font-semibold flex items-center gap-1 justify-end ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {surgeries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-surface-500">No surgical history logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: Care Specialties */}
      {activeTab === 'specialties' && (
        <Card className="p-6 rounded-2xl shadow-xs border border-surface-200 space-y-4 animate-fade-in">
          <div className="border-b border-surface-100 pb-3">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Required Medical Specialties</h2>
            <p className="text-xs text-surface-500 mt-0.5">Select the medical specialties required for your treatment itinerary in India.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {SPECIALISATION_OPTIONS.map((spec) => {
              const isChecked = selectedSpecs.includes(spec.name);
              const IconComponent = spec.icon;
              return (
                <button
                  key={spec.name}
                  type="button"
                  onClick={() => toggleSpecialisation(spec.name)}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold transition-all text-left ${
                      isChecked
                        ? 'border-primary-500 bg-primary-50/40 text-primary-800 shadow-2xs'
                        : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                    }
                  `}
                >
                  <IconComponent className={`w-4 h-4 ${isChecked ? 'text-primary-600' : 'text-surface-400'}`} />
                  <span className="truncate">{spec.name}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Floating Submit Bar */}
      <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-surface-200 shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-surface-600 font-medium">
          <Lock className="w-4 h-4 text-success-600 shrink-0" />
          <span>All changes encrypted before database write</span>
        </div>

        <Button type="submit" isLoading={isSaving} size="lg">
          {isSaving ? 'Encrypting & Saving...' : 'Save Medical Profile'}
        </Button>
      </div>
    </form>
  );
}
