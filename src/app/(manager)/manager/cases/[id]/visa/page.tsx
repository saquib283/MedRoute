'use client';

/**
 * MediRoute India — Visa Assistance Request Form
 * Full-page form for requesting medical invitation letters.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import { Save, ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Attendant { name: string; passport: string; relation: string }
interface HospitalOption { id: string; name: string }

export default function VisaRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  const [hospitalId, setHospitalId] = useState('');
  const [patientFullName, setPatientFullName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [treatmentDescription, setTreatmentDescription] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [estimatedDeparture, setEstimatedDeparture] = useState('');
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [notes, setNotes] = useState('');

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);

  useEffect(() => { params.then(p => setCaseId(p.id)); }, [params]);

  useEffect(() => {
    fetch('/api/v1/manager/hospitals').then(r => r.json()).then(d => {
      if (d.data?.hospitals) setHospitals(d.data.hospitals);
      else if (d.hospitals) setHospitals(d.hospitals);
    }).catch(() => {});
  }, []);

  // Calculate stay duration for FRRO warning
  const stayDays = estimatedArrival && estimatedDeparture
    ? Math.ceil((new Date(estimatedDeparture).getTime() - new Date(estimatedArrival).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const frroRequired = stayDays > 180;

  const addAttendant = () => {
    setAttendants([...attendants, { name: '', passport: '', relation: '' }]);
  };

  const removeAttendant = (idx: number) => {
    setAttendants(attendants.filter((_, i) => i !== idx));
  };

  const updateAttendant = (idx: number, field: keyof Attendant, value: string) => {
    const updated = [...attendants];
    updated[idx][field] = value;
    setAttendants(updated);
  };

  const handleSave = async () => {
    if (!patientFullName.trim() || !nationality.trim()) {
      toast.error('Patient name and nationality are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/manager/visa-assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          hospitalId: hospitalId || undefined,
          patientFullName,
          passportNumber: passportNumber || undefined,
          nationality,
          treatmentDescription: treatmentDescription || undefined,
          estimatedArrival: estimatedArrival || undefined,
          estimatedDeparture: estimatedDeparture || undefined,
          attendantCount: attendants.length,
          attendantDetails: attendants.filter(a => a.name.trim()),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Visa assistance request submitted');
        router.push(`/manager/cases/${caseId}`);
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch {
      toast.error('Error submitting visa request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <PageHeader
        title="Visa Assistance Request"
        subtitle="Request a medical invitation letter for the patient's visa application"
        breadcrumbs={[
          { label: 'Cases', href: '/manager/cases' },
          { label: 'Case Detail', href: `/manager/cases/${caseId}` },
          { label: 'Visa Request' },
        ]}
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        }
      />

      {/* Patient Details */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Patient & Travel Details</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Input label="Full Name (as in passport) *" value={patientFullName} onChange={e => setPatientFullName(e.target.value)} placeholder="Full legal name" />
          <Input label="Passport Number" value={passportNumber} onChange={e => setPassportNumber(e.target.value)} placeholder="e.g. A12345678" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Input label="Nationality *" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. Nigerian" />
          <Input label="Estimated Arrival" type="date" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} />
          <Input label="Estimated Departure" type="date" value={estimatedDeparture} onChange={e => setEstimatedDeparture(e.target.value)} />
        </div>
        {stayDays > 0 && (
          <p className="text-sm text-surface-600">
            Estimated stay: <span className="font-bold">{stayDays} days</span>
          </p>
        )}
        {frroRequired && (
          <div className="flex items-center gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-warning-600 shrink-0" />
            <span className="text-sm text-warning-800 font-medium">
              Stay exceeds 180 days — FRRO registration will be required after arrival in India.
            </span>
          </div>
        )}
      </Card>

      {/* Hospital & Treatment */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Hospital & Treatment</h3>
        <Select
          label="Treating Hospital"
          value={hospitalId}
          onChange={setHospitalId}
          options={[{ value: '', label: '— Select Hospital —' }, ...hospitals.map(h => ({ value: h.id, label: h.name }))]}
        />
        <div>
          <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-1">Treatment Description</label>
          <textarea
            value={treatmentDescription}
            onChange={e => setTreatmentDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all resize-none"
            placeholder="Describe the treatment/procedure for the visa letter..."
          />
        </div>
      </Card>

      {/* Attendants */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Accompanying Persons</h3>
          <Button size="sm" variant="secondary" onClick={addAttendant}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Attendant
          </Button>
        </div>
        {attendants.length === 0 ? (
          <p className="text-sm text-surface-400">No attendants added. Click &ldquo;Add Attendant&rdquo; if the patient is travelling with family or caregivers.</p>
        ) : (
          attendants.map((att, idx) => (
            <div key={idx} className="p-4 bg-surface-50 rounded-xl border border-surface-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-surface-500">Attendant {idx + 1}</span>
                <button onClick={() => removeAttendant(idx)} className="text-danger-500 hover:text-danger-700 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Input label="Full Name" value={att.name} onChange={e => updateAttendant(idx, 'name', e.target.value)} placeholder="Full name" />
                <Input label="Passport No." value={att.passport} onChange={e => updateAttendant(idx, 'passport', e.target.value)} placeholder="Passport number" />
                <Input label="Relation" value={att.relation} onChange={e => updateAttendant(idx, 'relation', e.target.value)} placeholder="e.g. Spouse, Brother" />
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Notes & Actions */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <div>
          <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-1">Additional Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all resize-none"
            placeholder="Any special requirements or notes..."
          />
        </div>
      </Card>

      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} isLoading={saving} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> Submit Visa Request
        </Button>
      </div>
    </div>
  );
}
