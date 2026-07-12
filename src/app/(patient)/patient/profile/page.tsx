'use client';

/**
 * MediRoute India — Patient Medical Profile Page
 * Interactive clinical form managing emergency contacts, allergies, conditions, and lists.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

const specialisationOptions = [
  'Cardiology',
  'Orthopaedics',
  'Oncology',
  'Neurology',
  'Ophthalmology',
  'Cosmetic Surgery',
  'Dental',
  'Fertility',
  'Gastroenterology',
  'Urology',
  'Nephrology',
  'Pulmonology',
  'Dermatology',
  'ENT',
  'General Surgery',
];

export default function PatientProfilePage() {
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
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/v1/patient/profile', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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

          // Emergency Contact
          if (pat.emergencyContact) {
            setEmergencyName(pat.emergencyContact.name || '');
            setEmergencyPhone(pat.emergencyContact.phone || '');
            setEmergencyRelation(pat.emergencyContact.relation || '');
          }

          // Medical Profile
          if (pat.medicalProfile) {
            const med = pat.medicalProfile;
            setAllergies(Array.isArray(med.allergies) ? med.allergies : []);
            setConditions(Array.isArray(med.chronicConditions) ? med.chronicConditions : []);
            setMedications(Array.isArray(med.medications) ? med.medications : []);
            setSurgeries(Array.isArray(med.surgeries) ? med.surgeries : []);
            setSelectedSpecs(Array.isArray(med.specialisationsRequired) ? med.specialisationsRequired : []);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/patient/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        setSuccessMsg('Your profile and medical records have been updated successfully.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMsg(data.error?.message || 'Failed to save changes.');
      }
    } catch {
      setErrorMsg('Network error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Allergy list handlings
  const addAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };
  const removeAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  // Condition list handlings
  const addCondition = () => {
    if (conditionInput.trim() && !conditions.includes(conditionInput.trim())) {
      setConditions([...conditions, conditionInput.trim()]);
      setConditionInput('');
    }
  };
  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  // Medication table handlings
  const addMedication = () => {
    if (medName.trim()) {
      setMedications([...medications, { name: medName.trim(), dosage: medDosage.trim(), frequency: medFreq.trim() }]);
      setMedName('');
      setMedDosage('');
      setMedFreq('');
    }
  };
  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // Surgery table handlings
  const addSurgery = () => {
    if (surgName.trim()) {
      setSurgeries([...surgeries, { name: surgName.trim(), date: surgDate, notes: surgNotes.trim() }]);
      setSurgName('');
      setSurgDate('');
      setSurgNotes('');
    }
  };
  const removeSurgery = (index: number) => {
    setSurgeries(surgeries.filter((_, i) => i !== index));
  };

  // Specialisation selection
  const toggleSpecialisation = (spec: string) => {
    if (selectedSpecs.includes(spec)) {
      setSelectedSpecs(selectedSpecs.filter((s) => s !== spec));
    } else {
      setSelectedSpecs([...selectedSpecs, spec]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Loading your medical files...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Overview Headings */}
      <div>
        <h1 className="text-xl font-bold text-surface-900 tracking-tight">Medical Profile</h1>
        <p className="text-xs text-surface-500 mt-1">Keep your clinical history and demographics updated for coordination care.</p>
      </div>

      {successMsg && (
        <div className="bg-success-50 border border-success-200 text-success-700 text-xs rounded-md p-4 animate-slide-down">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-md p-4 animate-slide-down">
          {errorMsg}
        </div>
      )}

      {/* ─── Card 1: Core Patient Metadata (Read-Only) ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Demographics (Immutable)</h2>
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

      {/* ─── Card 2: Demographics (Editable) ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Demographics (Editable)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-surface-600">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-white border border-surface-200 rounded-md text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
            >
              <option value="">Select blood type</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <Input
            label="Primary Language"
            type="text"
            placeholder="e.g. Arabic"
            value={primaryLanguage}
            onChange={(e) => setPrimaryLanguage(e.target.value)}
          />
        </div>
      </Card>

      {/* ─── Card 3: Emergency Contact ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Emergency Contact</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Contact Name"
            type="text"
            placeholder="Name of contact"
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
          />
          <Input
            label="Contact Phone"
            type="tel"
            placeholder="+971..."
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
          />
          <Input
            label="Relationship"
            type="text"
            placeholder="e.g. Spouse"
            value={emergencyRelation}
            onChange={(e) => setEmergencyRelation(e.target.value)}
          />
        </div>
      </Card>

      {/* ─── Card 4: Allergies & Chronic Conditions ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Allergies */}
        <Card>
          <div className="border-b border-surface-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Allergies</h2>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                label="Add Allergy"
                type="text"
                placeholder="e.g. Penicillin"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                className="flex-1"
              />
              <Button type="button" onClick={addAllergy} className="mt-[22px] px-3 shrink-0">Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-surface-100 border border-surface-200 text-surface-700 text-xs px-2.5 py-1 rounded-md"
                >
                  {allergy}
                  <button type="button" onClick={() => removeAllergy(idx)} className="text-surface-400 hover:text-surface-600 font-bold ml-1">×</button>
                </span>
              ))}
              {allergies.length === 0 && <p className="text-xs text-surface-400">No allergies logged.</p>}
            </div>
          </div>
        </Card>

        {/* Chronic Conditions */}
        <Card>
          <div className="border-b border-surface-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Chronic Conditions</h2>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                label="Add Condition"
                type="text"
                placeholder="e.g. Hypertension"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                className="flex-1"
              />
              <Button type="button" onClick={addCondition} className="mt-[22px] px-3 shrink-0">Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {conditions.map((cond, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-surface-100 border border-surface-200 text-surface-700 text-xs px-2.5 py-1 rounded-md"
                >
                  {cond}
                  <button type="button" onClick={() => removeCondition(idx)} className="text-surface-400 hover:text-surface-600 font-bold ml-1">×</button>
                </span>
              ))}
              {conditions.length === 0 && <p className="text-xs text-surface-400">No chronic conditions logged.</p>}
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Card 5: Current Medications ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Current Medications</h2>
        </div>
        <div className="space-y-4">
          {/* Add medication controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Input label="Medication Name" placeholder="e.g. Aspirin" value={medName} onChange={(e) => setMedName(e.target.value)} />
            <Input label="Dosage" placeholder="e.g. 100mg" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} />
            <Input label="Frequency" placeholder="e.g. Once daily" value={medFreq} onChange={(e) => setMedFreq(e.target.value)} />
            <Button type="button" onClick={addMedication} className="w-full">Add Med</Button>
          </div>

          {/* Medications list */}
          <div className="border border-surface-200 rounded-md overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold">
                  <th className="p-3">Name</th>
                  <th className="p-3">Dosage</th>
                  <th className="p-3">Frequency</th>
                  <th className="p-3 w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {medications.map((med, idx) => (
                  <tr key={idx} className="hover:bg-surface-50">
                    <td className="p-3 font-medium">{med.name}</td>
                    <td className="p-3">{med.dosage || '—'}</td>
                    <td className="p-3">{med.frequency || '—'}</td>
                    <td className="p-3 text-center">
                      <button type="button" onClick={() => removeMedication(idx)} className="text-danger-600 hover:text-danger-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
                {medications.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-surface-400">No medications logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ─── Card 6: Surgical History ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Surgical History</h2>
        </div>
        <div className="space-y-4">
          {/* Add surgery controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Input label="Surgery Name" placeholder="e.g. Appendectomy" value={surgName} onChange={(e) => setSurgName(e.target.value)} />
            <Input label="Surgery Date" type="date" value={surgDate} onChange={(e) => setSurgDate(e.target.value)} />
            <Input label="Surgical Notes" placeholder="e.g. Laparoscopic" value={surgNotes} onChange={(e) => setSurgNotes(e.target.value)} className="sm:col-span-1" />
            <Button type="button" onClick={addSurgery} className="w-full">Add Surgery</Button>
          </div>

          {/* Surgeries list */}
          <div className="border border-surface-200 rounded-md overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold">
                  <th className="p-3">Surgery</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {surgeries.map((surg, idx) => (
                  <tr key={idx} className="hover:bg-surface-50">
                    <td className="p-3 font-medium">{surg.name}</td>
                    <td className="p-3 whitespace-nowrap">{surg.date || '—'}</td>
                    <td className="p-3">{surg.notes || '—'}</td>
                    <td className="p-3 text-center">
                      <button type="button" onClick={() => removeSurgery(idx)} className="text-danger-600 hover:text-danger-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
                {surgeries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-surface-400">No surgeries logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ─── Card 7: Required Medical Specialties ─── */}
      <Card>
        <div className="border-b border-surface-100 pb-3 mb-4">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">Required Care Specialities</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {specialisationOptions.map((spec) => {
            const isChecked = selectedSpecs.includes(spec);
            return (
              <label
                key={spec}
                className={`
                  flex items-center gap-2.5 px-3 py-2 border rounded-md cursor-pointer transition-colors text-xs font-medium
                  ${
                    isChecked
                      ? 'border-primary-500 bg-primary-50/20 text-primary-700'
                      : 'border-surface-200 text-surface-700 hover:border-surface-300'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSpecialisation(spec)}
                  className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500/20"
                />
                {spec}
              </label>
            );
          })}
        </div>
      </Card>

      {/* ─── Submit Actions ─── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200">
        <Button type="submit" isLoading={isSaving} size="lg">
          Save Medical Profile
        </Button>
      </div>
    </form>
  );
}
